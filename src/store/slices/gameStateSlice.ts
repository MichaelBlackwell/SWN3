import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export type GameStatus = 'playing' | 'victory';

export interface GameStateState {
  gameStatus: GameStatus;
  victorFactionId: string | null;
  eliminatedFactionIds: string[];
}

const initialState: GameStateState = {
  gameStatus: 'playing',
  victorFactionId: null,
  eliminatedFactionIds: [],
};

const gameStateSlice = createSlice({
  name: 'gameState',
  initialState,
  reducers: {
    /**
     * Mark a faction as eliminated (their homeworld Base of Influence was destroyed)
     */
    eliminateFaction: (state, action: PayloadAction<string>) => {
      const factionId = action.payload;
      if (!state.eliminatedFactionIds.includes(factionId)) {
        state.eliminatedFactionIds.push(factionId);
      }
    },

    /**
     * Set the victory state when a faction has won
     */
    setVictory: (state, action: PayloadAction<{ victorFactionId: string }>) => {
      state.gameStatus = 'victory';
      state.victorFactionId = action.payload.victorFactionId;
    },

    /**
     * Continue playing after victory (for sandbox mode)
     */
    continueAfterVictory: (state) => {
      state.gameStatus = 'playing';
      // Keep victorFactionId and eliminatedFactionIds for reference
    },

    /**
     * Reset game state (for new game)
     */
    resetGameState: () => initialState,

    /**
     * Hydrate game state from a save file
     */
    hydrateGameState: (state, action: PayloadAction<Partial<GameStateState>>) => {
      if (action.payload.gameStatus !== undefined) {
        state.gameStatus = action.payload.gameStatus;
      }
      if (action.payload.victorFactionId !== undefined) {
        state.victorFactionId = action.payload.victorFactionId;
      }
      if (action.payload.eliminatedFactionIds !== undefined) {
        state.eliminatedFactionIds = action.payload.eliminatedFactionIds;
      }
    },
  },
});

export const {
  eliminateFaction,
  setVictory,
  continueAfterVictory,
  resetGameState,
  hydrateGameState,
} = gameStateSlice.actions;

// Selectors
export const selectGameStatus = (state: RootState) => state.gameState.gameStatus;
export const selectVictorFactionId = (state: RootState) => state.gameState.victorFactionId;
export const selectEliminatedFactionIds = (state: RootState) => state.gameState.eliminatedFactionIds;
export const selectIsVictory = (state: RootState) => state.gameState.gameStatus === 'victory';

export default gameStateSlice.reducer;


