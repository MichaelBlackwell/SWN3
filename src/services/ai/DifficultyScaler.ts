/**
 * DifficultyScaler - Difficulty Modifiers & Minimax Combat Solver
 *
 * This service extends the scoring engine to handle difficulty settings:
 * - Easy: Inject random noise into scores for sub-optimal play
 * - Normal: Standard utility scoring
 * - Hard/Expert: Minimax look-ahead for combat decisions
 *
 * The Minimax solver uses Task 8 combat math to predict win/loss
 * probabilities before committing to attacks.
 */

import type { Faction, FactionAsset } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import type { AssetDefinition } from '../../types/asset';
import { getAssetById } from '../../data/assetLibrary';
import {
  calculateAttackOdds,
  calculateExpectedDamage,
  calculateExpectedCounterattackDamage,
} from '../../utils/combatResolver';
import type { ScoredAction, ActionScoringResult, ScorerConfig } from './UtilityScorer';
import { scoreAllActions } from './UtilityScorer';
import type { InfluenceMap } from './InfluenceMapService';
import type { SectorThreatOverview } from './ThreatAssessment';
import type { StrategicIntent } from './GoalSelectionService';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * AI difficulty levels
 */
export type DifficultyLevel = 'easy' | 'normal' | 'medium' | 'hard' | 'expert';

/**
 * Configuration for difficulty scaling
 */
export interface DifficultyConfig {
  level: DifficultyLevel;
  /** Noise range for Easy mode (±this value added to scores) */
  easyNoiseRange: number;
  /** Minimum win probability to consider attack in Hard mode */
  hardMinWinProbability: number;
  /** Minimum win probability to consider attack in Expert mode */
  expertMinWinProbability: number;
  /** Look-ahead depth for minimax (1 = immediate, 2 = one turn ahead) */
  minimaxDepth: number;
  /** Weight for expected damage in minimax evaluation */
  damageWeight: number;
  /** Weight for survival probability in minimax evaluation */
  survivalWeight: number;
}

/**
 * Combat prediction result
 */
export interface CombatPrediction {
  winProbability: number;
  expectedDamageDealt: number;
  expectedDamageTaken: number;
  netExpectedValue: number; // Positive = favorable, negative = unfavorable
  recommendation: 'attack' | 'avoid' | 'risky';
  reasoning: string;
}

/**
 * Minimax evaluation result for a combat action
 */
export interface MinimaxEvaluation {
  action: ScoredAction;
  combatPrediction: CombatPrediction;
  adjustedScore: number;
  originalScore: number;
  adjustment: number;
  reasoning: string;
}

/**
 * Result of difficulty-adjusted scoring
 */
export interface DifficultyAdjustedResult {
  originalResult: ActionScoringResult;
  adjustedActions: ScoredAction[];
  bestAction: ScoredAction | null;
  difficulty: DifficultyLevel;
  minimaxEvaluations: MinimaxEvaluation[];
  reasoning: string;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const DEFAULT_DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    level: 'easy',
    easyNoiseRange: 30, // ±30 points of noise
    hardMinWinProbability: 0, // Not used
    expertMinWinProbability: 0, // Not used
    minimaxDepth: 0, // No look-ahead
    damageWeight: 1.0,
    survivalWeight: 1.0,
  },
  normal: {
    level: 'normal',
    easyNoiseRange: 0,
    hardMinWinProbability: 0, // Not used
    expertMinWinProbability: 0, // Not used
    minimaxDepth: 0, // No look-ahead
    damageWeight: 1.0,
    survivalWeight: 1.0,
  },
  medium: {
    level: 'medium',
    easyNoiseRange: 0,
    hardMinWinProbability: 0, // Not used
    expertMinWinProbability: 0, // Not used
    minimaxDepth: 0, // No look-ahead
    damageWeight: 1.0,
    survivalWeight: 1.0,
  },
  hard: {
    level: 'hard',
    easyNoiseRange: 0,
    hardMinWinProbability: 0.4, // Avoid attacks below 40% win chance
    expertMinWinProbability: 0,
    minimaxDepth: 1,
    damageWeight: 1.2,
    survivalWeight: 1.5, // Prioritize survival
  },
  expert: {
    level: 'expert',
    easyNoiseRange: 0,
    hardMinWinProbability: 0,
    expertMinWinProbability: 0.5, // Avoid attacks below 50% win chance
    minimaxDepth: 2,
    damageWeight: 1.5,
    survivalWeight: 2.0, // Strongly prioritize survival
  },
};

// ============================================================================
// NOISE INJECTION (Easy Mode)
// ============================================================================

/**
 * Add random noise to a score for Easy mode
 */
