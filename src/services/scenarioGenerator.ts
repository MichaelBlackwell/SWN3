import type { ScenarioConfig } from '../store/slices/gameModeSlice';

export const PREDEFINED_SCENARIOS: ScenarioConfig[] = [
  {
    name: 'The Frontier Wars',
    description: 'A volatile frontier sector with multiple competing factions vying for control. Ideal for newcomers.',
    systemCount: { min: 15, max: 20 },
    factionCount: 3,
    difficulty: 'easy',
    specialRules: ['Reduced combat penalties', 'Extra starting credits'],
  },
  {
    name: 'Trade Empire',
    description: 'A densely connected sector with rich trade opportunities. Balance commerce and conflict.',
    systemCount: { min: 25, max: 30 },
    factionCount: 4,
    difficulty: 'medium',
    specialRules: ['Enhanced trade routes', 'Economic bonuses'],
  },
  {
    name: 'The Scream Aftermath',
    description: 'A sparse, isolated sector still recovering from the Scream. Resources are scarce and danger is high.',
    systemCount: { min: 10, max: 15 },
    factionCount: 5,
    difficulty: 'hard',
    specialRules: ['Limited spike drive routes', 'Hostile environments', 'Scarce resources'],
  },
  {
    name: 'Galactic Core',
    description: 'A massive, heavily populated sector with complex political dynamics. Not for the faint of heart.',
    systemCount: { min: 30, max: 40 },
    factionCount: 6,
    difficulty: 'hard',
    specialRules: ['Maximum complexity', 'Political intrigue', 'Dense faction network'],
  },
  {
    name: 'Random Sector',
    description: 'A completely random sector generation with standard parameters.',
    systemCount: { min: 21, max: 30 },
    factionCount: 4,
    difficulty: 'medium',
    specialRules: [],
  },
];

/**
 * Get a random scenario from the predefined list
 */
export function getRandomScenario(): ScenarioConfig {
  const index = Math.floor(Math.random() * PREDEFINED_SCENARIOS.length);
  return PREDEFINED_SCENARIOS[index];
}

/**
 * Get all available scenarios
 */
export function getAllScenarios(): ScenarioConfig[] {
  return PREDEFINED_SCENARIOS;
}

/**
 * Get a scenario by name
 */
export function getScenarioByName(name: string): ScenarioConfig | undefined {
  return PREDEFINED_SCENARIOS.find(s => s.name === name);
}

