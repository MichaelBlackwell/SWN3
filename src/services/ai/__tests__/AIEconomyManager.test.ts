import { describe, it, expect } from 'vitest';
import {
  generateRepairDecisions,
  calculateRepairReserve,
  getValidPurchaseLocations,
  canPurchaseAsset,
  generatePurchaseRecommendations,
  generateEconomicPlan,
  selectRepairsWithinBudget,
  getEconomyAction,
  TAG_ASSET_SYNERGIES,
} from '../AIEconomyManager';
import type { Faction, FactionAsset, FactionTag } from '../../../types/faction';
import type { StarSystem } from '../../../types/sector';
import type { StrategicIntent } from '../GoalSelectionService';
import type { SectorThreatOverview } from '../ThreatAssessment';

// Helper to create mock systems
const makeSystem = (
  id: string,
  x: number,
  y: number,
  techLevel: number = 4
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
    techLevel,
    government: 'Representative Democracy',
    tags: [],
  },
  secondaryWorlds: [],
  pointsOfInterest: [],
  routes: [],
});

// Helper to create mock assets
const makeAsset = (
  id: string,
  definitionId: string,
  location: string,
  hp: number,
  maxHp: number
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
  attributes = { hp: 7, maxHp: 7, force: 3, cunning: 3, wealth: 3 },
  facCreds: number = 10
): Faction => ({
  id,
  name,
  type: 'minor',
  homeworld,
  attributes,
  facCreds,
  xp: 0,
  tags,
  goal: null,
  assets,
});

// Helper to create mock strategic intent
const makeStrategicIntent = (
  primaryFocus: StrategicIntent['primaryFocus'] = 'military',
  aggressionLevel: number = 50
): StrategicIntent => ({
  primaryFocus,
  aggressionLevel,
  targetFactionId: null,
  prioritySystemIds: [],
  reasoning: 'Test intent',
});

// Helper to create mock threat overview
const makeThreatOverview = (overallDangerLevel: number = 30): SectorThreatOverview => ({
  assessingFactionId: 'faction1',
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
  },
  mostThreatenedSystems: ['A'],
  safestSystems: [],
  overallThreatLevel: overallDangerLevel,
  primaryThreatFactionId: null,
});

