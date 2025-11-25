/**
 * Goal Registry and Evaluators for Faction Goals
 * 
 * Based on SWN faction rules, there are 12 types of goals factions can pursue.
 * Goals are categorized into:
 * - State-based: Evaluated during maintenance/turn phases based on current game state
 * - Event-based: Triggered by specific actions (combat, asset destruction, etc.)
 * 
 * This file contains the goal definitions and state-based evaluators.
 */

import type { FactionGoalType, Faction, FactionGoal } from '../types/faction';
import type { RootState } from '../store/rootReducer';

/**
 * Goal definition with evaluation metadata
 */
export interface GoalDefinition {
  type: FactionGoalType;
  description: string;
  difficulty: number | ((faction: Faction, state?: RootState) => number);
  isStateBased: boolean; // true if can be evaluated during turn phase, false if event-driven
  category: 'Force' | 'Cunning' | 'Wealth' | 'Mixed' | 'Special';
  // For state-based goals: function to evaluate progress
  evaluateProgress?: (faction: Faction, state: RootState) => {
    current: number;
    target: number;
    isCompleted: boolean;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Registry of all 12 faction goals from SWN rules
 */
export const GOAL_DEFINITIONS: Record<FactionGoalType, GoalDefinition> = {
  'Military Conquest': {
    type: 'Military Conquest',
    description: 'Destroy a number of Force assets equal to your Force rating',
    difficulty: (faction) => Math.ceil(faction.attributes.force / 2),
    isStateBased: false, // Event-driven (triggered by asset destruction)
    category: 'Force',
  },
  'Commercial Expansion': {
    type: 'Commercial Expansion',
    description: 'Destroy a number of Wealth assets equal to your Wealth rating',
    difficulty: (faction) => Math.ceil(faction.attributes.wealth / 2),
    isStateBased: false, // Event-driven
    category: 'Wealth',
  },
  'Intelligence Coup': {
    type: 'Intelligence Coup',
    description: 'Destroy a number of Cunning assets equal to your Cunning rating',
    difficulty: (faction) => Math.ceil(faction.attributes.cunning / 2),
    isStateBased: false, // Event-driven
    category: 'Cunning',
  },
  'Planetary Seizure': {
    type: 'Planetary Seizure',
    description: 'Take control of a planet as the legitimate government',
    difficulty: 1, // Varies based on target, minimum 1
    isStateBased: false, // Event-driven (special action)
    category: 'Mixed',
  },
  'Expand Influence': {
    type: 'Expand Influence',
    description: 'Plant a Base of Influence on a new planet',
    difficulty: 1, // +1 if contested
    isStateBased: false, // Event-driven (purchase action)
    category: 'Special',
  },
  'Blood the Enemy': {
    type: 'Blood the Enemy',
    description: 'Inflict HP damage equal to Force + Cunning + Wealth',
    difficulty: 2,
    isStateBased: false, // Event-driven (combat damage tracking)
    category: 'Mixed',
  },
  'Peaceable Kingdom': {
    type: 'Peaceable Kingdom',
    description: "Don't take an Attack action for four turns",
    difficulty: 1,
    isStateBased: true, // Can be evaluated based on turn counter
    category: 'Special',
    evaluateProgress: (faction, _state) => {
      // Metadata should track: { turnsWithoutAttack: number, startTurn: number }
      const metadata = faction.goal?.progress.metadata as { turnsWithoutAttack?: number } | undefined;
      const turnsWithoutAttack = metadata?.turnsWithoutAttack ?? 0;
      const target = 4;
      
      return {
        current: turnsWithoutAttack,
        target,
        isCompleted: turnsWithoutAttack >= target,
        metadata: { turnsWithoutAttack },
      };
    },
  },
  'Destroy the Foe': {
    type: 'Destroy the Foe',
    description: 'Destroy a rival faction completely',
    difficulty: 2, // 1 + avg of target's ratings (calculated when goal is set)
    isStateBased: false, // Event-driven (faction destruction)
    category: 'Mixed',
  },
  'Inside Enemy Territory': {
    type: 'Inside Enemy Territory',
    description: 'Have stealthed assets on enemy worlds equal to your Cunning',
    difficulty: 2,
    isStateBased: true, // Can be evaluated by counting stealthed assets
    category: 'Cunning',
    evaluateProgress: (faction, state) => {
      // Count stealthed assets on worlds with other planetary governments
      // Note: Only assets stealthed AFTER goal adoption count
      const metadata = faction.goal?.progress.metadata as { 
        goalStartTurn?: number;
        trackedAssetIds?: string[];
      } | undefined;
      
      const goalStartTurn = metadata?.goalStartTurn ?? state.turn.turn;
      const trackedAssets = metadata?.trackedAssetIds ?? [];
      
      // Count stealthed assets on enemy territory (excluding homeworld)
      const stealthedCount = faction.assets.filter(asset => {
        // Must be stealthed
        if (!asset.stealthed) return false;
        // Must not be on homeworld
        if (asset.location === faction.homeworld) return false;
        // Must have been stealthed after goal adoption (tracked in metadata)
        return trackedAssets.includes(asset.id);
      }).length;
      
      const target = faction.attributes.cunning;
      
      return {
        current: stealthedCount,
        target,
        isCompleted: stealthedCount >= target,
        metadata: { 
          goalStartTurn,
          trackedAssetIds: trackedAssets,
          stealthedCount,
        },
      };
    },
  },
  'Invincible Valor': {
    type: 'Invincible Valor',
    description: 'Destroy a Force asset with higher rating than your Force',
    difficulty: 2,
    isStateBased: false, // Event-driven (asset destruction)
    category: 'Force',
  },
  'Wealth of Worlds': {
    type: 'Wealth of Worlds',
    description: 'Spend FacCreds equal to 4x your Wealth rating on bribes/influence',
    difficulty: 2,
    isStateBased: true, // Can be evaluated based on spending tracker
    category: 'Wealth',
    evaluateProgress: (faction, _state) => {
      // Metadata should track: { creditsSpent: number, targetSpend: number }
      const metadata = faction.goal?.progress.metadata as { creditsSpent?: number } | undefined;
      const creditsSpent = metadata?.creditsSpent ?? 0;
      const target = faction.attributes.wealth * 4;
      
      return {
        current: creditsSpent,
        target,
        isCompleted: creditsSpent >= target,
        metadata: { creditsSpent, targetSpend: target },
      };
    },
  },
};

/**
 * Helper to get goal definition by type
 */
export function getGoalDefinition(type: FactionGoalType): GoalDefinition | undefined {
  return GOAL_DEFINITIONS[type];
}

/**
 * Helper to calculate difficulty for a goal
 */
export function calculateGoalDifficulty(type: FactionGoalType, faction: Faction, state?: RootState): number {
  const definition = getGoalDefinition(type);
  if (!definition) return 1;
  
  if (typeof definition.difficulty === 'function') {
    return definition.difficulty(faction, state);
  }
  return definition.difficulty;
}

function getGoalTarget(type: FactionGoalType, faction: Faction): number {
  switch (type) {
    case 'Military Conquest':
      return Math.max(1, faction.attributes.force);
    case 'Commercial Expansion':
      return Math.max(1, faction.attributes.wealth);
    case 'Intelligence Coup':
      return Math.max(1, faction.attributes.cunning);
    case 'Blood the Enemy':
      return Math.max(1, faction.attributes.force + faction.attributes.cunning + faction.attributes.wealth);
    case 'Wealth of Worlds':
      return Math.max(1, faction.attributes.wealth * 4);
    case 'Inside Enemy Territory':
      return Math.max(1, faction.attributes.cunning);
    case 'Peaceable Kingdom':
      return 4;
    default:
      return 1;
  }
}

function generateGoalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `goal-${Math.random().toString(36).slice(2)}`;
}

export function createFactionGoal(type: FactionGoalType, faction: Faction, state?: RootState): FactionGoal {
  const definition = getGoalDefinition(type);
  const description = definition?.description ?? type;
  let difficulty = 1;
  if (definition) {
    if (typeof definition.difficulty === 'function') {
      difficulty = definition.difficulty(faction, state);
    } else {
      difficulty = definition.difficulty;
    }
  }

  return {
    id: generateGoalId(),
    type,
    description,
    progress: {
      current: 0,
      target: getGoalTarget(type, faction),
      metadata: {},
    },
    difficulty,
    isCompleted: false,
  };
}

/**
 * Get all state-based goals (can be evaluated during turn phases)
 */
export function getStateBasedGoals(): GoalDefinition[] {
  return Object.values(GOAL_DEFINITIONS).filter(def => def.isStateBased);
}

/**
 * Get all event-based goals (triggered by specific actions)
 */
export function getEventBasedGoals(): GoalDefinition[] {
  return Object.values(GOAL_DEFINITIONS).filter(def => !def.isStateBased);
}

/**
 * Evaluate a single faction's goal progress (if it's a state-based goal)
 * Returns null if the goal cannot be evaluated based on state (event-based goal)
 */
export function evaluateFactionGoal(
  faction: Faction,
  state: RootState
): {
  current: number;
  target: number;
  isCompleted: boolean;
  metadata?: Record<string, unknown>;
} | null {
  if (!faction.goal || faction.goal.isCompleted) return null;
  
  const definition = getGoalDefinition(faction.goal.type);
  if (!definition || !definition.isStateBased || !definition.evaluateProgress) {
    return null;
  }
  
  return definition.evaluateProgress(faction, state);
}

