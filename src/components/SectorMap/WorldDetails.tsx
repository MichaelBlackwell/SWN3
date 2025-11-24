import { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import { selectSystem } from '../../store/slices/sectorSlice';
import { getAssetById } from '../../data/assetLibrary';
import { 
  selectCanStageAction, 
  selectCurrentPhase,
  selectActionStaged,
  selectActionCommitted,
  selectMovementMode,
  startMovementMode,
  stageAction,
  stageActionWithPayload,
  commitAction,
} from '../../store/slices/turnSlice';
import { assetHasAbility, isFreeAction, executeAbility } from '../../utils/assetAbilities';
import { store } from '../../store/store';
import { showNotification } from '../NotificationContainer';
import { inflictDamage } from '../../store/slices/factionsSlice';
import './WorldDetails.css';
import { resolveCombat } from '../../utils/combatResolver';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromTargetFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import ExpandInfluenceButton from '../FactionManager/ExpandInfluenceButton';

const POPULATION_LABELS = [
  'Failed Colony',
  'Outpost',
  'Fewer than a million',
  'Several million',
  'Hundreds of millions',
  'Billions',
  'Alien inhabitants',
];

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
  const movementMode = useSelector(selectMovementMode);

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

  const system = sector.systems.find((s) => s.id === selectedSystemId);
  if (!system) return null;

  const handleClose = () => {
    dispatch(selectSystem(null));
    // Return focus to the map container
    const mapContainer = document.querySelector('.sector-map-container');
    if (mapContainer instanceof HTMLElement) {
      mapContainer.focus();
    }
  };

  const selectedFaction = selectedFactionId
    ? factions.find((f) => f.id === selectedFactionId)
    : null;

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
    const targetFaction = factions.find((f) => f.id === targetFactionId);
    const targetAsset = targetFaction?.assets.find((a) => a.id === targetAssetId);
    const targetAssetDef = targetAsset ? getAssetById(targetAsset.definitionId) : null;

    if (!targetFaction || !targetAsset || !targetAssetDef) {
      showNotification('Target asset not found', 'error');
      return;
    }

    // Find available attacker assets from selected faction in the same system
    const attackerAssets = selectedFaction.assets.filter(
      (asset) => asset.location === system.id
    );

    // Filter to only assets that can attack
    const availableAttackers = attackerAssets.filter((asset) => {
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
      },
      attackPattern,
      counterattackPattern
    );

    // Store HP before combat for narrative generation
    const attackerAssetHpBefore = attackerAsset.hp;
    const attackerFactionHpBefore = selectedFaction.attributes.hp;
    const defenderAssetHpBefore = targetAsset.hp;
    const defenderFactionHpBefore = targetFaction.attributes.hp;

    // Apply damage
    if (result.attackDamage > 0) {
      dispatch(
        inflictDamage({
          factionId: targetFactionId,
          assetId: targetAssetId,
          damage: result.attackDamage,
        })
      );
    }

    if (result.counterattackDamage > 0) {
      dispatch(
        inflictDamage({
          factionId: selectedFactionId,
          assetId: attackerAsset.id,
          damage: result.counterattackDamage,
        })
      );
    }

    // Generate narrative
    const getSystemHelper = (id: string) => sector.systems.find((s) => s.id === id);
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

    // Commit the action (this advances to News phase)
    dispatch(commitAction());

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
  };

  const handleMove = (assetId: string, factionId: string) => {
    if (!canStageAction) {
      showNotification('Cannot start movement: not in Action phase or action already staged', 'error');
      return;
    }

    const faction = factions.find((f) => f.id === factionId);
    if (!faction) {
      showNotification('Faction not found', 'error');
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

  const handleRepair = (assetId: string, factionId: string) => {
    if (!canStageAction) {
      showNotification('Cannot repair: not in Action phase or action already staged', 'error');
      return;
    }
    // TODO: Implement repair action (subtask 11.2)
    showNotification('Repair action not yet implemented', 'info');
  };

  const handleUseAbility = (assetId: string, factionId: string) => {
    const faction = factions.find((f) => f.id === factionId);
    if (!faction) {
      showNotification('Faction not found', 'error');
      return;
    }

    const asset = faction.assets.find((a) => a.id === assetId);
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

    if (!result.success && result.message.includes('handled through')) {
      // Movement abilities are handled separately
      showNotification(result.message, 'info');
      return;
    }

    if (!result.success && result.message.includes('not yet implemented')) {
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

  // Check if buttons should be disabled
  const areActionButtonsDisabled = currentPhase !== 'Action' || actionStaged || actionCommitted || movementMode.active;

  const populationLabel = POPULATION_LABELS[system.primaryWorld.population] || 'Unknown';

  // Find factions that have this system as their homeworld
  const homeworldFactions = factions.filter((faction) => faction.homeworld === system.id);

  // Find all assets in this system (from any faction)
  const assetsInSystem = factions.flatMap((faction) =>
    faction.assets
      .filter((asset) => asset.location === system.id)
      .map((asset) => ({ ...asset, factionId: faction.id, factionName: faction.name }))
  );

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label={`Details for ${system.name}`}
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
      <div style={{ padding: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '24px' }}>{system.name}</h2>
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
              <div style={{ color: '#fff', fontSize: '14px' }}>TL{system.primaryWorld.techLevel}</div>
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
                {system.primaryWorld.tags.map((tag, index) => (
                  <span
                    key={index}
                    style={{
                      backgroundColor: '#444',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                    title={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Trade Codes */}
          {system.primaryWorld.tradeCodes && system.primaryWorld.tradeCodes.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Trade Codes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {system.primaryWorld.tradeCodes.map((code, index) => (
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

        {/* Factions Section */}
        {(homeworldFactions.length > 0 || assetsInSystem.length > 0) && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
              Factions & Assets
            </h3>

            {/* Homeworld Factions */}
            {homeworldFactions.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>
                  Homeworld of:
                </div>
                {homeworldFactions.map((faction) => {
                  const factionAssets = assetsInSystem.filter((asset) => asset.factionId === faction.id);
                  return (
                    <div
                      key={faction.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '4px',
                        border: '1px solid #4a9eff',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{faction.name}</div>
                          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>{faction.type}</div>
                        </div>
                        <div
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#4a9eff',
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}
                        >
                          Homeworld
                        </div>
                      </div>

                      {/* Faction Attributes */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px', fontSize: '11px' }}>
                        <div style={{ textAlign: 'center', padding: '4px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
                          <div style={{ color: '#aaa' }}>HP</div>
                          <div style={{ color: '#fff' }}>
                            {faction.attributes.hp}/{faction.attributes.maxHp}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
                          <div style={{ color: '#aaa' }}>Force</div>
                          <div style={{ color: '#fff' }}>{faction.attributes.force}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
                          <div style={{ color: '#aaa' }}>Cunning</div>
                          <div style={{ color: '#fff' }}>{faction.attributes.cunning}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
                          <div style={{ color: '#aaa' }}>Wealth</div>
                          <div style={{ color: '#fff' }}>{faction.attributes.wealth}</div>
                        </div>
                      </div>

                      {/* Faction Tags */}
                      {faction.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                          {faction.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                padding: '2px 6px',
                                backgroundColor: '#4a9eff',
                                color: '#fff',
                                borderRadius: '3px',
                                fontSize: '10px',
                              }}
                            >
                              {tag}
                            </span>
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
                            {factionAssets.map((asset) => {
                              const assetDef = getAssetById(asset.definitionId);
                              const categoryColor = 
                                assetDef?.category === 'Force' ? '#ff6b6b' :
                                assetDef?.category === 'Cunning' ? '#4ecdc4' :
                                assetDef?.category === 'Wealth' ? '#ffe66d' : '#646cff';
                              
                              const isSelectedFactionAsset = selectedFactionId === faction.id;
                              const canMove = isSelectedFactionAsset && faction.facCreds >= 1;
                              const needsRepair = asset.hp < asset.maxHp;
                              const hasAbility = assetDef ? assetHasAbility(asset.definitionId) : false;
                              
                              return (
                                <div
                                  key={asset.id}
                                  style={{
                                    padding: '8px 10px',
                                    backgroundColor: '#1a1a1a',
                                    borderLeft: `3px solid ${categoryColor}`,
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    border: '1px solid #333',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ color: '#fff', fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>
                                        {assetDef?.name || asset.definitionId}
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ 
                                          color: categoryColor, 
                                          fontSize: '10px', 
                                          fontWeight: '500',
                                          textTransform: 'uppercase'
                                        }}>
                                          {assetDef?.category || 'Unknown'}
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
                                          backgroundColor: '#6b4a9e',
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
                                          <button
                                            onClick={() => handleMove(asset.id, faction.id)}
                                            disabled={areActionButtonsDisabled || !canMove}
                                            style={{
                                              padding: '4px 8px',
                                              backgroundColor: areActionButtonsDisabled || !canMove ? '#555' : '#4ecdc4',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: '500',
                                              cursor: areActionButtonsDisabled || !canMove ? 'not-allowed' : 'pointer',
                                              opacity: areActionButtonsDisabled || !canMove ? 0.5 : 1,
                                              whiteSpace: 'nowrap',
                                            }}
                                            title="Move this asset (costs 1 FacCred)"
                                          >
                                            Move
                                          </button>
                                          {needsRepair && (
                                            <button
                                              onClick={() => handleRepair(asset.id, faction.id)}
                                              disabled={areActionButtonsDisabled}
                                              style={{
                                                padding: '4px 8px',
                                                backgroundColor: areActionButtonsDisabled ? '#555' : '#ff8c00',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '500',
                                                cursor: areActionButtonsDisabled ? 'not-allowed' : 'pointer',
                                                opacity: areActionButtonsDisabled ? 0.5 : 1,
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
                                              disabled={areActionButtonsDisabled}
                                              style={{
                                                padding: '4px 8px',
                                                backgroundColor: areActionButtonsDisabled ? '#555' : '#9b59b6',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '500',
                                                cursor: areActionButtonsDisabled ? 'not-allowed' : 'pointer',
                                                opacity: areActionButtonsDisabled ? 0.5 : 1,
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
                                            disabled={areActionButtonsDisabled}
                                            style={{
                                              padding: '4px 8px',
                                              backgroundColor: areActionButtonsDisabled ? '#555' : '#dc3545',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: '500',
                                              cursor: areActionButtonsDisabled ? 'not-allowed' : 'pointer',
                                              opacity: areActionButtonsDisabled ? 0.5 : 1,
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
                    </div>
                  );
                })}
              </div>
            )}

            {/* Assets from other factions (not homeworld) */}
            {assetsInSystem.filter((asset) => !homeworldFactions.some((f) => f.id === asset.factionId)).length > 0 && (
              <div>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>
                  Other Assets:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {assetsInSystem
                    .filter((asset) => !homeworldFactions.some((f) => f.id === asset.factionId))
                    .map((asset) => {
                      const assetDef = getAssetById(asset.definitionId);
                      const categoryColor = 
                        assetDef?.category === 'Force' ? '#ff6b6b' :
                        assetDef?.category === 'Cunning' ? '#4ecdc4' :
                        assetDef?.category === 'Wealth' ? '#ffe66d' : '#646cff';
                      
                      const isSelectedFactionAsset = selectedFactionId === asset.factionId;
                      const assetFaction = factions.find((f) => f.id === asset.factionId);
                      const canMove = isSelectedFactionAsset && assetFaction && assetFaction.facCreds >= 1;
                      const needsRepair = asset.hp < asset.maxHp;
                      const hasAbility = assetDef?.specialFlags.hasAction || false;
                      
                      return (
                        <div
                          key={asset.id}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: '#2a2a2a',
                            borderLeft: `3px solid ${categoryColor}`,
                            borderRadius: '4px',
                            border: '1px solid #555',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                                {assetDef?.name || asset.definitionId}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ color: '#aaa', fontSize: '10px', fontWeight: '500' }}>
                                  {asset.factionName}
                                </span>
                                <span style={{ 
                                  color: categoryColor, 
                                  fontSize: '10px', 
                                  fontWeight: '500',
                                  textTransform: 'uppercase'
                                }}>
                                  {assetDef?.category || 'Unknown'}
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
                                  backgroundColor: '#6b4a9e',
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
                                  <button
                                    onClick={() => handleMove(asset.id, asset.factionId)}
                                    disabled={areActionButtonsDisabled || !canMove}
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: areActionButtonsDisabled || !canMove ? '#555' : '#4ecdc4',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      cursor: areActionButtonsDisabled || !canMove ? 'not-allowed' : 'pointer',
                                      opacity: areActionButtonsDisabled || !canMove ? 0.5 : 1,
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Move this asset (costs 1 FacCred)"
                                  >
                                    Move
                                  </button>
                                  {needsRepair && (
                                    <button
                                      onClick={() => handleRepair(asset.id, asset.factionId)}
                                      disabled={areActionButtonsDisabled}
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: areActionButtonsDisabled ? '#555' : '#ff8c00',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        cursor: areActionButtonsDisabled ? 'not-allowed' : 'pointer',
                                        opacity: areActionButtonsDisabled ? 0.5 : 1,
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
                                      disabled={areActionButtonsDisabled}
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: areActionButtonsDisabled ? '#555' : '#9b59b6',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        cursor: areActionButtonsDisabled ? 'not-allowed' : 'pointer',
                                        opacity: areActionButtonsDisabled ? 0.5 : 1,
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
                                    disabled={areActionButtonsDisabled}
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: areActionButtonsDisabled ? '#555' : '#dc3545',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      cursor: areActionButtonsDisabled ? 'not-allowed' : 'pointer',
                                      opacity: areActionButtonsDisabled ? 0.5 : 1,
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
        )}

        {/* Routes */}
        {system.routes && system.routes.length > 0 && (
          <div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
              Connections ({system.routes.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {system.routes.map((route, index) => {
                const targetSystem = sector.systems.find((s) => s.id === route.systemId);
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

        {/* Expand Influence button for selected faction */}
        {selectedFaction && currentPhase === 'Action' && !actionStaged && !actionCommitted && (
          <ExpandInfluenceButton
            factionId={selectedFaction.id}
            currentSystemId={system.id}
            disabled={areActionButtonsDisabled}
          />
        )}
      </div>
    </div>
  );
}

