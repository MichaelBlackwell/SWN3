/**
 * AIEconomyManager - Purchasing & Resource Allocation for AI Factions
 *
 * This service implements the economic decision-making logic for AI factions.
 * It manages FacCreds spending on repairs and asset purchases based on:
 * - Threat level from ThreatAssessment (reserve funds for repairs when high)
 * - Strategic intent from GoalSelectionService (buy assets that support goals)
 * - Faction tags (prioritize assets that synergize with personality)
 *
 * Based on SWN faction rules:
 * - Factions can only buy one asset per turn
 * - Assets must be purchased on homeworld or a world with Base of Influence
 * - Assets require sufficient rating and tech level
 * - Repair costs 1 FacCred for first batch, +1 for each additional batch
 */

import type { Faction, FactionAsset, FactionTag } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import type { AssetDefinition, AssetCategory } from '../../types/asset';
import { getAssetById, getAllAssetsForFaction } from '../../data/assetLibrary';
import type { StrategicIntent } from './GoalSelectionService';
import type { SectorThreatOverview } from './ThreatAssessment';
import { hasMovementAbility } from '../../utils/movementAbilities';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Repair decision for a damaged asset
 */
export interface RepairDecision {
  assetId: string;
  assetName: string;
  location: string;
  currentHp: number;
  maxHp: number;
  damageAmount: number;
  repairCost: number;
  priority: number; // Higher = more urgent
  reasoning: string;
}

/**
 * Purchase recommendation for a new asset
 */
export interface PurchaseRecommendation {
  assetDefinition: AssetDefinition;
  location: string; // Where to purchase
  score: number; // Overall desirability score
  baseScore: number; // Base utility of the asset
  tagSynergyScore: number; // Bonus from faction tags
  goalSynergyScore: number; // Bonus from current goal alignment
  diversificationScore: number; // Bonus/penalty for variety
  strategicNeedsScore: number; // Bonus for filling capability gaps
  reasoning: string;
}

/**
 * Complete economic plan for an AI turn
 */
export interface EconomicPlan {
  faction: Faction;
  availableFacCreds: number;
  threatLevel: number;
  repairReserve: number; // FacCreds reserved for repairs
  spendingBudget: number; // FacCreds available for purchases
  repairDecisions: RepairDecision[];
  purchaseRecommendation: PurchaseRecommendation | null;
  totalRepairCost: number;
  reasoning: string;
}

/**
 * Tag-asset synergy mapping
 */
export interface TagAssetSynergy {
  tag: FactionTag;
  preferredAssetTypes: string[]; // Asset type names that synergize
  preferredCategories: AssetCategory[];
  bonusScore: number;
}

// ============================================================================
// TAG-ASSET SYNERGY DEFINITIONS
// ============================================================================

/**
 * Defines which asset types and categories synergize with each faction tag
 */
