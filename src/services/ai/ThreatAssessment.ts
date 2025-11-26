/**
 * ThreatAssessment - Identifies dangerous enemy concentrations and evaluates threats
 *
 * This module scans neighboring systems for enemy assets and calculates threat levels
 * based on Force and Cunning ratings to help AI factions make defensive decisions.
 *
 * Based on SWN faction rules:
 * - Force rating indicates military capability
 * - Cunning rating indicates espionage/infiltration capability
 * - Assets have different attack capabilities and ranges
 * - Some assets are stealthed and harder to detect
 */

import type { StarSystem } from '../../types/sector';
import type { Faction, FactionAsset } from '../../types/faction';
import type { AssetDefinition, AssetCategory } from '../../types/asset';
import { getAssetById } from '../../data/assetLibrary';
import { calculateHexDistance } from './InfluenceMapService';

/**
 * Threat assessment for a single enemy faction
 */
export interface FactionThreat {
  factionId: string;
  factionName: string;
  // Attribute ratings
  force: number;
  cunning: number;
  wealth: number;
  // Calculated threat scores
  militaryThreat: number; // Based on Force assets and rating
  covertThreat: number; // Based on Cunning assets and rating
  economicThreat: number; // Based on Wealth assets and rating
  totalThreat: number; // Combined threat score
  // Asset details
  visibleAssets: AssetThreat[];
  estimatedStealthedAssets: number; // Estimated count based on Cunning rating
  // Proximity data
  closestAssetDistance: number; // Hex distance to nearest enemy asset
  assetsInRange: number; // Assets within 2 hexes
}

/**
 * Threat assessment for a single asset
 */
export interface AssetThreat {
  assetId: string;
  assetName: string;
  category: AssetCategory;
  location: string; // systemId
  distance: number; // Hex distance from reference point
  threatScore: number; // Individual threat score
  canAttack: boolean; // Whether this asset can initiate attacks
  attackDamage: string | null; // Expected damage if it attacks
  isStealthed: boolean;
}

/**
 * Complete threat assessment for a system
 */
export interface SystemThreatAssessment {
  systemId: string;
  systemName: string;
  // Overall danger level (0-10 scale)
  dangerLevel: number;
  // Breakdown by threat type
  militaryDanger: number;
  covertDanger: number;
  economicDanger: number;
  // Enemy faction threats
  factionThreats: FactionThreat[];
  // Immediate threats (assets that can attack this turn)
  immediateThreats: AssetThreat[];
  // Recommended actions
  recommendedDefenseLevel: 'none' | 'minimal' | 'moderate' | 'heavy' | 'critical';
  shouldRetreat: boolean;
}

/**
 * Threat assessment for a specific system location
 */
export interface SystemThreatInfo {
  systemId: string;
  overallDangerLevel: number;
  militaryDanger: number;
  covertDanger: number;
  economicDanger: number;
}

/**
 * Sector-wide threat overview for a faction
 */
export interface SectorThreatOverview {
  factionId: string;
  // Alias for factionId (for backwards compatibility)
  assessingFactionId: string;
  // Most dangerous enemy faction
  primaryThreat: FactionThreat | null;
  // Systems under immediate threat
  threatenedSystems: string[];
  // Systems that are safe
  safeSystems: string[];
  // Overall sector threat level
  overallThreatLevel: number;
  // Recommended strategy
  recommendedPosture: 'aggressive' | 'balanced' | 'defensive' | 'turtle';
  // Per-system threat information (keyed by systemId)
  systemThreats: Record<string, SystemThreatInfo>;
}

/**
 * Calculate the threat score for a single asset
 */
function calculateAssetThreatScore(
  asset: FactionAsset,
  assetDef: AssetDefinition,
  distance: number
): number {
  let score = 0;

  // Base threat from required rating (higher rating = more dangerous)
  score += assetDef.requiredRating * 3;

  // Threat from HP (more HP = harder to kill)
  score += asset.hp * 0.5;

  // Threat from attack capability
  if (assetDef.attack) {
    score += 5; // Can attack
    // Parse damage dice for threat estimation
    const damageMatch = assetDef.attack.damage.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (damageMatch) {
      const numDice = parseInt(damageMatch[1], 10);
      const dieSize = parseInt(damageMatch[2], 10);
      const modifier = damageMatch[3] ? parseInt(damageMatch[3], 10) : 0;
      const avgDamage = numDice * (dieSize / 2 + 0.5) + modifier;
      score += avgDamage;
    }
  }

  // Threat from counterattack capability
  if (assetDef.counterattack) {
    score += 2; // Can counterattack
  }

  // Distance reduction - closer is more threatening
  const distanceMultiplier = Math.max(0.2, 1 - distance * 0.2);
  score *= distanceMultiplier;

  // Stealthed assets are less immediately threatening but still dangerous
  if (asset.stealthed) {
    score *= 0.7;
  }

  // HP damage reduces threat
  const hpRatio = asset.hp / asset.maxHp;
  score *= hpRatio;

  return score;
}

