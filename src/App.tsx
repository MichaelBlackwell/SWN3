import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from './store/store';
import MainLayout from './components/MainLayout';
import MainMenu from './components/MainMenu/MainMenu';
import SectorMap from './components/SectorMap/SectorMap';
import FactionManager from './components/FactionManager/FactionManager';
import TurnManager from './components/TurnManager/TurnManager';
import NewsFeed from './components/NewsFeed/NewsFeed';
import NotificationContainer from './components/NotificationContainer';
import TutorialManager from './components/Tutorial/TutorialManager';
import SystemOptionsMenu from './components/SystemOptionsMenu/SystemOptionsMenu';
import { AudioSettingsButton } from './components/AudioSettings';
import { generateSector } from './services/sectorGenerator';
import { generateSectorWithConfig } from './services/sectorGeneratorWithConfig';
import { createFactionGoal } from './services/GoalRegistry';
import { setSector } from './store/slices/sectorSlice';
import { clearAllFactions, addFaction, selectFaction } from './store/slices/factionsSlice';
import { resetTurnState } from './store/slices/turnSlice';
import { returnToMenu, setPlayerFaction } from './store/slices/gameModeSlice';
import { startTutorialModule } from './store/slices/tutorialSlice';
import FactionSelectionModal from './components/FactionSelectionModal/FactionSelectionModal';
import { Encyclopedia } from './components/Encyclopedia';
import VictoryModal from './components/VictoryModal';
import { generateRandomFactionForSystem } from './services/factionGenerator';
import { useGameMusic, useAudio } from './hooks/useAudio';
import { resetGameState } from './store/slices/gameStateSlice';
import './App.css';
import './styles/layout.css';
import './components/AppHeader.css';
import './components/SectorMapView.css';

type ViewMode = 'sector' | 'factions' | 'news' | 'encyclopedia';

