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
  playerFactionId: string | null;
}

const initialState: GameModeState = {
  mode: 'menu',
  currentScenario: null,
  playerFactionId: null,
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
    setPlayerFaction: (state, action: PayloadAction<string | null>) => {
      state.playerFactionId = action.payload;
    },
    returnToMenu: (state) => {
      state.mode = 'menu';
      state.currentScenario = null;
      state.playerFactionId = null;
    },
  },
});

export const { setGameMode, setScenario, setPlayerFaction, returnToMenu } = gameModeSlice.actions;
export default gameModeSlice.reducer;

