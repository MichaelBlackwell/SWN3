import { useState } from 'react';
import { useDispatch } from 'react-redux';
import MainLayout from './components/MainLayout';
import SectorMap from './components/SectorMap/SectorMap';
import FactionManager from './components/FactionManager/FactionManager';
import TurnManager from './components/TurnManager/TurnManager';
import NewsFeed from './components/NewsFeed/NewsFeed';
import NotificationContainer from './components/NotificationContainer';
import SaveMenu from './components/SaveMenu/SaveMenu';
import { generateSector } from './services/sectorGenerator';
import { setSector } from './store/slices/sectorSlice';
import { clearAllFactions, addFaction } from './store/slices/factionsSlice';
import { resetTurnState } from './store/slices/turnSlice';
import type { Faction } from './types/faction';
import { calculateFactionStats, generateFactionId, calculateStartingFacCreds } from './utils/factionCalculations';
import './App.css';
import './styles/layout.css';
import './components/AppHeader.css';
import './components/SectorMapView.css';

type ViewMode = 'sector' | 'factions';

function App() {
  const dispatch = useDispatch();
  const [viewMode, setViewMode] = useState<ViewMode>('sector');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'turn' | 'news'>('turn');

  const handleGenerateSector = () => {
    // Clear all factions when generating a new sector
    dispatch(clearAllFactions());
    const newSector = generateSector();
    dispatch(setSector(newSector));
    
    // Reset turn state
    dispatch(resetTurnState());
    
    // Create 2 test factions on the same planet (first system)
    if (newSector.systems.length > 0) {
      const firstSystemId = newSector.systems[0].id;
      
      // Create first test faction (Government)
      const faction1Attributes = calculateFactionStats('Government');
      const faction1: Faction = {
        id: generateFactionId(),
        name: 'Test Faction Alpha',
        type: 'Government',
        homeworld: firstSystemId,
        attributes: faction1Attributes,
        facCreds: calculateStartingFacCreds(faction1Attributes),
        tags: ['Planetary Government'],
        goal: {
          type: 'Expand Influence',
          requirements: {},
          progress: {},
        },
        assets: [],
      };
      
      // Create second test faction (Corporation)
      const faction2Attributes = calculateFactionStats('Corporation');
      const faction2: Faction = {
        id: generateFactionId(),
        name: 'Test Faction Beta',
        type: 'Corporation',
        homeworld: firstSystemId,
        attributes: faction2Attributes,
        facCreds: calculateStartingFacCreds(faction2Attributes),
        tags: ['Plutocratic'],
        goal: {
          type: 'Commercial Expansion',
          requirements: {},
          progress: {},
        },
        assets: [],
      };
      
      dispatch(addFaction(faction1));
      dispatch(addFaction(faction2));
    }
  };

  return (
    <MainLayout>
      <NotificationContainer />
      <div className="app-container">
        <header className="app-header">
          <div className="app-header__left">
            <h1 className="app-header__title">Stars Without Number</h1>
            <nav className={`app-header__nav ${isMobileMenuOpen ? '' : 'app-header__nav--collapsed'}`}>
              <button
                onClick={() => {
                  setViewMode('sector');
                  setIsMobileMenuOpen(false);
                }}
                className={`app-header__nav-button ${viewMode === 'sector' ? 'app-header__nav-button--active' : ''}`}
                aria-label="Switch to Sector Map view"
              >
                Sector Map
              </button>
              <button
                onClick={() => {
                  setViewMode('factions');
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
            <SaveMenu />
            {viewMode === 'sector' && (
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
