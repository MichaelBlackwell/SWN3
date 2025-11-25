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
import SaveMenu from './components/SaveMenu/SaveMenu';
import TutorialManager from './components/Tutorial/TutorialManager';
import { AudioSettingsButton } from './components/AudioSettings';
import { generateSector } from './services/sectorGenerator';
import { generateSectorWithConfig } from './services/sectorGeneratorWithConfig';
import { createFactionGoal } from './services/GoalRegistry';
import { setSector } from './store/slices/sectorSlice';
import { clearAllFactions, addFaction } from './store/slices/factionsSlice';
import { resetTurnState } from './store/slices/turnSlice';
import { returnToMenu } from './store/slices/gameModeSlice';
import { startTutorialModule } from './store/slices/tutorialSlice';
import { generateRandomFactionForSystem } from './services/factionGenerator';
import { useGameMusic, useAudio } from './hooks/useAudio';
import './App.css';
import './styles/layout.css';
import './components/AppHeader.css';
import './components/SectorMapView.css';

type ViewMode = 'sector' | 'factions';

function App() {
  const dispatch = useDispatch();
  const gameMode = useSelector((state: RootState) => state.gameMode.mode);
  const currentScenario = useSelector((state: RootState) => state.gameMode.currentScenario);
  const sector = useSelector((state: RootState) => state.sector);
  const [viewMode, setViewMode] = useState<ViewMode>('sector');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'turn' | 'news'>('turn');
  const [audioUnlocked, setAudioUnlocked] = useState(false);

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
    if (gameMode === 'scenario' && currentScenario) {
      // Clear existing data
      dispatch(clearAllFactions());
      dispatch(resetTurnState());
      
      // Generate new sector and factions with scenario config
      const { sector, factions } = generateSectorWithConfig(currentScenario);
      dispatch(setSector(sector));
      
      // Add all generated factions
      factions.forEach(faction => {
        dispatch(addFaction(faction));
      });
    }
  }, [gameMode, currentScenario, dispatch]);

  const handleGenerateSector = () => {
    // Clear all factions when generating a new sector
    dispatch(clearAllFactions());
    const newSector = generateSector();
    dispatch(setSector(newSector));
    
    // Reset turn state
    dispatch(resetTurnState());
    
    // Create 2 test factions using template-based generation
    if (newSector.systems.length > 0) {
      const firstSystem = newSector.systems[0];
      
      // Generate first faction based on homeworld characteristics
      const faction1 = generateRandomFactionForSystem(firstSystem);
      faction1.name = 'Test Faction Alpha';
      faction1.goal = createFactionGoal('Expand Influence', faction1);
      
      // Generate second faction on same system (if there are multiple systems, use second one)
      const secondSystem = newSector.systems.length > 1 ? newSector.systems[1] : firstSystem;
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
        <header className="app-toolbar" role="banner">
          <div className="app-toolbar__left">
            <div className="app-brand">
              <div className="app-brand__badge" aria-hidden="true">✦</div>
              <div className="app-brand__meta">
                <p className="app-brand__eyebrow">Campaign Console</p>
                <h1 className="app-brand__title">Stars Without Number</h1>
              </div>
            </div>
            <nav
              className={`app-view-toggle ${isMobileMenuOpen ? 'app-view-toggle--expanded' : 'app-view-toggle--collapsed'}`}
              aria-label="Primary workspace view"
            >
              <button
                type="button"
                onClick={() => {
                  setViewMode('sector');
                  setIsMobileMenuOpen(false);
                }}
                className={`app-view-toggle__button ${viewMode === 'sector' ? 'app-view-toggle__button--active' : ''}`}
                aria-label="Switch to Sector Map view"
                aria-pressed={viewMode === 'sector'}
              >
                Sector Map
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('factions');
                  setIsMobileMenuOpen(false);
                }}
                className={`app-view-toggle__button ${viewMode === 'factions' ? 'app-view-toggle__button--active' : ''}`}
                aria-label="Switch to Factions view"
                aria-pressed={viewMode === 'factions'}
              >
                Factions
              </button>
            </nav>
          </div>
          <div className="app-toolbar__right">
            <AudioSettingsButton />
            <button
              type="button"
              onClick={handleReturnToMenu}
              className="btn btn-ghost btn-sm app-toolbar__button"
            >
              ← Main Menu
            </button>
            <button
              type="button"
              onClick={() => dispatch(startTutorialModule('mapNavigation'))}
              className="btn btn-secondary btn-sm app-toolbar__button"
              aria-label="Start map navigation tutorial"
            >
              Map Tutorial
            </button>
            <button
              type="button"
              onClick={() => dispatch(startTutorialModule('assetManagement'))}
              className="btn btn-secondary btn-sm app-toolbar__button"
              aria-label="Start asset management tutorial"
            >
              Asset Tutorial
            </button>
            <button
              type="button"
              onClick={() => dispatch(startTutorialModule('influence'))}
              className="btn btn-secondary btn-sm app-toolbar__button"
              aria-label="Start influence tutorial"
            >
              Influence Tutorial
            </button>
            <div className="app-toolbar__divider" aria-hidden="true" />
            <SaveMenu />
            {viewMode === 'sector' && gameMode === 'editor' && (
              <button
                type="button"
                onClick={handleGenerateSector}
                className="btn btn-primary btn-sm app-toolbar__button"
              >
                Generate New Sector
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`btn btn-ghost btn-sm app-toolbar__menu-toggle ${isMobileMenuOpen ? 'is-active' : ''}`}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </header>
        <div className="app-main-content">
          {viewMode === 'sector' ? (
            <div className="sector-map-view">
              <div className={`sector-map-view__map-container ${isSidebarCollapsed ? 'sector-map-view__map-container--sidebar-collapsed' : 'sector-map-view__map-container--sidebar-expanded'}`}>
                <SectorMap />
              </div>
              <div className={`sector-map-view__sidebar ${isSidebarCollapsed ? 'sector-map-view__sidebar--collapsed' : ''}`}>
                <div className="sector-map-view__sidebar-content">
                  <div className="sector-map-view__tabs">
                    <button
                      className={`sector-map-view__tab ${activeTab === 'turn' ? 'sector-map-view__tab--active' : ''}`}
                      onClick={() => setActiveTab('turn')}
                      aria-label="Turn Manager tab"
                    >
                      Turn Manager
                    </button>
                    <button
                      className={`sector-map-view__tab ${activeTab === 'news' ? 'sector-map-view__tab--active' : ''}`}
                      onClick={() => setActiveTab('news')}
                      aria-label="News Feed tab"
                    >
                      News Feed
                    </button>
                  </div>
                  <div className="sector-map-view__tab-content">
                    <div className={`sector-map-view__tab-panel ${activeTab === 'turn' ? 'sector-map-view__tab-panel--active' : ''}`}>
                      <TurnManager />
                    </div>
                    <div className={`sector-map-view__tab-panel ${activeTab === 'news' ? 'sector-map-view__tab-panel--active' : ''}`}>
                      <NewsFeed />
                    </div>
                  </div>
                </div>
              </div>
              <button
                className={`sector-map-view__sidebar-toggle ${isSidebarCollapsed ? 'sector-map-view__sidebar-toggle--collapsed' : 'sector-map-view__sidebar-toggle--expanded'}`}
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!isSidebarCollapsed}
              >
                {isSidebarCollapsed ? '◀' : '▶'}
              </button>
            </div>
          ) : (
            <FactionManager />
          )}
        </div>
      </div>
      <TutorialManager />
    </MainLayout>
  );
}

export default App;