export const TAG_ASSET_SYNERGIES: Record<FactionTag, TagAssetSynergy> = {
  Colonists: {
    tag: 'Colonists',
    preferredAssetTypes: ['Facility', 'Logistics Facility'],
    preferredCategories: ['Wealth'],
    bonusScore: 15,
  },
  'Deep Rooted': {
    tag: 'Deep Rooted',
    preferredAssetTypes: ['Facility', 'Military Unit'],
    preferredCategories: ['Force'],
    bonusScore: 15,
  },
  'Eugenics Cult': {
    tag: 'Eugenics Cult',
    preferredAssetTypes: ['Special Forces', 'Military Unit'],
    preferredCategories: ['Force', 'Cunning'],
    bonusScore: 20,
  },
  'Exchange Consulate': {
    tag: 'Exchange Consulate',
    preferredAssetTypes: ['Facility', 'Starship'],
    preferredCategories: ['Wealth'],
    bonusScore: 20,
  },
  Fanatical: {
    tag: 'Fanatical',
    preferredAssetTypes: ['Special Forces', 'Military Unit'],
    preferredCategories: ['Force'],
    bonusScore: 15,
  },
  Imperialists: {
    tag: 'Imperialists',
    preferredAssetTypes: ['Military Unit', 'Starship', 'Facility'],
    preferredCategories: ['Force'],
    bonusScore: 20,
  },
  Machiavellian: {
    tag: 'Machiavellian',
    preferredAssetTypes: ['Special Forces', 'Tactic'],
    preferredCategories: ['Cunning'],
    bonusScore: 20,
  },
  'Mercenary Group': {
    tag: 'Mercenary Group',
    preferredAssetTypes: ['Military Unit', 'Special Forces', 'Starship'],
    preferredCategories: ['Force'],
    bonusScore: 15,
  },
  'Perimeter Agency': {
    tag: 'Perimeter Agency',
    preferredAssetTypes: ['Special Forces', 'Tactic'],
    preferredCategories: ['Cunning', 'Force'],
    bonusScore: 15,
  },
  Pirates: {
    tag: 'Pirates',
    preferredAssetTypes: ['Starship', 'Special Forces'],
    preferredCategories: ['Cunning', 'Wealth'],
    bonusScore: 20,
  },
  'Planetary Government': {
    tag: 'Planetary Government',
    preferredAssetTypes: ['Facility', 'Military Unit'],
    preferredCategories: ['Force', 'Wealth'],
    bonusScore: 15,
  },
  Plutocratic: {
    tag: 'Plutocratic',
    preferredAssetTypes: ['Facility', 'Special Forces'],
    preferredCategories: ['Wealth'],
    bonusScore: 25,
  },
  'Preceptor Archive': {
    tag: 'Preceptor Archive',
    preferredAssetTypes: ['Facility', 'Special Forces'],
    preferredCategories: ['Wealth', 'Cunning'],
    bonusScore: 15,
  },
  'Psychic Academy': {
    tag: 'Psychic Academy',
    preferredAssetTypes: ['Special Forces', 'Tactic'],
    preferredCategories: ['Cunning'],
    bonusScore: 20,
  },
  Savage: {
    tag: 'Savage',
    preferredAssetTypes: ['Military Unit', 'Special Forces'],
    preferredCategories: ['Force'],
    bonusScore: 15,
  },
  Scavengers: {
    tag: 'Scavengers',
    preferredAssetTypes: ['Starship', 'Facility'],
    preferredCategories: ['Wealth'],
    bonusScore: 20,
  },
  Secretive: {
    tag: 'Secretive',
    preferredAssetTypes: ['Special Forces', 'Tactic', 'Logistics Facility'],
    preferredCategories: ['Cunning'],
    bonusScore: 25,
  },
  'Technical Expertise': {
    tag: 'Technical Expertise',
    preferredAssetTypes: ['Facility', 'Starship'],
    preferredCategories: ['Wealth'],
    bonusScore: 15,
  },
  Theocratic: {
    tag: 'Theocratic',
    preferredAssetTypes: ['Special Forces', 'Facility'],
    preferredCategories: ['Cunning', 'Force'],
    bonusScore: 15,
  },
  Warlike: {
    tag: 'Warlike',
    preferredAssetTypes: ['Military Unit', 'Special Forces', 'Starship'],
    preferredCategories: ['Force'],
    bonusScore: 25,
  },
};

// ============================================================================
// REPAIR LOGIC
// ============================================================================

/**
 * Calculate repair priority for a damaged asset
 */
function calculateRepairPriority(
  asset: FactionAsset,
  assetDef: AssetDefinition | undefined,
  threatLevel: number
): { priority: number; reasoning: string } {
  if (!assetDef) {
    return { priority: 0, reasoning: 'Unknown asset type' };
  }

  const damagePercent = 1 - asset.hp / asset.maxHp;
  const reasons: string[] = [];

  // Base priority from damage percentage
  let priority = damagePercent * 50;
  reasons.push(`${Math.round(damagePercent * 100)}% damaged`);

  // Higher priority for expensive assets
  if (assetDef.cost >= 15) {
    priority += 20;
    reasons.push('high-value asset');
  } else if (assetDef.cost >= 8) {
    priority += 10;
    reasons.push('moderate-value asset');
  }

  // Higher priority for combat-capable assets when under threat
  if (threatLevel > 50 && (assetDef.attack || assetDef.counterattack)) {
    priority += 15;
    reasons.push('combat asset under threat');
  }

  // Critical priority if near destruction
  if (asset.hp <= 2) {
    priority += 25;
    reasons.push('near destruction');
  }

  // Lower priority for assets that can't attack or defend
  if (!assetDef.attack && !assetDef.counterattack) {
    priority -= 10;
    reasons.push('non-combat asset');
  }

  return {
    priority: Math.max(0, priority),
    reasoning: reasons.join(', '),
  };
}

