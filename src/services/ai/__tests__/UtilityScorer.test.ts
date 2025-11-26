import { describe, it, expect } from 'vitest';
import {
  generateMoveActions,
  generateAttackActions,
  generateExpandActions,
  generateDefendActions,
  generateAllActions,
  scoreAction,
  scoreAllActions,
  getBestActionOfType,
  getActionsAboveThreshold,
  getRecommendedActionType,
  getRecommendedActions,
} from '../UtilityScorer';
import type { Faction, FactionAsset, FactionTag } from '../../../types/faction';
import type { StarSystem } from '../../../types/sector';
import type { StrategicIntent } from '../GoalSelectionService';
import type { InfluenceMap } from '../InfluenceMapService';
import type { SectorThreatOverview } from '../ThreatAssessment';

// Helper to create mock systems
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
    population: 5,
    techLevel: 4,
    government: 'Representative Democracy',
    tags: [],
  },
  secondaryWorlds: [],
  pointsOfInterest: [],
  routes,
});

// Helper to create mock assets
const makeAsset = (
  id: string,
  definitionId: string,
  location: string,
  hp: number = 3,
  maxHp: number = 3,
  stealthed: boolean = false
): FactionAsset => ({
  id,
  definitionId,
  location,
  hp,
  maxHp,
  stealthed,
});

// Helper to create mock factions
const makeFaction = (
  id: string,
  name: string,
  homeworld: string,
  tags: FactionTag[] = [],
  assets: FactionAsset[] = [],
  attributes = { hp: 7, maxHp: 7, force: 3, cunning: 3, wealth: 3 }
): Faction => ({
  id,
  name,
  type: 'minor',
  homeworld,
  attributes,
  facCreds: 10,
  xp: 0,
  tags,
  goal: null,
  assets,
});

// Helper to create mock strategic intent
const makeStrategicIntent = (
  primaryFocus: StrategicIntent['primaryFocus'] = 'military',
  aggressionLevel: number = 50,
  targetFactionId: string | null = null
): StrategicIntent => ({
  primaryFocus,
  aggressionLevel,
  targetFactionId,
  prioritySystemIds: [],
  reasoning: 'Test intent',
});

// Helper to create mock influence map
const makeInfluenceMap = (factionId: string): InfluenceMap => ({
  hexInfluence: {
    A: {
      systemId: 'A',
      totalInfluence: 50,
      factionInfluence: { [factionId]: 50 },
      dominantFactionId: factionId,
      contestedLevel: 0,
      strategicValue: 60,
    },
    B: {
      systemId: 'B',
      totalInfluence: 30,
      factionInfluence: { [factionId]: 30 },
      dominantFactionId: factionId,
      contestedLevel: 20,
      strategicValue: 40,
    },
    C: {
      systemId: 'C',
      totalInfluence: 10,
      factionInfluence: {},
      dominantFactionId: null,
      contestedLevel: 0,
      strategicValue: 30,
    },
  },
  factionTotalInfluence: { [factionId]: 80 },
  mostContestedSystems: [],
  expansionOpportunities: ['C'],
});

// Helper to create mock threat overview
const makeThreatOverview = (
  factionId: string,
  overallDangerLevel: number = 30
): SectorThreatOverview => ({
  assessingFactionId: factionId,
  systemThreats: {
    A: {
      systemId: 'A',
      factionThreats: [],
      overallDangerLevel,
      militaryDanger: overallDangerLevel * 0.4,
      covertDanger: overallDangerLevel * 0.3,
      economicDanger: overallDangerLevel * 0.3,
      dominantThreatType: 'military',
      reasoning: 'Test threat',
    },
    B: {
      systemId: 'B',
      factionThreats: [],
      overallDangerLevel: overallDangerLevel + 20,
      militaryDanger: (overallDangerLevel + 20) * 0.4,
      covertDanger: (overallDangerLevel + 20) * 0.3,
      economicDanger: (overallDangerLevel + 20) * 0.3,
      dominantThreatType: 'military',
      reasoning: 'Test threat',
    },
  },
  mostThreatenedSystems: ['B'],
  safestSystems: ['A'],
  overallThreatLevel: overallDangerLevel,
  primaryThreatFactionId: null,
});

