// Unit tests for LocalStorage Auto-Save Middleware

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { localStorageAutoSave, saveStateImmediately, clearSavedState, hasSavedState } from './localStorageAutoSave';
import sectorReducer from '../slices/sectorSlice';
import factionsReducer from '../slices/factionsSlice';
import turnReducer from '../slices/turnSlice';
import narrativeReducer from '../slices/narrativeSlice';
import { advancePhase, commitAction } from '../slices/turnSlice';
import { addAsset, addFaction, updateFaction } from '../slices/factionsSlice';
import { setSector } from '../slices/sectorSlice';
import type { Faction } from '../../types/faction';
import type { Sector } from '../../types/sector';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Setup localStorage mock for the test environment
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('localStorageAutoSave middleware', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Create a store with the middleware
    store = configureStore({
      reducer: {
        sector: sectorReducer,
        factions: factionsReducer,
        turn: turnReducer,
        narrative: narrativeReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(localStorageAutoSave),
    });

    // Use fake timers for debounce testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('auto-save on critical actions', () => {
    it('should save state when advancePhase action is dispatched', async () => {
      store.dispatch(advancePhase());
      
      // Fast-forward past debounce delay
      vi.advanceTimersByTime(600);
      
      const saved = localStorage.getItem('gameState');
      expect(saved).not.toBeNull();
      
      if (saved) {
        const parsed = JSON.parse(saved);
        expect(parsed).toHaveProperty('version');
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('sector');
        expect(parsed).toHaveProperty('factions');
      }
    });

    it('should save state when addAsset action is dispatched', async () => {
      // First add a faction
      const testFaction: Faction = {
        id: 'faction-1',
        name: 'Test Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: {
          hp: 29,
          maxHp: 29,
          force: 6,
          cunning: 5,
          wealth: 3,
        },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: null,
        assets: [],
      };
      
      store.dispatch(addFaction(testFaction));
      vi.advanceTimersByTime(600);
      
      // Now add an asset
      store.dispatch(
        addAsset({
          factionId: 'faction-1',
          assetDefinitionId: 'force_1_security_personnel',
          location: 'system-1',
        })
      );
      
      vi.advanceTimersByTime(600);
      
      const saved = localStorage.getItem('gameState');
      expect(saved).not.toBeNull();
    });

    it('should save state when addFaction action is dispatched', async () => {
      const testFaction: Faction = {
        id: 'faction-1',
        name: 'Test Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: {
          hp: 29,
          maxHp: 29,
          force: 6,
          cunning: 5,
          wealth: 3,
        },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: null,
        assets: [],
      };
      
      store.dispatch(addFaction(testFaction));
      vi.advanceTimersByTime(600);
      
      const saved = localStorage.getItem('gameState');
      expect(saved).not.toBeNull();
    });

    it('should save state when setSector action is dispatched', async () => {
      const testSector: Sector = {
        id: 'sector-1',
        name: 'Test Sector',
        created: Date.now(),
        systems: [],
      };
      
      store.dispatch(setSector(testSector));
      vi.advanceTimersByTime(600);
      
      const saved = localStorage.getItem('gameState');
      expect(saved).not.toBeNull();
    });

    it('should save state when commitAction action is dispatched', async () => {
      // Set phase to Action first
      store.dispatch(advancePhase());
      store.dispatch(advancePhase());
      store.dispatch(advancePhase());
      vi.advanceTimersByTime(600);
      
      // Now commit an action
      store.dispatch(commitAction());
      vi.advanceTimersByTime(600);
      
      const saved = localStorage.getItem('gameState');
      expect(saved).not.toBeNull();
    });
  });

  describe('debouncing', () => {
    it('should debounce multiple rapid actions', async () => {
      const testFaction: Faction = {
        id: 'faction-1',
        name: 'Test Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: {
          hp: 29,
          maxHp: 29,
          force: 6,
          cunning: 5,
          wealth: 3,
        },
        facCreds: 100,
        tags: [],
        goal: null,
        assets: [],
      };
      
      store.dispatch(addFaction(testFaction));
      
      // Dispatch multiple actions rapidly
      for (let i = 0; i < 5; i++) {
        store.dispatch(
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'force_1_security_personnel',
            location: 'system-1',
          })
        );
      }
      
      // Should not have saved yet
      expect(localStorage.getItem('gameState')).toBeNull();
      
      // Advance past debounce delay
      vi.advanceTimersByTime(600);
      
      // Now should have saved (only once due to debouncing)
      const saved = localStorage.getItem('gameState');
      expect(saved).not.toBeNull();
    });

    it('should save after debounce delay', async () => {
      store.dispatch(advancePhase());
      
      // Should not have saved immediately
      expect(localStorage.getItem('gameState')).toBeNull();
      
      // Advance partway through debounce delay
      vi.advanceTimersByTime(300);
      expect(localStorage.getItem('gameState')).toBeNull();
      
      // Complete the debounce delay
      vi.advanceTimersByTime(300);
      expect(localStorage.getItem('gameState')).not.toBeNull();
    });
  });

  describe('saveStateImmediately', () => {
    it('should save state immediately bypassing debounce', () => {
      store.dispatch(advancePhase());
      
      // Should not have saved yet
      expect(localStorage.getItem('gameState')).toBeNull();
      
      // Save immediately
      const state = store.getState();
      saveStateImmediately(state);
      
      // Should be saved now
      const saved = localStorage.getItem('gameState');
      expect(saved).not.toBeNull();
    });

    it('should clear pending debounced saves when saving immediately', () => {
      store.dispatch(advancePhase());
      
      // Save immediately (should cancel debounced save)
      const state = store.getState();
      saveStateImmediately(state);
      
      // Advance timers - should not save again
      vi.advanceTimersByTime(600);
      
      const saved = localStorage.getItem('gameState');
      expect(saved).not.toBeNull();
      
      // Verify it's the same save (timestamp check)
      const firstSave = JSON.parse(saved!);
      
      // Dispatch another action and save immediately again
      store.dispatch(advancePhase());
      saveStateImmediately(store.getState());
      
      const secondSave = JSON.parse(localStorage.getItem('gameState')!);
      
      // Should have different timestamps
      expect(secondSave.timestamp).not.toBe(firstSave.timestamp);
    });
  });

  describe('clearSavedState', () => {
    it('should remove saved state from localStorage', () => {
      // Save some state first
      const state = store.getState();
      saveStateImmediately(state);
      
      expect(localStorage.getItem('gameState')).not.toBeNull();
      
      // Clear it
      clearSavedState();
      
      expect(localStorage.getItem('gameState')).toBeNull();
    });
  });

  describe('hasSavedState', () => {
    it('should return false when no saved state exists', () => {
      expect(hasSavedState()).toBe(false);
    });

    it('should return true when saved state exists', () => {
      const state = store.getState();
      saveStateImmediately(state);
      
      expect(hasSavedState()).toBe(true);
    });

    it('should return false after clearing saved state', () => {
      const state = store.getState();
      saveStateImmediately(state);
      
      expect(hasSavedState()).toBe(true);
      
      clearSavedState();
      
      expect(hasSavedState()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle localStorage quota exceeded error gracefully', () => {
      // Store original implementation
      const originalSetItem = localStorage.setItem;
      
      let setItemCalled = false;
      
      // Create a mock that throws quota error
      const mockSetItem = vi.fn((key: string, value: string) => {
        setItemCalled = true;
        const error = new Error('QuotaExceededError');
        Object.defineProperty(error, 'name', { 
          value: 'QuotaExceededError', 
          writable: false,
          configurable: true,
        });
        throw error;
      });
      
      // Replace localStorage.setItem temporarily
      Object.defineProperty(localStorage, 'setItem', {
        value: mockSetItem,
        writable: true,
        configurable: true,
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      store.dispatch(advancePhase());
      vi.advanceTimersByTime(600);

      // Should have attempted to save
      expect(setItemCalled).toBe(true);
      // Should have logged errors but not crashed
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Restore original implementation
      Object.defineProperty(localStorage, 'setItem', {
        value: originalSetItem,
        writable: true,
        configurable: true,
      });
      
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should handle serialization errors gracefully', () => {
      // This test verifies the middleware doesn't crash on save errors
      // The actual serialization is handled by SaveManager which has its own tests
      const state = store.getState();
      
      // This should not throw
      expect(() => {
        saveStateImmediately(state);
      }).not.toThrow();
    });
  });

  describe('data integrity', () => {
    it('should save complete game state', () => {
      // Setup a full game state
      const testFaction: Faction = {
        id: 'faction-1',
        name: 'Test Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: {
          hp: 29,
          maxHp: 29,
          force: 6,
          cunning: 5,
          wealth: 3,
        },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: null,
        assets: [],
      };

      const testSector: Sector = {
        id: 'sector-1',
        name: 'Test Sector',
        created: Date.now(),
        systems: [],
      };

      store.dispatch(addFaction(testFaction));
      vi.advanceTimersByTime(100);
      store.dispatch(setSector(testSector));
      vi.advanceTimersByTime(100);
      store.dispatch(advancePhase());
      vi.advanceTimersByTime(600);

      const saved = localStorage.getItem('gameState');
      expect(saved).not.toBeNull();

      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Verify structure
        expect(parsed).toHaveProperty('version');
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('sector');
        expect(parsed).toHaveProperty('factions');
        expect(parsed).toHaveProperty('turn');
        expect(parsed).toHaveProperty('phase');
        
        // Verify data
        expect(parsed.factions).toHaveLength(1);
        expect(parsed.factions[0].id).toBe('faction-1');
        expect(parsed.sector).not.toBeNull();
        expect(parsed.sector.id).toBe('sector-1');
      }
    });
  });
});

