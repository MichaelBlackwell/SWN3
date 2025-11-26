/**
 * GoalSelectionService - Strategic Goal Selection & Tag Integration for AI
 *
 * This service implements the logic for AI factions to select strategic objectives
 * based on their personality (Tags) and current game state. It evaluates available
 * goals and weights them according to faction characteristics.
 *
 * Based on SWN faction rules:
 * - Factions pursue one goal at a time
 * - Goals provide XP when completed
 * - Goal selection should reflect faction personality
 * - Tags influence preferred strategies
 */

import type { Faction, FactionTag, FactionGoalType, FactionGoal } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import { getGoalsByCategory, GOAL_METADATA } from '../../data/goalMetadata';

// Note: TAG_MODIFIERS is imported for reference but not directly used in this module
// The tag-goal affinities defined here are specific to AI goal selection behavior

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Weight configuration for goal selection
 */
export interface GoalWeight {
  goalType: FactionGoalType;
  baseWeight: number; // Base desirability (0-100)
  tagModifier: number; // Modifier from faction tags (-50 to +50)
  situationalModifier: number; // Modifier from current game state (-50 to +50)
  finalWeight: number; // Computed final weight
  reasoning: string; // Explanation for AI transparency
}

/**
 * Result of goal evaluation
 */
export interface GoalEvaluation {
  faction: Faction;
  currentGoal: FactionGoal | null;
  recommendedGoal: FactionGoalType | null;
  goalWeights: GoalWeight[];
  strategicIntent: StrategicIntent;
}

/**
 * Strategic intent derived from goal selection
 * This guides the AI's turn actions
 */
export interface StrategicIntent {
  primaryFocus: 'military' | 'economic' | 'covert' | 'expansion' | 'defensive' | 'balanced';
  aggressionLevel: number; // 0-100, higher = more aggressive
  targetFactionId: string | null; // Primary rival to focus on
  prioritySystemIds: string[]; // Systems of strategic importance
  reasoning: string;
}

/**
 * Tag affinity mapping - which tags prefer which goal categories
 */
export interface TagGoalAffinity {
  tag: FactionTag;
  preferredGoals: FactionGoalType[];
  avoidedGoals: FactionGoalType[];
  aggressionModifier: number; // -20 to +20
}

// ============================================================================
// TAG-GOAL AFFINITY DEFINITIONS
// ============================================================================

/**
 * Defines how each faction tag influences goal selection
 * Based on SWN faction tag descriptions and behaviors
 */
