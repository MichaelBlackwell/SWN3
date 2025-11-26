import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import type { Faction } from '../../types/faction';
import type { AssetCategory, AssetDefinition } from '../../types/asset';
import { getAllAssetsForFaction } from '../../data/assetLibrary';
import { addAsset } from '../../store/slices/factionsSlice';
import { getFactionColor } from '../../utils/factionColors';
import { withAlpha } from '../../utils/colorUtils';
import { selectCurrentTurn } from '../../store/slices/turnSlice';
import {
  assetHasSpecialFeatures,
  getSpecialFeaturesForDisplay,
} from '../../utils/assetSpecialFeatures';
import { assetHasAbility, getAbilityDescription } from '../../utils/assetAbilities';
import './AssetStoreModal.css';

interface AssetStoreModalProps {
  faction: Faction;
  systemId: string;
  systemTechLevel: number;
  onClose: () => void;
}

type CategoryFilter = 'all' | AssetCategory;

export default function AssetStoreModal({
  faction,
  systemId,
  systemTechLevel,
  onClose,
}: AssetStoreModalProps) {
  const dispatch = useDispatch();
  const currentTurn = useSelector(selectCurrentTurn);
  const currentPhase = useSelector((state: RootState) => state.turn.phase);
  const latestFaction = useSelector((state: RootState) =>
    state.factions.factions.find((f) => f.id === faction.id),
  );

  // Always use the freshest faction data from the store so FacCreds and assets reflect purchases
  const activeFaction = latestFaction ?? faction;
  
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetDefinition | null>(null);

  const factionColor = getFactionColor(activeFaction.id) || '#4a9eff';

  // Get all assets available to this faction based on their ratings
  const availableAssets = useMemo(() => {
    let assets = getAllAssetsForFaction(
      activeFaction.attributes.force,
      activeFaction.attributes.cunning,
      activeFaction.attributes.wealth,
    );

    // Filter by category if selected
    if (categoryFilter !== 'all') {
      assets = assets.filter(a => a.category === categoryFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      assets = assets.filter(a => 
        a.name.toLowerCase().includes(term) ||
        a.type.toLowerCase().includes(term) ||
        a.category.toLowerCase().includes(term)
      );
    }

    // Sort by category, then by required rating, then by name
    return assets.sort((a, b) => {
      if (a.category !== b.category) {
        const categoryOrder = { Force: 0, Cunning: 1, Wealth: 2 };
        return categoryOrder[a.category] - categoryOrder[b.category];
      }
      if (a.requiredRating !== b.requiredRating) {
        return a.requiredRating - b.requiredRating;
      }
      return a.name.localeCompare(b.name);
    });
  }, [activeFaction.attributes, categoryFilter, searchTerm]);

  const canAfford = (asset: AssetDefinition) => activeFaction.facCreds >= asset.cost;
  
  const meetsTechLevel = (asset: AssetDefinition) => systemTechLevel >= asset.techLevel;

  const canPurchase = (asset: AssetDefinition) => 
    canAfford(asset) && meetsTechLevel(asset) && currentPhase === 'Action';

  const handlePurchase = (asset: AssetDefinition) => {
    if (!canPurchase(asset)) return;

    dispatch(addAsset({
      factionId: activeFaction.id,
      assetDefinitionId: asset.id,
      location: systemId,
      purchasedTurn: currentTurn,
    }));
  };

  const getCategoryColor = (category: AssetCategory) => {
    switch (category) {
      case 'Force': return '#ff6b6b';
      case 'Cunning': return '#4ecdc4';
      case 'Wealth': return '#fbbf24';
    }
  };

  const getCategoryIcon = (category: AssetCategory) => {
    switch (category) {
      case 'Force': return '⚔️';
      case 'Cunning': return '🎭';
      case 'Wealth': return '💰';
    }
  };

  const content = (
    <div className="asset-store-overlay" onClick={onClose}>
      <div 
        className="asset-store-modal" 
        onClick={e => e.stopPropagation()}
        style={{
          '--faction-color': factionColor,
          '--faction-color-dim': withAlpha(factionColor, 0.3),
        } as React.CSSProperties}
      >
        {/* Header */}
        <div className="asset-store-header">
          <div className="asset-store-title">
            <span className="asset-store-icon">🏪</span>
            <div className="asset-store-title-text">
              <h2>Asset Store</h2>
              <span className="asset-store-faction-name">{activeFaction.name}</span>
            </div>
          </div>
          <button className="asset-store-close" onClick={onClose}>×</button>
        </div>

        {/* Faction Stats Bar */}
        <div className="asset-store-stats">
          <div className="asset-store-stat asset-store-stat--credits">
            <span className="stat-icon">💳</span>
            <span className="stat-value">{activeFaction.facCreds}</span>
            <span className="stat-label">FacCreds</span>
          </div>
          <div className="asset-store-stat asset-store-stat--force">
            <span className="stat-icon">⚔️</span>
            <span className="stat-value">{activeFaction.attributes.force}</span>
            <span className="stat-label">Force</span>
          </div>
          <div className="asset-store-stat asset-store-stat--cunning">
            <span className="stat-icon">🎭</span>
            <span className="stat-value">{activeFaction.attributes.cunning}</span>
            <span className="stat-label">Cunning</span>
          </div>
          <div className="asset-store-stat asset-store-stat--wealth">
            <span className="stat-icon">💰</span>
            <span className="stat-value">{activeFaction.attributes.wealth}</span>
            <span className="stat-label">Wealth</span>
          </div>
          <div className="asset-store-stat asset-store-stat--tech">
            <span className="stat-icon">🔬</span>
            <span className="stat-value">TL{systemTechLevel}</span>
            <span className="stat-label">System Tech</span>
          </div>
        </div>

        {currentPhase !== 'Action' && (
          <div className="asset-store-phase-warning">
            ⚠️ Asset purchases can only be made during the Action phase
          </div>
        )}

        {/* Filters */}
        <div className="asset-store-filters">
          <div className="asset-store-search">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="asset-store-category-filters">
            <button
              className={`category-btn ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              All
            </button>
            <button
              className={`category-btn category-btn--force ${categoryFilter === 'Force' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('Force')}
            >
              ⚔️ Force
            </button>
            <button
              className={`category-btn category-btn--cunning ${categoryFilter === 'Cunning' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('Cunning')}
            >
              🎭 Cunning
            </button>
            <button
              className={`category-btn category-btn--wealth ${categoryFilter === 'Wealth' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('Wealth')}
            >
              💰 Wealth
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="asset-store-content">
          {/* Asset Grid */}
          <div className="asset-store-grid">
            {availableAssets.length === 0 ? (
              <div className="asset-store-empty">
                <span className="empty-icon">📭</span>
                <p>No assets match your search criteria</p>
              </div>
            ) : (
              availableAssets.map(asset => {
                const affordable = canAfford(asset);
                const techOk = meetsTechLevel(asset);
                const purchasable = affordable && techOk && currentPhase === 'Action';
                const isSelected = selectedAsset?.id === asset.id;

                return (
                  <div
                    key={asset.id}
                    className={`asset-store-item ${!purchasable ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedAsset(asset)}
                    style={{
                      '--category-color': getCategoryColor(asset.category),
                    } as React.CSSProperties}
                  >
                    <div className="asset-item-header">
                      <span className="asset-item-category">
                        {getCategoryIcon(asset.category)} {asset.category}
                      </span>
                      <span className="asset-item-rating">R{asset.requiredRating}</span>
                    </div>
                    <h4 className="asset-item-name">{asset.name}</h4>
                    <div className="asset-item-type">{asset.type}</div>
                    <div className="asset-item-stats">
                      <span className="asset-item-hp">❤️ {asset.hp}</span>
                      {asset.techLevel > 0 && (
                        <span className={`asset-item-tech ${!techOk ? 'insufficient' : ''}`}>
                          TL{asset.techLevel}
                        </span>
                      )}
                    </div>
                    <div className={`asset-item-cost ${!affordable ? 'insufficient' : ''}`}>
                      {asset.cost} FacCreds
                    </div>
                    {asset.specialFlags.hasAction && <span className="asset-item-flag flag-action">A</span>}
                    {asset.specialFlags.hasSpecial && <span className="asset-item-flag flag-special">S</span>}
                    {asset.specialFlags.requiresPermission && <span className="asset-item-flag flag-permission">P</span>}
                  </div>
                );
              })
            )}
          </div>

          {/* Asset Detail Panel */}
          {selectedAsset && (
            <div className="asset-store-detail">
              <div className="asset-detail-header" style={{ borderColor: getCategoryColor(selectedAsset.category) }}>
                <div className="asset-detail-category" style={{ color: getCategoryColor(selectedAsset.category) }}>
                  {getCategoryIcon(selectedAsset.category)} {selectedAsset.category}
                </div>
                <h3 className="asset-detail-name">{selectedAsset.name}</h3>
                <div className="asset-detail-type">{selectedAsset.type}</div>
              </div>

              <div className="asset-detail-stats-grid">
                <div className="detail-stat">
                  <span className="detail-stat-label">HP</span>
                  <span className="detail-stat-value">{selectedAsset.hp}</span>
                </div>
                <div className="detail-stat">
                  <span className="detail-stat-label">Cost</span>
                  <span className={`detail-stat-value ${!canAfford(selectedAsset) ? 'insufficient' : ''}`}>
                    {selectedAsset.cost}
                  </span>
                </div>
                <div className="detail-stat">
                  <span className="detail-stat-label">Rating</span>
                  <span className="detail-stat-value">{selectedAsset.requiredRating}</span>
                </div>
                <div className="detail-stat">
                  <span className="detail-stat-label">Tech Level</span>
                  <span className={`detail-stat-value ${!meetsTechLevel(selectedAsset) ? 'insufficient' : ''}`}>
                    {selectedAsset.techLevel}
                  </span>
                </div>
                {selectedAsset.maintenance > 0 && (
                  <div className="detail-stat detail-stat--maintenance">
                    <span className="detail-stat-label">Maintenance</span>
                    <span className="detail-stat-value">{selectedAsset.maintenance}/turn</span>
                  </div>
                )}
              </div>

              {selectedAsset.attack && (
                <div className="asset-detail-combat">
                  <div className="combat-section combat-section--attack">
                    <span className="combat-label">⚔️ Attack</span>
                    <span className="combat-value">
                      {selectedAsset.attack.attackerAttribute} vs. {selectedAsset.attack.defenderAttribute}
                    </span>
                    <span className="combat-damage">{selectedAsset.attack.damage}</span>
                  </div>
                </div>
              )}

              {selectedAsset.counterattack && (
                <div className="asset-detail-combat">
                  <div className="combat-section combat-section--counter">
                    <span className="combat-label">🛡️ Counterattack</span>
                    <span className="combat-damage">{selectedAsset.counterattack.damage}</span>
                  </div>
                </div>
              )}

              <div className="asset-detail-flags">
                {selectedAsset.specialFlags.hasAction && (
                  <div className="detail-flag">
                    <span className="flag-badge flag-badge--action">A</span>
                    <span>Can perform special actions</span>
                  </div>
                )}
                {selectedAsset.specialFlags.hasSpecial && (
                  <div className="detail-flag">
                    <span className="flag-badge flag-badge--special">S</span>
                    <span>Has special features</span>
                  </div>
                )}
                {selectedAsset.specialFlags.requiresPermission && (
                  <div className="detail-flag">
                    <span className="flag-badge flag-badge--permission">P</span>
                    <span>Requires government permission</span>
                  </div>
                )}
              </div>

              {assetHasSpecialFeatures(selectedAsset.id) && (
                <div className="asset-detail-special">
                  <h4>Special Features</h4>
                  {getSpecialFeaturesForDisplay(selectedAsset.id).map((feature, index) => (
                    <div key={index} className="special-feature">
                      {feature.appliesAtLabel && (
                        <span className="special-timing">{feature.appliesAtLabel}:</span>
                      )}
                      <span className="special-desc">{feature.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {assetHasAbility(selectedAsset.id) && (
                <div className="asset-detail-ability">
                  <h4>Special Action</h4>
                  <p>{getAbilityDescription(selectedAsset.id)}</p>
                </div>
              )}

              {/* Purchase Warnings */}
              {!meetsTechLevel(selectedAsset) && (
                <div className="asset-detail-warning">
                  ⚠️ Requires Tech Level {selectedAsset.techLevel} (system is TL{systemTechLevel})
                </div>
              )}
              {!canAfford(selectedAsset) && (
                <div className="asset-detail-warning">
                  ⚠️ Insufficient FacCreds (need {selectedAsset.cost}, have {activeFaction.facCreds})
                </div>
              )}

              <button
                className="asset-purchase-btn"
                disabled={!canPurchase(selectedAsset)}
                onClick={() => handlePurchase(selectedAsset)}
              >
                {currentPhase !== 'Action' 
                  ? 'Wait for Action Phase' 
                  : canPurchase(selectedAsset) 
                    ? `Purchase for ${selectedAsset.cost} FacCreds`
                    : 'Cannot Purchase'
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

