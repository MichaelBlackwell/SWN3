/**
 * UtilityScorer - Core Action Scoring Engine for AI Factions
 *
 * This service implements utility-based AI decision making by scoring potential
 * actions for each asset. It generates possible actions (Move, Attack, Expand,
 * Repair) and assigns scores using the formula:
 *   Score = (Base Utility + Tag Modifier + Goal Synergy)
 *
 * The scorer integrates data from:
 * - InfluenceMapService (spatial control analysis)
 * - ThreatAssessment (danger levels)
 * - GoalSelectionService (strategic intent)
 *
 * Based on SWN faction rules:
 * - Factions can take one type of action per turn
 * - That action can be performed by multiple assets
 * - Attack requires assets on the same world as the target
 * - Move requires 1 FacCred per asset moved
 */

import type { Faction, FactionAsset } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import type { AssetDefinition } from '../../types/asset';
import { getAssetById } from '../../data/assetLibrary';
import { getValidMovementDestinations } from '../../utils/movementUtils';
import { hasMovementAbility } from '../../utils/movementAbilities';
import { TAG_GOAL_AFFINITIES, type StrategicIntent } from './GoalSelectionService';
import type { InfluenceMap, HexInfluence } from './InfluenceMapService';
import type { SectorThreatOverview } from './ThreatAssessment';

/**
 * Helper to get hex influence from an InfluenceMap
 * Handles both Map (real implementation) and object (test mocks)
 */
