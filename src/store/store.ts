import { configureStore } from '@reduxjs/toolkit';
import sectorReducer from './slices/sectorSlice';
import factionsReducer from './slices/factionsSlice';
import turnReducer from './slices/turnSlice';
import narrativeReducer from './slices/narrativeSlice';
import gameModeReducer from './slices/gameModeSlice';
import tutorialReducer from './slices/tutorialSlice';
import { localStorageAutoSave } from './middleware/localStorageAutoSave';

export const store = configureStore({
  reducer: {
    sector: sectorReducer,
    factions: factionsReducer,
    turn: turnReducer,
    narrative: narrativeReducer,
    gameMode: gameModeReducer,
    tutorial: tutorialReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(localStorageAutoSave),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

