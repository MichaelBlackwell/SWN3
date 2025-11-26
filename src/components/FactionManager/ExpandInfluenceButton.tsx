import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import { markActionUsed, selectCanStageAction } from '../../store/slices/turnSlice';
import { addBaseOfInfluence } from '../../store/slices/factionsSlice';
import { hasAssetsOnWorld, hasBaseOfInfluence } from '../../utils/expandInfluence';
import ExpandInfluenceModal from './ExpandInfluenceModal';
import { showNotification } from '../NotificationContainer';
import { tutorialEventOccurred } from '../../store/slices/tutorialSlice';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';

interface ExpandInfluenceButtonProps {
  factionId: string;
  currentSystemId: string | null; // null means show all valid targets
  disabled?: boolean;
}

export default function ExpandInfluenceButton({
  factionId,
  currentSystemId,
  disabled = false,
}: ExpandInfluenceButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const dispatch = useDispatch();
  const faction = useSelector((state: RootState) =>
    state.factions.factions.find((f: { id: string }) => f.id === factionId)
  );
  const sector = useSelector((state: RootState) => state.sector.currentSector);
  const canStageAction = useSelector(selectCanStageAction);

  if (!faction) {
    return null;
  }

  // Check if this system is a valid target (if a specific system is provided)
  const hasAssets = currentSystemId ? hasAssetsOnWorld(faction, currentSystemId) : true;
  const hasBase = currentSystemId ? hasBaseOfInfluence(faction, currentSystemId) : false;
  const isValidTarget = currentSystemId ? (hasAssets && !hasBase) : true; // If no system specified, allow opening modal
  const isDisabled = Boolean(disabled || !canStageAction || (currentSystemId && !isValidTarget));

  const handleClick = () => {
    if (isDisabled) {
      if (currentSystemId) {
        if (!hasAssets) {
          showNotification('You need at least one asset on this world to expand influence', 'error');
        } else if (hasBase) {
          showNotification('You already have a Base of Influence on this world', 'error');
        }
      }
      if (!canStageAction) {
        showNotification('Cannot expand influence: not in Action phase or action already staged', 'error');
      }
      return;
    }

    setShowModal(true);
    dispatch(tutorialEventOccurred({ eventId: 'influenceTutorial.expandModalOpened' }));
  };

  const handleConfirm = (expansion: {
    targetSystemId: string;
    hp: number;
    cost: number;
    rollResult: ReturnType<typeof import('../../utils/expandInfluence').resolveExpandInfluenceRoll>;
  }) => {
    const targetSystem = sector?.systems.find((s) => s.id === expansion.targetSystemId);
    
    // Immediately execute the expand influence action
    dispatch(addBaseOfInfluence({
      factionId,
      systemId: expansion.targetSystemId,
      hp: expansion.hp,
      cost: expansion.cost,
    }));

    // Mark this action type as used this turn
    dispatch(markActionUsed('EXPAND_INFLUENCE'));

    // Generate narrative entry
    if (faction && targetSystem && sector) {
      const getSystemById = (id: string) => sector.systems.find((s) => s.id === id);
      const getSystemNameById = (id: string) => {
        const sys = getSystemById(id);
        return sys ? sys.name : 'Unknown System';
      };

      const actorContext = createNarrativeContextFromFaction(faction, getSystemNameById, getSystemById);
      const systemContext = createNarrativeContextFromSystem(targetSystem);
      
      dispatchNarrativeEntry(dispatch, 'Buy', {
        ...actorContext,
        ...systemContext,
        assetName: 'Base of Influence',
        credits: expansion.cost,
        result: expansion.rollResult.success ? 'Success' : 'Partial',
        relatedEntityIds: [factionId, expansion.targetSystemId].filter(Boolean),
      });
    }

    setShowModal(false);
    
    const systemName = targetSystem?.name || 'Unknown System';
    const message = expansion.rollResult.success
      ? `Successfully expanded to ${systemName}! Established Base of Influence with ${expansion.hp} HP.`
      : `Expanded to ${systemName} but contested! ${expansion.rollResult.opposingRolls.filter((r) => r.canAttack).map((r) => r.factionName).join(', ')} may attack the new base.`;
    
    showNotification(message, expansion.rollResult.success ? 'success' : 'warning');
  };

  return (
    <>
      <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #444' }}>
        <button
          className="expand-influence-btn"
          onClick={handleClick}
          disabled={isDisabled}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isDisabled ? '#555' : '#4a9eff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.5 : 1,
          }}
          title={
            currentSystemId
              ? !hasAssets
                ? 'You need at least one asset on this world to expand influence'
                : hasBase
                  ? 'You already have a Base of Influence on this world'
                  : 'Establish a Base of Influence on this world'
              : 'Expand influence to establish Bases of Influence on worlds'
          }
        >
          Expand Influence
        </button>
      </div>
      {showModal && (
        <ExpandInfluenceModal
          factionId={factionId}
          currentSystemId={currentSystemId}
          onClose={() => setShowModal(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}

