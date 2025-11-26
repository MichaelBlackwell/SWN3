import { useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import type { Faction, FactionAsset, FactionTag } from '../../types/faction';
import type { StarSystem, Route } from '../../types/sector';
import { selectSystem } from '../../store/slices/sectorSlice';
import { getAssetById } from '../../data/assetLibrary';
import { 
  selectCanStageAction, 
  selectCurrentPhase,
  selectActionStaged,
  selectActionCommitted,
  selectUsedActionType,
  selectMovementMode,
  startMovementMode,
  stageAction,
  stageActionWithPayload,
  markActionUsed,
} from '../../store/slices/turnSlice';
import { assetHasAbility, isFreeAction, executeAbility, getAbilityDescription } from '../../utils/assetAbilities';
import { store } from '../../store/store';
import { showNotification } from '../NotificationContainer';
import { inflictDamage, addAsset } from '../../store/slices/factionsSlice';
import { resolveCombat } from '../../utils/combatResolver';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromTargetFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import ExpandInfluenceButton from '../FactionManager/ExpandInfluenceButton';
import { getWorldEconomicProfile } from '../../services/worldGenerator';
import { getSystemTradeInfo } from '../../services/tradeRouteGenerator';
import { tutorialEventOccurred } from '../../store/slices/tutorialSlice';
import { getPlanetSprite } from '../../utils/planetSpriteMapping';
import { getLandscapeSprite } from '../../utils/landscapeMapping';
import { getSystemDisplayName } from '../../utils/systemDisplay';
import { BASE_OF_INFLUENCE_ID } from '../../utils/expandInfluence';
import { withAlpha } from '../../utils/colorUtils';
import { getTechLevelColor } from '../../utils/techLevelColors';
import './WorldDetails.css';
import KeywordTooltipText, { highlightKeywords } from '../Tutorial/KeywordTooltipText';
import TagBadge from '../common/TagBadge';
import { FACTION_TAG_METADATA } from '../../data/factionTagMetadata';
import { validateAssetPurchase } from '../../utils/assetValidation';
import AssetList from '../FactionManager/AssetList';
import { getFactionColor } from '../../utils/factionColors';
import { assetHasSpecialFeatures, getSpecialFeatureSummary } from '../../utils/assetSpecialFeatures';

const POPULATION_LABELS = [
  'Failed Colony',
  'Outpost',
  'Fewer than a million',
  'Several million',
  'Hundreds of millions',
  'Billions',
  'Alien inhabitants',
];

const DEFAULT_FACTION_COLOR = '#4a9eff';

function getFactionTheme(factionId: string) {
  const baseColor = getFactionColor(factionId) || DEFAULT_FACTION_COLOR;
  return {
    baseColor,
    surface: withAlpha(baseColor, 0.18),
    badgeBg: withAlpha(baseColor, 0.35),
    outlineGlow: withAlpha(baseColor, 0.45),
    borderColor: baseColor,
    gradient: `linear-gradient(135deg, ${withAlpha(baseColor, 0.85)}, ${withAlpha(baseColor, 0.55)})`,
  };
}

const TECH_LEVEL_PATTERN = /TL\s*([0-5])/gi;

function emphasizeTechLevelTokens(text: string, keyPrefix: string): ReactNode {
  if (!text) {
    return text;
  }

  const techLevelRegex = new RegExp(TECH_LEVEL_PATTERN);
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let hasMatch = false;

  text.replace(techLevelRegex, (match, level, offset) => {
    hasMatch = true;

    if (offset > lastIndex) {
      nodes.push(text.slice(lastIndex, offset));
    }

    const techLevel = Number(level);
    const color = getTechLevelColor(techLevel);
    const shadowColor = withAlpha(color, 0.5);

    nodes.push(
      <span
        key={`${keyPrefix}-tl-${offset}`}
        className="world-details-tech-level-token"
        style={{
          color,
          textShadow: `0 0 8px ${shadowColor}`,
        }}
      >
        {match.trim()}
      </span>
    );

    lastIndex = offset + match.length;
    return match;
  });

  if (!hasMatch) {
    return text;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderIconTooltip(
  icon: string,
  label: string,
  description: string,
  tone: 'asset' | 'tag'
): ReactElement | null {
  if (!description) {
    return null;
  }

  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const accessibleDescription = lines.join(' ');

  return (
    <span
      className={`keyword-tooltip keyword-tooltip--${tone} world-details-icon-tooltip`}
      tabIndex={0}
      aria-label={`${label}: ${accessibleDescription}`}
    >
      <span className="keyword-tooltip__label" aria-hidden="true">
        {icon}
      </span>
      <span className="keyword-tooltip__tooltip" role="tooltip">
        <strong>{label}</strong>
        {lines.map((line, index) => (
          <span key={`${label}-${index}`} className="world-details-icon-tooltip__line">
            {emphasizeTechLevelTokens(line, `${label}-${index}`)}
          </span>
        ))}
      </span>
    </span>
  );
}

export default function WorldDetails() {
  const dispatch = useDispatch();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sector = useSelector((state: RootState) => state.sector.currentSector);
  const selectedSystemId = useSelector((state: RootState) => state.sector.selectedSystemId);
  const selectedFactionId = useSelector((state: RootState) => state.factions.selectedFactionId);
  const factions = useSelector((state: RootState) => state.factions.factions);
  const canStageAction = useSelector(selectCanStageAction);
  const currentPhase = useSelector(selectCurrentPhase);
  const actionStaged = useSelector(selectActionStaged);
  const actionCommitted = useSelector(selectActionCommitted);
  const usedActionType = useSelector(selectUsedActionType);
  const movementMode = useSelector(selectMovementMode);
  const [storeFactionId, setStoreFactionId] = useState<string | null>(null);
  const [storeLocationId, setStoreLocationId] = useState<string | null>(null);

  // Focus management for accessibility
  useEffect(() => {
    if (selectedSystemId && panelRef.current) {
      // Focus the panel when it opens
      panelRef.current.focus();
    }
  }, [selectedSystemId]);

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedSystemId) {
        dispatch(selectSystem(null));
        // Return focus to the map container
        const mapContainer = document.querySelector('.sector-map-container');
        if (mapContainer instanceof HTMLElement) {
          mapContainer.focus();
        }
      }
    };

    if (selectedSystemId) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [selectedSystemId, dispatch]);

  if (!sector || !selectedSystemId) return null;

  const system = sector.systems.find((s: StarSystem) => s.id === selectedSystemId);
  if (!system) return null;

  const storeFaction = storeFactionId ? factions.find((f: Faction) => f.id === storeFactionId) : null;
  const storeSystem =
    storeLocationId ? sector.systems.find((s: StarSystem) => s.id === storeLocationId) : null;
  const storeSystemName = storeSystem ? getSystemDisplayName(storeSystem.name) : 'Unknown System';

  const handleClose = () => {
    dispatch(selectSystem(null));
    // Return focus to the map container
    const mapContainer = document.querySelector('.sector-map-container');
    if (mapContainer instanceof HTMLElement) {
      mapContainer.focus();
    }
  };

  const selectedFaction = selectedFactionId
    ? factions.find((f: Faction) => f.id === selectedFactionId)
    : null;
  const selectedFactionHasPresence = Boolean(
    selectedFaction && selectedFaction.assets.some((asset: FactionAsset) => asset.location === system.id)
  );

  const handleTarget = (targetAssetId: string, targetFactionId: string) => {
    if (!canStageAction) {
      showNotification('Cannot attack: not in Action phase or action already staged', 'error');
      return;
    }

    if (!selectedFactionId || !selectedFaction) {
      showNotification('Please select a faction first', 'error');
      return;
    }

    if (!system) {
      showNotification('System not found', 'error');
      return;
    }

    // Find the target asset and faction
    const targetFaction = factions.find((f: Faction) => f.id === targetFactionId);
    const targetAsset = targetFaction?.assets.find((a: FactionAsset) => a.id === targetAssetId);
    const targetAssetDef = targetAsset ? getAssetById(targetAsset.definitionId) : null;

    if (!targetFaction || !targetAsset || !targetAssetDef) {
      showNotification('Target asset not found', 'error');
      return;
    }

    // Find available attacker assets from selected faction in the same system
    const attackerAssets = selectedFaction.assets.filter((asset: FactionAsset) =>
      asset.location === system.id
    );

    // Filter to only assets that can attack
    const availableAttackers = attackerAssets.filter((asset: FactionAsset) => {
      const assetDef = getAssetById(asset.definitionId);
      return assetDef?.attack && asset.hp > 0;
    });

    if (availableAttackers.length === 0) {
      showNotification('No attacking assets available in this system', 'error');
      return;
    }

    // Use the first available attacker (could be enhanced to let user choose)
    const attackerAsset = availableAttackers[0];
    const attackerAssetDef = getAssetById(attackerAsset.definitionId);

    if (!attackerAssetDef || !attackerAssetDef.attack) {
      showNotification('Selected asset cannot attack', 'error');
      return;
    }

    // Stage the Attack action
    dispatch(stageAction('Attack'));

    // Prepare combat resolution
    const attackPattern = attackerAssetDef.attack;
    const counterattackPattern = targetAssetDef.counterattack;

    const attackerAttributeValue =
      attackPattern.attackerAttribute === 'Force'
        ? selectedFaction.attributes.force
        : attackPattern.attackerAttribute === 'Cunning'
          ? selectedFaction.attributes.cunning
          : selectedFaction.attributes.wealth;

    const defenderAttributeValue =
      attackPattern.defenderAttribute === 'Force'
        ? targetFaction.attributes.force
        : attackPattern.defenderAttribute === 'Cunning'
          ? targetFaction.attributes.cunning
          : targetFaction.attributes.wealth;

    // Resolve combat
    const result = resolveCombat(
      {
        attackerAttribute: attackPattern.attackerAttribute,
        attackerAttributeValue,
        defenderAttribute: attackPattern.defenderAttribute,
        defenderAttributeValue,
        attackerFaction: selectedFaction,
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

    // Store HP before combat for narrative generation
    const attackerAssetHpBefore = attackerAsset.hp;
    // const attackerFactionHpBefore = selectedFaction.attributes.hp;
    const defenderAssetHpBefore = targetAsset.hp;
    // const defenderFactionHpBefore = targetFaction.attributes.hp;

    // Apply damage
    if (result.attackDamage > 0) {
      dispatch(
        inflictDamage({
          factionId: targetFactionId,
          assetId: targetAssetId,
          damage: result.attackDamage,
          sourceFactionId: selectedFactionId,
        })
      );
    }

    if (result.counterattackDamage > 0) {
      dispatch(
        inflictDamage({
          factionId: selectedFactionId,
          assetId: attackerAsset.id,
          damage: result.counterattackDamage,
          sourceFactionId: targetFactionId,
        })
      );
    }

    // Generate narrative
    const getSystemHelper = (id: string) => sector.systems.find((s: StarSystem) => s.id === id);
    const getSystemNameHelper = (id: string): string => {
      const sys = getSystemHelper(id);
      return sys?.name || 'Unknown System';
    };

    const actorContext = createNarrativeContextFromFaction(selectedFaction, getSystemNameHelper, getSystemHelper);
    const targetContext = createNarrativeContextFromTargetFaction(targetFaction, getSystemNameHelper, getSystemHelper);
    const systemContext = createNarrativeContextFromSystem(system);

    // Determine attack result for narrative
    const attackResult = result.attackerWins
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
      result: attackResult,
      relatedEntityIds: [
        selectedFactionId,
        targetFactionId,
        attackerAsset.id,
        targetAssetId,
        system.id,
      ].filter(Boolean),
    });

    // If asset was destroyed, generate a separate narrative entry
    if (result.attackDamage > 0 && result.attackDamage >= defenderAssetHpBefore) {
      dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
        ...targetContext,
        assetName: targetAssetDef.name,
        result: 'Success',
        relatedEntityIds: [targetFactionId, targetAssetId].filter(Boolean),
      });
    }

    // If counterattack damaged attacker asset and destroyed it
    if (result.counterattackDamage > 0 && result.counterattackDamage >= attackerAssetHpBefore) {
      dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
        ...actorContext,
        assetName: attackerAssetDef.name,
        result: 'Success',
        relatedEntityIds: [selectedFactionId, attackerAsset.id].filter(Boolean),
      });
    }

    // If faction took damage, generate narrative (need to get updated faction state)
    // Note: This will be checked after damage is applied, so we'll need to get the updated state
    // For now, we'll skip this as it requires getting the updated faction state after dispatch

    // Mark that an Attack action was used (allows more attacks of same type)
    // Per SWN rules: Can only take one ACTION TYPE per turn, but can perform
    // that action type with multiple assets
    dispatch(markActionUsed('Attack'));

    // Show notification
    const resultText = result.attackerWins
      ? `Attack successful! ${result.attackDamage} damage dealt.`
      : result.bothSucceed
        ? `Tie! Both sides take damage (${result.attackDamage} vs ${result.counterattackDamage}).`
        : `Attack failed! Counterattack deals ${result.counterattackDamage} damage.`;

    showNotification(
      `${attackerAssetDef.name} attacks ${targetAssetDef.name}. ${resultText}`,
      result.attackerWins ? 'success' : 'info'
    );
    dispatch(tutorialEventOccurred({ eventId: 'assetTutorial.assetAttackInitiated' }));
  };

  // Movement is now handled exclusively through asset abilities
  // No standalone Move action exists in SWN rules

  const handleRepair = (_assetId: string, _factionId: string) => {
    if (!canStageAction) {
      showNotification('Cannot repair: not in Action phase or action already staged', 'error');
      return;
    }
    // TODO: Implement repair action (subtask 11.2)
    showNotification('Repair action not yet implemented', 'info');
  };

  const handleUseAbility = (assetId: string, factionId: string) => {
    const faction = factions.find((f: Faction) => f.id === factionId);
    if (!faction) {
      showNotification('Faction not found', 'error');
      return;
    }

    const asset = faction.assets.find((a: FactionAsset) => a.id === assetId);
    if (!asset) {
      showNotification('Asset not found', 'error');
      return;
    }

    const state = store.getState();

    // Check if asset has ability
    if (!assetHasAbility(asset.definitionId)) {
      showNotification('This asset does not have a special ability', 'error');
      return;
    }

    const freeAction = isFreeAction(asset.definitionId);

    // For free actions, we can use them even if an action is already staged
    if (!freeAction && !canStageAction) {
      showNotification('Cannot use ability: not in Action phase or action already staged', 'error');
      return;
    }

    // Execute the ability
    const result = executeAbility(faction, asset, state);

    if (!result.success && result.message.includes('not yet implemented')) {
      showNotification(result.message, 'info');
      return;
    }

    // Check if this is a movement ability
    if (result.isMovementAbility && result.movementConfig) {
      // Check if faction can afford the base cost
      if (result.movementConfig.costPerAsset > 0 && faction.facCreds < result.movementConfig.costPerAsset) {
        showNotification(`Insufficient FacCreds: Movement costs at least ${result.movementConfig.costPerAsset} FacCred${result.movementConfig.costPerAsset > 1 ? 's' : ''}`, 'error');
        return;
      }

      // Initiate movement mode with custom range
      dispatch(startMovementMode({ 
        assetId: asset.id, 
        factionId: faction.id, 
        abilityRange: result.movementConfig.range 
      }));
      showNotification(result.message, 'info');
      return;
    }

    // Stage the ability action (only if it requires an action slot)
    if (result.requiresAction) {
      dispatch(stageActionWithPayload({
        type: 'USE_ABILITY',
        payload: {
          factionId,
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
      // Free action - execute immediately
      showNotification(result.message, 'info');
      // TODO: Handle immediate execution for free actions
    }
  };

  const handleOpenStoreFromWorld = (factionId: string, targetSystemId: string) => {
    if (selectedFactionId !== factionId) {
      return;
    }

    setStoreFactionId(factionId);
    setStoreLocationId(targetSystemId);
  };

  const handleCloseAssetStore = () => {
    setStoreFactionId(null);
    setStoreLocationId(null);
  };

  const handlePurchaseFromWorld = (assetDefinitionId: string) => {
    if (!storeFactionId || !storeLocationId) {
      return;
    }

    const faction = factions.find((f: Faction) => f.id === storeFactionId);
    if (!faction) {
      showNotification('Faction not found', 'error');
      handleCloseAssetStore();
      return;
    }

    const targetSystem = sector?.systems.find((s: StarSystem) => s.id === storeLocationId);
    const validation = validateAssetPurchase(faction, assetDefinitionId, {
      targetSystem,
    });
    if (!validation.valid) {
      showNotification(validation.reason || 'Cannot purchase asset', 'error');
      return;
    }

    dispatch(
      addAsset({
        factionId: storeFactionId,
        assetDefinitionId,
        location: storeLocationId,
      })
    );

    const assetDef = getAssetById(assetDefinitionId);
    const getSystemHelper = (id: string) => sector?.systems.find((s: StarSystem) => s.id === id);
    const getSystemNameHelper = (id: string): string => {
      const sys = getSystemHelper(id);
      return sys ? sys.name : 'Unknown System';
    };

    const actorContext = createNarrativeContextFromFaction(faction, getSystemNameHelper, getSystemHelper);
    const systemContext = targetSystem ? createNarrativeContextFromSystem(targetSystem) : {};

    dispatchNarrativeEntry(dispatch, 'Buy', {
      ...actorContext,
      ...systemContext,
      assetName: assetDef?.name,
      credits: assetDef?.cost,
      result: 'Success',
      relatedEntityIds: [storeFactionId, storeLocationId].filter(Boolean),
    });

    const systemName = targetSystem ? getSystemDisplayName(targetSystem.name) : 'Unknown System';
    showNotification(`Purchased ${assetDef?.name || 'asset'} and placed at ${systemName}`, 'success');
    dispatch(tutorialEventOccurred({ eventId: 'assetTutorial.assetPurchased' }));
    handleCloseAssetStore();
  };

  // Check if buttons should be disabled
  // Per SWN rules: A faction can only take one TYPE of action per turn,
  // but they can perform that action type with multiple assets
  const baseDisabled = currentPhase !== 'Action' || actionStaged || actionCommitted || movementMode.active;
  
  // Create type-specific disabled flags - allow same type if already used
  const canUseActionType = (actionType: string) => {
    if (baseDisabled) return false;
    if (!usedActionType) return true; // No action used yet, any type is allowed
    return usedActionType === actionType; // Only same type as already used
  };
  
  // Specific disabled flags for each action type
  const isAttackDisabled = !canUseActionType('Attack');
  const isRepairDisabled = !canUseActionType('REPAIR');
  const isUseAbilityDisabled = !canUseActionType('USE_ABILITY');
  const isExpandInfluenceDisabled = !canUseActionType('EXPAND_INFLUENCE');
  
  const canShowWorldExpandButton = Boolean(selectedFaction && selectedFactionHasPresence && !isExpandInfluenceDisabled);

  const populationLabel = POPULATION_LABELS[system.primaryWorld.population] || 'Unknown';
  const systemDisplayName = getSystemDisplayName(system.name);
  const planetSprite = getPlanetSprite(
    system.primaryWorld.atmosphere,
    system.primaryWorld.temperature,
    system.primaryWorld.biosphere,
    system.primaryWorld.tags,
    { seed: system.id }
  );
  const landscapeSprite = getLandscapeSprite(planetSprite.category, { seed: system.id });
  const formatLabel = (value: string) => value.replace(/_/g, ' ').replace(/-/g, ' ');
  const spriteCategoryLabel = formatLabel(planetSprite.category);
  const landscapeLabel = formatLabel(landscapeSprite.category);

  // Find factions that have this system as their homeworld
  const homeworldFactions = factions.filter((faction: Faction) => faction.homeworld === system.id);

  // Find all assets in this system (from any faction)
  const assetsInSystem = factions.flatMap((faction: Faction) =>
    faction.assets
      .filter((asset: FactionAsset) => asset.location === system.id)
      .map((asset: FactionAsset) => ({ ...asset, factionId: faction.id, factionName: faction.name }))
  );

  return (
    <>
      {/* Left Panel - Factions & Assets */}
      {(homeworldFactions.length > 0 || assetsInSystem.length > 0) && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '400px',
            backgroundColor: '#2a2a2a',
            borderRight: '1px solid #444',
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.3)',
            outline: 'none',
            transition: 'transform 0.3s ease-in-out',
          }}
        >
          <div style={{ padding: '20px' }}>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '20px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                {systemDisplayName} - Factions & Assets
              </h3>
            </div>

            {/* Homeworld Factions */}
            {homeworldFactions.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>
                  Homeworld of:
                </div>
                {homeworldFactions.map((faction: Faction) => {
                  const factionAssets = assetsInSystem.filter((asset: { factionId: string }) => asset.factionId === faction.id);
                  const isSelectedFactionHomeworld = selectedFactionId === faction.id;
                  const factionTheme = getFactionTheme(faction.id);
                  return (
                    <div
                      key={faction.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '8px',
                        border: `1px solid ${factionTheme.borderColor}`,
                        boxShadow: `0 0 14px ${factionTheme.outlineGlow}`,
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px', gap: '8px' }}>
                        <div>
                          <div style={{ color: factionTheme.baseColor, fontSize: '16px', fontWeight: '700' }}>{faction.name}</div>
                          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>{faction.type}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              padding: '4px 8px',
                              backgroundColor: factionTheme.badgeBg,
                              color: '#fff',
                              borderRadius: '999px',
                              border: `1px solid ${factionTheme.borderColor}`,
                              fontSize: '11px',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Homeworld
                          </div>
                          {isSelectedFactionHomeworld && (
                            <button
                              type="button"
                              onClick={() => handleOpenStoreFromWorld(faction.id, system.id)}
                              style={{
                                padding: '6px 10px',
                                background: factionTheme.gradient,
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: `0 0 12px ${factionTheme.outlineGlow}`,
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = `0 0 16px ${factionTheme.outlineGlow}`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = `0 0 12px ${factionTheme.outlineGlow}`;
                              }}
                              title="Open the asset store for this faction"
                            >
                              Open Store
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Faction Attributes */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px', fontSize: '11px' }}>
                        <div style={{ textAlign: 'center', padding: '4px', backgroundColor: factionTheme.surface, borderRadius: '4px', border: `1px solid ${withAlpha(factionTheme.baseColor, 0.4)}` }}>
                          <div style={{ color: '#aaa' }}>HP</div>
                          <div style={{ color: '#fff' }}>
                            {faction.attributes.hp}/{faction.attributes.maxHp}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', backgroundColor: factionTheme.surface, borderRadius: '4px', border: `1px solid ${withAlpha(factionTheme.baseColor, 0.4)}` }}>
                          <div>
                            <KeywordTooltipText as="span" text="Force" />
                          </div>
                          <div style={{ color: '#fff' }}>{faction.attributes.force}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', backgroundColor: factionTheme.surface, borderRadius: '4px', border: `1px solid ${withAlpha(factionTheme.baseColor, 0.4)}` }}>
                          <div>
                            <KeywordTooltipText as="span" text="Cunning" />
                          </div>
                          <div style={{ color: '#fff' }}>{faction.attributes.cunning}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', backgroundColor: factionTheme.surface, borderRadius: '4px', border: `1px solid ${withAlpha(factionTheme.baseColor, 0.4)}` }}>
                          <div>
                            <KeywordTooltipText as="span" text="Wealth" />
                          </div>
                          <div style={{ color: '#fff' }}>{faction.attributes.wealth}</div>
                        </div>
                      </div>

                      {/* Faction Tags */}
                      {faction.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                          {faction.tags.map((tag: FactionTag) => (
                            <TagBadge
                              key={tag}
                              label={tag}
                              description={FACTION_TAG_METADATA[tag]?.description}
                              effects={FACTION_TAG_METADATA[tag]?.effects}
                              style={{ fontSize: '10px' }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Assets in this system for this faction */}
                      {factionAssets.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #444' }}>
                          <div style={{ color: '#aaa', fontSize: '11px', marginBottom: '6px', fontWeight: '600' }}>
                            Assets ({factionAssets.length}):
                          </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {factionAssets.map((asset: any) => {
                              const assetDef = getAssetById(asset.definitionId);
                              const categoryColor =  
                                assetDef?.category === 'Force' ? '#ff6b6b' :
                                assetDef?.category === 'Cunning' ? '#4ecdc4' :
                                assetDef?.category === 'Wealth' ? '#ffe66d' : '#646cff';
                              
                              const isSelectedFactionAsset = selectedFactionId === faction.id;
                              const needsRepair = asset.hp < asset.maxHp;
                              const hasAbility = assetDef ? assetHasAbility(asset.definitionId) : false;
                              const hasSpecialFeatures = assetHasSpecialFeatures(asset.definitionId);
                              const abilityDescription = hasAbility ? getAbilityDescription(asset.definitionId) : '';
                              const specialFeatureSummary = hasSpecialFeatures
                                ? getSpecialFeatureSummary(asset.definitionId, 160)
                                : '';
                              const isBaseOfInfluence =
                                assetDef?.name === 'Base of Influence' || asset.definitionId === BASE_OF_INFLUENCE_ID;
                              
                              return (
                                <div
                                  key={asset.id}
                                  style={{
                                    padding: '8px 10px',
                                    backgroundColor: factionTheme.surface,
                                    borderLeft: `3px solid ${categoryColor}`,
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    border: `1px solid ${withAlpha(factionTheme.baseColor, 0.45)}`,
                                    boxShadow: `0 0 10px ${withAlpha(factionTheme.baseColor, 0.25)}`,
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                        <div style={{ color: '#fff', fontWeight: '700', fontSize: '13px' }}>
                                          {assetDef?.name || asset.definitionId}
                                        </div>
                                        {hasAbility && renderIconTooltip('⚡', 'Special Ability', abilityDescription, 'asset')}
                                        {hasSpecialFeatures && renderIconTooltip('✷', 'Special Features', specialFeatureSummary, 'tag')}
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span
                                          style={{
                                            fontSize: '10px',
                                            fontWeight: '500',
                                            textTransform: 'uppercase',
                                          }}
                                        >
                                          {assetDef?.category
                                            ? highlightKeywords(
                                                assetDef.category,
                                                `world-asset-category-${asset.id}`,
                                              )
                                            : 'Unknown'}
                                        </span>
                                        <span style={{ color: '#aaa', fontSize: '10px' }}>
                                          HP: {asset.hp}/{asset.maxHp}
                                        </span>
                                        {assetDef?.type && (
                                          <span style={{ color: '#888', fontSize: '10px' }}>
                                            {assetDef.type}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    {asset.stealthed && (
                                      <div
                                        style={{
                                          padding: '3px 6px',
                                              backgroundColor: factionTheme.badgeBg,
                                          color: '#fff',
                                          borderRadius: '3px',
                                          fontSize: '9px',
                                          fontWeight: '600',
                                          textTransform: 'uppercase',
                                        }}
                                      >
                                        Stealthed
                                      </div>
                                    )}
                                      
                                      {/* Action buttons for selected faction's assets */}
                                      {isSelectedFactionAsset && (
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                          {isBaseOfInfluence && (
                                            <button
                                              onClick={() => handleOpenStoreFromWorld(faction.id, asset.location)}
                                              style={{
                                                padding: '4px 8px',
                                                background: factionTheme.gradient,
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                boxShadow: '0 0 10px rgba(74, 158, 255, 0.35)',
                                                textTransform: 'uppercase',
                                              }}
                                              title="Open asset store"
                                            >
                                              Open Store
                                            </button>
                                          )}
                                          {needsRepair && (
                                            <button
                                              onClick={() => handleRepair(asset.id, faction.id)}
                                              disabled={isRepairDisabled}
                                              style={{
                                                padding: '4px 8px',
                                                backgroundColor: isRepairDisabled ? '#555' : '#ff8c00',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '500',
                                                cursor: isRepairDisabled ? 'not-allowed' : 'pointer',
                                                opacity: isRepairDisabled ? 0.5 : 1,
                                                whiteSpace: 'nowrap',
                                              }}
                                              title="Repair this asset"
                                            >
                                              Repair
                                            </button>
                                          )}
                                          {hasAbility && (
                                            <button
                                              onClick={() => handleUseAbility(asset.id, faction.id)}
                                              disabled={isUseAbilityDisabled}
                                              style={{
                                                padding: '4px 8px',
                                                backgroundColor: isUseAbilityDisabled ? '#555' : '#9b59b6',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '500',
                                                cursor: isUseAbilityDisabled ? 'not-allowed' : 'pointer',
                                                opacity: isUseAbilityDisabled ? 0.5 : 1,
                                                whiteSpace: 'nowrap',
                                              }}
                                              title="Use special ability"
                                            >
                                              Ability
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* Target button for enemy assets (assets that can be attacked) */}
                                      {selectedFactionId && selectedFactionId !== faction.id && (
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                          <button
                                            onClick={() => handleTarget(asset.id, faction.id)}
                                            disabled={isAttackDisabled}
                                            style={{
                                              padding: '4px 8px',
                                              backgroundColor: isAttackDisabled ? '#555' : '#dc3545',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: '500',
                                              cursor: isAttackDisabled ? 'not-allowed' : 'pointer',
                                              opacity: isAttackDisabled ? 0.5 : 1,
                                              whiteSpace: 'nowrap',
                                            }}
                                            title="Target this asset for attack"
                                          >
                                            Target
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Expand Influence Button - only for selected faction */}
                      {isSelectedFactionHomeworld && canShowWorldExpandButton && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
                          <ExpandInfluenceButton
                            factionId={faction.id}
                            currentSystemId={system.id}
                            disabled={isExpandInfluenceDisabled}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Assets from other factions (not homeworld) */}
            {assetsInSystem.filter((asset: { factionId: string }) => !homeworldFactions.some((f: Faction) => f.id === asset.factionId)).length > 0 && (
              <div>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>
                  Other Assets:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {assetsInSystem
                    .filter((asset: { factionId: string }) => !homeworldFactions.some((f: Faction) => f.id === asset.factionId))
                    .map((asset: any) => {
                      const assetDef = getAssetById(asset.definitionId);
                      const categoryColor = 
                        assetDef?.category === 'Force' ? '#ff6b6b' :
                        assetDef?.category === 'Cunning' ? '#4ecdc4' :
                        assetDef?.category === 'Wealth' ? '#ffe66d' : '#646cff';
                      
                      const isSelectedFactionAsset = selectedFactionId === asset.factionId;
                      const needsRepair = asset.hp < asset.maxHp;
                      const hasAbility = assetDef ? assetHasAbility(asset.definitionId) : false;
                      const hasSpecialFeatures = assetHasSpecialFeatures(asset.definitionId);
                      const abilityDescription = hasAbility ? getAbilityDescription(asset.definitionId) : '';
                      const specialFeatureSummary = hasSpecialFeatures
                        ? getSpecialFeatureSummary(asset.definitionId, 160)
                        : '';
                    const isBaseOfInfluence =
                      assetDef?.name === 'Base of Influence' || asset.definitionId === BASE_OF_INFLUENCE_ID;
                      const owningTheme = getFactionTheme(asset.factionId);
                      
                      return (
                        <div
                          key={asset.id}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: owningTheme.surface,
                            borderLeft: `3px solid ${categoryColor}`,
                            borderRadius: '6px',
                            border: `1px solid ${withAlpha(owningTheme.baseColor, 0.45)}`,
                            boxShadow: `0 0 10px ${withAlpha(owningTheme.baseColor, 0.25)}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>
                                  {assetDef?.name || asset.definitionId}
                                </div>
                                {hasAbility && renderIconTooltip('⚡', 'Special Ability', abilityDescription, 'asset')}
                                {hasSpecialFeatures && renderIconTooltip('✷', 'Special Features', specialFeatureSummary, 'tag')}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ color: owningTheme.baseColor, fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>
                                  {asset.factionName}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: '500',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {assetDef?.category
                                    ? highlightKeywords(
                                        assetDef.category,
                                        `world-other-asset-category-${asset.id}`,
                                      )
                                    : 'Unknown'}
                                </span>
                                <span style={{ color: '#aaa', fontSize: '10px' }}>
                                  HP: {asset.hp}/{asset.maxHp}
                                </span>
                                {assetDef?.type && (
                                  <span style={{ color: '#888', fontSize: '10px' }}>
                                    {assetDef.type}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {asset.stealthed && (
                              <div
                                style={{
                                  padding: '3px 6px',
                                  backgroundColor: owningTheme.badgeBg,
                                  color: '#fff',
                                  borderRadius: '3px',
                                  fontSize: '9px',
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                }}
                              >
                                Stealthed
                              </div>
                            )}
                              
                              {/* Action buttons for selected faction's assets */}
                              {isSelectedFactionAsset && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {isBaseOfInfluence && (
                                    <button
                                      onClick={() => handleOpenStoreFromWorld(asset.factionId, asset.location)}
                                      style={{
                                        padding: '4px 8px',
                                        background: owningTheme.gradient,
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        boxShadow: `0 0 10px ${owningTheme.outlineGlow}`,
                                        textTransform: 'uppercase',
                                      }}
                                      title="Open asset store"
                                    >
                                      Open Store
                                    </button>
                                  )}
                                  {needsRepair && (
                                    <button
                                      onClick={() => handleRepair(asset.id, asset.factionId)}
                                      disabled={isRepairDisabled}
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: isRepairDisabled ? '#555' : '#ff8c00',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        cursor: isRepairDisabled ? 'not-allowed' : 'pointer',
                                        opacity: isRepairDisabled ? 0.5 : 1,
                                        whiteSpace: 'nowrap',
                                      }}
                                      title="Repair this asset"
                                    >
                                      Repair
                                    </button>
                                  )}
                                  {hasAbility && (
                                    <button
                                      onClick={() => handleUseAbility(asset.id, asset.factionId)}
                                      disabled={isUseAbilityDisabled}
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: isUseAbilityDisabled ? '#555' : '#9b59b6',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        cursor: isUseAbilityDisabled ? 'not-allowed' : 'pointer',
                                        opacity: isUseAbilityDisabled ? 0.5 : 1,
                                        whiteSpace: 'nowrap',
                                      }}
                                      title="Use special ability"
                                    >
                                      Ability
                                    </button>
                                  )}
                                </div>
                              )}
                              
                              {/* Target button for enemy assets (assets that can be attacked) */}
                              {selectedFactionId && selectedFactionId !== asset.factionId && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => handleTarget(asset.id, asset.factionId)}
                                    disabled={isAttackDisabled}
                                    className="world-details-action-btn world-details-action-btn--attack"
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: isAttackDisabled ? '#555' : '#dc3545',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      cursor: isAttackDisabled ? 'not-allowed' : 'pointer',
                                      opacity: isAttackDisabled ? 0.5 : 1,
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Target this asset for attack"
                                  >
                                    Target
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* No factions or assets message */}
            {homeworldFactions.length === 0 && assetsInSystem.length === 0 && (
              <div style={{ color: '#aaa', fontSize: '14px', fontStyle: 'italic' }}>
                No factions or assets present in this system.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Panel - World Details */}
      <div
        className="world-details-panel"
        data-tutorial-target="world-details"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Details for ${systemDisplayName}`}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '400px',
          backgroundColor: '#2a2a2a',
          borderLeft: '1px solid #444',
          overflowY: 'auto',
          zIndex: 100,
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.3)',
          outline: 'none',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        <div className="world-details-panel__scroll">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '24px' }}>{systemDisplayName}</h2>
            <button
              ref={closeButtonRef}
              onClick={handleClose}
              aria-label="Close system details"
              style={{
                background: 'none',
                border: '1px solid #555',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid #4a9eff';
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
            >
              Close
            </button>
          </div>

        {/* Primary World Section */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
            Primary World: {system.primaryWorld.name}
          </h3>

          <div
            className="world-details-planet-card"
            data-sprite-archetype={spriteCategoryLabel}
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(10, 10, 15, 0.85) 0%, rgba(10, 10, 15, 0.65) 40%, rgba(10, 10, 15, 0.35) 100%), url(${landscapeSprite.imagePath})`,
            }}
          >
            <div className="world-details-planet-card__glow" />
            <div className="world-details-planet-card__badge world-details-planet-card__badge--landscape">
              <span className="world-details-planet-card__badge-label">Landscape</span>
              <span className="world-details-planet-card__badge-value">{landscapeLabel}</span>
            </div>
            {planetSprite.overlays.map((overlay, index) => (
              <img
                key={`${overlay.type}-${index}`}
                src={overlay.spritePath}
                alt=""
                aria-hidden="true"
                className={`world-details-planet-card__overlay world-details-planet-card__overlay--${overlay.type}`}
                draggable={false}
              />
            ))}
            <img
              src={planetSprite.spritePath}
              alt={`Planet sprite for ${system.primaryWorld.name}`}
              className="world-details-planet-card__image"
              draggable={false}
            />
          </div>

          {/* Core Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Atmosphere</div>
              <div style={{ color: '#fff', fontSize: '14px' }}>{system.primaryWorld.atmosphere}</div>
            </div>
            <div>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Temperature</div>
              <div style={{ color: '#fff', fontSize: '14px' }}>{system.primaryWorld.temperature}</div>
            </div>
            <div>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Biosphere</div>
              <div style={{ color: '#fff', fontSize: '14px' }}>{system.primaryWorld.biosphere}</div>
            </div>
            <div>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Population</div>
              <div style={{ color: '#fff', fontSize: '14px' }}>{populationLabel}</div>
            </div>
            <div>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Tech Level</div>
              <div style={{ 
                color: getTechLevelColor(system.primaryWorld.techLevel), 
                fontSize: '14px',
                fontWeight: 600,
                textShadow: `0 0 8px ${withAlpha(getTechLevelColor(system.primaryWorld.techLevel), 0.5)}`
              }}>
                TL{system.primaryWorld.techLevel}
              </div>
            </div>
            <div>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Government</div>
              <div style={{ color: '#fff', fontSize: '14px' }}>{system.primaryWorld.government}</div>
            </div>
          </div>

          {/* World Tags */}
          {system.primaryWorld.tags && system.primaryWorld.tags.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>World Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {system.primaryWorld.tags.map((tag: string, index: number) => (
                  <TagBadge
                    key={`${tag}-${index}`}
                    label={tag}
                    tone="world"
                    description={`World tag: ${tag}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Lore Section - Trade Codes & Economic Information */}
          <details style={{ marginBottom: '16px' }}>
            <summary style={{ 
              color: '#fff', 
              fontSize: '14px', 
              fontWeight: '600',
              cursor: 'pointer',
              padding: '8px',
              backgroundColor: '#333',
              borderRadius: '4px',
              marginBottom: '12px',
              userSelect: 'none'
            }}>
              Lore
            </summary>

            {/* Trade Codes */}
            {system.primaryWorld.tradeCodes && system.primaryWorld.tradeCodes.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Trade Codes</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {system.primaryWorld.tradeCodes.map((code: string, index: number) => (
                    <span
                      key={index}
                      style={{
                        backgroundColor: '#3a5a3a',
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Economic Information */}
            {(() => {
              const economicProfile = getWorldEconomicProfile(system.primaryWorld);
              const tradeInfo = getSystemTradeInfo(system, sector.systems);
              
              return (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Economic Profile</div>
                  
                  {/* Economic Value Bar */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#aaa', fontSize: '11px' }}>Economic Value</span>
                      <span style={{ 
                        color: economicProfile.economicValue >= 70 ? '#4ecdc4' :
                               economicProfile.economicValue >= 40 ? '#ffe66d' : '#ff6b6b',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {economicProfile.economicValue}/100
                      </span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      backgroundColor: '#1a1a1a', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${economicProfile.economicValue}%`,
                        height: '100%',
                        backgroundColor: economicProfile.economicValue >= 70 ? '#4ecdc4' :
                                         economicProfile.economicValue >= 40 ? '#ffe66d' : '#ff6b6b',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    {tradeInfo.isTradeHub && (
                      <div style={{
                        marginTop: '6px',
                        padding: '4px 8px',
                        backgroundColor: '#ff8c00',
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textAlign: 'center',
                        textTransform: 'uppercase'
                      }}>
                        ⭐ Major Trade Hub
                      </div>
                    )}
                  </div>

                  {/* Exports */}
                  {economicProfile.resourceExport.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ color: '#4ecdc4', fontSize: '11px', marginBottom: '6px', fontWeight: '600' }}>
                        📦 Exports
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {economicProfile.resourceExport.map((resource: string, index: number) => (
                          <span
                            key={index}
                            style={{
                              backgroundColor: '#1a3a3a',
                              color: '#4ecdc4',
                              padding: '3px 6px',
                              borderRadius: '3px',
                              fontSize: '10px',
                              border: '1px solid #4ecdc4'
                            }}
                          >
                            {resource}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Imports */}
                  {economicProfile.resourceImport.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ color: '#ff6b6b', fontSize: '11px', marginBottom: '6px', fontWeight: '600' }}>
                        📥 Imports
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {economicProfile.resourceImport.map((resource: string, index: number) => (
                          <span
                            key={index}
                            style={{
                              backgroundColor: '#3a1a1a',
                              color: '#ff6b6b',
                              padding: '3px 6px',
                              borderRadius: '3px',
                              fontSize: '10px',
                              border: '1px solid #ff6b6b'
                            }}
                          >
                            {resource}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trade Partners */}
                  {tradeInfo.tradeRouteCount > 0 && (
                    <div>
                      <div style={{ color: '#ffe66d', fontSize: '11px', marginBottom: '6px', fontWeight: '600' }}>
                        🤝 Trade Partners ({tradeInfo.tradeRouteCount})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {tradeInfo.tradePartners.map((partner: string, index: number) => (
                          <div
                            key={index}
                            style={{
                              backgroundColor: '#3a3a1a',
                              color: '#ffe66d',
                              padding: '4px 8px',
                              borderRadius: '3px',
                              fontSize: '11px',
                              border: '1px solid #ffe66d'
                            }}
                          >
                            {partner}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No trade information */}
                  {tradeInfo.tradeRouteCount === 0 && economicProfile.resourceExport.length === 0 && (
                    <div style={{ 
                      color: '#666', 
                      fontSize: '11px', 
                      fontStyle: 'italic',
                      padding: '8px',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '4px'
                    }}>
                      Limited economic activity
                    </div>
                  )}
                </div>
              );
            })()}
          </details>
        </div>

        {/* Secondary Worlds */}
        {system.secondaryWorlds && system.secondaryWorlds.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
              Secondary Worlds ({system.secondaryWorlds.length})
            </h3>
            <div style={{ color: '#aaa', fontSize: '14px' }}>
              Secondary world generation not yet implemented.
            </div>
          </div>
        )}

        {/* Points of Interest */}
        {system.pointsOfInterest && system.pointsOfInterest.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
              Points of Interest ({system.pointsOfInterest.length})
            </h3>
            <div style={{ color: '#aaa', fontSize: '14px' }}>
              Points of interest generation not yet implemented.
            </div>
          </div>
        )}

        {/* Routes */}
        {system.routes && system.routes.length > 0 && (
          <div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
              Connections ({system.routes.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {system.routes.map((route: Route, index: number) => {
                const targetSystem = sector.systems.find((s: StarSystem) => s.id === route.systemId);
                if (!targetSystem) return null;
                return (
                  <div
                    key={index}
                    style={{
                      padding: '8px',
                      backgroundColor: route.isTradeRoute ? '#3a3a1a' : '#2a2a2a',
                      borderRadius: '4px',
                      border: `1px solid ${route.isTradeRoute ? '#ff8c00' : '#4a9eff'}`,
                    }}
                  >
                    <div style={{ color: '#fff', fontSize: '14px' }}>{targetSystem.name}</div>
                    {route.isTradeRoute && (
                      <div style={{ color: '#ff8c00', fontSize: '11px', marginTop: '4px' }}>Trade Route</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        </div>
      </div>

      {storeFaction && storeLocationId && (
        <div
          className="world-asset-store-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="world-asset-store-title"
        >
          <div className="world-asset-store-modal__overlay" onClick={handleCloseAssetStore} />
          <div className="world-asset-store-modal__panel">
            <header className="world-asset-store-modal__header">
              <div>
                <p className="world-asset-store-modal__eyebrow">{storeFaction.name}</p>
                <h3 id="world-asset-store-title">Asset Procurement</h3>
                <p className="world-asset-store-modal__subtitle">
                  Available FacCreds: {storeFaction.facCreds} • Deployment: {storeSystemName}
                </p>
              </div>
              <button
                type="button"
                className="world-asset-store-modal__close"
                onClick={handleCloseAssetStore}
                aria-label="Close asset store"
              >
                ×
              </button>
            </header>
            <div className="world-asset-store-modal__body">
              <AssetList factionId={storeFaction.id} onPurchase={handlePurchaseFromWorld} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

