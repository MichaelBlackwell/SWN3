import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { store } from '../store/store';
import {
  advancePhase,
  setPhase,
  setTurn,
  stageAction,
  commitAction,
  cancelStagedAction,
  saveHistorySnapshot,
  undo,
  redo,
  selectCurrentTurn,
  selectCurrentPhase,
  selectActionStaged,
  selectActionCommitted,
  selectStagedActionType,
  selectStagedActionPayload,
  selectCanStageAction,
  selectCanCommitAction,
  selectCanUndo,
  selectCanRedo,
  selectCurrentHistorySnapshot,
  selectHistory,
  selectHistoryIndex,
  type TurnPhase,
} from '../store/slices/turnSlice';
import { moveAsset, updateFaction, repairMultipleAssets, repairFactionHp, executeAssetAbility, addBaseOfInfluence } from '../store/slices/factionsSlice';

/**
 * Hook for accessing and managing turn phase state
 * Provides convenient access to turn/phase state and actions
 */
export function useTurnPhase() {
  const dispatch = useDispatch();

  // Selectors
  const turn = useSelector(selectCurrentTurn);
  const phase = useSelector(selectCurrentPhase);
  const actionStaged = useSelector(selectActionStaged);
  const actionCommitted = useSelector(selectActionCommitted);
  const stagedActionType = useSelector(selectStagedActionType);
  const stagedActionPayload = useSelector(selectStagedActionPayload);
  const canStageAction = useSelector(selectCanStageAction);
  const canCommitAction = useSelector(selectCanCommitAction);
  const canUndo = useSelector(selectCanUndo);
  const canRedo = useSelector(selectCanRedo);
  const currentHistorySnapshot = useSelector(selectCurrentHistorySnapshot);
  const history = useSelector(selectHistory);
  const historyIndex = useSelector(selectHistoryIndex);

  // Actions
  const handleAdvancePhase = useCallback(() => {
    dispatch(advancePhase());
  }, [dispatch]);

  const handleSetPhase = useCallback(
    (newPhase: TurnPhase) => {
      dispatch(setPhase(newPhase));
    },
    [dispatch]
  );

  const handleSetTurn = useCallback(
    (newTurn: number) => {
      dispatch(setTurn(newTurn));
    },
    [dispatch]
  );

  const handleStageAction = useCallback(
    (actionType: string) => {
      dispatch(stageAction(actionType));
    },
    [dispatch]
  );

  const handleCommitAction = useCallback(() => {
    const state = store.getState();
    const currentStagedActionType = state.turn.stagedActionType;
    const currentStagedActionPayload = state.turn.stagedActionPayload;

    // Execute the action before committing
    if (currentStagedActionType === 'MOVE_ASSET' && currentStagedActionPayload) {
      const { assetId, destination, factionId } = currentStagedActionPayload as {
        assetId: string;
        destination: string;
        factionId: string;
      };

      const faction = state.factions.factions.find((f) => f.id === factionId);
      if (faction && faction.facCreds >= 1) {
        // Deduct movement cost (1 FacCred)
        dispatch(updateFaction({
          ...faction,
          facCreds: faction.facCreds - 1,
        }));
        // Execute movement
        dispatch(moveAsset({
          factionId,
          assetId,
          newLocation: destination,
        }));
      }
    } else if (currentStagedActionType === 'REPAIR' && currentStagedActionPayload) {
      const { factionId, assetRepairs, factionRepair } = currentStagedActionPayload as {
        factionId: string;
        assetRepairs?: Array<{ assetId: string; hpHealed: number; cost: number }>;
        factionRepair?: { hpHealed: number; cost: number };
      };

      const faction = state.factions.factions.find((f) => f.id === factionId);
      if (!faction) {
        dispatch(commitAction());
        return;
      }

      // Calculate total cost
      const assetCost = assetRepairs?.reduce((sum, repair) => sum + repair.cost, 0) || 0;
      const factionCost = factionRepair?.cost || 0;
      const totalCost = assetCost + factionCost;

      // Validate faction has enough credits
      if (faction.facCreds >= totalCost) {
        // Repair assets if any
        if (assetRepairs && assetRepairs.length > 0) {
          dispatch(repairMultipleAssets({
            factionId,
            repairs: assetRepairs,
            totalCost: assetCost,
          }));
        }

        // Repair faction HP if requested
        if (factionRepair) {
          dispatch(repairFactionHp({
            factionId,
            hpHealed: factionRepair.hpHealed,
            cost: factionRepair.cost,
          }));
        }
      }
    } else if (currentStagedActionType === 'USE_ABILITY' && currentStagedActionPayload) {
      const { factionId, assetId, abilityResult } = currentStagedActionPayload as {
        factionId: string;
        assetId: string;
        abilityResult: {
          facCredsGained?: number;
          facCredsLost?: number;
          cost?: number;
          shouldDestroyAsset?: boolean;
        };
      };

      const faction = state.factions.factions.find((f) => f.id === factionId);
      if (!faction) {
        dispatch(commitAction());
        return;
      }

      // Execute the ability
      dispatch(executeAssetAbility({
        factionId,
        assetId,
        ...abilityResult,
      }));
    } else if (currentStagedActionType === 'EXPAND_INFLUENCE' && currentStagedActionPayload) {
      const { factionId, targetSystemId, hp, cost, rollResult } = currentStagedActionPayload as {
        factionId: string;
        targetSystemId: string;
        hp: number;
        cost: number;
        rollResult: {
          success: boolean;
          expandingFactionRoll: number;
          expandingFactionTotal: number;
          opposingRolls: Array<{
            factionId: string;
            factionName: string;
            roll: number;
            total: number;
            canAttack: boolean;
          }>;
        };
      };

      const faction = state.factions.factions.find((f) => f.id === factionId);
      if (!faction) {
        dispatch(commitAction());
        return;
      }

      // Validate faction has enough credits
      if (faction.facCreds >= cost) {
        // Create the Base of Influence
        dispatch(addBaseOfInfluence({
          factionId,
          systemId: targetSystemId,
          hp,
          cost,
        }));

        // TODO: Handle opposing faction attacks if rollResult indicates they can attack
        // For now, we'll just create the base. The attack resolution can be handled separately
        // or in a future enhancement.
      }
    }

    // Commit the action (advances to News phase)
    dispatch(commitAction());
  }, [dispatch]);

  const handleCancelStagedAction = useCallback(() => {
    dispatch(cancelStagedAction());
  }, [dispatch]);

  const handleSaveHistorySnapshot = useCallback(
    (factionsState: unknown) => {
      dispatch(saveHistorySnapshot(factionsState));
    },
    [dispatch]
  );

  const handleUndo = useCallback(() => {
    dispatch(undo());
  }, [dispatch]);

  const handleRedo = useCallback(() => {
    dispatch(redo());
  }, [dispatch]);

  return {
    // State
    turn,
    phase,
    actionStaged,
    actionCommitted,
    stagedActionType,
    stagedActionPayload,
    canStageAction,
    canCommitAction,
    canUndo,
    canRedo,
    currentHistorySnapshot,
    history,
    historyIndex,

    // Actions
    advancePhase: handleAdvancePhase,
    setPhase: handleSetPhase,
    setTurn: handleSetTurn,
    stageAction: handleStageAction,
    commitAction: handleCommitAction,
    cancelStagedAction: handleCancelStagedAction,
    saveHistorySnapshot: handleSaveHistorySnapshot,
    undo: handleUndo,
    redo: handleRedo,
  };
}

