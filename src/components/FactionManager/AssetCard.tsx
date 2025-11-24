import { useDrag } from 'react-dnd';
import type { AssetDefinition } from '../../types/asset';
import { assetHasAbility, getAbilityDescription } from '../../utils/assetAbilities';
import {
  assetHasSpecialFeatures,
  getSpecialFeatureSummary,
  getSpecialFeaturesForDisplay,
} from '../../utils/assetSpecialFeatures';
import './AssetCard.css';

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
        return '#ffe66d';
      default:
        return 'var(--accent-primary)';
    }
  };

  const categoryColor = getCategoryColor(asset.category);

  // Get special action description for this asset
  const getSpecialActionDescription = (assetId: string): string => {
    // Map of asset IDs to their special action descriptions
    const actionDescriptions: Record<string, string> = {
      'wealth_3_mercenaries': 'As an action, Mercenaries can move to any world within one hex of their current location.',
      'wealth_1_harvesters': 'As an action, roll 1d6. On 3+, gain 1 FacCred.',
      'wealth_3_postech_industry': 'As an action, roll 1d6. On 1, lose 1 FacCred (asset destroyed if cannot pay). On 2-4, gain 1 FacCred. On 5-6, gain 2 FacCreds.',
      'wealth_6_venture_capital': 'As an action, roll 1d8. On 1, asset is destroyed. On 2-3, gain 1 FacCred. On 4-7, gain 2 FacCreds. On 8, gain 3 FacCreds.',
      'wealth_7_pretech_manufactory': 'As an action, roll 1d8 and gain half that many FacCreds (rounded up).',
      'wealth_5_commodities_broker': 'As an action, roll 1d8. That many FacCreds are subtracted from the cost of your next asset purchase (minimum half price).',
      'wealth_4_monopoly': 'As an action, force one other faction with unstealthed assets on that world to pay you 1 FacCred. If they cannot pay, they lose one asset of their choice.',
      'wealth_5_marketers': 'As an action, test Cunning vs. Wealth against a rival faction\'s asset. If successful, target must pay half the asset\'s purchase cost or it becomes disabled.',
      'force_2_heavy_drop_assets': 'As an action, may move any number of assets on the planet (including itself) to any world within one hex at a cost of 1 FacCred per asset moved.',
      'force_4_beachhead_landers': 'As an action, may move any number of assets on the planet (including itself) to any world within one hex at a cost of 1 FacCred per asset moved.',
      'force_4_extended_theater': 'As an action, any one non-Starship asset (including itself) can be moved between any two worlds within two hexes at a cost of 1 FacCred.',
      'force_7_deep_strike_landers': 'As an action, any one non-Starship asset (including itself) can be moved between any two worlds within three hexes at a cost of 2 FacCreds.',
      'force_5_pretech_logistics': 'As an action, allows buying one Force asset on that world requiring up to tech level 5. Costs half again as many FacCreds (rounded up).',
      'cunning_1_smugglers': 'For 1 FacCred, can transport itself and/or any one Special Forces unit to a planet up to two hexes away.',
      'cunning_3_covert_shipping': 'As an action, any one Special Forces unit can be moved between any worlds within three hexes at a cost of 1 FacCred.',
      'cunning_6_covert_transit_net': 'As an action, any Special Forces assets can be moved between any worlds within three hexes.',
      'wealth_2_freighter_contract': 'As an action, may move any one non-Force asset (including this one) to any world within two hexes at a cost of 1 FacCred.',
      'wealth_4_shipping_combine': 'As an action, may move any number of non-Force assets (including itself) to any world within two hexes at a cost of 1 FacCred per asset.',
      'wealth_5_blockade_runners': 'As an action, can transfer itself or any one Military Unit or Special Forces to a world within three hexes for a cost of 2 FacCreds.',
      'wealth_4_surveyors': 'As an action, can be moved to any world within two hexes. Also allows one additional die to be rolled on Expand Influence actions.',
      'wealth_7_transit_web': 'For 1 FacCred, any number of non-starship Cunning or Wealth assets may be moved between any two worlds within three hexes. This is a free action (does not require an action slot).',
      'force_4_strike_fleet': 'As an action, can move to any world within one hex.',
      'force_5_blockade_fleet': 'As an action, may move itself to a world within one hex.',
      'force_7_space_marines': 'As an action, can move to any world within one hex.',
      'force_8_capital_fleet': 'As an action, may move to any world within three hexes.',
    };
    return actionDescriptions[assetId] || 'This asset has a special ability that can be used during the Action phase.';
  };

  const cardRef = isDraggable && canAfford && canPurchase && factionId ? drag : null;

  return (
    <div
      ref={cardRef}
      className={`asset-card ${isDisabled ? 'disabled' : ''} ${isDraggable ? 'draggable' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ 
        borderLeftColor: categoryColor,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div className="asset-card-header">
        <div>
          <h3 className="asset-card-name">{asset.name}</h3>
          <div className="asset-card-category" style={{ color: categoryColor }}>
            {asset.category} {asset.requiredRating}
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
            {asset.attack.attackerAttribute} vs. {asset.attack.defenderAttribute}
            {', '}
            {asset.attack.damage}
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
                <span className="special-feature-description">{feature.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {assetHasAbility(asset.id) && (
        <div className="asset-card-ability">
          <div className="ability-label">Special Action:</div>
          <div className="ability-description">
            {getSpecialActionDescription(asset.id)}
          </div>
        </div>
      )}

      {!canPurchase && (
        <div className="asset-card-warning">
          Requires {asset.category} rating {asset.requiredRating}
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

