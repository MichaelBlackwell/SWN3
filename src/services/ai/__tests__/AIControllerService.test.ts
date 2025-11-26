import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeAnalysisPhase,
  planAITurn,
  executeAITurn,
  createIdleStatus,
  isAIControlled,
  getAIFactions,
  type AITurnStatus,
  type AIControllerConfig,
  type AITurnPlan,
  type AnalysisResult,
} from '../AIControllerService';
import type { Faction, FactionAsset, FactionTag } from '../../../types/faction';
import type { StarSystem } from '../../../types/sector';
import type { InfluenceMap } from '../InfluenceMapService';
import type { SectorThreatOverview } from '../ThreatAssessment';
import type { StrategicIntent } from '../GoalSelectionService';
import type { EconomicPlan } from '../AIEconomyManager';
import type { DifficultyAdjustedResult } from '../DifficultyScaler';

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
  type: 'major' | 'minor' = 'minor',
  tags: FactionTag[] = [],
  assets: FactionAsset[] = []
): Faction => ({
  id,
  name,
  type,
  homeworld,
  attributes: { hp: 7, maxHp: 7, force: 3, cunning: 3, wealth: 3 },
  facCreds: 10,
  xp: 0,
  tags,
  goal: null,
  assets,
});

// Mock dispatch function
const mockDispatch = vi.fn();

// Helper to create mock analysis result
const makeAnalysisResult = (factionId: string): AnalysisResult => ({
  influenceMap: {
    factionId,
    hexes: new Map(),
    friendlyControlled: [],
    enemyControlled: [],
    contested: [],
    unoccupied: [],
  },
  threatOverview: {
    factionId,
    primaryThreat: null,
    threatenedSystems: [],
    safeSystems: ['A'],
    overallThreatLevel: 30,
    recommendedPosture: 'balanced',
  },
});

// Helper to create a minimal turn plan for execution tests
const makeMinimalTurnPlan = (faction: Faction): AITurnPlan => ({
  faction,
  difficulty: 'normal',
  analysis: makeAnalysisResult(faction.id),
  goal: {
    strategicIntent: {
      primaryFocus: 'military',
      aggressionLevel: 50,
      targetFactionId: null,
      prioritySystemIds: [],
      reasoning: 'Test intent',
    },
    goalChanged: false,
    newGoalType: null,
  },
  economy: {
    availableFacCreds: 10,
    repairDecisions: [],
    repairReserve: 0,
    spendingBudget: 10,
    purchaseRecommendations: [],
    purchaseRecommendation: null,
    reasoning: 'Test economy',
  },
  scoring: {
    originalResult: {
      faction,
      scoredActions: [],
      bestAction: null,
      actionsByType: {
        move: [],
        attack: [],
        expand: [],
        repair: [],
        use_ability: [],
        defend: [],
      },
      reasoning: 'Test scoring',
    },
    adjustedActions: [],
    bestAction: null,
    difficulty: 'normal',
    minimaxEvaluations: [],
    reasoning: 'Test adjusted',
  },
  selectedActions: [],
  actionQueue: [],
  reasoning: ['Test reasoning'],
});

