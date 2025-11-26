/**
 * InfluenceMapService - Calculates spatial control values for AI decision making
 *
 * This service generates "influence maps" that represent the strategic value and
 * control of each hex in the sector based on faction assets and their capabilities.
 *
 * Based on SWN faction rules:
 * - Assets have different ranges and capabilities
 * - Force assets project military control
 * - Cunning assets project covert influence
 * - Wealth assets project economic influence
 * - Bases of Influence are key strategic anchors
 */

import type { StarSystem, Coordinates } from '../../types/sector';
import type { Faction, FactionAsset } from '../../types/faction';
import type { AssetDefinition } from '../../types/asset';
import { getAssetById } from '../../data/assetLibrary';

/**
 * Influence value for a single hex, broken down by category
 */
export interface HexInfluence {
  systemId: string;
  coordinates: Coordinates;
  force: number; // Military control value
  cunning: number; // Covert influence value
  wealth: number; // Economic influence value
  total: number; // Combined influence score
  controllingFactionId: string | null; // Faction with highest total influence
  contestedLevel: number; // 0 = uncontested, higher = more contested
}

/**
 * Complete influence map for a faction's perspective
 */
export interface InfluenceMap {
  factionId: string;
  hexes: Map<string, HexInfluence>; // systemId -> influence
  friendlyControlled: string[]; // Systems where this faction has highest influence
  enemyControlled: string[]; // Systems where enemies have highest influence
  contested: string[]; // Systems with significant competition
  unoccupied: string[]; // Systems with no significant presence
}

/**
 * Asset influence projection configuration
 */
interface AssetInfluenceConfig {
  baseInfluence: number; // Base influence value
  range: number; // How many hexes the influence projects
  falloff: number; // Multiplier for each hex of distance (0-1)
}

/**
 * Get the influence configuration for an asset based on its type and category
 */
function getAssetInfluenceConfig(assetDef: AssetDefinition): AssetInfluenceConfig {
  const rating = assetDef.requiredRating;
  const type = assetDef.type;

  // Base influence scales with required rating
  let baseInfluence = rating * 2;

  // Starships project influence over longer range
  let range = 1;
  if (type === 'Starship') {
    range = 2;
    baseInfluence *= 1.2; // Starships are more mobile/threatening
  }

  // Facilities are anchors - high local influence, no projection
  if (type === 'Facility' || type === 'Logistics Facility') {
    range = 0;
    baseInfluence *= 1.5; // Strong local presence
  }

  // Military units have moderate range
  if (type === 'Military Unit') {
    range = 1;
    baseInfluence *= 1.3;
  }

  // Special Forces have covert influence - harder to detect but still impactful
  if (type === 'Special Forces') {
    range = 1;
    baseInfluence *= 0.8; // Less visible but still influential
  }

  // Tactics are situational - minimal passive influence
  if (type === 'Tactic') {
    range = 0;
    baseInfluence *= 0.5;
  }

  // Base of Influence is a key strategic anchor
  if (assetDef.id === 'base_of_influence' || assetDef.name === 'Base of Influence') {
    range = 0;
    baseInfluence = 10; // High anchor value
  }

  return {
    baseInfluence,
    range,
    falloff: 0.5, // 50% reduction per hex of distance
  };
}

/**
 * Calculate hex distance using offset coordinates (odd-r layout)
 */
export function calculateHexDistance(a: Coordinates, b: Coordinates): number {
  // Convert offset coordinates to cube coordinates for accurate distance calculation
  const axialA = offsetToCube(a);
  const axialB = offsetToCube(b);

  return Math.max(
    Math.abs(axialA.q - axialB.q),
    Math.abs(axialA.r - axialB.r),
    Math.abs(axialA.s - axialB.s)
  );
}

/**
 * Convert offset coordinates (odd-r) to cube coordinates
 */
function offsetToCube(coord: Coordinates): { q: number; r: number; s: number } {
  const q = coord.x - Math.floor((coord.y - (coord.y & 1)) / 2);
  const r = coord.y;
  const s = -q - r;
  return { q, r, s };
}

/**
 * Calculate the influence a single asset projects onto a target hex
 */
