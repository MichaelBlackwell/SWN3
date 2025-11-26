import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store/store';
import type { Faction, FactionAsset, FactionTag } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import { getAssetById } from '../../data/assetLibrary';
import { getFactionColor } from '../../utils/factionColors';
import { withAlpha } from '../../utils/colorUtils';
import { FACTION_TAG_METADATA } from '../../data/factionTagMetadata';
import TagBadge from '../common/TagBadge';
import AssetStoreModal from './AssetStoreModal';
import { BASE_OF_INFLUENCE_ID } from '../../utils/expandInfluence';
import { selectCanStageAction, selectMovementMode, stageAction, markActionUsed, stageActionWithPayload, startMovementMode } from '../../store/slices/turnSlice';
import { inflictDamage } from '../../store/slices/factionsSlice';
import { showNotification } from '../NotificationContainer';
import { resolveCombat } from '../../utils/combatResolver';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromTargetFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import {
  assetHasAbility,
  isFreeAction,
  executeAbility,
  getAbilityDescription,
} from '../../utils/assetAbilities';
import { store } from '../../store/store';
import { getSpecialFeatureSummary } from '../../utils/assetSpecialFeatures';
import './SystemAssetCards.css';
import '../Tutorial/KeywordTooltipText.css';

interface AssetWithFaction {
  asset: FactionAsset;
  faction: Faction;
}

