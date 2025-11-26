/**
 * Redux Middleware for Event-Driven Goal Tracking
 * 
 * This middleware listens for specific Redux actions and updates faction goals
 * that progress based on events (combat, asset destruction, etc.)
 * 
 * Event-based goals tracked:
 * - Military Conquest: Destroy Force assets
 * - Commercial Expansion: Destroy Wealth assets
 * - Intelligence Coup: Destroy Cunning assets
 * - Blood the Enemy: Inflict HP damage
 * - Invincible Valor: Destroy high-rating Force asset
 * - Expand Influence: Place Base of Influence on new planet
 * - Inside Enemy Territory: Stealth assets on enemy worlds
 * - Destroy the Foe: Destroy rival faction
 * - Planetary Seizure: Complete planet seizure campaign
 */

import type { AnyAction, Middleware } from '@reduxjs/toolkit';
import type { RootState } from '../rootReducer';
import { updateGoalProgress } from '../slices/factionsSlice';
import { getAssetById } from '../../data/assetLibrary';
import type { Faction } from '../../types/faction';

/**
 * Track asset destructions for combat-related goals
 */
function handleAssetDestruction(
  state: RootState,
  assetDefinitionId: string,
  assetId: string,
  _factionId: string,
  destroyedByFactionId?: string
): ReturnType<typeof updateGoalProgress>[] {
  const actions: ReturnType<typeof updateGoalProgress>[] = [];
  
  // Get asset definition
  const assetDef = getAssetById(assetDefinitionId);
  if (!assetDef) return actions;
  
  // If we know who destroyed it, check their goals
  if (destroyedByFactionId) {
    const attackerFaction = state.factions.factions.find((faction: Faction) => faction.id === destroyedByFactionId);
    if (!attackerFaction || !attackerFaction.goal || attackerFaction.goal.isCompleted) {
      return actions;
    }
    
    const goal = attackerFaction.goal;
    
    // Military Conquest: Destroy Force assets equal to your Force rating
    if (goal.type === 'Military Conquest' && assetDef.category === 'Force') {
      const newProgress = goal.progress.current + 1;
      actions.push(
        updateGoalProgress({
          factionId: destroyedByFactionId,
          current: newProgress,
          metadata: {
            ...goal.progress.metadata,
            lastAssetDestroyed: assetId,
            lastAssetType: assetDef.name,
          },
        })
      );
    }
    
    // Commercial Expansion: Destroy Wealth assets equal to your Wealth rating
    if (goal.type === 'Commercial Expansion' && assetDef.category === 'Wealth') {
      const newProgress = goal.progress.current + 1;
      actions.push(
        updateGoalProgress({
          factionId: destroyedByFactionId,
          current: newProgress,
          metadata: {
            ...goal.progress.metadata,
            lastAssetDestroyed: assetId,
            lastAssetType: assetDef.name,
          },
        })
      );
    }
    
    // Intelligence Coup: Destroy Cunning assets equal to your Cunning rating
    if (goal.type === 'Intelligence Coup' && assetDef.category === 'Cunning') {
      const newProgress = goal.progress.current + 1;
      actions.push(
        updateGoalProgress({
          factionId: destroyedByFactionId,
          current: newProgress,
          metadata: {
            ...goal.progress.metadata,
            lastAssetDestroyed: assetId,
            lastAssetType: assetDef.name,
          },
        })
      );
    }
    
    // Invincible Valor: Destroy a Force asset with higher rating than your Force
    if (
      goal.type === 'Invincible Valor' &&
      assetDef.category === 'Force' &&
      assetDef.requiredRating > attackerFaction.attributes.force
    ) {
      actions.push(
        updateGoalProgress({
          factionId: destroyedByFactionId,
          current: 1, // This goal completes immediately
          metadata: {
            ...goal.progress.metadata,
            destroyedAssetId: assetId,
            destroyedAssetType: assetDef.name,
            destroyedAssetRating: assetDef.requiredRating,
            attackerForceRating: attackerFaction.attributes.force,
          },
        })
      );
    }
  }
  
  return actions;
}

/**
 * Track damage dealt for Blood the Enemy goal
 */
function handleDamageDealt(
  state: RootState,
  damage: number,
  dealerFactionId?: string
): ReturnType<typeof updateGoalProgress>[] {
  const actions: ReturnType<typeof updateGoalProgress>[] = [];
  
  if (!dealerFactionId) return actions;
  
  const faction = state.factions.factions.find((faction: Faction) => faction.id === dealerFactionId);
  if (!faction || !faction.goal || faction.goal.isCompleted) {
    return actions;
  }
  
  const goal = faction.goal;
  
  // Blood the Enemy: Inflict HP damage equal to Force + Cunning + Wealth
  if (goal.type === 'Blood the Enemy') {
    const newProgress = goal.progress.current + damage;
    actions.push(
      updateGoalProgress({
        factionId: dealerFactionId,
        current: newProgress,
        metadata: {
          ...goal.progress.metadata,
          totalDamageDealt: newProgress,
          lastDamageAmount: damage,
        },
      })
    );
  }
  
  return actions;
}