/**
 * Calculate threat from a single enemy faction
 */
function calculateFactionThreat(
  enemyFaction: Faction,
  referenceSystem: StarSystem,
  allSystems: StarSystem[]
): FactionThreat {
  const systemMap = new Map<string, StarSystem>();
  allSystems.forEach((s) => systemMap.set(s.id, s));

  const visibleAssets: AssetThreat[] = [];
  let militaryThreat = 0;
  let covertThreat = 0;
  let economicThreat = 0;
  let closestDistance = Infinity;
  let assetsInRange = 0;

  // Analyze each asset
  enemyFaction.assets.forEach((asset) => {
    const assetDef = getAssetById(asset.definitionId);
    if (!assetDef) return;

    const assetSystem = systemMap.get(asset.location);
    if (!assetSystem) return;

    const distance = calculateHexDistance(assetSystem.coordinates, referenceSystem.coordinates);

    // Track closest asset
    if (distance < closestDistance) {
      closestDistance = distance;
    }

    // Count assets within range (2 hexes)
    if (distance <= 2) {
      assetsInRange++;
    }

    const threatScore = calculateAssetThreatScore(asset, assetDef, distance);

    // Only include visible assets (non-stealthed) in visible list
    if (!asset.stealthed) {
      visibleAssets.push({
        assetId: asset.id,
        assetName: assetDef.name,
        category: assetDef.category,
        location: asset.location,
        distance,
        threatScore,
        canAttack: assetDef.attack !== null,
        attackDamage: assetDef.attack?.damage || null,
        isStealthed: false,
      });
    }

    // Add to category-specific threat
    switch (assetDef.category) {
      case 'Force':
        militaryThreat += threatScore;
        break;
      case 'Cunning':
        covertThreat += threatScore;
        break;
      case 'Wealth':
        economicThreat += threatScore;
        break;
    }
  });

  // Add base threat from faction attributes
  militaryThreat += enemyFaction.attributes.force * 2;
  covertThreat += enemyFaction.attributes.cunning * 2;
  economicThreat += enemyFaction.attributes.wealth * 2;

  // Estimate stealthed assets based on Cunning rating
  // Higher Cunning = more likely to have stealthed assets
  const estimatedStealthedAssets = Math.floor(enemyFaction.attributes.cunning / 2);

  const totalThreat = militaryThreat + covertThreat + economicThreat;

  return {
    factionId: enemyFaction.id,
    factionName: enemyFaction.name,
    force: enemyFaction.attributes.force,
    cunning: enemyFaction.attributes.cunning,
    wealth: enemyFaction.attributes.wealth,
    militaryThreat,
    covertThreat,
    economicThreat,
    totalThreat,
    visibleAssets,
    estimatedStealthedAssets,
    closestAssetDistance: closestDistance === Infinity ? -1 : closestDistance,
    assetsInRange,
  };
}

/**
 * Assess the threat level for a specific system
 */
