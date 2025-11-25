import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type GameMode = 'menu' | 'editor' | 'scenario';

export interface ScenarioConfig {
  name: string;
  description: string;
  systemCount: { min: number; max: number };
  factionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  specialRules?: string[];
}

interface GameModeState {
  mode: GameMode;
  currentScenario: ScenarioConfig | null;
}

const initialState: GameModeState = {
  mode: 'menu',
  currentScenario: null,
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
    },
    returnToMenu: (state) => {
      state.mode = 'menu';
      state.currentScenario = null;
    },
  },
});

export const { setGameMode, setScenario, returnToMenu } = gameModeSlice.actions;
export default gameModeSlice.reducer;

