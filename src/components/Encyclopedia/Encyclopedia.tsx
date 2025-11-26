import { useState, useMemo } from 'react';
import { assetLibrary, getAssetsByCategory } from '../../data/assetLibrary';
import { FACTION_TAG_METADATA } from '../../data/factionTagMetadata';
import { GOAL_METADATA, getGoalsByCategory } from '../../data/goalMetadata';
import { getAbilityDescription } from '../../utils/assetAbilities';
import { getSpecialFeatureDescription } from '../../utils/assetSpecialFeatures';
import type { AssetCategory, AssetDefinition } from '../../types/asset';
import type { FactionTag, FactionGoalType } from '../../types/faction';
import './Encyclopedia.css';

type EncyclopediaSection = 'assets' | 'tags' | 'goals';
type AssetFilter = 'all' | AssetCategory;

interface FlagDetail {
  key: 'action' | 'special' | 'permission';
  label: string;
  description: string;
  className: string;
}

function getFlagDetails(asset: AssetDefinition): FlagDetail[] {
  const details: FlagDetail[] = [];

  if (asset.specialFlags.hasAction) {
    const abilityDesc = getAbilityDescription(asset.id);
    details.push({
      key: 'action',
      label: 'SPECIAL ACTION',
      description: abilityDesc,
      className: 'flag flag--action',
    });
  }

  if (asset.specialFlags.hasSpecial) {
    const specialDesc = getSpecialFeatureDescription(asset.id);
    details.push({
      key: 'special',
      label: 'UNIQUE RULES',
      description: specialDesc || `${asset.name} follows additional rules or costs unique to this asset. Refer to the Stars Without Number rulebook for the exact procedure.`,
      className: 'flag flag--special',
    });
  }

  if (asset.specialFlags.requiresPermission) {
    details.push({
      key: 'permission',
      label: 'PERMISSION REQUIRED',
      description: `${asset.name} can only be purchased or deployed with the approval of the planetary government that controls the world.`,
      className: 'flag flag--permission',
    });
  }

  return details;
}