export function assessSystemThreat(
  systemId: string,
  assessingFactionId: string,
  allFactions: Faction[],
  allSystems: StarSystem[]
): SystemThreatAssessment {
  const system = allSystems.find((s) => s.id === systemId);
  if (!system) {
    return {
      systemId,
      systemName: 'Unknown',
      dangerLevel: 0,
      militaryDanger: 0,
      covertDanger: 0,
      economicDanger: 0,
      factionThreats: [],
      immediateThreats: [],
      recommendedDefenseLevel: 'none',
      shouldRetreat: false,
    };
  }

  // Get all enemy factions
  const enemyFactions = allFactions.filter((f) => f.id !== assessingFactionId);

  // Calculate threat from each enemy faction
  const factionThreats = enemyFactions.map((enemy) =>
    calculateFactionThreat(enemy, system, allSystems)
  );

  // Aggregate threat levels
  let militaryDanger = 0;
  let covertDanger = 0;
  let economicDanger = 0;
  const immediateThreats: AssetThreat[] = [];

  factionThreats.forEach((threat) => {
    militaryDanger += threat.militaryThreat;
    covertDanger += threat.covertThreat;
    economicDanger += threat.economicThreat;

    // Collect immediate threats (assets within 1 hex that can attack)
    threat.visibleAssets
      .filter((asset) => asset.distance <= 1 && asset.canAttack)
      .forEach((asset) => immediateThreats.push(asset));
  });

  // Normalize danger levels to 0-10 scale
  const maxDanger = 100; // Calibration value
  const normalizedMilitary = Math.min(10, (militaryDanger / maxDanger) * 10);
  const normalizedCovert = Math.min(10, (covertDanger / maxDanger) * 10);
  const normalizedEconomic = Math.min(10, (economicDanger / maxDanger) * 10);

  // Overall danger is weighted average (military is most important for immediate threat)
  const dangerLevel =
    normalizedMilitary * 0.5 + normalizedCovert * 0.3 + normalizedEconomic * 0.2;

  // Determine recommended defense level
  let recommendedDefenseLevel: SystemThreatAssessment['recommendedDefenseLevel'];
  if (dangerLevel < 1) {
    recommendedDefenseLevel = 'none';
  } else if (dangerLevel < 3) {
    recommendedDefenseLevel = 'minimal';
  } else if (dangerLevel < 5) {
    recommendedDefenseLevel = 'moderate';
  } else if (dangerLevel < 7) {
    recommendedDefenseLevel = 'heavy';
  } else {
    recommendedDefenseLevel = 'critical';
  }

  // Recommend retreat if immediate threats are overwhelming
  const shouldRetreat =
    immediateThreats.length >= 3 ||
    immediateThreats.reduce((sum, t) => sum + t.threatScore, 0) > 50;

  return {
    systemId,
    systemName: system.name,
    dangerLevel,
    militaryDanger: normalizedMilitary,
    covertDanger: normalizedCovert,
    economicDanger: normalizedEconomic,
    factionThreats,
    immediateThreats,
    recommendedDefenseLevel,
    shouldRetreat,
  };
}

/**
 * Generate a sector-wide threat overview for a faction
 */
export function generateSectorThreatOverview(
  factionId: string,
  allFactions: Faction[],
  allSystems: StarSystem[]
): SectorThreatOverview {
  const faction = allFactions.find((f) => f.id === factionId);
  if (!faction) {
    return {
      factionId,
      assessingFactionId: factionId,
      primaryThreat: null,
      threatenedSystems: [],
      safeSystems: [],
      overallThreatLevel: 0,
      recommendedPosture: 'balanced',
      systemThreats: {},
    };
  }

  // Get systems where faction has presence
  const factionSystems = new Set<string>();
  factionSystems.add(faction.homeworld);
  faction.assets.forEach((asset) => factionSystems.add(asset.location));

  const threatenedSystems: string[] = [];
  const safeSystems: string[] = [];
  const systemThreats: Record<string, SystemThreatInfo> = {};
  let totalThreatLevel = 0;

  // Assess each system where faction has presence
  factionSystems.forEach((systemId) => {
    const assessment = assessSystemThreat(systemId, factionId, allFactions, allSystems);
    totalThreatLevel += assessment.dangerLevel;

    // Store per-system threat info
    systemThreats[systemId] = {
      systemId,
      overallDangerLevel: assessment.dangerLevel * 10, // Scale to 0-100
      militaryDanger: assessment.militaryDanger * 10,
      covertDanger: assessment.covertDanger * 10,
      economicDanger: assessment.economicDanger * 10,
    };

    if (assessment.dangerLevel >= 4) {
      threatenedSystems.push(systemId);
    } else {
      safeSystems.push(systemId);
    }
  });

  // Calculate overall threat level (average of all system threats, scaled to percentage)
  const overallThreatLevel =
    factionSystems.size > 0 ? (totalThreatLevel / factionSystems.size) * 10 : 0;

  // Find the primary threat (most dangerous enemy faction)
  const enemyFactions = allFactions.filter((f) => f.id !== factionId);
  let primaryThreat: FactionThreat | null = null;
  let maxThreat = 0;

  const homeworld = allSystems.find((s) => s.id === faction.homeworld);
  if (homeworld) {
    enemyFactions.forEach((enemy) => {
      const threat = calculateFactionThreat(enemy, homeworld, allSystems);
      if (threat.totalThreat > maxThreat) {
        maxThreat = threat.totalThreat;
        primaryThreat = threat;
      }
    });
  }

  // Determine recommended posture based on threat level and faction strength
  let recommendedPosture: SectorThreatOverview['recommendedPosture'];
  const factionStrength =
    faction.attributes.force + faction.attributes.cunning + faction.attributes.wealth;
  // TypeScript type narrowing fix: primaryThreat is FactionThreat | null at this point
  const threatRatio = primaryThreat !== null ? (primaryThreat as FactionThreat).totalThreat / (factionStrength * 5) : 0;

  if (threatRatio > 1.5) {
    recommendedPosture = 'turtle'; // Significantly outmatched
  } else if (threatRatio > 1) {
    recommendedPosture = 'defensive'; // Slightly outmatched
  } else if (threatRatio > 0.5) {
    recommendedPosture = 'balanced'; // Roughly equal
  } else {
    recommendedPosture = 'aggressive'; // Stronger than enemies
  }

  return {
    factionId,
    assessingFactionId: factionId,
    primaryThreat,
    threatenedSystems,
    safeSystems,
    overallThreatLevel,
    recommendedPosture,
    systemThreats,
  };
}

