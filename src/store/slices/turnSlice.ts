import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export type TurnPhase = 'Income' | 'Maintenance' | 'Action' | 'News';

export interface TurnState {
  turn: number;
  phase: TurnPhase;
  actionStaged: boolean;
  actionCommitted: boolean;
  stagedActionType: string | null;
  // Movement mode state
  movementMode: {
    active: boolean;
    assetId: string | null;
    factionId: string | null;
  };
  // Staged action payload (for actions that need additional data)
  stagedActionPayload: {
    type: string;
    assetId?: string;
    destination?: string;
    factionId?: string;
    [key: string]: unknown;
  } | null;
  // History for Undo/Redo during Action phase
  history: Array<{
    factions: unknown; // Snapshot of factions state
    timestamp: number;
  }>;
  historyIndex: number; // Current position in history (-1 = no history)
  maxHistorySize: number;
}

const initialState: TurnState = {
  turn: 1,
  phase: 'Income',
  actionStaged: false,
  actionCommitted: false,
  stagedActionType: null,
  movementMode: {
    active: false,
    assetId: null,
    factionId: null,
  },
  stagedActionPayload: null,
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
};

const turnSlice = createSlice({
  name: 'turn',
  initialState,
  reducers: {
    // Advance to the next phase in the cycle
    advancePhase: (state) => {
      const phaseOrder: TurnPhase[] = ['Income', 'Maintenance', 'Action', 'News'];
      const currentIndex = phaseOrder.indexOf(state.phase);
      
      if (currentIndex === -1) {
        // Invalid phase, reset to Income
        state.phase = 'Income';
        return;
      }

      const nextIndex = (currentIndex + 1) % phaseOrder.length;
      const nextPhase = phaseOrder[nextIndex];

      // If transitioning from News to Income, increment turn
      if (state.phase === 'News' && nextPhase === 'Income') {
        state.turn += 1;
      }

      state.phase = nextPhase;

      // Reset action tracking when leaving Action phase
      if (state.phase !== 'Action') {
        state.actionStaged = false;
        state.actionCommitted = false;
        state.stagedActionType = null;
        // Clear movement mode when leaving Action phase
        state.movementMode = {
          active: false,
          assetId: null,
          factionId: null,
        };
        // Clear history when leaving Action phase
        state.history = [];
        state.historyIndex = -1;
      }
    },

    // Set a specific phase (useful for initialization or testing)
    setPhase: (state, action: PayloadAction<TurnPhase>) => {
      state.phase = action.payload;
      
      // Reset action tracking when leaving Action phase
      if (state.phase !== 'Action') {
        state.actionStaged = false;
        state.actionCommitted = false;
        state.stagedActionType = null;
        // Clear movement mode when leaving Action phase
        state.movementMode = {
          active: false,
          assetId: null,
          factionId: null,
        };
        state.history = [];
        state.historyIndex = -1;
      }
    },

    // Set a specific turn number
    setTurn: (state, action: PayloadAction<number>) => {
      if (action.payload >= 1) {
        state.turn = action.payload;
      }
    },

    // Stage an action (marks that an action is being prepared)
    stageAction: (state, action: PayloadAction<string>) => {
      if (state.phase !== 'Action') {
        return; // Can only stage actions during Action phase
      }
      if (state.actionCommitted) {
        return; // Cannot stage after commit
      }
      
      state.actionStaged = true;
      state.stagedActionType = action.payload;
    },

    // Stage an action with payload data
    stageActionWithPayload: (state, action: PayloadAction<{ type: string; payload: Record<string, unknown> }>) => {
      if (state.phase !== 'Action') {
        return; // Can only stage actions during Action phase
      }
      if (state.actionCommitted) {
        return; // Cannot stage after commit
      }
      
      state.actionStaged = true;
      state.stagedActionType = action.payload.type;
      state.stagedActionPayload = {
        type: action.payload.type,
        ...action.payload.payload,
      };
    },

    // Commit the staged action (finalizes it and advances to News phase)
    commitAction: (state) => {
      if (!state.actionStaged || state.actionCommitted) {
        return; // Must have a staged action and not already committed
      }
      
      state.actionCommitted = true;
      // Advance to News phase after commit
      state.phase = 'News';
      // Clear history after commit
      state.history = [];
      state.historyIndex = -1;
    },

    // Cancel a staged action (allows undoing before commit)
    cancelStagedAction: (state) => {
      if (state.actionCommitted) {
        return; // Cannot cancel after commit
      }
      
      state.actionStaged = false;
      state.stagedActionType = null;
      state.stagedActionPayload = null;
      // Also cancel movement mode if active
      state.movementMode = {
        active: false,
        assetId: null,
        factionId: null,
      };
    },

    // Start movement mode
    startMovementMode: (state, action: PayloadAction<{ assetId: string; factionId: string }>) => {
      if (state.phase !== 'Action') {
        return; // Can only start movement during Action phase
      }
      if (state.actionStaged || state.actionCommitted) {
        return; // Cannot start movement if action already staged/committed
      }
      
      state.movementMode = {
        active: true,
        assetId: action.payload.assetId,
        factionId: action.payload.factionId,
      };
    },

    // Cancel movement mode
    cancelMovementMode: (state) => {
      state.movementMode = {
        active: false,
        assetId: null,
        factionId: null,
      };
    },

    // Save a snapshot of faction state for Undo/Redo
    saveHistorySnapshot: (state, action: PayloadAction<unknown>) => {
      if (state.phase !== 'Action') {
        return; // Only save history during Action phase
      }

      const snapshot = {
        factions: action.payload,
        timestamp: Date.now(),
      };

      // If we're in the middle of history (after an undo), discard future history
      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      // Add new snapshot
      state.history.push(snapshot);

      // Limit history size
      if (state.history.length > state.maxHistorySize) {
        state.history.shift();
      } else {
        state.historyIndex = state.history.length - 1;
      }
    },

    // Undo: restore previous state
    undo: (state) => {
      if (state.phase !== 'Action') {
        return; // Can only undo during Action phase
      }
      if (state.historyIndex <= 0) {
        return; // No history to undo to
      }

      state.historyIndex -= 1;
      // Note: Actual state restoration must be handled by the component/hook
      // that calls this action, as we can't directly modify other slices here
    },

    // Redo: restore next state
    redo: (state) => {
      if (state.phase !== 'Action') {
        return; // Can only redo during Action phase
      }
      if (state.historyIndex >= state.history.length - 1) {
        return; // No future history to redo to
      }

      state.historyIndex += 1;
      // Note: Actual state restoration must be handled by the component/hook
      // that calls this action, as we can't directly modify other slices here
    },

    // Reset turn state (useful for new game)
    resetTurnState: () => initialState,
    // Hydrate state from a save file
    hydrateTurn: (state, action: PayloadAction<{ turn: number; phase: TurnPhase }>) => {
      state.turn = action.payload.turn;
      state.phase = action.payload.phase;
      // Reset action-related state when hydrating
      state.actionStaged = false;
      state.actionCommitted = false;
      state.stagedActionType = null;
      state.stagedActionPayload = null;
      state.movementMode = {
        active: false,
        assetId: null,
        factionId: null,
      };
      state.history = [];
      state.historyIndex = -1;
    },
  },
});

