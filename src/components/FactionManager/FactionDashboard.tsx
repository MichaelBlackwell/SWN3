import { useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import type { Faction, FactionAsset } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import type { FactionTag } from '../../types/faction';
import AssetList from './AssetList';
import AssetCardCompact from './AssetCardCompact';
import RepairModal from './RepairModal';
import SellAssetModal from './SellAssetModal';
import RefitAssetModal from './RefitAssetModal';
import ChangeHomeworldModal from './ChangeHomeworldModal';
import ExpandInfluenceButton from './ExpandInfluenceButton';
import FactionGoalsTab from './FactionGoalsTab';
import { stageActionWithPayload, cancelMovementMode, selectCanStageAction, selectMovementMode } from '../../store/slices/turnSlice';
import { showNotification } from '../NotificationContainer';
import './FactionDashboard.css';
import { tutorialEventOccurred } from '../../store/slices/tutorialSlice';
import { ASSET_STORE_OPEN_EVENT, type AssetStoreEventDetail } from '../../utils/assetStoreEvents';
import KeywordTooltipText, { highlightKeywords } from '../Tutorial/KeywordTooltipText';
import TagBadge from '../common/TagBadge';
import { FACTION_TAG_METADATA } from '../../data/factionTagMetadata';

interface FactionDashboardProps {
  factionId: string | null;
  onPurchaseAsset?: (assetDefinitionId: string) => void;
}

export interface FactionDashboardRef {
  openAssetStore: () => void;
}

type TabType = 'overview' | 'goals';

const FactionDashboard = forwardRef<FactionDashboardRef, FactionDashboardProps>(({
  factionId,
  onPurchaseAsset,
}, ref) => {
  const [isAssetStoreOpen, setIsAssetStoreOpen] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellAssetId, setSellAssetId] = useState<string | null>(null);
  const [showRefitModal, setShowRefitModal] = useState(false);
  const [refitAssetId, setRefitAssetId] = useState<string | null>(null);
  const [showChangeHomeworldModal, setShowChangeHomeworldModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
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

  useEffect(() => {
    if (faction) {
      dispatch(tutorialEventOccurred({ eventId: 'influenceTutorial.dashboardFocused' }));
    }
  }, [dispatch, faction]);

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

  const handleOpenSellModal = (assetId: string) => {
    setSellAssetId(assetId);
    setShowSellModal(true);
  };

  const handleCloseSellModal = () => {
    setShowSellModal(false);
    setSellAssetId(null);
  };

  const handleOpenRefitModal = (assetId: string) => {
    setRefitAssetId(assetId);
    setShowRefitModal(true);
  };

  const handleCloseRefitModal = () => {
    setShowRefitModal(false);
    setRefitAssetId(null);
  };

  const handleOpenChangeHomeworldModal = () => {
    setShowChangeHomeworldModal(true);
  };

  const handleCloseChangeHomeworldModal = () => {
    setShowChangeHomeworldModal(false);
  };

  const handleOpenAssetStore = useCallback(() => {
    setIsAssetStoreOpen(true);
    dispatch(tutorialEventOccurred({ eventId: 'assetTutorial.openStore' }));
  }, [dispatch]);
  const handleCloseAssetStore = () => setIsAssetStoreOpen(false);

  // Expose openAssetStore method to parent via ref
  useImperativeHandle(ref, () => ({
    openAssetStore: handleOpenAssetStore,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleExternalOpen: EventListener = (event) => {
      const customEvent = event as CustomEvent<AssetStoreEventDetail>;
      const targetFactionId = customEvent.detail?.factionId;

      if (!targetFactionId || targetFactionId === factionId) {
        handleOpenAssetStore();
      }
    };

    window.addEventListener(ASSET_STORE_OPEN_EVENT, handleExternalOpen);
    return () => {
      window.removeEventListener(ASSET_STORE_OPEN_EVENT, handleExternalOpen);
    };
  }, [factionId, handleOpenAssetStore]);

  if (!faction) {
    return (
      <div className="faction-dashboard-empty">
        <p>Select a faction to view its dashboard</p>
      </div>
    );
  }

  return (
    <div className="faction-dashboard">
        {/* Tab Navigation */}
        <div className="faction-dashboard-tabs">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            type="button"
          >
            Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
            type="button"
          >
            Goals & Advancement
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
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
            <h3>Homeworld</h3>
            <div className="dashboard-homeworld">
              <div className="homeworld-name">{getSystemName(faction.homeworld)}</div>
              {faction.homeworldTransition && (
                <div className="homeworld-transition-badge">
                  Relocating ({faction.homeworldTransition.turnsRemaining} turns left)
                </div>
              )}
            </div>
            {canStageAction && factionId && (
              <div className="dashboard-actions">
                <button
                  className="change-homeworld-btn"
                  onClick={handleOpenChangeHomeworldModal}
                  title="Change faction homeworld (requires Base of Influence on destination)"
                  disabled={!!faction.homeworldTransition}
                >
                  {faction.homeworldTransition ? 'Relocating...' : 'Change Homeworld'}
                </button>
              </div>
            )}
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
                <div className="attribute-label">
                  <KeywordTooltipText as="span" text="Force" />
                </div>
                <div className="attribute-value">{faction.attributes.force}</div>
              </div>
              <div className="attribute-item">
                <div className="attribute-label">
                  <KeywordTooltipText as="span" text="Cunning" />
                </div>
                <div className="attribute-value">{faction.attributes.cunning}</div>
              </div>
              <div className="attribute-item">
                <div className="attribute-label">
                  <KeywordTooltipText as="span" text="Wealth" />
                </div>
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
                  <TagBadge
                    key={tag}
                    label={tag}
                    description={FACTION_TAG_METADATA[tag]?.description}
                    effects={FACTION_TAG_METADATA[tag]?.effects}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="dashboard-section dashboard-section--assets">
            <div className="dashboard-section__header">
              <h3>Assets</h3>
              <div className="dashboard-asset-count">
                {faction.assets.length}{' '}
                {highlightKeywords(
                  `asset${faction.assets.length !== 1 ? 's' : ''}`,
                  `asset-count-${faction.id}`,
                )}{' '}
                owned
              </div>
            </div>
            {faction.assets.length > 0 && (
              <div className="dashboard-assets-carousel">
                {faction.assets.map((asset: FactionAsset) => (
                  <AssetCardCompact
                    key={asset.id}
                    asset={asset}
                    systemName={getSystemName(asset.location)}
                    onSell={handleOpenSellModal}
                    onRefit={handleOpenRefitModal}
                  />
                ))}
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

        {movementMode.active && (
          <div className="faction-dashboard-main">
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
          </div>
        )}
      </div>
        )}

        {/* Goals & Advancement Tab */}
        {activeTab === 'goals' && factionId && (
          <div className="faction-dashboard-goals-container">
            <FactionGoalsTab factionId={factionId} />
          </div>
        )}
      {showRepairModal && factionId && (
        <RepairModal
          factionId={factionId}
          onClose={() => setShowRepairModal(false)}
          onConfirm={handleRepairConfirm}
        />
      )}
      {showSellModal && factionId && sellAssetId && (
        <SellAssetModal
          isOpen={showSellModal}
          onClose={handleCloseSellModal}
          factionId={factionId}
          assetId={sellAssetId}
        />
      )}
      {showRefitModal && factionId && refitAssetId && (
        <RefitAssetModal
          isOpen={showRefitModal}
          onClose={handleCloseRefitModal}
          factionId={factionId}
          assetId={refitAssetId}
        />
      )}
      {showChangeHomeworldModal && factionId && (
        <ChangeHomeworldModal
          isOpen={showChangeHomeworldModal}
          onClose={handleCloseChangeHomeworldModal}
          factionId={factionId}
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
});

FactionDashboard.displayName = 'FactionDashboard';

export default FactionDashboard;