export function addNoiseToScore(score: number, noiseRange: number): number {
  if (noiseRange <= 0) return score;

  // Generate random noise in range [-noiseRange, +noiseRange]
  const noise = (Math.random() * 2 - 1) * noiseRange;
  return Math.max(0, score + noise);
}

/**
 * Apply noise to all scored actions for Easy mode
 */
export function applyEasyModeNoise(
  actions: ScoredAction[],
  noiseRange: number
): ScoredAction[] {
  return actions.map((action) => ({
    ...action,
    score: addNoiseToScore(action.score, noiseRange),
    reasoning: `${action.reasoning} [Easy mode noise applied]`,
  }));
}

// ============================================================================
// COMBAT PREDICTION (Hard/Expert Mode)
// ============================================================================

/**
 * Predict the outcome of a combat action using Task 8 math
 */
export function predictCombatOutcome(
  attackingFaction: Faction,
  attackingAsset: FactionAsset,
  attackingDef: AssetDefinition,
  targetFaction: Faction,
  _targetAsset: FactionAsset,
  targetDef: AssetDefinition,
  config: DifficultyConfig
): CombatPrediction {
  const reasons: string[] = [];

  // Get attack pattern
  const attackPattern = attackingDef.attack;
  if (!attackPattern) {
    return {
      winProbability: 0,
      expectedDamageDealt: 0,
      expectedDamageTaken: 0,
      netExpectedValue: -100,
      recommendation: 'avoid',
      reasoning: 'Asset cannot attack',
    };
  }

  // Get attribute values
  const attackerAttrValue =
    attackPattern.attackerAttribute === 'Force'
      ? attackingFaction.attributes.force
      : attackPattern.attackerAttribute === 'Cunning'
        ? attackingFaction.attributes.cunning
        : attackingFaction.attributes.wealth;

  const defenderAttrValue =
    attackPattern.defenderAttribute === 'Force'
      ? targetFaction.attributes.force
      : attackPattern.defenderAttribute === 'Cunning'
        ? targetFaction.attributes.cunning
        : targetFaction.attributes.wealth;

  // Calculate win probability
  const winProbability = calculateAttackOdds(
    attackPattern.attackerAttribute,
    attackerAttrValue,
    attackPattern.defenderAttribute,
    defenderAttrValue
  );

  reasons.push(`Win probability: ${(winProbability * 100).toFixed(0)}%`);

  // Calculate expected damage dealt
  const expectedDamageDealt = calculateExpectedDamage(attackPattern.damage);
  reasons.push(`Expected damage dealt: ${expectedDamageDealt.toFixed(1)}`);

  // Calculate expected damage taken (from counterattack)
  const counterattackPattern = targetDef.counterattack;
  const expectedDamageTaken = counterattackPattern
    ? calculateExpectedCounterattackDamage(counterattackPattern) * (1 - winProbability)
    : 0;

  if (expectedDamageTaken > 0) {
    reasons.push(`Expected damage taken: ${expectedDamageTaken.toFixed(1)}`);
  }

  // Calculate net expected value
  // Positive = we expect to deal more damage than we take
  const damageValue = expectedDamageDealt * winProbability * config.damageWeight;
  const survivalCost = expectedDamageTaken * config.survivalWeight;

  // Also consider if we might die
  const deathRisk = expectedDamageTaken >= attackingAsset.hp ? (1 - winProbability) : 0;
  const deathPenalty = deathRisk * attackingDef.cost * 5; // Heavy penalty for losing expensive assets

  const netExpectedValue = damageValue - survivalCost - deathPenalty;

  // Determine recommendation
  let recommendation: CombatPrediction['recommendation'];
  const minWinProb =
    config.level === 'expert'
      ? config.expertMinWinProbability
      : config.hardMinWinProbability;

  if (winProbability < minWinProb) {
    recommendation = 'avoid';
    reasons.push(`Below ${(minWinProb * 100).toFixed(0)}% threshold`);
  } else if (netExpectedValue < -10) {
    recommendation = 'risky';
    reasons.push('Unfavorable expected outcome');
  } else {
    recommendation = 'attack';
    reasons.push('Favorable expected outcome');
  }

  return {
    winProbability,
    expectedDamageDealt,
    expectedDamageTaken,
    netExpectedValue,
    recommendation,
    reasoning: reasons.join('. '),
  };
}

/**
 * Evaluate an attack action using minimax-style look-ahead
 */