/**
 * Track Base of Influence placement for Expand Influence goal
 */
function handleBasePlacement(
  state: RootState,
  systemId: string,
  factionId: string
): ReturnType<typeof updateGoalProgress>[] {
  const actions: ReturnType<typeof updateGoalProgress>[] = [];
  
  const faction = state.factions.factions.find((faction: Faction) => faction.id === factionId);
  if (!faction || !faction.goal || faction.goal.isCompleted) {
    return actions;
  }
  
  const goal = faction.goal;
  
  // Expand Influence: Plant a Base of Influence on a new planet
  if (goal.type === 'Expand Influence') {
    const metadata = goal.progress.metadata as { basePlacedOn?: string } | undefined;
    const previousBase = metadata?.basePlacedOn;
    
    // Check if this is a new planet (not the one tracked in metadata)
    if (systemId !== previousBase && systemId !== faction.homeworld) {
      actions.push(
        updateGoalProgress({
          factionId,
          current: 1, // This goal completes immediately
          metadata: {
            basePlacedOn: systemId,
            placedOnNewPlanet: true,
          },
        })
      );
    }
  }
  
  return actions;
}

/**
 * Track asset stealthing for Inside Enemy Territory goal
 */
function handleAssetStealth(
  state: RootState,
  assetId: string,
  factionId: string,
  location: string
): ReturnType<typeof updateGoalProgress>[] {
  const actions: ReturnType<typeof updateGoalProgress>[] = [];
  
  const faction = state.factions.factions.find((faction: Faction) => faction.id === factionId);
  if (!faction || !faction.goal || faction.goal.isCompleted) {
    return actions;
  }
  
  const goal = faction.goal;
  
  // Inside Enemy Territory: Stealth assets on enemy worlds equal to Cunning
  if (goal.type === 'Inside Enemy Territory') {
    // Only count if not on homeworld
    if (location !== faction.homeworld) {
      const metadata = goal.progress.metadata as { 
        trackedAssetIds?: string[];
        stealthedCount?: number;
      } | undefined;
      
      const trackedAssets = metadata?.trackedAssetIds || [];
      
      // Add this asset to tracked list if not already there
      if (!trackedAssets.includes(assetId)) {
        const newTrackedAssets = [...trackedAssets, assetId];
        const newProgress = newTrackedAssets.length;
        
        actions.push(
          updateGoalProgress({
            factionId,
            current: newProgress,
            metadata: {
              ...metadata,
              trackedAssetIds: newTrackedAssets,
              stealthedCount: newProgress,
              lastStealthedAsset: assetId,
            },
          })
        );
      }
    }
  }
  
  return actions;
}

/**
 * Track planet seizure completion for Planetary Seizure goal
 */
function handlePlanetSeizure(
  state: RootState,
  factionId: string,
  targetSystemId: string
): ReturnType<typeof updateGoalProgress>[] {
  const actions: ReturnType<typeof updateGoalProgress>[] = [];
  
  const faction = state.factions.factions.find((faction: Faction) => faction.id === factionId);
  if (!faction || !faction.goal || faction.goal.isCompleted) {
    return actions;
  }
  
  const goal = faction.goal;
  
  // Planetary Seizure: Seize a planet as planetary government
  if (goal.type === 'Planetary Seizure') {
    actions.push(
      updateGoalProgress({
        factionId,
        current: 1, // This goal completes immediately upon seizure
        metadata: {
          ...goal.progress.metadata,
          seizedPlanetId: targetSystemId,
          goalCompleted: true,
        },
      })
    );
  }
  
  return actions;
}

/**
 * Track faction destruction for Destroy the Foe goal
 */
function handleFactionDestruction(
  state: RootState,
  destroyedFactionId: string
): ReturnType<typeof updateGoalProgress>[] {
  const actions: ReturnType<typeof updateGoalProgress>[] = [];
  
  // Check all factions for "Destroy the Foe" goals targeting this faction
  for (const faction of state.factions.factions) {
    if (!faction.goal || faction.goal.isCompleted) continue;
    
    const goal = faction.goal;
    
    // Destroy the Foe: Destroy a rival faction
    if (goal.type === 'Destroy the Foe') {
      const metadata = goal.progress.metadata as { targetFactionId?: string } | undefined;
      const targetFactionId = metadata?.targetFactionId;
      
      // Check if this is the targeted faction
      if (targetFactionId === destroyedFactionId) {
        actions.push(
          updateGoalProgress({
            factionId: faction.id,
            current: 1, // This goal completes immediately
            metadata: {
              ...metadata,
              destroyedFactionId,
              goalCompleted: true,
            },
          })
        );
      }
    }
  }
  
  return actions;
}