/**
 * Get the most threatening assets that could attack a specific system
 */
export function getImmediateAttackThreats(
  systemId: string,
  assessingFactionId: string,
  allFactions: Faction[],
  allSystems: StarSystem[]
): AssetThreat[] {
  const assessment = assessSystemThreat(systemId, assessingFactionId, allFactions, allSystems);
  return assessment.immediateThreats.sort((a, b) => b.threatScore - a.threatScore);
}

/**
 * Calculate the defensive strength of a faction at a specific system
 */
export function calculateDefensiveStrength(
  systemId: string,
  faction: Faction,
  allSystems: StarSystem[]
): number {
  const systemMap = new Map<string, StarSystem>();
  allSystems.forEach((s) => systemMap.set(s.id, s));

  const referenceSystem = systemMap.get(systemId);
  if (!referenceSystem) return 0;

  let defensiveStrength = 0;

  faction.assets.forEach((asset) => {
    const assetDef = getAssetById(asset.definitionId);
    if (!assetDef) return;

    const assetSystem = systemMap.get(asset.location);
    if (!assetSystem) return;

    const distance = calculateHexDistance(assetSystem.coordinates, referenceSystem.coordinates);

    // Only count assets at this system or adjacent (can defend)
    if (distance > 1) return;

    // Base defensive value from HP
    let defenseValue = asset.hp;

    // Bonus for counterattack capability
    if (assetDef.counterattack) {
      const damageMatch = assetDef.counterattack.damage.match(/(\d+)d(\d+)(?:\+(\d+))?/);
      if (damageMatch) {
        const numDice = parseInt(damageMatch[1], 10);
        const dieSize = parseInt(damageMatch[2], 10);
        const modifier = damageMatch[3] ? parseInt(damageMatch[3], 10) : 0;
        const avgDamage = numDice * (dieSize / 2 + 0.5) + modifier;
        defenseValue += avgDamage;
      }
    }

    // Facilities provide extra defensive value
    if (assetDef.type === 'Facility' || assetDef.type === 'Logistics Facility') {
      defenseValue *= 1.2;
    }

    // Distance penalty for adjacent systems
    if (distance === 1) {
      defenseValue *= 0.5;
    }

    defensiveStrength += defenseValue;
  });

  // Homeworld bonus
  if (systemId === faction.homeworld) {
    defensiveStrength *= 1.3;
  }

  return defensiveStrength;
}

/**
 * Determine if a faction should consider retreating from a system
 */
export function shouldConsiderRetreat(
  systemId: string,
  faction: Faction,
  allFactions: Faction[],
  allSystems: StarSystem[]
): { shouldRetreat: boolean; reason: string; urgency: 'low' | 'medium' | 'high' | 'critical' } {
  const assessment = assessSystemThreat(systemId, faction.id, allFactions, allSystems);
  const defensiveStrength = calculateDefensiveStrength(systemId, faction, allSystems);

  // Calculate threat-to-defense ratio
  const threatSum = assessment.immediateThreats.reduce((sum, t) => sum + t.threatScore, 0);
  const ratio = defensiveStrength > 0 ? threatSum / defensiveStrength : Infinity;

  if (ratio > 3) {
    return {
      shouldRetreat: true,
      reason: 'Overwhelming enemy force - retreat recommended',
      urgency: 'critical',
    };
  }

  if (ratio > 2) {
    return {
      shouldRetreat: true,
      reason: 'Significant enemy advantage - retreat advised',
      urgency: 'high',
    };
  }

  if (ratio > 1.5) {
    return {
      shouldRetreat: assessment.dangerLevel > 6,
      reason: 'Enemy has advantage - consider retreat if high value assets at risk',
      urgency: 'medium',
    };
  }

  if (ratio > 1) {
    return {
      shouldRetreat: false,
      reason: 'Slight enemy advantage - hold position with caution',
      urgency: 'low',
    };
  }

  return {
    shouldRetreat: false,
    reason: 'Defensive position is strong',
    urgency: 'low',
  };
}

