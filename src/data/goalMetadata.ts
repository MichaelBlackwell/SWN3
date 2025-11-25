/**
 * Goal Metadata - Icons and Tooltips for Faction Goals
 * 
 * Provides visual metadata for all 11 faction goal types from SWN.
 */

import type { FactionGoalType } from '../types/faction';

export interface GoalMetadata {
  icon: string;
  tooltip: string;
  color: string; // CSS color variable or hex
}

/**
 * Icon and tooltip data for each goal type
 */
export const GOAL_METADATA: Record<FactionGoalType, GoalMetadata> = {
  'Military Conquest': {
    icon: '⚔️',
    tooltip: 'Destroy enemy Force assets through military superiority. Target must equal your Force rating.',
    color: 'var(--force-color, #dc2626)',
  },
  'Commercial Expansion': {
    icon: '📈',
    tooltip: 'Disrupt rival trade networks and destroy Wealth assets. Target must equal your Wealth rating.',
    color: 'var(--wealth-color, #eab308)',
  },
  'Intelligence Coup': {
    icon: '🕵️',
    tooltip: 'Eliminate enemy intelligence networks and Cunning assets. Target must equal your Cunning rating.',
    color: 'var(--cunning-color, #9333ea)',
  },
  'Planetary Seizure': {
    icon: '🌍',
    tooltip: 'Take control of a planet and establish your faction as the legitimate government.',
    color: 'var(--accent-primary, #3b82f6)',
  },
  'Expand Influence': {
    icon: '🏛️',
    tooltip: 'Establish a new Base of Influence on an unclaimed or contested planet to expand your reach.',
    color: 'var(--accent-primary, #3b82f6)',
  },
  'Blood the Enemy': {
    icon: '💥',
    tooltip: 'Inflict direct damage to rival factions. Target HP damage equals Force + Cunning + Wealth.',
    color: 'var(--force-color, #dc2626)',
  },
  'Peaceable Kingdom': {
    icon: '🕊️',
    tooltip: 'Demonstrate restraint and stability by avoiding any Attack actions for four consecutive turns.',
    color: 'var(--success-color, #22c55e)',
  },
  'Destroy the Foe': {
    icon: '💀',
    tooltip: 'Completely eliminate a rival faction from the sector through total destruction.',
    color: 'var(--error-color, #dc2626)',
  },
  'Inside Enemy Territory': {
    icon: '👁️',
    tooltip: 'Infiltrate enemy worlds with stealthed assets. Target count equals your Cunning rating.',
    color: 'var(--cunning-color, #9333ea)',
  },
  'Invincible Valor': {
    icon: '🛡️',
    tooltip: 'Prove your military prowess by destroying a Force asset with a higher rating than your own Force.',
    color: 'var(--force-color, #dc2626)',
  },
  'Wealth of Worlds': {
    icon: '💰',
    tooltip: 'Demonstrate economic dominance by spending FacCreds on bribes and influence. Target equals 4x your Wealth.',
    color: 'var(--wealth-color, #eab308)',
  },
};

/**
 * Get metadata for a specific goal type
 */
export function getGoalMetadata(type: FactionGoalType): GoalMetadata | undefined {
  return GOAL_METADATA[type];
}

/**
 * Get all goal types by category
 */
export function getGoalsByCategory() {
  return {
    Force: [
      'Military Conquest',
      'Invincible Valor',
    ] as FactionGoalType[],
    Cunning: [
      'Intelligence Coup',
      'Inside Enemy Territory',
    ] as FactionGoalType[],
    Wealth: [
      'Commercial Expansion',
      'Wealth of Worlds',
    ] as FactionGoalType[],
    Mixed: [
      'Planetary Seizure',
      'Blood the Enemy',
      'Destroy the Foe',
    ] as FactionGoalType[],
    Special: [
      'Expand Influence',
      'Peaceable Kingdom',
    ] as FactionGoalType[],
  };
}

