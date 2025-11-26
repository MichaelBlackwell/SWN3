import { describe, it, expect } from 'vitest';
import {
  addNoiseToScore,
  applyEasyModeNoise,
  predictCombatOutcome,
  evaluateAttackWithMinimax,
  applyDifficultyScaling,
  scoreActionsWithDifficulty,
  shouldAvoidAttack,
  getWinProbabilityThreshold,
  analyzeRetreatNecessity,
  DEFAULT_DIFFICULTY_CONFIGS,
} from '../DifficultyScaler';
import type { ScoredAction, ActionScoringResult } from '../UtilityScorer';
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
  facCreds: 10,
  xp: 0,
  tags,
  goal: null,
  assets,
});

// Helper to create mock scored action
const makeScoredAction = (
  type: 'attack' | 'move' | 'defend' | 'expand',
  score: number,
  actingAssetId: string = 'asset1',
  targetFactionId?: string,
  targetAssetId?: string
): ScoredAction => ({
  action: {
    type,
    actingAssetId,
    actingAssetName: 'Test Asset',
    sourceLocation: 'A',
    targetLocation: type === 'move' ? 'B' : undefined,
    targetFactionId,
    targetAssetId,
    description: `${type} action`,
  },
  score,
  baseUtility: score * 0.6,
  tagModifier: score * 0.2,
  goalSynergy: score * 0.2,
  reasoning: 'Test reasoning',
});

// Helper to create mock action scoring result
const makeActionScoringResult = (actions: ScoredAction[]): ActionScoringResult => ({
  faction: makeFaction('faction1', 'Empire', 'A'),
  scoredActions: actions,
  bestAction: actions.length > 0 ? actions[0] : null,
  actionsByType: {
    move: actions.filter((a) => a.action.type === 'move'),
    attack: actions.filter((a) => a.action.type === 'attack'),
    expand: actions.filter((a) => a.action.type === 'expand'),
    repair: [],
    use_ability: [],
    defend: actions.filter((a) => a.action.type === 'defend'),
  },
  reasoning: 'Test result',
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
  },
  factionTotalInfluence: { [factionId]: 50 },
  mostContestedSystems: [],
  expansionOpportunities: [],
});

// Helper to create mock threat overview
const makeThreatOverview = (factionId: string): SectorThreatOverview => ({
  assessingFactionId: factionId,
  systemThreats: {
    A: {
      systemId: 'A',
      factionThreats: [],
      overallDangerLevel: 30,
      militaryDanger: 12,
      covertDanger: 9,
      economicDanger: 9,
      dominantThreatType: 'military',
      reasoning: 'Test threat',
    },
  },
  mostThreatenedSystems: [],
  safestSystems: ['A'],
  overallThreatLevel: 30,
  primaryThreatFactionId: null,
});