export const TAG_GOAL_AFFINITIES: Record<FactionTag, TagGoalAffinity> = {
  Colonists: {
    tag: 'Colonists',
    preferredGoals: ['Expand Influence', 'Peaceable Kingdom'],
    avoidedGoals: ['Blood the Enemy', 'Destroy the Foe'],
    aggressionModifier: -10,
  },
  'Deep Rooted': {
    tag: 'Deep Rooted',
    preferredGoals: ['Peaceable Kingdom', 'Expand Influence'],
    avoidedGoals: ['Military Conquest'], // Don't want to leave homeworld
    aggressionModifier: -5,
  },
  'Eugenics Cult': {
    tag: 'Eugenics Cult',
    preferredGoals: ['Intelligence Coup', 'Inside Enemy Territory', 'Blood the Enemy'],
    avoidedGoals: ['Peaceable Kingdom'],
    aggressionModifier: 10,
  },
  'Exchange Consulate': {
    tag: 'Exchange Consulate',
    preferredGoals: ['Commercial Expansion', 'Wealth of Worlds', 'Peaceable Kingdom'],
    avoidedGoals: ['Military Conquest', 'Destroy the Foe'],
    aggressionModifier: -15,
  },
  Fanatical: {
    tag: 'Fanatical',
    preferredGoals: ['Blood the Enemy', 'Destroy the Foe', 'Military Conquest'],
    avoidedGoals: ['Peaceable Kingdom'],
    aggressionModifier: 20,
  },
  Imperialists: {
    tag: 'Imperialists',
    preferredGoals: ['Planetary Seizure', 'Military Conquest', 'Expand Influence'],
    avoidedGoals: ['Peaceable Kingdom'],
    aggressionModifier: 15,
  },
  Machiavellian: {
    tag: 'Machiavellian',
    preferredGoals: ['Intelligence Coup', 'Inside Enemy Territory', 'Blood the Enemy'],
    avoidedGoals: ['Invincible Valor'], // Prefer subtlety over direct combat
    aggressionModifier: 5,
  },
  'Mercenary Group': {
    tag: 'Mercenary Group',
    preferredGoals: ['Military Conquest', 'Invincible Valor', 'Blood the Enemy'],
    avoidedGoals: ['Peaceable Kingdom', 'Wealth of Worlds'],
    aggressionModifier: 10,
  },
  'Perimeter Agency': {
    tag: 'Perimeter Agency',
    preferredGoals: ['Intelligence Coup', 'Inside Enemy Territory', 'Destroy the Foe'],
    avoidedGoals: ['Peaceable Kingdom'],
    aggressionModifier: 5,
  },
  Pirates: {
    tag: 'Pirates',
    preferredGoals: ['Commercial Expansion', 'Blood the Enemy', 'Wealth of Worlds'],
    avoidedGoals: ['Peaceable Kingdom', 'Planetary Seizure'],
    aggressionModifier: 10,
  },
  'Planetary Government': {
    tag: 'Planetary Government',
    preferredGoals: ['Expand Influence', 'Peaceable Kingdom', 'Planetary Seizure'],
    avoidedGoals: ['Destroy the Foe'],
    aggressionModifier: 0,
  },
  Plutocratic: {
    tag: 'Plutocratic',
    preferredGoals: ['Wealth of Worlds', 'Commercial Expansion', 'Expand Influence'],
    avoidedGoals: ['Invincible Valor', 'Military Conquest'],
    aggressionModifier: -5,
  },
  'Preceptor Archive': {
    tag: 'Preceptor Archive',
    preferredGoals: ['Expand Influence', 'Peaceable Kingdom', 'Intelligence Coup'],
    avoidedGoals: ['Blood the Enemy', 'Destroy the Foe'],
    aggressionModifier: -10,
  },
  'Psychic Academy': {
    tag: 'Psychic Academy',
    preferredGoals: ['Intelligence Coup', 'Inside Enemy Territory', 'Expand Influence'],
    avoidedGoals: ['Military Conquest'],
    aggressionModifier: 0,
  },
  Savage: {
    tag: 'Savage',
    preferredGoals: ['Blood the Enemy', 'Military Conquest', 'Invincible Valor'],
    avoidedGoals: ['Peaceable Kingdom', 'Commercial Expansion'],
    aggressionModifier: 15,
  },
  Scavengers: {
    tag: 'Scavengers',
    preferredGoals: ['Wealth of Worlds', 'Commercial Expansion', 'Expand Influence'],
    avoidedGoals: ['Destroy the Foe'],
    aggressionModifier: 0,
  },
  Secretive: {
    tag: 'Secretive',
    preferredGoals: ['Inside Enemy Territory', 'Intelligence Coup', 'Peaceable Kingdom'],
    avoidedGoals: ['Military Conquest', 'Invincible Valor'],
    aggressionModifier: -5,
  },
  'Technical Expertise': {
    tag: 'Technical Expertise',
    preferredGoals: ['Expand Influence', 'Wealth of Worlds', 'Commercial Expansion'],
    avoidedGoals: ['Blood the Enemy'],
    aggressionModifier: -5,
  },
  Theocratic: {
    tag: 'Theocratic',
    preferredGoals: ['Expand Influence', 'Planetary Seizure', 'Intelligence Coup'],
    avoidedGoals: [],
    aggressionModifier: 5,
  },
  Warlike: {
    tag: 'Warlike',
    preferredGoals: ['Military Conquest', 'Invincible Valor', 'Blood the Enemy', 'Destroy the Foe'],
    avoidedGoals: ['Peaceable Kingdom', 'Commercial Expansion'],
    aggressionModifier: 20,
  },
};

// ============================================================================
// GOAL WEIGHT CALCULATIONS
// ============================================================================

