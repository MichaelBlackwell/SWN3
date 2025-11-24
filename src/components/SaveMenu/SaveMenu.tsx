import { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { saveManager } from '../../services/saveManager';
import { hydrateStateFromSave } from '../../utils/hydrateState';
import { showNotification } from '../NotificationContainer';
import './SaveMenu.css';

export default function SaveMenu() {
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector((state: RootState) => state);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      saveManager.exportSave(state);
      showNotification('Game state exported successfully', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export save file';
      showNotification(`Export failed: ${message}`, 'error', 5000);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      // Import and validate the save file
      const payload = await saveManager.importSave(file);

      // Hydrate the Redux store with the loaded state
      hydrateStateFromSave(dispatch, payload);

      showNotification('Game state imported successfully', 'success');
    } catch (error) {
      let errorMessage = 'Failed to import save file';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for specific error types to provide better user feedback
        if (error.message.includes('Invalid file type')) {
          errorMessage = 'Invalid file type. Please select a JSON file.';
        } else if (error.message.includes('Invalid save file')) {
          errorMessage = 'Corrupt save file. The file structure is invalid.';
        } else if (error.message.includes('Incompatible save version')) {
          errorMessage = 'Incompatible save version. This save file was created with a different version of the game.';
        } else if (error.message.includes('JSON parse error')) {
          errorMessage = 'Corrupt save file. The file contains invalid JSON.';
        } else if (error.message.includes('Failed to read file')) {
          errorMessage = 'Failed to read file. Please ensure the file is not corrupted and try again.';
        }
      }

      showNotification(errorMessage, 'error', 7000);
    }
  };

  return (
    <div className="save-menu">
      <button
        onClick={handleExport}
        className="btn btn-primary"
        title="Export current game state to a JSON file"
      >
        Export Data
      </button>
      <button
        onClick={handleImportClick}
        className="btn btn-secondary"
        title="Import a previously saved game state from a JSON file"
      >
        Import Data
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