/**
 * Calculate repair cost using SWN rules
 * First batch costs 1 FacCred, each additional batch costs +1 more
 */
function calculateRepairCost(
  damageAmount: number,
  healingPerBatch: number
): number {
  if (damageAmount <= 0 || healingPerBatch <= 0) return 0;

  const batchesNeeded = Math.ceil(damageAmount / healingPerBatch);
  // Cost is 1 + 2 + 3 + ... + n = n(n+1)/2
  return (batchesNeeded * (batchesNeeded + 1)) / 2;
}

/**
 * Generate repair decisions for all damaged assets
 */
export function generateRepairDecisions(
  faction: Faction,
  threatLevel: number
): RepairDecision[] {
  const decisions: RepairDecision[] = [];

  // Healing per batch is based on ruling attribute (highest of Force, Cunning, Wealth)
  const healingPerBatch = Math.max(
    faction.attributes.force,
    faction.attributes.cunning,
    faction.attributes.wealth
  );

  for (const asset of faction.assets) {
    if (asset.hp < asset.maxHp) {
      const assetDef = getAssetById(asset.definitionId);
      const damageAmount = asset.maxHp - asset.hp;
      const repairCost = calculateRepairCost(damageAmount, healingPerBatch);
      const { priority, reasoning } = calculateRepairPriority(asset, assetDef, threatLevel);

      decisions.push({
        assetId: asset.id,
        assetName: assetDef?.name || 'Unknown',
        location: asset.location,
        currentHp: asset.hp,
        maxHp: asset.maxHp,
        damageAmount,
        repairCost,
        priority,
        reasoning,
      });
    }
  }

  // Sort by priority (highest first)
  return decisions.sort((a, b) => b.priority - a.priority);
}

/**
 * Calculate how much to reserve for repairs based on threat level
 */
export function calculateRepairReserve(
  totalRepairCost: number,
  threatLevel: number,
  availableFacCreds: number
): number {
  // Base reserve is proportional to threat level
  // At 0 threat, reserve 0%
  // At 100 threat, reserve up to 80% of repair costs
  const threatMultiplier = Math.min(1, threatLevel / 100) * 0.8;
  const desiredReserve = Math.ceil(totalRepairCost * threatMultiplier);

  // Don't reserve more than we have or more than we need
  return Math.min(desiredReserve, availableFacCreds, totalRepairCost);
}

// ============================================================================
// PURCHASE LOGIC
// ============================================================================

/**
 * Calculate tag synergy score for an asset
 */
function calculateTagSynergyScore(
  assetDef: AssetDefinition,
  faction: Faction
): { score: number; reasoning: string } {
  let score = 0;
  const reasons: string[] = [];

  for (const tag of faction.tags) {
    const synergy = TAG_ASSET_SYNERGIES[tag];
    if (!synergy) continue;

    // Check asset type match
    if (synergy.preferredAssetTypes.includes(assetDef.type)) {
      score += synergy.bonusScore;
      reasons.push(`${tag} favors ${assetDef.type}`);
    }

    // Check category match
    if (synergy.preferredCategories.includes(assetDef.category)) {
      score += synergy.bonusScore * 0.5;
      reasons.push(`${tag} favors ${assetDef.category}`);
    }
  }

  return {
    score,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'No tag synergy',
  };
}

/**
 * Calculate goal synergy score for an asset
 */
function calculateGoalSynergyScore(
  assetDef: AssetDefinition,
  strategicIntent: StrategicIntent
): { score: number; reasoning: string } {
  let score = 0;
  const reasons: string[] = [];

  switch (strategicIntent.primaryFocus) {
    case 'military':
      if (assetDef.category === 'Force') {
        score += 30;
        reasons.push('Force asset for military focus');
      }
      if (assetDef.attack) {
        score += 20;
        reasons.push('Has attack capability');
      }
      break;

    case 'economic':
      if (assetDef.category === 'Wealth') {
        score += 30;
        reasons.push('Wealth asset for economic focus');
      }
      if (assetDef.specialFlags.hasAction) {
        score += 10;
        reasons.push('Has special action');
      }
      break;

    case 'covert':
      if (assetDef.category === 'Cunning') {
        score += 30;
        reasons.push('Cunning asset for covert focus');
      }
      if (assetDef.type === 'Special Forces' || assetDef.type === 'Tactic') {
        score += 15;
        reasons.push('Covert-style asset type');
      }
      break;

    case 'expansion':
      if (assetDef.type === 'Logistics Facility' || assetDef.type === 'Starship') {
        score += 25;
        reasons.push('Supports expansion');
      }
      break;

    case 'defensive':
      if (assetDef.counterattack) {
        score += 25;
        reasons.push('Has counterattack for defense');
      }
      if (assetDef.hp >= 10) {
        score += 15;
        reasons.push('High HP for durability');
      }
      break;
  }

  // Bonus for high aggression and attack capability
  if (strategicIntent.aggressionLevel > 60 && assetDef.attack) {
    score += 10;
    reasons.push('Aggressive stance favors attackers');
  }

  // Bonus for low aggression and defensive capability
  if (strategicIntent.aggressionLevel < 40 && assetDef.counterattack && !assetDef.attack) {
    score += 10;
    reasons.push('Defensive stance favors pure defenders');
  }

  return {
    score,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'No goal synergy',
  };
}