/**
 * Calculate the base weight for a goal type based on faction attributes
 */
function calculateBaseWeight(
  goalType: FactionGoalType,
  faction: Faction
): { weight: number; reasoning: string } {
  const { force, cunning, wealth } = faction.attributes;
  const categories = getGoalsByCategory();

  // Force-based goals weighted by Force rating
  if (categories.Force.includes(goalType)) {
    return {
      weight: 30 + force * 8,
      reasoning: `Force goal weighted by Force rating (${force})`,
    };
  }

  // Cunning-based goals weighted by Cunning rating
  if (categories.Cunning.includes(goalType)) {
    return {
      weight: 30 + cunning * 8,
      reasoning: `Cunning goal weighted by Cunning rating (${cunning})`,
    };
  }

  // Wealth-based goals weighted by Wealth rating
  if (categories.Wealth.includes(goalType)) {
    return {
      weight: 30 + wealth * 8,
      reasoning: `Wealth goal weighted by Wealth rating (${wealth})`,
    };
  }

  // Mixed goals use average of relevant attributes
  if (goalType === 'Planetary Seizure') {
    const avg = (force + cunning) / 2;
    return {
      weight: 35 + avg * 6,
      reasoning: `Planetary Seizure weighted by Force+Cunning average (${avg.toFixed(1)})`,
    };
  }

  if (goalType === 'Blood the Enemy') {
    const sum = force + cunning + wealth;
    return {
      weight: 25 + sum * 3,
      reasoning: `Blood the Enemy weighted by total attributes (${sum})`,
    };
  }

  if (goalType === 'Destroy the Foe') {
    const sum = force + cunning + wealth;
    return {
      weight: 20 + sum * 4,
      reasoning: `Destroy the Foe weighted by total attributes (${sum})`,
    };
  }

  // Special goals
  if (goalType === 'Expand Influence') {
    return {
      weight: 50, // Always moderately desirable
      reasoning: 'Expand Influence is universally useful',
    };
  }

  if (goalType === 'Peaceable Kingdom') {
    // More desirable when weak or recovering
    const hpPercent = faction.attributes.hp / faction.attributes.maxHp;
    const weight = hpPercent < 0.5 ? 60 : 30;
    return {
      weight,
      reasoning: `Peaceable Kingdom ${hpPercent < 0.5 ? 'preferred while recovering' : 'has base appeal'}`,
    };
  }

  return { weight: 40, reasoning: 'Default base weight' };
}

/**
 * Calculate tag modifier for a goal based on faction tags
 */
function calculateTagModifier(
  goalType: FactionGoalType,
  faction: Faction
): { modifier: number; reasoning: string } {
  let modifier = 0;
  const reasons: string[] = [];

  for (const tag of faction.tags) {
    const affinity = TAG_GOAL_AFFINITIES[tag];
    if (!affinity) continue;

    if (affinity.preferredGoals.includes(goalType)) {
      modifier += 20;
      reasons.push(`+20 from ${tag} (preferred)`);
    }

    if (affinity.avoidedGoals.includes(goalType)) {
      modifier -= 25;
      reasons.push(`-25 from ${tag} (avoided)`);
    }
  }

  return {
    modifier,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'No tag modifiers',
  };
}

/**
 * Calculate situational modifier based on current game state
 */
