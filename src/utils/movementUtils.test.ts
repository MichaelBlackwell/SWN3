import { describe, it, expect } from 'vitest';
import type { StarSystem } from '../types/sector';
import { getValidMovementDestinations } from './movementUtils';

const makeSystem = (
  id: string,
  x: number,
  y: number,
  routes: Array<{ systemId: string; isTradeRoute: boolean }> = []
): StarSystem => ({
  id,
  name: id,
  coordinates: { x, y },
  primaryWorld: {
    name: `${id} Prime`,
    atmosphere: 'Breathable',
    temperature: 'Temperate',
    biosphere: 'Human-miscible',
    population: 'Millions',
    techLevel: 4,
    government: 'Representative Democracy',
    tags: [],
  },
  secondaryWorlds: [],
  pointsOfInterest: [],
  routes,
});

describe('movementUtils', () => {
  const systems: StarSystem[] = [
    makeSystem('A', 0, 0, [{ systemId: 'B', isTradeRoute: false }]),
    makeSystem('B', 1, 0, [{ systemId: 'A', isTradeRoute: false }, { systemId: 'C', isTradeRoute: false }]),
    makeSystem('C', 2, 0, [{ systemId: 'B', isTradeRoute: false }]),
    makeSystem('D', 0, 1),
  ];

  it('returns adjacent and route-connected systems for default range', () => {
    const destinations = getValidMovementDestinations('A', systems);
    expect(destinations).toContain('B'); // route neighbor
    expect(destinations).toContain('D'); // adjacent hex
    expect(destinations).not.toContain('C');
  });

  it('expands reachable systems when range increases', () => {
    const destinations = getValidMovementDestinations('A', systems, 2);
    expect(destinations).toContain('C');
  });
});

