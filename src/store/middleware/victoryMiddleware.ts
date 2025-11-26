/**
 * Redux Middleware for Victory Condition Detection
 * 
 * This middleware listens for actions that could destroy a homeworld Base of Influence
 * and checks if a faction has achieved victory (all other factions' homeworld bases destroyed).
 * 
 * Monitored actions:
 * - factions/inflictDamage: When an asset takes damage and may be destroyed
 * - factions/removeAsset: When an asset is directly removed
 */

import type { Middleware, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '../rootReducer';
import { eliminateFaction, setVictory } from '../slices/gameStateSlice';
import {
  checkVictoryCondition,
  getEliminatedFactions,
} from '../../utils/victoryConditions';

/**
 * Check if the action is an inflictDamage action
 */
function isInflictDamageAction(action: UnknownAction): boolean {
  return action.type === 'factions/inflictDamage';
}

/**
 * Check if the action is a removeAsset action
 */
function isRemoveAssetAction(action: UnknownAction): boolean {
  return action.type === 'factions/removeAsset';
}

/**
 * Victory detection middleware
 * Runs AFTER the reducer has processed the action to check the new state
 */
export const victoryMiddleware: Middleware<object, RootState> = (store) => (next) => (action) => {
  // Get state BEFORE action
  const stateBefore = store.getState();
  const eliminatedBefore = stateBefore.gameState?.eliminatedFactionIds || [];
  
  // Let the action process first
  const result = next(action);
  
  // Skip if game already has a victor
  const stateAfter = store.getState();
  if (stateAfter.gameState?.gameStatus === 'victory') {
    return result;
  }
  
  // Only check on relevant actions (cast to UnknownAction for type guard checks)
  const typedAction = action as UnknownAction;
  if (!isInflictDamageAction(typedAction) && !isRemoveAssetAction(typedAction)) {
    return result;
  }
  
  const factions = stateAfter.factions.factions;
  
  // Skip if no factions
  if (!factions || factions.length < 2) {
    return result;
  }
  
  // Get newly eliminated factions by comparing before/after state
  const eliminatedAfter = getEliminatedFactions(factions);
  const newlyEliminated = eliminatedAfter.filter((id) => !eliminatedBefore.includes(id));
  
  // Dispatch elimination actions for newly eliminated factions
  for (const factionId of newlyEliminated) {
    store.dispatch(eliminateFaction(factionId));
  }
  
  // Check for victory condition
  const victoryResult = checkVictoryCondition(factions);
  
  if (victoryResult.hasVictor && victoryResult.victorId) {
    // We have a winner!
    store.dispatch(setVictory({ victorFactionId: victoryResult.victorId }));
  }
  
  return result;
};

export default victoryMiddleware;

