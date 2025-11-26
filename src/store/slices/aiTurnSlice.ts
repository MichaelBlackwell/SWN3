/**
 * AI Turn Slice - Manages state for AI faction turns
 *
 * Tracks the progress of AI faction turns, including which faction
 * is currently executing, what phase they're in, and any actions
 * they're taking.
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { AITurnStatus, AITurnPhase } from '../../services/ai/AIControllerService';
import type { DifficultyLevel } from '../../services/ai/DifficultyScaler';

export interface AITurnState {
  /** Whether AI turns are currently being processed */
  isProcessing: boolean;
  /** Current faction being processed (null if not processing) */
  currentFactionId: string | null;
  /** Current faction name for display */
  currentFactionName: string | null;
  /** Current phase of AI turn */
  currentPhase: AITurnPhase;
  /** Progress percentage (0-100) */
  progress: number;
  /** Description of current action being executed */
  currentAction: string | null;
  /** Number of actions completed */
  actionsCompleted: number;
  /** Total actions to execute */
  totalActions: number;
  /** Queue of faction IDs waiting to take their turn */
  factionQueue: string[];
  /** Factions that have completed their turn this round */
  completedFactions: string[];
  /** Any error that occurred during AI turn */
  error: string | null;
  /** AI difficulty level */
  difficulty: DifficultyLevel;
  /** Whether to show AI turn overlay */
  showOverlay: boolean;
  /** Log of AI actions for the news feed */
  actionLog: Array<{
    factionId: string;
    factionName: string;
    action: string;
    timestamp: number;
  }>;
}

const initialState: AITurnState = {
  isProcessing: false,
  currentFactionId: null,
  currentFactionName: null,
  currentPhase: 'idle',
  progress: 0,
  currentAction: null,
  actionsCompleted: 0,
  totalActions: 0,
  factionQueue: [],
  completedFactions: [],
  error: null,
  difficulty: 'normal',
  showOverlay: true,
  actionLog: [],
};

const aiTurnSlice = createSlice({
  name: 'aiTurn',
  initialState,
  reducers: {
    /** Start processing AI turns for a list of factions */
    startAITurns: (state, action: PayloadAction<{ factionIds: string[]; factionNames: string[] }>) => {
      state.isProcessing = true;
      state.factionQueue = [...action.payload.factionIds];
      state.completedFactions = [];
      state.error = null;
      state.actionLog = [];
      state.showOverlay = true;

      // Start with first faction
      if (state.factionQueue.length > 0) {
        const firstFactionId = state.factionQueue[0];
        const firstFactionIndex = action.payload.factionIds.indexOf(firstFactionId);
        state.currentFactionId = firstFactionId;
        state.currentFactionName = action.payload.factionNames[firstFactionIndex] || 'Unknown';
        state.currentPhase = 'analysis';
        state.progress = 0;
      }
    },

    /** Update the status of the current AI turn */
    updateAITurnStatus: (state, action: PayloadAction<AITurnStatus>) => {
      const status = action.payload;
      state.currentFactionId = status.factionId;
      state.currentFactionName = status.factionName;
      state.currentPhase = status.phase;
      state.progress = status.progress;
      state.currentAction = status.currentAction;
      state.actionsCompleted = status.actionsCompleted;
      state.totalActions = status.totalActions;

      if (status.error) {
        state.error = status.error;
      }
    },

    /** Log an AI action for the news feed */
    logAIAction: (state, action: PayloadAction<{ factionId: string; factionName: string; action: string }>) => {
      state.actionLog.push({
        ...action.payload,
        timestamp: Date.now(),
      });
    },

    /** Complete the current faction's turn and move to the next */
    completeCurrentFactionTurn: (state) => {
      if (state.currentFactionId) {
        state.completedFactions.push(state.currentFactionId);
        state.factionQueue = state.factionQueue.filter((id) => id !== state.currentFactionId);
      }

      // Move to next faction
      if (state.factionQueue.length > 0) {
        state.currentFactionId = state.factionQueue[0];
        state.currentPhase = 'analysis';
        state.progress = 0;
        state.currentAction = null;
        state.actionsCompleted = 0;
        state.totalActions = 0;
      } else {
        // All factions done
        state.currentFactionId = null;
        state.currentFactionName = null;
        state.currentPhase = 'complete';
        state.progress = 100;
      }
    },

    /** Finish all AI turns */
    finishAITurns: (state) => {
      state.isProcessing = false;
      state.currentFactionId = null;
      state.currentFactionName = null;
      state.currentPhase = 'idle';
      state.progress = 0;
      state.currentAction = null;
      state.actionsCompleted = 0;
      state.totalActions = 0;
      state.factionQueue = [];
      // Keep completedFactions and actionLog for reference
    },

    /** Set AI difficulty level */
    setAIDifficulty: (state, action: PayloadAction<DifficultyLevel>) => {
      state.difficulty = action.payload;
    },

    /** Toggle overlay visibility */
    setShowOverlay: (state, action: PayloadAction<boolean>) => {
      state.showOverlay = action.payload;
    },

    /** Set error state */
    setAIError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    /** Reset AI turn state */
    resetAITurnState: () => initialState,

    /** Clear action log */
    clearActionLog: (state) => {
      state.actionLog = [];
    },
  },
});

export const {
  startAITurns,
  updateAITurnStatus,
  logAIAction,
  completeCurrentFactionTurn,
  finishAITurns,
  setAIDifficulty,
  setShowOverlay,
  setAIError,
  resetAITurnState,
  clearActionLog,
} = aiTurnSlice.actions;

// Selectors
export const selectIsAIProcessing = (state: RootState) => state.aiTurn.isProcessing;
export const selectCurrentAIFactionId = (state: RootState) => state.aiTurn.currentFactionId;
export const selectCurrentAIFactionName = (state: RootState) => state.aiTurn.currentFactionName;
export const selectAITurnPhase = (state: RootState) => state.aiTurn.currentPhase;
export const selectAITurnProgress = (state: RootState) => state.aiTurn.progress;
export const selectAICurrentAction = (state: RootState) => state.aiTurn.currentAction;
export const selectAIDifficulty = (state: RootState) => state.aiTurn.difficulty;
export const selectAIActionLog = (state: RootState) => state.aiTurn.actionLog;
export const selectShowAIOverlay = (state: RootState) => state.aiTurn.showOverlay;
export const selectAIError = (state: RootState) => state.aiTurn.error;
export const selectAIFactionQueue = (state: RootState) => state.aiTurn.factionQueue;
export const selectAICompletedFactions = (state: RootState) => state.aiTurn.completedFactions;

export default aiTurnSlice.reducer;

