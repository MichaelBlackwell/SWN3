import type { Faction, FactionAsset } from '../types/faction';
import { getAssetById } from '../data/assetLibrary';
import type { AssetCategory } from '../types/asset';

/**
 * Calculate the cost to repair an asset based on SWN rules.
 * 
 * For assets:
 * - Base healing = faction's ruling attribute score for 1 FacCred
 * - Additional healing amounts cost increasing FacCreds (2 for second amount, 3 for third, etc.)
 * 
 * @param faction The faction performing the repair
 * @param asset The asset to repair
 * @returns Object with cost and amount of HP that will be healed
 */
export function calculateAssetRepairCost(
  faction: Faction,
  asset: FactionAsset
): { cost: number; hpHealed: number } {
  const assetDef = getAssetById(asset.definitionId);
  if (!assetDef) {
    return { cost: 0, hpHealed: 0 };
  }

  const damage = asset.maxHp - asset.hp;
  if (damage <= 0) {
    return { cost: 0, hpHealed: 0 };
  }

  // Get the ruling attribute for this asset's category
  const rulingAttribute = getRulingAttribute(faction, assetDef.category);

  // Base healing amount = ruling attribute score
  const baseHealing = rulingAttribute;
  
  // Calculate cost using incremental scaling
  // First amount (baseHealing HP) costs 1 FacCred
  // Second amount costs 2 FacCreds
  // Third amount costs 3 FacCreds, etc.
  let remainingDamage = damage;
  let totalCost = 0;
  let totalHealed = 0;
  let healingIncrement = 1;

  while (remainingDamage > 0 && totalHealed < damage) {
    const healingThisIncrement = Math.min(remainingDamage, baseHealing);
    totalCost += healingIncrement;
    totalHealed += healingThisIncrement;
    remainingDamage -= healingThisIncrement;
    healingIncrement++;
  }

  return {
    cost: totalCost,
    hpHealed: totalHealed,
  };
}

/**
 * Calculate the cost and healing for repairing faction HP based on SWN rules.
 * 
 * For Faction HP:
 * - Healing = rounded average of highest and lowest attribute ratings
 * - No option to hurry the process via extra spending
 * - Cost is always 1 FacCred
 * 
 * @param faction The faction to repair
 * @returns Object with cost (always 1) and amount of HP that will be healed
 */
export function calculateFactionRepairCost(
  faction: Faction
): { cost: number; hpHealed: number } {
  const damage = faction.attributes.maxHp - faction.attributes.hp;
  if (damage <= 0) {
    return { cost: 0, hpHealed: 0 };
  }

  // Calculate rounded average of highest and lowest attribute ratings
  const attributes = [
    faction.attributes.force,
    faction.attributes.cunning,
    faction.attributes.wealth,
  ];
  const highest = Math.max(...attributes);
  const lowest = Math.min(...attributes);
  const average = Math.round((highest + lowest) / 2);

  // Healing is the average, but cannot exceed damage
  const hpHealed = Math.min(average, damage);

  // Cost is always 1 FacCred for faction HP repair
  return {
    cost: 1,
    hpHealed,
  };
}

/**
 * Get the ruling attribute value for an asset category.
 * The ruling attribute is the faction's attribute score for the asset's category.
 */
function getRulingAttribute(
  faction: Faction,
  category: AssetCategory
): number {
  switch (category) {
    case 'Force':
      return faction.attributes.force;
    case 'Cunning':
      return faction.attributes.cunning;
    case 'Wealth':
      return faction.attributes.wealth;
    default:
      return 1;
  }
}

/**
 * Calculate total repair cost for multiple assets.
 */
export function calculateMultipleAssetRepairCost(
  faction: Faction,
  assets: FactionAsset[]
): { cost: number; repairs: Array<{ assetId: string; cost: number; hpHealed: number }> } {
  const repairs = assets.map((asset) => {
    const repair = calculateAssetRepairCost(faction, asset);
    return {
      assetId: asset.id,
      cost: repair.cost,
      hpHealed: repair.hpHealed,
    };
  });

  const totalCost = repairs.reduce((sum, repair) => sum + repair.cost, 0);

  return {
    cost: totalCost,
    repairs,
  };
}