export function evaluateAttackWithMinimax(
  action: ScoredAction,
  faction: Faction,
  allFactions: Faction[],
  config: DifficultyConfig
): MinimaxEvaluation {
  // Only evaluate attack actions
  if (action.action.type !== 'attack') {
    return {
      action,
      combatPrediction: {
        winProbability: 1,
        expectedDamageDealt: 0,
        expectedDamageTaken: 0,
        netExpectedValue: 0,
        recommendation: 'attack',
        reasoning: 'Non-combat action',
      },
      adjustedScore: action.score,
      originalScore: action.score,
      adjustment: 0,
      reasoning: 'Non-combat action - no adjustment',
    };
  }

  // Get attacking asset
  const attackingAsset = faction.assets.find((a) => a.id === action.action.actingAssetId);
  const attackingDef = attackingAsset ? getAssetById(attackingAsset.definitionId) : null;

  if (!attackingAsset || !attackingDef) {
    return {
      action,
      combatPrediction: {
        winProbability: 0,
        expectedDamageDealt: 0,
        expectedDamageTaken: 0,
        netExpectedValue: -100,
        recommendation: 'avoid',
        reasoning: 'Invalid attacker',
      },
      adjustedScore: 0,
      originalScore: action.score,
      adjustment: -action.score,
      reasoning: 'Invalid attacker - score zeroed',
    };
  }

  // Get target faction and asset
  const targetFaction = allFactions.find((f) => f.id === action.action.targetFactionId);
  const targetAsset = targetFaction?.assets.find((a) => a.id === action.action.targetAssetId);
  const targetDef = targetAsset ? getAssetById(targetAsset.definitionId) : null;

  if (!targetFaction || !targetAsset || !targetDef) {
    return {
      action,
      combatPrediction: {
        winProbability: 0,
        expectedDamageDealt: 0,
        expectedDamageTaken: 0,
        netExpectedValue: -100,
        recommendation: 'avoid',
        reasoning: 'Invalid target',
      },
      adjustedScore: 0,
      originalScore: action.score,
      adjustment: -action.score,
      reasoning: 'Invalid target - score zeroed',
    };
  }

  // Predict combat outcome
  const prediction = predictCombatOutcome(
    faction,
    attackingAsset,
    attackingDef,
    targetFaction,
    targetAsset,
    targetDef,
    config
  );

  // Calculate score adjustment based on prediction
  let adjustment = 0;
  let adjustedScore = action.score;

  if (prediction.recommendation === 'avoid') {
    // Heavily penalize attacks below threshold
    adjustment = -50;
    adjustedScore = Math.max(0, action.score + adjustment);
  } else if (prediction.recommendation === 'risky') {
    // Moderate penalty for risky attacks
    adjustment = -25;
    adjustedScore = Math.max(0, action.score + adjustment);
  } else {
    // Bonus for favorable attacks
    const favorabilityBonus = Math.min(30, prediction.netExpectedValue * 2);
    adjustment = favorabilityBonus;
    adjustedScore = action.score + adjustment;
  }

  return {
    action,
    combatPrediction: prediction,
    adjustedScore,
    originalScore: action.score,
    adjustment,
    reasoning: `${prediction.reasoning}. Adjustment: ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(0)}`,
  };
}

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

/**
 * Apply difficulty scaling to scored actions
 */
export function applyDifficultyScaling(
  result: ActionScoringResult,
  faction: Faction,
  allFactions: Faction[],
  difficulty: DifficultyLevel,
  config?: Partial<DifficultyConfig>
): DifficultyAdjustedResult {
  const diffConfig = {
    ...DEFAULT_DIFFICULTY_CONFIGS[difficulty],
    ...config,
  };

  let adjustedActions = [...result.scoredActions];
  const minimaxEvaluations: MinimaxEvaluation[] = [];
  const reasoningParts: string[] = [];

  reasoningParts.push(`Difficulty: ${difficulty}`);

  switch (difficulty) {
    case 'easy':
      // Apply random noise
      adjustedActions = applyEasyModeNoise(adjustedActions, diffConfig.easyNoiseRange);
      reasoningParts.push(`Applied ±${diffConfig.easyNoiseRange} noise`);
      break;

    case 'normal':
      // No modifications
      reasoningParts.push('Standard scoring');
      break;

    case 'hard':
    case 'expert':
      // Apply minimax evaluation to attack actions
      adjustedActions = adjustedActions.map((action) => {
        if (action.action.type === 'attack') {
          const evaluation = evaluateAttackWithMinimax(action, faction, allFactions, diffConfig);
          minimaxEvaluations.push(evaluation);
          return {
            ...action,
            score: evaluation.adjustedScore,
            reasoning: `${action.reasoning}. [Minimax: ${evaluation.combatPrediction.recommendation}]`,
          };
        }
        return action;
      });

      const avoidedCount = minimaxEvaluations.filter(
        (e) => e.combatPrediction.recommendation === 'avoid'
      ).length;

      reasoningParts.push(`Minimax evaluated ${minimaxEvaluations.length} attacks`);
      if (avoidedCount > 0) {
        reasoningParts.push(`${avoidedCount} attacks penalized as unfavorable`);
      }
      break;
  }

  // Re-sort by adjusted scores
  adjustedActions.sort((a, b) => b.score - a.score);

  // Find new best action
  const bestAction = adjustedActions.length > 0 ? adjustedActions[0] : null;

  return {
    originalResult: result,
    adjustedActions,
    bestAction,
    difficulty,
    minimaxEvaluations,
    reasoning: reasoningParts.join('. '),
  };
}