export const {
  advancePhase,
  setPhase,
  setTurn,
  stageAction,
  stageActionWithPayload,
  commitAction,
  cancelStagedAction,
  startMovementMode,
  cancelMovementMode,
  saveHistorySnapshot,
  undo,
  redo,
  resetTurnState,
  hydrateTurn,
} = turnSlice.actions;

// Selectors
export const selectCurrentTurn = (state: RootState) => state.turn.turn;
export const selectCurrentPhase = (state: RootState) => state.turn.phase;
export const selectActionStaged = (state: RootState) => state.turn.actionStaged;
export const selectActionCommitted = (state: RootState) => state.turn.actionCommitted;
export const selectStagedActionType = (state: RootState) => state.turn.stagedActionType;
export const selectStagedActionPayload = (state: RootState) => state.turn.stagedActionPayload;
export const selectHistory = (state: RootState) => state.turn.history;
export const selectHistoryIndex = (state: RootState) => state.turn.historyIndex;

// Derived selectors
export const selectCanStageAction = (state: RootState) => {
  return state.turn.phase === 'Action' && !state.turn.actionStaged && !state.turn.actionCommitted;
};

export const selectCanCommitAction = (state: RootState) => {
  return state.turn.phase === 'Action' && state.turn.actionStaged && !state.turn.actionCommitted;
};

export const selectCanUndo = (state: RootState) => {
  return state.turn.phase === 'Action' && state.turn.historyIndex > 0;
};

export const selectCanRedo = (state: RootState) => {
  return (
    state.turn.phase === 'Action' &&
    state.turn.historyIndex >= 0 &&
    state.turn.historyIndex < state.turn.history.length - 1
  );
};

export const selectCurrentHistorySnapshot = (state: RootState) => {
  if (state.turn.historyIndex >= 0 && state.turn.historyIndex < state.turn.history.length) {
    return state.turn.history[state.turn.historyIndex];
  }
  return null;
};

export const selectMovementMode = (state: RootState) => state.turn.movementMode;

export default turnSlice.reducer;

