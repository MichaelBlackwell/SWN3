/**
 * Refit Asset Validation Utilities
 * 
 * Per SWN rules:
 * - Change one asset to any other asset of the same type (category)
 * - If the new asset is more expensive, pay the difference
 * - The asset must be on a planet that allows purchase of the new asset
 * - A refitted asset is unable to attack or defend until the beginning of the faction's next turn
 */

import type { Faction, FactionAsset } from '../types/faction';
import type { AssetDefinition } from '../types/asset';
import { getAssetById, getAssetsByCategory } from '../data/assetLibrary';
import type { StarSystem } from '../types/sector';

export interface RefitValidationResult {
  valid: boolean;
  reason?: string;
}

export interface RefitCostResult {
  cost: number; // Cost to refit (difference in price, or 0 if downgrading)
  refund: number; // Amount refunded if downgrading (always 0 per SWN rules - no refunds)
  originalCost: number;
  newCost: number;
}

/**
 * Get all valid refit targets for an asset
 * Must be same category, affordable, and compatible with the world's tech level
 */
export function getValidRefitTargets(
  faction: Faction,
  asset: FactionAsset,
  worldTechLevel: number
): AssetDefinition[] {
  const currentAssetDef = getAssetById(asset.definitionId);
  if (!currentAssetDef) return [];

  const category = currentAssetDef.category;
  const allCategoryAssets = getAssetsByCategory(category);

  return allCategoryAssets.filter((targetAsset) => {
    // Can't refit to the same asset
    if (targetAsset.id === currentAssetDef.id) return false;

    // Check faction has sufficient rating for the target asset
    const requiredRating = targetAsset.requiredRating;
    let factionRating = 0;
    switch (category) {
      case 'Force':
        factionRating = faction.attributes.force;
        break;
      case 'Cunning':
        factionRating = faction.attributes.cunning;
        break;
      case 'Wealth':
        factionRating = faction.attributes.wealth;
        break;
    }
    if (factionRating < requiredRating) return false;

    // Check world tech level (same as purchase validation)
    if (targetAsset.techLevel > worldTechLevel) return false;

    // Check if faction can afford the refit (if upgrading)
    const cost = calculateRefitCost(currentAssetDef, targetAsset);
    if (cost.cost > faction.facCreds) return false;

    return true;
  });
}

/**
 * Calculate the cost to refit from one asset to another
 * Per SWN: Pay the difference if upgrading, no refund if downgrading
 */
export function calculateRefitCost(
  currentAsset: AssetDefinition,
  targetAsset: AssetDefinition
): RefitCostResult {
  const priceDifference = targetAsset.cost - currentAsset.cost;

  return {
    cost: priceDifference > 0 ? priceDifference : 0,
    refund: 0, // No refunds for downgrading per SWN rules
    originalCost: currentAsset.cost,
    newCost: targetAsset.cost,
  };
}

/**
 * Validate if a specific refit is allowed
 */
export function validateRefit(
  faction: Faction,
  asset: FactionAsset,
  targetAssetId: string,
  world: StarSystem | undefined
): RefitValidationResult {
  const currentAssetDef = getAssetById(asset.definitionId);
  if (!currentAssetDef) {
    return { valid: false, reason: 'Current asset definition not found' };
  }

  const targetAssetDef = getAssetById(targetAssetId);
  if (!targetAssetDef) {
    return { valid: false, reason: 'Target asset definition not found' };
  }

  // Must be same category
  if (currentAssetDef.category !== targetAssetDef.category) {
    return {
      valid: false,
      reason: `Cannot refit ${currentAssetDef.category} asset to ${targetAssetDef.category} asset. Must be same category.`,
    };
  }

  // Check faction has sufficient rating
  const category = targetAssetDef.category;
  let factionRating = 0;
  switch (category) {
    case 'Force':
      factionRating = faction.attributes.force;
      break;
    case 'Cunning':
      factionRating = faction.attributes.cunning;
      break;
    case 'Wealth':
      factionRating = faction.attributes.wealth;
      break;
  }
  
  if (factionRating < targetAssetDef.requiredRating) {
    return {
      valid: false,
      reason: `Requires ${category} ${targetAssetDef.requiredRating}, faction has ${factionRating}`,
    };
  }

  // Check world tech level
  if (world) {
    const worldTechLevel = world.primaryWorld.techLevel ?? 0;
    if (targetAssetDef.techLevel > worldTechLevel) {
      return {
        valid: false,
        reason: `Requires tech level ${targetAssetDef.techLevel}, ${world.name} is tech level ${worldTechLevel}`,
      };
    }
  }

  // Check faction can afford the refit
  const costResult = calculateRefitCost(currentAssetDef, targetAssetDef);
  if (costResult.cost > faction.facCreds) {
    return {
      valid: false,
      reason: `Insufficient FacCreds. Refit costs ${costResult.cost}, faction has ${faction.facCreds}`,
    };
  }

  // Check for permission requirements (same as purchase)
  if (targetAssetDef.specialFlags.requiresPermission) {
    // For simplicity, we'll allow this if they already have the asset on the world
    // In a full implementation, this would check for Planetary Government permission
  }

  return { valid: true };
}

/**
 * Get a summary description of the refit operation
 */
export function getRefitSummary(
  currentAsset: AssetDefinition,
  targetAsset: AssetDefinition
): string {
  const cost = calculateRefitCost(currentAsset, targetAsset);
  
  if (cost.cost > 0) {
    return `Upgrade ${currentAsset.name} to ${targetAsset.name} for ${cost.cost} FacCreds`;
  } else if (cost.originalCost > cost.newCost) {
    return `Downgrade ${currentAsset.name} to ${targetAsset.name} (no refund)`;
  } else {
    return `Convert ${currentAsset.name} to ${targetAsset.name}`;
  }
}


