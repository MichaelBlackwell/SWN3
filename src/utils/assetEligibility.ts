/**
 * Asset Eligibility Utilities
 * 
 * Per SWN rules, newly purchased or refitted assets cannot attack, defend,
 * or use special abilities until the beginning of the faction's next turn.
 */

import type { FactionAsset } from '../types/faction';

/**
 * Check if an asset can participate in combat (attack or defend)
 * Assets purchased or refitted on the current turn cannot act.
 * 
 * @param asset The asset to check
 * @param currentTurn The current game turn number
 * @returns true if the asset can attack/defend, false if it's still "assembling"
 */
export function canAssetAct(asset: FactionAsset, currentTurn: number): boolean {
  // Check if asset was purchased this turn
  if (asset.purchasedTurn !== undefined && asset.purchasedTurn >= currentTurn) {
    return false;
  }
  
  // Check if asset was refitted this turn
  if (asset.refittedTurn !== undefined && asset.refittedTurn >= currentTurn) {
    return false;
  }
  
  return true;
}

/**
 * Get a human-readable reason why an asset cannot act
 * 
 * @param asset The asset to check
 * @param currentTurn The current game turn number
 * @returns A reason string, or null if the asset can act
 */
export function getAssetIneligibilityReason(asset: FactionAsset, currentTurn: number): string | null {
  if (asset.purchasedTurn !== undefined && asset.purchasedTurn >= currentTurn) {
    return 'Newly purchased - cannot act until next turn';
  }
  
  if (asset.refittedTurn !== undefined && asset.refittedTurn >= currentTurn) {
    return 'Recently refitted - cannot act until next turn';
  }
  
  return null;
}

/**
 * Check if an asset can use its special abilities
 * Same rules as combat - newly purchased/refitted assets cannot use abilities
 * 
 * @param asset The asset to check
 * @param currentTurn The current game turn number
 * @returns true if the asset can use abilities
 */
export function canAssetUseAbility(asset: FactionAsset, currentTurn: number): boolean {
  return canAssetAct(asset, currentTurn);
}