function getHexInfluence(influenceMap: InfluenceMap, systemId: string): HexInfluence | undefined {
  if (influenceMap.hexes instanceof Map) {
    return influenceMap.hexes.get(systemId);
  }
  // Fallback for test mocks that use hexInfluence as an object
  const mockMap = influenceMap as unknown as { hexInfluence?: Record<string, HexInfluence> };
  return mockMap.hexInfluence?.[systemId];
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Types of actions an asset can perform
 */
export type ActionType = 'move' | 'attack' | 'expand' | 'repair' | 'use_ability' | 'defend';

/**
 * A potential action that can be scored
 */
export interface PotentialAction {
  type: ActionType;
  actingAssetId: string;
  actingAssetName: string;
  sourceLocation: string;
  targetLocation?: string; // For move actions
  targetFactionId?: string; // For attack actions
  targetAssetId?: string; // For attack actions
  targetAssetName?: string;
  description: string;
}

/**
 * A scored action with utility breakdown
 */
export interface ScoredAction {
  action: PotentialAction;
  score: number;
  baseUtility: number;
  tagModifier: number;
  goalSynergy: number;
  reasoning: string;
}

/**
 * Result of scoring all actions for a faction
 */
export interface ActionScoringResult {
  faction: Faction;
  scoredActions: ScoredAction[];
  bestAction: ScoredAction | null;
  actionsByType: Record<ActionType, ScoredAction[]>;
  reasoning: string;
}

/**
 * Configuration for the utility scorer
 */
export interface ScorerConfig {
  /** Weight multiplier for base utility (default: 1.0) */
  baseWeight: number;
  /** Weight multiplier for tag modifiers (default: 1.0) */
  tagWeight: number;
  /** Weight multiplier for goal synergy (default: 1.0) */
  goalWeight: number;
  /** Minimum score threshold for considering an action (default: 0) */
  minScoreThreshold: number;
}

const DEFAULT_CONFIG: ScorerConfig = {
  baseWeight: 1.0,
  tagWeight: 1.0,
  goalWeight: 1.0,
  minScoreThreshold: 0,
};

// ============================================================================
// ACTION GENERATION
// ============================================================================

/**
 * Generate all possible move actions for a faction's assets
 */
export function generateMoveActions(
  faction: Faction,
  systems: StarSystem[]
): PotentialAction[] {
  const actions: PotentialAction[] = [];

  for (const asset of faction.assets) {
    const assetDef = getAssetById(asset.definitionId);
    if (!assetDef) continue;

    // Check if asset can move:
    // - Has a specific movement ability (from movementAbilities registry)
    // - Is a Starship (can naturally move between systems)
    // - Faction has "Mercenary Group" tag (can move any assets)
    // Note: hasAction flag means the asset has a special ability, NOT movement capability
    const canMove =
      hasMovementAbility(asset.definitionId) ||
      assetDef.type === 'Starship' ||
      faction.tags.includes('Mercenary Group');

    if (!canMove) continue;

    // Get valid destinations
    const destinations = getValidMovementDestinations(asset.location, systems, 1);

    for (const destId of destinations) {
      const destSystem = systems.find((s) => s.id === destId);
      actions.push({
        type: 'move',
        actingAssetId: asset.id,
        actingAssetName: assetDef.name,
        sourceLocation: asset.location,
        targetLocation: destId,
        description: `Move ${assetDef.name} to ${destSystem?.name || destId}`,
      });
    }
  }

  return actions;
}

/**
 * Generate all possible attack actions for a faction's assets
 */
export function generateAttackActions(
  faction: Faction,
  allFactions: Faction[],
  _systems: StarSystem[]
): PotentialAction[] {
  const actions: PotentialAction[] = [];

  // Get all enemy assets by location
  const enemyAssetsByLocation = new Map<string, Array<{ faction: Faction; asset: FactionAsset; def: AssetDefinition }>>();

  for (const enemyFaction of allFactions) {
    if (enemyFaction.id === faction.id) continue;

    for (const enemyAsset of enemyFaction.assets) {
      // Skip stealthed assets (can't target what you can't see)
      if (enemyAsset.stealthed) continue;

      const enemyDef = getAssetById(enemyAsset.definitionId);
      if (!enemyDef) continue;

      const location = enemyAsset.location;
      if (!enemyAssetsByLocation.has(location)) {
        enemyAssetsByLocation.set(location, []);
      }
      enemyAssetsByLocation.get(location)!.push({
        faction: enemyFaction,
        asset: enemyAsset,
        def: enemyDef,
      });
    }
  }

  // For each of our assets that can attack, find targets at same location
  for (const asset of faction.assets) {
    const assetDef = getAssetById(asset.definitionId);
    if (!assetDef || !assetDef.attack) continue;

    const enemiesAtLocation = enemyAssetsByLocation.get(asset.location);
    if (!enemiesAtLocation || enemiesAtLocation.length === 0) continue;

    for (const enemy of enemiesAtLocation) {
      actions.push({
        type: 'attack',
        actingAssetId: asset.id,
        actingAssetName: assetDef.name,
        sourceLocation: asset.location,
        targetFactionId: enemy.faction.id,
        targetAssetId: enemy.asset.id,
        targetAssetName: enemy.def.name,
        description: `${assetDef.name} attacks ${enemy.faction.name}'s ${enemy.def.name}`,
      });
    }
  }

  return actions;
}

/**
 * Generate expand influence actions
 */
export function generateExpandActions(
  faction: Faction,
  systems: StarSystem[]
): PotentialAction[] {
  const actions: PotentialAction[] = [];

  // Find systems where we have assets but no Base of Influence
  const systemsWithAssets = new Set<string>();
  const systemsWithBoI = new Set<string>();

  for (const asset of faction.assets) {
    systemsWithAssets.add(asset.location);
    if (asset.definitionId === 'base_of_influence') {
      systemsWithBoI.add(asset.location);
    }
  }

  // Homeworld always has implicit BoI
  systemsWithBoI.add(faction.homeworld);

  // Generate expand actions for systems with assets but no BoI
  for (const systemId of systemsWithAssets) {
    if (systemsWithBoI.has(systemId)) continue;

    const system = systems.find((s) => s.id === systemId);
    actions.push({
      type: 'expand',
      actingAssetId: '', // No specific asset
      actingAssetName: 'Faction',
      sourceLocation: systemId,
      targetLocation: systemId,
      description: `Expand influence on ${system?.name || systemId}`,
    });
  }

  return actions;
}

/**
 * Generate defend actions (choosing to not attack, protecting assets)
 */
export function generateDefendActions(faction: Faction): PotentialAction[] {
  const actions: PotentialAction[] = [];

  // Group assets by location
  const assetsByLocation = new Map<string, FactionAsset[]>();
  for (const asset of faction.assets) {
    if (!assetsByLocation.has(asset.location)) {
      assetsByLocation.set(asset.location, []);
    }
    assetsByLocation.get(asset.location)!.push(asset);
  }

  // Generate a defend action for each location with assets
  for (const [location, assets] of assetsByLocation) {
    const assetNames = assets
      .map((a) => getAssetById(a.definitionId)?.name || 'Unknown')
      .slice(0, 3)
      .join(', ');

    actions.push({
      type: 'defend',
      actingAssetId: '', // No specific asset
      actingAssetName: 'Garrison',
      sourceLocation: location,
      description: `Defend ${assetNames}${assets.length > 3 ? '...' : ''} at ${location}`,
    });
  }

  return actions;
}

/**
 * Generate all possible actions for a faction
 */
export function generateAllActions(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[]
): PotentialAction[] {
  return [
    ...generateMoveActions(faction, systems),
    ...generateAttackActions(faction, allFactions, systems),
    ...generateExpandActions(faction, systems),
    ...generateDefendActions(faction),
  ];
}

// ============================================================================
// UTILITY SCORING
// ============================================================================

/**
 * Calculate base utility for a move action
 * HEAVILY prioritizes moving attackers toward enemy targets
 */
function scoreMoveAction(
  action: PotentialAction,
  faction: Faction,
  influenceMap: InfluenceMap,
  threatOverview: SectorThreatOverview,
  allFactions?: Faction[]
): { score: number; reasoning: string } {
  let score = 15; // Base score for movement
  const reasons: string[] = [];

  const movingAsset = faction.assets.find((a) => a.id === action.actingAssetId);
  const movingDef = movingAsset ? getAssetById(movingAsset.definitionId) : null;

  const targetInfluence = getHexInfluence(influenceMap, action.targetLocation!) as HexInfluence & { factionInfluence?: Record<string, number>; strategicValue?: number };

  // ============================================================================
  // ANALYZE ENEMIES AT SOURCE AND TARGET
  // ============================================================================
  let enemyAssetsAtTarget = 0;
  let enemyTotalHpAtTarget = 0;
  let hasEnemyBoIAtTarget = false;
  let enemyAssetsAtSource = 0;
  let canAttackEnemyAtTarget = false;
  
  if (allFactions && movingDef) {
    for (const enemyFaction of allFactions) {
      if (enemyFaction.id === faction.id) continue;
      
      for (const enemyAsset of enemyFaction.assets) {
        if (enemyAsset.stealthed) continue;
        
        if (enemyAsset.location === action.targetLocation) {
          enemyAssetsAtTarget++;
          enemyTotalHpAtTarget += enemyAsset.hp;
          if (enemyAsset.definitionId === 'base_of_influence') {
            hasEnemyBoIAtTarget = true;
          }
          
          // Check if we can actually attack this enemy
          if (movingDef.attack) {
            const enemyDef = getAssetById(enemyAsset.definitionId);
            if (enemyDef) {
              // Check attack compatibility (both are capitalized: 'Force', 'Cunning', 'Wealth')
              const attackTarget = movingDef.attack.defenderAttribute;
              if (attackTarget === enemyDef.category) {
                canAttackEnemyAtTarget = true;
              }
            }
          }
        }
        
        if (enemyAsset.location === action.sourceLocation) {
          enemyAssetsAtSource++;
        }
      }
    }
  }

  // ============================================================================
  // MASSIVE BONUS for moving attacker toward ATTACKABLE enemies
  // ============================================================================
  if (movingDef?.attack && canAttackEnemyAtTarget) {
    score += 60;  // HUGE bonus - this enables an attack next turn!
    reasons.push('ATTACK POSITION');
    
    // Extra bonus for targeting enemy Base of Influence
    if (hasEnemyBoIAtTarget) {
      score += 25;
      reasons.push('enemy base!');
    }
    
    // Bonus if we're healthy
    if (movingAsset && movingAsset.hp >= movingAsset.maxHp * 0.6) {
      score += 15;
      reasons.push('healthy attacker');
    }
    
    // Bonus if enemy is weak
    if (enemyTotalHpAtTarget <= 6) {
      score += 20;
      reasons.push('weak enemy');
    }
  } 
  // Still good to move attacker toward enemies even if can't attack directly
  else if (movingDef?.attack && enemyAssetsAtTarget > 0) {
    score += 30;
    reasons.push('approaching enemies');
  }

  // ============================================================================
  // NON-ATTACKER MOVEMENT
  // ============================================================================
  
  // Non-attackers moving to enemy territory is risky unless it's for expansion
  if (!movingDef?.attack && enemyAssetsAtTarget > 0) {
    score -= 20;
    reasons.push('non-combat asset avoiding enemies');
  }

  // Bonus for moving to less controlled territory (expansion)
  if (targetInfluence?.factionInfluence) {
    const ourControl = targetInfluence.factionInfluence[faction.id] || 0;
    if (ourControl < 30 && enemyAssetsAtTarget === 0) {
      score += 10;
      reasons.push('expanding territory');
    }
  }

  // ============================================================================
  // TACTICAL CONSIDERATIONS
  // ============================================================================
  
  const systemThreats = threatOverview.systemThreats ?? {};
  const targetThreat = systemThreats[action.targetLocation!];

  // Retreat damaged assets
  if (movingAsset && movingAsset.hp < movingAsset.maxHp * 0.4 && enemyAssetsAtSource > 0) {
    if (!targetThreat || targetThreat.overallDangerLevel < 30) {
      score += 25;
      reasons.push('retreating damaged asset');
    }
  }

  // Don't move healthy attackers AWAY from enemies
  if (movingDef?.attack && enemyAssetsAtSource > 0 && enemyAssetsAtTarget === 0) {
    score -= 30;
    reasons.push('stay and fight');
  }

  // Strategic positioning bonus
  if (targetInfluence?.strategicValue && targetInfluence.strategicValue > 50) {
    score += 8;
    reasons.push('strategic location');
  }

  return {
    score: Math.max(0, score),
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'standard movement',
  };
}

/**
 * Parse dice expression and return average damage value
 * E.g., "1d4" -> 2.5, "2d6" -> 7, "1d8+2" -> 6.5
 */
function parseDamageAverage(damage: string | undefined): number {
  if (!damage) return 0;
  
  const match = damage.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!match) return 0;
  
  const numDice = parseInt(match[1], 10);
  const dieSize = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  
  return numDice * ((1 + dieSize) / 2) + modifier;
}

