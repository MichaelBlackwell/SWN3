import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import type { AppDispatch } from '../../store/store';
import { removeFaction, addAsset } from '../../store/slices/factionsSlice';
import type { Faction } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import { validateAssetPurchase } from '../../utils/assetValidation';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import { showNotification } from '../NotificationContainer';
import { getAssetById } from '../../data/assetLibrary';
import FactionCreationForm from './FactionCreationForm';
import FactionDashboard from './FactionDashboard';
import './FactionManager.css';
import { tutorialEventOccurred } from '../../store/slices/tutorialSlice';
import TagBadge from '../common/TagBadge';
import { FACTION_TAG_METADATA } from '../../data/factionTagMetadata';

// Attribute color mapping
const ATTRIBUTE_COLORS = {
  force: { primary: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
  cunning: { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  wealth: { primary: '#eab308', glow: 'rgba(234, 179, 8, 0.4)' },
};

// Faction type icons (using Unicode for simplicity, could be replaced with actual icons)
const FACTION_TYPE_ICONS: Record<string, string> = {
  'Government': '🏛️',
  'Corporation': '🏢',
  'Religion': '⛪',
  'Criminal Organization': '🎭',
  'Mercenary Group': '⚔️',
  'Rebel Movement': '✊',
  'Eugenics Cult': '🧬',
  'Colony': '🌍',
  'Regional Hegemon': '👑',
  'Other': '🔷',
};

export default function FactionManager() {
  const dispatch = useDispatch<AppDispatch>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
  const factions = useSelector((state: RootState) => state.factions.factions);
  const playerFactionId = useSelector((state: RootState) => state.gameMode.playerFactionId);
  const systems = useSelector(
    (state: RootState) => state.sector.currentSector?.systems || []
  );

  const getSystemName = (systemId: string): string => {
    const system = systems.find((s: StarSystem) => s.id === systemId);
    return system?.name || 'Unknown System';
  };

  const handleRemoveFaction = (e: ReactMouseEvent<HTMLElement>, factionId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this faction?')) {
      dispatch(removeFaction(factionId));
    }
  };

  const handlePurchaseAsset = (factionId: string, assetDefinitionId: string) => {
    const faction = factions.find((f: Faction) => f.id === factionId);
    if (!faction) {
      showNotification('Faction not found', 'error');
      return;
    }

    const homeworldSystem = systems.find((s: StarSystem) => s.id === faction.homeworld);
    const validation = validateAssetPurchase(faction, assetDefinitionId, {
      targetSystem: homeworldSystem,
    });
    if (!validation.valid) {
      showNotification(validation.reason || 'Cannot purchase asset', 'error');
      return;
    }

    const assetDef = getAssetById(assetDefinitionId);
    const systemName = getSystemName(faction.homeworld);

    dispatch(
      addAsset({
        factionId: factionId,
        assetDefinitionId,
        location: faction.homeworld,
      })
    );

    const getSystemHelper = (id: string) => systems.find((s: StarSystem) => s.id === id);
    const getSystemNameHelper = (id: string): string => {
      const system = getSystemHelper(id);
      return system?.name || 'Unknown System';
    };

    const actorContext = createNarrativeContextFromFaction(faction, getSystemNameHelper, getSystemHelper);
    const systemContext = createNarrativeContextFromSystem(homeworldSystem);

    dispatchNarrativeEntry(dispatch, 'Buy', {
      ...actorContext,
      ...systemContext,
      assetName: assetDef?.name,
      credits: assetDef?.cost,
      result: 'Success',
      relatedEntityIds: [factionId, faction.homeworld].filter(Boolean),
    });

    showNotification(
      `Purchased ${assetDef?.name || 'asset'} and placed at ${systemName}`,
      'success'
    );
    dispatch(tutorialEventOccurred({ eventId: 'assetTutorial.assetPurchased' }));
  };

  useEffect(() => {
    if (factions.length === 0) {
      setSelectedFactionId(null);
      return;
    }

    setSelectedFactionId((current) => {
      if (current && factions.some((faction) => faction.id === current)) {
        return current;
      }
      return factions[0].id;
    });
  }, [factions]);

  const selectedFaction =
    (selectedFactionId && factions.find((faction) => faction.id === selectedFactionId)) || null;

  // Calculate global stats for the overview
  const globalStats = useMemo(() => {
    const totalAssets = factions.reduce(
      (sum: number, faction: Faction) => sum + faction.assets.length,
      0
    );
    const totalFacCreds = factions.reduce(
      (sum: number, faction: Faction) => sum + faction.facCreds,
      0
    );
    const totalForce = factions.reduce(
      (sum: number, faction: Faction) => sum + faction.attributes.force,
      0
    );
    const totalCunning = factions.reduce(
      (sum: number, faction: Faction) => sum + faction.attributes.cunning,
      0
    );
    const totalWealth = factions.reduce(
      (sum: number, faction: Faction) => sum + faction.attributes.wealth,
      0
    );
    
    // Find max values for scaling bars
    const maxForce = Math.max(...factions.map(f => f.attributes.force), 1);
    const maxCunning = Math.max(...factions.map(f => f.attributes.cunning), 1);
    const maxWealth = Math.max(...factions.map(f => f.attributes.wealth), 1);
    const maxAssets = Math.max(...factions.map(f => f.assets.length), 1);

    return {
      totalFactions: factions.length,
      totalAssets,
      totalFacCreds,
      totalForce,
      totalCunning,
      totalWealth,
      maxForce,
      maxCunning,
      maxWealth,
      maxAssets,
    };
  }, [factions]);

  const handleCardSelect = (factionId: string) => {
    setSelectedFactionId(factionId);
    setViewMode('detail');
  };

  const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>, factionId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardSelect(factionId);
    }
  };

  const handleOpenForm = () => setIsDrawerOpen(true);
  const handleCloseForm = () => setIsDrawerOpen(false);
  const handleBackToGrid = () => setViewMode('grid');

  // Calculate HP percentage for visual display
  const getHpPercent = (faction: Faction) => 
    Math.round((faction.attributes.hp / faction.attributes.maxHp) * 100);

  // Get health status color
  const getHealthColor = (percent: number) => {
    if (percent > 66) return '#22c55e';
    if (percent > 33) return '#eab308';
    return '#ef4444';
  };

  return (
    <section className="fm" aria-labelledby="faction-manager-title">
      {/* Header Bar */}
      <header className="fm__header">
        <div className="fm__header-left">
          {viewMode === 'detail' && (
            <button 
              type="button" 
              className="fm__back-btn"
              onClick={handleBackToGrid}
              aria-label="Back to overview"
            >
              ← Overview
            </button>
          )}
          <h1 id="faction-manager-title" className="fm__title">
            {viewMode === 'grid' ? 'Faction Overview' : selectedFaction?.name || 'Faction Details'}
          </h1>
        </div>
        <div className="fm__header-right">
          <button type="button" className="fm__action-btn" onClick={handleOpenForm}>
            <span className="fm__action-btn-icon">+</span>
            New Faction
          </button>
        </div>
      </header>

      {viewMode === 'grid' ? (
        <>
          {/* Global Stats Bar */}
          <div className="fm__stats-bar">
            <div className="fm__stat-item">
              <span className="fm__stat-value">{globalStats.totalFactions}</span>
              <span className="fm__stat-label">Factions</span>
            </div>
            <div className="fm__stat-divider" />
            <div className="fm__stat-item">
              <span className="fm__stat-value">{globalStats.totalAssets}</span>
              <span className="fm__stat-label">Total Assets</span>
            </div>
            <div className="fm__stat-divider" />
            <div className="fm__stat-item">
              <span className="fm__stat-value fm__stat-value--gold">{globalStats.totalFacCreds}</span>
              <span className="fm__stat-label">FacCreds</span>
            </div>
            <div className="fm__stat-divider" />
            <div className="fm__stat-item fm__stat-item--group">
              <div className="fm__stat-mini">
                <span className="fm__stat-mini-value" style={{ color: ATTRIBUTE_COLORS.force.primary }}>{globalStats.totalForce}</span>
                <span className="fm__stat-mini-label">Force</span>
              </div>
              <div className="fm__stat-mini">
                <span className="fm__stat-mini-value" style={{ color: ATTRIBUTE_COLORS.cunning.primary }}>{globalStats.totalCunning}</span>
                <span className="fm__stat-mini-label">Cunning</span>
              </div>
              <div className="fm__stat-mini">
                <span className="fm__stat-mini-value" style={{ color: ATTRIBUTE_COLORS.wealth.primary }}>{globalStats.totalWealth}</span>
                <span className="fm__stat-mini-label">Wealth</span>
              </div>
            </div>
          </div>

          {/* Faction Grid */}
          <div className="fm__grid-container">
            {factions.length === 0 ? (
              <div className="fm__empty-state">
                <div className="fm__empty-icon">🌌</div>
                <h2>No Factions Yet</h2>
                <p>Create your first faction to begin building your interstellar empire.</p>
                <button type="button" className="fm__action-btn fm__action-btn--large" onClick={handleOpenForm}>
                  <span className="fm__action-btn-icon">+</span>
                  Create First Faction
                </button>
              </div>
            ) : (
              <div className="fm__faction-grid" role="list">
                {factions.map((faction: Faction) => {
                  const hpPercent = getHpPercent(faction);
                  const healthColor = getHealthColor(hpPercent);
                  const totalPower = faction.attributes.force + faction.attributes.cunning + faction.attributes.wealth;
                  const isPlayerFaction = playerFactionId === faction.id;
                  
                  return (
                    <article
                      key={faction.id}
                      className={`fm__faction-card ${selectedFactionId === faction.id ? 'fm__faction-card--selected' : ''} ${isPlayerFaction ? 'fm__faction-card--player' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleCardSelect(faction.id)}
                      onKeyDown={(event) => handleCardKeyDown(event, faction.id)}
                      aria-pressed={selectedFactionId === faction.id}
                    >
                      {/* Card Header */}
                      <div className="fm__card-header">
                        <div className="fm__card-icon">
                          {FACTION_TYPE_ICONS[faction.type] || '🔷'}
                        </div>
                        <div className="fm__card-title-group">
                          <span className="fm__card-type">
                            {faction.type}
                            {isPlayerFaction && <span className="fm__player-badge">Player</span>}
                          </span>
                          <h3 className="fm__card-name">{faction.name}</h3>
                        </div>
                        <button
                          type="button"
                          className="fm__card-remove"
                          onClick={(e) => handleRemoveFaction(e, faction.id)}
                          aria-label={`Remove ${faction.name}`}
                          title="Remove faction"
                        >
                          ×
                        </button>
                      </div>

                      {/* Homeworld */}
                      <div className="fm__card-homeworld">
                        <span className="fm__card-homeworld-icon">🪐</span>
                        <span className="fm__card-homeworld-name">{getSystemName(faction.homeworld)}</span>
                      </div>

                      {/* Health Bar */}
                      <div className="fm__card-health">
                        <div className="fm__card-health-info">
                          <span>HP</span>
                          <span>{faction.attributes.hp}/{faction.attributes.maxHp}</span>
                        </div>
                        <div className="fm__card-health-bar">
                          <div 
                            className="fm__card-health-fill" 
                            style={{ 
                              width: `${hpPercent}%`,
                              backgroundColor: healthColor,
                              boxShadow: `0 0 8px ${healthColor}40`
                            }} 
                          />
                        </div>
                      </div>

                      {/* Attributes */}
                      <div className="fm__card-attributes">
                        <div className="fm__card-attr">
                          <div className="fm__card-attr-header">
                            <span className="fm__card-attr-label">Force</span>
                            <span className="fm__card-attr-value" style={{ color: ATTRIBUTE_COLORS.force.primary }}>
                              {faction.attributes.force}
                            </span>
                          </div>
                          <div className="fm__card-attr-bar">
                            <div 
                              className="fm__card-attr-fill"
                              style={{ 
                                width: `${(faction.attributes.force / globalStats.maxForce) * 100}%`,
                                backgroundColor: ATTRIBUTE_COLORS.force.primary,
                                boxShadow: `0 0 6px ${ATTRIBUTE_COLORS.force.glow}`
                              }}
                            />
                          </div>
                        </div>
                        <div className="fm__card-attr">
                          <div className="fm__card-attr-header">
                            <span className="fm__card-attr-label">Cunning</span>
                            <span className="fm__card-attr-value" style={{ color: ATTRIBUTE_COLORS.cunning.primary }}>
                              {faction.attributes.cunning}
                            </span>
                          </div>
                          <div className="fm__card-attr-bar">
                            <div 
                              className="fm__card-attr-fill"
                              style={{ 
                                width: `${(faction.attributes.cunning / globalStats.maxCunning) * 100}%`,
                                backgroundColor: ATTRIBUTE_COLORS.cunning.primary,
                                boxShadow: `0 0 6px ${ATTRIBUTE_COLORS.cunning.glow}`
                              }}
                            />
                          </div>
                        </div>
                        <div className="fm__card-attr">
                          <div className="fm__card-attr-header">
                            <span className="fm__card-attr-label">Wealth</span>
                            <span className="fm__card-attr-value" style={{ color: ATTRIBUTE_COLORS.wealth.primary }}>
                              {faction.attributes.wealth}
                            </span>
                          </div>
                          <div className="fm__card-attr-bar">
                            <div 
                              className="fm__card-attr-fill"
                              style={{ 
                                width: `${(faction.attributes.wealth / globalStats.maxWealth) * 100}%`,
                                backgroundColor: ATTRIBUTE_COLORS.wealth.primary,
                                boxShadow: `0 0 6px ${ATTRIBUTE_COLORS.wealth.glow}`
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Stats */}
                      <div className="fm__card-footer">
                        <div className="fm__card-stat">
                          <span className="fm__card-stat-value">{faction.assets.length}</span>
                          <span className="fm__card-stat-label">Assets</span>
                        </div>
                        <div className="fm__card-stat">
                          <span className="fm__card-stat-value fm__card-stat-value--gold">{faction.facCreds}</span>
                          <span className="fm__card-stat-label">FacCreds</span>
                        </div>
                        <div className="fm__card-stat">
                          <span className="fm__card-stat-value">{totalPower}</span>
                          <span className="fm__card-stat-label">Power</span>
                        </div>
                        <div className="fm__card-stat">
                          <span className="fm__card-stat-value">{faction.xp}</span>
                          <span className="fm__card-stat-label">XP</span>
                        </div>
                      </div>

                      {/* Tags */}
                      {faction.tags.length > 0 && (
                        <div className="fm__card-tags">
                          {faction.tags.slice(0, 3).map((tag) => (
                            <TagBadge
                              key={tag}
                              label={tag}
                              description={FACTION_TAG_METADATA[tag]?.description}
                            effects={FACTION_TAG_METADATA[tag]?.effects}
                            />
                          ))}
                          {faction.tags.length > 3 && (
                            <span className="fm__card-tags-more">+{faction.tags.length - 3}</span>
                          )}
                        </div>
                      )}

                      {/* Goal Indicator */}
                      {faction.goal && (
                        <div className="fm__card-goal">
                          <span className="fm__card-goal-icon">🎯</span>
                          <span className="fm__card-goal-text">{faction.goal.type}</span>
                          <div className="fm__card-goal-progress">
                            <div 
                              className="fm__card-goal-progress-fill"
                              style={{ 
                                width: `${(faction.goal.progress.current / faction.goal.progress.target) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Detail View */
        <div className="fm__detail-view">
          <FactionDashboard
            factionId={selectedFactionId}
            onPurchaseAsset={
              selectedFactionId
                ? (assetDefinitionId) => handlePurchaseAsset(selectedFactionId, assetDefinitionId)
                : undefined
            }
          />
        </div>
      )}

      {/* Faction Creation Drawer */}
      <div
        className={`fm__drawer ${isDrawerOpen ? 'fm__drawer--open' : ''}`}
        aria-hidden={!isDrawerOpen}
      >
        <div className="fm__drawer-overlay" onClick={handleCloseForm} />
        <aside
          className="fm__drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="faction-form-title"
        >
          <header className="fm__drawer-header">
            <div>
              <span className="fm__drawer-eyebrow">New Faction</span>
              <h2 id="faction-form-title">Create Faction</h2>
            </div>
            <button
              type="button"
              className="fm__drawer-close"
              onClick={handleCloseForm}
              aria-label="Close form"
            >
              ×
            </button>
          </header>
          <div className="fm__drawer-body">
            <FactionCreationForm />
          </div>
        </aside>
      </div>
    </section>
  );
}
