import { describe, it, expect } from 'vitest';
import {
  calculateGoalWeights,
  selectBestGoal,
  determineStrategicIntent,
  evaluateGoals,
  createGoalInstance,
  shouldChangeGoal,
  TAG_GOAL_AFFINITIES,
} from '../GoalSelectionService';
import type { Faction, FactionAsset, FactionTag } from '../../../types/faction';
import type { StarSystem } from '../../../types/sector';

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
  maxHp: number = 3
): FactionAsset => ({
  id,
  definitionId,
  location,
  hp,
  maxHp,
  stealthed: false,
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
  facCreds: 5,
  xp: 0,
  tags,
  goal: null,
  assets,
});

describe('GoalSelectionService', () => {
  const systems: StarSystem[] = [
    makeSystem('A', 0, 0, [{ systemId: 'B', isTradeRoute: false }]),
    makeSystem('B', 1, 0, [
      { systemId: 'A', isTradeRoute: false },
      { systemId: 'C', isTradeRoute: false },
    ]),
    makeSystem('C', 2, 0, [
      { systemId: 'B', isTradeRoute: false },
      { systemId: 'D', isTradeRoute: false },
    ]),
    makeSystem('D', 3, 0, [{ systemId: 'C', isTradeRoute: false }]),
  ];

  describe('TAG_GOAL_AFFINITIES', () => {
    it('should have affinities defined for all faction tags', () => {
      const allTags: FactionTag[] = [
        'Colonists',
        'Deep Rooted',
        'Eugenics Cult',
        'Exchange Consulate',
        'Fanatical',
        'Imperialists',
        'Machiavellian',
        'Mercenary Group',
        'Perimeter Agency',
        'Pirates',
        'Planetary Government',
        'Plutocratic',
        'Preceptor Archive',
        'Psychic Academy',
        'Savage',
        'Scavengers',
        'Secretive',
        'Technical Expertise',
        'Theocratic',
        'Warlike',
      ];

      allTags.forEach((tag) => {
        expect(TAG_GOAL_AFFINITIES[tag]).toBeDefined();
        expect(TAG_GOAL_AFFINITIES[tag].tag).toBe(tag);
        expect(TAG_GOAL_AFFINITIES[tag].preferredGoals).toBeDefined();
        expect(TAG_GOAL_AFFINITIES[tag].avoidedGoals).toBeDefined();
      });
    });

    it('should have Warlike tag prefer military goals', () => {
      const warlikeAffinity = TAG_GOAL_AFFINITIES['Warlike'];
      expect(warlikeAffinity.preferredGoals).toContain('Military Conquest');
      expect(warlikeAffinity.preferredGoals).toContain('Invincible Valor');
      expect(warlikeAffinity.avoidedGoals).toContain('Peaceable Kingdom');
      expect(warlikeAffinity.aggressionModifier).toBeGreaterThan(0);
    });

    it('should have Exchange Consulate tag prefer economic goals', () => {
      const exchangeAffinity = TAG_GOAL_AFFINITIES['Exchange Consulate'];
      expect(exchangeAffinity.preferredGoals).toContain('Commercial Expansion');
      expect(exchangeAffinity.preferredGoals).toContain('Wealth of Worlds');
      expect(exchangeAffinity.avoidedGoals).toContain('Military Conquest');
      expect(exchangeAffinity.aggressionModifier).toBeLessThan(0);
    });

    it('should have Secretive tag prefer covert goals', () => {
      const secretiveAffinity = TAG_GOAL_AFFINITIES['Secretive'];
      expect(secretiveAffinity.preferredGoals).toContain('Inside Enemy Territory');
      expect(secretiveAffinity.preferredGoals).toContain('Intelligence Coup');
      expect(secretiveAffinity.avoidedGoals).toContain('Military Conquest');
    });
  });

  describe('calculateGoalWeights', () => {
    it('should return weights for all 11 goal types', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', ['Warlike']);
      const weights = calculateGoalWeights(faction, [faction], systems);

      expect(weights.length).toBe(11);
      weights.forEach((weight) => {
        expect(weight.goalType).toBeDefined();
        expect(weight.baseWeight).toBeGreaterThanOrEqual(0);
        expect(weight.finalWeight).toBeGreaterThanOrEqual(0);
        expect(weight.finalWeight).toBeLessThanOrEqual(100);
      });
    });

    it('should weight military goals higher for Warlike factions', () => {
      const warlikeFaction = makeFaction('warlike', 'Warriors', 'A', ['Warlike']);
      const peacefulFaction = makeFaction('peaceful', 'Traders', 'B', ['Exchange Consulate']);

      const warlikeWeights = calculateGoalWeights(warlikeFaction, [warlikeFaction], systems);
      const peacefulWeights = calculateGoalWeights(peacefulFaction, [peacefulFaction], systems);

      const warlikeMilitary = warlikeWeights.find((w) => w.goalType === 'Military Conquest');
      const peacefulMilitary = peacefulWeights.find((w) => w.goalType === 'Military Conquest');

      expect(warlikeMilitary!.finalWeight).toBeGreaterThan(peacefulMilitary!.finalWeight);
    });

    it('should weight economic goals higher for Plutocratic factions', () => {
      const plutocraticFaction = makeFaction('plutocratic', 'Oligarchs', 'A', ['Plutocratic']);
      const normalFaction = makeFaction('normal', 'Normal', 'B', []);

      const plutocraticWeights = calculateGoalWeights(plutocraticFaction, [plutocraticFaction], systems);
      const normalWeights = calculateGoalWeights(normalFaction, [normalFaction], systems);

      const plutocraticWealth = plutocraticWeights.find((w) => w.goalType === 'Wealth of Worlds');
      const normalWealth = normalWeights.find((w) => w.goalType === 'Wealth of Worlds');

      expect(plutocraticWealth!.finalWeight).toBeGreaterThan(normalWealth!.finalWeight);
    });

    it('should include tag modifier in reasoning', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', ['Warlike']);
      const weights = calculateGoalWeights(faction, [faction], systems);

      const militaryWeight = weights.find((w) => w.goalType === 'Military Conquest');
      expect(militaryWeight!.tagModifier).toBeGreaterThan(0);
      expect(militaryWeight!.reasoning).toContain('Warlike');
    });

    it('should apply negative modifiers for avoided goals', () => {
      const faction = makeFaction('faction1', 'Warriors', 'A', ['Warlike']);
      const weights = calculateGoalWeights(faction, [faction], systems);

      const peaceableWeight = weights.find((w) => w.goalType === 'Peaceable Kingdom');
      expect(peaceableWeight!.tagModifier).toBeLessThan(0);
    });

    it('should weight Force-based goals higher for high Force factions', () => {
      const highForceFaction = makeFaction(
        'highForce',
        'Military',
        'A',
        [],
        [],
        { hp: 7, maxHp: 7, force: 6, cunning: 1, wealth: 1 }
      );

      const lowForceFaction = makeFaction(
        'lowForce',
        'Weak',
        'B',
        [],
        [],
        { hp: 7, maxHp: 7, force: 1, cunning: 1, wealth: 1 }
      );

      const highForceWeights = calculateGoalWeights(highForceFaction, [highForceFaction], systems);
      const lowForceWeights = calculateGoalWeights(lowForceFaction, [lowForceFaction], systems);

      const highForceMilitary = highForceWeights.find((w) => w.goalType === 'Military Conquest');
      const lowForceMilitary = lowForceWeights.find((w) => w.goalType === 'Military Conquest');

      expect(highForceMilitary!.baseWeight).toBeGreaterThan(lowForceMilitary!.baseWeight);
    });

    it('should favor Peaceable Kingdom when HP is low', () => {
      const lowHpFaction = makeFaction(
        'lowHp',
        'Wounded',
        'A',
        [],
        [],
        { hp: 2, maxHp: 7, force: 3, cunning: 3, wealth: 3 }
      );

      const weights = calculateGoalWeights(lowHpFaction, [lowHpFaction], systems);
      const peaceableWeight = weights.find((w) => w.goalType === 'Peaceable Kingdom');

      expect(peaceableWeight!.situationalModifier).toBeGreaterThan(0);
    });
  });

  describe('selectBestGoal', () => {
    it('should select Military Conquest for Warlike faction', () => {
      const warlikeFaction = makeFaction(
        'warlike',
        'Warriors',
        'A',
        ['Warlike'],
        [],
        { hp: 7, maxHp: 7, force: 5, cunning: 2, wealth: 2 }
      );

      const bestGoal = selectBestGoal(warlikeFaction, [warlikeFaction], systems);

      // Warlike with high Force should prefer military goals
      expect(['Military Conquest', 'Invincible Valor', 'Blood the Enemy', 'Destroy the Foe']).toContain(
        bestGoal
      );
    });

    it('should select economic goal for Plutocratic faction', () => {
      const plutocraticFaction = makeFaction(
        'plutocratic',
        'Oligarchs',
        'A',
        ['Plutocratic'],
        [],
        { hp: 7, maxHp: 7, force: 2, cunning: 2, wealth: 5 }
      );

      const bestGoal = selectBestGoal(plutocraticFaction, [plutocraticFaction], systems);

      // Plutocratic with high Wealth should prefer economic goals
      expect(['Wealth of Worlds', 'Commercial Expansion', 'Expand Influence']).toContain(bestGoal);
    });

    it('should select covert goal for Machiavellian faction', () => {
      const machiavellianFaction = makeFaction(
        'machiavellian',
        'Schemers',
        'A',
        ['Machiavellian'],
        [],
        { hp: 7, maxHp: 7, force: 2, cunning: 5, wealth: 2 }
      );

      const bestGoal = selectBestGoal(machiavellianFaction, [machiavellianFaction], systems);

      // Machiavellian with high Cunning should prefer covert goals
      expect(['Intelligence Coup', 'Inside Enemy Territory', 'Blood the Enemy']).toContain(bestGoal);
    });

    it('should return a goal for faction with no tags', () => {
      const neutralFaction = makeFaction('neutral', 'Neutral', 'A', []);
      const bestGoal = selectBestGoal(neutralFaction, [neutralFaction], systems);

      expect(bestGoal).not.toBeNull();
    });
  });

  describe('determineStrategicIntent', () => {
    it('should set military focus for Military Conquest goal', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', ['Warlike']);
      const intent = determineStrategicIntent(faction, 'Military Conquest', [faction], systems);

      expect(intent.primaryFocus).toBe('military');
      expect(intent.aggressionLevel).toBeGreaterThan(50);
    });

    it('should set economic focus for Commercial Expansion goal', () => {
      const faction = makeFaction('faction1', 'Traders', 'A', ['Exchange Consulate']);
      const intent = determineStrategicIntent(faction, 'Commercial Expansion', [faction], systems);

      expect(intent.primaryFocus).toBe('economic');
      expect(intent.aggressionLevel).toBeLessThan(50);
    });

    it('should set defensive focus for Peaceable Kingdom goal', () => {
      const faction = makeFaction('faction1', 'Peacekeepers', 'A', []);
      const intent = determineStrategicIntent(faction, 'Peaceable Kingdom', [faction], systems);

      expect(intent.primaryFocus).toBe('defensive');
      expect(intent.aggressionLevel).toBeLessThan(50);
    });

    it('should set covert focus for Intelligence Coup goal', () => {
      const faction = makeFaction('faction1', 'Spies', 'A', ['Machiavellian']);
      const intent = determineStrategicIntent(faction, 'Intelligence Coup', [faction], systems);

      expect(intent.primaryFocus).toBe('covert');
    });

    it('should include homeworld in priority systems', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', []);
      const intent = determineStrategicIntent(faction, 'Expand Influence', [faction], systems);

      expect(intent.prioritySystemIds).toContain('A');
    });

    it('should target weakest enemy for Destroy the Foe goal', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', ['Warlike']);
      const weakEnemy = makeFaction(
        'weak',
        'Weak',
        'B',
        [],
        [],
        { hp: 3, maxHp: 3, force: 1, cunning: 1, wealth: 1 }
      );
      const strongEnemy = makeFaction(
        'strong',
        'Strong',
        'C',
        [],
        [],
        { hp: 10, maxHp: 10, force: 5, cunning: 5, wealth: 5 }
      );

      const intent = determineStrategicIntent(
        faction,
        'Destroy the Foe',
        [faction, weakEnemy, strongEnemy],
        systems
      );

      expect(intent.targetFactionId).toBe('weak');
    });

    it('should reduce aggression when HP is low', () => {
      const healthyFaction = makeFaction(
        'healthy',
        'Healthy',
        'A',
        ['Warlike'],
        [],
        { hp: 7, maxHp: 7, force: 3, cunning: 3, wealth: 3 }
      );

      const woundedFaction = makeFaction(
        'wounded',
        'Wounded',
        'B',
        ['Warlike'],
        [],
        { hp: 2, maxHp: 7, force: 3, cunning: 3, wealth: 3 }
      );

      const healthyIntent = determineStrategicIntent(
        healthyFaction,
        'Military Conquest',
        [healthyFaction],
        systems
      );

      const woundedIntent = determineStrategicIntent(
        woundedFaction,
        'Military Conquest',
        [woundedFaction],
        systems
      );

      expect(woundedIntent.aggressionLevel).toBeLessThan(healthyIntent.aggressionLevel);
    });
  });

  describe('evaluateGoals', () => {
    it('should return complete evaluation with all fields', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', ['Warlike']);
      const evaluation = evaluateGoals(faction, [faction], systems);

      expect(evaluation.faction).toBe(faction);
      expect(evaluation.currentGoal).toBeNull();
      expect(evaluation.recommendedGoal).not.toBeNull();
      expect(evaluation.goalWeights.length).toBe(11);
      expect(evaluation.strategicIntent).toBeDefined();
      expect(evaluation.strategicIntent.primaryFocus).toBeDefined();
    });

    it('should include strategic intent reasoning', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', ['Warlike']);
      const evaluation = evaluateGoals(faction, [faction], systems);

      expect(evaluation.strategicIntent.reasoning).toBeDefined();
      expect(evaluation.strategicIntent.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('createGoalInstance', () => {
    it('should create Military Conquest goal with Force-based target', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        [],
        [],
        { hp: 7, maxHp: 7, force: 4, cunning: 2, wealth: 2 }
      );

      const goal = createGoalInstance('Military Conquest', faction);

      expect(goal.type).toBe('Military Conquest');
      expect(goal.progress.target).toBe(4); // Equal to Force rating
      expect(goal.progress.current).toBe(0);
      expect(goal.isCompleted).toBe(false);
      expect(goal.id).toBeDefined();
    });

    it('should create Blood the Enemy goal with combined attribute target', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        [],
        [],
        { hp: 7, maxHp: 7, force: 3, cunning: 2, wealth: 4 }
      );

      const goal = createGoalInstance('Blood the Enemy', faction);

      expect(goal.type).toBe('Blood the Enemy');
      expect(goal.progress.target).toBe(9); // Force + Cunning + Wealth
    });

    it('should create Wealth of Worlds goal with 4x Wealth target', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        [],
        [],
        { hp: 7, maxHp: 7, force: 2, cunning: 2, wealth: 5 }
      );

      const goal = createGoalInstance('Wealth of Worlds', faction);

      expect(goal.type).toBe('Wealth of Worlds');
      expect(goal.progress.target).toBe(20); // 4 * Wealth
    });

    it('should create Peaceable Kingdom goal with 4 turn target', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', []);
      const goal = createGoalInstance('Peaceable Kingdom', faction);

      expect(goal.type).toBe('Peaceable Kingdom');
      expect(goal.progress.target).toBe(4);
    });

    it('should assign higher difficulty to hard goals', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', []);

      const easyGoal = createGoalInstance('Expand Influence', faction);
      const hardGoal = createGoalInstance('Destroy the Foe', faction);

      expect(hardGoal.difficulty).toBeGreaterThan(easyGoal.difficulty);
    });
  });

  describe('shouldChangeGoal', () => {
    it('should recommend change when no current goal', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', []);
      const result = shouldChangeGoal(faction, [faction], systems);

      expect(result.shouldChange).toBe(true);
      expect(result.reason).toContain('No current goal');
    });

    it('should recommend change when goal is completed', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', []);
      faction.goal = {
        id: 'goal1',
        type: 'Expand Influence',
        description: 'Test',
        progress: { current: 1, target: 1 },
        difficulty: 1,
        isCompleted: true,
      };

      const result = shouldChangeGoal(faction, [faction], systems);

      expect(result.shouldChange).toBe(true);
      expect(result.reason).toContain('completed');
    });

    it('should not recommend change when current goal is optimal', () => {
      const warlikeFaction = makeFaction(
        'warlike',
        'Warriors',
        'A',
        ['Warlike'],
        [],
        { hp: 7, maxHp: 7, force: 5, cunning: 2, wealth: 2 }
      );
      warlikeFaction.goal = {
        id: 'goal1',
        type: 'Military Conquest',
        description: 'Test',
        progress: { current: 0, target: 5 },
        difficulty: 1,
        isCompleted: false,
      };

      const result = shouldChangeGoal(warlikeFaction, [warlikeFaction], systems);

      expect(result.shouldChange).toBe(false);
    });

    it('should recommend change when significantly better goal exists', () => {
      // Create a faction with Warlike tag but pursuing a Wealth goal
      const warlikeFaction = makeFaction(
        'warlike',
        'Warriors',
        'A',
        ['Warlike', 'Fanatical'],
        [],
        { hp: 7, maxHp: 7, force: 6, cunning: 2, wealth: 1 }
      );
      warlikeFaction.goal = {
        id: 'goal1',
        type: 'Wealth of Worlds', // Mismatched with tags
        description: 'Test',
        progress: { current: 0, target: 4 },
        difficulty: 1,
        isCompleted: false,
      };

      const result = shouldChangeGoal(warlikeFaction, [warlikeFaction], systems);

      // Should recommend change since military goals would be much better weighted
      expect(result.shouldChange).toBe(true);
    });
  });
});