/**
 * Parse dice expression and return average damage value
 * E.g., "1d4" -> 2.5, "2d6" -> 7, "1d8+2" -> 6.5
 */
function parseDamageAverage(damage: string | undefined): number {
  if (!damage) return 0;
  
  // Match patterns like "1d4", "2d6+2", "1d8-1"
  const match = damage.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!match) return 0;
  
  const numDice = parseInt(match[1], 10);
  const dieSize = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  
  // Average of a die is (1 + dieSize) / 2
  const avgPerDie = (1 + dieSize) / 2;
  return numDice * avgPerDie + modifier;
}

/**
 * Calculate base score for an asset (value for cost)
 * Revised to not overly favor cheap assets
 */
function calculateBaseScore(assetDef: AssetDefinition): number {
  let score = 0;

  // Raw HP value with slight scaling (not HP per cost which favors cheap assets)
  // Higher HP is better, but diminishing returns
  score += Math.sqrt(assetDef.hp) * 5;

  // Attack capability - scale by damage output
  if (assetDef.attack) {
    const avgDamage = parseDamageAverage(assetDef.attack.damage);
    // Base +10 for having attack, plus damage scaling
    score += 10 + avgDamage * 3;
  }

  // Counterattack capability - scale by damage output
  if (assetDef.counterattack) {
    const avgDamage = parseDamageAverage(assetDef.counterattack.damage);
    // Base +8 for having counterattack, plus damage scaling
    score += 8 + avgDamage * 2;
  }

  // Special abilities
  if (assetDef.specialFlags.hasAction) {
    score += 8;
  }
  if (assetDef.specialFlags.hasSpecial) {
    score += 5;
  }

  // Investment value bonus: higher-tier assets are more powerful per-rating
  // Small bonus for higher required rating (represents better long-term value)
  score += assetDef.requiredRating * 3;

  // Penalize high maintenance
  score -= assetDef.maintenance * 8;

  // Penalize assets requiring permission (harder to place)
  if (assetDef.specialFlags.requiresPermission) {
    score -= 5;
  }

  return Math.max(0, score);
}

// ============================================================================
// INCOME-GENERATING ASSETS
// ============================================================================

/**
 * Asset IDs that generate passive income or have income-generating abilities
 */
const INCOME_GENERATING_ASSETS: Record<string, { passive: boolean; avgIncome: number }> = {
  'cunning_4_party_machine': { passive: true, avgIncome: 1 },      // 1 FacCred/turn passive
  'wealth_1_harvesters': { passive: false, avgIncome: 0.5 },       // 1d6, 3+ = 1 FacCred (50% chance)
  'wealth_6_pretech_manufactory': { passive: false, avgIncome: 2.25 }, // 1d8/2 rounded up avg
};

/**
 * Check if an asset generates income
 */
function isIncomeGeneratingAsset(assetDefinitionId: string): boolean {
  return assetDefinitionId in INCOME_GENERATING_ASSETS;
}

// ============================================================================
// DIVERSIFICATION SCORING
// ============================================================================

/**
 * Calculate diversification score - penalizes duplicates, rewards variety
 */
