import { describe, it, expect } from 'vitest';
import type { Faction } from '../types/faction';
import {
  getMovementModifierSummary,
  getFactionMaintenanceModifier,
  getMovementTollCharges,
} from './tagModifiers';
import { BASE_OF_INFLUENCE_ID } from './expandInfluence';

const createFaction = (overrides: Partial<Faction> = {}): Faction => ({
  id: 'faction-test',
  name: 'Test Faction',
  type: 'Government',
  homeworld: 'system-1',
  attributes: {
    hp: 20,
    maxHp: 20,
    force: 4,
    cunning: 4,
    wealth: 4,
  },
  facCreds: 10,
  xp: 0,
  tags: [],
  goal: null,
  assets: [],
  ...overrides,
});

describe('tagModifiers movement & maintenance helpers', () => {
  it('applies homeworld departure penalty for Deep Rooted factions', () => {
    const faction = createFaction({ tags: ['Deep Rooted'] });
    const summary = getMovementModifierSummary(faction);
    expect(summary.homeworldDeparturePenalty).toBe(1);
  });

  it('reduces maintenance for Scavengers factions', () => {
    const faction = createFaction({ tags: ['Scavengers'] });
    expect(getFactionMaintenanceModifier(faction)).toBe(-1);
  });

  it('charges movement tolls when entering Pirate bases', () => {
    const pirateFaction = createFaction({
      id: 'pirate',
      tags: ['Pirates'],
      assets: [
        {
          id: 'boi-1',
          definitionId: BASE_OF_INFLUENCE_ID,
          location: 'system-2',
          hp: 5,
          maxHp: 5,
          stealthed: false,
        },
      ],
    });

    const movingFaction = createFaction({ id: 'mover' });

    const charges = getMovementTollCharges([pirateFaction, movingFaction], 'mover', 'system-2');
    expect(charges).toHaveLength(1);
    expect(charges[0]).toEqual({ factionId: 'pirate', amount: 1 });
  });
});


