import { combineReducers } from '@reduxjs/toolkit';
import sectorReducer from './slices/sectorSlice';
import factionsReducer from './slices/factionsSlice';
import turnReducer from './slices/turnSlice';
import narrativeReducer from './slices/narrativeSlice';
import gameModeReducer from './slices/gameModeSlice';
import tutorialReducer from './slices/tutorialSlice';
import audioReducer from './slices/audioSlice';

export const rootReducer = combineReducers({
  sector: sectorReducer,
  factions: factionsReducer,
  turn: turnReducer,
  narrative: narrativeReducer,
  gameMode: gameModeReducer,
  tutorial: tutorialReducer,
  audio: audioReducer,
});

export type RootState = ReturnType<typeof rootReducer>;


