import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { DifficultyLevel } from '../../services/ai/DifficultyScaler';

export type GameMode = 'menu' | 'editor' | 'scenario';

export interface ScenarioConfig {
  name: string;
  description: string;
  systemCount: { min: number; max: number };
  factionCount: number;
  difficulty: DifficultyLevel;
  specialRules?: string[];
}

interface GameModeState {
  mode: GameMode;
  currentScenario: ScenarioConfig | null;
  playerFactionId: string | null;
  /** AI difficulty level (affects AI decision quality) */
  aiDifficulty: DifficultyLevel;
}

const initialState: GameModeState = {
  mode: 'menu',
  currentScenario: null,
  playerFactionId: null,
  aiDifficulty: 'normal',
};

const gameModeSlice = createSlice({
  name: 'gameMode',
  initialState,
  reducers: {
    setGameMode: (state, action: PayloadAction<GameMode>) => {
      state.mode = action.payload;
    },
    setScenario: (state, action: PayloadAction<ScenarioConfig | null>) => {
      state.currentScenario = action.payload;
      // Sync AI difficulty with scenario difficulty if set
      if (action.payload?.difficulty) {
        state.aiDifficulty = action.payload.difficulty;
      }
    },
    setPlayerFaction: (state, action: PayloadAction<string | null>) => {
      state.playerFactionId = action.payload;
    },
    setAIDifficulty: (state, action: PayloadAction<DifficultyLevel>) => {
      state.aiDifficulty = action.payload;
    },
    returnToMenu: (state) => {
      state.mode = 'menu';
      state.currentScenario = null;
      state.playerFactionId = null;
      state.aiDifficulty = 'normal';
    },
  },
});

export const { setGameMode, setScenario, setPlayerFaction, setAIDifficulty, returnToMenu } = gameModeSlice.actions;
export default gameModeSlice.reducer;