export default function SystemAssetCards() {
  const dispatch = useDispatch<AppDispatch>();
  const sector = useSelector((state: RootState) => state.sector.currentSector);
  const selectedSystemId = useSelector((state: RootState) => state.sector.selectedSystemId);
  const factions = useSelector((state: RootState) => state.factions.factions);
  const playerFactionId = useSelector((state: RootState) => state.gameMode.playerFactionId);
  const selectedFactionId = useSelector((state: RootState) => state.factions.selectedFactionId);
  const canStageAction = useSelector(selectCanStageAction);
  const movementMode = useSelector(selectMovementMode);

  // State for asset store modal
  const [assetStoreOpen, setAssetStoreOpen] = useState(false);
  const [selectedFactionForStore, setSelectedFactionForStore] = useState<Faction | null>(null);
  const [overlapMode, setOverlapMode] = useState(false);
  const [attackableAssetIds, setAttackableAssetIds] = useState<string[]>([]);
  const [pendingAttack, setPendingAttack] = useState<{
    factionId: string;
    assetId: string;
    assetName: string;
  } | null>(null);
  const [primedAbility, setPrimedAbility] = useState<{
    factionId: string;
    assetId: string;
    assetName: string;
  } | null>(null);
  const [attackSummary, setAttackSummary] = useState<{
    attackerName: string;
    attackerAssetName: string;
    defenderName: string;
    defenderAssetName: string;
    systemName: string;
    attackDamage: number;
    counterDamage: number;
    outcome: string;
    attackerRoll: number;
    attackerAttribute: string;
    attackerAttributeValue: number;
    attackerTotal: number;
    defenderRoll: number;
    defenderAttribute: string;
    defenderAttributeValue: number;
    defenderTotal: number;
    margin: number;
    damageExpression: string;
    counterExpression?: string | null;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const system = sector?.systems.find((s: StarSystem) => s.id === selectedSystemId);

  // Handler to open asset store for a faction
  const handleHomeworldClick = (faction: Faction) => {
    setSelectedFactionForStore(faction);
    setAssetStoreOpen(true);
  };

  const handleCloseAssetStore = () => {
    setAssetStoreOpen(false);
    setSelectedFactionForStore(null);
  };

  const clearAttackHighlights = useCallback(() => {
    setAttackableAssetIds([]);
    setPendingAttack(null);
  }, []);

  const renderFlagWithTooltip = (
    letter: string,
    description: string,
    modifierClass: string,
    title: string
  ) => (
    <span
      className={`system-asset-card__flag ${modifierClass} keyword-tooltip keyword-tooltip--asset`}
      tabIndex={0}
      role="button"
      aria-label={`${title}: ${description}`}
    >
      <span className="keyword-tooltip__label">{letter}</span>
      <span className="keyword-tooltip__tooltip" role="tooltip">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
    </span>
  );

  // Get factions with homeworld in this system
  const homeworldFactions =
    selectedSystemId != null
      ? factions.filter((faction: Faction) => faction.homeworld === selectedSystemId)
      : [];

  // Get all assets in this system from all factions
  const assetsInSystem: AssetWithFaction[] = [];

  if (selectedSystemId) {
    factions.forEach((faction: Faction) => {
      faction.assets.forEach((asset: FactionAsset) => {
        if (asset.location === selectedSystemId) {
          assetsInSystem.push({ asset, faction });
        }
      });
    });
  }

useEffect(() => {
  clearAttackHighlights();
  setPrimedAbility(null);
}, [selectedSystemId, assetsInSystem.length, homeworldFactions.length, clearAttackHighlights]);

const handleAttackTarget = (targetAssetId: string, targetFactionId: string, targetAssetName: string, enemyFactionName: string) => {
    if (!pendingAttack) {
      showNotification('Select an attacking asset first', 'error');
      return;
    }

  if (!system) {
    showNotification('System not found', 'error');
    return;
  }

    if (!canStageAction) {
      showNotification('Cannot attack: not in Action phase or action already staged', 'error');
      return;
    }

    const attackerFaction = factions.find((f: Faction) => f.id === pendingAttack.factionId);
    const targetFaction = factions.find((f: Faction) => f.id === targetFactionId);
    if (!attackerFaction || !targetFaction) {
      showNotification('Faction not found', 'error');
      return;
    }

    const attackerAsset = attackerFaction.assets.find((a: FactionAsset) => a.id === pendingAttack.assetId);
    const targetAsset = targetFaction.assets.find((a: FactionAsset) => a.id === targetAssetId);
    if (!attackerAsset || !targetAsset) {
      showNotification('Asset not found', 'error');
      return;
    }

    if (attackerAsset.location !== selectedSystemId || targetAsset.location !== selectedSystemId) {
      showNotification('Targets must be in the selected system', 'error');
      return;
    }

    const attackerAssetDef = getAssetById(attackerAsset.definitionId);
    const targetAssetDef = getAssetById(targetAsset.definitionId);
    if (!attackerAssetDef || !attackerAssetDef.attack || !targetAssetDef) {
      showNotification('Selected asset cannot attack', 'error');
      return;
    }

    dispatch(stageAction('Attack'));

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
        attackerFaction,
        defenderFaction: targetFaction,
        attackerAssetTechLevel: attackerAssetDef.techLevel,
        defenderAssetTechLevel: targetAssetDef.techLevel,
        defenderIsOnHomeworld: system.id === targetFaction.homeworld,
        attackerAssetDefinitionId: attackerAssetDef.id,
        defenderAssetDefinitionId: targetAssetDef.id,
      },
      attackPattern,
      counterattackPattern
    );

    const attackerAssetHpBefore = attackerAsset.hp;
    const defenderAssetHpBefore = targetAsset.hp;

    if (result.attackDamage > 0) {
      dispatch(
        inflictDamage({
          factionId: targetFactionId,
          assetId: targetAssetId,
          damage: result.attackDamage,
          sourceFactionId: pendingAttack.factionId,
        })
      );
    }

    if (result.counterattackDamage > 0) {
      dispatch(
        inflictDamage({
          factionId: pendingAttack.factionId,
          assetId: pendingAttack.assetId,
          damage: result.counterattackDamage,
          sourceFactionId: targetFactionId,
        })
      );
    }

    const getSystemHelper = (id: string) => sector?.systems.find((s: StarSystem) => s.id === id);
    const getSystemNameHelper = (id: string): string => {
      const sys = getSystemHelper(id);
      return sys?.name || 'Unknown System';
    };

    const actorContext = createNarrativeContextFromFaction(attackerFaction, getSystemNameHelper, getSystemHelper);
    const targetContext = createNarrativeContextFromTargetFaction(targetFaction, getSystemNameHelper, getSystemHelper);
    const systemContext = createNarrativeContextFromSystem(system);

    const attackResultText = result.attackerWins
      ? 'Success'
      : result.bothSucceed
        ? 'Tie'
        : 'Failure';

    dispatchNarrativeEntry(dispatch, 'Attack', {
      ...actorContext,
      ...targetContext,
      ...systemContext,
      assetName: attackerAssetDef.name,
      damage: result.attackDamage,
      result: attackResultText,
      relatedEntityIds: [
        pendingAttack.factionId,
        targetFactionId,
        pendingAttack.assetId,
        targetAssetId,
        system.id,
      ].filter(Boolean),
    });

    if (result.attackDamage > 0 && result.attackDamage >= defenderAssetHpBefore) {
      dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
        ...targetContext,
        assetName: targetAssetDef.name,
        result: 'Success',
        relatedEntityIds: [targetFactionId, targetAssetId].filter(Boolean),
      });
    }

    if (result.counterattackDamage > 0 && result.counterattackDamage >= attackerAssetHpBefore) {
      dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
        ...actorContext,
        assetName: attackerAssetDef.name,
        result: 'Success',
        relatedEntityIds: [pendingAttack.factionId, pendingAttack.assetId].filter(Boolean),
      });
    }

    dispatch(markActionUsed('Attack'));

    const outcomeDescription = result.attackerWins
      ? 'Attack successful!'
      : result.bothSucceed
        ? 'Tie! Both sides take damage.'
        : 'Attack failed!';

    showNotification(
      `${attackerAssetDef.name} attacked ${targetAssetName}. ${outcomeDescription}`,
      result.attackerWins ? 'success' : 'info'
    );

    const counterExpression = counterattackPattern?.damage ?? null;

    setAttackSummary({
      attackerName: attackerFaction.name,
      attackerAssetName: attackerAssetDef.name,
      defenderName: enemyFactionName,
      defenderAssetName: targetAssetName,
      systemName: system.name,
      attackDamage: result.attackDamage,
      counterDamage: result.counterattackDamage,
      outcome: outcomeDescription,
      attackerRoll: result.rollResult.attackerRoll,
      attackerAttribute: attackPattern.attackerAttribute,
      attackerAttributeValue,
      attackerTotal: result.rollResult.attackerTotal,
      defenderRoll: result.rollResult.defenderRoll,
      defenderAttribute: attackPattern.defenderAttribute,
      defenderAttributeValue,
      defenderTotal: result.rollResult.defenderTotal,
      margin: result.rollResult.margin,
      damageExpression: attackPattern.damage,
      counterExpression,
    });

    clearAttackHighlights();
  setPrimedAbility(null);
  };

