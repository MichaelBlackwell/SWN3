import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store/store';
import { setGameMode, setScenario } from '../../store/slices/gameModeSlice';
import { getAllScenarios } from '../../services/scenarioGenerator';
import { saveManager } from '../../services/saveManager';
import { hydrateStateFromSave } from '../../utils/hydrateState';
import { showNotification } from '../NotificationContainer';
import { useSoundEffect } from '../../hooks/useAudio';
import './MainMenu.css';

export default function MainMenu() {
  const dispatch = useDispatch<AppDispatch>();
  const [showScenarioSelect, setShowScenarioSelect] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playSound = useSoundEffect();
  
  const scenarios = getAllScenarios();

  const handleEditorMode = () => {
    playSound('ui_click');
    dispatch(setGameMode('editor'));
  };

  const handleScenarioSelect = (scenarioName: string) => {
    playSound('ui_click');
    const scenario = scenarios.find(s => s.name === scenarioName);
    if (scenario) {
      dispatch(setScenario(scenario));
      dispatch(setGameMode('scenario'));
    }
  };

  const handleLoadGame = () => {
    playSound('ui_click');
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

      // Set to editor mode after loading
      dispatch(setGameMode('editor'));
      
      showNotification('Game loaded successfully', 'success');
    } catch (error) {
      let errorMessage = 'Failed to load game file';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('Invalid file type')) {
          errorMessage = 'Invalid file type. Please select a JSON file.';
        } else if (error.message.includes('Invalid save file')) {
          errorMessage = 'Corrupt save file. The file structure is invalid.';
        } else if (error.message.includes('Incompatible save version')) {
          errorMessage = 'Incompatible save version. This save file was created with a different version of the game.';
        }
      }

      showNotification(errorMessage, 'error', 7000);
    }
  };

  if (showScenarioSelect) {
    return (
      <div className="main-menu">
        <div className="main-menu__container">
          <h1 className="main-menu__title">Select Scenario</h1>
          <div className="main-menu__scenario-grid">
            {scenarios.map((scenario) => (
              <button
                key={scenario.name}
                className={`main-menu__scenario-card main-menu__scenario-card--${scenario.difficulty}`}
                onClick={() => handleScenarioSelect(scenario.name)}
              >
                <h3 className="main-menu__scenario-name">{scenario.name}</h3>
                <p className="main-menu__scenario-description">{scenario.description}</p>
                <div className="main-menu__scenario-details">
                  <span className="main-menu__scenario-badge">
                    {scenario.difficulty.toUpperCase()}
                  </span>
                  <span className="main-menu__scenario-info">
                    {scenario.systemCount.min}-{scenario.systemCount.max} Systems
                  </span>
                  <span className="main-menu__scenario-info">
                    {scenario.factionCount} Factions
                  </span>
                </div>
                {scenario.specialRules && scenario.specialRules.length > 0 && (
                  <div className="main-menu__scenario-rules">
                    {scenario.specialRules.map((rule, index) => (
                      <span key={index} className="main-menu__scenario-rule">
                        • {rule}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
          <button
            className="main-menu__button main-menu__button--secondary"
            onClick={() => {
              playSound('ui_click');
              setShowScenarioSelect(false);
            }}
          >
            ← Back to Main Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-menu">
      <div className="main-menu__container">
        <div className="main-menu__header">
          <h1 className="main-menu__title">Stars Without Number</h1>
          <p className="main-menu__subtitle">Faction Turn Simulator</p>
        </div>
        
        <div className="main-menu__buttons">
          <button
            className="main-menu__button main-menu__button--primary"
            onClick={handleEditorMode}
          >
            <span className="main-menu__button-icon">✏️</span>
            <div className="main-menu__button-content">
              <span className="main-menu__button-title">Sandbox Editor</span>
              <span className="main-menu__button-description">
                Create and manage sectors and factions freely
              </span>
            </div>
          </button>

          <button
            className="main-menu__button main-menu__button--primary"
            onClick={() => {
              playSound('ui_click');
              setShowScenarioSelect(true);
            }}
          >
            <span className="main-menu__button-icon">🎲</span>
            <div className="main-menu__button-content">
              <span className="main-menu__button-title">Play Scenario</span>
              <span className="main-menu__button-description">
                Start with a pre-configured sector and objectives
              </span>
            </div>
          </button>

          <button
            className="main-menu__button main-menu__button--secondary"
            onClick={handleLoadGame}
          >
            <span className="main-menu__button-icon">📂</span>
            <div className="main-menu__button-content">
              <span className="main-menu__button-title">Load Game</span>
              <span className="main-menu__button-description">
                Continue from a saved game file
              </span>
            </div>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}

