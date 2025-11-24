import { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import type { AppDispatch } from '../../store/store';
import { removeFaction, addAsset } from '../../store/slices/factionsSlice';
import type { Faction, FactionType } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import { validateAssetPurchase } from '../../utils/assetValidation';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import { showNotification } from '../NotificationContainer';
import { getAssetById } from '../../data/assetLibrary';
import FactionCreationForm from './FactionCreationForm';
import FactionDashboard from './FactionDashboard';
import './FactionManager.css';

const FACTION_TYPE_OPTIONS: FactionType[] = [
  'Government',
  'Corporation',
  'Religion',
  'Criminal Organization',
  'Mercenary Group',
  'Rebel Movement',
  'Eugenics Cult',
  'Colony',
  'Regional Hegemon',
  'Other',
];

type SortOption = 'recent' | 'alpha' | 'strength';

const SORT_OPTIONS: Array<{ label: string; value: SortOption }> = [
  { label: 'Newest', value: 'recent' },
  { label: 'A–Z', value: 'alpha' },
  { label: 'Strength', value: 'strength' },
];

const getInfluenceScore = (faction: Faction) =>
  faction.attributes.force + faction.attributes.cunning + faction.attributes.wealth;

export default function FactionManager() {
  const dispatch = useDispatch<AppDispatch>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<FactionType | 'all'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const factions = useSelector((state: RootState) => state.factions.factions);
  const systems = useSelector(
    (state: RootState) => state.sector.currentSector?.systems || []
  );

  const getSystemName = (systemId: string): string => {
    const system = systems.find((s: StarSystem) => s.id === systemId);
    return system?.name || 'Unknown System';
  };

  const handleRemoveFaction = (e: React.MouseEvent, factionId: string) => {
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

    // Validate purchase
    const validation = validateAssetPurchase(faction, assetDefinitionId);
    if (!validation.valid) {
      showNotification(validation.reason || 'Cannot purchase asset', 'error');
      return;
    }

    // Get asset definition for success message
    const assetDef = getAssetById(assetDefinitionId);
    const systemName = getSystemName(faction.homeworld);

    // Assets are purchased at the homeworld when using the button
    dispatch(
      addAsset({
        factionId: factionId,
        assetDefinitionId,
        location: faction.homeworld,
      })
    );

    // Generate narrative for the purchase
    const homeworldSystem = systems.find((s: StarSystem) => s.id === faction.homeworld);
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

    // Show success notification
    showNotification(
      `Purchased ${assetDef?.name || 'asset'} and placed at ${systemName}`,
      'success'
    );
  };

  const filteredFactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return factions.filter((faction) => {
      const matchesSearch =
        !normalizedSearch ||
        faction.name.toLowerCase().includes(normalizedSearch) ||
        faction.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
      const matchesType = typeFilter === 'all' || faction.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [factions, searchTerm, typeFilter]);

  const sortedFactions = useMemo(() => {
    const list = [...filteredFactions];
    if (sortOption === 'alpha') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortOption === 'strength') {
      return list.sort((a, b) => getInfluenceScore(b) - getInfluenceScore(a));
    }
    return list;
  }, [filteredFactions, sortOption]);

  useEffect(() => {
    if (sortedFactions.length === 0) {
      setSelectedFactionId(null);
      return;
    }

    setSelectedFactionId((current) => {
      if (current && sortedFactions.some((faction) => faction.id === current)) {
        return current;
      }
      return sortedFactions[0].id;
    });
  }, [sortedFactions]);

  const selectedFaction =
    (selectedFactionId && factions.find((faction) => faction.id === selectedFactionId)) || null;

  const summaryStats = useMemo(() => {
    const totalAssets = factions.reduce((sum, faction) => sum + faction.assets.length, 0);
    const totalStrength = factions.reduce((sum, faction) => sum + getInfluenceScore(faction), 0);
    const avgStrength = factions.length ? Math.round(totalStrength / factions.length) : 0;

    return [
      {
        label: 'Active Factions',
        value: factions.length.toString(),
        meta: 'Operational dossiers',
      },
      {
        label: 'Assets Deployed',
        value: totalAssets.toString(),
        meta: 'Across all theaters',
      },
      {
        label: 'Avg. Strength',
        value: factions.length ? avgStrength.toString() : '—',
        meta: 'Force + Cunning + Wealth',
      },
    ];
  }, [factions]);

  const handleCardSelect = (factionId: string) => {
    setSelectedFactionId(factionId);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, factionId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardSelect(factionId);
    }
  };

  const handleOpenForm = () => setIsDrawerOpen(true);
  const handleCloseForm = () => setIsDrawerOpen(false);

  return (
    <section className="faction-manager" aria-labelledby="faction-manager-title">
      <header className="faction-manager__hero">
        <div className="faction-manager__intro">
          <p className="faction-manager__eyebrow">Operations Center</p>
          <h1 id="faction-manager-title">Faction Management</h1>
          <p className="faction-manager__subtitle">
            Monitor loyalties, deploy assets, and keep every dossier within reach.
          </p>
        </div>
        <div className="faction-manager__metrics">
          <div className="faction-manager__stats">
            {summaryStats.map((stat) => (
              <div key={stat.label} className="stat-chip">
                <span className="stat-chip__label">{stat.label}</span>
                <strong className="stat-chip__value">{stat.value}</strong>
                <span className="stat-chip__meta">{stat.meta}</span>
              </div>
            ))}
          </div>
          <div className="faction-manager__cta-group">
            <button
              type="button"
              className="fm-button fm-button--ghost"
              onClick={() => showNotification('Import coming soon', 'info')}
            >
              Import Data
            </button>
            <button type="button" className="fm-button fm-button--primary" onClick={handleOpenForm}>
              Create New Faction
            </button>
          </div>
        </div>
      </header>

      <div className="faction-manager__grid">
        <aside className="faction-manager__sidebar" aria-label="Faction library">
          <div className="filter-panel">
            <div className="filter-panel__row">
              <div className="filter-field">
                <label htmlFor="faction-search">Search</label>
                <div className="filter-field__control">
                  <input
                    id="faction-search"
                    type="search"
                    placeholder="Search factions or tags"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="filter-field">
                <label htmlFor="faction-type-filter">Type</label>
                <div className="filter-field__control">
                  <select
                    id="faction-type-filter"
                    value={typeFilter}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTypeFilter(value === 'all' ? 'all' : (value as FactionType));
                    }}
                  >
                    <option value="all">All types</option>
                    {FACTION_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="filter-panel__row filter-panel__row--compact">
              <span className="filter-label">Sort</span>
              <div className="filter-pill-group" role="tablist" aria-label="Sort factions">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`filter-pill ${sortOption === option.value ? 'is-active' : ''}`}
                    onClick={() => setSortOption(option.value)}
                    role="tab"
                    aria-selected={sortOption === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="filter-result-count">
                {sortedFactions.length} shown
              </span>
            </div>
          </div>

          <div className="faction-list" role="list" aria-live="polite">
            {sortedFactions.length === 0 ? (
              <div className="faction-list__empty">
                <p>No factions match the current filters.</p>
                <button type="button" className="fm-button fm-button--secondary" onClick={handleOpenForm}>
                  Create the first faction
                </button>
              </div>
            ) : (
              sortedFactions.map((faction) => (
                <article
                  key={faction.id}
                  className={`faction-card ${selectedFactionId === faction.id ? 'is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardSelect(faction.id)}
                  onKeyDown={(event) => handleCardKeyDown(event, faction.id)}
                  aria-pressed={selectedFactionId === faction.id}
                >
                  <div className="faction-card__header">
                    <div>
                      <p className="faction-card__type">{faction.type}</p>
                      <h3>{faction.name}</h3>
                    </div>
                    <button
                      type="button"
                      className="faction-card__remove fm-button fm-button--icon"
                      onClick={(e) => handleRemoveFaction(e, faction.id)}
                      aria-label={`Remove ${faction.name}`}
                      title={`Remove ${faction.name}`}
                    >
                      ×
                    </button>
                  </div>
                  <p className="faction-card__meta">
                    Homeworld: {getSystemName(faction.homeworld)}
                  </p>
                  <div className="faction-card__metrics">
                    <div>
                      <span>Assets</span>
                      <strong>{faction.assets.length}</strong>
                    </div>
                    <div>
                      <span>FacCreds</span>
                      <strong>{faction.facCreds}</strong>
                    </div>
                    <div>
                      <span>Strength</span>
                      <strong>{getInfluenceScore(faction)}</strong>
                    </div>
                  </div>
                  {faction.tags.length > 0 && (
                    <div className="faction-card__tags">
                      {faction.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </aside>

        <section className="faction-manager__detail">
          <div className="detail-header">
            <div>
              <p className="detail-header__eyebrow">Selected Faction</p>
              <div className="detail-header__title-row">
                <h2>{selectedFaction ? selectedFaction.name : 'No faction selected'}</h2>
                {selectedFaction && (
                  <span className="detail-header__chip">{selectedFaction.type}</span>
                )}
              </div>
              <p className="detail-header__meta">
                {selectedFaction
                  ? `Homeworld: ${getSystemName(selectedFaction.homeworld)}`
                  : 'Choose a faction from the list to review its dossier.'}
              </p>
            </div>
            <div className="detail-header__actions">
              {selectedFaction && (
                <button
                  type="button"
                  className="fm-button fm-button--ghost"
                  onClick={(e) => handleRemoveFaction(e, selectedFaction.id)}
                >
                  Remove
                </button>
              )}
              <button type="button" className="fm-button fm-button--primary" onClick={handleOpenForm}>
                Create New Faction
              </button>
            </div>
          </div>
          <div className="detail-body">
            <FactionDashboard
              factionId={selectedFactionId}
              onPurchaseAsset={
                selectedFactionId
                  ? (assetDefinitionId) => handlePurchaseAsset(selectedFactionId, assetDefinitionId)
                  : undefined
              }
            />
          </div>
        </section>
      </div>

      <div
        className={`faction-form-drawer ${isDrawerOpen ? 'is-open' : ''}`}
        aria-hidden={!isDrawerOpen}
      >
        <div className="faction-form-drawer__overlay" onClick={handleCloseForm} />
        <aside
          className="faction-form-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="faction-form-title"
        >
          <header className="faction-form-drawer__header">
            <div>
              <p className="faction-form-drawer__eyebrow">New dossier</p>
              <h2 id="faction-form-title">Create Faction</h2>
            </div>
            <button
              type="button"
              className="fm-button fm-button--icon"
              onClick={handleCloseForm}
              aria-label="Close faction form"
            >
              ×
            </button>
          </header>
          <div className="faction-form-drawer__body">
            <FactionCreationForm />
          </div>
        </aside>
      </div>
    </section>
  );
}

