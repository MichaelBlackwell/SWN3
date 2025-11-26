/**
 * Helper function to hydrate the Redux store with saved game state.
 * 
 * Dispatches all necessary hydration actions to restore sector, factions, and turn state
 * from a SavePayload. This is a convenience function that coordinates multiple slice actions.
 * 
 * @param dispatch - Redux dispatch function
 * @param payload - SavePayload containing the saved game state
 */

import type { AppDispatch } from '../store/store';
import type { SavePayload } from '../services/saveManager';
import { hydrateSector } from '../store/slices/sectorSlice';
import { hydrateFactions } from '../store/slices/factionsSlice';
import { hydrateTurn } from '../store/slices/turnSlice';

/**
 * Hydrates the Redux store with saved game state.
 * 
 * @param dispatch - Redux dispatch function
 * @param payload - SavePayload containing the saved game state
 */
export function hydrateStateFromSave(dispatch: AppDispatch, payload: SavePayload): void {
  // Hydrate sector
  dispatch(hydrateSector(payload.sector));

  // Hydrate factions
  dispatch(hydrateFactions(payload.factions));

  // Hydrate turn state (if present)
  if (payload.turn !== undefined && payload.phase !== undefined) {
    dispatch(hydrateTurn({ turn: payload.turn, phase: payload.phase }));
  }
}