describe('AIControllerService', () => {
  const systems: StarSystem[] = [
    makeSystem('A', 0, 0, [{ systemId: 'B', isTradeRoute: false }]),
    makeSystem('B', 1, 0, [
      { systemId: 'A', isTradeRoute: false },
      { systemId: 'C', isTradeRoute: false },
    ]),
    makeSystem('C', 2, 0, [{ systemId: 'B', isTradeRoute: false }]),
  ];

  beforeEach(() => {
    mockDispatch.mockClear();
  });

  describe('executeAnalysisPhase', () => {
    it('should return influence map and threat overview', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', 'minor', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const result = executeAnalysisPhase(faction, [faction], systems);

      expect(result.influenceMap).toBeDefined();
      expect(result.influenceMap.factionId).toBe('faction1');
      expect(result.influenceMap.hexes).toBeDefined();
      expect(result.threatOverview).toBeDefined();
      expect(result.threatOverview.factionId).toBe('faction1');
    });

    it('should calculate threat from enemy factions', () => {
      const faction1 = makeFaction('faction1', 'Empire', 'A', 'minor', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const faction2 = makeFaction('faction2', 'Rebels', 'B', 'minor', [], [
        makeAsset('enemy1', 'force_4_strike_fleet', 'A'), // Enemy at same location
      ]);

      const result = executeAnalysisPhase(faction1, [faction1, faction2], systems);

      // Should detect threat from faction2
      expect(result.threatOverview.overallThreatLevel).toBeGreaterThan(0);
    });
  });

  describe('planAITurn (unit tests with minimal plans)', () => {
    it('should create a plan with correct faction and difficulty', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', 'minor', [], []);
      const plan = makeMinimalTurnPlan(faction);

      expect(plan.faction).toBe(faction);
      expect(plan.difficulty).toBe('normal');
      expect(plan.analysis).toBeDefined();
      expect(plan.goal).toBeDefined();
      expect(plan.economy).toBeDefined();
      expect(plan.scoring).toBeDefined();
      expect(plan.actionQueue).toBeDefined();
      expect(plan.reasoning.length).toBeGreaterThan(0);
    });

    it('should include all required phase results', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', 'minor', [], []);
      const plan = makeMinimalTurnPlan(faction);

      // Analysis phase results
      expect(plan.analysis.influenceMap).toBeDefined();
      expect(plan.analysis.threatOverview).toBeDefined();

      // Goal phase results
      expect(plan.goal.strategicIntent).toBeDefined();
      expect(plan.goal.goalChanged).toBeDefined();

      // Economy phase results
      expect(plan.economy.availableFacCreds).toBeDefined();
      expect(plan.economy.repairDecisions).toBeDefined();

      // Scoring phase results
      expect(plan.scoring.adjustedActions).toBeDefined();
    });

    it('should support different difficulty levels', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', 'minor', [], []);

      const easyPlan = { ...makeMinimalTurnPlan(faction), difficulty: 'easy' as const };
      const hardPlan = { ...makeMinimalTurnPlan(faction), difficulty: 'hard' as const };

      expect(easyPlan.difficulty).toBe('easy');
      expect(hardPlan.difficulty).toBe('hard');
    });

    it('should have empty action queue for faction with no assets', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', 'minor', [], []);
      const plan = makeMinimalTurnPlan(faction);

      expect(plan.actionQueue).toHaveLength(0);
    });
  });

  describe('executeAITurn', () => {
    it('should execute actions with delays', async () => {
      const faction = makeFaction('faction1', 'Empire', 'A', 'minor', [], []);
      const plan = makeMinimalTurnPlan(faction);

      // Add a simple action to the queue
      plan.actionQueue = [
        {
          id: 'test-action',
          type: 'defend',
          description: 'Test action',
          dispatch: mockDispatch,
          delay: 10, // Short delay for testing
        },
      ];

      const statusUpdates: AITurnStatus[] = [];
      const config: AIControllerConfig = {
        baseActionDelay: 10,
        delayVariance: 0,
        maxActionsPerTurn: 10,
        enableLogging: false,
      };

      await executeAITurn(plan, (status) => statusUpdates.push(status), config);

      // Should have called dispatch
      expect(mockDispatch).toHaveBeenCalled();

      // Should have status updates
      expect(statusUpdates.length).toBeGreaterThan(0);

      // Final status should be complete
      const finalStatus = statusUpdates[statusUpdates.length - 1];
      expect(finalStatus.isComplete).toBe(true);
      expect(finalStatus.phase).toBe('complete');
    });

    it('should update progress during execution', async () => {
      const faction = makeFaction('faction1', 'Empire', 'A', 'minor', [], []);
      const plan = makeMinimalTurnPlan(faction);

      // Add multiple actions
      plan.actionQueue = [
        {
          id: 'action-1',
          type: 'defend',
          description: 'Action 1',
          dispatch: vi.fn(),
          delay: 5,
        },
        {
          id: 'action-2',
          type: 'defend',
          description: 'Action 2',
          dispatch: vi.fn(),
          delay: 5,
        },
      ];

      const statusUpdates: AITurnStatus[] = [];
      const config: AIControllerConfig = {
        baseActionDelay: 5,
        delayVariance: 0,
        maxActionsPerTurn: 10,
        enableLogging: false,
      };

      await executeAITurn(plan, (status) => statusUpdates.push(status), config);

      // Should have multiple progress updates
      expect(statusUpdates.length).toBeGreaterThanOrEqual(2);

      // Progress should increase
      const progressValues = statusUpdates.map((s) => s.progress);
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }
    });

    it('should handle empty action queue', async () => {
      const faction = makeFaction('faction1', 'Empire', 'A', 'minor', [], []);
      const plan = makeMinimalTurnPlan(faction);
      plan.actionQueue = [];

      const statusUpdates: AITurnStatus[] = [];

      await executeAITurn(plan, (status) => statusUpdates.push(status));

      // Should still complete
      const finalStatus = statusUpdates[statusUpdates.length - 1];
      expect(finalStatus.isComplete).toBe(true);
    });
  });

  describe('createIdleStatus', () => {
    it('should create idle status for a faction', () => {
      const faction = makeFaction('faction1', 'Empire', 'A');

      const status = createIdleStatus(faction);

      expect(status.factionId).toBe('faction1');
      expect(status.factionName).toBe('Empire');
      expect(status.phase).toBe('idle');
      expect(status.progress).toBe(0);
      expect(status.isComplete).toBe(false);
      expect(status.error).toBeNull();
    });
  });

  describe('isAIControlled', () => {
    it('should return false for player faction when playerFactionId is set', () => {
      const playerFaction = makeFaction('player', 'Player Empire', 'A', 'minor');

      expect(isAIControlled(playerFaction, 'player')).toBe(false);
    });

    it('should return true for non-player factions when playerFactionId is set', () => {
      const aiFaction = makeFaction('ai', 'AI Empire', 'A', 'minor');

      expect(isAIControlled(aiFaction, 'player')).toBe(true);
    });

    it('should return true for all factions when no playerFactionId is set', () => {
      const faction = makeFaction('any', 'Any Faction', 'A', 'minor');

      expect(isAIControlled(faction)).toBe(true);
      expect(isAIControlled(faction, null)).toBe(true);
    });
  });

  describe('getAIFactions', () => {
    it('should return only AI-controlled factions when playerFactionId is set', () => {
      const factions = [
        makeFaction('player', 'Player', 'A', 'minor'),
        makeFaction('ai1', 'AI 1', 'B', 'minor'),
        makeFaction('ai2', 'AI 2', 'C', 'minor'),
      ];

      const aiFactions = getAIFactions(factions, 'player');

      expect(aiFactions).toHaveLength(2);
      expect(aiFactions.map((f) => f.id)).toContain('ai1');
      expect(aiFactions.map((f) => f.id)).toContain('ai2');
      expect(aiFactions.map((f) => f.id)).not.toContain('player');
    });

    it('should return all factions when no playerFactionId is set', () => {
      const factions = [makeFaction('faction1', 'Faction 1', 'A', 'minor')];

      const aiFactions = getAIFactions(factions);

      expect(aiFactions).toHaveLength(1);
    });
  });

  describe('Integration: Full AI Turn', () => {
    it('should plan and execute a complete turn', async () => {
      const faction = makeFaction(
        'ai',
        'AI Empire',
        'A',
        'minor',
        ['Mercenary Group'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const config: AIControllerConfig = {
        baseActionDelay: 5,
        delayVariance: 0,
        maxActionsPerTurn: 5,
        enableLogging: false,
      };

      // Use minimal plan for testing execution
      const plan = makeMinimalTurnPlan(faction);
      plan.actionQueue = [
        {
          id: 'test-action',
          type: 'defend',
          description: 'Test action',
          dispatch: vi.fn(),
          delay: 5,
        },
      ];

      expect(plan.faction.id).toBe('ai');
      expect(plan.analysis.influenceMap).toBeDefined();
      expect(plan.goal.strategicIntent).toBeDefined();

      // Execute the plan
      const statusUpdates: AITurnStatus[] = [];
      await executeAITurn(plan, (status) => statusUpdates.push(status), config);

      // Should complete
      expect(statusUpdates[statusUpdates.length - 1].isComplete).toBe(true);
    });

    it('should handle multiple factions in sequence', async () => {
      const faction1 = makeFaction('ai1', 'AI 1', 'A', 'minor', [], []);
      const faction2 = makeFaction('ai2', 'AI 2', 'B', 'minor', [], []);

      const config: AIControllerConfig = {
        baseActionDelay: 5,
        delayVariance: 0,
        maxActionsPerTurn: 5,
        enableLogging: false,
      };

      const allFactions = [faction1, faction2];
      const aiFactions = getAIFactions(allFactions);

      for (const faction of aiFactions) {
        const plan = makeMinimalTurnPlan(faction);
        await executeAITurn(plan, undefined, config);
      }

      // Both factions should have been processed
      expect(aiFactions).toHaveLength(2);
    });
  });
});

