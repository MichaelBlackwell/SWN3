// Unit tests for SaveManager service

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager, SAVE_VERSION, type SavePayload } from './saveManager';
import type { RootState } from '../store/store';
import type { Sector } from '../types/sector';
import type { Faction } from '../types/faction';

// Mock document for tests (needed for exportSave tests)
const mockDocument = {
  createElement: vi.fn(),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
};

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true,
  configurable: true,
});

describe('SaveManager', () => {
  let saveManager: SaveManager;
  let mockState: RootState;

  beforeEach(() => {
    saveManager = new SaveManager();
    
    // Create mock state
    const mockSector: Sector = {
      id: 'sector-1',
      name: 'Test Sector',
      created: Date.now(),
      systems: [],
    };

    const mockFaction: Faction = {
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
      tags: [],
      goal: null,
      assets: [],
    };

    mockState = {
      sector: {
        currentSector: mockSector,
        selectedSystemId: null,
      },
      factions: {
        factions: [mockFaction],
        selectedFactionId: null,
        assetsFailedMaintenance: {},
      },
      turn: {
        turn: 5,
        phase: 'Action',
        actionStaged: false,
        actionCommitted: false,
        stagedActionType: null,
        movementMode: {
          active: false,
          assetId: null,
          factionId: null,
        },
        stagedActionPayload: null,
        history: [],
        historyIndex: -1,
        maxHistorySize: 50,
      },
      narrative: {
        logs: [],
      },
    } as RootState;
  });

  describe('constructor', () => {
    it('should create SaveManager with default version', () => {
      const manager = new SaveManager();
      expect(manager.getVersion()).toBe(SAVE_VERSION);
    });

    it('should create SaveManager with custom version', () => {
      const customVersion = '2.0.0';
      const manager = new SaveManager(customVersion);
      expect(manager.getVersion()).toBe(customVersion);
    });
  });

  describe('serialize', () => {
    it('should serialize state to JSON string with correct structure', () => {
      const jsonString = saveManager.serialize(mockState);
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(payload).toHaveProperty('version');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('sector');
      expect(payload).toHaveProperty('factions');
      expect(payload).toHaveProperty('turn');
      expect(payload).toHaveProperty('phase');
    });

    it('should include correct version in serialized output', () => {
      const jsonString = saveManager.serialize(mockState);
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(payload.version).toBe(SAVE_VERSION);
    });

    it('should include current timestamp in serialized output', () => {
      const beforeTime = Date.now();
      const jsonString = saveManager.serialize(mockState);
      const afterTime = Date.now();
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(payload.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(payload.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should serialize sector correctly', () => {
      const jsonString = saveManager.serialize(mockState);
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(payload.sector).not.toBeNull();
      expect(payload.sector?.id).toBe('sector-1');
      expect(payload.sector?.name).toBe('Test Sector');
    });

    it('should serialize null sector correctly', () => {
      mockState.sector.currentSector = null;
      const jsonString = saveManager.serialize(mockState);
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(payload.sector).toBeNull();
    });

    it('should serialize factions array correctly', () => {
      const jsonString = saveManager.serialize(mockState);
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(Array.isArray(payload.factions)).toBe(true);
      expect(payload.factions.length).toBe(1);
      expect(payload.factions[0].id).toBe('faction-1');
      expect(payload.factions[0].name).toBe('Test Faction');
    });

    it('should serialize empty factions array correctly', () => {
      mockState.factions.factions = [];
      const jsonString = saveManager.serialize(mockState);
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(Array.isArray(payload.factions)).toBe(true);
      expect(payload.factions.length).toBe(0);
    });

    it('should serialize turn number correctly', () => {
      const jsonString = saveManager.serialize(mockState);
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(payload.turn).toBe(5);
    });

    it('should serialize phase correctly', () => {
      const jsonString = saveManager.serialize(mockState);
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(payload.phase).toBe('Action');
    });

    it('should produce valid JSON string', () => {
      const jsonString = saveManager.serialize(mockState);
      
      expect(() => JSON.parse(jsonString)).not.toThrow();
      expect(typeof jsonString).toBe('string');
    });

    it('should format JSON with indentation', () => {
      const jsonString = saveManager.serialize(mockState);
      
      // Formatted JSON should have newlines
      expect(jsonString).toContain('\n');
      // Should have proper indentation
      expect(jsonString).toContain('  "version"');
    });

    it('should handle complex faction data with assets', () => {
      mockState.factions.factions[0].assets = [
        {
          id: 'asset-1',
          definitionId: 'force_1_security_personnel',
          location: 'system-1',
          hp: 3,
          maxHp: 3,
          stealthed: false,
        },
      ];

      const jsonString = saveManager.serialize(mockState);
      const payload = JSON.parse(jsonString) as SavePayload;

      expect(payload.factions[0].assets.length).toBe(1);
      expect(payload.factions[0].assets[0].id).toBe('asset-1');
      expect(payload.factions[0].assets[0].hp).toBe(3);
    });
  });

  describe('deserialize', () => {
    let validJsonString: string;

    beforeEach(() => {
      validJsonString = saveManager.serialize(mockState);
    });

    it('should deserialize valid JSON string correctly', () => {
      const payload = saveManager.deserialize(validJsonString);

      expect(payload.version).toBe(SAVE_VERSION);
      expect(payload.sector).not.toBeNull();
      expect(Array.isArray(payload.factions)).toBe(true);
      expect(payload.factions.length).toBe(1);
    });

    it('should return payload with correct structure', () => {
      const payload = saveManager.deserialize(validJsonString);

      expect(payload).toHaveProperty('version');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('sector');
      expect(payload).toHaveProperty('factions');
    });

    it('should validate version field', () => {
      const invalidJson = JSON.stringify({
        timestamp: Date.now(),
        sector: null,
        factions: [],
      });

      expect(() => saveManager.deserialize(invalidJson)).toThrow('missing or invalid version field');
    });

    it('should validate timestamp field', () => {
      const invalidJson = JSON.stringify({
        version: SAVE_VERSION,
        sector: null,
        factions: [],
      });

      expect(() => saveManager.deserialize(invalidJson)).toThrow('missing or invalid timestamp field');
    });

    it('should validate sector field (can be null)', () => {
      const validJson = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: null,
        factions: [],
      });

      const payload = saveManager.deserialize(validJson);
      expect(payload.sector).toBeNull();
    });

    it('should reject invalid sector field type', () => {
      const invalidJson = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: 'not an object',
        factions: [],
      });

      expect(() => saveManager.deserialize(invalidJson)).toThrow('invalid sector field');
    });

    it('should validate factions field as array', () => {
      const invalidJson = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: null,
        factions: 'not an array',
      });

      expect(() => saveManager.deserialize(invalidJson)).toThrow('missing or invalid factions array');
    });

    it('should accept missing factions field as invalid', () => {
      const invalidJson = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: null,
      });

      expect(() => saveManager.deserialize(invalidJson)).toThrow('missing or invalid factions array');
    });

    it('should throw error for invalid JSON syntax', () => {
      const invalidJson = '{ invalid json }';

      expect(() => saveManager.deserialize(invalidJson)).toThrow('JSON parse error');
    });

    it('should throw error for empty string', () => {
      expect(() => saveManager.deserialize('')).toThrow('JSON parse error');
    });

    it('should throw error for non-JSON string', () => {
      expect(() => saveManager.deserialize('not json at all')).toThrow('JSON parse error');
    });

    it('should preserve all faction data after round-trip', () => {
      // Create complex faction data
      mockState.factions.factions[0].assets = [
        {
          id: 'asset-1',
          definitionId: 'force_1_security_personnel',
          location: 'system-1',
          hp: 2,
          maxHp: 3,
          stealthed: true,
          purchasedTurn: 3,
        },
      ];
      mockState.factions.factions[0].goal = {
        type: 'Military Conquest',
        requirements: {},
        progress: {},
      };

      const jsonString = saveManager.serialize(mockState);
      const payload = saveManager.deserialize(jsonString);

      expect(payload.factions[0].assets.length).toBe(1);
      expect(payload.factions[0].assets[0].id).toBe('asset-1');
      expect(payload.factions[0].assets[0].hp).toBe(2);
      expect(payload.factions[0].assets[0].stealthed).toBe(true);
      expect(payload.factions[0].goal?.type).toBe('Military Conquest');
    });

    it('should preserve sector data after round-trip', () => {
      const jsonString = saveManager.serialize(mockState);
      const payload = saveManager.deserialize(jsonString);

      expect(payload.sector?.id).toBe('sector-1');
      expect(payload.sector?.name).toBe('Test Sector');
    });

    it('should handle optional turn and phase fields gracefully', () => {
      const minimalJson = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: null,
        factions: [],
      });

      const payload = saveManager.deserialize(minimalJson);
      
      // Optional fields may be undefined, which is fine
      expect(payload.version).toBe(SAVE_VERSION);
      expect(payload.factions).toEqual([]);
    });
  });

  describe('getVersion', () => {
    it('should return the configured version', () => {
      expect(saveManager.getVersion()).toBe(SAVE_VERSION);
    });

    it('should return custom version when set', () => {
      const customVersion = '3.0.0';
      const manager = new SaveManager(customVersion);
      expect(manager.getVersion()).toBe(customVersion);
    });
  });

  describe('round-trip integrity', () => {
    it('should maintain data integrity through serialize/deserialize cycle', () => {
      const originalJson = saveManager.serialize(mockState);
      const payload = saveManager.deserialize(originalJson);
      
      // Reserialize the deserialized payload
      const mockStateFromPayload: RootState = {
        ...mockState,
        sector: {
          ...mockState.sector,
          currentSector: payload.sector,
        },
        factions: {
          ...mockState.factions,
          factions: payload.factions,
        },
        turn: {
          ...mockState.turn,
          turn: payload.turn ?? mockState.turn.turn,
          phase: payload.phase ?? mockState.turn.phase,
        },
      } as RootState;

      const reSerializedJson = saveManager.serialize(mockStateFromPayload);
      const reDeserializedPayload = saveManager.deserialize(reSerializedJson);

      // Compare key fields
      expect(reDeserializedPayload.version).toBe(payload.version);
      expect(reDeserializedPayload.sector?.id).toBe(payload.sector?.id);
      expect(reDeserializedPayload.factions.length).toBe(payload.factions.length);
      expect(reDeserializedPayload.factions[0].id).toBe(payload.factions[0].id);
    });

    it('should handle multiple factions correctly', () => {
      const secondFaction: Faction = {
        id: 'faction-2',
        name: 'Second Faction',
        type: 'Corporation',
        homeworld: 'system-2',
        attributes: {
          hp: 20,
          maxHp: 20,
          force: 3,
          cunning: 7,
          wealth: 6,
        },
        facCreds: 15,
        tags: [],
        goal: null,
        assets: [],
      };

      mockState.factions.factions.push(secondFaction);

      const jsonString = saveManager.serialize(mockState);
      const payload = saveManager.deserialize(jsonString);

      expect(payload.factions.length).toBe(2);
      expect(payload.factions[0].id).toBe('faction-1');
      expect(payload.factions[1].id).toBe('faction-2');
    });
  });

  describe('exportSave', () => {
    let mockAnchor: HTMLAnchorElement;
    let mockClick: () => void;
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let appendChildSpy: ReturnType<typeof vi.spyOn>;
    let removeChildSpy: ReturnType<typeof vi.spyOn>;
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let blobSpy: ReturnType<typeof vi.spyOn> | undefined;
    let mockDocument: typeof document;

    beforeEach(() => {
      // Create a mock document object
      mockClick = vi.fn();
      mockAnchor = {
        href: '',
        download: '',
        style: { display: '' },
        click: mockClick,
      } as unknown as HTMLAnchorElement;

      mockDocument = {
        createElement: vi.fn((tagName: string) => {
          if (tagName === 'a') {
            return mockAnchor;
          }
          return {} as HTMLElement;
        }),
        body: {
          appendChild: vi.fn((node) => node),
          removeChild: vi.fn((node) => node),
        } as unknown as HTMLBodyElement,
      } as unknown as typeof document;

      // Mock global document
      global.document = mockDocument;

      // Create spies on the mock
      createElementSpy = vi.spyOn(mockDocument, 'createElement');
      appendChildSpy = vi.spyOn(mockDocument.body, 'appendChild');
      removeChildSpy = vi.spyOn(mockDocument.body, 'removeChild');

      // Mock URL.createObjectURL and revokeObjectURL
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
        // Mock implementation
      });

      // Don't mock Blob by default - use real implementation
      // Individual tests will mock it if needed

      // Mock setTimeout to immediately execute callbacks for testing
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
      // Clean up global document mock
      delete (global as any).document;
    });

    it('should create a blob with application/json type', () => {
      blobSpy = vi.spyOn(global, 'Blob');
      saveManager.exportSave(mockState);

      expect(blobSpy).toHaveBeenCalled();
      const blobCall = blobSpy.mock.calls[0];
      expect(blobCall[1]).toEqual({ type: 'application/json' });
    });

    it('should create a blob with serialized JSON data', () => {
      blobSpy = vi.spyOn(global, 'Blob');
      const expectedJson = saveManager.serialize(mockState);

      saveManager.exportSave(mockState);

      expect(blobSpy).toHaveBeenCalled();
      const blobCall = blobSpy.mock.calls[0];
      expect(blobCall[0][0]).toBe(expectedJson);
    });

    it('should create a temporary anchor element', () => {
      saveManager.exportSave(mockState);

      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('should set anchor href to blob URL', () => {
      saveManager.exportSave(mockState);

      expect(mockAnchor.href).toBe('blob:mock-url');
    });

    it('should set anchor download attribute with date/time filename', () => {
      const fixedDate = new Date('2024-01-15T14:30:45');
      vi.setSystemTime(fixedDate);

      saveManager.exportSave(mockState);

      // Format: swn-save-YYYY-MM-DD-HH-MM-SS.json
      expect(mockAnchor.download).toMatch(/^swn-save-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
      expect(mockAnchor.download).toBe('swn-save-2024-01-15-14-30-45.json');
    });

    it('should format filename with zero-padded values', () => {
      const fixedDate = new Date('2024-01-05T09:05:03');
      vi.setSystemTime(fixedDate);

      saveManager.exportSave(mockState);

      expect(mockAnchor.download).toBe('swn-save-2024-01-05-09-05-03.json');
    });

    it('should append anchor to document body', () => {
      saveManager.exportSave(mockState);

      expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
    });

    it('should programmatically click the anchor', () => {
      saveManager.exportSave(mockState);

      expect(mockClick).toHaveBeenCalled();
    });

    it('should remove anchor from document body after click', () => {
      saveManager.exportSave(mockState);

      expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    });

    it('should create object URL from blob', () => {
      saveManager.exportSave(mockState);

      expect(createObjectURLSpy).toHaveBeenCalled();
      // Verify it was called with a Blob instance
      const urlCall = createObjectURLSpy.mock.calls[0];
      expect(urlCall[0]).toBeInstanceOf(Blob);
    });

    it('should revoke object URL after download', () => {
      saveManager.exportSave(mockState);

      // Advance timers to trigger setTimeout
      vi.advanceTimersByTime(100);

      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should handle errors during serialization', () => {
      // Create a state that might cause serialization issues
      const invalidState = {
        ...mockState,
        sector: {
          ...mockState.sector,
          currentSector: {
            ...mockState.sector.currentSector!,
            // Add a circular reference by making systems reference itself
            systems: [] as any,
          },
        },
      };
      
      // Actually, our current implementation shouldn't have circular refs
      // But let's test error handling by mocking serialize to throw
      const serializeSpy = vi.spyOn(saveManager, 'serialize');
      serializeSpy.mockImplementation(() => {
        throw new Error('Serialization failed');
      });

      expect(() => {
        saveManager.exportSave(mockState);
      }).toThrow('Failed to export save file: Serialization failed');
    });

    it('should handle errors during blob creation', () => {
      const blobSpy = vi.spyOn(global, 'Blob').mockImplementation(function () {
        throw new Error('Blob creation failed');
      } as typeof Blob);

      expect(() => {
        saveManager.exportSave(mockState);
      }).toThrow('Failed to export save file: Blob creation failed');
      
      blobSpy.mockRestore();
    });

    it('should handle errors during URL creation', () => {
      vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
        throw new Error('URL creation failed');
      });

      expect(() => {
        saveManager.exportSave(mockState);
      }).toThrow('Failed to export save file: URL creation failed');
    });

    it('should generate unique filenames for different timestamps', () => {
      const date1 = new Date('2024-01-15T14:30:45');
      vi.setSystemTime(date1);
      saveManager.exportSave(mockState);
      const filename1 = mockAnchor.download;

      // Advance time by 1 second
      const date2 = new Date('2024-01-15T14:30:46');
      vi.setSystemTime(date2);
      saveManager.exportSave(mockState);
      const filename2 = mockAnchor.download;

      expect(filename1).not.toBe(filename2);
      expect(filename1).toBe('swn-save-2024-01-15-14-30-45.json');
      expect(filename2).toBe('swn-save-2024-01-15-14-30-46.json');
    });

    it('should include .json extension in filename', () => {
      saveManager.exportSave(mockState);

      expect(mockAnchor.download).toMatch(/\.json$/);
    });

    it('should export state with all required fields', () => {
      // Instead of mocking Blob, we'll capture the serialized data by spying on serialize
      const serializeSpy = vi.spyOn(saveManager, 'serialize');
      serializeSpy.mockRestore(); // Use real implementation
      
      saveManager.exportSave(mockState);
      
      // Get the actual serialized JSON that was passed to Blob
      const serializeResult = saveManager.serialize(mockState);
      const parsed = JSON.parse(serializeResult);
      
      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('sector');
      expect(parsed).toHaveProperty('factions');
      expect(parsed).toHaveProperty('turn');
      expect(parsed).toHaveProperty('phase');
    });
  });

  describe('importSave', () => {
    let mockFile: File;
    let fileReaderInstances: Array<{
      result: string | null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null;
      onerror: (() => void) | null;
      onabort: (() => void) | null;
      readAsText: (file: File) => void;
      abort: () => void;
    }>;

    beforeEach(() => {
      vi.useFakeTimers();
      // Create a mock File object
      const validSavePayload = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: mockState.sector.currentSector,
        factions: mockState.factions.factions,
        turn: mockState.turn.turn,
        phase: mockState.turn.phase,
      });
      const blob = new Blob([validSavePayload], { type: 'application/json' });
      mockFile = new File([blob], 'test-save.json', { type: 'application/json' });

      // Track all FileReader instances created
      fileReaderInstances = [];

      // Ensure FileReader exists in global scope
      if (!global.FileReader) {
        (global as any).FileReader = class MockFileReader {};
      }
    });

    // Helper function to create a FileReader mock with customizable behavior
    function setupFileReaderMock(
      readBehavior: (instance: typeof fileReaderInstances[0]) => void
    ) {
      // Create a class constructor for FileReader
      class MockFileReader {
        result: string | null = null;
        onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
        onerror: (() => void) | null = null;
        onabort: (() => void) | null = null;
        readAsText = vi.fn((file: File) => {
          // Execute the read behavior when readAsText is called
          readBehavior(this as unknown as typeof fileReaderInstances[0]);
        });
        abort = vi.fn();
      }

      vi.spyOn(global, 'FileReader').mockImplementation(function (this: FileReader) {
        const instance = new MockFileReader() as unknown as typeof fileReaderInstances[0];
        fileReaderInstances.push(instance);
        return instance as unknown as FileReader;
      } as typeof FileReader);
    }

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('should read and parse a valid save file', async () => {
      const validSavePayload = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: mockState.sector.currentSector,
        factions: mockState.factions.factions,
        turn: mockState.turn.turn,
        phase: mockState.turn.phase,
      });

      setupFileReaderMock((instance) => {
        setTimeout(() => {
          instance.result = validSavePayload;
          if (instance.onload) {
            const event = {
              target: instance,
            } as ProgressEvent<FileReader>;
            instance.onload(event);
          }
        }, 0);
      });

      const promise = saveManager.importSave(mockFile);
      await vi.runAllTimersAsync();
      const payload = await promise;

      expect(payload).toHaveProperty('version');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('sector');
      expect(payload).toHaveProperty('factions');
      expect(payload.version).toBe(SAVE_VERSION);
      expect(Array.isArray(payload.factions)).toBe(true);
    });

    it('should validate file type for JSON files', async () => {
      const nonJsonFile = new File(['not json'], 'test.txt', { type: 'text/plain' });

      await expect(saveManager.importSave(nonJsonFile)).rejects.toThrow('Invalid file type');
    });

    it('should accept files with .json extension even without MIME type', async () => {
      const jsonFileNoMime = new File(['{}'], 'test.json', { type: '' });
      const validPayload = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: null,
        factions: [],
      });

      setupFileReaderMock((instance) => {
        setTimeout(() => {
          instance.result = validPayload;
          if (instance.onload) {
            const event = {
              target: instance,
            } as ProgressEvent<FileReader>;
            instance.onload(event);
          }
        }, 0);
      });

      const promise = saveManager.importSave(jsonFileNoMime);
      await vi.runAllTimersAsync();
      const payload = await promise;
      expect(payload).toHaveProperty('version');
    });

    it('should reject files with incompatible version', async () => {
      const incompatiblePayload = JSON.stringify({
        version: '2.0.0', // Different version
        timestamp: Date.now(),
        sector: null,
        factions: [],
      });

      setupFileReaderMock((instance) => {
        setTimeout(() => {
          instance.result = incompatiblePayload;
          if (instance.onload) {
            const event = {
              target: instance,
            } as ProgressEvent<FileReader>;
            instance.onload(event);
          }
        }, 0);
      });

      const promise = saveManager.importSave(mockFile);
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('Incompatible save version');
    });

    it('should reject files with invalid JSON', async () => {
      setupFileReaderMock((instance) => {
        setTimeout(() => {
          instance.result = 'invalid json {';
          if (instance.onload) {
            const event = {
              target: instance,
            } as ProgressEvent<FileReader>;
            instance.onload(event);
          }
        }, 0);
      });

      const promise = saveManager.importSave(mockFile);
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('JSON parse error');
    });

    it('should reject files missing required fields', async () => {
      const invalidPayload = JSON.stringify({
        // Missing version, timestamp, factions
        sector: null,
      });

      setupFileReaderMock((instance) => {
        setTimeout(() => {
          instance.result = invalidPayload;
          if (instance.onload) {
            const event = {
              target: instance,
            } as ProgressEvent<FileReader>;
            instance.onload(event);
          }
        }, 0);
      });

      const promise = saveManager.importSave(mockFile);
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('missing or invalid version field');
    });

    it('should handle FileReader errors', async () => {
      setupFileReaderMock((instance) => {
        setTimeout(() => {
          if (instance.onerror) {
            instance.onerror();
          }
        }, 0);
      });

      const promise = saveManager.importSave(mockFile);
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('file read error');
    });

    it('should handle FileReader abort', async () => {
      setupFileReaderMock((instance) => {
        setTimeout(() => {
          if (instance.onabort) {
            instance.onabort();
          }
        }, 0);
      });

      const promise = saveManager.importSave(mockFile);
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('file read was aborted');
    });

    it('should handle files with null sector', async () => {
      const nullSectorPayload = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: null,
        factions: [],
      });

      setupFileReaderMock((instance) => {
        setTimeout(() => {
          instance.result = nullSectorPayload;
          if (instance.onload) {
            const event = {
              target: instance,
            } as ProgressEvent<FileReader>;
            instance.onload(event);
          }
        }, 0);
      });

      const promise = saveManager.importSave(mockFile);
      await vi.runAllTimersAsync();
      const payload = await promise;
      expect(payload.sector).toBeNull();
    });

    it('should preserve complete game state after import', async () => {
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
        tags: [],
        goal: null,
        assets: [
          {
            id: 'asset-1',
            definitionId: 'force_1_security_personnel',
            location: 'system-1',
            hp: 3,
            maxHp: 3,
            stealthed: false,
          },
        ],
      };

      const completePayload = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: mockState.sector.currentSector,
        factions: [testFaction],
        turn: 5,
        phase: 'Action',
      });

      setupFileReaderMock((instance) => {
        setTimeout(() => {
          instance.result = completePayload;
          if (instance.onload) {
            const event = {
              target: instance,
            } as ProgressEvent<FileReader>;
            instance.onload(event);
          }
        }, 0);
      });

      const promise = saveManager.importSave(mockFile);
      await vi.runAllTimersAsync();
      const payload = await promise;
      expect(payload.factions).toHaveLength(1);
      expect(payload.factions[0].id).toBe('faction-1');
      expect(payload.factions[0].assets).toHaveLength(1);
      expect(payload.factions[0].assets[0].id).toBe('asset-1');
      expect(payload.turn).toBe(5);
      expect(payload.phase).toBe('Action');
    });

    it('should use FileReader to read file as text', async () => {
      const validPayload = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sector: null,
        factions: [],
      });

      setupFileReaderMock((instance) => {
        setTimeout(() => {
          instance.result = validPayload;
          if (instance.onload) {
            const event = {
              target: instance,
            } as ProgressEvent<FileReader>;
            instance.onload(event);
          }
        }, 0);
      });

      const promise = saveManager.importSave(mockFile);
      await vi.runAllTimersAsync();
      await promise;

      // Verify FileReader was used and readAsText was called
      expect(fileReaderInstances.length).toBeGreaterThan(0);
      if (fileReaderInstances.length > 0) {
        expect(fileReaderInstances[0].readAsText).toHaveBeenCalledWith(mockFile);
      }
    });
  });
});