/**
 * Calculate base utility for an attack action
 * Made more aggressive to encourage AI to fight
 */
function scoreAttackAction(
  action: PotentialAction,
  faction: Faction,
  allFactions: Faction[],
  _influenceMap: InfluenceMap,
  threatOverview: SectorThreatOverview
): { score: number; reasoning: string } {
  let score = 50; // Base score for attacks - increased from 30 to encourage aggression
  const reasons: string[] = [];

  const attackingAsset = faction.assets.find((a) => a.id === action.actingAssetId);
  const attackingDef = attackingAsset ? getAssetById(attackingAsset.definitionId) : null;

  const targetFaction = allFactions.find((f) => f.id === action.targetFactionId);
  const targetAsset = targetFaction?.assets.find((a) => a.id === action.targetAssetId);
  const targetDef = targetAsset ? getAssetById(targetAsset.definitionId) : null;

  if (!attackingDef || !targetDef || !targetAsset || !attackingAsset) {
    return { score: 0, reasoning: 'invalid target' };
  }

  // Calculate expected damage we'd deal
  const ourAvgDamage = parseDamageAverage(attackingDef.attack?.damage);
  
  // KILL SHOT BONUS: Huge incentive if we can destroy the target
  if (ourAvgDamage >= targetAsset.hp) {
    score += 40;
    reasons.push('likely kill shot!');
  } else if (ourAvgDamage >= targetAsset.hp * 0.7) {
    score += 25;
    reasons.push('heavy damage expected');
  }

  // Bonus for attacking weak targets (easier kill)
  if (targetAsset.hp <= 3) {
    score += 30;
    reasons.push('target near destruction');
  } else if (targetAsset.hp <= 5) {
    score += 15;
    reasons.push('target weakened');
  }

  // Bonus for attacking high-value targets (worth the risk)
  if (targetDef.cost >= 15) {
    score += 25;
    reasons.push('high-value target');
  } else if (targetDef.cost >= 8) {
    score += 15;
    reasons.push('moderate-value target');
  } else if (targetDef.cost >= 4) {
    score += 8;
    reasons.push('reasonable target');
  }

  // Bonus for attacking Base of Influence (strategic target)
  if (targetAsset.definitionId === 'base_of_influence') {
    score += 20;
    reasons.push('targeting enemy base');
  }

  // HP advantage calculation - more granular
  const hpRatio = attackingAsset.hp / Math.max(1, targetAsset.hp);
  if (hpRatio >= 2) {
    score += 25;
    reasons.push('strong HP advantage');
  } else if (hpRatio >= 1.3) {
    score += 15;
    reasons.push('HP advantage');
  } else if (hpRatio < 0.7) {
    score -= 10;
    reasons.push('HP disadvantage');
  }

  // Consider counterattack risk - but don't be too scared
  if (targetDef.counterattack) {
    const counterDamage = parseDamageAverage(targetDef.counterattack.damage);
    if (counterDamage >= attackingAsset.hp) {
      score -= 20;
      reasons.push('risky counterattack');
    } else if (counterDamage >= attackingAsset.hp * 0.5) {
      score -= 8;
      reasons.push('moderate counterattack risk');
    }
    // Don't penalize weak counterattacks
  }

  // Bonus for attacking at favorable location
  const attackSystemThreats = threatOverview.systemThreats ?? {};
  const locationThreat = attackSystemThreats[action.sourceLocation];
  if (locationThreat && locationThreat.overallDangerLevel < 30) {
    score += 10;
    reasons.push('favorable battlefield');
  }

  // Small penalty if we're damaged, but don't be a coward
  if (attackingAsset.hp <= 2 && attackingAsset.maxHp > 4) {
    score -= 10;
    reasons.push('attacker weakened');
  }

  // Bonus for healthy attacker (can sustain a fight)
  if (attackingAsset.hp >= attackingAsset.maxHp * 0.8) {
    score += 10;
    reasons.push('attacker healthy');
  }

  return {
    score: Math.max(0, score),
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'standard attack',
  };
}

