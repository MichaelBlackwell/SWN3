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
import { stageAction, commitAction, selectCurrentPhase } from '../../store/slices/turnSlice';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromTargetFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import CombatAnimation from './CombatAnimation';
import './CombatModal.css';

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

  const [selectedAttackerFactionId, setSelectedAttackerFactionId] = useState<string>(
    attackerFactionId || ''
  );
  const [selectedAttackerAssetId, setSelectedAttackerAssetId] = useState<string>('');
  const [selectedTargetFactionId, setSelectedTargetFactionId] = useState<string>('');
  const [selectedTargetAssetId, setSelectedTargetAssetId] = useState<string>('');
  const [showAnimation, setShowAnimation] = useState(false);
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [hpBefore, setHpBefore] = useState<{
    attacker: { asset: number; faction: number };
    defender: { asset: number; faction: number };
  } | null>(null);

  // Reset selections when modal opens/closes or attacker faction changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedAttackerFactionId(attackerFactionId || '');
      setSelectedAttackerAssetId('');
      setSelectedTargetFactionId('');
      setSelectedTargetAssetId('');
      setShowAnimation(false);
      setCombatResult(null);
      setHpBefore(null);
    }
  }, [isOpen, attackerFactionId]);

  // Reset dependent selections when attacker faction changes
  useEffect(() => {
    setSelectedAttackerAssetId('');
    setSelectedTargetFactionId('');
    setSelectedTargetAssetId('');
  }, [selectedAttackerFactionId]);

  // Reset target selections when attacker asset changes
  useEffect(() => {
    setSelectedTargetFactionId('');
    setSelectedTargetAssetId('');
  }, [selectedAttackerAssetId]);

  // Reset target asset when target faction changes
  useEffect(() => {
    setSelectedTargetAssetId('');
  }, [selectedTargetFactionId]);

  // Get selected attacker faction
  const attackerFaction = useMemo(() => {
    return factions.find((f) => f.id === selectedAttackerFactionId);
  }, [factions, selectedAttackerFactionId]);

  // Get selected attacker asset
  const attackerAsset = useMemo(() => {
    if (!attackerFaction || !selectedAttackerAssetId) return null;
    return attackerFaction.assets.find((a) => a.id === selectedAttackerAssetId) || null;
  }, [attackerFaction, selectedAttackerAssetId]);

  // Get attacker asset definition
  const attackerAssetDef = useMemo(() => {
    if (!attackerAsset) return null;
    return getAssetById(attackerAsset.definitionId);
  }, [attackerAsset]);

  // Get available attacking assets (must have attack pattern and be at same location)
  const availableAttackerAssets = useMemo(() => {
    if (!attackerFaction) return [];
    return attackerFaction.assets.filter((asset) => {
      const assetDef = getAssetById(asset.definitionId);
      return assetDef && assetDef.attack !== null; // Must be able to attack
    });
  }, [attackerFaction]);

  // Get target system (automatically set to attacker asset's location)
  const targetSystemId = useMemo(() => {
    return attackerAsset?.location || null;
  }, [attackerAsset]);

  const targetSystem = useMemo(() => {
    if (!targetSystemId) return null;
    return systems.find((s) => s.id === targetSystemId) || null;
  }, [systems, targetSystemId]);

  // Get target faction
  const targetFaction = useMemo(() => {
    return factions.find((f) => f.id === selectedTargetFactionId);
  }, [factions, selectedTargetFactionId]);

  // Get available target factions (must have assets in target system, excluding attacker faction)
  const availableTargetFactions = useMemo(() => {
    if (!targetSystemId) return [];
    return factions.filter((faction) => {
      if (faction.id === selectedAttackerFactionId) return false; // Can't attack own faction
      // Must have at least one non-stealthed asset in the target system
      return faction.assets.some(
        (asset) => asset.location === targetSystemId && !asset.stealthed
      );
    });
  }, [factions, targetSystemId, selectedAttackerFactionId]);

  // Get available target assets (non-stealthed assets in target system for target faction)
  const availableTargetAssets = useMemo(() => {
    if (!targetFaction || !targetSystemId) return [];
    return targetFaction.assets.filter(
      (asset) => asset.location === targetSystemId && !asset.stealthed
    );
  }, [targetFaction, targetSystemId]);

  // Get target asset
  const targetAsset = useMemo(() => {
    if (!targetFaction || !selectedTargetAssetId) return null;
    return targetFaction.assets.find((a) => a.id === selectedTargetAssetId) || null;
  }, [targetFaction, selectedTargetAssetId]);

  // Get target asset definition
  const targetAssetDef = useMemo(() => {
    if (!targetAsset) return null;
    return getAssetById(targetAsset.definitionId);
  }, [targetAsset]);

  // Calculate combat odds and expected damage
  const combatPreview = useMemo(() => {
    if (
      !attackerFaction ||
      !attackerAssetDef ||
      !attackerAssetDef.attack ||
      !targetFaction ||
      !targetAssetDef
    ) {
      return null;
    }

    const attackPattern = attackerAssetDef.attack;
    const counterattackPattern = targetAssetDef.counterattack;

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
  }, [attackerFaction, attackerAssetDef, targetFaction, targetAssetDef]);

  const handleConfirm = () => {
    if (
      !selectedAttackerFactionId ||
      !selectedAttackerAssetId ||
      !selectedTargetFactionId ||
      !selectedTargetAssetId ||
      !targetSystemId ||
      !attackerFaction ||
      !attackerAsset ||
      !attackerAssetDef ||
      !attackerAssetDef.attack ||
      !targetFaction ||
      !targetAsset ||
      !targetAssetDef
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
    const defenderAssetHpBefore = targetAsset.hp;
    const defenderFactionHpBefore = targetFaction.attributes.hp;

    setHpBefore({
      attacker: { asset: attackerAssetHpBefore, faction: attackerFactionHpBefore },
      defender: { asset: defenderAssetHpBefore, faction: defenderFactionHpBefore },
    });

    // Resolve combat
    const attackPattern = attackerAssetDef.attack;
    const counterattackPattern = targetAssetDef.counterattack;

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

    const attackerFaction = factions.find((f) => f.id === selectedAttackerFactionId);
    const targetFaction = factions.find((f) => f.id === selectedTargetFactionId);
    const targetSystem = systems.find((s) => s.id === targetSystemId);
    const attackerAssetDef = attackerAsset ? getAssetById(attackerAsset.definitionId) : null;
    const targetAssetDef = targetAsset ? getAssetById(targetAsset.definitionId) : null;

    // Determine attack result for narrative
    const attackResult = combatResult.rollResult.success
      ? 'Success'
      : combatResult.rollResult.tie
        ? 'Tie'
        : 'Failure';

    // Apply attack damage to defender asset
    if (combatResult.attackDamage > 0) {
      dispatch(
        inflictDamage({
          factionId: selectedTargetFactionId,
          assetId: selectedTargetAssetId,
          damage: combatResult.attackDamage,
        })
      );
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
        })
      );
    }

    // Generate narrative for the attack
    const getSystemName = (systemId: string): string => {
      const system = systems.find((s) => s.id === systemId);
      return system?.name || 'Unknown System';
    };

    const getSystem = (systemId: string) => systems.find((s) => s.id === systemId);

    const actorContext = createNarrativeContextFromFaction(attackerFaction, getSystemName, getSystem);
    const targetContext = createNarrativeContextFromTargetFaction(targetFaction, getSystemName, getSystem);
    const systemContext = createNarrativeContextFromSystem(targetSystem);

    dispatchNarrativeEntry(dispatch, 'Attack', {
      ...actorContext,
      ...targetContext,
      ...systemContext,
      assetName: attackerAssetDef?.name,
      damage: combatResult.attackDamage,
      result: attackResult,
      relatedEntityIds: [
        selectedAttackerFactionId,
        selectedTargetFactionId,
        selectedAttackerAssetId,
        selectedTargetAssetId,
        targetSystemId || '',
      ].filter(Boolean),
    });

    // If asset was destroyed, generate a separate narrative entry
    // Check if damage would have destroyed the asset (using hpBefore which was captured before damage)
    if (hpBefore && combatResult.attackDamage > 0) {
      const defenderAssetHPBefore = hpBefore.defender.asset;
      if (combatResult.attackDamage >= defenderAssetHPBefore && targetAssetDef) {
        dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
          ...targetContext,
          assetName: targetAssetDef.name,
          result: 'Success',
          relatedEntityIds: [selectedTargetFactionId, selectedTargetAssetId].filter(Boolean),
        });
      }
    }
    
    // If counterattack damaged attacker asset and destroyed it
    if (hpBefore && combatResult.counterattackDamage > 0 && attackerAssetDef) {
      const attackerAssetHPBefore = hpBefore.attacker.asset;
      if (combatResult.counterattackDamage >= attackerAssetHPBefore) {
        dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
          ...actorContext,
          assetName: attackerAssetDef.name,
          result: 'Success',
          relatedEntityIds: [selectedAttackerFactionId, selectedAttackerAssetId].filter(Boolean),
        });
      }
    }
    
    // If faction took damage (from overflow or base damage), generate narrative
    if (hpBefore && targetFaction) {
      const factionHPBefore = hpBefore.defender.faction;
      const factionHPAfter = targetFaction.attributes.hp;
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

    // Commit the action (this advances to News phase)
    dispatch(commitAction());

    // Call the original onConfirm callback
    onConfirm({
      attackerFactionId: selectedAttackerFactionId,
      attackerAssetId: selectedAttackerAssetId,
      targetFactionId: selectedTargetFactionId,
      targetAssetId: selectedTargetAssetId,
      targetSystemId: targetSystemId!,
    });

    // Close modal
    setShowAnimation(false);
    onClose();
  };

  const canConfirm =
    currentPhase === 'Action' &&
    selectedAttackerFactionId &&
    selectedAttackerAssetId &&
    selectedTargetFactionId &&
    selectedTargetAssetId &&
    targetSystemId;

  if (!isOpen) return null;

  // Show animation overlay if combat is resolving
  if (
    showAnimation &&
    combatResult &&
    hpBefore &&
    attackerFaction &&
    targetFaction &&
    attackerAssetDef &&
    targetAssetDef &&
    combatPreview &&
    attackerAsset &&
    targetAsset
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
        defenderMaxHp={targetAsset?.maxHp || 1}
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
                {factions.map((faction) => (
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
                  {availableAttackerAssets.map((asset) => {
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

          {/* Target Selection */}
          <div className="combat-form-section">
            <h3>Target</h3>
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
                    disabled={availableTargetFactions.length === 0}
                  >
                    <option value="">
                      {availableTargetFactions.length === 0
                        ? 'No enemy factions in system'
                        : 'Select faction...'}
                    </option>
                    {availableTargetFactions.map((faction) => (
                      <option key={faction.id} value={faction.id}>
                        {faction.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTargetFactionId && (
                  <div className="form-group">
                    <label htmlFor="target-asset">Target Asset</label>
                    <select
                      id="target-asset"
                      value={selectedTargetAssetId}
                      onChange={(e) => setSelectedTargetAssetId(e.target.value)}
                      disabled={availableTargetAssets.length === 0}
                    >
                      <option value="">
                        {availableTargetAssets.length === 0
                          ? 'No visible assets to target'
                          : 'Select asset...'}
                      </option>
                      {availableTargetAssets.map((asset) => {
                        const assetDef = getAssetById(asset.definitionId);
                        return (
                          <option key={asset.id} value={asset.id}>
                            {assetDef?.name || asset.definitionId} (HP: {asset.hp}/{asset.maxHp})
                          </option>
                        );
                      })}
                    </select>
                    <div className="form-hint">
                      Only non-stealthed assets can be targeted
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="form-hint">
                Select an attacking asset to see available targets
              </div>
            )}
          </div>

          {/* Combat Preview */}
          {combatPreview && (
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
          <button className="combat-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="combat-modal-confirm"
            onClick={handleConfirm}
            disabled={!canConfirm}
            title={currentPhase !== 'Action' ? 'Combat can only be initiated during the Action phase' : ''}
          >
            Confirm Attack
          </button>
        </div>
      </div>
    </div>
  );
}

