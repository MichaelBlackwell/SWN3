// Unit tests for narrative slice

import { describe, it, expect, beforeEach } from 'vitest';
import narrativeReducer, {
  addLogEntry,
  clearLogs,
  removeLogEntry,
  selectAllLogs,
  selectLogsByType,
  selectLogsByEntity,
  selectRecentLogs,
  type NarrativeState,
  type NarrativeLogType,
} from './narrativeSlice';
import type { RootState } from '../store';

describe('narrativeSlice', () => {
  let initialState: NarrativeState;

  beforeEach(() => {
    initialState = {
      logs: [],
    };
  });

  describe('addLogEntry', () => {
    it('should add a log entry to the state', () => {
      const state = narrativeReducer(
        initialState,
        addLogEntry({
          text: 'Test log entry',
          type: 'general',
        })
      );

      expect(state.logs.length).toBe(1);
      expect(state.logs[0].text).toBe('Test log entry');
      expect(state.logs[0].type).toBe('general');
      expect(state.logs[0].id).toBeDefined();
      expect(state.logs[0].timestamp).toBeDefined();
    });

    it('should generate id and timestamp if not provided', () => {
      const state = narrativeReducer(
        initialState,
        addLogEntry({
          text: 'Test entry',
          type: 'combat',
        })
      );

      expect(state.logs[0].id).toBeDefined();
      expect(typeof state.logs[0].id).toBe('string');
      expect(state.logs[0].timestamp).toBeDefined();
      expect(typeof state.logs[0].timestamp).toBe('number');
    });

    it('should use provided id and timestamp if given', () => {
      const customId = 'custom-id-123';
      const customTimestamp = 1234567890;

      const state = narrativeReducer(
        initialState,
        addLogEntry({
          id: customId,
          timestamp: customTimestamp,
          text: 'Test entry',
          type: 'trade',
        })
      );

      expect(state.logs[0].id).toBe(customId);
      expect(state.logs[0].timestamp).toBe(customTimestamp);
    });

    it('should include relatedEntityIds if provided', () => {
      const relatedIds = ['faction-1', 'asset-1', 'system-1'];

      const state = narrativeReducer(
        initialState,
        addLogEntry({
          text: 'Test entry with entities',
          type: 'political',
          relatedEntityIds: relatedIds,
        })
      );

      expect(state.logs[0].relatedEntityIds).toEqual(relatedIds);
    });

    it('should prepend new entries to the start of the array', () => {
      let state = narrativeReducer(
        initialState,
        addLogEntry({
          text: 'First entry',
          type: 'general',
        })
      );

      state = narrativeReducer(
        state,
        addLogEntry({
          text: 'Second entry',
          type: 'general',
        })
      );

      state = narrativeReducer(
        state,
        addLogEntry({
          text: 'Third entry',
          type: 'general',
        })
      );

      expect(state.logs.length).toBe(3);
      // Newest entry should be first
      expect(state.logs[0].text).toBe('Third entry');
      expect(state.logs[1].text).toBe('Second entry');
      expect(state.logs[2].text).toBe('First entry');
    });

    it('should handle all log types correctly', () => {
      const types: NarrativeLogType[] = [
        'combat',
        'trade',
        'movement',
        'economic',
        'political',
        'espionage',
        'general',
        'system',
      ];

      let state = initialState;
      types.forEach((type) => {
        state = narrativeReducer(
          state,
          addLogEntry({
            text: `${type} entry`,
            type,
          })
        );
      });

      expect(state.logs.length).toBe(types.length);
      // Since we prepend entries, the order is reversed
      types.forEach((type, index) => {
        expect(state.logs[types.length - 1 - index].type).toBe(type);
      });
    });

    it('should maintain immutability', () => {
      const state1 = narrativeReducer(
        initialState,
        addLogEntry({
          text: 'First entry',
          type: 'general',
        })
      );

      const state2 = narrativeReducer(
        state1,
        addLogEntry({
          text: 'Second entry',
          type: 'general',
        })
      );

      // Original state should not be mutated
      expect(state1.logs.length).toBe(1);
      expect(state2.logs.length).toBe(2);
      expect(state1.logs).not.toBe(state2.logs);
    });
  });

  describe('clearLogs', () => {
    it('should remove all log entries', () => {
      let state = initialState;
      // Add some entries
      for (let i = 0; i < 5; i++) {
        state = narrativeReducer(
          state,
          addLogEntry({
            text: `Entry ${i}`,
            type: 'general',
          })
        );
      }

      expect(state.logs.length).toBe(5);

      state = narrativeReducer(state, clearLogs());

      expect(state.logs.length).toBe(0);
    });

    it('should work on empty state', () => {
      const state = narrativeReducer(initialState, clearLogs());

      expect(state.logs.length).toBe(0);
    });
  });

  describe('removeLogEntry', () => {
    it('should remove a specific log entry by id', () => {
      let state = initialState;

      // Add multiple entries
      state = narrativeReducer(
        state,
        addLogEntry({
          text: 'Entry 1',
          type: 'general',
        })
      );
      const entry2Id = state.logs[0].id;

      state = narrativeReducer(
        state,
        addLogEntry({
          text: 'Entry 2',
          type: 'general',
        })
      );
      const entry3Id = state.logs[0].id;

      state = narrativeReducer(
        state,
        addLogEntry({
          text: 'Entry 3',
          type: 'general',
        })
      );

      expect(state.logs.length).toBe(3);

      // Remove middle entry
      state = narrativeReducer(state, removeLogEntry(entry2Id));

      expect(state.logs.length).toBe(2);
      expect(state.logs.find((log) => log.id === entry2Id)).toBeUndefined();
      expect(state.logs.find((log) => log.id === entry3Id)).toBeDefined();
    });

    it('should do nothing if log entry id does not exist', () => {
      let state = narrativeReducer(
        initialState,
        addLogEntry({
          text: 'Entry 1',
          type: 'general',
        })
      );

      const initialLength = state.logs.length;

      state = narrativeReducer(state, removeLogEntry('non-existent-id'));

      expect(state.logs.length).toBe(initialLength);
    });
  });

  describe('selectors', () => {
    it('selectAllLogs should return all logs', () => {
      const mockState: RootState = {
        narrative: {
          logs: [
            {
              id: '1',
              timestamp: 1000,
              text: 'Entry 1',
              type: 'general',
            },
            {
              id: '2',
              timestamp: 2000,
              text: 'Entry 2',
              type: 'combat',
            },
          ],
        },
        sector: {
          systems: [],
          selectedSystemId: null,
        },
        factions: {
          factions: [],
          selectedFactionId: null,
          assetsFailedMaintenance: {},
        },
        turn: {
          turn: 1,
          phase: 'Income',
          actionStaged: false,
          actionCommitted: false,
          stagedActionType: null,
          history: [],
          historyIndex: -1,
          maxHistorySize: 50,
        },
      };

      const logs = selectAllLogs(mockState);

      expect(logs.length).toBe(2);
      expect(logs[0].id).toBe('1');
      expect(logs[1].id).toBe('2');
    });

    it('selectLogsByType should filter logs by type', () => {
      const mockState: RootState = {
        narrative: {
          logs: [
            {
              id: '1',
              timestamp: 1000,
              text: 'Combat entry',
              type: 'combat',
            },
            {
              id: '2',
              timestamp: 2000,
              text: 'Trade entry',
              type: 'trade',
            },
            {
              id: '3',
              timestamp: 3000,
              text: 'Another combat entry',
              type: 'combat',
            },
          ],
        },
        sector: {
          systems: [],
          selectedSystemId: null,
        },
        factions: {
          factions: [],
          selectedFactionId: null,
          assetsFailedMaintenance: {},
        },
        turn: {
          turn: 1,
          phase: 'Income',
          actionStaged: false,
          actionCommitted: false,
          stagedActionType: null,
          history: [],
          historyIndex: -1,
          maxHistorySize: 50,
        },
      };

      const combatLogs = selectLogsByType('combat')(mockState);

      expect(combatLogs.length).toBe(2);
      expect(combatLogs.every((log) => log.type === 'combat')).toBe(true);
    });

    it('selectLogsByEntity should filter logs by related entity id', () => {
      const mockState: RootState = {
        narrative: {
          logs: [
            {
              id: '1',
              timestamp: 1000,
              text: 'Entry with faction-1',
              type: 'general',
              relatedEntityIds: ['faction-1', 'asset-1'],
            },
            {
              id: '2',
              timestamp: 2000,
              text: 'Entry with faction-2',
              type: 'general',
              relatedEntityIds: ['faction-2'],
            },
            {
              id: '3',
              timestamp: 3000,
              text: 'Entry with faction-1',
              type: 'general',
              relatedEntityIds: ['faction-1'],
            },
          ],
        },
        sector: {
          systems: [],
          selectedSystemId: null,
        },
        factions: {
          factions: [],
          selectedFactionId: null,
          assetsFailedMaintenance: {},
        },
        turn: {
          turn: 1,
          phase: 'Income',
          actionStaged: false,
          actionCommitted: false,
          stagedActionType: null,
          history: [],
          historyIndex: -1,
          maxHistorySize: 50,
        },
      };

      const faction1Logs = selectLogsByEntity('faction-1')(mockState);

      expect(faction1Logs.length).toBe(2);
      expect(faction1Logs.every((log) => log.relatedEntityIds?.includes('faction-1'))).toBe(true);
    });

    it('selectRecentLogs should return the most recent N logs', () => {
      const mockState: RootState = {
        narrative: {
          logs: [
            // Logs are stored newest-first (prepended), so newest is first
            {
              id: '3',
              timestamp: 3000,
              text: 'Newest',
              type: 'general',
            },
            {
              id: '2',
              timestamp: 2000,
              text: 'Middle',
              type: 'general',
            },
            {
              id: '1',
              timestamp: 1000,
              text: 'Oldest',
              type: 'general',
            },
          ],
        },
        sector: {
          systems: [],
          selectedSystemId: null,
        },
        factions: {
          factions: [],
          selectedFactionId: null,
          assetsFailedMaintenance: {},
        },
        turn: {
          turn: 1,
          phase: 'Income',
          actionStaged: false,
          actionCommitted: false,
          stagedActionType: null,
          history: [],
          historyIndex: -1,
          maxHistorySize: 50,
        },
      };

      const recent2 = selectRecentLogs(2)(mockState);

      expect(recent2.length).toBe(2);
      // selectRecentLogs returns slice(0, count), so first 2 entries (which are already newest-first)
      expect(recent2[0].id).toBe('3'); // Newest first
      expect(recent2[1].id).toBe('2');
    });
  });
});