/**
 * Calculate base utility for an expand action
 */
function scoreExpandAction(
  action: PotentialAction,
  faction: Faction,
  influenceMap: InfluenceMap,
  _threatOverview: SectorThreatOverview
): { score: number; reasoning: string } {
  let score = 40; // Base score for expansion (valuable action)
  const reasons: string[] = [];

  const targetInfluence = getHexInfluence(influenceMap, action.targetLocation!);

  // Bonus for high strategic value locations
  // Note: strategicValue is from test mocks, real HexInfluence doesn't have it
  const targetWithStrategic = targetInfluence as HexInfluence & { strategicValue?: number; factionInfluence?: Record<string, number> };
  if (targetWithStrategic?.strategicValue && targetWithStrategic.strategicValue > 60) {
    score += 20;
    reasons.push('high strategic value');
  }

  // Bonus if we already have strong presence
  if (targetWithStrategic?.factionInfluence) {
    const ourControl = targetWithStrategic.factionInfluence[faction.id] || 0;
    if (ourControl > 50) {
      score += 15;
      reasons.push('strong existing presence');
    }
  }

  // Bonus if we have plenty of FacCreds
  if (faction.facCreds > 10) {
    score += 10;
    reasons.push('can afford expansion');
  }

  // Penalty if low on credits
  if (faction.facCreds < 5) {
    score -= 20;
    reasons.push('low on credits');
  }

  return {
    score: Math.max(0, score),
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'standard expansion',
  };
}

