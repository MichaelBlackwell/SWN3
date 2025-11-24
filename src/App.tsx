import { useState, useEffect } from 'react';
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
import { generateSector } from './services/sectorGenerator';
import { generateSectorWithConfig } from './services/sectorGeneratorWithConfig';
import { setSector } from './store/slices/sectorSlice';
import { clearAllFactions, addFaction } from './store/slices/factionsSlice';
import { resetTurnState } from './store/slices/turnSlice';
import { setCurrentView, returnToMenu } from './store/slices/gameModeSlice';
import { generateRandomFactionForSystem } from './services/factionGenerator';
import './App.css';
import './styles/layout.css';
import './components/AppHeader.css';
import './components/SectorMapView.css';

function App() {
  const dispatch = useDispatch();
  const gameMode = useSelector((state: RootState) => state.gameMode.mode);
  const currentScenario = useSelector((state: RootState) => state.gameMode.currentScenario);
  const viewMode = useSelector((state: RootState) => state.gameMode.currentView);
  const sector = useSelector((state: RootState) => state.sector);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'turn' | 'news'>('turn');

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
      faction1.goal = {
        type: 'Expand Influence',
        requirements: {},
        progress: {},
      };
      
      // Generate second faction on same system (if there are multiple systems, use second one)
      const secondSystem = newSector.systems.length > 1 ? newSector.systems[1] : firstSystem;
      const faction2 = generateRandomFactionForSystem(secondSystem);
      faction2.name = 'Test Faction Beta';
      faction2.goal = {
        type: 'Commercial Expansion',
        requirements: {},
        progress: {},
      };
      
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
        <MainMenu />
      </>
    );
  }

  // Show game interface for editor or scenario modes
  return (
    <MainLayout>
      <NotificationContainer />
      <TutorialManager />
      <div className="app-container">
        <header className="app-header">
          <div className="app-header__left">
            <h1 className="app-header__title">Stars Without Number</h1>
            <nav className={`app-header__nav ${isMobileMenuOpen ? '' : 'app-header__nav--collapsed'}`}>
              <button
                onClick={() => {
                  dispatch(setCurrentView('sector'));
                  setIsMobileMenuOpen(false);
                }}
                className={`app-header__nav-button ${viewMode === 'sector' ? 'app-header__nav-button--active' : ''}`}
                aria-label="Switch to Sector Map view"
              >
                Sector Map
              </button>
              <button
                onClick={() => {
                  dispatch(setCurrentView('factions'));
                  setIsMobileMenuOpen(false);
                }}
                className={`app-header__nav-button ${viewMode === 'factions' ? 'app-header__nav-button--active' : ''}`}
                aria-label="Switch to Factions view"
              >
                Factions
              </button>
            </nav>
          </div>
          <div className="app-header__right">
            <button
              onClick={handleReturnToMenu}
              className="app-header__action-button"
              style={{ marginRight: '0.5rem' }}
            >
              ← Main Menu
            </button>
            <SaveMenu />
            {viewMode === 'sector' && gameMode === 'editor' && (
              <button
                onClick={handleGenerateSector}
                className="app-header__action-button"
              >
                Generate New Sector
              </button>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`app-header__menu-toggle ${isMobileMenuOpen ? 'app-header__menu-toggle--active' : ''}`}
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
    </MainLayout>
  );
}

export default App;