/**
 * Track attack actions for Peaceable Kingdom goal (reset counter if attack occurs)
 */
function handleAttackAction(
  state: RootState,
  attackerFactionId: string
): ReturnType<typeof updateGoalProgress>[] {
  const actions: ReturnType<typeof updateGoalProgress>[] = [];
  
  const faction = state.factions.factions.find((faction: Faction) => faction.id === attackerFactionId);
  if (!faction || !faction.goal || faction.goal.isCompleted) {
    return actions;
  }
  
  const goal = faction.goal;
  
  // Peaceable Kingdom: Don't attack for 4 turns (reset if attack occurs)
  if (goal.type === 'Peaceable Kingdom') {
    actions.push(
      updateGoalProgress({
        factionId: attackerFactionId,
        current: 0, // Reset progress
        metadata: {
          turnsWithoutAttack: 0,
          lastAttackTurn: state.turn.turn,
        },
      })
    );
  }
  
  return actions;
}

/**
 * Main middleware function
 */
export const goalTrackingMiddleware: Middleware<{}, RootState> = (storeAPI) => (next) => (action) => {
  // Capture state BEFORE action execution for asset tracking
  const stateBefore = storeAPI.getState();
  
  // Execute the action to update the state
  const result = next(action);
  const stateAfter = storeAPI.getState();
  
  let goalUpdateActions: ReturnType<typeof updateGoalProgress>[] = [];
  const typedAction = action as AnyAction;
  
  // Handle different action types
  switch (typedAction.type) {
    case 'factions/addBaseOfInfluence': {
      // Base placement
      const { factionId, systemId } = typedAction.payload as { factionId: string; systemId: string };
      goalUpdateActions = handleBasePlacement(stateAfter, systemId, factionId);
      break;
    }
    
    case 'factions/updateAsset': {
      // Check if asset was stealthed
      const { factionId, assetId, updates } = typedAction.payload as {
        factionId: string;
        assetId: string;
        updates: { stealthed?: boolean };
      };
      if (updates.stealthed === true) {
        const faction = stateAfter.factions.factions.find((faction: Faction) => faction.id === factionId);
        const asset = faction?.assets.find((a) => a.id === assetId);
        if (asset) {
          goalUpdateActions = handleAssetStealth(stateAfter, assetId, factionId, asset.location);
        }
      }
      break;
    }
    
    case 'factions/removeFaction': {
      // Faction destruction (check stateBefore to see if goal targeted this faction)
      const destroyedFactionId = typedAction.payload as string;
      goalUpdateActions = handleFactionDestruction(stateBefore, destroyedFactionId);
      break;
    }
    
    case 'factions/completeSeizePlanetCampaign': {
      // Planet seizure completion
      const { factionId, targetSystemId } = typedAction.payload as { 
        factionId: string; 
        targetSystemId: string;
      };
      goalUpdateActions = handlePlanetSeizure(stateAfter, factionId, targetSystemId);
      break;
    }
    
    // Custom action for tracking combat outcomes
    case 'combat/resolved': {
      const {
        attackerFactionId,
        defenderFactionId,
        attackerDamage,
        defenderDamage,
        destroyedAssetId,
        destroyedAssetDefinitionId,
      } = typedAction.payload as {
        attackerFactionId?: string;
        defenderFactionId?: string;
        attackerDamage: number;
        defenderDamage: number;
        destroyedAssetId?: string;
        destroyedAssetDefinitionId?: string;
      };
      
      // Track attack action (for Peaceable Kingdom)
      if (attackerFactionId) {
        goalUpdateActions.push(...handleAttackAction(stateAfter, attackerFactionId));
      }
      
      // Track damage dealt (for Blood the Enemy)
      if (attackerDamage > 0 && attackerFactionId) {
        goalUpdateActions.push(...handleDamageDealt(stateAfter, attackerDamage, attackerFactionId));
      }
      if (defenderDamage > 0 && defenderFactionId) {
        goalUpdateActions.push(...handleDamageDealt(stateAfter, defenderDamage, defenderFactionId));
      }
      
      // Track asset destruction (for conquest goals)
      if (destroyedAssetId && destroyedAssetDefinitionId && defenderFactionId) {
        goalUpdateActions.push(...handleAssetDestruction(
          stateAfter, 
          destroyedAssetDefinitionId,
          destroyedAssetId, 
          defenderFactionId, 
          attackerFactionId
        ));
      }
      break;
    }
  }
  
  // Dispatch all goal update actions
  for (const updateAction of goalUpdateActions) {
    storeAPI.dispatch(updateAction as AnyAction);
  }
  
  return result;
};

