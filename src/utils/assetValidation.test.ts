import { validateAssetPurchase } from './assetValidation';
import type { Faction, FactionAsset } from '../types/faction';
import type { StarSystem } from '../types/sector';

const makeSystem = (id: string, techLevel: number): StarSystem => ({
  id,
  name: `System-${id}`,
  coordinates: { x: 0, y: 0 },
  primaryWorld: {
    name: `World-${id}`,
    atmosphere: 'Breathable',
    temperature: 'Temperate',
    biosphere: 'Human-miscible',
    population: 3,
    techLevel,
    government: 'Democracy',
    tags: [],
    tradeCodes: [],
  },
  secondaryWorlds: [],
  pointsOfInterest: [],
  routes: [],
});

const makeFaction = (overrides: Partial<Faction> = {}): Faction => ({
  id: 'faction-1',
  name: 'Test Faction',
  type: 'Corporation',
  homeworld: 'system-home',
  attributes: {
    hp: 20,
    maxHp: 20,
    force: 5,
    cunning: 4,
    wealth: 4,
  },
  facCreds: 50,
  xp: 0,
  tags: [],
  goal: null,
  assets: [],
  ...overrides,
});

describe('validateAssetPurchase', () => {
  it('prevents purchasing assets that exceed the world tech level', () => {
    const faction = makeFaction();
    const lowTechSystem = makeSystem('system-low', 2);

    const result = validateAssetPurchase(faction, 'force_2_heavy_drop_assets', {
      targetSystem: lowTechSystem,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/tech level/i);
  });

  it('allows Technical Expertise factions to treat BoI worlds as TL4', () => {
    const assets: FactionAsset[] = [
      {
        id: 'asset-boi',
        definitionId: 'base_of_influence',
        location: 'system-low',
        hp: 5,
        maxHp: 5,
        stealthed: false,
      },
    ];

    const faction = makeFaction({
      tags: ['Technical Expertise'],
      assets,
    });

    const system = makeSystem('system-low', 2);
    const result = validateAssetPurchase(faction, 'force_2_heavy_drop_assets', {
      targetSystem: system,
    });

    expect(result.valid).toBe(true);
  });

  it('requires Psychic Academy tag to purchase psychic-exclusive assets', () => {
    const system = makeSystem('system-high', 5);

    const noPsychFaction = makeFaction({
      attributes: {
        hp: 20,
        maxHp: 20,
        force: 6,
        cunning: 4,
        wealth: 4,
      },
    });

    const denied = validateAssetPurchase(noPsychFaction, 'force_5_psychic_assassins', {
      targetSystem: system,
    });
    expect(denied.valid).toBe(false);

    const psychFaction = makeFaction({
      attributes: {
        hp: 20,
        maxHp: 20,
        force: 6,
        cunning: 4,
        wealth: 4,
      },
      tags: ['Psychic Academy'],
    });

    const allowed = validateAssetPurchase(psychFaction, 'force_5_psychic_assassins', {
      targetSystem: system,
    });
    expect(allowed.valid).toBe(true);
  });

  it('blocks permission-locked assets without planetary control', () => {
    const faction = makeFaction();
    const foreignSystem = makeSystem('system-remote', 4);

    const result = validateAssetPurchase(faction, 'force_1_militia_unit', {
      targetSystem: foreignSystem,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/permission/i);
  });

  it('allows Colonists factions to purchase permission assets on their homeworld', () => {
    const colonists = makeFaction({
      tags: ['Colonists'],
      homeworld: 'system-home',
    });
    const homeSystem = makeSystem('system-home', 3);

    const result = validateAssetPurchase(colonists, 'force_1_militia_unit', {
      targetSystem: homeSystem,
    });

    expect(result.valid).toBe(true);
  });
});

