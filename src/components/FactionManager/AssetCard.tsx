import { useDrag } from 'react-dnd';
import { useDispatch } from 'react-redux';
import type { AssetDefinition } from '../../types/asset';
import { assetHasAbility, getAbilityDescription } from '../../utils/assetAbilities';
import {
  assetHasSpecialFeatures,
  getSpecialFeatureSummary,
  getSpecialFeaturesForDisplay,
} from '../../utils/assetSpecialFeatures';
import './AssetCard.css';
import { tutorialEventOccurred } from '../../store/slices/tutorialSlice';
import KeywordTooltipText, { highlightKeywords } from '../Tutorial/KeywordTooltipText';
import type { CSSProperties } from 'react';

interface AssetCardProps {
  asset: AssetDefinition;
  canAfford: boolean;
  canPurchase: boolean; // Based on rating requirement
  onPurchase?: (assetId: string) => void;
  isDraggable?: boolean;
  factionId?: string | null; // Required for drag payload
}

export default function AssetCard({
  asset,
  canAfford,
  canPurchase,
  onPurchase,
  isDraggable = false,
  factionId = null,
}: AssetCardProps) {
  const dispatch = useDispatch();
  const isDisabled = !canAfford || !canPurchase;
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'ASSET',
    item: {
      assetDefinitionId: asset.id,
      assetName: asset.name,
      cost: asset.cost,
      factionId,
    },
    canDrag: isDraggable && canAfford && canPurchase && factionId !== null,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Force':
        return '#ff6b6b';
      case 'Cunning':
        return '#4ecdc4';
      case 'Wealth':
        return '#fbbf24';
      default:
        return 'var(--accent-primary)';
    }
  };

  const categoryColor = getCategoryColor(asset.category);
  const categoryChipStyle: CSSProperties = {
    color: categoryColor,
    borderColor: categoryColor,
    backgroundColor: `${categoryColor}22`,
  };

  const handleInspect = () => {
    dispatch(tutorialEventOccurred({ eventId: 'assetTutorial.assetInspected' }));
  };

  return (
    <div
      ref={(isDraggable && canAfford && canPurchase && factionId ? drag : undefined) as any}
      className={`asset-card ${isDisabled ? 'disabled' : ''} ${isDraggable ? 'draggable' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ 
        borderLeftColor: categoryColor,
        opacity: isDragging ? 0.5 : 1,
      }}
      onMouseEnter={handleInspect}
      onFocus={handleInspect}
    >
      <div className="asset-card-header">
        <div className="asset-card-heading">
          <h3 className="asset-card-name heading-font">{asset.name}</h3>
          <div className="asset-card-pills">
            <span className="asset-card-chip asset-card-chip--category" style={categoryChipStyle}>
              <KeywordTooltipText as="span" text={asset.category} />
            </span>
            <span className="asset-card-chip asset-card-chip--rating">
              Rating {asset.requiredRating}
            </span>
          </div>
        </div>
        <div className="asset-card-cost">
          <span className="cost-label">Cost:</span>
          <span className={`cost-value ${!canAfford ? 'insufficient' : ''}`}>
            {asset.cost} FacCreds
          </span>
        </div>
      </div>

      <div className="asset-card-stats">
        <div className="stat-row">
          <span className="stat-label">HP:</span>
          <span className="stat-value">{asset.hp}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Type:</span>
          <span className="stat-value">{asset.type}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Tech Level:</span>
          <span className="stat-value">{asset.techLevel}</span>
        </div>
        {asset.maintenance > 0 && (
          <div className="stat-row">
            <span className="stat-label">Maintenance:</span>
            <span className="stat-value">{asset.maintenance}/turn</span>
          </div>
        )}
      </div>

      {asset.attack && (
        <div className="asset-card-attack">
          <div className="stat-label">Attack:</div>
          <div className="attack-details">
            {highlightKeywords(asset.attack.attackerAttribute, `attack-attr-${asset.id}`)} vs.{` `}
            {highlightKeywords(asset.attack.defenderAttribute, `attack-def-${asset.id}`)}, {asset.attack.damage}
          </div>
        </div>
      )}

      {asset.counterattack && (
        <div className="asset-card-counterattack">
          <div className="stat-label">Counterattack:</div>
          <div className="counterattack-details">{asset.counterattack.damage}</div>
        </div>
      )}

      <div className="asset-card-flags">
        {asset.specialFlags.hasAction && (
          <span className="asset-flag" title="Can perform special actions">
            A
          </span>
        )}
        {asset.specialFlags.hasSpecial && (
          <span
            className="asset-flag"
            title={getSpecialFeatureSummary(asset.id) || 'Has special features'}
          >
            S
          </span>
        )}
        {asset.specialFlags.requiresPermission && (
          <span className="asset-flag" title="Requires government permission">
            P
          </span>
        )}
      </div>

      {assetHasSpecialFeatures(asset.id) && (
        <div className="asset-card-special-features">
          <div className="special-features-label">Special Features:</div>
          <div className="special-features-content">
            {getSpecialFeaturesForDisplay(asset.id).map((feature, index) => (
              <div key={index} className="special-feature-item">
                {feature.appliesAtLabel && (
                  <span className="special-feature-timing">{feature.appliesAtLabel}: </span>
                )}
                <span className="special-feature-description">
                  {highlightKeywords(feature.description, `special-${asset.id}-${index}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {assetHasAbility(asset.id) && (
        <div className="asset-card-ability">
          <div className="ability-label">Special Action:</div>
          <div className="ability-description">
            {highlightKeywords(getAbilityDescription(asset.id), `ability-${asset.id}`)}
          </div>
        </div>
      )}

      {!canPurchase && (
        <div className="asset-card-warning">
          Requires{' '}
          {highlightKeywords(asset.category, `asset-warning-${asset.id}`)} rating {asset.requiredRating}
        </div>
      )}

      {!canAfford && (
        <div className="asset-card-warning">Insufficient FacCreds</div>
      )}

      {onPurchase && canPurchase && canAfford && (
        <button
          className="asset-card-purchase-btn"
          onClick={() => onPurchase(asset.id)}
          disabled={isDisabled}
        >
          Purchase
        </button>
      )}
    </div>
  );
}

