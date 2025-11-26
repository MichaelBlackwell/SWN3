import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import type { AppDispatch } from '../../store/store';
import { getAssetById } from '../../data/assetLibrary';
import {
  calculateAttackOdds,
  calculateExpectedDamage,
  calculateExpectedCounterattackDamage,
  resolveCombat,
  type CombatResult,
} from '../../utils/combatResolver';
import { inflictDamage } from '../../store/slices/factionsSlice';
import { 
  stageAction, 
  markActionUsed, 
  markAssetAttacked,
  selectCurrentPhase, 
  selectUsedActionType, 
  selectCurrentTurn,
  selectAssetsAttackedThisTurn,
} from '../../store/slices/turnSlice';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromTargetFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import type { Faction, FactionAsset } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import { useSoundEffect } from '../../hooks/useAudio';
import { canAssetAct } from '../../utils/assetEligibility';
import CombatAnimation from './CombatAnimation';
import './CombatModal.css';

// Combat flow phases per SWN rules:
// Phase 1: Attacker selects their faction, asset, and target FACTION
// Phase 2: DEFENDER chooses which asset will defend
// Phase 3: Combat preview and resolution
// Phase 4 (conditional): Damage redirect choice if defender has Base of Influence
type CombatPhase = 'attacker-selection' | 'defender-selection' | 'preview' | 'damage-redirect';

interface CombatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: {
    attackerFactionId: string;
    attackerAssetId: string;
    targetFactionId: string;
    targetAssetId: string;
    targetSystemId: string;
  }) => void;
  attackerFactionId?: string; // Optional: pre-select attacking faction
}

