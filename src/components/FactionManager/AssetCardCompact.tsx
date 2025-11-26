import type { FactionAsset } from '../../types/faction';
import { getAssetById } from '../../data/assetLibrary';
import KeywordTooltipText from '../Tutorial/KeywordTooltipText';
import './AssetCardCompact.css';
import { getAssetSpecialFeatures } from '../../utils/assetSpecialFeatures';

interface AssetCardCompactProps {
  asset: FactionAsset;
  systemName: string;
  onClick?: () => void;
  onSell?: (assetId: string) => void;
  onRefit?: (assetId: string) => void;
}

export default function AssetCardCompact({ asset, systemName, onClick, onSell, onRefit }: AssetCardCompactProps) {
  const assetDef = getAssetById(asset.definitionId);
  
  if (!assetDef) {
    return null;
  }

  const hpPercentage = (asset.hp / asset.maxHp) * 100;
  const isDamaged = asset.hp < asset.maxHp;
  const isCritical = hpPercentage <= 33;
  const specialFeatures = getAssetSpecialFeatures(assetDef.id);

  return (
    <div 
      className={`asset-card-compact ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Header with Name */}
      <div className="asset-card-compact__header">
        <h4 className="asset-card-compact__name">{assetDef.name}</h4>
        <div className="asset-card-compact__category">
          <KeywordTooltipText as="span" text={assetDef.category} />
        </div>
      </div>

      {/* Location */}
      <div className="asset-card-compact__location">
        <span className="asset-card-compact__location-icon">📍</span>
        <span className="asset-card-compact__location-text">{systemName}</span>
      </div>

      {/* HP Bar */}
      <div className="asset-card-compact__hp-section">
        <div className="asset-card-compact__hp-label">
          <span>HP</span>
          <span className={`asset-card-compact__hp-value ${isDamaged ? (isCritical ? 'critical' : 'damaged') : ''}`}>
            {asset.hp} / {asset.maxHp}
          </span>
        </div>
        <div className="asset-card-compact__hp-bar">
          <div 
            className={`asset-card-compact__hp-fill ${isCritical ? 'critical' : isDamaged ? 'damaged' : 'healthy'}`}
            style={{ width: `${hpPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="asset-card-compact__stats">
        <div className="asset-card-compact__stat">
          <span className="asset-card-compact__stat-label">Req</span>
          <span className="asset-card-compact__stat-value">{assetDef.requiredRating}</span>
        </div>
        {assetDef.attack && (
          <div className="asset-card-compact__stat">
            <span className="asset-card-compact__stat-label">ATK</span>
            <span className="asset-card-compact__stat-value">
              {assetDef.attack.damage}
            </span>
          </div>
        )}
        {assetDef.counterattack && (
          <div className="asset-card-compact__stat">
            <span className="asset-card-compact__stat-label">CTR</span>
            <span className="asset-card-compact__stat-value">
              {assetDef.counterattack.damage}
            </span>
          </div>
        )}
      </div>

      {/* Special Features Badge */}
      {specialFeatures.length > 0 && (
        <div className="asset-card-compact__badge">
          ⚡ {specialFeatures.length} Special
        </div>
      )}

      {/* Action Buttons */}
      {(onSell || onRefit) && (
        <div className="asset-card-compact__actions">
          {onRefit && (
            <button
              className="asset-card-compact__refit-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRefit(asset.id);
              }}
              title="Transform this asset into a different asset of the same category"
            >
              Refit
            </button>
          )}
          {onSell && (
            <button
              className="asset-card-compact__sell-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSell(asset.id);
              }}
              title={`Sell for ${Math.floor(assetDef.cost / 2)} FacCreds`}
            >
              Sell ({Math.floor(assetDef.cost / 2)} FC)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