function calculateSituationalModifier(
  goalType: FactionGoalType,
  faction: Faction,
  allFactions: Faction[],
  _systems: StarSystem[]
): { modifier: number; reasoning: string } {
  let modifier = 0;
  const reasons: string[] = [];

  const enemyFactions = allFactions.filter((f) => f.id !== faction.id);
  const hpPercent = faction.attributes.hp / faction.attributes.maxHp;

  // Low HP favors defensive goals
  if (hpPercent < 0.4) {
    if (goalType === 'Peaceable Kingdom') {
      modifier += 30;
      reasons.push('+30 for low HP recovery');
    }
    if (['Blood the Enemy', 'Destroy the Foe', 'Military Conquest'].includes(goalType)) {
      modifier -= 20;
      reasons.push('-20 for risky while weakened');
    }
  }

  // High FacCreds favor spending goals
  if (faction.facCreds > 10) {
    if (goalType === 'Wealth of Worlds') {
      modifier += 15;
      reasons.push('+15 for high FacCreds');
    }
    if (goalType === 'Expand Influence') {
      modifier += 10;
      reasons.push('+10 can afford expansion');
    }
  }

  // Few assets favor expansion
  if (faction.assets.length < 3) {
    if (goalType === 'Expand Influence') {
      modifier += 20;
      reasons.push('+20 for few assets');
    }
  }

  // Many enemies favor aggressive or defensive goals
  if (enemyFactions.length >= 3) {
    if (goalType === 'Peaceable Kingdom') {
      modifier += 10;
      reasons.push('+10 for many rivals');
    }
  }

  // Single weak enemy favors destruction
  if (enemyFactions.length === 1) {
    const enemy = enemyFactions[0];
    const enemyStrength = enemy.attributes.force + enemy.attributes.cunning + enemy.attributes.wealth;
    const ourStrength = faction.attributes.force + faction.attributes.cunning + faction.attributes.wealth;

    if (enemyStrength < ourStrength * 0.7) {
      if (goalType === 'Destroy the Foe') {
        modifier += 25;
        reasons.push('+25 for weak single enemy');
      }
    }
  }

  // Strong Force favors military goals
  if (faction.attributes.force >= 4) {
    if (['Military Conquest', 'Invincible Valor'].includes(goalType)) {
      modifier += 10;
      reasons.push('+10 for high Force');
    }
  }

  // Strong Cunning favors covert goals
  if (faction.attributes.cunning >= 4) {
    if (['Intelligence Coup', 'Inside Enemy Territory'].includes(goalType)) {
      modifier += 10;
      reasons.push('+10 for high Cunning');
    }
  }

  // Strong Wealth favors economic goals
  if (faction.attributes.wealth >= 4) {
    if (['Commercial Expansion', 'Wealth of Worlds'].includes(goalType)) {
      modifier += 10;
      reasons.push('+10 for high Wealth');
    }
  }

  return {
    modifier,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'No situational modifiers',
  };
}

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

/**
 * Calculate weights for all available goals
 */
export function calculateGoalWeights(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[]
): GoalWeight[] {
  const allGoalTypes: FactionGoalType[] = [
    'Military Conquest',
    'Commercial Expansion',
    'Intelligence Coup',
    'Planetary Seizure',
    'Expand Influence',
    'Blood the Enemy',
    'Peaceable Kingdom',
    'Destroy the Foe',
    'Inside Enemy Territory',
    'Invincible Valor',
    'Wealth of Worlds',
  ];

  return allGoalTypes.map((goalType) => {
    const base = calculateBaseWeight(goalType, faction);
    const tag = calculateTagModifier(goalType, faction);
    const situational = calculateSituationalModifier(goalType, faction, allFactions, systems);

    const finalWeight = Math.max(0, Math.min(100, base.weight + tag.modifier + situational.modifier));

    return {
      goalType,
      baseWeight: base.weight,
      tagModifier: tag.modifier,
      situationalModifier: situational.modifier,
      finalWeight,
      reasoning: `Base: ${base.reasoning}. Tags: ${tag.reasoning}. Situation: ${situational.reasoning}`,
    };
  });
}

/**
 * Select the best goal for a faction based on weights
 */
export function selectBestGoal(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[]
): FactionGoalType | null {
  const weights = calculateGoalWeights(faction, allFactions, systems);

  // Sort by final weight descending
  const sorted = [...weights].sort((a, b) => b.finalWeight - a.finalWeight);

  // Return the highest weighted goal, or null if all weights are 0
  if (sorted[0].finalWeight > 0) {
    return sorted[0].goalType;
  }

  return null;
}

/**
 * Determine the strategic intent based on selected goal and faction state
 */
