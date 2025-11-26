import { useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store/store';
import type { StarSystem } from '../../types/sector';
import { startSeizePlanetCampaign, completeSeizePlanetCampaign, cancelSeizePlanetCampaign } from '../../store/slices/factionsSlice';
import { stageAction, markActionUsed, selectCurrentPhase, selectUsedActionType, selectCurrentTurn } from '../../store/slices/turnSlice';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import {
  validateSeizePlanetStart,
  getSeizePlanetStatus,
  getEnemyUnstealthedAssets,
  getFactionUnstealthedAssets,
} from '../../utils/seizePlanetValidation';
import { getAssetById } from '../../data/assetLibrary';
import { useSoundEffect } from '../../hooks/useAudio';
import { showNotification } from '../NotificationContainer';
import './SeizePlanetModal.css';

interface SeizePlanetModalProps {
  isOpen: boolean;
  onClose: () => void;
  factionId: string;
  systemId: string;
}

export default function SeizePlanetModal({
  isOpen,
  onClose,
  factionId,
  systemId,
}: SeizePlanetModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const faction = useSelector((state: RootState) =>
    state.factions.factions.find((f) => f.id === factionId)
  );
  const allFactions = useSelector((state: RootState) => state.factions.factions);
  const systems = useSelector((state: RootState) => state.sector.currentSector?.systems || []);
  const currentPhase = useSelector(selectCurrentPhase);
  const usedActionType = useSelector(selectUsedActionType);
  const currentTurn = useSelector(selectCurrentTurn);
  const playSound = useSoundEffect();

  // Get target system
  const targetSystem = useMemo(() => {
    return systems.find((s: StarSystem) => s.id === systemId);
  }, [systems, systemId]);

  // Get enemy assets on the planet
  const enemyAssets = useMemo(() => {
    if (!faction) return [];
    return getEnemyUnstealthedAssets(systemId, factionId, allFactions);
  }, [faction, systemId, factionId, allFactions]);

  // Get faction's assets on the planet
  const factionAssets = useMemo(() => {
    if (!faction) return [];
    return getFactionUnstealthedAssets(faction, systemId);
  }, [faction, systemId]);

  // Get seizure status
  const seizureStatus = useMemo(() => {
    if (!faction) return null;
    return getSeizePlanetStatus(faction, systemId, allFactions);
  }, [faction, systemId, allFactions]);

  // Check if faction is already in a campaign on this planet
  const isInCampaign = faction?.seizePlanetCampaign?.targetSystemId === systemId;

  // Validate if we can start a new campaign
  const validation = useMemo(() => {
    if (!faction) return { valid: false, reason: 'Faction not found' };
    return validateSeizePlanetStart(faction, systemId, allFactions, systems);
  }, [faction, systemId, allFactions, systems]);

  // Play modal open sound
  useEffect(() => {
    if (isOpen) {
      playSound('ui_modal_open');
    }
  }, [isOpen, playSound]);

  // Can start seizure if in Action phase and not already in a campaign elsewhere
  const canStartSeizure =
    currentPhase === 'Action' &&
    (!usedActionType || usedActionType === 'SEIZE_PLANET') &&
    validation.valid &&
    !isInCampaign;

  // Can complete seizure if in holding phase with 3+ turns and no enemies
  const canComplete = seizureStatus?.canComplete ?? false;

  const handleStartSeizure = () => {
    if (!faction || !targetSystem || !canStartSeizure) return;

    // Stage the action
    dispatch(stageAction('SEIZE_PLANET'));

    // Check if we should skip to holding phase (no enemies)
    const skipClearing = enemyAssets.length === 0;

    // Start the campaign
    dispatch(startSeizePlanetCampaign({
      factionId,
      targetSystemId: systemId,
      currentTurn,
      skipClearing,
    }));

    // Mark action as used
    dispatch(markActionUsed('SEIZE_PLANET'));

    // Generate narrative entry
    const getSystemName = (sysId: string): string => {
      const system = systems.find((s: StarSystem) => s.id === sysId);
      return system?.name || 'Unknown System';
    };

    const getSystem = (sysId: string) => systems.find((s: StarSystem) => s.id === sysId);

    const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
    const systemContext = createNarrativeContextFromSystem(targetSystem);

    dispatchNarrativeEntry(dispatch, 'SeizePlanet', {
      ...actorContext,
      ...systemContext,
      phase: skipClearing ? 'holding' : 'clearing',
      enemyAssetCount: enemyAssets.length,
      result: 'Success',
      relatedEntityIds: [factionId, systemId].filter(Boolean),
    });

    playSound('ui_confirm');
    
    if (skipClearing) {
      showNotification(
        `Planet seizure campaign started on ${targetSystem.name}. No enemy assets - now holding. Hold for 3 turns to complete.`,
        'success'
      );
    } else {
      showNotification(
        `Planet seizure campaign started on ${targetSystem.name}. Clear ${enemyAssets.length} enemy asset${enemyAssets.length !== 1 ? 's' : ''} to proceed.`,
        'success'
      );
    }
    onClose();
  };

  const handleComplete = () => {
    if (!faction || !canComplete) return;

    // Complete the campaign
    dispatch(completeSeizePlanetCampaign({
      factionId,
      targetSystemId: systemId,
    }));

    // Generate narrative entry
    const getSystemName = (sysId: string): string => {
      const system = systems.find((s: StarSystem) => s.id === sysId);
      return system?.name || 'Unknown System';
    };

    const getSystem = (sysId: string) => systems.find((s: StarSystem) => s.id === sysId);

    const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
    const systemContext = createNarrativeContextFromSystem(targetSystem);

    dispatchNarrativeEntry(dispatch, 'SeizePlanetComplete', {
      ...actorContext,
      ...systemContext,
      result: 'Success',
      relatedEntityIds: [factionId, systemId].filter(Boolean),
    });

    playSound('ui_confirm');
    showNotification(
      `${faction.name} has seized control of ${targetSystem?.name}! Planetary Government tag granted.`,
      'success'
    );
    onClose();
  };

  const handleAbandon = () => {
    if (!faction || !isInCampaign) return;

    dispatch(cancelSeizePlanetCampaign({ factionId }));

    playSound('ui_cancel');
    showNotification(`Seizure campaign on ${targetSystem?.name} abandoned.`, 'info');
    onClose();
  };

  if (!isOpen || !faction || !targetSystem) return null;

  return (
    <div className="seize-planet-modal-overlay" onClick={onClose}>
      <div className="seize-planet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="seize-planet-modal-header">
          <h2>Seize Planet</h2>
          <button className="seize-planet-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="seize-planet-modal-content">
          {/* Target Planet Info */}
          <div className="seize-target-info">
            <h3>Target: {targetSystem.name}</h3>
            <div className="seize-planet-stats">
              <div className="seize-stat">
                <span className="seize-stat-label">Your Assets:</span>
                <span className="seize-stat-value">{factionAssets.length}</span>
              </div>
              <div className="seize-stat">
                <span className="seize-stat-label">Enemy Assets:</span>
                <span className="seize-stat-value enemy">{enemyAssets.length}</span>
              </div>
            </div>
          </div>

          {/* Campaign Status */}
          {isInCampaign && seizureStatus && (
            <div className="seize-campaign-status">
              <h3>Campaign Status</h3>
              <div className={`seize-phase-badge ${seizureStatus.phase}`}>
                {seizureStatus.phase === 'clearing' ? '⚔️ Clearing Phase' : '🏰 Holding Phase'}
              </div>
              {seizureStatus.phase === 'holding' && (
                <div className="seize-holding-progress">
                  <div className="seize-progress-bar">
                    <div
                      className="seize-progress-fill"
                      style={{ width: `${(seizureStatus.turnsHeld / 3) * 100}%` }}
                    />
                  </div>
                  <span className="seize-progress-text">
                    {seizureStatus.turnsHeld} / 3 turns held
                  </span>
                </div>
              )}
              {seizureStatus.phase === 'clearing' && enemyAssets.length > 0 && (
                <div className="seize-clearing-info">
                  <p>Destroy all enemy assets to advance to holding phase.</p>
                </div>
              )}
            </div>
          )}

          {/* Enemy Assets List */}
          {enemyAssets.length > 0 && (
            <div className="seize-enemy-assets">
              <h3>Enemy Assets to Clear</h3>
              <div className="seize-asset-list">
                {enemyAssets.map(({ asset, factionName }) => {
                  const assetDef = getAssetById(asset.definitionId);
                  return (
                    <div key={asset.id} className="seize-asset-item">
                      <div className="seize-asset-name">{assetDef?.name || 'Unknown'}</div>
                      <div className="seize-asset-faction">{factionName}</div>
                      <div className="seize-asset-hp">HP: {asset.hp}/{asset.maxHp}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Your Assets */}
          {factionAssets.length > 0 && (
            <div className="seize-faction-assets">
              <h3>Your Assets on Planet</h3>
              <div className="seize-asset-list">
                {factionAssets.map((asset) => {
                  const assetDef = getAssetById(asset.definitionId);
                  return (
                    <div key={asset.id} className="seize-asset-item friendly">
                      <div className="seize-asset-name">{assetDef?.name || 'Unknown'}</div>
                      <div className="seize-asset-hp">HP: {asset.hp}/{asset.maxHp}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Instructions/Rules */}
          {!isInCampaign && (
            <div className="seize-instructions">
              <h3>Seizure Rules</h3>
              <ul>
                <li>Destroy all enemy unstealthed assets on the planet</li>
                <li>Hold the planet with at least one unstealthed asset for 3 turns</li>
                <li>Cannot take other actions during the campaign</li>
                <li>Success grants Planetary Government tag</li>
              </ul>
              {!validation.valid && (
                <div className="seize-validation-error">
                  {validation.reason}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="seize-planet-modal-footer">
          {currentPhase !== 'Action' && !isInCampaign && (
            <div className="seize-phase-warning">
              Can only seize during Action phase. Current: {currentPhase}
            </div>
          )}
          
          {isInCampaign ? (
            <>
              <button className="seize-planet-modal-abandon" onClick={handleAbandon}>
                Abandon Seizure
              </button>
              <button
                className="seize-planet-modal-complete"
                onClick={handleComplete}
                disabled={!canComplete}
                title={canComplete ? 'Complete seizure and claim Planetary Government' : 'Must hold for 3 turns with no enemies'}
              >
                Complete Seizure
              </button>
            </>
          ) : (
            <>
              <button className="seize-planet-modal-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="seize-planet-modal-confirm"
                onClick={handleStartSeizure}
                disabled={!canStartSeizure}
              >
                Begin Seizure
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


