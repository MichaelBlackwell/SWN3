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

export interface GameModeState {
  mode: GameMode;
  currentScenario: ScenarioConfig | null;
  currentView: 'sector' | 'factions';
}

const initialState: GameModeState = {
  mode: 'menu',
  currentScenario: null,
  currentView: 'sector',
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
    setCurrentView: (state, action: PayloadAction<'sector' | 'factions'>) => {
      state.currentView = action.payload;
    },
    returnToMenu: (state) => {
      state.mode = 'menu';
      state.currentScenario = null;
      state.currentView = 'sector';
    },
  },
});

export const { setGameMode, setScenario, setCurrentView, returnToMenu } = gameModeSlice.actions;
export default gameModeSlice.reducer;