function calculateDiversificationScore(
  assetDef: AssetDefinition,
  faction: Faction
): { score: number; reasoning: string } {
  let score = 0;
  const reasons: string[] = [];

  // Count how many of this exact asset the faction already owns
  const ownedCount = faction.assets.filter(
    (a) => a.definitionId === assetDef.id
  ).length;

  // Heavy penalty for duplicates - diminishing returns
  if (ownedCount > 0) {
    const penalty = ownedCount * 25; // -25 for first copy, -50 for second, etc.
    score -= penalty;
    reasons.push(`already owns ${ownedCount} copy(s) (-${penalty})`);
  } else {
    // Small bonus for new asset types
    score += 10;
    reasons.push('new asset type (+10)');
  }

  // Count assets by category
  const categoryCount: Record<AssetCategory, number> = {
    Force: 0,
    Cunning: 0,
    Wealth: 0,
  };
  
  for (const asset of faction.assets) {
    const def = getAssetById(asset.definitionId);
    if (def && def.category in categoryCount) {
      categoryCount[def.category]++;
    }
  }

  // Bonus for filling underrepresented categories
  const totalAssets = Object.values(categoryCount).reduce((a, b) => a + b, 0);
  if (totalAssets > 0) {
    const categoryRatio = categoryCount[assetDef.category] / totalAssets;
    if (categoryRatio < 0.2) {
      score += 15;
      reasons.push(`fills gap in ${assetDef.category} (+15)`);
    } else if (categoryRatio < 0.33) {
      score += 8;
      reasons.push(`expands ${assetDef.category} (+8)`);
    }
  }

  // Count assets by type (Military Unit, Special Forces, etc.)
  const typeCount: Record<string, number> = {};
  for (const asset of faction.assets) {
    const def = getAssetById(asset.definitionId);
    if (def) {
      typeCount[def.type] = (typeCount[def.type] || 0) + 1;
    }
  }

  // Bonus for new asset types
  if (!typeCount[assetDef.type]) {
    score += 12;
    reasons.push(`new type: ${assetDef.type} (+12)`);
  }

  return {
    score,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'standard diversification',
  };
}

// ============================================================================
// STRATEGIC NEEDS SCORING
// ============================================================================

/**
 * Analyze what capabilities the faction is missing and score assets that fill gaps
 * HEAVILY prioritizes combat capability for aggressive AI behavior
 */
