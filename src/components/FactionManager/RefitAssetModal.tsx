import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store/store';
import type { FactionAsset } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import { getAssetById } from '../../data/assetLibrary';
import type { AssetDefinition } from '../../types/asset';
import { refitAsset } from '../../store/slices/factionsSlice';
import { stageAction, markActionUsed, selectCurrentPhase, selectUsedActionType, selectCurrentTurn } from '../../store/slices/turnSlice';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import { getValidRefitTargets, calculateRefitCost, getRefitSummary } from '../../utils/refitValidation';
import { useSoundEffect } from '../../hooks/useAudio';
import { showNotification } from '../NotificationContainer';
import './RefitAssetModal.css';

interface RefitAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  factionId: string;
  assetId: string;
}

export default function RefitAssetModal({
  isOpen,
  onClose,
  factionId,
  assetId,
}: RefitAssetModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const faction = useSelector((state: RootState) =>
    state.factions.factions.find((f) => f.id === factionId)
  );
  const systems = useSelector((state: RootState) => state.sector.currentSector?.systems || []);
  const currentPhase = useSelector(selectCurrentPhase);
  const usedActionType = useSelector(selectUsedActionType);
  const currentTurn = useSelector(selectCurrentTurn);
  const playSound = useSoundEffect();

  const [selectedTargetId, setSelectedTargetId] = useState<string>('');

  // Find the asset
  const asset = useMemo(() => {
    if (!faction) return null;
    return faction.assets.find((a: FactionAsset) => a.id === assetId) || null;
  }, [faction, assetId]);

  // Get current asset definition
  const currentAssetDef = useMemo(() => {
    if (!asset) return null;
    return getAssetById(asset.definitionId);
  }, [asset]);

  // Get the world where the asset is located
  const assetWorld = useMemo(() => {
    if (!asset) return undefined;
    return systems.find((s: StarSystem) => s.id === asset.location);
  }, [asset, systems]);

  // Get valid refit targets
  const validTargets = useMemo(() => {
    if (!faction || !asset || !assetWorld) return [];
    const worldTechLevel = assetWorld.primaryWorld.techLevel ?? 0;
    return getValidRefitTargets(faction, asset, worldTechLevel);
  }, [faction, asset, assetWorld]);

  // Get selected target definition
  const selectedTargetDef = useMemo(() => {
    if (!selectedTargetId) return null;
    return getAssetById(selectedTargetId);
  }, [selectedTargetId]);

  // Calculate refit cost
  const refitCostInfo = useMemo(() => {
    if (!currentAssetDef || !selectedTargetDef) return null;
    return calculateRefitCost(currentAssetDef, selectedTargetDef);
  }, [currentAssetDef, selectedTargetDef]);

  // Play modal open sound
  useEffect(() => {
    if (isOpen) {
      playSound('ui_modal_open');
      setSelectedTargetId('');
    }
  }, [isOpen, playSound]);

  // Can refit if in Action phase and no other action type used
  const canRefit = currentPhase === 'Action' && (!usedActionType || usedActionType === 'REFIT') && selectedTargetId;

  const handleConfirm = () => {
    if (!faction || !asset || !currentAssetDef || !selectedTargetDef || !refitCostInfo || !canRefit) return;

    // Stage the action
    dispatch(stageAction('REFIT'));

    // Execute the refit
    dispatch(refitAsset({
      factionId,
      assetId,
      newAssetDefinitionId: selectedTargetId,
      cost: refitCostInfo.cost,
      currentTurn,
    }));

    // Mark action as used
    dispatch(markActionUsed('REFIT'));

    // Generate narrative entry
    const getSystemName = (systemId: string): string => {
      const system = systems.find((s: StarSystem) => s.id === systemId);
      return system?.name || 'Unknown System';
    };

    const getSystem = (systemId: string) => systems.find((s: StarSystem) => s.id === systemId);

    const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
    const systemContext = createNarrativeContextFromSystem(assetWorld);

    dispatchNarrativeEntry(dispatch, 'Refit', {
      ...actorContext,
      ...systemContext,
      assetName: currentAssetDef.name,
      targetName: selectedTargetDef.name,
      credits: refitCostInfo.cost,
      result: 'Success',
      relatedEntityIds: [factionId, asset.location].filter(Boolean),
    });

    playSound('ui_confirm');
    showNotification(
      `Refitted ${currentAssetDef.name} to ${selectedTargetDef.name}${refitCostInfo.cost > 0 ? ` for ${refitCostInfo.cost} FacCreds` : ''}`,
      'success'
    );
    onClose();
  };

  if (!isOpen || !asset || !currentAssetDef || !faction) return null;

  return (
    <div className="refit-asset-modal-overlay" onClick={onClose}>
      <div className="refit-asset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="refit-asset-modal-header">
          <h2>Refit Asset</h2>
          <button className="refit-asset-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="refit-asset-modal-content">
          {/* Current Asset Info */}
          <div className="refit-current-asset">
            <h3>Current Asset</h3>
            <div className="refit-asset-card">
              <div className="refit-asset-name">{currentAssetDef.name}</div>
              <div className="refit-asset-details">
                <span className="refit-asset-category">{currentAssetDef.category}</span>
                <span className="refit-asset-cost">Cost: {currentAssetDef.cost} FC</span>
              </div>
              <div className="refit-asset-location">
                Location: {assetWorld?.name || 'Unknown'}
              </div>
            </div>
          </div>

          {/* Target Selection */}
          <div className="refit-target-section">
            <h3>Refit To</h3>
            {validTargets.length === 0 ? (
              <div className="refit-no-targets">
                No valid refit targets available. Targets must be:
                <ul>
                  <li>Same category ({currentAssetDef.category})</li>
                  <li>Within faction's {currentAssetDef.category} rating ({faction.attributes[currentAssetDef.category.toLowerCase() as 'force' | 'cunning' | 'wealth']})</li>
                  <li>Supported by world tech level ({assetWorld?.primaryWorld.techLevel ?? 0})</li>
                  <li>Affordable (upgrade costs paid from {faction.facCreds} FC)</li>
                </ul>
              </div>
            ) : (
              <div className="refit-target-list">
                {validTargets.map((target: AssetDefinition) => {
                  const costInfo = calculateRefitCost(currentAssetDef, target);
                  const isSelected = selectedTargetId === target.id;
                  const isUpgrade = costInfo.cost > 0;
                  const isDowngrade = target.cost < currentAssetDef.cost;

                  return (
                    <div
                      key={target.id}
                      className={`refit-target-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedTargetId(target.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedTargetId(target.id);
                        }
                      }}
                    >
                      <div className="refit-target-header">
                        <span className="refit-target-name">{target.name}</span>
                        {isUpgrade && (
                          <span className="refit-target-badge upgrade">
                            +{costInfo.cost} FC
                          </span>
                        )}
                        {isDowngrade && (
                          <span className="refit-target-badge downgrade">
                            No refund
                          </span>
                        )}
                        {!isUpgrade && !isDowngrade && (
                          <span className="refit-target-badge lateral">
                            Free
                          </span>
                        )}
                      </div>
                      <div className="refit-target-details">
                        <span>Req: {target.requiredRating}</span>
                        <span>HP: {target.hp}</span>
                        <span>Cost: {target.cost} FC</span>
                      </div>
                      {target.attack && (
                        <div className="refit-target-combat">
                          ATK: {target.attack.damage}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cost Summary */}
          {selectedTargetDef && refitCostInfo && (
            <div className="refit-summary">
              <h3>Refit Summary</h3>
              <div className="refit-summary-text">
                {getRefitSummary(currentAssetDef, selectedTargetDef)}
              </div>
              {refitCostInfo.cost > 0 && (
                <div className="refit-cost-breakdown">
                  <div className="refit-cost-row">
                    <span>Current Balance:</span>
                    <span>{faction.facCreds} FC</span>
                  </div>
                  <div className="refit-cost-row refit-cost-deduct">
                    <span>Refit Cost:</span>
                    <span>-{refitCostInfo.cost} FC</span>
                  </div>
                  <div className="refit-cost-row refit-cost-total">
                    <span>After Refit:</span>
                    <span>{faction.facCreds - refitCostInfo.cost} FC</span>
                  </div>
                </div>
              )}
              <div className="refit-warning">
                <strong>Note:</strong> The refitted asset cannot attack, defend, or use abilities until your next turn.
              </div>
            </div>
          )}
        </div>

        <div className="refit-asset-modal-footer">
          {currentPhase !== 'Action' && (
            <div className="refit-phase-warning">
              Can only refit during Action phase. Current: {currentPhase}
            </div>
          )}
          {usedActionType && usedActionType !== 'REFIT' && (
            <div className="refit-phase-warning">
              Already used {usedActionType} action this turn
            </div>
          )}
          <button className="refit-asset-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="refit-asset-modal-confirm"
            onClick={handleConfirm}
            disabled={!canRefit}
          >
            {refitCostInfo && refitCostInfo.cost > 0
              ? `Refit for ${refitCostInfo.cost} FC`
              : 'Refit Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}


