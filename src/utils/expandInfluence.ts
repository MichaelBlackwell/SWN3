import type { Faction, FactionAsset } from '../types/faction';
import { getAssetById } from '../data/assetLibrary';
import { rollD10 } from './combatResolver';
import type { RootState } from '../store/store';

/**
 * Special identifier for Base of Influence assets
 */
export const BASE_OF_INFLUENCE_ID = 'base_of_influence';

/**
 * Check if a faction has a Base of Influence on a specific world
 */
export function hasBaseOfInfluence(faction: Faction, systemId: string): boolean {
  return faction.assets.some((asset: FactionAsset) => {
    const assetDef = getAssetById(asset.definitionId);
    return (
      asset.location === systemId &&
      (assetDef?.name === 'Base of Influence' || asset.definitionId === BASE_OF_INFLUENCE_ID)
    );
  });
}

/**
 * Get the Base of Influence asset for a faction on a specific world
 */
export function getBaseOfInfluence(faction: Faction, systemId: string): FactionAsset | null {
  const base = faction.assets.find((asset: FactionAsset) => {
    const assetDef = getAssetById(asset.definitionId);
    return (
      asset.location === systemId &&
      (assetDef?.name === 'Base of Influence' || asset.definitionId === BASE_OF_INFLUENCE_ID)
    );
  });
  return base || null;
}

/**
 * Check if a faction has at least one asset (other than Base of Influence) on a world
 * This is required to expand influence
 */
export function hasAssetsOnWorld(faction: Faction, systemId: string): boolean {
  return faction.assets.some((asset: FactionAsset) => {
    const assetDef = getAssetById(asset.definitionId);
    const isBaseOfInfluence =
      assetDef?.name === 'Base of Influence' || asset.definitionId === BASE_OF_INFLUENCE_ID;
    return asset.location === systemId && !isBaseOfInfluence;
  });
}

/**
 * Get all valid target worlds for Expand Influence
 * A world is valid if:
 * - The faction has at least one asset on it (other than Base of Influence)
 * - The faction does not already have a Base of Influence on it
 * - The world is in the same system (for now, we'll check all systems)
 */
export function getValidExpandTargets<T extends { id: string }>(
  faction: Faction,
  systems: T[]
): T[] {
  return systems.filter((system) => {
    // Must have assets on the world
    if (!hasAssetsOnWorld(faction, system.id)) {
      return false;
    }

    // Must not already have a Base of Influence
    if (hasBaseOfInfluence(faction, system.id)) {
      return false;
    }

    return true;
  });
}

/**
 * Result of an Expand Influence roll
 */
export interface ExpandInfluenceRollResult {
  success: boolean;
  expandingFactionRoll: number;
  expandingFactionTotal: number;
  opposingRolls: Array<{
    factionId: string;
    factionName: string;
    roll: number;
    total: number;
    canAttack: boolean; // If true, this faction can make a free attack
  }>;
  message: string;
}

/**
 * Perform the Expand Influence roll resolution
 * The expanding faction rolls 1d10 + Cunning
 * Each other faction on the planet rolls 1d10 + Cunning
 * If any opposing faction equals or beats the expanding faction's roll, they can attack
 */
export function resolveExpandInfluenceRoll(
  expandingFaction: Faction,
  targetSystemId: string,
  state: RootState
): ExpandInfluenceRollResult {
  const expandingRoll = rollD10();
  const expandingTotal = expandingRoll + expandingFaction.attributes.cunning;

  // Find all other factions with assets on this world
  const opposingFactions = state.factions.factions.filter((faction: { id: string; assets: Array<{ location: string }> }) => {
    if (faction.id === expandingFaction.id) return false;
    // Check if faction has any assets on this world
    return faction.assets.some((asset: { location: string }) => asset.location === targetSystemId);
  });

  const opposingRolls = opposingFactions.map((faction: { id: string; name: string; attributes: { cunning: number } }) => {
    const roll = rollD10();
    const total = roll + faction.attributes.cunning;
    const canAttack = total >= expandingTotal; // Equal or beat means can attack

    return {
      factionId: faction.id,
      factionName: faction.name,
      roll,
      total,
      canAttack,
    };
  });

  // Success if no opposing faction can attack (all rolls were lower)
  const success = !opposingRolls.some((result: { canAttack: boolean }) => result.canAttack);

  const message = success
    ? `Successfully expanded influence! Rolled ${expandingRoll} + ${expandingFaction.attributes.cunning} Cunning = ${expandingTotal}.`
    : `Expansion contested! Rolled ${expandingRoll} + ${expandingFaction.attributes.cunning} Cunning = ${expandingTotal}. Opposing factions may attack.`;

  return {
    success,
    expandingFactionRoll: expandingRoll,
    expandingFactionTotal: expandingTotal,
    opposingRolls,
    message,
  };
}

/**
 * Calculate the cost to create or upgrade a Base of Influence
 * Cost = 1 FacCred per HP, up to faction's max HP
 */
export function calculateBaseOfInfluenceCost(
  faction: Faction,
  desiredHp: number
): { cost: number; actualHp: number } {
  const maxHp = Math.min(desiredHp, faction.attributes.maxHp);
  const cost = maxHp; // 1 FacCred per HP
  return {
    cost,
    actualHp: maxHp,
  };
}







