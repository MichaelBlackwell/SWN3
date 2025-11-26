import { configureStore } from '@reduxjs/toolkit';
import { localStorageAutoSave } from './middleware/localStorageAutoSave';
import { goalTrackingMiddleware } from './middleware/goalTrackingMiddleware';
import { victoryMiddleware } from './middleware/victoryMiddleware';
import { rootReducer } from './rootReducer';

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(goalTrackingMiddleware, victoryMiddleware, localStorageAutoSave),
});

export type AppDispatch = typeof store.dispatch;
export type { RootState } from './rootReducer';

