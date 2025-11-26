/**
 * AI Faction Controller Services
 *
 * This module provides the AI decision-making infrastructure for non-player factions.
 * It implements a utility-based AI system that analyzes the game state and makes
 * strategic decisions based on faction tags, goals, and current threats.
 */

// Influence Map Service - Spatial control analysis
export {
  calculateInfluenceMap,
  getSystemInfluence,
  findBestExpansionTargets,
  calculateSystemStrategicValue,
  calculateHexDistance,
  type HexInfluence,
  type InfluenceMap,
} from './InfluenceMapService';

// Threat Assessment - Enemy concentration analysis
export {
  assessSystemThreat,
  generateSectorThreatOverview,
  getImmediateAttackThreats,
  calculateDefensiveStrength,
  shouldConsiderRetreat,
  type FactionThreat,
  type AssetThreat,
  type SystemThreatAssessment,
  type SectorThreatOverview,
} from './ThreatAssessment';

// Goal Selection Service - Strategic objective selection
export {
  calculateGoalWeights,
  selectBestGoal,
  determineStrategicIntent,
  evaluateGoals,
  createGoalInstance,
  shouldChangeGoal,
  TAG_GOAL_AFFINITIES,
  type GoalWeight,
  type GoalEvaluation,
  type StrategicIntent,
  type TagGoalAffinity,
} from './GoalSelectionService';

// AI Economy Manager - Purchasing & resource allocation
export {
  generateRepairDecisions,
  calculateRepairReserve,
  getValidPurchaseLocations,
  canPurchaseAsset,
  generatePurchaseRecommendations,
  generateEconomicPlan,
  selectRepairsWithinBudget,
  getEconomyAction,
  TAG_ASSET_SYNERGIES,
  type RepairDecision,
  type PurchaseRecommendation,
  type EconomicPlan,
  type TagAssetSynergy,
} from './AIEconomyManager';

// Utility Scorer - Action scoring engine
export {
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
  type ActionType,
  type PotentialAction,
  type ScoredAction,
  type ActionScoringResult,
  type ScorerConfig,
} from './UtilityScorer';

// Difficulty Scaler - Difficulty modifiers & minimax combat solver
export {
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
  type DifficultyLevel,
  type DifficultyConfig,
  type CombatPrediction,
  type MinimaxEvaluation,
  type DifficultyAdjustedResult,
} from './DifficultyScaler';

// AI Controller Service - Turn execution lifecycle
export {
  executeAnalysisPhase,
  executeGoalPhase,
  executePlanningPhase,
  executeEconomyPhase,
  executeScoringPhase,
  planAITurn,
  executeAITurn,
  runAITurn,
  getAIDecisionContext,
  getExistingPlan,
  createIdleStatus,
  isAIControlled,
  getAIFactions,
  type AITurnPhase,
  type QueuedAction,
  type AnalysisResult,
  type GoalResult,
  type AITurnPlan,
  type AITurnStatus,
  type AIControllerConfig,
} from './AIControllerService';

// AI Strategic Planner - Multi-turn planning with goal-directed reasoning
export {
  generateStrategicPlan,
  buildPlanningContext,
  identifyObjectives,
  evaluatePlan,
  shouldReplan,
} from './AIStrategicPlanner';

// Planning types (from aiPlan types)
export type { PlanningContext } from '../../types/aiPlan';

