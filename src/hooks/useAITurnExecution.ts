/**
 * useAITurnExecution - Hook to execute AI faction turns
 *
 * Provides functions to start and manage AI turn execution,
 * integrating with the AI Controller Service and Redux state.
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store/store';
import {
  startAITurns,
  updateAITurnStatus,
  logAIAction,
  completeCurrentFactionTurn,
  finishAITurns,
  setAIError,
  selectIsAIProcessing,
} from '../store/slices/aiTurnSlice';
import {
  runAITurn,
  isAIControlled,
  type AITurnStatus,
  type AIControllerConfig,
} from '../services/ai/AIControllerService';
import type { Faction } from '../types/faction';

const DEFAULT_AI_CONFIG: AIControllerConfig = {
  baseActionDelay: 750,
  delayVariance: 250,
  maxActionsPerTurn: 5,
  enableLogging: true,
};

export function useAITurnExecution() {
  const dispatch = useDispatch<AppDispatch>();
  const isProcessing = useSelector(selectIsAIProcessing);
  const difficulty = useSelector((state: RootState) => state.gameMode.aiDifficulty);
  const factions = useSelector((state: RootState) => state.factions.factions);
  const systems = useSelector((state: RootState) => state.sector.currentSector?.systems ?? []);
  const playerFactionId = useSelector((state: RootState) => state.gameMode.playerFactionId);

  /**
   * Get all AI-controlled factions (non-player factions)
   */
  const getAIFactions = useCallback((): Faction[] => {
    return factions.filter((faction) => isAIControlled(faction, playerFactionId));
  }, [factions, playerFactionId]);

  /**
   * Execute turns for all AI factions
   */
  const executeAITurns = useCallback(async () => {
    if (isProcessing) {
      console.warn('[AI] Already processing AI turns');
      return;
    }

    const aiFactions = getAIFactions();
    if (aiFactions.length === 0) {
      console.log('[AI] No AI factions to process');
      return;
    }

    console.log(`[AI] Starting turns for ${aiFactions.length} AI factions`);

    // Start AI turn processing
    dispatch(
      startAITurns({
        factionIds: aiFactions.map((f) => f.id),
        factionNames: aiFactions.map((f) => f.name),
      })
    );

    // Process each faction sequentially
    for (const faction of aiFactions) {
      try {
        console.log(`[AI] Processing turn for ${faction.name}`);

        // Status update callback
        const onStatusUpdate = (status: AITurnStatus) => {
          dispatch(updateAITurnStatus(status));

          // Log actions for the news feed
          if (status.currentAction) {
            dispatch(
              logAIAction({
                factionId: faction.id,
                factionName: faction.name,
                action: status.currentAction,
              })
            );
          }
        };

        // Execute the AI turn
        await runAITurn(
          faction,
          factions,
          systems,
          difficulty,
          dispatch,
          onStatusUpdate,
          DEFAULT_AI_CONFIG
        );

        // Mark this faction's turn as complete
        dispatch(completeCurrentFactionTurn());
      } catch (error) {
        console.error(`[AI] Error processing turn for ${faction.name}:`, error);
        dispatch(setAIError(`Error processing ${faction.name}'s turn`));
      }
    }

    // All AI turns complete
    console.log('[AI] All AI faction turns complete');
    dispatch(finishAITurns());
  }, [dispatch, isProcessing, getAIFactions, factions, systems, difficulty]);

  /**
   * Check if there are any AI factions to process
   */
  const hasAIFactions = useCallback((): boolean => {
    return getAIFactions().length > 0;
  }, [getAIFactions]);

  return {
    executeAITurns,
    isProcessing,
    hasAIFactions,
    getAIFactions,
  };
}