/**
 * Calculate base utility for a defend action
 * Reduced scoring to prevent AI from being too passive
 */
function scoreDefendAction(
  action: PotentialAction,
  faction: Faction,
  _influenceMap: InfluenceMap,
  threatOverview: SectorThreatOverview
): { score: number; reasoning: string } {
  let score = 5; // Low base score - defending is passive and often means "do nothing"
  const reasons: string[] = [];

  const defendSystemThreats = threatOverview.systemThreats ?? {};
  const defendLocationThreat = defendSystemThreats[action.sourceLocation];

  // Only give significant bonus for defending when under real threat
  if (defendLocationThreat && defendLocationThreat.overallDangerLevel > 70) {
    score += 25;
    reasons.push('high threat level');
  } else if (defendLocationThreat && defendLocationThreat.overallDangerLevel > 50) {
    score += 12;
    reasons.push('moderate threat');
  }
  // Low threat = don't bother defending, go attack instead

  // Bonus for defending homeworld - but only if under threat
  if (action.sourceLocation === faction.homeworld) {
    if (defendLocationThreat && defendLocationThreat.overallDangerLevel > 40) {
      score += 15;
      reasons.push('defending threatened homeworld');
    } else {
      score += 5;
      reasons.push('homeworld garrison');
    }
  }

  // Small bonus if we have damaged assets there
  const assetsAtLocation = faction.assets.filter((a) => a.location === action.sourceLocation);
  const damagedAssets = assetsAtLocation.filter((a) => a.hp < a.maxHp);
  if (damagedAssets.length > 0) {
    score += 5;
    reasons.push('protecting damaged assets');
  }

  return {
    score: Math.max(0, score),
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'passive stance',
  };
}

