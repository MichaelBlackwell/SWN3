import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import { getAssetById } from '../../data/assetLibrary';
import type { Faction, FactionAsset } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import type { FactionTag } from '../../types/faction';
import AssetList from './AssetList';
import OwnedAssetItem from './OwnedAssetItem';
import RepairModal from './RepairModal';
import ExpandInfluenceButton from './ExpandInfluenceButton';
import { stageActionWithPayload, cancelMovementMode, selectCanStageAction, selectMovementMode } from '../../store/slices/turnSlice';
import { showNotification } from '../NotificationContainer';
import './FactionDashboard.css';

interface FactionDashboardProps {
  factionId: string | null;
  onPurchaseAsset?: (assetDefinitionId: string) => void;
}

export default function FactionDashboard({
  factionId,
  onPurchaseAsset,
}: FactionDashboardProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAssetStoreOpen, setIsAssetStoreOpen] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const dispatch = useDispatch();
  const factions = useSelector((state: RootState) => state.factions.factions);
  const systems = useSelector(
    (state: RootState) => state.sector.currentSector?.systems || []
  );
  const canStageAction = useSelector(selectCanStageAction);
  const movementMode = useSelector(selectMovementMode);

  const faction = factionId
    ? factions.find((f: Faction) => f.id === factionId)
    : null;

  const unlockedCategoryLabels = faction
    ? [
        faction.attributes.force > 0 ? 'Force' : null,
        faction.attributes.cunning > 0 ? 'Cunning' : null,
        faction.attributes.wealth > 0 ? 'Wealth' : null,
      ].filter(Boolean)
    : [];

  const getSystemName = (systemId: string): string => {
    const system = systems.find((s: StarSystem) => s.id === systemId);
    return system?.name || 'Unknown System';
  };

  /*
  const handleStartMovement = (assetId: string) => {
    if (!canStageAction) {
      showNotification('Cannot start movement: not in Action phase or action already staged', 'error');
      return;
    }

    if (!faction || !factionId) {
      showNotification('No faction selected', 'error');
      return;
    }

    // Validate faction has 1 FacCred for movement
    if (faction.facCreds < 1) {
      showNotification('Insufficient FacCreds: Movement costs 1 FacCred', 'error');
      return;
    }

    // Activate movement mode via Redux
    dispatch(startMovementMode({ assetId, factionId }));
    showNotification('Movement mode active: Click a valid destination on the map', 'info');
  };
  */

  const handleCancelMovement = () => {
    dispatch(cancelMovementMode());
  };

  const handleOpenRepairModal = () => {
    if (!canStageAction) {
      showNotification('Cannot repair: not in Action phase or action already staged', 'error');
      return;
    }

    if (!faction || !factionId) {
      showNotification('No faction selected', 'error');
      return;
    }

    setShowRepairModal(true);
  };

  const handleRepairConfirm = (repairs: {
    assetRepairs?: Array<{ assetId: string; hpHealed: number; cost: number }>;
    factionRepair?: { hpHealed: number; cost: number };
  }) => {
    if (!factionId) return;

    // Stage the repair action
    dispatch(stageActionWithPayload({
      type: 'REPAIR',
      payload: {
        factionId,
        ...repairs,
      },
    }));

    setShowRepairModal(false);
    showNotification('Repair action staged. Commit to execute.', 'info');
  };

  const handleOpenAssetStore = () => setIsAssetStoreOpen(true);
  const handleCloseAssetStore = () => setIsAssetStoreOpen(false);

  if (!faction) {
    return (
      <div className="faction-dashboard-empty">
        <p>Select a faction to view its dashboard</p>
      </div>
    );
  }

  return (
    <div className={`faction-dashboard ${isMinimized ? 'minimized' : ''}`}>
      <div 
        className="faction-dashboard-header"
        onClick={() => setIsMinimized(!isMinimized)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsMinimized(!isMinimized);
          }
        }}
        aria-expanded={!isMinimized}
        aria-label={`${isMinimized ? 'Expand' : 'Collapse'} faction dashboard for ${faction.name}`}
      >
        <div className="faction-dashboard-header-text">
          <span>{faction.name}</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>{faction.type}</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>•</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>Homeworld: {getSystemName(faction.homeworld)}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.875rem' }}>{isMinimized ? '▼' : '▲'}</span>
        </div>
      </div>

      {!isMinimized && (
        <div className="faction-dashboard-content">
        <div className="faction-dashboard-sidebar">
          <div className="dashboard-section">
            <h3>Resources</h3>
            <div className="dashboard-resource">
              <div className="resource-label">FacCreds</div>
              <div className="resource-value">{faction.facCreds}</div>
            </div>
          </div>

          <div className="dashboard-section">
            <h3>Attributes</h3>
            <div className="dashboard-attributes">
              <div className="attribute-item">
                <div className="attribute-label">HP</div>
                <div className="attribute-value">
                  {faction.attributes.hp} / {faction.attributes.maxHp}
                </div>
              </div>
              <div className="attribute-item">
                <div className="attribute-label">Force</div>
                <div className="attribute-value">{faction.attributes.force}</div>
              </div>
              <div className="attribute-item">
                <div className="attribute-label">Cunning</div>
                <div className="attribute-value">{faction.attributes.cunning}</div>
              </div>
              <div className="attribute-item">
                <div className="attribute-label">Wealth</div>
                <div className="attribute-value">{faction.attributes.wealth}</div>
              </div>
            </div>
            {(faction.attributes.hp < faction.attributes.maxHp ||
              faction.assets.some((asset: FactionAsset) => asset.hp < asset.maxHp)) && (
              <div className="dashboard-actions">
                <button
                  className="repair-btn"
                  onClick={handleOpenRepairModal}
                  title="Repair damaged assets and faction HP"
                >
                  Repair
                </button>
              </div>
            )}
          </div>

          {faction.goal && (
            <div className="dashboard-section">
              <h3>Goal</h3>
              <div className="dashboard-goal">{faction.goal.type}</div>
            </div>
          )}

          {faction.tags.length > 0 && (
            <div className="dashboard-section">
              <h3>Tags</h3>
              <div className="dashboard-tags">
                {faction.tags.map((tag: FactionTag) => (
                  <span key={tag} className="dashboard-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="dashboard-section">
            <h3>Assets</h3>
            <div className="dashboard-asset-count">
              {faction.assets.length} asset{faction.assets.length !== 1 ? 's' : ''} owned
            </div>
            {faction.assets.length > 0 ? (
              <div className="dashboard-assets-list">
                {faction.assets.map((asset: FactionAsset) => {
                  const assetDef = getAssetById(asset.definitionId);
                  return (
                    <OwnedAssetItem
                      key={asset.id}
                      asset={asset}
                      assetName={assetDef?.name || asset.definitionId}
                      systemName={getSystemName(asset.location)}
                      factionId={factionId || ''}
                    />
                  );
                })}
              </div>
            ) : (
              <div style={{ 
                padding: 'var(--spacing-3)', 
                textAlign: 'center', 
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}>
                No assets owned
              </div>
            )}
            {canStageAction && factionId && (
              <div className="dashboard-actions" style={{ marginTop: 'var(--spacing-2)', flexShrink: 0 }}>
                <ExpandInfluenceButton
                  factionId={factionId}
                  currentSystemId={null}
                  disabled={!canStageAction}
                />
              </div>
            )}
          </div>
        </div>

        <div className="faction-dashboard-main">
          {movementMode.active && (
            <>
              <div className="movement-mode-indicator">
                <p>Movement Mode Active: Select a destination on the map</p>
                <p className="movement-hint">Valid destinations: Adjacent hexes or route-connected systems</p>
              </div>
              <div className="dashboard-actions">
                <button
                  className="cancel-movement-btn"
                  onClick={handleCancelMovement}
                  title="Cancel movement"
                >
                  Cancel Movement
                </button>
              </div>
            </>
          )}
          <div className="asset-store-preview">
            <div>
              <p className="asset-store-preview__eyebrow">Deployment Hub</p>
              <h3>Asset Store</h3>
              <p className="asset-store-preview__copy">
                Browse 40+ units tailored to your current ratings. Perfect for reinforcing {getSystemName(faction.homeworld)} or staging the next op.
              </p>
              <div className="asset-store-preview__meta">
                <span>FacCreds: <strong>{faction.facCreds}</strong></span>
                <span>
                  Unlocked categories:{' '}
                  <strong>{unlockedCategoryLabels.length ? unlockedCategoryLabels.join(' · ') : 'None yet'}</strong>
                </span>
              </div>
            </div>
            <button
              type="button"
              className="asset-store-preview__btn"
              onClick={handleOpenAssetStore}
            >
              Open Store
            </button>
          </div>
        </div>
      </div>
      )}
      {showRepairModal && factionId && (
        <RepairModal
          factionId={factionId}
          onClose={() => setShowRepairModal(false)}
          onConfirm={handleRepairConfirm}
        />
      )}
      {isAssetStoreOpen && factionId && (
        <div className="asset-store-modal" role="dialog" aria-modal="true" aria-labelledby="asset-store-title">
          <div className="asset-store-modal__overlay" onClick={handleCloseAssetStore} />
          <div className="asset-store-modal__panel">
            <header className="asset-store-modal__header">
              <div>
                <p className="asset-store-modal__eyebrow">Faction Store</p>
                <h3 id="asset-store-title">{faction.name} Procurement</h3>
                <p className="asset-store-modal__subtitle">
                  Available FacCreds: {faction.facCreds} • Homeworld: {getSystemName(faction.homeworld)}
                </p>
              </div>
              <button
                type="button"
                className="asset-store-modal__close"
                onClick={handleCloseAssetStore}
                aria-label="Close asset store"
              >
                ×
              </button>
            </header>
            <div className="asset-store-modal__body">
              <AssetList
                factionId={factionId}
                onPurchase={(assetDefinitionId) => {
                  if (onPurchaseAsset) {
                    onPurchaseAsset(assetDefinitionId);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

