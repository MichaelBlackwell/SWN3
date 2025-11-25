import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export type NarrativeLogType = 
  | 'combat' 
  | 'trade' 
  | 'movement' 
  | 'economic' 
  | 'political' 
  | 'espionage' 
  | 'general' 
  | 'system';

export interface NarrativeLogEntry {
  id: string;
  timestamp: number;
  text: string;
  type: NarrativeLogType;
  relatedEntityIds?: string[]; // Array of faction IDs, asset IDs, system IDs, etc.
}

export interface NarrativeState {
  logs: NarrativeLogEntry[];
}

const initialState: NarrativeState = {
  logs: [],
};

export interface AddLogEntryPayload {
  id?: string; // Optional, will generate if not provided
  timestamp?: number; // Optional, will use current time if not provided
  text: string;
  type: NarrativeLogType;
  relatedEntityIds?: string[];
}

const narrativeSlice = createSlice({
  name: 'narrative',
  initialState,
  reducers: {
    addLogEntry: (state, action: PayloadAction<AddLogEntryPayload>) => {
      const { id, timestamp, text, type, relatedEntityIds } = action.payload;
      
      const entry: NarrativeLogEntry = {
        id: id || crypto.randomUUID(),
        timestamp: timestamp ?? Date.now(),
        text,
        type,
        relatedEntityIds: relatedEntityIds || [],
      };

      // Prepend to the start of the array so newest entries appear first
      state.logs.unshift(entry);
    },
    
    clearLogs: (state) => {
      state.logs = [];
    },
    
    removeLogEntry: (state, action: PayloadAction<string>) => {
      state.logs = state.logs.filter((log) => log.id !== action.payload);
    },
  },
});

export const { addLogEntry, clearLogs, removeLogEntry } = narrativeSlice.actions;
export default narrativeSlice.reducer;

// Selectors
export const selectAllLogs = (state: RootState) => state.narrative.logs;

export const selectLogsByType = (type: NarrativeLogType) => (state: RootState) => {
  return state.narrative.logs.filter((log: NarrativeLogEntry) => log.type === type);
};

export const selectLogsByEntity = (entityId: string) => (state: RootState) => {
  return state.narrative.logs.filter((log: NarrativeLogEntry) => 
    log.relatedEntityIds?.includes(entityId)
  );
};

export const selectRecentLogs = (count: number) => (state: RootState) => {
  return state.narrative.logs.slice(0, count);
};