export function determineStrategicIntent(
  faction: Faction,
  selectedGoal: FactionGoalType | null,
  allFactions: Faction[],
  systems: StarSystem[]
): StrategicIntent {
  // Calculate base aggression from tags
  let baseAggression = 50;
  for (const tag of faction.tags) {
    const affinity = TAG_GOAL_AFFINITIES[tag];
    if (affinity) {
      baseAggression += affinity.aggressionModifier;
    }
  }

  // Adjust aggression based on HP
  const hpPercent = faction.attributes.hp / faction.attributes.maxHp;
  if (hpPercent < 0.3) {
    baseAggression -= 30;
  } else if (hpPercent < 0.5) {
    baseAggression -= 15;
  }

  // Determine primary focus from goal
  let primaryFocus: StrategicIntent['primaryFocus'] = 'balanced';
  const goalCategories = getGoalsByCategory();

  if (!selectedGoal) {
    primaryFocus = 'defensive';
  } else if (goalCategories.Force.includes(selectedGoal) || selectedGoal === 'Blood the Enemy') {
    primaryFocus = 'military';
    baseAggression += 10;
  } else if (goalCategories.Cunning.includes(selectedGoal)) {
    primaryFocus = 'covert';
  } else if (goalCategories.Wealth.includes(selectedGoal)) {
    primaryFocus = 'economic';
    baseAggression -= 10;
  } else if (selectedGoal === 'Expand Influence' || selectedGoal === 'Planetary Seizure') {
    primaryFocus = 'expansion';
  } else if (selectedGoal === 'Peaceable Kingdom') {
    primaryFocus = 'defensive';
    baseAggression -= 20;
  } else if (selectedGoal === 'Destroy the Foe') {
    primaryFocus = 'military';
    baseAggression += 20;
  }

  // Identify target faction (strongest rival or weakest if destroying)
  let targetFactionId: string | null = null;
  const enemyFactions = allFactions.filter((f) => f.id !== faction.id);

  if (enemyFactions.length > 0) {
    if (selectedGoal === 'Destroy the Foe') {
      // Target the weakest enemy
      const weakest = enemyFactions.reduce((prev, curr) => {
        const prevStr = prev.attributes.force + prev.attributes.cunning + prev.attributes.wealth;
        const currStr = curr.attributes.force + curr.attributes.cunning + curr.attributes.wealth;
        return currStr < prevStr ? curr : prev;
      });
      targetFactionId = weakest.id;
    } else if (primaryFocus === 'military' || primaryFocus === 'covert') {
      // Target the strongest rival (most threatening)
      const strongest = enemyFactions.reduce((prev, curr) => {
        const prevStr = prev.attributes.force + prev.attributes.cunning + prev.attributes.wealth;
        const currStr = curr.attributes.force + curr.attributes.cunning + curr.attributes.wealth;
        return currStr > prevStr ? curr : prev;
      });
      targetFactionId = strongest.id;
    }
  }

  // Identify priority systems
  const prioritySystemIds: string[] = [];

  // Always prioritize homeworld
  prioritySystemIds.push(faction.homeworld);

  // Add systems with faction assets
  const assetSystems = new Set(faction.assets.map((a) => a.location));
  assetSystems.forEach((systemId) => {
    if (!prioritySystemIds.includes(systemId)) {
      prioritySystemIds.push(systemId);
    }
  });

  // For expansion, add adjacent unoccupied systems
  if (primaryFocus === 'expansion') {
    // This would require influence map data - simplified for now
    // Just add first few systems not controlled
    const controlledSystems = new Set([faction.homeworld, ...assetSystems]);
    systems.slice(0, 3).forEach((system) => {
      if (!controlledSystems.has(system.id) && prioritySystemIds.length < 5) {
        prioritySystemIds.push(system.id);
      }
    });
  }

  // Build reasoning
  const goalReasoning = selectedGoal
    ? `Pursuing ${selectedGoal} goal`
    : 'No active goal - defensive posture';
  const focusReasoning = `Primary focus: ${primaryFocus}`;
  const targetReasoning = targetFactionId
    ? `Targeting faction ${targetFactionId}`
    : 'No specific target';

  return {
    primaryFocus,
    aggressionLevel: Math.max(0, Math.min(100, baseAggression)),
    targetFactionId,
    prioritySystemIds,
    reasoning: `${goalReasoning}. ${focusReasoning}. ${targetReasoning}.`,
  };
}

