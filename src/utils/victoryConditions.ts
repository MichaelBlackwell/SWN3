/**
 * Victory Condition Utilities
 * 
 * Implements the victory condition where a faction is eliminated when they
 * lose ALL of their Bases of Influence (anywhere, not just homeworld).
 * A faction wins when all other factions have been eliminated.
 */

import type { Faction, FactionAsset } from '../types/faction';
import { getAssetById } from '../data/assetLibrary';

/**
 * Check if an asset is a Base of Influence
 * @param asset The asset to check
 * @returns true if the asset is a Base of Influence
 */
export function isBaseOfInfluence(asset: FactionAsset): boolean {
  const assetDef = getAssetById(asset.definitionId);
  return assetDef?.name === 'Base of Influence' || asset.definitionId === 'base_of_influence';
}

/**
 * Check if a faction has ANY Base of Influence remaining (anywhere)
 * @param faction The faction to check
 * @returns true if faction has at least one base, false otherwise
 */
export function hasAnyBase(faction: Faction): boolean {
  return faction.assets.some((asset: FactionAsset) => isBaseOfInfluence(asset));
}

/**
 * Check if a faction has a Base of Influence on their homeworld
 * @param faction The faction to check
 * @returns true if faction has a base on their homeworld, false otherwise
 */
export function hasHomeworldBase(faction: Faction): boolean {
  return faction.assets.some((asset: FactionAsset) => {
    // Check if asset is on the homeworld
    if (asset.location !== faction.homeworld) {
      return false;
    }
    
    // Check if asset is a Base of Influence
    return isBaseOfInfluence(asset);
  });
}

/**
 * Check if a faction has been eliminated (no Bases of Influence remaining anywhere)
 * @param faction The faction to check
 * @returns true if faction has NO bases anywhere (eliminated), false otherwise
 */
export function isFactionEliminated(faction: Faction): boolean {
  return !hasAnyBase(faction);
}

/**
 * Get list of eliminated faction IDs (factions with no Bases of Influence)
 * @param factions All factions in the game
 * @returns Array of faction IDs that have been eliminated
 */
export function getEliminatedFactions(factions: Faction[]): string[] {
  return factions
    .filter((faction) => isFactionEliminated(faction))
    .map((faction) => faction.id);
}

/**
 * Get list of surviving faction IDs (factions with at least one Base of Influence)
 * @param factions All factions in the game
 * @returns Array of faction IDs that are still in the game
 */
export function getSurvivingFactions(factions: Faction[]): string[] {
  return factions
    .filter((faction) => hasAnyBase(faction))
    .map((faction) => faction.id);
}

/**
 * Get count of Bases of Influence for a faction
 * @param faction The faction to check
 * @returns Number of bases the faction has
 */
export function getBaseCount(faction: Faction): number {
  return faction.assets.filter((asset) => isBaseOfInfluence(asset)).length;
}

export interface VictoryCheckResult {
  hasVictor: boolean;
  victorId: string | null;
  eliminatedIds: string[];
  survivingIds: string[];
}

/**
 * Check if any faction has achieved victory
 * Victory is achieved when only one faction remains with at least one Base of Influence
 * 
 * @param factions All factions in the game
 * @returns Victory check result with victor info if applicable
 */
export function checkVictoryCondition(factions: Faction[]): VictoryCheckResult {
  // Must have at least 2 factions for a victory condition to make sense
  if (factions.length < 2) {
    return {
      hasVictor: false,
      victorId: null,
      eliminatedIds: [],
      survivingIds: factions.map((f) => f.id),
    };
  }

  const survivingIds = getSurvivingFactions(factions);
  const eliminatedIds = getEliminatedFactions(factions);

  // Victory when exactly one faction survives
  if (survivingIds.length === 1) {
    return {
      hasVictor: true,
      victorId: survivingIds[0],
      eliminatedIds,
      survivingIds,
    };
  }

  // No victor yet (multiple survivors or no survivors - draw)
  return {
    hasVictor: false,
    victorId: null,
    eliminatedIds,
    survivingIds,
  };
}

/**
 * Check if a specific asset is a Base of Influence belonging to a faction
 * @param asset The asset to check
 * @param factions All factions (to determine ownership)
 * @returns The faction ID that owns this base, null if not a base
 */
export function getBaseOwner(
  asset: FactionAsset,
  factions: Faction[]
): string | null {
  if (!isBaseOfInfluence(asset)) {
    return null;
  }

  // Find the faction that owns this asset
  for (const faction of factions) {
    const ownsAsset = faction.assets.some((a) => a.id === asset.id);
    if (ownsAsset) {
      return faction.id;
    }
  }

  return null;
}

/**
 * Determine if destroying a specific asset would eliminate a faction
 * @param assetId The ID of the asset being destroyed
 * @param factions All factions
 * @returns The faction ID that would be eliminated, or null
 */
export function wouldEliminateFaction(
  assetId: string,
  factions: Faction[]
): string | null {
  for (const faction of factions) {
    const asset = faction.assets.find((a) => a.id === assetId);
    if (!asset) continue;

    // Check if this is a Base of Influence
    if (!isBaseOfInfluence(asset)) {
      continue;
    }
    
    // Count all bases this faction has
    const allBases = faction.assets.filter((a) => isBaseOfInfluence(a));

    // If this is the ONLY base, destroying it eliminates the faction
    if (allBases.length === 1 && allBases[0].id === assetId) {
      return faction.id;
    }
  }

  return null;
}