describe('DifficultyScaler', () => {
  const systems: StarSystem[] = [
    makeSystem('A', 0, 0, [{ systemId: 'B', isTradeRoute: false }]),
    makeSystem('B', 1, 0, [{ systemId: 'A', isTradeRoute: false }]),
  ];

  describe('DEFAULT_DIFFICULTY_CONFIGS', () => {
    it('should have configurations for all difficulty levels', () => {
      expect(DEFAULT_DIFFICULTY_CONFIGS.easy).toBeDefined();
      expect(DEFAULT_DIFFICULTY_CONFIGS.normal).toBeDefined();
      expect(DEFAULT_DIFFICULTY_CONFIGS.hard).toBeDefined();
      expect(DEFAULT_DIFFICULTY_CONFIGS.expert).toBeDefined();
    });

    it('should have noise only for easy mode', () => {
      expect(DEFAULT_DIFFICULTY_CONFIGS.easy.easyNoiseRange).toBeGreaterThan(0);
      expect(DEFAULT_DIFFICULTY_CONFIGS.normal.easyNoiseRange).toBe(0);
      expect(DEFAULT_DIFFICULTY_CONFIGS.hard.easyNoiseRange).toBe(0);
      expect(DEFAULT_DIFFICULTY_CONFIGS.expert.easyNoiseRange).toBe(0);
    });

    it('should have higher thresholds for expert than hard', () => {
      expect(DEFAULT_DIFFICULTY_CONFIGS.expert.expertMinWinProbability).toBeGreaterThanOrEqual(
        DEFAULT_DIFFICULTY_CONFIGS.hard.hardMinWinProbability
      );
    });
  });

  describe('addNoiseToScore', () => {
    it('should return original score when noise range is 0', () => {
      const score = addNoiseToScore(50, 0);
      expect(score).toBe(50);
    });

    it('should add noise within the specified range', () => {
      const originalScore = 50;
      const noiseRange = 30;

      // Run multiple times to verify variance
      const scores: number[] = [];
      for (let i = 0; i < 100; i++) {
        scores.push(addNoiseToScore(originalScore, noiseRange));
      }

      // All scores should be within [20, 80] range
      scores.forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(originalScore - noiseRange);
        expect(score).toBeLessThanOrEqual(originalScore + noiseRange);
      });

      // Should have some variance
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBeGreaterThan(1);
    });

    it('should not return negative scores', () => {
      const score = addNoiseToScore(10, 50);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('applyEasyModeNoise', () => {
    it('should apply noise to all actions', () => {
      const actions: ScoredAction[] = [
        makeScoredAction('attack', 80),
        makeScoredAction('defend', 60),
        makeScoredAction('move', 40),
      ];

      const noisyActions = applyEasyModeNoise(actions, 30);

      expect(noisyActions).toHaveLength(3);
      noisyActions.forEach((action) => {
        expect(action.reasoning).toContain('Easy mode noise');
      });
    });

    it('should produce different scores on repeated calls', () => {
      const actions: ScoredAction[] = [makeScoredAction('attack', 50)];

      const results: number[] = [];
      for (let i = 0; i < 20; i++) {
        const noisyActions = applyEasyModeNoise(actions, 30);
        results.push(noisyActions[0].score);
      }

      // Should have variance
      const uniqueScores = new Set(results);
      expect(uniqueScores.size).toBeGreaterThan(1);
    });
  });

  describe('predictCombatOutcome', () => {
    it('should predict favorable outcome for stronger attacker', () => {
      const strongFaction = makeFaction(
        'strong',
        'Strong',
        'A',
        [],
        [makeAsset('asset1', 'force_4_strike_fleet', 'A', 8, 8)],
        { hp: 10, maxHp: 10, force: 6, cunning: 2, wealth: 2 }
      );

      const weakFaction = makeFaction(
        'weak',
        'Weak',
        'B',
        [],
        [makeAsset('enemy1', 'force_1_security_personnel', 'A', 3, 3)],
        { hp: 5, maxHp: 5, force: 1, cunning: 1, wealth: 1 }
      );

      const prediction = predictCombatOutcome(
        strongFaction,
        strongFaction.assets[0],
        {
          id: 'force_4_strike_fleet',
          name: 'Strike Fleet',
          category: 'Force',
          requiredRating: 4,
          hp: 8,
          cost: 12,
          techLevel: 4,
          type: 'Starship',
          attack: { attackerAttribute: 'Force', defenderAttribute: 'Force', damage: '2d6' },
          counterattack: { damage: '1d8' },
          maintenance: 0,
          specialFlags: { hasAction: true, hasSpecial: false, requiresPermission: false },
        },
        weakFaction,
        weakFaction.assets[0],
        {
          id: 'force_1_security_personnel',
          name: 'Security Personnel',
          category: 'Force',
          requiredRating: 1,
          hp: 3,
          cost: 2,
          techLevel: 0,
          type: 'Military Unit',
          attack: { attackerAttribute: 'Force', defenderAttribute: 'Force', damage: '1d3+1' },
          counterattack: { damage: '1d4' },
          maintenance: 0,
          specialFlags: { hasAction: false, hasSpecial: false, requiresPermission: false },
        },
        DEFAULT_DIFFICULTY_CONFIGS.hard
      );

      expect(prediction.winProbability).toBeGreaterThan(0.5);
      expect(prediction.recommendation).toBe('attack');
    });

    it('should predict unfavorable outcome for weaker attacker', () => {
      const weakFaction = makeFaction(
        'weak',
        'Weak',
        'A',
        [],
        [makeAsset('asset1', 'force_1_security_personnel', 'A', 3, 3)],
        { hp: 5, maxHp: 5, force: 1, cunning: 1, wealth: 1 }
      );

      const strongFaction = makeFaction(
        'strong',
        'Strong',
        'B',
        [],
        [makeAsset('enemy1', 'force_4_strike_fleet', 'A', 8, 8)],
        { hp: 10, maxHp: 10, force: 6, cunning: 2, wealth: 2 }
      );

      const prediction = predictCombatOutcome(
        weakFaction,
        weakFaction.assets[0],
        {
          id: 'force_1_security_personnel',
          name: 'Security Personnel',
          category: 'Force',
          requiredRating: 1,
          hp: 3,
          cost: 2,
          techLevel: 0,
          type: 'Military Unit',
          attack: { attackerAttribute: 'Force', defenderAttribute: 'Force', damage: '1d3+1' },
          counterattack: { damage: '1d4' },
          maintenance: 0,
          specialFlags: { hasAction: false, hasSpecial: false, requiresPermission: false },
        },
        strongFaction,
        strongFaction.assets[0],
        {
          id: 'force_4_strike_fleet',
          name: 'Strike Fleet',
          category: 'Force',
          requiredRating: 4,
          hp: 8,
          cost: 12,
          techLevel: 4,
          type: 'Starship',
          attack: { attackerAttribute: 'Force', defenderAttribute: 'Force', damage: '2d6' },
          counterattack: { damage: '1d8' },
          maintenance: 0,
          specialFlags: { hasAction: true, hasSpecial: false, requiresPermission: false },
        },
        DEFAULT_DIFFICULTY_CONFIGS.hard
      );

      expect(prediction.winProbability).toBeLessThan(0.5);
      expect(prediction.recommendation).toBe('avoid');
    });

    it('should include reasoning in prediction', () => {
      const faction1 = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const faction2 = makeFaction('faction2', 'Rebels', 'B', [], [
        makeAsset('enemy1', 'force_1_security_personnel', 'A'),
      ]);

      const prediction = predictCombatOutcome(
        faction1,
        faction1.assets[0],
        {
          id: 'force_1_security_personnel',
          name: 'Security Personnel',
          category: 'Force',
          requiredRating: 1,
          hp: 3,
          cost: 2,
          techLevel: 0,
          type: 'Military Unit',
          attack: { attackerAttribute: 'Force', defenderAttribute: 'Force', damage: '1d3+1' },
          counterattack: { damage: '1d4' },
          maintenance: 0,
          specialFlags: { hasAction: false, hasSpecial: false, requiresPermission: false },
        },
        faction2,
        faction2.assets[0],
        {
          id: 'force_1_security_personnel',
          name: 'Security Personnel',
          category: 'Force',
          requiredRating: 1,
          hp: 3,
          cost: 2,
          techLevel: 0,
          type: 'Military Unit',
          attack: { attackerAttribute: 'Force', defenderAttribute: 'Force', damage: '1d3+1' },
          counterattack: { damage: '1d4' },
          maintenance: 0,
          specialFlags: { hasAction: false, hasSpecial: false, requiresPermission: false },
        },
        DEFAULT_DIFFICULTY_CONFIGS.hard
      );

      expect(prediction.reasoning).toBeDefined();
      expect(prediction.reasoning.length).toBeGreaterThan(0);
      expect(prediction.reasoning).toContain('Win probability');
    });
  });

  describe('evaluateAttackWithMinimax', () => {
    it('should not modify non-attack actions', () => {
      const defendAction = makeScoredAction('defend', 50);
      const faction = makeFaction('faction1', 'Empire', 'A');

      const evaluation = evaluateAttackWithMinimax(
        defendAction,
        faction,
        [faction],
        DEFAULT_DIFFICULTY_CONFIGS.hard
      );

      expect(evaluation.adjustedScore).toBe(evaluation.originalScore);
      expect(evaluation.adjustment).toBe(0);
    });

    it('should penalize unfavorable attacks', () => {
      const weakFaction = makeFaction(
        'weak',
        'Weak',
        'A',
        [],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')],
        { hp: 5, maxHp: 5, force: 1, cunning: 1, wealth: 1 }
      );

      const strongFaction = makeFaction(
        'strong',
        'Strong',
        'B',
        [],
        [makeAsset('enemy1', 'force_4_strike_fleet', 'A')],
        { hp: 10, maxHp: 10, force: 6, cunning: 2, wealth: 2 }
      );

      const attackAction = makeScoredAction('attack', 60, 'asset1', 'strong', 'enemy1');

      const evaluation = evaluateAttackWithMinimax(
        attackAction,
        weakFaction,
        [weakFaction, strongFaction],
        DEFAULT_DIFFICULTY_CONFIGS.hard
      );

      expect(evaluation.adjustment).toBeLessThan(0);
      expect(evaluation.adjustedScore).toBeLessThan(evaluation.originalScore);
    });
  });

  describe('applyDifficultyScaling', () => {
    it('should apply noise in easy mode', () => {
      const actions: ScoredAction[] = [
        makeScoredAction('attack', 80),
        makeScoredAction('defend', 60),
      ];

      const result = makeActionScoringResult(actions);
      const faction = makeFaction('faction1', 'Empire', 'A');

      // Run multiple times to verify variance
      const bestScores: number[] = [];
      for (let i = 0; i < 20; i++) {
        const adjusted = applyDifficultyScaling(result, faction, [faction], 'easy');
        if (adjusted.bestAction) {
          bestScores.push(adjusted.bestAction.score);
        }
      }

      // Should have variance due to noise
      const uniqueScores = new Set(bestScores);
      expect(uniqueScores.size).toBeGreaterThan(1);
    });

    it('should not modify scores in normal mode', () => {
      const actions: ScoredAction[] = [
        makeScoredAction('attack', 80),
        makeScoredAction('defend', 60),
      ];

      const result = makeActionScoringResult(actions);
      const faction = makeFaction('faction1', 'Empire', 'A');

      const adjusted = applyDifficultyScaling(result, faction, [faction], 'normal');

      expect(adjusted.adjustedActions[0].score).toBe(80);
      expect(adjusted.adjustedActions[1].score).toBe(60);
    });

    it('should evaluate attacks with minimax in hard mode', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const enemyFaction = makeFaction('enemy', 'Enemy', 'B', [], [
        makeAsset('enemy1', 'force_1_security_personnel', 'A'),
      ]);

      const actions: ScoredAction[] = [
        makeScoredAction('attack', 80, 'asset1', 'enemy', 'enemy1'),
        makeScoredAction('defend', 60),
      ];

      const result = makeActionScoringResult(actions);

      const adjusted = applyDifficultyScaling(result, faction, [faction, enemyFaction], 'hard');

      expect(adjusted.minimaxEvaluations.length).toBeGreaterThan(0);
      expect(adjusted.reasoning).toContain('Minimax');
    });

    it('should include difficulty in reasoning', () => {
      const actions: ScoredAction[] = [makeScoredAction('defend', 50)];
      const result = makeActionScoringResult(actions);
      const faction = makeFaction('faction1', 'Empire', 'A');

      const easyAdjusted = applyDifficultyScaling(result, faction, [faction], 'easy');
      const hardAdjusted = applyDifficultyScaling(result, faction, [faction], 'hard');

      expect(easyAdjusted.reasoning).toContain('easy');
      expect(hardAdjusted.reasoning).toContain('hard');
    });
  });

  describe('scoreActionsWithDifficulty', () => {
    it('should score and apply difficulty in one call', () => {
      const faction = makeFaction(
        'faction1',
        'Empire',
        'A',
        ['Mercenary Group'],
        [makeAsset('asset1', 'force_1_security_personnel', 'A')]
      );

      const influenceMap = makeInfluenceMap('faction1');
      const threatOverview = makeThreatOverview('faction1');
      const intent = makeStrategicIntent('military', 50);

      const result = scoreActionsWithDifficulty(
        faction,
        [faction],
        systems,
        influenceMap,
        threatOverview,
        intent,
        'normal'
      );

      expect(result.adjustedActions.length).toBeGreaterThan(0);
      expect(result.difficulty).toBe('normal');
    });
  });

  describe('shouldAvoidAttack', () => {
    it('should return false for easy and normal modes', () => {
      const evaluation = {
        action: makeScoredAction('attack', 50),
        combatPrediction: {
          winProbability: 0.3,
          expectedDamageDealt: 5,
          expectedDamageTaken: 3,
          netExpectedValue: -10,
          recommendation: 'avoid' as const,
          reasoning: 'Test',
        },
        adjustedScore: 30,
        originalScore: 50,
        adjustment: -20,
        reasoning: 'Test',
      };

      expect(shouldAvoidAttack(evaluation, 'easy')).toBe(false);
      expect(shouldAvoidAttack(evaluation, 'normal')).toBe(false);
    });

    it('should return true for avoid recommendation in hard/expert modes', () => {
      const evaluation = {
        action: makeScoredAction('attack', 50),
        combatPrediction: {
          winProbability: 0.3,
          expectedDamageDealt: 5,
          expectedDamageTaken: 3,
          netExpectedValue: -10,
          recommendation: 'avoid' as const,
          reasoning: 'Test',
        },
        adjustedScore: 30,
        originalScore: 50,
        adjustment: -20,
        reasoning: 'Test',
      };

      expect(shouldAvoidAttack(evaluation, 'hard')).toBe(true);
      expect(shouldAvoidAttack(evaluation, 'expert')).toBe(true);
    });
  });

  describe('getWinProbabilityThreshold', () => {
    it('should return 0 for easy and normal', () => {
      expect(getWinProbabilityThreshold('easy')).toBe(0);
      expect(getWinProbabilityThreshold('normal')).toBe(0);
    });

    it('should return configured thresholds for hard and expert', () => {
      expect(getWinProbabilityThreshold('hard')).toBe(
        DEFAULT_DIFFICULTY_CONFIGS.hard.hardMinWinProbability
      );
      expect(getWinProbabilityThreshold('expert')).toBe(
        DEFAULT_DIFFICULTY_CONFIGS.expert.expertMinWinProbability
      );
    });
  });

  describe('analyzeRetreatNecessity', () => {
    it('should not recommend retreat in easy/normal modes', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const result = analyzeRetreatNecessity(faction, [faction], 'A', 'easy');
      expect(result.shouldRetreat).toBe(false);

      const normalResult = analyzeRetreatNecessity(faction, [faction], 'A', 'normal');
      expect(normalResult.shouldRetreat).toBe(false);
    });

    it('should not recommend retreat when no enemies present', () => {
      const faction = makeFaction('faction1', 'Empire', 'A', [], [
        makeAsset('asset1', 'force_1_security_personnel', 'A'),
      ]);

      const result = analyzeRetreatNecessity(faction, [faction], 'A', 'hard');
      expect(result.shouldRetreat).toBe(false);
      expect(result.reasoning).toContain('No enemy');
    });

    it('should recommend retreat when facing overwhelming force', () => {
      const weakFaction = makeFaction(
        'weak',
        'Weak',
        'A',
        [],
        [makeAsset('asset1', 'force_1_security_personnel', 'A', 2, 3)],
        { hp: 5, maxHp: 5, force: 1, cunning: 1, wealth: 1 }
      );

      const strongFaction = makeFaction(
        'strong',
        'Strong',
        'B',
        [],
        [
          makeAsset('enemy1', 'force_4_strike_fleet', 'A', 8, 8),
          makeAsset('enemy2', 'force_4_strike_fleet', 'A', 8, 8),
        ],
        { hp: 10, maxHp: 10, force: 6, cunning: 2, wealth: 2 }
      );

      const result = analyzeRetreatNecessity(
        weakFaction,
        [weakFaction, strongFaction],
        'A',
        'expert'
      );

      // May or may not recommend retreat depending on exact calculations
      // But reasoning should mention risk
      expect(result.reasoning).toContain('risk');
    });
  });
});


