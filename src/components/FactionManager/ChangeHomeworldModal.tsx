import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store/store';
import type { StarSystem } from '../../types/sector';
import { startHomeworldTransition } from '../../store/slices/factionsSlice';
import { stageAction, markActionUsed, selectCurrentPhase, selectUsedActionType, selectCurrentTurn } from '../../store/slices/turnSlice';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import {
  getValidHomeworldDestinations,
  calculateHomeworldChangeCost,
  validateHomeworldChange,
} from '../../utils/changeHomeworldValidation';
import { useSoundEffect } from '../../hooks/useAudio';
import { showNotification } from '../NotificationContainer';
import './ChangeHomeworldModal.css';

interface ChangeHomeworldModalProps {
  isOpen: boolean;
  onClose: () => void;
  factionId: string;
}

export default function ChangeHomeworldModal({
  isOpen,
  onClose,
  factionId,
}: ChangeHomeworldModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const faction = useSelector((state: RootState) =>
    state.factions.factions.find((f) => f.id === factionId)
  );
  const systems = useSelector((state: RootState) => state.sector.currentSector?.systems || []);
  const currentPhase = useSelector(selectCurrentPhase);
  const usedActionType = useSelector(selectUsedActionType);
  const currentTurn = useSelector(selectCurrentTurn);
  const playSound = useSoundEffect();

  const [selectedSystemId, setSelectedSystemId] = useState<string>('');

  // Get current homeworld
  const currentHomeworld = useMemo(() => {
    if (!faction) return null;
    return systems.find((s: StarSystem) => s.id === faction.homeworld);
  }, [faction, systems]);

  // Get valid destination systems
  const validDestinations = useMemo(() => {
    if (!faction) return [];
    return getValidHomeworldDestinations(faction, systems);
  }, [faction, systems]);

  // Get selected system
  const selectedSystem = useMemo(() => {
    if (!selectedSystemId) return null;
    return systems.find((s: StarSystem) => s.id === selectedSystemId);
  }, [selectedSystemId, systems]);

  // Calculate cost for the selected destination
  const transitionCost = useMemo(() => {
    if (!currentHomeworld || !selectedSystem) return null;
    return calculateHomeworldChangeCost(currentHomeworld, selectedSystem);
  }, [currentHomeworld, selectedSystem]);

  // Play modal open sound
  useEffect(() => {
    if (isOpen) {
      playSound('ui_modal_open');
      setSelectedSystemId('');
    }
  }, [isOpen, playSound]);

  // Check if faction has Deep Rooted tag
  const hasDeepRooted = faction?.tags.includes('Deep Rooted') ?? false;

  // Check if faction is already in transition
  const isInTransition = !!faction?.homeworldTransition;

  // Can change homeworld if in Action phase and no other action type used
  const canChangeHomeworld =
    currentPhase === 'Action' &&
    (!usedActionType || usedActionType === 'CHANGE_HOMEWORLD') &&
    selectedSystemId &&
    !isInTransition;

  const handleConfirm = () => {
    if (!faction || !selectedSystem || !currentHomeworld || !transitionCost || !canChangeHomeworld) return;

    // Validate the change
    const validation = validateHomeworldChange(faction, selectedSystemId, systems);
    if (!validation.valid) {
      showNotification(validation.reason || 'Cannot change homeworld', 'error');
      return;
    }

    // Stage the action
    dispatch(stageAction('CHANGE_HOMEWORLD'));

    // Start the homeworld transition
    dispatch(startHomeworldTransition({
      factionId,
      targetSystemId: selectedSystemId,
      turnsRequired: transitionCost.turnsRequired,
      currentTurn,
    }));

    // Mark action as used
    dispatch(markActionUsed('CHANGE_HOMEWORLD'));

    // Generate narrative entry
    const getSystemName = (systemId: string): string => {
      const system = systems.find((s: StarSystem) => s.id === systemId);
      return system?.name || 'Unknown System';
    };

    const getSystem = (systemId: string) => systems.find((s: StarSystem) => s.id === systemId);

    const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
    const systemContext = createNarrativeContextFromSystem(selectedSystem);

    dispatchNarrativeEntry(dispatch, 'ChangeHomeworld', {
      ...actorContext,
      ...systemContext,
      oldHomeworldName: currentHomeworld.name,
      newHomeworldName: selectedSystem.name,
      turnsRequired: transitionCost.turnsRequired,
      result: 'Success',
      relatedEntityIds: [factionId, faction.homeworld, selectedSystemId].filter(Boolean),
    });

    playSound('ui_confirm');
    showNotification(
      `Homeworld transition started. Moving to ${selectedSystem.name} (${transitionCost.turnsRequired} turns)`,
      'success'
    );
    onClose();
  };

  if (!isOpen || !faction) return null;

  return (
    <div className="change-homeworld-modal-overlay" onClick={onClose}>
      <div className="change-homeworld-modal" onClick={(e) => e.stopPropagation()}>
        <div className="change-homeworld-modal-header">
          <h2>Change Homeworld</h2>
          <button className="change-homeworld-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="change-homeworld-modal-content">
          {/* Current Status */}
          {isInTransition && faction.homeworldTransition && (
            <div className="homeworld-transition-status">
              <h3>Transition In Progress</h3>
              <p>
                Moving homeworld to{' '}
                <strong>
                  {systems.find((s: StarSystem) => s.id === faction.homeworldTransition?.targetSystemId)?.name || 'Unknown'}
                </strong>
              </p>
              <p className="turns-remaining">
                {faction.homeworldTransition.turnsRemaining} turn{faction.homeworldTransition.turnsRemaining !== 1 ? 's' : ''} remaining
              </p>
            </div>
          )}

          {!isInTransition && (
            <>
              {/* Current Homeworld */}
              <div className="current-homeworld-section">
                <h3>Current Homeworld</h3>
                <div className="homeworld-card">
                  <div className="homeworld-name">{currentHomeworld?.name || 'Unknown'}</div>
                  {hasDeepRooted && (
                    <div className="homeworld-tag-warning">
                      ⚠️ Deep Rooted tag will be lost if homeworld changes
                    </div>
                  )}
                </div>
              </div>

              {/* Destination Selection */}
              <div className="destination-section">
                <h3>Select New Homeworld</h3>
                <p className="destination-hint">
                  Must have a Base of Influence on the destination planet
                </p>
                {validDestinations.length === 0 ? (
                  <div className="no-destinations">
                    No valid destinations available.
                    <br />
                    <small>Establish a Base of Influence on another planet first.</small>
                  </div>
                ) : (
                  <div className="destination-list">
                    {validDestinations.map((system: StarSystem) => {
                      const cost = currentHomeworld
                        ? calculateHomeworldChangeCost(currentHomeworld, system)
                        : null;
                      const isSelected = selectedSystemId === system.id;

                      return (
                        <div
                          key={system.id}
                          className={`destination-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedSystemId(system.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setSelectedSystemId(system.id);
                            }
                          }}
                        >
                          <div className="destination-name">{system.name}</div>
                          <div className="destination-details">
                            {cost && (
                              <>
                                <span className="destination-distance">
                                  {cost.hexDistance} hex{cost.hexDistance !== 1 ? 'es' : ''} away
                                </span>
                                <span className="destination-turns">
                                  {cost.turnsRequired} turn{cost.turnsRequired !== 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cost Summary */}
              {selectedSystem && transitionCost && (
                <div className="transition-summary">
                  <h3>Transition Summary</h3>
                  <div className="summary-details">
                    <div className="summary-row">
                      <span>Distance:</span>
                      <span>{transitionCost.hexDistance} hex{transitionCost.hexDistance !== 1 ? 'es' : ''}</span>
                    </div>
                    <div className="summary-row summary-total">
                      <span>Time Required:</span>
                      <span>{transitionCost.turnsRequired} turn{transitionCost.turnsRequired !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="transition-warning">
                    <strong>Warning:</strong> {faction.name} will be unable to take any other actions during the transition.
                    {hasDeepRooted && (
                      <> The Deep Rooted tag will be permanently lost.</>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="change-homeworld-modal-footer">
          {currentPhase !== 'Action' && !isInTransition && (
            <div className="homeworld-phase-warning">
              Can only change homeworld during Action phase. Current: {currentPhase}
            </div>
          )}
          <button className="change-homeworld-modal-cancel" onClick={onClose}>
            {isInTransition ? 'Close' : 'Cancel'}
          </button>
          {!isInTransition && (
            <button
              className="change-homeworld-modal-confirm"
              onClick={handleConfirm}
              disabled={!canChangeHomeworld}
            >
              Begin Transition
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