/**
 * Calculate base utility for an action
 */
function calculateBaseUtility(
  action: PotentialAction,
  faction: Faction,
  allFactions: Faction[],
  influenceMap: InfluenceMap,
  threatOverview: SectorThreatOverview
): { score: number; reasoning: string } {
  switch (action.type) {
    case 'move':
      return scoreMoveAction(action, faction, influenceMap, threatOverview, allFactions);
    case 'attack':
      return scoreAttackAction(action, faction, allFactions, influenceMap, threatOverview);
    case 'expand':
      return scoreExpandAction(action, faction, influenceMap, threatOverview);
    case 'defend':
      return scoreDefendAction(action, faction, influenceMap, threatOverview);
    default:
      return { score: 10, reasoning: 'unknown action type' };
  }
}

/**
 * Calculate tag modifier for an action
 */
function calculateTagModifier(
  action: PotentialAction,
  faction: Faction
): { modifier: number; reasoning: string } {
  let modifier = 0;
  const reasons: string[] = [];

  for (const tag of faction.tags) {
    const affinity = TAG_GOAL_AFFINITIES[tag];
    if (!affinity) continue;

    switch (action.type) {
      case 'attack':
        // Aggressive tags boost attack
        if (affinity.aggressionModifier > 10) {
          modifier += 15;
          reasons.push(`${tag} favors aggression`);
        }
        // Peaceful tags penalize attack
        if (affinity.aggressionModifier < -10) {
          modifier -= 15;
          reasons.push(`${tag} discourages aggression`);
        }
        break;

      case 'defend':
        // Defensive tags boost defense
        if (affinity.aggressionModifier < 0) {
          modifier += 10;
          reasons.push(`${tag} favors caution`);
        }
        break;

      case 'expand':
        // Expansionist tags boost expansion
        if (
          tag === 'Imperialists' ||
          tag === 'Colonists' ||
          tag === 'Planetary Government'
        ) {
          modifier += 15;
          reasons.push(`${tag} favors expansion`);
        }
        break;

      case 'move':
        // Mobile tags boost movement
        if (tag === 'Mercenary Group' || tag === 'Pirates') {
          modifier += 10;
          reasons.push(`${tag} favors mobility`);
        }
        break;
    }
  }

  return {
    modifier,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'no tag modifiers',
  };
}