/**
 * Evaluate goals for a faction and return complete analysis
 */
export function evaluateGoals(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[]
): GoalEvaluation {
  const goalWeights = calculateGoalWeights(faction, allFactions, systems);
  const recommendedGoal = selectBestGoal(faction, allFactions, systems);
  const strategicIntent = determineStrategicIntent(faction, recommendedGoal, allFactions, systems);

  return {
    faction,
    currentGoal: faction.goal,
    recommendedGoal,
    goalWeights,
    strategicIntent,
  };
}

/**
 * Create a new goal instance for a faction
 */
export function createGoalInstance(
  goalType: FactionGoalType,
  faction: Faction
): FactionGoal {
  const metadata = GOAL_METADATA[goalType];
  const { force, cunning, wealth } = faction.attributes;

  // Calculate target based on goal type
  let target = 1;
  let description = metadata?.tooltip || `Complete the ${goalType} objective`;

  switch (goalType) {
    case 'Military Conquest':
      target = force;
      description = `Destroy ${force} enemy Force assets`;
      break;
    case 'Commercial Expansion':
      target = wealth;
      description = `Destroy ${wealth} enemy Wealth assets`;
      break;
    case 'Intelligence Coup':
      target = cunning;
      description = `Destroy ${cunning} enemy Cunning assets`;
      break;
    case 'Inside Enemy Territory':
      target = cunning;
      description = `Place ${cunning} stealthed assets on enemy worlds`;
      break;
    case 'Blood the Enemy':
      target = force + cunning + wealth;
      description = `Deal ${force + cunning + wealth} HP damage to rival factions`;
      break;
    case 'Wealth of Worlds':
      target = wealth * 4;
      description = `Spend ${wealth * 4} FacCreds on bribes and influence`;
      break;
    case 'Peaceable Kingdom':
      target = 4;
      description = 'Avoid Attack actions for 4 consecutive turns';
      break;
    case 'Planetary Seizure':
      target = 1;
      description = 'Seize control of a planet and become its government';
      break;
    case 'Expand Influence':
      target = 1;
      description = 'Establish a new Base of Influence on an unclaimed planet';
      break;
    case 'Destroy the Foe':
      target = 1;
      description = 'Completely eliminate a rival faction';
      break;
    case 'Invincible Valor':
      target = 1;
      description = 'Destroy a Force asset with higher rating than your Force';
      break;
  }

  // Calculate XP reward (difficulty)
  let difficulty = 1;
  if (['Destroy the Foe', 'Planetary Seizure', 'Invincible Valor'].includes(goalType)) {
    difficulty = 2;
  }

  return {
    id: crypto.randomUUID(),
    type: goalType,
    description,
    progress: {
      current: 0,
      target,
      metadata: {},
    },
    difficulty,
    isCompleted: false,
  };
}

/**
 * Check if a faction should change their goal
 * Returns true if the current goal is complete or if a significantly better option exists
 */
export function shouldChangeGoal(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[]
): { shouldChange: boolean; reason: string } {
  // If no current goal, definitely should select one
  if (!faction.goal) {
    return { shouldChange: true, reason: 'No current goal' };
  }

  // If current goal is complete, select a new one
  if (faction.goal.isCompleted) {
    return { shouldChange: true, reason: 'Current goal completed' };
  }

  // Evaluate if a much better goal exists
  const weights = calculateGoalWeights(faction, allFactions, systems);
  const currentGoalWeight = weights.find((w) => w.goalType === faction.goal?.type);
  const bestGoalWeight = weights.reduce((prev, curr) =>
    curr.finalWeight > prev.finalWeight ? curr : prev
  );

  // Only change if the best goal is significantly better (>30 points)
  if (currentGoalWeight && bestGoalWeight.finalWeight - currentGoalWeight.finalWeight > 30) {
    return {
      shouldChange: true,
      reason: `Better goal available: ${bestGoalWeight.goalType} (${bestGoalWeight.finalWeight} vs ${currentGoalWeight.finalWeight})`,
    };
  }

  return { shouldChange: false, reason: 'Current goal remains optimal' };
}