function calculateStrategicNeedsScore(
  assetDef: AssetDefinition,
  faction: Faction,
  strategicIntent: StrategicIntent
): { score: number; reasoning: string } {
  let score = 0;
  const reasons: string[] = [];

  // Analyze current capabilities
  let hasForceAttacker = false;    // Can attack Force assets
  let hasBroadAttacker = false;    // Can attack multiple target types
  let hasDefender = false;
  let hasMobility = false;
  let hasIncomeSource = false;
  let homeworldDefenderHp = 0;
  let totalAttackCapability = 0;

  for (const asset of faction.assets) {
    const def = getAssetById(asset.definitionId);
    if (!def) continue;

    if (def.attack) {
      totalAttackCapability++;
      // Check if this attacker targets Force
      if (def.attack.defenderAttribute === 'Force') {
        hasForceAttacker = true;
        hasBroadAttacker = true; // Force is the most useful target
      }
      // Cunning attacks are also versatile
      if (def.attack.defenderAttribute === 'Cunning') {
        hasBroadAttacker = true;
      }
    }
    if (def.counterattack) hasDefender = true;
    if (hasMovementAbility(asset.definitionId) || def.type === 'Starship') {
      hasMobility = true;
    }
    if (isIncomeGeneratingAsset(asset.definitionId)) {
      hasIncomeSource = true;
    }
    if (asset.location === faction.homeworld && def.counterattack) {
      homeworldDefenderHp += asset.hp;
    }
  }

  // ============================================================================
  // CRITICAL: Prioritize Force-attacking assets HEAVILY
  // ============================================================================
  
  // Force vs Force attackers are the MOST valuable - can attack military units
  if (assetDef.attack?.defenderAttribute === 'Force') {
    if (!hasForceAttacker) {
      score += 60;  // HUGE bonus - this is critical for combat
      reasons.push('CRITICAL: Force attacker (+60)');
    } else {
      score += 25;  // Still good to have more
      reasons.push('Force attacker (+25)');
    }
    
    // Extra bonus for high damage
    const avgDamage = parseDamageAverage(assetDef.attack.damage);
    if (avgDamage >= 4) {
      score += avgDamage * 3;
      reasons.push(`high damage ${avgDamage.toFixed(1)} (+${(avgDamage * 3).toFixed(0)})`);
    }
  }
  
  // Force vs Cunning or Cunning vs Cunning - also very useful
  if (assetDef.attack?.defenderAttribute === 'Cunning') {
    if (!hasBroadAttacker) {
      score += 40;
      reasons.push('Cunning attacker needed (+40)');
    } else {
      score += 15;
      reasons.push('Cunning attacker (+15)');
    }
  }
  
  // Wealth attackers are less useful (fewer Wealth targets typically)
  if (assetDef.attack?.defenderAttribute === 'Wealth') {
    score += 10;
    reasons.push('Wealth attacker (+10)');
  }

  // ============================================================================
  // General attack capability (if we have NO attackers at all)
  // ============================================================================
  if (totalAttackCapability === 0 && assetDef.attack) {
    score += 35;
    reasons.push('no attackers yet (+35)');
  }

  // ============================================================================
  // Mobile attackers are EXCELLENT - can reach enemies
  // ============================================================================
  if (assetDef.attack && (hasMovementAbility(assetDef.id) || assetDef.type === 'Starship')) {
    score += 30;
    reasons.push('mobile attacker (+30)');
  }

  // ============================================================================
  // Defender gap
  // ============================================================================
  if (!hasDefender && assetDef.counterattack) {
    score += 20;
    reasons.push('fills defender gap (+20)');
  }

  // ============================================================================
  // Income - but LESS important than combat capability
  // ============================================================================
  if (!hasIncomeSource && isIncomeGeneratingAsset(assetDef.id)) {
    const incomeInfo = INCOME_GENERATING_ASSETS[assetDef.id];
    const incomeBonus = incomeInfo.passive ? 20 : 10; // Reduced from 35/20
    score += incomeBonus;
    reasons.push(`provides income (+${incomeBonus})`);
  }

  // Low FacCreds but need attackers more than income
  if (faction.facCreds <= 5 && !hasForceAttacker && assetDef.attack?.defenderAttribute === 'Force') {
    score += 20;
    reasons.push('need attacker even with low funds (+20)');
  }

  // ============================================================================
  // Goal-specific bonuses
  // ============================================================================
  
  // Expansion needs mobility
  if (strategicIntent.primaryFocus === 'expansion' && !hasMobility) {
    if (hasMovementAbility(assetDef.id) || assetDef.type === 'Starship') {
      score += 20;
      reasons.push('expansion needs mobility (+20)');
    }
  }

  // Military focus with attackers
  if (strategicIntent.primaryFocus === 'military' && assetDef.attack) {
    score += 15;
    reasons.push('military focus (+15)');
  }

  // Defensive focus
  if (strategicIntent.primaryFocus === 'defensive' && homeworldDefenderHp < 10) {
    if (assetDef.counterattack && assetDef.hp >= 6) {
      score += 15;
      reasons.push('homeworld defense (+15)');
    }
  }

  // Covert focus
  if (strategicIntent.primaryFocus === 'covert' && assetDef.type === 'Special Forces') {
    score += 10;
    reasons.push('covert ops (+10)');
  }

  return {
    score,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'no urgent needs',
  };
}

/**
 * Get valid purchase locations for a faction
 */
export function getValidPurchaseLocations(faction: Faction): string[] {
  const locations = new Set<string>();

  // Always can purchase on homeworld
  locations.add(faction.homeworld);

  // Can purchase on any world with a Base of Influence
  for (const asset of faction.assets) {
    if (asset.definitionId === 'base_of_influence') {
      locations.add(asset.location);
    }
  }

  return Array.from(locations);
}

/**
 * Check if faction can purchase an asset (rating and tech level requirements)
 */