const handleActivateAbility = (faction: Faction, asset: FactionAsset) => {
  const assetDef = getAssetById(asset.definitionId);
  if (!assetDef || !assetHasAbility(asset.definitionId)) {
    showNotification('This asset does not have a special ability', 'error');
    setPrimedAbility(null);
    return;
  }

  const freeAction = isFreeAction(asset.definitionId);
  if (!freeAction && !canStageAction) {
    showNotification('Cannot use ability: not in Action phase or action already staged', 'error');
    return;
  }

  const state = store.getState();
  const result = executeAbility(faction, asset, state);

  if (!result.success && result.message.includes('not yet implemented')) {
    showNotification(result.message, 'info');
    setPrimedAbility(null);
    return;
  }

  // Check if this is a movement ability
  if (result.isMovementAbility && result.movementConfig) {
    // Check if faction can afford the base cost
    if (result.movementConfig.costPerAsset > 0 && faction.facCreds < result.movementConfig.costPerAsset) {
      showNotification(`Insufficient FacCreds: Movement costs at least ${result.movementConfig.costPerAsset} FacCred${result.movementConfig.costPerAsset > 1 ? 's' : ''}`, 'error');
      setPrimedAbility(null);
      return;
    }

    // Initiate movement mode with custom range
    dispatch(startMovementMode({ 
      assetId: asset.id, 
      factionId: faction.id,
      abilityRange: result.movementConfig.range 
    }));
    showNotification(result.message, 'info');
    setPrimedAbility(null);
    return;
  }

  if (result.requiresAction) {
    dispatch(stageActionWithPayload({
      type: 'USE_ABILITY',
      payload: {
        factionId: faction.id,
        assetId: asset.id,
        abilityResult: {
          facCredsGained: result.facCredsGained,
          facCredsLost: result.facCredsLost,
          cost: result.cost,
          shouldDestroyAsset: result.data?.shouldDestroy as boolean,
        },
      },
    }));
    showNotification(`${result.message}. Action staged - commit to execute.`, 'info');
  } else {
    showNotification(result.message, 'info');
  }

  setPrimedAbility(null);
};

  // Movement is now handled exclusively through asset abilities
  // No standalone move action exists in SWN rules
  // Assets are clickable to prime their ability, then click again to activate

  // Show nothing if no homeworlds and no assets
  const hasCards = homeworldFactions.length > 0 || assetsInSystem.length > 0;

  const measureOverflow = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Check if cards extend beyond left OR right edges of viewport
    const isOverflowing =
      rect.left < 16 || rect.right > window.innerWidth - 16;
    setOverlapMode(isOverflowing);
  }, []);

  useEffect(() => {
    measureOverflow();
    window.addEventListener('resize', measureOverflow);
    return () => window.removeEventListener('resize', measureOverflow);
  }, [measureOverflow]);

  useEffect(() => {
    measureOverflow();
  }, [measureOverflow, homeworldFactions.length, assetsInSystem.length]);

  if (!sector || !selectedSystemId || !system || !hasCards) return null;

  const containerClasses = [
    'system-asset-cards',
    overlapMode ? 'system-asset-cards--overlap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <div className={containerClasses} ref={containerRef}>
      {/* Homeworld Faction Cards */}
      {homeworldFactions.map((faction: Faction) => {
        const factionColor = getFactionColor(faction.id) || '#4a9eff';
        const hpPercent = faction.attributes.maxHp > 0 ? (faction.attributes.hp / faction.attributes.maxHp) * 100 : 100;
        const hpColor = hpPercent > 60 ? '#4ecdc4' : hpPercent > 30 ? '#ffe66d' : '#ff6b6b';
        const storeLocked = Boolean(playerFactionId && faction.id !== playerFactionId);
        const homeworldClasses = [
          'system-asset-card',
          'system-asset-card--homeworld',
          storeLocked ? 'system-asset-card--locked' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={`homeworld-${faction.id}`}
            className={homeworldClasses}
            style={{
              '--faction-color': factionColor,
              '--faction-color-dim': withAlpha(factionColor, 0.3),
            } as React.CSSProperties}
            onClick={() => !storeLocked && handleHomeworldClick(faction)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!storeLocked) {
                  handleHomeworldClick(faction);
                }
              }
            }}
            aria-disabled={storeLocked}
            title={
              storeLocked
                ? 'Only your chosen faction can open its Asset Store in scenario mode'
                : 'Click to open Asset Store'
            }
          >
            <div className="system-asset-card__inner">
              {/* Header */}
              <div className="system-asset-card__header">
                <span className="system-asset-card__homeworld-badge">
                  🏠 Homeworld
                </span>
                {storeLocked && (
                  <span className="system-asset-card__lock-badge" aria-hidden="true">
                    🔒 Player Only
                  </span>
                )}
              </div>

              {/* Faction Name */}
              <h4 className="system-asset-card__name">{faction.name}</h4>

              {/* Faction Type */}
              <p className="system-asset-card__faction-type">{faction.type}</p>

              {/* HP Bar */}
              <div className="system-asset-card__hp-container">
                <div className="system-asset-card__hp-bar">
                  <div 
                    className="system-asset-card__hp-fill"
                    style={{ 
                      width: `${hpPercent}%`,
                      backgroundColor: hpColor
                    }}
                  />
                </div>
                <span className="system-asset-card__hp-text">
                  {faction.attributes.hp}/{faction.attributes.maxHp}
                </span>
              </div>

              {/* Faction Tags */}
              {faction.tags && faction.tags.length > 0 && (
                <div className="system-asset-card__tags">
                  {faction.tags.slice(0, 2).map((tag: FactionTag, index: number) => {
                    const tagMeta = FACTION_TAG_METADATA[tag];
                    return (
                      <TagBadge
                        key={`${tag}-${index}`}
                        label={tag.replace(/_/g, ' ')}
                        tone="faction"
                        description={tagMeta?.description || `Faction tag: ${tag}`}
                        effects={tagMeta?.effects}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Asset Cards */}
      {assetsInSystem.map(({ asset, faction }) => {
        const assetDef = getAssetById(asset.definitionId);
        if (!assetDef) return null;

        const factionColor = getFactionColor(faction.id) || '#4a9eff';
        const hpPercent = asset.maxHp > 0 ? (asset.hp / asset.maxHp) * 100 : 100;
        const hpColor = hpPercent > 60 ? '#4ecdc4' : hpPercent > 30 ? '#ffe66d' : '#ff6b6b';
        const isUserFaction =
          playerFactionId ? faction.id === playerFactionId : selectedFactionId ? faction.id === selectedFactionId : false;
        const isMovementSelected =
          movementMode.active && movementMode.assetId === asset.id && movementMode.factionId === faction.id;
        const isAttackTarget = attackableAssetIds.includes(asset.id);
        const isAbilityPrimed = primedAbility?.assetId === asset.id;
        const isBaseOfInfluence = 
          asset.definitionId === BASE_OF_INFLUENCE_ID || assetDef.name === 'Base of Influence';
        const canOpenStore = isBaseOfInfluence && isUserFaction;
        const assetCardClasses = [
          'system-asset-card',
          isUserFaction ? 'system-asset-card--player-owned' : '',
          isMovementSelected ? 'system-asset-card--movement-selected' : '',
          isAbilityPrimed ? 'system-asset-card--ability-primed' : '',
          isAttackTarget ? 'system-asset-card--attack-target' : '',
          canOpenStore ? 'system-asset-card--base-of-influence' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const assetName = assetDef.name;

      const specialFeatureTooltip =
        getSpecialFeatureSummary(asset.definitionId, 160) ||
        'This asset has unique special features. View the asset details for full description.';
      const actionTooltip =
        getAbilityDescription(asset.definitionId) ||
        'Has a special use ability (Use Asset Ability action) that can be triggered during the Action phase.';
      const permissionTooltip =
        'Requires planetary government permission to purchase or import onto a world.';

      return (
          <div
            key={asset.id}
            className={assetCardClasses}
            style={{
              '--faction-color': factionColor,
              '--faction-color-dim': withAlpha(factionColor, 0.3),
            } as React.CSSProperties}
            role={isUserFaction || isAttackTarget ? 'button' : undefined}
            tabIndex={isUserFaction || isAttackTarget ? 0 : -1}
            onClick={() => {
              if (isAttackTarget && pendingAttack) {
                handleAttackTarget(asset.id, faction.id, assetName, faction.name);
                return;
              }
              if (isAbilityPrimed && primedAbility) {
                handleActivateAbility(faction, asset);
                return;
              }
              if (canOpenStore) {
                // Base of Influence opens the shop
                handleHomeworldClick(faction);
                return;
              }
              if (isUserFaction) {
                // Check if asset has a special ability
                if (assetHasAbility(asset.definitionId)) {
                  // Prime the ability for execution
                  setPrimedAbility({
                    factionId: faction.id,
                    assetId: asset.id,
                    assetName: assetName,
                  });
                  showNotification(`${assetName} ability primed - click the card again to activate`, 'info');
                } else {
                  // No ability, no action
                  showNotification(`${assetName} has no special ability`, 'info');
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (isAttackTarget && pendingAttack) {
                  e.preventDefault();
                  handleAttackTarget(asset.id, faction.id, assetName, faction.name);
                  return;
                }
                if (isAbilityPrimed && primedAbility) {
                  e.preventDefault();
                  handleActivateAbility(faction, asset);
                  return;
                }
                if (canOpenStore) {
                  e.preventDefault();
                  // Base of Influence opens the shop
                  handleHomeworldClick(faction);
                  return;
                }
                if (isUserFaction) {
                  e.preventDefault();
                  // Check if asset has a special ability
                  if (assetHasAbility(asset.definitionId)) {
                    // Prime the ability for execution
                    setPrimedAbility({
                      factionId: faction.id,
                      assetId: asset.id,
                      assetName: assetName,
                    });
                    showNotification(`${assetName} ability primed - click the card again to activate`, 'info');
                  } else {
                    // No ability, no action
                    showNotification(`${assetName} has no special ability`, 'info');
                  }
                }
              }
            }}
            title={
              isAbilityPrimed
                ? `Click again to activate ${assetName}'s ability`
                : canOpenStore
                  ? `Click to open Asset Store (Base of Influence)`
                  : isUserFaction && assetHasAbility(asset.definitionId)
                    ? `Click to prime ${assetName}'s special ability`
                    : isUserFaction
                      ? `Your asset (${assetName})`
                      : isAttackTarget && pendingAttack
                        ? `Click to attack ${assetName} with ${pendingAttack.assetName}`
                        : 'This asset belongs to another faction'
            }
          >
            <div className="system-asset-card__inner">
              {/* Header */}
              <div className="system-asset-card__header">
                <span 
                  className="system-asset-card__category"
                  data-category={assetDef.category}
                >
                  {assetDef.category}
                </span>
                {asset.stealthed && (
                  <span className="system-asset-card__stealth">👁️</span>
                )}
              </div>
              {isAbilityPrimed && (
                <span className="system-asset-card__ability-badge" aria-live="polite">
                  Ability Ready
                </span>
              )}

              {/* Asset Name */}
              <h4 className="system-asset-card__name">{assetDef.name}</h4>

              {/* Faction */}
              <p className="system-asset-card__faction">{faction.name}</p>

              {/* HP Bar */}
              <div className="system-asset-card__hp-container">
                <div className="system-asset-card__hp-bar">
                  <div 
                    className="system-asset-card__hp-fill"
                    style={{ 
                      width: `${hpPercent}%`,
                      backgroundColor: hpColor
                    }}
                  />
                </div>
                <span className="system-asset-card__hp-text">
                  {asset.hp}/{asset.maxHp}
                </span>
              </div>

              {/* Stats */}
              <div className="system-asset-card__stats">
                {assetDef.attack && (
                  <div className="system-asset-card__stat">
                    <span className="system-asset-card__stat-icon">⚔️</span>
                    <span className="system-asset-card__stat-value">
                      {assetDef.attack.damage}
                    </span>
                  </div>
                )}
                {assetDef.counterattack && (
                  <div className="system-asset-card__stat">
                    <span className="system-asset-card__stat-icon">🛡️</span>
                    <span className="system-asset-card__stat-value">
                      {assetDef.counterattack.damage}
                    </span>
                  </div>
                )}
                {assetDef.type && (
                  <div className="system-asset-card__stat system-asset-card__stat--type">
                    <span className="system-asset-card__stat-value">{assetDef.type}</span>
                  </div>
                )}
              </div>

              {/* Special abilities indicators */}
              <div className="system-asset-card__flags">
                {assetDef.specialFlags?.hasAction && (
                  renderFlagWithTooltip('A', actionTooltip, 'system-asset-card__flag--action', 'Special Action')
                )}
                {assetDef.specialFlags?.hasSpecial && (
                  renderFlagWithTooltip('S', specialFeatureTooltip, 'system-asset-card__flag--special', 'Special Features')
                )}
                {assetDef.specialFlags?.requiresPermission && (
                  renderFlagWithTooltip('P', permissionTooltip, 'system-asset-card__flag--permission', 'Permission Required')
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const handleCloseAttackSummary = () => setAttackSummary(null);

  const attackSummaryModal = attackSummary
    ? createPortal(
        <div className="asset-attack-summary-overlay" role="dialog" aria-modal="true">
          <div className="asset-attack-summary">
            <div className="asset-attack-summary__header">
              <h3>Combat Result</h3>
              <button type="button" className="asset-attack-summary__close" onClick={handleCloseAttackSummary} aria-label="Close combat summary">
                ×
              </button>
            </div>
            <div className="asset-attack-summary__body">
              <p>
                <strong>{attackSummary.attackerName}</strong>'s {attackSummary.attackerAssetName} vs{' '}
                <strong>{attackSummary.defenderName}</strong>'s {attackSummary.defenderAssetName}
              </p>
              <p>Location: {attackSummary.systemName}</p>
          <div className="attack-summary__rolls">
            <div className="attack-summary__roll">
              <span>Attacker Roll</span>
              <span>
                d10 ({attackSummary.attackerRoll}) + {attackSummary.attackerAttribute} ({attackSummary.attackerAttributeValue}) ={' '}
                {attackSummary.attackerTotal}
              </span>
            </div>
            <div className="attack-summary__roll">
              <span>Defender Roll</span>
              <span>
                d10 ({attackSummary.defenderRoll}) + {attackSummary.defenderAttribute} ({attackSummary.defenderAttributeValue}) ={' '}
                {attackSummary.defenderTotal}
              </span>
            </div>
            <div className="attack-summary__roll">
              <span>Margin</span>
              <span>{attackSummary.margin > 0 ? `+${attackSummary.margin}` : attackSummary.margin}</span>
            </div>
          </div>
          <div className="attack-summary__damage-block">
            <div className="attack-summary__damage">
              <span>Attack Damage Roll</span>
              <span>
                {attackSummary.damageExpression} → {attackSummary.attackDamage}
              </span>
            </div>
            <div className="attack-summary__damage">
              <span>Counterattack</span>
              <span>
                {attackSummary.counterExpression && attackSummary.counterExpression !== 'None'
                  ? `${attackSummary.counterExpression} → ${attackSummary.counterDamage}`
                  : attackSummary.counterDamage > 0
                    ? attackSummary.counterDamage
                    : 'None'}
              </span>
            </div>
          </div>
              <p className="asset-attack-summary__outcome">{attackSummary.outcome}</p>
            </div>
            <div className="asset-attack-summary__footer">
              <button type="button" onClick={handleCloseAttackSummary}>
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  // Use portal to render outside the overflow:hidden container
  return (
    <>
      {createPortal(content, document.body)}
      {assetStoreOpen && selectedFactionForStore && (
        <AssetStoreModal
          faction={selectedFactionForStore}
          systemId={selectedSystemId}
          systemTechLevel={system.primaryWorld.techLevel}
          onClose={handleCloseAssetStore}
        />
      )}
      {attackSummaryModal}
    </>
  );
}