function App() {
  const dispatch = useDispatch();
  const gameMode = useSelector((state: RootState) => state.gameMode.mode);
  const currentScenario = useSelector((state: RootState) => state.gameMode.currentScenario);
  const playerFactionId = useSelector((state: RootState) => state.gameMode.playerFactionId);
  const sector = useSelector((state: RootState) => state.sector);
  const factions = useSelector((state: RootState) => state.factions.factions);
  const turnNumber = useSelector((state: RootState) => state.turn.turn);
  const [viewMode, setViewMode] = useState<ViewMode>('sector');
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showFactionSelection, setShowFactionSelection] = useState(false);

  const renderViewToggle = () => (
    <nav className="app-view-toggle" aria-label="Primary workspace view">
      <button
        type="button"
        onClick={() => setViewMode('sector')}
        className={`app-view-toggle__button ${viewMode === 'sector' ? 'app-view-toggle__button--active' : ''}`}
        aria-label="Switch to Sector Map view"
        aria-pressed={viewMode === 'sector'}
      >
        Sector Map
      </button>
      <button
        type="button"
        onClick={() => setViewMode('factions')}
        className={`app-view-toggle__button ${viewMode === 'factions' ? 'app-view-toggle__button--active' : ''}`}
        aria-label="Switch to Factions view"
        aria-pressed={viewMode === 'factions'}
      >
        Factions
      </button>
      <button
        type="button"
        onClick={() => setViewMode('news')}
        className={`app-view-toggle__button ${viewMode === 'news' ? 'app-view-toggle__button--active' : ''}`}
        aria-label="Switch to News Feed view"
        aria-pressed={viewMode === 'news'}
      >
        News
      </button>
      <button
        type="button"
        onClick={() => setViewMode('encyclopedia')}
        className={`app-view-toggle__button ${viewMode === 'encyclopedia' ? 'app-view-toggle__button--active' : ''}`}
        aria-label="Switch to Encyclopedia view"
        aria-pressed={viewMode === 'encyclopedia'}
      >
        Codex
      </button>
    </nav>
  );

  // Initialize game music system (auto-plays based on game mode/scenario)
  useGameMusic();
  const { unlockAudio } = useAudio();

  // Unlock audio on first user interaction (browser autoplay policy)
  const handleFirstInteraction = useCallback(() => {
    if (!audioUnlocked) {
      unlockAudio();
      setAudioUnlocked(true);
    }
  }, [audioUnlocked, unlockAudio]);

  // Set up first interaction listener
  useEffect(() => {
    if (audioUnlocked) return;
    
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleFirstInteraction, { once: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleFirstInteraction);
      });
    };
  }, [audioUnlocked, handleFirstInteraction]);

  // Check if we should show menu on initial load
  useEffect(() => {
    // If gameMode is menu but there's a sector loaded (from localStorage),
    // we're in an inconsistent state. Stay at menu.
    // If gameMode is editor/scenario but no sector, go to menu.
    if (gameMode !== 'menu' && (!sector.currentSector || !sector.currentSector.id)) {
      dispatch(returnToMenu());
    }
  }, []); // Only run on mount

  // Initialize scenario when entering scenario mode
  useEffect(() => {
    if (gameMode === 'scenario' && currentScenario && !playerFactionId) {
      // Clear existing data
      dispatch(clearAllFactions());
      dispatch(resetTurnState());
      dispatch(resetGameState());
      
      // Generate new sector and factions with scenario config
      const { sector: newSector, factions: newFactions } = generateSectorWithConfig(currentScenario);
      dispatch(setSector(newSector));
      
      // Add all generated factions
      newFactions.forEach(faction => {
        dispatch(addFaction(faction));
      });
      
      // Show faction selection modal after factions are generated
      setShowFactionSelection(true);
    }
  }, [gameMode, currentScenario, playerFactionId, dispatch]);

  // Handle faction selection in scenario mode
  const handleFactionSelection = (factionId: string) => {
    dispatch(setPlayerFaction(factionId));
    dispatch(selectFaction(factionId));
    setShowFactionSelection(false);
  };

  const handleGenerateSector = () => {
    // Clear all factions when generating a new sector
    dispatch(clearAllFactions());
    const newSector = generateSector();
    dispatch(setSector(newSector));
    
    // Reset turn state and game state
    dispatch(resetTurnState());
    dispatch(resetGameState());
    
    // Create 2 test factions using template-based generation
    if (newSector.systems.length > 0) {
      const firstSystem = newSector.systems[0];
      
      // Ensure homeworld is TL4 - factions need advanced tech to operate
      if (firstSystem.primaryWorld.techLevel < 4) {
        firstSystem.primaryWorld.techLevel = 4;
      }
      
      // Generate first faction based on homeworld characteristics
      const faction1 = generateRandomFactionForSystem(firstSystem);
      faction1.name = 'Test Faction Alpha';
      faction1.goal = createFactionGoal('Expand Influence', faction1);
      
      // Generate second faction on same system (if there are multiple systems, use second one)
      const secondSystem = newSector.systems.length > 1 ? newSector.systems[1] : firstSystem;
      
      // Ensure second homeworld is also TL4
      if (secondSystem.primaryWorld.techLevel < 4) {
        secondSystem.primaryWorld.techLevel = 4;
      }
      
      const faction2 = generateRandomFactionForSystem(secondSystem);
      faction2.name = 'Test Faction Beta';
      faction2.goal = createFactionGoal('Commercial Expansion', faction2);
      
      dispatch(addFaction(faction1));
      dispatch(addFaction(faction2));
    }
  };

  const handleReturnToMenu = () => {
    dispatch(returnToMenu());
  };

  // Show main menu if in menu mode
  if (gameMode === 'menu') {
    return (
      <>
        <NotificationContainer />
        <div className="app-audio-controls app-audio-controls--menu">
          <AudioSettingsButton />
        </div>
        <MainMenu />
      </>
    );
  }

  // Show game interface for editor or scenario modes
  return (
    <MainLayout>
      <NotificationContainer />
      <div className="app-container">
        <div className="app-main-content">
          {viewMode === 'sector' ? (
            <div className="sector-map-view">
              <div className="sector-map-view__floating-controls" role="region" aria-label="Primary workspace view">
                <button
                  type="button"
                  onClick={() => setIsSystemMenuOpen(true)}
                  className="btn btn-ghost btn-sm sector-map-view__floating-button"
                  aria-haspopup="dialog"
                  aria-expanded={isSystemMenuOpen}
                >
                  ⚙ System Options
                </button>
                {renderViewToggle()}
                <div className="turn-indicator" aria-live="polite">
                  Turn: {turnNumber}
                </div>
                <div id="end-turn-button-slot" className="end-turn-button-slot" aria-live="polite" />
              </div>
              <div id="factions-summary-slot" className="factions-summary-slot" aria-live="polite" />
              <div className="sector-map-view__map-container">
                <SectorMap />
              </div>
              <TurnManager />
            </div>
          ) : viewMode === 'factions' ? (
            <div className="faction-view">
              <div className="faction-view__controls" role="region" aria-label="Primary workspace view">
                <button
                  type="button"
                  onClick={() => setIsSystemMenuOpen(true)}
                  className="btn btn-ghost btn-sm faction-view__controls-button"
                  aria-haspopup="dialog"
                  aria-expanded={isSystemMenuOpen}
                >
                  ⚙ System Options
                </button>
                {renderViewToggle()}
                <div className="turn-indicator" aria-live="polite">
                  Turn: {turnNumber}
                </div>
              </div>
              <FactionManager />
            </div>
          ) : viewMode === 'news' ? (
            <div className="news-view">
              <div className="news-view__controls" role="region" aria-label="Primary workspace view">
                <button
                  type="button"
                  onClick={() => setIsSystemMenuOpen(true)}
                  className="btn btn-ghost btn-sm news-view__controls-button"
                  aria-haspopup="dialog"
                  aria-expanded={isSystemMenuOpen}
                >
                  ⚙ System Options
                </button>
                {renderViewToggle()}
                <div className="turn-indicator" aria-live="polite">
                  Turn: {turnNumber}
                </div>
              </div>
              <div className="news-view__content">
                <NewsFeed />
              </div>
            </div>
          ) : (
            <div className="encyclopedia-view">
              <div className="encyclopedia-view__controls" role="region" aria-label="Primary workspace view">
                <button
                  type="button"
                  onClick={() => setIsSystemMenuOpen(true)}
                  className="btn btn-ghost btn-sm encyclopedia-view__controls-button"
                  aria-haspopup="dialog"
                  aria-expanded={isSystemMenuOpen}
                >
                  ⚙ System Options
                </button>
                {renderViewToggle()}
                <div className="turn-indicator" aria-live="polite">
                  Turn: {turnNumber}
                </div>
              </div>
              <div className="encyclopedia-view__content">
                <Encyclopedia />
              </div>
            </div>
          )}
        </div>
      </div>
      <TutorialManager />
      <VictoryModal />
      <SystemOptionsMenu
        isOpen={isSystemMenuOpen}
        onClose={() => setIsSystemMenuOpen(false)}
        onReturnToMenu={() => {
          handleReturnToMenu();
          setIsSystemMenuOpen(false);
        }}
        onStartTutorial={(module) => {
          dispatch(startTutorialModule(module));
          setIsSystemMenuOpen(false);
        }}
        canGenerateSector={viewMode === 'sector' && gameMode === 'editor'}
        onGenerateSector={() => {
          handleGenerateSector();
          setIsSystemMenuOpen(false);
        }}
      />
      {/* Faction Selection Modal for Scenario Mode */}
      {showFactionSelection && gameMode === 'scenario' && factions.length > 0 && (
        <FactionSelectionModal
          factions={factions}
          sector={sector.currentSector}
          onSelectFaction={handleFactionSelection}
        />
      )}
    </MainLayout>
  );
}

export default App;