export function canPurchaseAsset(
  faction: Faction,
  assetDef: AssetDefinition,
  location: string,
  systems: StarSystem[]
): { canPurchase: boolean; reason: string } {
  // Check rating requirement
  let hasRating = false;
  switch (assetDef.category) {
    case 'Force':
      hasRating = faction.attributes.force >= assetDef.requiredRating;
      break;
    case 'Cunning':
      hasRating = faction.attributes.cunning >= assetDef.requiredRating;
      break;
    case 'Wealth':
      hasRating = faction.attributes.wealth >= assetDef.requiredRating;
      break;
  }

  if (!hasRating) {
    return {
      canPurchase: false,
      reason: `Requires ${assetDef.category} ${assetDef.requiredRating}`,
    };
  }

  // Check tech level at location
  const system = systems.find((s) => s.id === location);
  if (system && system.primaryWorld.techLevel < assetDef.techLevel) {
    return {
      canPurchase: false,
      reason: `Location TL${system.primaryWorld.techLevel} < required TL${assetDef.techLevel}`,
    };
  }

  // Check asset count limits (can have up to rating assets of each type)
  const assetCountByCategory = {
    Force: faction.assets.filter((a) => {
      const def = getAssetById(a.definitionId);
      return def?.category === 'Force';
    }).length,
    Cunning: faction.assets.filter((a) => {
      const def = getAssetById(a.definitionId);
      return def?.category === 'Cunning';
    }).length,
    Wealth: faction.assets.filter((a) => {
      const def = getAssetById(a.definitionId);
      return def?.category === 'Wealth';
    }).length,
  };

  const currentCount = assetCountByCategory[assetDef.category];
  const maxCount =
    assetDef.category === 'Force'
      ? faction.attributes.force
      : assetDef.category === 'Cunning'
        ? faction.attributes.cunning
        : faction.attributes.wealth;

  // Can exceed but costs extra maintenance (AI should avoid this)
  if (currentCount >= maxCount) {
    return {
      canPurchase: true, // Technically can, but with penalty
      reason: `Would exceed ${assetDef.category} asset limit (${currentCount}/${maxCount})`,
    };
  }

  return { canPurchase: true, reason: 'Meets all requirements' };
}

/**
 * Generate purchase recommendations for all affordable assets
 */
export function generatePurchaseRecommendations(
  faction: Faction,
  systems: StarSystem[],
  strategicIntent: StrategicIntent,
  budget: number
): PurchaseRecommendation[] {
  const recommendations: PurchaseRecommendation[] = [];
  const validLocations = getValidPurchaseLocations(faction);

  // Get all assets the faction could potentially buy based on ratings
  const availableAssets = getAllAssetsForFaction(
    faction.attributes.force,
    faction.attributes.cunning,
    faction.attributes.wealth
  );

  for (const assetDef of availableAssets) {
    // Skip if too expensive
    if (assetDef.cost > budget) continue;

    // Find best valid location for this asset
    let bestLocation: string | null = null;
    let locationReason = '';

    for (const location of validLocations) {
      const { canPurchase, reason } = canPurchaseAsset(faction, assetDef, location, systems);
      if (canPurchase && !reason.includes('exceed')) {
        bestLocation = location;
        locationReason = reason;
        break;
      } else if (canPurchase && !bestLocation) {
        // Can purchase but with penalty - use as fallback
        bestLocation = location;
        locationReason = reason;
      }
    }

    if (!bestLocation) continue;

    // Calculate all scoring components
    const baseScore = calculateBaseScore(assetDef);
    const tagSynergy = calculateTagSynergyScore(assetDef, faction);
    const goalSynergy = calculateGoalSynergyScore(assetDef, strategicIntent);
    const diversification = calculateDiversificationScore(assetDef, faction);
    const strategicNeeds = calculateStrategicNeedsScore(assetDef, faction, strategicIntent);

    // Sum all scores
    const totalScore = 
      baseScore + 
      tagSynergy.score + 
      goalSynergy.score +
      diversification.score +
      strategicNeeds.score;

    // Penalize if would exceed asset limit
    const penalizedScore = locationReason.includes('exceed') ? totalScore * 0.5 : totalScore;

    // Build detailed reasoning
    const reasoningParts: string[] = [];
    reasoningParts.push(`Base: ${baseScore.toFixed(0)}`);
    if (tagSynergy.score !== 0) reasoningParts.push(`Tags: ${tagSynergy.reasoning}`);
    if (goalSynergy.score !== 0) reasoningParts.push(`Goal: ${goalSynergy.reasoning}`);
    if (diversification.score !== 0) reasoningParts.push(`Diversity: ${diversification.reasoning}`);
    if (strategicNeeds.score !== 0) reasoningParts.push(`Needs: ${strategicNeeds.reasoning}`);

    recommendations.push({
      assetDefinition: assetDef,
      location: bestLocation,
      score: penalizedScore,
      baseScore,
      tagSynergyScore: tagSynergy.score,
      goalSynergyScore: goalSynergy.score,
      diversificationScore: diversification.score,
      strategicNeedsScore: strategicNeeds.score,
      reasoning: reasoningParts.join(' | '),
    });
  }

  // Sort by score (highest first)
  return recommendations.sort((a, b) => b.score - a.score);
}

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