/**
 * Calculate goal synergy for an action
 * Made more aggressive for military/covert focuses
 */
function calculateGoalSynergy(
  action: PotentialAction,
  _faction: Faction,
  strategicIntent: StrategicIntent
): { synergy: number; reasoning: string } {
  let synergy = 0;
  const reasons: string[] = [];

  switch (strategicIntent.primaryFocus) {
    case 'military':
      if (action.type === 'attack') {
        synergy += 40; // Increased from 25 - military should attack!
        reasons.push('military focus strongly favors attacks');
      }
      if (action.type === 'move') {
        synergy += 15; // Positioning for attacks
        reasons.push('military values positioning');
      }
      if (action.type === 'defend') {
        synergy -= 5; // Slight penalty - military should be on offense
        reasons.push('military prefers offense');
      }
      break;

    case 'economic':
      if (action.type === 'expand') {
        synergy += 25;
        reasons.push('economic focus favors expansion');
      }
      if (action.type === 'defend') {
        synergy += 10;
        reasons.push('economic focus protects assets');
      }
      break;

    case 'covert':
      if (action.type === 'attack') {
        synergy += 30; // Increased from 15 - covert ops should strike
        reasons.push('covert focus supports strikes');
      }
      if (action.type === 'move') {
        synergy += 15;
        reasons.push('covert focus values positioning');
      }
      break;

    case 'expansion':
      if (action.type === 'expand') {
        synergy += 35;
        reasons.push('expansion focus strongly favors BoI');
      }
      if (action.type === 'move') {
        synergy += 20;
        reasons.push('expansion focus values movement');
      }
      if (action.type === 'attack') {
        synergy += 15; // Clear the way for expansion
        reasons.push('clearing path for expansion');
      }
      break;

    case 'defensive':
      if (action.type === 'defend') {
        synergy += 25;
        reasons.push('defensive focus favors defense');
      }
      if (action.type === 'attack') {
        synergy -= 10;
        reasons.push('defensive focus discourages attacks');
      }
      break;

    case 'balanced':
      // Balanced gets small bonuses across the board
      if (action.type === 'attack') {
        synergy += 15;
        reasons.push('balanced approach allows attacks');
      }
      if (action.type === 'move') {
        synergy += 10;
        reasons.push('balanced values flexibility');
      }
      break;
  }

  // Bonus for targeting the primary threat faction
  if (
    action.type === 'attack' &&
    action.targetFactionId === strategicIntent.targetFactionId
  ) {
    synergy += 30; // Increased from 20 - focus on the target!
    reasons.push('targeting primary threat');
  }

  // Bonus for moving toward primary threat
  if (
    action.type === 'move' &&
    strategicIntent.targetFactionId
  ) {
    synergy += 10;
    reasons.push('moving toward threat');
  }

  // Bonus for actions at priority systems
  if (
    strategicIntent.prioritySystemIds.includes(action.sourceLocation) ||
    (action.targetLocation && strategicIntent.prioritySystemIds.includes(action.targetLocation))
  ) {
    synergy += 10;
    reasons.push('priority system');
  }

  // Aggression level modifier - more impactful
  if (strategicIntent.aggressionLevel > 70) {
    if (action.type === 'attack') {
      synergy += 25; // Increased from 15
      reasons.push('high aggression');
    }
    if (action.type === 'defend') {
      synergy -= 10; // Penalty for being passive when aggressive
      reasons.push('too aggressive to defend');
    }
  } else if (strategicIntent.aggressionLevel > 50) {
    if (action.type === 'attack') {
      synergy += 10;
      reasons.push('moderate aggression');
    }
  }
  
  if (strategicIntent.aggressionLevel < 30 && action.type === 'defend') {
    synergy += 15;
    reasons.push('low aggression favors defense');
  }

  return {
    synergy,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'no goal synergy',
  };
}