describe('UtilityScorer', () => {
  const systems: StarSystem[] = [
    makeSystem('A', 0, 0, [{ systemId: 'B', isTradeRoute: false }]),
    makeSystem('B', 1, 0, [
      { systemId: 'A', isTradeRoute: false },
      { systemId: 'C', isTradeRoute: false },
    ]),
    makeSystem('C', 2, 0, [{ systemId: 'B', isTradeRoute: false }]),
    makeSystem('D', 3, 0, []),
  ];

  describe('generateMoveActions', () => {
    it('should generate move actions for assets with movement capability', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_4_strike_fleet', 'A'), // Starship - can move
      ]);

      const actions = generateMoveActions(faction, systems);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('move');
      expect(actions[0].sourceLocation).toBe('A');
    });

    it('should not generate move actions for immobile assets', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'), // Military Unit - no move
      ]);

      const actions = generateMoveActions(faction, systems);

      expect(actions).toHaveLength(0);
    });

    it('should allow all assets to move for Mercenary Group factions', () => {
      const faction = makeFaction(
        'faction1',
        'Mercs',
        'A',
        ['Mercenary Group'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const actions = generateMoveActions(faction, systems);

      expect(actions.length).toBeGreaterThan(0);
    });

    it('should only generate moves to adjacent or route-connected systems', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', ['Mercenary Group'], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const actions = generateMoveActions(faction, systems);
      const destinations = actions.map((a) => a.targetLocation);

      // A is connected to B by route
      expect(destinations).toContain('B');
      // D is not adjacent or connected
      expect(destinations).not.toContain('D');
    });
  });

  describe('generateAttackActions', () => {
    it('should generate attack actions against enemies at same location', () => {
      const faction1 = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'), // Has attack
      ]);

      const faction2 = makeFaction('faction2', 'Rebels', 'B', [], [
        makeAsset('enemy1', 'force_1_security_personnel', 'A'), // Same location
      ]);

      const actions = generateAttackActions(faction1, [faction1, faction2], systems);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('attack');
      expect(actions[0].targetFactionId).toBe('faction2');
      expect(actions[0].targetAssetId).toBe('enemy1');
    });

    it('should not generate attacks against enemies at different locations', () => {
      const faction1 = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const faction2 = makeFaction('faction2', 'Rebels', 'B', [], [
        makeAsset('enemy1', 'force_1_security_personnel', 'B'), // Different location
      ]);

      const actions = generateAttackActions(faction1, [faction1, faction2], systems);

      expect(actions).toHaveLength(0);
    });

    it('should not generate attacks against stealthed enemies', () => {
      const faction1 = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const faction2 = makeFaction('faction2', 'Rebels', 'B', [], [
        makeAsset('enemy1', 'force_1_security_personnel', 'A', 3, 3, true), // Stealthed
      ]);

      const actions = generateAttackActions(faction1, [faction1, faction2], systems);

      expect(actions).toHaveLength(0);
    });

    it('should not generate attacks for assets without attack capability', () => {
      const faction1 = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_2_hardened_personnel', 'A'), // No attack, only counterattack
      ]);

      const faction2 = makeFaction('faction2', 'Rebels', 'B', [], [
        makeAsset('enemy1', 'force_1_security_personnel', 'A'),
      ]);

      const actions = generateAttackActions(faction1, [faction1, faction2], systems);

      expect(actions).toHaveLength(0);
    });
  });

  describe('generateExpandActions', () => {
    it('should generate expand actions for systems with assets but no BoI', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'B'), // Asset at B
        // No BoI at B
      ]);

      const actions = generateExpandActions(faction, systems);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('expand');
      expect(actions[0].targetLocation).toBe('B');
    });

    it('should not generate expand actions for systems with existing BoI', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'B'),
        makeAsset('boi1', 'base_of_influence', 'B'), // Already has BoI
      ]);

      const actions = generateExpandActions(faction, systems);

      expect(actions).toHaveLength(0);
    });

    it('should not generate expand actions for homeworld', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'), // Asset at homeworld
      ]);

      const actions = generateExpandActions(faction, systems);

      // Homeworld always has implicit BoI
      expect(actions).toHaveLength(0);
    });
  });

  describe('generateDefendActions', () => {
    it('should generate defend actions for each location with assets', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
        makeAsset('asset2', 'force_1_security_personnel', 'B'),
      ]);

      const actions = generateDefendActions(faction);

      expect(actions).toHaveLength(2);
      expect(actions.map((a) => a.sourceLocation)).toContain('A');
      expect(actions.map((a) => a.sourceLocation)).toContain('B');
    });
  });

  describe('scoreAction', () => {
    it('should score attack actions higher for Warlike factions', () => {
      const warlikeFaction = makeFaction(
        'warlike',
        'Warriors',
        'A',
        ['Warlike'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const peacefulFaction = makeFaction(
        'peaceful',
        'Pacifists',
        'A',
        ['Exchange Consulate'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const enemyFaction = makeFaction('enemy', 'Enemy', 'B', [], [
        makeAsset('enemy1', 'force_1_security_personnel', 'A'),
      ]);

      const attackAction = {
        type: 'attack' as const,
        actingAssetId: 'asset1',
        actingAssetName: 'Security Personnel',
        sourceLocation: 'A',
        targetFactionId: 'enemy',
        targetAssetId: 'enemy1',
        targetAssetName: 'Security Personnel',
        description: 'Attack',
      };

      const influenceMap = makeInfluenceMap('warlike');
      const threatOverview = makeThreatOverview('warlike', 30);
      const intent = makeStrategicIntent('military', 60);

      const warlikeScore = scoreAction(
        attackAction,
        warlikeFaction,
        [warlikeFaction, enemyFaction],
        influenceMap,
        threatOverview,
        intent
      );

      const peacefulScore = scoreAction(
        attackAction,
        peacefulFaction,
        [peacefulFaction, enemyFaction],
        influenceMap,
        threatOverview,
        intent
      );

      expect(warlikeScore.tagModifier).toBeGreaterThan(peacefulScore.tagModifier);
    });

    it('should score expand actions higher for expansion-focused intent', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'B'),
      ]);

      const expandAction = {
        type: 'expand' as const,
        actingAssetId: '',
        actingAssetName: 'Faction',
        sourceLocation: 'B',
        targetLocation: 'B',
        description: 'Expand influence',
      };

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 20);

      const expansionIntent = makeStrategicIntent('expansion', 40);
      const militaryIntent = makeStrategicIntent('military', 60);

      const expansionScore = scoreAction(
        expandAction,
        faction,
        [faction],
        influenceMap,
        threatOverview,
        expansionIntent
      );

      const militaryScore = scoreAction(
        expandAction,
        faction,
        [faction],
        influenceMap,
        threatOverview,
        militaryIntent
      );

      expect(expansionScore.goalSynergy).toBeGreaterThan(militaryScore.goalSynergy);
    });

    it('should score defend actions higher under high threat', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const defendAction = {
        type: 'defend' as const,
        actingAssetId: '',
        actingAssetName: 'Garrison',
        sourceLocation: 'A',
        description: 'Defend',
      };

      const influenceMap = makeInfluenceMap('faction1');
      const lowThreat = makeThreatOverview('faction1', 20);
      const highThreat = makeThreatOverview('faction1', 70);
      const intent = makeStrategicIntent('defensive', 30);

      const lowThreatScore = scoreAction(
        defendAction,
        faction,
        [faction],
        influenceMap,
        lowThreat,
        intent
      );

      const highThreatScore = scoreAction(
        defendAction,
        faction,
        [faction],
        influenceMap,
        highThreat,
        intent
      );

      expect(highThreatScore.baseUtility).toBeGreaterThan(lowThreatScore.baseUtility);
    });

    it('should include reasoning in scored actions', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', ['Warlike'], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const defendAction = {
        type: 'defend' as const,
        actingAssetId: '',
        actingAssetName: 'Garrison',
        sourceLocation: 'A',
        description: 'Defend',
      };

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const scored = scoreAction(
        defendAction,
        faction,
        [faction],
        influenceMap,
        threatOverview,
        intent
      );

      expect(scored.reasoning).toBeDefined();
      expect(scored.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('scoreAllActions', () => {
    it('should score all generated actions', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        ['Mercenary Group'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const result = scoreAllActions(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent
      );

      expect(result.scoredActions.length).toBeGreaterThan(0);
      expect(result.faction).toBe(faction);
    });

    it('should sort actions by score descending', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        ['Mercenary Group'],
        [
          makeAsset('asset1', 'force_1_security_personnel', 'A'),
          makeAsset('asset2', 'force_1_security_personnel', 'B'),
        ]
      );

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const result = scoreAllActions(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent
      );

      for (let i = 1; i < result.scoredActions.length; i++) {
        expect(result.scoredActions[i - 1].score).toBeGreaterThanOrEqual(
          result.scoredActions[i].score
        );
      }
    });

    it('should group actions by type', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        ['Mercenary Group'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const result = scoreAllActions(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent
      );

      expect(result.actionsByType).toBeDefined();
      expect(result.actionsByType.move).toBeDefined();
      expect(result.actionsByType.attack).toBeDefined();
      expect(result.actionsByType.expand).toBeDefined();
      expect(result.actionsByType.defend).toBeDefined();
    });

    it('should identify best action', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        ['Mercenary Group'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const result = scoreAllActions(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent
      );

      expect(result.bestAction).not.toBeNull();
      if (result.bestAction && result.scoredActions.length > 0) {
        expect(result.bestAction.score).toBe(result.scoredActions[0].score);
      }
    });
  });

  describe('getBestActionOfType', () => {
    it('should return the best action of specified type', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        ['Mercenary Group'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const result = scoreAllActions(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent
      );

      const bestMove = getBestActionOfType(result, 'move');
      const bestDefend = getBestActionOfType(result, 'defend');

      if (bestMove) {
        expect(bestMove.action.type).toBe('move');
      }
      if (bestDefend) {
        expect(bestDefend.action.type).toBe('defend');
      }
    });

    it('should return null if no actions of type exist', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'), // Can't move
      ]);

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const result = scoreAllActions(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent
      );

      const bestMove = getBestActionOfType(result, 'move');
      expect(bestMove).toBeNull();
    });
  });

  describe('getActionsAboveThreshold', () => {
    it('should filter actions by score threshold', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        ['Mercenary Group'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const result = scoreAllActions(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent
      );

      const highScoreActions = getActionsAboveThreshold(result, 50);

      highScoreActions.forEach((action) => {
        expect(action.score).toBeGreaterThanOrEqual(50);
      });
    });
  });

  describe('getRecommendedActionType', () => {
    it('should return the type of the best action', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        ['Mercenary Group'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const result = scoreAllActions(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent
      );

      const recommendedType = getRecommendedActionType(result);

      if (result.bestAction) {
        expect(recommendedType).toBe(result.bestAction.action.type);
      }
    });
  });

  describe('getRecommendedActions', () => {
    it('should return all actions of the recommended type', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        ['Mercenary Group'],
        [
          makeAsset('asset1', 'force_1_security_personnel', 'A'),
          makeAsset('asset2', 'force_1_security_personnel', 'A'),
        ]
      );

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1', 30);
      const intent = makeStrategicIntent('military', 50);

      const result = scoreAllActions(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent
      );

      const recommendedActions = getRecommendedActions(result);
      const recommendedType = getRecommendedActionType(result);

      recommendedActions.forEach((action) => {
        expect(action.action.type).toBe(recommendedType);
      });
    });
  });
});


