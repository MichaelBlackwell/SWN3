import type { RootState } from '../store/store';
import type { Sector } from '../types/sector';
import type { Faction } from '../types/faction';
import type { TurnPhase } from '../store/slices/turnSlice';

/**
 * Save file schema version.
 * Increment this when making breaking changes to the save format.
 * This allows for future migrations of older save files.
 */
export const SAVE_VERSION = '1.0.0';

/**
 * Save file payload interface.
 * Defines the structure of saved game data.
 */
export interface SavePayload {
  version: string;
  timestamp: number;
  sector: Sector | null;
  factions: Faction[];
  turn?: number;
  phase?: TurnPhase;
}

/**
 * SaveManager service for serializing and deserializing game state.
 * 
 * Handles conversion between the Redux store state and a JSON save format
 * that can be stored in localStorage or exported as a file.
 */
export class SaveManager {
  private readonly version: string;

  /**
   * Creates a new SaveManager instance.
   * @param version - The save file format version (defaults to SAVE_VERSION)
   */
  constructor(version: string = SAVE_VERSION) {
    this.version = version;
  }

  /**
   * Serializes the current Redux store state into a JSON string.
   * 
   * Extracts the essential game data (sector, factions, turn) from the state
   * and creates a save payload with version metadata.
   * 
   * @param state - The complete Redux RootState
   * @returns JSON string representation of the save payload
   */
  serialize(state: RootState): string {
    const payload: SavePayload = {
      version: this.version,
      timestamp: Date.now(),
      sector: state.sector.currentSector,
      factions: state.factions.factions,
      turn: state.turn.turn,
      phase: state.turn.phase,
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Deserializes a JSON string back into a SavePayload object.
   * 
   * Parses the JSON and validates the structure. The returned payload
   * can be used to hydrate the Redux store.
   * 
   * @param jsonString - JSON string to parse
   * @returns SavePayload object with the saved game data
   * @throws Error if the JSON is invalid or the structure is unexpected
   */
  deserialize(jsonString: string): SavePayload {
    try {
      const payload = JSON.parse(jsonString) as SavePayload;

      // Validate required fields
      if (typeof payload.version !== 'string') {
        throw new Error('Invalid save file: missing or invalid version field');
      }

      if (typeof payload.timestamp !== 'number') {
        throw new Error('Invalid save file: missing or invalid timestamp field');
      }

      // Sector can be null
      if (payload.sector !== null && typeof payload.sector !== 'object') {
        throw new Error('Invalid save file: invalid sector field');
      }

      if (!Array.isArray(payload.factions)) {
        throw new Error('Invalid save file: missing or invalid factions array');
      }

      return payload;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid save file: JSON parse error - ${error.message}`);
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Invalid save file: unknown error during deserialization');
    }
  }

  /**
   * Gets the current save version.
   * @returns The version string
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Imports a save file from a File object.
   * 
   * Reads the file using FileReader, deserializes the JSON, and validates
   * the save format. Returns a Promise that resolves with the SavePayload
   * if successful, or rejects with an error if the file is invalid.
   * 
   * @param file - The File object to import
   * @returns Promise that resolves with the SavePayload
   * @throws Error if the file cannot be read, JSON is invalid, or version is incompatible
   */
  async importSave(file: File): Promise<SavePayload> {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (file.type && file.type !== 'application/json' && !file.name.endsWith('.json')) {
        reject(new Error('Invalid file type: expected JSON file'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const result = event.target?.result;
          if (typeof result !== 'string') {
            reject(new Error('Failed to read file: unexpected result type'));
            return;
          }

          // Deserialize and validate the JSON
          const payload = this.deserialize(result);

          // Validate version compatibility
          // For now, we only support the current version
          // Future versions can implement migration logic here
          if (payload.version !== this.version) {
            reject(
              new Error(
                `Incompatible save version: file version ${payload.version} is not compatible with current version ${this.version}`
              )
            );
            return;
          }

          resolve(payload);
        } catch (error) {
          if (error instanceof Error) {
            reject(new Error(`Failed to import save file: ${error.message}`));
          } else {
            reject(new Error('Failed to import save file: unknown error'));
          }
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file: file read error'));
      };

      reader.onabort = () => {
        reject(new Error('Failed to read file: file read was aborted'));
      };

      // Read the file as text
      reader.readAsText(file);
    });
  }

  /**
   * Exports the current game state as a downloadable JSON file.
   * 
   * Creates a Blob from the serialized state, creates a temporary anchor element,
   * and programmatically triggers a download. The filename includes the current
   * date and time for easy identification.
   * 
   * @param state - The complete Redux RootState to export
   * @throws Error if the state cannot be serialized or the download fails
   */
  exportSave(state: RootState): void {
    try {
      // Serialize the state to JSON
      const jsonString = this.serialize(state);
      
      // Create a Blob with the JSON data
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Generate filename with current date and time
      // Format: swn-save-YYYY-MM-DD-HH-MM-SS.json
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      const filename = `swn-save-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.json`;
      
      // Create a temporary URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary anchor element
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      
      // Append to document, click, and remove
      document.body.appendChild(anchor);
      anchor.click();
      
      // Clean up: remove anchor and revoke blob URL
      document.body.removeChild(anchor);
      
      // Use setTimeout to ensure the download starts before revoking the URL
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to export save file: ${error.message}`);
      }
      throw new Error('Failed to export save file: unknown error');
    }
  }
}

// Export a singleton instance for convenience
export const saveManager = new SaveManager();

