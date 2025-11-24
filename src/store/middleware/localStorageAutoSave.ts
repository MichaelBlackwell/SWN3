import type { Middleware } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { saveManager } from '../../services/saveManager';
import { showNotification } from '../../components/NotificationContainer';

/**
 * Actions that should trigger an auto-save to localStorage.
 * These represent critical game state changes.
 */
const AUTO_SAVE_ACTIONS = new Set<string>([
  // Turn management
  'turn/advancePhase',
  'turn/commitAction',
  'turn/setPhase',
  'turn/setTurn',
  
  // Faction management
  'factions/addFaction',
  'factions/removeFaction',
  'factions/updateFaction',
  
  // Asset management
  'factions/addAsset',
  'factions/removeAsset',
  'factions/updateAsset',
  'factions/moveAsset',
  'factions/addBaseOfInfluence',
  
  // Turn processing (Income, Maintenance phases)
  'factions/processIncomePhase',
  'factions/processMaintenancePhase',
  
  // Combat
  'factions/inflictDamage',
  'factions/inflictFactionDamage',
  'factions/repairAsset',
  'factions/repairMultipleAssets',
  'factions/repairFactionHp',
  'factions/executeAssetAbility',
  
  // Sector management
  'sector/setSector',
  'sector/clearSector',
]);

/**
 * Debounce delay in milliseconds for auto-save operations.
 * Prevents excessive localStorage writes during rapid state changes.
 */
const AUTO_SAVE_DEBOUNCE_MS = 500;

/**
 * LocalStorage key for storing the game state.
 */
const STORAGE_KEY = 'gameState';

/**
 * Debounce timer handle for auto-save operations.
 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Pending save state flag to prevent duplicate saves.
 */
let pendingSave = false;

/**
 * Performs the actual save operation to localStorage.
 * 
 * @param state - The current Redux state to save
 */
function performSave(state: RootState): void {
  try {
    const serializedState = saveManager.serialize(state);
    localStorage.setItem(STORAGE_KEY, serializedState);
    pendingSave = false;
  } catch (error) {
    // Log error but don't crash the app
    console.error('Failed to auto-save game state to localStorage:', error);
    
    // Handle quota exceeded error with user notification
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('LocalStorage quota exceeded. Consider exporting save data manually.');
      showNotification(
        'LocalStorage quota exceeded. Auto-save is disabled. Please export your data to free up space.',
        'error',
        8000
      );
    } else {
      // Show generic error notification for other localStorage errors
      showNotification(
        'Failed to auto-save game state. Your progress may not be automatically saved.',
        'error',
        5000
      );
    }
    
    pendingSave = false;
  }
}

/**
 * Schedules a debounced save operation.
 * 
 * @param state - The current Redux state to save
 */
function scheduleSave(state: RootState): void {
  // Clear any existing timer
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  // Mark that we have a pending save
  pendingSave = true;

  // Schedule the save operation
  saveTimer = setTimeout(() => {
    if (pendingSave) {
      performSave(state);
    }
    saveTimer = null;
  }, AUTO_SAVE_DEBOUNCE_MS);
}

/**
 * Redux middleware for automatically saving game state to localStorage.
 * 
 * Listens for critical actions and debounces save operations to prevent
 * performance issues from excessive localStorage writes.
 * 
 * @returns Redux middleware function
 */
export const localStorageAutoSave: Middleware<{}, RootState> = (store) => (next) => (action) => {
  // Execute the action first
  const result = next(action);
  
  // Check if this action should trigger an auto-save
  if (AUTO_SAVE_ACTIONS.has(action.type)) {
    // Get the updated state after the action
    const currentState = store.getState();
    
    // Schedule a debounced save
    scheduleSave(currentState);
  }
  
  return result;
};

/**
 * Manually save the current state immediately (bypasses debounce).
 * Useful for save points before critical operations or when the app is closing.
 * 
 * @param state - The current Redux state to save
 */
export function saveStateImmediately(state: RootState): void {
  // Clear any pending debounced save
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  
  pendingSave = false;
  
  // Perform save immediately
  performSave(state);
}

/**
 * Clear the saved game state from localStorage.
 */
export function clearSavedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear saved game state:', error);
  }
}

/**
 * Check if a saved game state exists in localStorage.
 * 
 * @returns true if saved state exists, false otherwise
 */
export function hasSavedState(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null && saved !== '';
  } catch (error) {
    console.error('Failed to check for saved game state:', error);
    return false;
  }
}

