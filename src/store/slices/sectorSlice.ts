import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Sector } from '../../types/sector';

interface SectorState {
  currentSector: Sector | null;
  selectedSystemId: string | null;
}

const initialState: SectorState = {
  currentSector: null,
  selectedSystemId: null,
};

const sectorSlice = createSlice({
  name: 'sector',
  initialState,
  reducers: {
    setSector: (state, action: PayloadAction<Sector>) => {
      state.currentSector = action.payload;
    },
    clearSector: (state) => {
      state.currentSector = null;
      state.selectedSystemId = null;
    },
    selectSystem: (state, action: PayloadAction<string | null>) => {
      state.selectedSystemId = action.payload;
    },
    // Hydrate state from a save file
    hydrateSector: (state, action: PayloadAction<Sector | null>) => {
      state.currentSector = action.payload;
      // Reset selected system when hydrating
      state.selectedSystemId = null;
    },
  },
});

export const { setSector, clearSector, selectSystem, hydrateSector } = sectorSlice.actions;
export default sectorSlice.reducer;