/**
 * Generate a complete economic plan for an AI faction's turn
 */
export function generateEconomicPlan(
  faction: Faction,
  systems: StarSystem[],
  threatOverview: SectorThreatOverview,
  strategicIntent: StrategicIntent
): EconomicPlan {
  const availableFacCreds = faction.facCreds;

  // Calculate overall threat level (average of all system threats)
  const threatSystemsMap = threatOverview.systemThreats ?? {};
  const systemThreats = Object.values(threatSystemsMap);
  const threatLevel =
    systemThreats.length > 0
      ? systemThreats.reduce((sum, t) => sum + t.overallDangerLevel, 0) / systemThreats.length
      : 0;

  // Generate repair decisions
  const repairDecisions = generateRepairDecisions(faction, threatLevel);
  const totalRepairCost = repairDecisions.reduce((sum, d) => sum + d.repairCost, 0);

  // Calculate repair reserve based on threat
  const repairReserve = calculateRepairReserve(totalRepairCost, threatLevel, availableFacCreds);

  // Calculate spending budget (what's left after reserve)
  const spendingBudget = Math.max(0, availableFacCreds - repairReserve);

  // Generate purchase recommendations
  const purchaseRecommendations = generatePurchaseRecommendations(
    faction,
    systems,
    strategicIntent,
    spendingBudget
  );

  // Select best purchase (if any)
  const purchaseRecommendation =
    purchaseRecommendations.length > 0 ? purchaseRecommendations[0] : null;

  // Build reasoning
  const reasoningParts: string[] = [];
  reasoningParts.push(`Available: ${availableFacCreds} FacCreds`);
  reasoningParts.push(`Threat level: ${threatLevel.toFixed(0)}%`);

  if (repairDecisions.length > 0) {
    reasoningParts.push(`${repairDecisions.length} damaged assets (${totalRepairCost} FacCreds to fully repair)`);
    reasoningParts.push(`Reserving ${repairReserve} FacCreds for repairs`);
  }

  if (purchaseRecommendation) {
    reasoningParts.push(
      `Recommending ${purchaseRecommendation.assetDefinition.name} (score: ${purchaseRecommendation.score.toFixed(0)})`
    );
  } else if (spendingBudget > 0) {
    reasoningParts.push('No suitable assets available within budget');
  } else {
    reasoningParts.push('No budget for purchases after repair reserve');
  }

  return {
    faction,
    availableFacCreds,
    threatLevel,
    repairReserve,
    spendingBudget,
    repairDecisions,
    purchaseRecommendation,
    totalRepairCost,
    reasoning: reasoningParts.join('. '),
  };
}

/**
 * Decide what repairs to actually perform given budget constraints
 */
export function selectRepairsWithinBudget(
  repairDecisions: RepairDecision[],
  budget: number
): RepairDecision[] {
  const selectedRepairs: RepairDecision[] = [];
  let remainingBudget = budget;

  // Repairs are already sorted by priority
  for (const repair of repairDecisions) {
    if (repair.repairCost <= remainingBudget) {
      selectedRepairs.push(repair);
      remainingBudget -= repair.repairCost;
    }
  }

  return selectedRepairs;
}

/**
 * Get the recommended action for this turn's economy phase
 */
export function getEconomyAction(
  plan: EconomicPlan
): { action: 'repair' | 'purchase' | 'save'; details: string } {
  // If we have critical repairs and budget, prioritize repairs
  const criticalRepairs = plan.repairDecisions.filter((r) => r.priority >= 50);
  if (criticalRepairs.length > 0 && plan.repairReserve >= criticalRepairs[0].repairCost) {
    return {
      action: 'repair',
      details: `Repair ${criticalRepairs[0].assetName} (priority: ${criticalRepairs[0].priority.toFixed(0)})`,
    };
  }

  // If we have a good purchase recommendation and budget
  if (
    plan.purchaseRecommendation &&
    plan.purchaseRecommendation.assetDefinition.cost <= plan.spendingBudget
  ) {
    return {
      action: 'purchase',
      details: `Buy ${plan.purchaseRecommendation.assetDefinition.name} at ${plan.purchaseRecommendation.location}`,
    };
  }

  // Otherwise save
  return {
    action: 'save',
    details: 'Conserve FacCreds for future turns',
  };
}