/**
 * Score a single action
 */
export function scoreAction(
  action: PotentialAction,
  faction: Faction,
  allFactions: Faction[],
  influenceMap: InfluenceMap,
  threatOverview: SectorThreatOverview,
  strategicIntent: StrategicIntent,
  config: ScorerConfig = DEFAULT_CONFIG
): ScoredAction {
  const base = calculateBaseUtility(action, faction, allFactions, influenceMap, threatOverview);
  const tag = calculateTagModifier(action, faction);
  const goal = calculateGoalSynergy(action, faction, strategicIntent);

  const score =
    base.score * config.baseWeight +
    tag.modifier * config.tagWeight +
    goal.synergy * config.goalWeight;

  return {
    action,
    score: Math.max(0, score),
    baseUtility: base.score,
    tagModifier: tag.modifier,
    goalSynergy: goal.synergy,
    reasoning: `Base: ${base.reasoning}. Tags: ${tag.reasoning}. Goal: ${goal.reasoning}`,
  };
}

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

/**
 * Score all possible actions for a faction
 */
export function scoreAllActions(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[],
  influenceMap: InfluenceMap,
  threatOverview: SectorThreatOverview,
  strategicIntent: StrategicIntent,
  config: ScorerConfig = DEFAULT_CONFIG
): ActionScoringResult {
  // Generate all possible actions
  const allActions = generateAllActions(faction, allFactions, systems);

  // Score each action
  const scoredActions = allActions
    .map((action) =>
      scoreAction(action, faction, allFactions, influenceMap, threatOverview, strategicIntent, config)
    )
    .filter((scored) => scored.score >= config.minScoreThreshold)
    .sort((a, b) => b.score - a.score);

  // Group by type
  const actionsByType: Record<ActionType, ScoredAction[]> = {
    move: [],
    attack: [],
    expand: [],
    repair: [],
    use_ability: [],
    defend: [],
  };

  for (const scored of scoredActions) {
    actionsByType[scored.action.type].push(scored);
  }

  // Find best action
  const bestAction = scoredActions.length > 0 ? scoredActions[0] : null;

  // Build reasoning
  const reasoningParts: string[] = [];
  reasoningParts.push(`Generated ${allActions.length} potential actions`);
  reasoningParts.push(`${scoredActions.length} passed threshold`);

  if (bestAction) {
    reasoningParts.push(
      `Best: ${bestAction.action.description} (score: ${bestAction.score.toFixed(0)})`
    );
  } else {
    reasoningParts.push('No viable actions found');
  }

  return {
    faction,
    scoredActions,
    bestAction,
    actionsByType,
    reasoning: reasoningParts.join('. '),
  };
}

/**
 * Get the best action of a specific type
 */
export function getBestActionOfType(
  result: ActionScoringResult,
  type: ActionType
): ScoredAction | null {
  const actionsOfType = result.actionsByType[type];
  return actionsOfType.length > 0 ? actionsOfType[0] : null;
}

/**
 * Get all actions above a score threshold
 */
export function getActionsAboveThreshold(
  result: ActionScoringResult,
  threshold: number
): ScoredAction[] {
  return result.scoredActions.filter((a) => a.score >= threshold);
}

/**
 * Get the recommended action type for this turn
 * (Factions can only take one type of action per turn)
 */
export function getRecommendedActionType(result: ActionScoringResult): ActionType | null {
  if (!result.bestAction) return null;
  return result.bestAction.action.type;
}

/**
 * Get all actions of the recommended type
 * (Since factions can perform the same action type with multiple assets)
 */
export function getRecommendedActions(result: ActionScoringResult): ScoredAction[] {
  const recommendedType = getRecommendedActionType(result);
  if (!recommendedType) return [];
  return result.actionsByType[recommendedType];
}