/**
 * Score all actions with difficulty scaling applied
 */
export function scoreActionsWithDifficulty(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[],
  influenceMap: InfluenceMap,
  threatOverview: SectorThreatOverview,
  strategicIntent: StrategicIntent,
  difficulty: DifficultyLevel,
  scorerConfig?: ScorerConfig,
  difficultyConfig?: Partial<DifficultyConfig>
): DifficultyAdjustedResult {
  // First, score all actions normally
  const baseResult = scoreAllActions(
    faction,
    allFactions,
    systems,
    influenceMap,
    threatOverview,
    strategicIntent,
    scorerConfig
  );

  // Then apply difficulty scaling
  return applyDifficultyScaling(baseResult, faction, allFactions, difficulty, difficultyConfig);
}

/**
 * Check if an attack should be avoided based on difficulty settings
 */
export function shouldAvoidAttack(
  evaluation: MinimaxEvaluation,
  difficulty: DifficultyLevel
): boolean {
  if (difficulty === 'easy' || difficulty === 'normal') {
    return false; // Easy/Normal don't avoid attacks
  }

  return evaluation.combatPrediction.recommendation === 'avoid';
}

/**
 * Get the win probability threshold for a difficulty level
 */
export function getWinProbabilityThreshold(difficulty: DifficultyLevel): number {
  switch (difficulty) {
    case 'easy':
    case 'normal':
    case 'medium':
      return 0; // No threshold
    case 'hard':
      return DEFAULT_DIFFICULTY_CONFIGS.hard.hardMinWinProbability;
    case 'expert':
      return DEFAULT_DIFFICULTY_CONFIGS.expert.expertMinWinProbability;
  }
}

/**
 * Analyze if the AI should consider retreating based on combat predictions
 */
export function analyzeRetreatNecessity(
  faction: Faction,
  allFactions: Faction[],
  systemId: string,
  difficulty: DifficultyLevel
): { shouldRetreat: boolean; reasoning: string } {
  if (difficulty === 'easy' || difficulty === 'normal') {
    return { shouldRetreat: false, reasoning: 'Easy/Normal AI does not retreat strategically' };
  }

  const config = DEFAULT_DIFFICULTY_CONFIGS[difficulty];

  // Get our assets at this location
  const ourAssets = faction.assets.filter((a) => a.location === systemId);
  if (ourAssets.length === 0) {
    return { shouldRetreat: false, reasoning: 'No assets at location' };
  }

  // Get enemy assets at this location
  const enemyAssets: Array<{ faction: Faction; asset: FactionAsset; def: AssetDefinition }> = [];
  for (const enemyFaction of allFactions) {
    if (enemyFaction.id === faction.id) continue;

    for (const asset of enemyFaction.assets) {
      if (asset.location !== systemId || asset.stealthed) continue;

      const def = getAssetById(asset.definitionId);
      if (def?.attack) {
        enemyAssets.push({ faction: enemyFaction, asset, def });
      }
    }
  }

  if (enemyAssets.length === 0) {
    return { shouldRetreat: false, reasoning: 'No enemy attackers at location' };
  }

  // Evaluate if we're likely to lose assets
  let totalDeathRisk = 0;
  let totalAssetValue = 0;

  for (const ourAsset of ourAssets) {
    const ourDef = getAssetById(ourAsset.definitionId);
    if (!ourDef) continue;

    totalAssetValue += ourDef.cost;

    // Check worst-case enemy attack
    for (const enemy of enemyAssets) {
      if (!enemy.def.attack) continue;

      const prediction = predictCombatOutcome(
        enemy.faction,
        enemy.asset,
        enemy.def,
        faction,
        ourAsset,
        ourDef,
        config
      );

      // Risk of this asset dying
      if (prediction.expectedDamageDealt >= ourAsset.hp) {
        totalDeathRisk += ourDef.cost * prediction.winProbability;
      }
    }
  }

  // Recommend retreat if expected losses are high
  const lossRatio = totalDeathRisk / Math.max(1, totalAssetValue);
  if (lossRatio > 0.5) {
    return {
      shouldRetreat: true,
      reasoning: `High expected losses (${(lossRatio * 100).toFixed(0)}% of asset value at risk)`,
    };
  }

  return {
    shouldRetreat: false,
    reasoning: `Acceptable risk level (${(lossRatio * 100).toFixed(0)}% of asset value at risk)`,
  };
}