describe('AIEconomyManager', () => {
  const systems: StarSystem[] = [
    makeSystem('A', 0, 0, 4),
    makeSystem('B', 1, 0, 4),
    makeSystem('C', 2, 0, 2), // Low tech level
  ];

  describe('TAG_ASSET_SYNERGIES', () => {
    it('should have synergies defined for all faction tags', () => {
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
        expect(TAG_ASSET_SYNERGIES[tag]).toBeDefined();
        expect(TAG_ASSET_SYNERGIES[tag].tag).toBe(tag);
        expect(TAG_ASSET_SYNERGIES[tag].preferredAssetTypes.length).toBeGreaterThan(0);
        expect(TAG_ASSET_SYNERGIES[tag].preferredCategories.length).toBeGreaterThan(0);
      });
    });

    it('should have Warlike tag prefer Force assets', () => {
      const warlikeSynergy = TAG_ASSET_SYNERGIES['Warlike'];
      expect(warlikeSynergy.preferredCategories).toContain('Force');
      expect(warlikeSynergy.preferredAssetTypes).toContain('Military Unit');
    });

    it('should have Plutocratic tag prefer Wealth assets', () => {
      const plutocraticSynergy = TAG_ASSET_SYNERGIES['Plutocratic'];
      expect(plutocraticSynergy.preferredCategories).toContain('Wealth');
    });

    it('should have Secretive tag prefer Cunning assets', () => {
      const secretiveSynergy = TAG_ASSET_SYNERGIES['Secretive'];
      expect(secretiveSynergy.preferredCategories).toContain('Cunning');
      expect(secretiveSynergy.preferredAssetTypes).toContain('Special Forces');
    });
  });

  describe('generateRepairDecisions', () => {
    it('should return empty array when no assets are damaged', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A', 3, 3),
      ]);

      const decisions = generateRepairDecisions(faction, 50);
      expect(decisions).toHaveLength(0);
    });

    it('should generate repair decisions for damaged assets', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A', 1, 3), // Damaged
        makeAsset('asset2', 'force_2_elite_skirmishers', 'A', 5, 5), // Full HP
      ]);

      const decisions = generateRepairDecisions(faction, 50);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].assetId).toBe('asset1');
      expect(decisions[0].damageAmount).toBe(2);
    });

    it('should prioritize heavily damaged assets', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A', 2, 3), // 33% damaged
        makeAsset('asset2', 'force_2_elite_skirmishers', 'A', 1, 5), // 80% damaged
      ]);

      const decisions = generateRepairDecisions(faction, 50);
      expect(decisions).toHaveLength(2);
      // More damaged asset should be first
      expect(decisions[0].assetId).toBe('asset2');
    });

    it('should increase priority for combat assets under high threat', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A', 1, 3), // Has attack
      ]);

      const lowThreatDecisions = generateRepairDecisions(faction, 20);
      const highThreatDecisions = generateRepairDecisions(faction, 80);

      expect(highThreatDecisions[0].priority).toBeGreaterThan(lowThreatDecisions[0].priority);
    });

    it('should calculate repair cost correctly', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        [],
        [makeAsset('asset1', 'force_1_security_personnel', 'A', 1, 3)],
        { hp: 7, maxHp: 7, force: 3, cunning: 3, wealth: 3 } // Healing per batch = 3
      );

      const decisions = generateRepairDecisions(faction, 50);
      // 2 damage, 3 healing per batch = 1 batch = 1 FacCred
      expect(decisions[0].repairCost).toBe(1);
    });
  });

  describe('calculateRepairReserve', () => {
    it('should reserve nothing at 0 threat', () => {
      const reserve = calculateRepairReserve(10, 0, 20);
      expect(reserve).toBe(0);
    });

    it('should reserve more at higher threat levels', () => {
      const lowThreatReserve = calculateRepairReserve(10, 30, 20);
      const highThreatReserve = calculateRepairReserve(10, 80, 20);

      expect(highThreatReserve).toBeGreaterThan(lowThreatReserve);
    });

    it('should not reserve more than available FacCreds', () => {
      const reserve = calculateRepairReserve(100, 100, 5);
      expect(reserve).toBeLessThanOrEqual(5);
    });

    it('should not reserve more than total repair cost', () => {
      const reserve = calculateRepairReserve(3, 100, 20);
      expect(reserve).toBeLessThanOrEqual(3);
    });
  });

  describe('getValidPurchaseLocations', () => {
    it('should always include homeworld', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], []);
      const locations = getValidPurchaseLocations(faction);

      expect(locations).toContain('A');
    });

    it('should include worlds with Base of Influence', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('boi1', 'base_of_influence', 'B', 3, 3),
        makeAsset('asset1', 'force_1_security_personnel', 'C', 3, 3), // Not a BoI
      ]);

      const locations = getValidPurchaseLocations(faction);

      expect(locations).toContain('A'); // Homeworld
      expect(locations).toContain('B'); // Has BoI
      expect(locations).not.toContain('C'); // No BoI
    });
  });

  describe('canPurchaseAsset', () => {
    it('should allow purchase when all requirements met', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        [],
        [],
        { hp: 7, maxHp: 7, force: 3, cunning: 3, wealth: 3 }
      );

      // Force 1 asset on TL4 world
      const result = canPurchaseAsset(
        faction,
        {
          id: 'force_1_security_personnel',
          name: 'Security Personnel',
          category: 'Force',
          requiredRating: 1,
          hp: 3,
          cost: 2,
          techLevel: 0,
          type: 'Military Unit',
          attack: null,
          counterattack: null,
          maintenance: 0,
          specialFlags: { hasAction: false, hasSpecial: false, requiresPermission: false },
        },
        'A',
        systems
      );

      expect(result.canPurchase).toBe(true);
    });

    it('should reject purchase when rating too low', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        [],
        [],
        { hp: 7, maxHp: 7, force: 1, cunning: 1, wealth: 1 }
      );

      // Force 4 asset
      const result = canPurchaseAsset(
        faction,
        {
          id: 'force_4_strike_fleet',
          name: 'Strike Fleet',
          category: 'Force',
          requiredRating: 4,
          hp: 8,
          cost: 12,
          techLevel: 4,
          type: 'Starship',
          attack: null,
          counterattack: null,
          maintenance: 0,
          specialFlags: { hasAction: false, hasSpecial: false, requiresPermission: false },
        },
        'A',
        systems
      );

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toContain('Requires Force 4');
    });

    it('should reject purchase when tech level too low', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'C', // TL2 world
        [],
        [],
        { hp: 7, maxHp: 7, force: 4, cunning: 4, wealth: 4 }
      );

      // TL4 asset on TL2 world
      const result = canPurchaseAsset(
        faction,
        {
          id: 'force_4_strike_fleet',
          name: 'Strike Fleet',
          category: 'Force',
          requiredRating: 4,
          hp: 8,
          cost: 12,
          techLevel: 4,
          type: 'Starship',
          attack: null,
          counterattack: null,
          maintenance: 0,
          specialFlags: { hasAction: false, hasSpecial: false, requiresPermission: false },
        },
        'C',
        systems
      );

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toContain('TL');
    });
  });

  describe('generatePurchaseRecommendations', () => {
    it('should return empty array when no budget', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', []);
      const intent = makeStrategicIntent('military', 50);

      const recommendations = generatePurchaseRecommendations(faction, systems, intent, 0);
      expect(recommendations).toHaveLength(0);
    });

    it('should only recommend affordable assets', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [], {
        hp: 7,
        maxHp: 7,
        force: 8,
        cunning: 8,
        wealth: 8,
      });
      const intent = makeStrategicIntent('military', 50);

      const recommendations = generatePurchaseRecommendations(faction, systems, intent, 5);

      recommendations.forEach((rec) => {
        expect(rec.assetDefinition.cost).toBeLessThanOrEqual(5);
      });
    });

    it('should score Force assets higher for Warlike factions with military focus', () => {
      const warlikeFaction = makeFaction(
        'warlike',
        'Warriors',
        'A',
        ['Warlike'],
        [],
        { hp: 7, maxHp: 7, force: 4, cunning: 4, wealth: 4 }
      );
      const militaryIntent = makeStrategicIntent('military', 70);

      const recommendations = generatePurchaseRecommendations(
        warlikeFaction,
        systems,
        militaryIntent,
        20
      );

      // Force assets should be near the top
      const topRecs = recommendations.slice(0, 5);
      const forceAssetCount = topRecs.filter(
        (r) => r.assetDefinition.category === 'Force'
      ).length;

      expect(forceAssetCount).toBeGreaterThan(0);
    });

    it('should score Wealth assets higher for Plutocratic factions with economic focus', () => {
      const plutocraticFaction = makeFaction(
        'plutocratic',
        'Oligarchs',
        'A',
        ['Plutocratic'],
        [],
        { hp: 7, maxHp: 7, force: 4, cunning: 4, wealth: 4 }
      );
      const economicIntent = makeStrategicIntent('economic', 30);

      const recommendations = generatePurchaseRecommendations(
        plutocraticFaction,
        systems,
        economicIntent,
        20
      );

      // Wealth assets should be near the top
      const topRecs = recommendations.slice(0, 5);
      const wealthAssetCount = topRecs.filter(
        (r) => r.assetDefinition.category === 'Wealth'
      ).length;

      expect(wealthAssetCount).toBeGreaterThan(0);
    });

    it('should include tag synergy score in recommendations', () => {
      const warlikeFaction = makeFaction('warlike', 'Warriors', 'A', ['Warlike']);
      const intent = makeStrategicIntent('military', 50);

      const recommendations = generatePurchaseRecommendations(
        warlikeFaction,
        systems,
        intent,
        10
      );

      // At least some recommendations should have tag synergy
      const hasTagSynergy = recommendations.some((r) => r.tagSynergyScore > 0);
      expect(hasTagSynergy).toBe(true);
    });
  });

  describe('generateEconomicPlan', () => {
    it('should generate a complete economic plan', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', ['Warlike'], [], {
        hp: 7,
        maxHp: 7,
        force: 3,
        cunning: 3,
        wealth: 3,
      }, 15);
      const intent = makeStrategicIntent('military', 50);
      const threatOverview = makeThreatOverview(40);

      const plan = generateEconomicPlan(faction, systems, threatOverview, intent);

      expect(plan.faction).toBe(faction);
      expect(plan.availableFacCreds).toBe(15);
      expect(plan.threatLevel).toBeGreaterThanOrEqual(0);
      expect(plan.repairReserve).toBeGreaterThanOrEqual(0);
      expect(plan.spendingBudget).toBeGreaterThanOrEqual(0);
      expect(plan.reasoning).toBeDefined();
    });

    it('should reserve more for repairs under high threat', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        [],
        [makeAsset('asset1', 'force_1_security_personnel', 'A', 1, 3)], // Damaged
        { hp: 7, maxHp: 7, force: 3, cunning: 3, wealth: 3 },
        15
      );
      const intent = makeStrategicIntent('military', 50);

      const lowThreatPlan = generateEconomicPlan(
        faction,
        systems,
        makeThreatOverview(20),
        intent
      );

      const highThreatPlan = generateEconomicPlan(
        faction,
        systems,
        makeThreatOverview(80),
        intent
      );

      expect(highThreatPlan.repairReserve).toBeGreaterThanOrEqual(lowThreatPlan.repairReserve);
    });

    it('should recommend purchase when budget allows', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        [],
        [],
        { hp: 7, maxHp: 7, force: 3, cunning: 3, wealth: 3 },
        20 // Plenty of FacCreds
      );
      const intent = makeStrategicIntent('military', 50);
      const threatOverview = makeThreatOverview(10); // Low threat

      const plan = generateEconomicPlan(faction, systems, threatOverview, intent);

      expect(plan.purchaseRecommendation).not.toBeNull();
    });
  });

  describe('selectRepairsWithinBudget', () => {
    it('should select repairs that fit within budget', () => {
      const repairDecisions = [
        {
          assetId: 'asset1',
          assetName: 'Asset 1',
          location: 'A',
          currentHp: 1,
          maxHp: 5,
          damageAmount: 4,
          repairCost: 3,
          priority: 80,
          reasoning: 'High priority',
        },
        {
          assetId: 'asset2',
          assetName: 'Asset 2',
          location: 'A',
          currentHp: 2,
          maxHp: 3,
          damageAmount: 1,
          repairCost: 1,
          priority: 40,
          reasoning: 'Low priority',
        },
      ];

      const selected = selectRepairsWithinBudget(repairDecisions, 3);

      expect(selected).toHaveLength(1);
      expect(selected[0].assetId).toBe('asset1'); // Higher priority
    });

    it('should select multiple repairs if budget allows', () => {
      const repairDecisions = [
        {
          assetId: 'asset1',
          assetName: 'Asset 1',
          location: 'A',
          currentHp: 1,
          maxHp: 3,
          damageAmount: 2,
          repairCost: 1,
          priority: 80,
          reasoning: 'High priority',
        },
        {
          assetId: 'asset2',
          assetName: 'Asset 2',
          location: 'A',
          currentHp: 2,
          maxHp: 3,
          damageAmount: 1,
          repairCost: 1,
          priority: 40,
          reasoning: 'Low priority',
        },
      ];

      const selected = selectRepairsWithinBudget(repairDecisions, 5);

      expect(selected).toHaveLength(2);
    });

    it('should return empty array when no budget', () => {
      const repairDecisions = [
        {
          assetId: 'asset1',
          assetName: 'Asset 1',
          location: 'A',
          currentHp: 1,
          maxHp: 3,
          damageAmount: 2,
          repairCost: 3,
          priority: 80,
          reasoning: 'High priority',
        },
      ];

      const selected = selectRepairsWithinBudget(repairDecisions, 0);

      expect(selected).toHaveLength(0);
    });
  });

  describe('getEconomyAction', () => {
    it('should recommend repair when critical repairs exist', () => {
      const plan: EconomicPlan = {
        faction: makeFaction('faction1', 'Empire', 'A'),
        availableFacCreds: 10,
        threatLevel: 50,
        repairReserve: 5,
        spendingBudget: 5,
        repairDecisions: [
          {
            assetId: 'asset1',
            assetName: 'Critical Asset',
            location: 'A',
            currentHp: 1,
            maxHp: 10,
            damageAmount: 9,
            repairCost: 3,
            priority: 75, // Critical (>= 50)
            reasoning: 'Near destruction',
          },
        ],
        purchaseRecommendation: null,
        totalRepairCost: 3,
        reasoning: 'Test',
      };

      const action = getEconomyAction(plan);

      expect(action.action).toBe('repair');
      expect(action.details).toContain('Critical Asset');
    });

    it('should recommend purchase when no critical repairs', () => {
      const plan: EconomicPlan = {
        faction: makeFaction('faction1', 'Empire', 'A'),
        availableFacCreds: 10,
        threatLevel: 20,
        repairReserve: 0,
        spendingBudget: 10,
        repairDecisions: [],
        purchaseRecommendation: {
          assetDefinition: {
            id: 'force_1_security_personnel',
            name: 'Security Personnel',
            category: 'Force',
            requiredRating: 1,
            hp: 3,
            cost: 2,
            techLevel: 0,
            type: 'Military Unit',
            attack: null,
            counterattack: null,
            maintenance: 0,
            specialFlags: { hasAction: false, hasSpecial: false, requiresPermission: false },
          },
          location: 'A',
          score: 50,
          baseScore: 30,
          tagSynergyScore: 10,
          goalSynergyScore: 10,
          reasoning: 'Test',
        },
        totalRepairCost: 0,
        reasoning: 'Test',
      };

      const action = getEconomyAction(plan);

      expect(action.action).toBe('purchase');
      expect(action.details).toContain('Security Personnel');
    });

    it('should recommend save when no repairs or purchases available', () => {
      const plan: EconomicPlan = {
        faction: makeFaction('faction1', 'Empire', 'A'),
        availableFacCreds: 1,
        threatLevel: 10,
        repairReserve: 0,
        spendingBudget: 1,
        repairDecisions: [],
        purchaseRecommendation: null,
        totalRepairCost: 0,
        reasoning: 'Test',
      };

      const action = getEconomyAction(plan);

      expect(action.action).toBe('save');
    });
  });
});