function calculateAssetInfluenceOnHex(
  asset: FactionAsset,
  assetDef: AssetDefinition,
  assetSystem: StarSystem,
  targetSystem: StarSystem
): { force: number; cunning: number; wealth: number } {
  const config = getAssetInfluenceConfig(assetDef);
  const distance = calculateHexDistance(assetSystem.coordinates, targetSystem.coordinates);

  // If beyond range, no influence
  if (distance > config.range) {
    return { force: 0, cunning: 0, wealth: 0 };
  }

  // Calculate influence with distance falloff
  const distanceMultiplier = Math.pow(config.falloff, distance);
  const influence = config.baseInfluence * distanceMultiplier;

  // Apply HP factor - damaged assets project less influence
  const hpFactor = asset.hp / asset.maxHp;
  const adjustedInfluence = influence * hpFactor;

  // Stealthed assets project reduced visible influence
  const stealthFactor = asset.stealthed ? 0.3 : 1.0;
  const finalInfluence = adjustedInfluence * stealthFactor;

  // Distribute influence by category
  const result = { force: 0, cunning: 0, wealth: 0 };
  switch (assetDef.category) {
    case 'Force':
      result.force = finalInfluence;
      break;
    case 'Cunning':
      result.cunning = finalInfluence;
      break;
    case 'Wealth':
      result.wealth = finalInfluence;
      break;
  }

  return result;
}

/**
 * Build a system lookup map for efficient coordinate-based queries
 */
function buildSystemMap(systems: StarSystem[]): Map<string, StarSystem> {
  const map = new Map<string, StarSystem>();
  systems.forEach((system) => {
    map.set(system.id, system);
  });
  return map;
}

/**
 * Calculate the complete influence map for a specific faction
 */
export function calculateInfluenceMap(
  factionId: string,
  allFactions: Faction[],
  systems: StarSystem[]
): InfluenceMap {
  const systemMap = buildSystemMap(systems);

  // Initialize hex influence for all systems
  const hexes = new Map<string, HexInfluence>();
  systems.forEach((system) => {
    hexes.set(system.id, {
      systemId: system.id,
      coordinates: system.coordinates,
      force: 0,
      cunning: 0,
      wealth: 0,
      total: 0,
      controllingFactionId: null,
      contestedLevel: 0,
    });
  });

  // Track influence by faction for each hex
  const factionInfluenceByHex = new Map<string, Map<string, number>>(); // systemId -> (factionId -> total)
  systems.forEach((system) => {
    factionInfluenceByHex.set(system.id, new Map());
  });

  // Calculate influence from all factions' assets
  allFactions.forEach((faction) => {
    faction.assets.forEach((asset) => {
      const assetDef = getAssetById(asset.definitionId);
      if (!assetDef) return;

      const assetSystem = systemMap.get(asset.location);
      if (!assetSystem) return;

      // Project influence onto all systems within range
      systems.forEach((targetSystem) => {
        const influence = calculateAssetInfluenceOnHex(
          asset,
          assetDef,
          assetSystem,
          targetSystem
        );

        const hexInfluence = hexes.get(targetSystem.id);
        if (!hexInfluence) return;

        // Add to total hex influence
        hexInfluence.force += influence.force;
        hexInfluence.cunning += influence.cunning;
        hexInfluence.wealth += influence.wealth;

        // Track per-faction influence
        const factionMap = factionInfluenceByHex.get(targetSystem.id);
        if (factionMap) {
          const currentFactionInfluence = factionMap.get(faction.id) || 0;
          const addedInfluence = influence.force + influence.cunning + influence.wealth;
          factionMap.set(faction.id, currentFactionInfluence + addedInfluence);
        }
      });
    });

    // Add homeworld bonus - factions always have some influence on their homeworld
    const homeworldInfluence = factionInfluenceByHex.get(faction.homeworld);
    if (homeworldInfluence) {
      const currentInfluence = homeworldInfluence.get(faction.id) || 0;
      homeworldInfluence.set(faction.id, currentInfluence + 5); // Base homeworld influence
    }
  });

  // Determine controlling faction and contested level for each hex
  const friendlyControlled: string[] = [];
  const enemyControlled: string[] = [];
  const contested: string[] = [];
  const unoccupied: string[] = [];

  hexes.forEach((hexInfluence, systemId) => {
    const factionMap = factionInfluenceByHex.get(systemId);
    if (!factionMap) return;

    // Calculate total influence for the hex
    hexInfluence.total = hexInfluence.force + hexInfluence.cunning + hexInfluence.wealth;

    // Find faction with highest influence
    let maxInfluence = 0;
    let secondMaxInfluence = 0;
    let controllingFaction: string | null = null;

    factionMap.forEach((influence, fId) => {
      if (influence > maxInfluence) {
        secondMaxInfluence = maxInfluence;
        maxInfluence = influence;
        controllingFaction = fId;
      } else if (influence > secondMaxInfluence) {
        secondMaxInfluence = influence;
      }
    });

    hexInfluence.controllingFactionId = controllingFaction;

    // Calculate contested level (0-10 scale)
    // Higher when multiple factions have similar influence
    if (maxInfluence > 0 && secondMaxInfluence > 0) {
      const ratio = secondMaxInfluence / maxInfluence;
      hexInfluence.contestedLevel = Math.round(ratio * 10);
    }

    // Categorize the hex from the perspective of the target faction
    if (hexInfluence.total < 2) {
      unoccupied.push(systemId);
    } else if (controllingFaction === factionId) {
      if (hexInfluence.contestedLevel >= 5) {
        contested.push(systemId);
      } else {
        friendlyControlled.push(systemId);
      }
    } else {
      if (hexInfluence.contestedLevel >= 5) {
        contested.push(systemId);
      } else {
        enemyControlled.push(systemId);
      }
    }
  });

  return {
    factionId,
    hexes,
    friendlyControlled,
    enemyControlled,
    contested,
    unoccupied,
  };
}

