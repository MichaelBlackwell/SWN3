import { useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store/store';
import type { FactionAsset } from '../../types/faction';
import { getAssetById } from '../../data/assetLibrary';
import { removeAsset } from '../../store/slices/factionsSlice';
import { stageAction, markActionUsed, selectCurrentPhase, selectUsedActionType } from '../../store/slices/turnSlice';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import { useSoundEffect } from '../../hooks/useAudio';
import { showNotification } from '../NotificationContainer';
import type { StarSystem } from '../../types/sector';
import './SellAssetModal.css';

interface SellAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  factionId: string;
  assetId: string;
}

export default function SellAssetModal({
  isOpen,
  onClose,
  factionId,
  assetId,
}: SellAssetModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const faction = useSelector((state: RootState) =>
    state.factions.factions.find((f) => f.id === factionId)
  );
  const systems = useSelector((state: RootState) => state.sector.currentSector?.systems || []);
  const currentPhase = useSelector(selectCurrentPhase);
  const usedActionType = useSelector(selectUsedActionType);
  const playSound = useSoundEffect();

  // Find the asset
  const asset = useMemo(() => {
    if (!faction) return null;
    return faction.assets.find((a: FactionAsset) => a.id === assetId) || null;
  }, [faction, assetId]);

  // Get asset definition and calculate refund
  const assetInfo = useMemo(() => {
    if (!asset) return null;
    const assetDef = getAssetById(asset.definitionId);
    if (!assetDef) return null;

    const refundAmount = Math.floor(assetDef.cost / 2);
    const systemName = systems.find((s: StarSystem) => s.id === asset.location)?.name || 'Unknown';

    return {
      name: assetDef.name,
      cost: assetDef.cost,
      refundAmount,
      location: asset.location,
      systemName,
      hp: asset.hp,
      maxHp: asset.maxHp,
      category: assetDef.category,
    };
  }, [asset, systems]);

  // Play modal open sound
  useEffect(() => {
    if (isOpen) {
      playSound('ui_modal_open');
    }
  }, [isOpen, playSound]);

  // Can sell if in Action phase and no other action type used (or same action type)
  const canSell = currentPhase === 'Action' && (!usedActionType || usedActionType === 'SELL');

  const handleConfirm = () => {
    if (!faction || !asset || !assetInfo || !canSell) return;

    // Stage the action
    dispatch(stageAction('SELL'));

    // Execute the sell (remove asset with refund)
    dispatch(removeAsset({
      factionId,
      assetId,
      refund: true,
    }));

    // Mark action as used
    dispatch(markActionUsed('SELL'));

    // Generate narrative entry
    const getSystemName = (systemId: string): string => {
      const system = systems.find((s: StarSystem) => s.id === systemId);
      return system?.name || 'Unknown System';
    };

    const getSystem = (systemId: string) => systems.find((s: StarSystem) => s.id === systemId);
    const system = getSystem(assetInfo.location);

    const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
    const systemContext = createNarrativeContextFromSystem(system);

    dispatchNarrativeEntry(dispatch, 'Sell', {
      ...actorContext,
      ...systemContext,
      assetName: assetInfo.name,
      credits: assetInfo.refundAmount,
      result: 'Success',
      relatedEntityIds: [factionId, assetInfo.location].filter(Boolean),
    });

    playSound('ui_confirm');
    showNotification(`Sold ${assetInfo.name} for ${assetInfo.refundAmount} FacCreds`, 'success');
    onClose();
  };

  if (!isOpen || !asset || !assetInfo || !faction) return null;

  return (
    <div className="sell-asset-modal-overlay" onClick={onClose}>
      <div className="sell-asset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sell-asset-modal-header">
          <h2>Sell Asset</h2>
          <button className="sell-asset-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="sell-asset-modal-content">
          <div className="sell-asset-info">
            <div className="sell-asset-name">{assetInfo.name}</div>
            <div className="sell-asset-category">{assetInfo.category} Asset</div>
            <div className="sell-asset-location">Location: {assetInfo.systemName}</div>
            <div className="sell-asset-hp">
              HP: {assetInfo.hp} / {assetInfo.maxHp}
            </div>
          </div>

          <div className="sell-asset-transaction">
            <div className="sell-transaction-row">
              <span className="sell-transaction-label">Original Cost:</span>
              <span className="sell-transaction-value">{assetInfo.cost} FacCreds</span>
            </div>
            <div className="sell-transaction-row sell-transaction-highlight">
              <span className="sell-transaction-label">Refund (50%):</span>
              <span className="sell-transaction-value sell-refund-amount">
                +{assetInfo.refundAmount} FacCreds
              </span>
            </div>
            <div className="sell-transaction-row">
              <span className="sell-transaction-label">Current Balance:</span>
              <span className="sell-transaction-value">{faction.facCreds} FacCreds</span>
            </div>
            <div className="sell-transaction-row sell-transaction-new-balance">
              <span className="sell-transaction-label">After Sale:</span>
              <span className="sell-transaction-value">
                {faction.facCreds + assetInfo.refundAmount} FacCreds
              </span>
            </div>
          </div>

          <div className="sell-asset-warning">
            <strong>Warning:</strong> This action cannot be undone. The asset will be permanently removed.
          </div>
        </div>

        <div className="sell-asset-modal-footer">
          {!canSell && (
            <div className="sell-phase-warning">
              {currentPhase !== 'Action'
                ? `Can only sell during Action phase. Current: ${currentPhase}`
                : `Already used ${usedActionType} action this turn`}
            </div>
          )}
          <button className="sell-asset-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="sell-asset-modal-confirm"
            onClick={handleConfirm}
            disabled={!canSell}
          >
            Sell for {assetInfo.refundAmount} FC
          </button>
        </div>
      </div>
    </div>
  );
}