export default function Encyclopedia() {
  const [activeSection, setActiveSection] = useState<EncyclopediaSection>('assets');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetDefinition | null>(null);
  const [selectedTag, setSelectedTag] = useState<FactionTag | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<FactionGoalType | null>(null);

  // Filter assets based on category and search
  const filteredAssets = useMemo(() => {
    let assets = assetFilter === 'all' 
      ? assetLibrary 
      : getAssetsByCategory(assetFilter);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      assets = assets.filter(asset => 
        asset.name.toLowerCase().includes(query) ||
        asset.type.toLowerCase().includes(query) ||
        asset.category.toLowerCase().includes(query)
      );
    }
    
    // Sort by required rating, then by name
    return [...assets].sort((a, b) => {
      if (a.requiredRating !== b.requiredRating) {
        return a.requiredRating - b.requiredRating;
      }
      return a.name.localeCompare(b.name);
    });
  }, [assetFilter, searchQuery]);

  // Group assets by rating for display
  const assetsByRating = useMemo(() => {
    const groups: Record<number, AssetDefinition[]> = {};
    filteredAssets.forEach(asset => {
      if (!groups[asset.requiredRating]) {
        groups[asset.requiredRating] = [];
      }
      groups[asset.requiredRating].push(asset);
    });
    return groups;
  }, [filteredAssets]);

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    const tags = Object.keys(FACTION_TAG_METADATA) as FactionTag[];
    if (!searchQuery.trim()) return tags;
    
    const query = searchQuery.toLowerCase();
    return tags.filter(tag => 
      tag.toLowerCase().includes(query) ||
      FACTION_TAG_METADATA[tag].description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Goals by category
  const goalCategories = useMemo(() => getGoalsByCategory(), []);

  const getCategoryIcon = (category: AssetCategory) => {
    switch (category) {
      case 'Force': return '⚔️';
      case 'Cunning': return '🎭';
      case 'Wealth': return '💰';
    }
  };

  const getCategoryColor = (category: AssetCategory) => {
    switch (category) {
      case 'Force': return 'var(--force-color, #dc2626)';
      case 'Cunning': return 'var(--cunning-color, #9333ea)';
      case 'Wealth': return 'var(--wealth-color, #eab308)';
    }
  };

  const renderAssetCard = (asset: AssetDefinition) => {
    const isSelected = selectedAsset?.id === asset.id;
    const flagDetails = getFlagDetails(asset);
    
    return (
      <button
        key={asset.id}
        type="button"
        className={`encyclopedia-card encyclopedia-card--asset ${isSelected ? 'encyclopedia-card--selected' : ''}`}
        onClick={() => setSelectedAsset(isSelected ? null : asset)}
        style={{ '--category-color': getCategoryColor(asset.category) } as React.CSSProperties}
      >
        <div className="encyclopedia-card__header">
          <span className="encyclopedia-card__icon">{getCategoryIcon(asset.category)}</span>
          <span className="encyclopedia-card__name">{asset.name}</span>
          <span className="encyclopedia-card__rating">Lvl {asset.requiredRating}</span>
        </div>
        <div className="encyclopedia-card__meta">
          <span className="encyclopedia-card__type">{asset.type}</span>
          <span className="encyclopedia-card__cost">{asset.cost} FC</span>
        </div>
        {isSelected && (
          <div className="encyclopedia-card__details">
            <div className="encyclopedia-card__stats">
              <div className="encyclopedia-card__stat">
                <span className="stat-label">HP</span>
                <span className="stat-value">{asset.hp}</span>
              </div>
              <div className="encyclopedia-card__stat">
                <span className="stat-label">Tech Level</span>
                <span className="stat-value">{asset.techLevel === 0 ? 'Any' : `TL${asset.techLevel}`}</span>
              </div>
              {asset.maintenance > 0 && (
                <div className="encyclopedia-card__stat">
                  <span className="stat-label">Maintenance</span>
                  <span className="stat-value">{asset.maintenance} FC/turn</span>
                </div>
              )}
            </div>
            {asset.attack && (
              <div className="encyclopedia-card__attack">
                <span className="attack-label">Attack:</span>
                <span className="attack-value">
                  {asset.attack.attackerAttribute} vs {asset.attack.defenderAttribute}, {asset.attack.damage}
                </span>
              </div>
            )}
            {asset.counterattack && (
              <div className="encyclopedia-card__counter">
                <span className="counter-label">Counter:</span>
                <span className="counter-value">{asset.counterattack.damage}</span>
              </div>
            )}
            {flagDetails.length > 0 && (
              <div className="encyclopedia-card__flags">
                {flagDetails.map((flag) => (
                  <div key={flag.key} className={flag.className}>
                    <span className="flag__label">{flag.label}</span>
                    <p className="flag__description">{flag.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </button>
    );
  };

  const renderTagCard = (tag: FactionTag) => {
    const metadata = FACTION_TAG_METADATA[tag];
    const isSelected = selectedTag === tag;
    
    return (
      <button
        key={tag}
        type="button"
        className={`encyclopedia-card encyclopedia-card--tag ${isSelected ? 'encyclopedia-card--selected' : ''}`}
        onClick={() => setSelectedTag(isSelected ? null : tag)}
      >
        <div className="encyclopedia-card__header">
          <span className="encyclopedia-card__name">{tag}</span>
        </div>
        <p className="encyclopedia-card__description">{metadata.description}</p>
        {isSelected && (
          <div className="encyclopedia-card__details">
            <h4 className="effects-heading">Effects:</h4>
            <ul className="encyclopedia-card__effects">
              {metadata.effects.map((effect, idx) => (
                <li key={idx} className="effect-item">{effect}</li>
              ))}
            </ul>
          </div>
        )}
      </button>
    );
  };

  const renderGoalCard = (goalType: FactionGoalType) => {
    const metadata = GOAL_METADATA[goalType];
    const isSelected = selectedGoal === goalType;
    
    return (
      <button
        key={goalType}
        type="button"
        className={`encyclopedia-card encyclopedia-card--goal ${isSelected ? 'encyclopedia-card--selected' : ''}`}
        onClick={() => setSelectedGoal(isSelected ? null : goalType)}
        style={{ '--goal-color': metadata.color } as React.CSSProperties}
      >
        <div className="encyclopedia-card__header">
          <span className="encyclopedia-card__icon">{metadata.icon}</span>
          <span className="encyclopedia-card__name">{goalType}</span>
        </div>
        {isSelected && (
          <div className="encyclopedia-card__details">
            <p className="encyclopedia-card__tooltip">{metadata.tooltip}</p>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="encyclopedia">
      <header className="encyclopedia__header">
        <div className="encyclopedia__title-area">
          <h1 className="encyclopedia__title">
            <span className="title-icon">📖</span>
            Codex Galactica
          </h1>
          <p className="encyclopedia__subtitle">Faction Operations Reference Manual</p>
        </div>
        
        <div className="encyclopedia__search">
          <input
            type="text"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="encyclopedia__search-input"
          />
          {searchQuery && (
            <button 
              type="button"
              className="encyclopedia__search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <nav className="encyclopedia__nav">
        <button
          type="button"
          className={`encyclopedia__nav-button ${activeSection === 'assets' ? 'encyclopedia__nav-button--active' : ''}`}
          onClick={() => setActiveSection('assets')}
        >
          <span className="nav-icon">🎯</span>
          Assets
          <span className="nav-count">{assetLibrary.length}</span>
        </button>
        <button
          type="button"
          className={`encyclopedia__nav-button ${activeSection === 'tags' ? 'encyclopedia__nav-button--active' : ''}`}
          onClick={() => setActiveSection('tags')}
        >
          <span className="nav-icon">🏷️</span>
          Faction Tags
          <span className="nav-count">{Object.keys(FACTION_TAG_METADATA).length}</span>
        </button>
        <button
          type="button"
          className={`encyclopedia__nav-button ${activeSection === 'goals' ? 'encyclopedia__nav-button--active' : ''}`}
          onClick={() => setActiveSection('goals')}
        >
          <span className="nav-icon">🎯</span>
          Goals
          <span className="nav-count">{Object.keys(GOAL_METADATA).length}</span>
        </button>
      </nav>

      <main className="encyclopedia__content">
        {activeSection === 'assets' && (
          <section className="encyclopedia__section">
            <div className="encyclopedia__filters">
              <button
                type="button"
                className={`filter-button ${assetFilter === 'all' ? 'filter-button--active' : ''}`}
                onClick={() => setAssetFilter('all')}
              >
                All Assets
              </button>
              <button
                type="button"
                className={`filter-button filter-button--force ${assetFilter === 'Force' ? 'filter-button--active' : ''}`}
                onClick={() => setAssetFilter('Force')}
              >
                ⚔️ Force
              </button>
              <button
                type="button"
                className={`filter-button filter-button--cunning ${assetFilter === 'Cunning' ? 'filter-button--active' : ''}`}
                onClick={() => setAssetFilter('Cunning')}
              >
                🎭 Cunning
              </button>
              <button
                type="button"
                className={`filter-button filter-button--wealth ${assetFilter === 'Wealth' ? 'filter-button--active' : ''}`}
                onClick={() => setAssetFilter('Wealth')}
              >
                💰 Wealth
              </button>
            </div>

            <div className="encyclopedia__results-info">
              Showing {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
            </div>

            {Object.entries(assetsByRating).map(([rating, assets]) => (
              <div key={rating} className="encyclopedia__rating-group">
                <h3 className="rating-group__title">
                  <span className="rating-badge">Level {rating}</span>
                  <span className="rating-count">{assets.length} assets</span>
                </h3>
                <div className="encyclopedia__grid">
                  {assets.map(asset => renderAssetCard(asset))}
                </div>
              </div>
            ))}

            {filteredAssets.length === 0 && (
              <div className="encyclopedia__empty">
                <span className="empty-icon">🔍</span>
                <p>No assets found matching your criteria.</p>
              </div>
            )}
          </section>
        )}

        {activeSection === 'tags' && (
          <section className="encyclopedia__section">
            <div className="encyclopedia__results-info">
              Showing {filteredTags.length} faction tag{filteredTags.length !== 1 ? 's' : ''}
            </div>
            <div className="encyclopedia__grid encyclopedia__grid--tags">
              {filteredTags.map(tag => renderTagCard(tag))}
            </div>
            {filteredTags.length === 0 && (
              <div className="encyclopedia__empty">
                <span className="empty-icon">🔍</span>
                <p>No faction tags found matching your search.</p>
              </div>
            )}
          </section>
        )}

        {activeSection === 'goals' && (
          <section className="encyclopedia__section">
            <div className="encyclopedia__goal-categories">
              {Object.entries(goalCategories).map(([category, goals]) => (
                <div key={category} className="goal-category">
                  <h3 className="goal-category__title">{category}</h3>
                  <div className="encyclopedia__grid encyclopedia__grid--goals">
                    {goals.map(goal => renderGoalCard(goal))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="encyclopedia__footer">
        <p className="encyclopedia__footer-text">
          Data sourced from Stars Without Number faction rules
        </p>
      </footer>
    </div>
  );
}