export default function CombatModal({
  isOpen,
  onClose,
  onConfirm,
  attackerFactionId,
}: CombatModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const factions = useSelector((state: RootState) => state.factions.factions);
  const systems = useSelector(
    (state: RootState) => state.sector.currentSector?.systems || []
  );
  const currentPhase = useSelector(selectCurrentPhase);
  const usedActionType = useSelector(selectUsedActionType);
  const currentTurn = useSelector(selectCurrentTurn);
  const assetsAttackedThisTurn = useSelector(selectAssetsAttackedThisTurn);
  const playSound = useSoundEffect();

  // Combat flow phase tracking
  // Per SWN rules: "Each attacking asset is matched against a defending asset chosen by the defender"
  const [combatFlowPhase, setCombatFlowPhase] = useState<CombatPhase>('attacker-selection');
  
  const [selectedAttackerFactionId, setSelectedAttackerFactionId] = useState<string>(
    attackerFactionId || ''
  );
  const [selectedAttackerAssetId, setSelectedAttackerAssetId] = useState<string>('');
  const [selectedTargetFactionId, setSelectedTargetFactionId] = useState<string>('');
  // Per SWN rules: Defender chooses which asset defends, not the attacker
  const [selectedDefenderAssetId, setSelectedDefenderAssetId] = useState<string>('');
  const [showAnimation, setShowAnimation] = useState(false);
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [hpBefore, setHpBefore] = useState<{
    attacker: { asset: number; faction: number };
    defender: { asset: number; faction: number };
  } | null>(null);
  // For the Base of Influence damage redirect option
  // Per SWN rules: "If the defender has a Base of Influence on the world, the defender may opt 
  // to let the damage bypass the asset and hit the Base of Influence instead"
  const [showDamageRedirectChoice, setShowDamageRedirectChoice] = useState(false);
  const [_redirectDamageToBase, setRedirectDamageToBase] = useState(false);

  // Play modal open sound when modal opens
  useEffect(() => {
    if (isOpen) {
      playSound('ui_modal_open');
    }
  }, [isOpen, playSound]);

  // Reset selections when modal opens/closes or attacker faction changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedAttackerFactionId(attackerFactionId || '');
      setSelectedAttackerAssetId('');
      setSelectedTargetFactionId('');
      setSelectedDefenderAssetId('');
      setShowAnimation(false);
      setCombatResult(null);
      setHpBefore(null);
      setCombatFlowPhase('attacker-selection');
      setShowDamageRedirectChoice(false);
      setRedirectDamageToBase(false);
    }
  }, [isOpen, attackerFactionId]);

  // Reset dependent selections when attacker faction changes
  useEffect(() => {
    setSelectedAttackerAssetId('');
    setSelectedTargetFactionId('');
    setSelectedDefenderAssetId('');
    setCombatFlowPhase('attacker-selection');
  }, [selectedAttackerFactionId]);

  // Reset target selections when attacker asset changes
  useEffect(() => {
    setSelectedTargetFactionId('');
    setSelectedDefenderAssetId('');
    setCombatFlowPhase('attacker-selection');
  }, [selectedAttackerAssetId]);

  // Reset defender asset when target faction changes
  useEffect(() => {
    setSelectedDefenderAssetId('');
    // If we're in defender selection phase, stay there; otherwise stay in attacker selection
    if (combatFlowPhase !== 'preview') {
      setCombatFlowPhase(selectedTargetFactionId ? 'defender-selection' : 'attacker-selection');
    }
  }, [selectedTargetFactionId]);

  // Get selected attacker faction
  const attackerFaction = useMemo(() => {
    return factions.find((f: Faction) => f.id === selectedAttackerFactionId);
  }, [factions, selectedAttackerFactionId]);

  // Get selected attacker asset
  const attackerAsset = useMemo(() => {
    if (!attackerFaction || !selectedAttackerAssetId) return null;
    return attackerFaction.assets.find((a: FactionAsset) => a.id === selectedAttackerAssetId) || null;
  }, [attackerFaction, selectedAttackerAssetId]);

  // Get attacker asset definition
  const attackerAssetDef = useMemo(() => {
    if (!attackerAsset) return null;
    return getAssetById(attackerAsset.definitionId);
  }, [attackerAsset]);

  // Get available attacking assets (must have attack pattern, be at same location, not newly purchased/refitted, and not already attacked this turn)
  // Per SWN rules: "Each attacking asset can attack only once per turn"
  const availableAttackerAssets = useMemo(() => {
    if (!attackerFaction) return [];
    return attackerFaction.assets.filter((asset: FactionAsset) => {
      const assetDef = getAssetById(asset.definitionId);
      if (!assetDef || assetDef.attack === null) return false; // Must be able to attack
      // Check if asset can act (not newly purchased or refitted)
      if (!canAssetAct(asset, currentTurn)) return false;
      // Check if asset has already attacked this turn
      if (assetsAttackedThisTurn.includes(asset.id)) return false;
      return true;
    });
  }, [attackerFaction, currentTurn, assetsAttackedThisTurn]);

  // Get target system (automatically set to attacker asset's location)
  const targetSystemId = useMemo(() => {
    return attackerAsset?.location || null;
  }, [attackerAsset]);

  const targetSystem = useMemo(() => {
    if (!targetSystemId) return null;
    return systems.find((s: StarSystem) => s.id === targetSystemId) || null;
  }, [systems, targetSystemId]);

  // Get target faction
  const targetFaction = useMemo(() => {
    return factions.find((f: Faction) => f.id === selectedTargetFactionId);
  }, [factions, selectedTargetFactionId]);

  // Get available target factions (must have assets in target system, excluding attacker faction)
  const availableTargetFactions = useMemo(() => {
    if (!targetSystemId) return [];
    return factions.filter((faction: Faction) => {
      if (faction.id === selectedAttackerFactionId) return false; // Can't attack own faction
      // Must have at least one non-stealthed asset in the target system
      return faction.assets.some(
        (asset: FactionAsset) => asset.location === targetSystemId && !asset.stealthed
      );
    });
  }, [factions, targetSystemId, selectedAttackerFactionId]);

  // Get available defender assets (non-stealthed assets in target system for target faction)
  // 
  // IMPORTANT - Multi-Defend Rule Implementation:
  // Per SWN rules: "A defending asset can defend as many times as the defender wishes, 
  // assuming it can survive multiple conflicts."
  // 
  // Unlike attacking assets (which can only attack once per turn), defending assets have 
  // NO restriction on how many times they can be selected to defend. This is intentional:
  // - We do NOT track which assets have defended (unlike assetsAttackedThisTurn for attackers)
  // - We do NOT filter out previously-selected defenders
  // - The only restrictions are: location (same world) and stealth status (non-stealthed)
  // 
  // Note: Defending assets CAN be newly purchased - the turn eligibility rule only prevents 
  // attacking and using abilities, not defending.
  const availableDefenderAssets = useMemo(() => {
    if (!targetFaction || !targetSystemId) return [];
    // Filter only by location and stealth - NO restriction on previous defends
    return targetFaction.assets.filter(
      (asset: FactionAsset) => asset.location === targetSystemId && !asset.stealthed
    );
  }, [targetFaction, targetSystemId]);

  // Get defender asset (chosen by the defending faction)
  const defenderAsset = useMemo(() => {
    if (!targetFaction || !selectedDefenderAssetId) return null;
    return targetFaction.assets.find((a: FactionAsset) => a.id === selectedDefenderAssetId) || null;
  }, [targetFaction, selectedDefenderAssetId]);

  // Get defender asset definition
  const defenderAssetDef = useMemo(() => {
    if (!defenderAsset) return null;
    return getAssetById(defenderAsset.definitionId);
  }, [defenderAsset]);

  // Check if defender has a Base of Influence on the target world (for damage redirect option)
  // Per SWN rules: "If the defender has a Base of Influence on the world, the defender may opt 
  // to let the damage bypass the asset and hit the Base of Influence instead"
  const defenderBaseOfInfluence = useMemo(() => {
    if (!targetFaction || !targetSystemId) return null;
    // Find Base of Influence asset on this world that is NOT the defending asset
    return targetFaction.assets.find((asset: FactionAsset) => {
      if (asset.location !== targetSystemId) return false;
      if (asset.id === selectedDefenderAssetId) return false; // Can't redirect to itself
      const assetDef = getAssetById(asset.definitionId);
      return assetDef?.name === 'Base of Influence';
    }) || null;
  }, [targetFaction, targetSystemId, selectedDefenderAssetId]);

  // Calculate combat odds and expected damage
  const combatPreview = useMemo(() => {
    if (
      !attackerFaction ||
      !attackerAssetDef ||
      !attackerAssetDef.attack ||
      !targetFaction ||
      !defenderAssetDef
    ) {
      return null;
    }

    const attackPattern = attackerAssetDef.attack;
    const counterattackPattern = defenderAssetDef.counterattack;

    // Get attribute values
    const attackerAttributeValue =
      attackPattern.attackerAttribute === 'Force'
        ? attackerFaction.attributes.force
        : attackPattern.attackerAttribute === 'Cunning'
          ? attackerFaction.attributes.cunning
          : attackerFaction.attributes.wealth;

    const defenderAttributeValue =
      attackPattern.defenderAttribute === 'Force'
        ? targetFaction.attributes.force
        : attackPattern.defenderAttribute === 'Cunning'
          ? targetFaction.attributes.cunning
          : targetFaction.attributes.wealth;

    // Calculate odds
    const winChance = calculateAttackOdds(
      attackPattern.attackerAttribute,
      attackerAttributeValue,
      attackPattern.defenderAttribute,
      defenderAttributeValue
    );

    // Calculate expected damage
    const expectedAttackDamage = calculateExpectedDamage(attackPattern.damage);
    const expectedCounterattackDamage = calculateExpectedCounterattackDamage(
      counterattackPattern
    );

    return {
      winChance,
      expectedAttackDamage,
      expectedCounterattackDamage,
      attackerAttribute: attackPattern.attackerAttribute,
      attackerAttributeValue,
      defenderAttribute: attackPattern.defenderAttribute,
      defenderAttributeValue,
    };
  }, [attackerFaction, attackerAssetDef, targetFaction, defenderAssetDef]);

  // Handle proceeding to defender selection phase
  const handleProceedToDefenderSelection = () => {
    if (
      !selectedAttackerFactionId ||
      !selectedAttackerAssetId ||
      !selectedTargetFactionId ||
      !targetSystemId
    ) {
      return;
    }
    setCombatFlowPhase('defender-selection');
  };

  // Handle proceeding to preview phase
  const handleProceedToPreview = () => {
    if (!selectedDefenderAssetId) {
      return;
    }
    setCombatFlowPhase('preview');
  };

  // Handle going back to previous phase
  const handleGoBack = () => {
    if (combatFlowPhase === 'defender-selection') {
      setCombatFlowPhase('attacker-selection');
    } else if (combatFlowPhase === 'preview') {
      setCombatFlowPhase('defender-selection');
    }
  };

  const handleConfirm = () => {
    if (
      !selectedAttackerFactionId ||
      !selectedAttackerAssetId ||
      !selectedTargetFactionId ||
      !selectedDefenderAssetId ||
      !targetSystemId ||
      !attackerFaction ||
      !attackerAsset ||
      !attackerAssetDef ||
      !attackerAssetDef.attack ||
      !targetFaction ||
      !defenderAsset ||
      !defenderAssetDef
    ) {
      return;
    }

    // Validate we're in the Action phase
    if (currentPhase !== 'Action') {
      alert('Combat can only be initiated during the Action phase.');
      return;
    }

    // Stage the Attack action
    dispatch(stageAction('Attack'));

    // Store HP before combat
    const attackerAssetHpBefore = attackerAsset.hp;
    const attackerFactionHpBefore = attackerFaction.attributes.hp;
    const defenderAssetHpBefore = defenderAsset.hp;
    const defenderFactionHpBefore = targetFaction.attributes.hp;

    setHpBefore({
      attacker: { asset: attackerAssetHpBefore, faction: attackerFactionHpBefore },
      defender: { asset: defenderAssetHpBefore, faction: defenderFactionHpBefore },
    });

    // Resolve combat
    const attackPattern = attackerAssetDef.attack;
    const counterattackPattern = defenderAssetDef.counterattack;

    const attackerAttributeValue =
      attackPattern.attackerAttribute === 'Force'
        ? attackerFaction.attributes.force
        : attackPattern.attackerAttribute === 'Cunning'
          ? attackerFaction.attributes.cunning
          : attackerFaction.attributes.wealth;

    const defenderAttributeValue =
      attackPattern.defenderAttribute === 'Force'
        ? targetFaction.attributes.force
        : attackPattern.defenderAttribute === 'Cunning'
          ? targetFaction.attributes.cunning
          : targetFaction.attributes.wealth;

    const result = resolveCombat(
      {
        attackerAttribute: attackPattern.attackerAttribute,
        attackerAttributeValue,
        defenderAttribute: attackPattern.defenderAttribute,
        defenderAttributeValue,
        attackerFaction,
        defenderFaction: targetFaction,
        attackerAssetTechLevel: attackerAssetDef.techLevel,
        defenderAssetTechLevel: defenderAssetDef.techLevel,
        defenderIsOnHomeworld: targetSystemId === targetFaction.homeworld,
        attackerAssetDefinitionId: attackerAssetDef.id,
        defenderAssetDefinitionId: defenderAssetDef.id,
      },
      attackPattern,
      counterattackPattern
    );

    setCombatResult(result);
    setShowAnimation(true);

    // Apply damage after a short delay (will be applied during animation)
    // We'll apply it in the animation's onComplete callback
  };

  const handleAnimationComplete = () => {
    if (!combatResult || !hpBefore) return;

    // Check if defender can redirect damage to Base of Influence
    // Per SWN rules: "If the defender has a Base of Influence on the world, the defender may opt 
    // to let the damage bypass the asset and hit the Base of Influence instead"
    const canRedirectDamage = 
      combatResult.attackDamage > 0 && 
      defenderBaseOfInfluence !== null &&
      defenderAssetDef?.name !== 'Base of Influence'; // Can't redirect FROM a Base to another Base

    if (canRedirectDamage) {
      // Show damage redirect choice
      setShowAnimation(false);
      setShowDamageRedirectChoice(true);
      setCombatFlowPhase('damage-redirect');
      return;
    }

    // No redirect option available, apply damage directly
    applyDamageAndFinish(false);
  };

  // Apply damage to the appropriate target and finish combat
  const applyDamageAndFinish = (redirectToBase: boolean) => {
    if (!combatResult || !hpBefore) return;

    const attackerFactionRef = factions.find((f: Faction) => f.id === selectedAttackerFactionId);
    const targetFactionRef = factions.find((f: Faction) => f.id === selectedTargetFactionId);
    const targetSystemRef = systems.find((s: StarSystem) => s.id === targetSystemId);
    const attackerAssetDefRef = attackerAsset ? getAssetById(attackerAsset.definitionId) : null;
    const defenderAssetDefRef = defenderAsset ? getAssetById(defenderAsset.definitionId) : null;

    // Determine attack result for narrative
    const attackResult = combatResult.rollResult.success
      ? 'Success'
      : combatResult.rollResult.tie
        ? 'Tie'
        : 'Failure';

    // Apply attack damage to defender asset OR Base of Influence
    if (combatResult.attackDamage > 0) {
      if (redirectToBase && defenderBaseOfInfluence) {
        // Redirect damage to Base of Influence
        // Per SWN rules: Damage to Base of Influence also damages faction HP
        dispatch(
          inflictDamage({
            factionId: selectedTargetFactionId,
            assetId: defenderBaseOfInfluence.id,
            damage: combatResult.attackDamage,
            damageToBase: true, // Flag for Base of Influence special handling
            sourceFactionId: selectedAttackerFactionId,
          })
        );
      } else {
        // Apply damage to defending asset
        dispatch(
          inflictDamage({
            factionId: selectedTargetFactionId,
            assetId: selectedDefenderAssetId,
            damage: combatResult.attackDamage,
            sourceFactionId: selectedAttackerFactionId,
          })
        );
      }
    }

    // Apply counterattack damage to attacker asset (if counterattack occurred)
    // Counterattack logic is already handled in resolveCombat - it triggers when:
    // 1. Attack fails (defender wins the roll)
    // 2. Tie occurs (both attack and counterattack succeed)
    if (combatResult.counterattackDamage > 0) {
      dispatch(
        inflictDamage({
          factionId: selectedAttackerFactionId,
          assetId: selectedAttackerAssetId,
          damage: combatResult.counterattackDamage,
          sourceFactionId: selectedTargetFactionId,
        })
      );
    }

    // Generate narrative for the attack
    const getSystemName = (systemId: string): string => {
      const system = systems.find((s: StarSystem) => s.id === systemId);
      return system?.name || 'Unknown System';
    };

    const getSystem = (systemId: string) => systems.find((s: StarSystem) => s.id === systemId);

    const actorContext = createNarrativeContextFromFaction(attackerFactionRef, getSystemName, getSystem);
    const targetContext = createNarrativeContextFromTargetFaction(targetFactionRef, getSystemName, getSystem);
    const systemContext = createNarrativeContextFromSystem(targetSystemRef);

    dispatchNarrativeEntry(dispatch, 'Attack', {
      ...actorContext,
      ...targetContext,
      ...systemContext,
      assetName: attackerAssetDefRef?.name,
      damage: combatResult.attackDamage,
      result: attackResult,
      relatedEntityIds: [
        selectedAttackerFactionId,
        selectedTargetFactionId,
        selectedAttackerAssetId,
        redirectToBase && defenderBaseOfInfluence ? defenderBaseOfInfluence.id : selectedDefenderAssetId,
        targetSystemId || '',
      ].filter(Boolean),
    });

    // If asset/base was destroyed, generate a separate narrative entry
    if (hpBefore && combatResult.attackDamage > 0) {
      if (redirectToBase && defenderBaseOfInfluence) {
        // Check if Base of Influence was destroyed
        if (combatResult.attackDamage >= defenderBaseOfInfluence.hp) {
          dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
            ...targetContext,
            assetName: 'Base of Influence',
            result: 'Success',
            relatedEntityIds: [selectedTargetFactionId, defenderBaseOfInfluence.id].filter(Boolean),
          });
        }
      } else {
        // Check if defending asset was destroyed
        const defenderAssetHPBefore = hpBefore.defender.asset;
        if (combatResult.attackDamage >= defenderAssetHPBefore && defenderAssetDefRef) {
          dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
            ...targetContext,
            assetName: defenderAssetDefRef.name,
            result: 'Success',
            relatedEntityIds: [selectedTargetFactionId, selectedDefenderAssetId].filter(Boolean),
          });
        }
      }
    }
    
    // If counterattack damaged attacker asset and destroyed it
    if (hpBefore && combatResult.counterattackDamage > 0 && attackerAssetDefRef) {
      const attackerAssetHPBefore = hpBefore.attacker.asset;
      if (combatResult.counterattackDamage >= attackerAssetHPBefore) {
        dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
          ...actorContext,
          assetName: attackerAssetDefRef.name,
          result: 'Success',
          relatedEntityIds: [selectedAttackerFactionId, selectedAttackerAssetId].filter(Boolean),
        });
      }
    }
    
    // If faction took damage (from overflow or base damage), generate narrative
    // Note: For Base of Influence, faction damage is handled by the inflictDamage reducer
    if (hpBefore && targetFactionRef && !redirectToBase) {
      const factionHPBefore = hpBefore.defender.faction;
      const factionHPAfter = targetFactionRef.attributes.hp;
      if (factionHPAfter < factionHPBefore) {
        const factionDamage = factionHPBefore - factionHPAfter;
        dispatchNarrativeEntry(dispatch, 'FactionDamaged', {
          ...targetContext,
          damage: factionDamage,
          result: 'Success',
          relatedEntityIds: [selectedTargetFactionId].filter(Boolean),
        });
      }
    }

    // Mark that an Attack action was used (allows more attacks of same type)
    // Per SWN rules: Can only take one ACTION TYPE per turn, but can perform
    // that action type with multiple assets
    dispatch(markActionUsed('Attack'));

    // Mark that this specific asset has attacked this turn
    // Per SWN rules: "Each attacking asset can attack only once per turn"
    dispatch(markAssetAttacked(selectedAttackerAssetId));

    // Call the original onConfirm callback
    onConfirm({
      attackerFactionId: selectedAttackerFactionId,
      attackerAssetId: selectedAttackerAssetId,
      targetFactionId: selectedTargetFactionId,
      targetAssetId: redirectToBase && defenderBaseOfInfluence ? defenderBaseOfInfluence.id : selectedDefenderAssetId,
      targetSystemId: targetSystemId!,
    });

    // Close modal
    setShowAnimation(false);
    setShowDamageRedirectChoice(false);
    onClose();
  };

  // Handle damage redirect choice
  const handleDamageRedirectChoice = (redirect: boolean) => {
    setRedirectDamageToBase(redirect);
    applyDamageAndFinish(redirect);
  };

  // Can proceed to defender selection phase
  const canProceedToDefenderSelection =
    currentPhase === 'Action' &&
    (!usedActionType || usedActionType === 'Attack') &&
    selectedAttackerFactionId &&
    selectedAttackerAssetId &&
    selectedTargetFactionId &&
    targetSystemId;

  // Can proceed to preview phase
  const canProceedToPreview = selectedDefenderAssetId !== '';

  // Can confirm the attack (final phase)
  // Per SWN rules: One action TYPE per turn, but can perform multiple of same type
  const canConfirm =
    currentPhase === 'Action' &&
    (!usedActionType || usedActionType === 'Attack') &&
    selectedAttackerFactionId &&
    selectedAttackerAssetId &&
    selectedTargetFactionId &&
    selectedDefenderAssetId &&
    targetSystemId &&
    combatFlowPhase === 'preview';

  if (!isOpen) return null;

  // Show damage redirect choice dialog
  // Per SWN rules: "If the defender has a Base of Influence on the world, the defender may opt 
  // to let the damage bypass the asset and hit the Base of Influence instead"
  if (showDamageRedirectChoice && combatResult && defenderBaseOfInfluence && defenderAssetDef) {
    return (
      <div className="combat-modal-overlay">
        <div className="combat-modal combat-modal-redirect">
          <div className="combat-modal-header">
            <h2>Redirect Damage?</h2>
          </div>
          <div className="combat-modal-content">
            <div className="combat-form-section">
              <div className="form-hint combat-rule-hint">
                <strong>Per SWN Rules:</strong> The defender may redirect attack damage to their 
                Base of Influence instead of the defending asset.
                <br /><br />
                <strong>Warning:</strong> Damage to a Base of Influence also damages faction HP!
              </div>
              <div className="damage-redirect-info">
                <div className="damage-redirect-row">
                  <span className="damage-label">Attack Damage:</span>
                  <span className="damage-value">{combatResult.attackDamage}</span>
                </div>
                <div className="damage-redirect-row">
                  <span className="damage-label">Defending Asset:</span>
                  <span className="damage-value">{defenderAssetDef.name} (HP: {defenderAsset?.hp}/{defenderAsset?.maxHp})</span>
                </div>
                <div className="damage-redirect-row">
                  <span className="damage-label">Base of Influence:</span>
                  <span className="damage-value">HP: {defenderBaseOfInfluence.hp}/{defenderBaseOfInfluence.maxHp}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="combat-modal-footer damage-redirect-footer">
            <button 
              className="combat-modal-cancel"
              onClick={() => handleDamageRedirectChoice(false)}
            >
              Take Damage to {defenderAssetDef.name}
            </button>
            <button 
              className="combat-modal-confirm combat-redirect-btn"
              onClick={() => handleDamageRedirectChoice(true)}
            >
              Redirect to Base of Influence
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show animation overlay if combat is resolving
  if (
    showAnimation &&
    combatResult &&
    hpBefore &&
    attackerFaction &&
    targetFaction &&
    attackerAssetDef &&
    defenderAssetDef &&
    combatPreview &&
    attackerAsset &&
    defenderAsset
  ) {
    // Calculate HP after damage (for animation display)
    // Note: Actual damage application happens after animation via Redux
    let defenderAssetHpAfter = Math.max(0, hpBefore.defender.asset - combatResult.attackDamage);
    let attackerAssetHpAfter = Math.max(0, hpBefore.attacker.asset - combatResult.counterattackDamage);

    // If asset is destroyed, HP goes to 0 (overflow damage goes to faction HP, but we show asset at 0)
    if (defenderAssetHpAfter <= 0) {
      defenderAssetHpAfter = 0;
    }
    if (attackerAssetHpAfter <= 0) {
      attackerAssetHpAfter = 0;
    }

    return (
      <CombatAnimation
        combatResult={combatResult}
        attackerName={attackerFaction.name}
        defenderName={targetFaction.name}
        attackerAttribute={combatPreview.attackerAttribute}
        attackerAttributeValue={combatPreview.attackerAttributeValue}
        defenderAttribute={combatPreview.defenderAttribute}
        defenderAttributeValue={combatPreview.defenderAttributeValue}
        attackerHpBefore={hpBefore.attacker.asset}
        attackerHpAfter={attackerAssetHpAfter}
        attackerMaxHp={attackerAsset?.maxHp || 1}
        defenderHpBefore={hpBefore.defender.asset}
        defenderHpAfter={defenderAssetHpAfter}
        defenderMaxHp={defenderAsset?.maxHp || 1}
        onComplete={handleAnimationComplete}
      />
    );
  }

  return (
    <div className="combat-modal-overlay" onClick={onClose}>
      <div className="combat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="combat-modal-header">
          <h2>Initiate Combat</h2>
          <button className="combat-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="combat-modal-content">
          {/* Attacker Selection */}
          <div className="combat-form-section">
            <h3>Attacker</h3>
            <div className="form-group">
              <label htmlFor="attacker-faction">Attacking Faction</label>
              <select
                id="attacker-faction"
                value={selectedAttackerFactionId}
                onChange={(e) => setSelectedAttackerFactionId(e.target.value)}
              >
                <option value="">Select faction...</option>
                {factions.map((faction: Faction) => (
                  <option key={faction.id} value={faction.id}>
                    {faction.name}
                  </option>
                ))}
              </select>
            </div>

            {attackerFaction && (
              <div className="form-group">
                <label htmlFor="attacker-asset">Attacking Asset</label>
                <select
                  id="attacker-asset"
                  value={selectedAttackerAssetId}
                  onChange={(e) => setSelectedAttackerAssetId(e.target.value)}
                  disabled={availableAttackerAssets.length === 0}
                >
                  <option value="">
                    {availableAttackerAssets.length === 0
                      ? 'No assets with attack capability'
                      : 'Select asset...'}
                  </option>
                  {availableAttackerAssets.map((asset: FactionAsset) => {
                    const assetDef = getAssetById(asset.definitionId);
                    return (
                      <option key={asset.id} value={asset.id}>
                        {assetDef?.name || asset.definitionId} (HP: {asset.hp}/{asset.maxHp})
                        {asset.stealthed ? ' [Stealthed]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Target Faction Selection (Step 1) */}
          <div className="combat-form-section">
            <h3>Target Faction</h3>
            {attackerAsset && targetSystem ? (
              <>
                <div className="form-group">
                  <label>Target System</label>
                  <div className="form-readonly-value">{targetSystem.name}</div>
                  <div className="form-hint">
                    Attacks can only target assets on the same world as the attacker
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="target-faction">Target Faction</label>
                  <select
                    id="target-faction"
                    value={selectedTargetFactionId}
                    onChange={(e) => setSelectedTargetFactionId(e.target.value)}
                    disabled={availableTargetFactions.length === 0 || combatFlowPhase !== 'attacker-selection'}
                  >
                    <option value="">
                      {availableTargetFactions.length === 0
                        ? 'No enemy factions in system'
                        : 'Select faction...'}
                    </option>
                    {availableTargetFactions.map((faction: Faction) => (
                      <option key={faction.id} value={faction.id}>
                        {faction.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="form-hint">
                Select an attacking asset to see available targets
              </div>
            )}
          </div>

          {/* Defender Selection (Step 2) - Per SWN rules: Defender chooses which asset defends */}
          {(combatFlowPhase === 'defender-selection' || combatFlowPhase === 'preview') && selectedTargetFactionId && (
            <div className="combat-form-section combat-defender-section">
              <h3>Defender's Choice</h3>
              <div className="form-hint combat-rule-hint">
                <strong>Per SWN Rules:</strong> The defending faction chooses which asset will defend against the attack.
                <br />A defending asset can defend multiple times per turn, assuming it survives.
              </div>
              <div className="form-group">
                <label htmlFor="defender-asset">Defending Asset (Defender's Choice)</label>
                <select
                  id="defender-asset"
                  value={selectedDefenderAssetId}
                  onChange={(e) => setSelectedDefenderAssetId(e.target.value)}
                  disabled={availableDefenderAssets.length === 0 || combatFlowPhase === 'preview'}
                >
                  <option value="">
                    {availableDefenderAssets.length === 0
                      ? 'No visible assets to defend'
                      : 'Select defending asset...'}
                  </option>
                  {availableDefenderAssets.map((asset: FactionAsset) => {
                    const assetDef = getAssetById(asset.definitionId);
                    return (
                      <option key={asset.id} value={asset.id}>
                        {assetDef?.name || asset.definitionId} (HP: {asset.hp}/{asset.maxHp})
                      </option>
                    );
                  })}
                </select>
                <div className="form-hint">
                  Only non-stealthed assets can defend. Newly purchased assets CAN defend.
                </div>
              </div>
            </div>
          )}

          {/* Combat Preview - Only shown in preview phase */}
          {combatPreview && combatFlowPhase === 'preview' && (
            <div className="combat-preview-section">
              <h3>Combat Preview</h3>
              <div className="combat-preview-grid">
                <div className="preview-item">
                  <div className="preview-label">Win Chance</div>
                  <div className="preview-value">
                    {(combatPreview.winChance * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="preview-item">
                  <div className="preview-label">Expected Attack Damage</div>
                  <div className="preview-value">
                    {combatPreview.expectedAttackDamage.toFixed(1)}
                  </div>
                </div>
                {combatPreview.expectedCounterattackDamage > 0 && (
                  <div className="preview-item">
                    <div className="preview-label">Expected Counterattack Damage</div>
                    <div className="preview-value">
                      {combatPreview.expectedCounterattackDamage.toFixed(1)}
                    </div>
                  </div>
                )}
                <div className="preview-item">
                  <div className="preview-label">Attack Roll</div>
                  <div className="preview-value">
                    1d10 + {combatPreview.attackerAttribute} ({combatPreview.attackerAttributeValue})
                  </div>
                </div>
                <div className="preview-item">
                  <div className="preview-label">Defense Roll</div>
                  <div className="preview-value">
                    1d10 + {combatPreview.defenderAttribute} ({combatPreview.defenderAttributeValue})
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="combat-modal-footer">
          {currentPhase !== 'Action' && (
            <div className="combat-phase-warning">
              Combat can only be initiated during the Action phase. Current phase: {currentPhase}
            </div>
          )}
          {usedActionType && usedActionType !== 'Attack' && (
            <div className="combat-phase-warning">
              Already used {usedActionType} action this turn (one action type per turn)
            </div>
          )}
          
          {/* Cancel / Back button */}
          {combatFlowPhase === 'attacker-selection' ? (
            <button className="combat-modal-cancel" onClick={onClose}>
              Cancel
            </button>
          ) : (
            <button className="combat-modal-cancel" onClick={handleGoBack}>
              ← Back
            </button>
          )}

          {/* Forward / Confirm button */}
          {combatFlowPhase === 'attacker-selection' && (
            <button
              className="combat-modal-confirm"
              onClick={handleProceedToDefenderSelection}
              disabled={!canProceedToDefenderSelection}
              title={currentPhase !== 'Action' ? 'Combat can only be initiated during the Action phase' : ''}
            >
              Proceed to Defender Selection →
            </button>
          )}
          {combatFlowPhase === 'defender-selection' && (
            <button
              className="combat-modal-confirm"
              onClick={handleProceedToPreview}
              disabled={!canProceedToPreview}
            >
              Preview Combat →
            </button>
          )}
          {combatFlowPhase === 'preview' && (
            <button
              className="combat-modal-confirm"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              Confirm Attack
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