/**
 * Get the influence value for a specific system
 */
export function getSystemInfluence(
  influenceMap: InfluenceMap,
  systemId: string
): HexInfluence | null {
  return influenceMap.hexes.get(systemId) || null;
}

/**
 * Find systems with the highest friendly influence (best for expansion)
 */
export function findBestExpansionTargets(
  influenceMap: InfluenceMap,
  faction: Faction,
  systems: StarSystem[],
  limit: number = 5
): StarSystem[] {
  const systemMap = buildSystemMap(systems);

  // Score each unoccupied or weakly contested system
  const candidates: Array<{ system: StarSystem; score: number }> = [];

  [...influenceMap.unoccupied, ...influenceMap.contested].forEach((systemId) => {
    const system = systemMap.get(systemId);
    if (!system) return;

    const hexInfluence = influenceMap.hexes.get(systemId);
    if (!hexInfluence) return;

    // Score based on:
    // 1. Lower enemy influence is better
    // 2. Higher friendly influence is better
    // 3. Proximity to homeworld is better
    const homeworld = systemMap.get(faction.homeworld);
    const distanceToHomeworld = homeworld
      ? calculateHexDistance(system.coordinates, homeworld.coordinates)
      : 10;

    const friendlyInfluence =
      influenceMap.hexes.get(systemId)?.controllingFactionId === faction.id
        ? hexInfluence.total
        : 0;

    const enemyInfluence =
      hexInfluence.controllingFactionId && hexInfluence.controllingFactionId !== faction.id
        ? hexInfluence.total
        : 0;

    const score =
      friendlyInfluence * 2 - // Friendly influence is good
      enemyInfluence * 1.5 - // Enemy influence is bad
      distanceToHomeworld * 0.5; // Distance is slightly bad

    candidates.push({ system, score });
  });

  // Sort by score descending and return top candidates
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map((c) => c.system);
}

/**
 * Calculate the strategic value of a system for a faction
 */
export function calculateSystemStrategicValue(
  system: StarSystem,
  faction: Faction,
  influenceMap: InfluenceMap,
  allSystems: StarSystem[]
): number {
  const hexInfluence = influenceMap.hexes.get(system.id);
  if (!hexInfluence) return 0;

  let value = 0;

  // Base value from tech level and population (population is 0-6 index)
  value += system.primaryWorld.techLevel * 2;
  value += system.primaryWorld.population; // Population index already numeric

  // Value from being connected to other systems
  value += system.routes.length * 1.5;

  // Value from current influence
  if (hexInfluence.controllingFactionId === faction.id) {
    value += 5; // Already controlled
  }

  // Value from being near homeworld
  const homeworld = allSystems.find((s) => s.id === faction.homeworld);
  if (homeworld) {
    const distance = calculateHexDistance(system.coordinates, homeworld.coordinates);
    value += Math.max(0, 10 - distance * 2); // Closer is better
  }

  // Reduce value if heavily contested
  value -= hexInfluence.contestedLevel * 0.5;

  return Math.max(0, value);
}

