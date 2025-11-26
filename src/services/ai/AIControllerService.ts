/**
 * AIControllerService - Turn Execution Lifecycle for AI Factions
 *
 * This service orchestrates the entire AI turn by triggering phases in order:
 * 1. Analysis Phase: Calculate influence maps and threat assessment
 * 2. Goal Phase: Select or validate strategic goals
 * 3. Planning Phase: Generate multi-turn strategic plan
 * 4. Economy Phase: Handle repairs and purchases
 * 5. Scoring Phase: Score all possible actions
 * 6. Execution Phase: Queue and dispatch selected actions
 *
 * Actions are dispatched sequentially with artificial delays (500ms-1s)
 * to allow the player to observe the AI's decisions.
 */

import type { Dispatch } from '@reduxjs/toolkit';
import type { Faction } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import type { RootState } from '../../store/rootReducer';
import type { AIStrategicPlan } from '../../types/aiPlan';

// AI Service imports
import { calculateInfluenceMap, type InfluenceMap } from './InfluenceMapService';
import { generateSectorThreatOverview, type SectorThreatOverview } from './ThreatAssessment';
import {
  evaluateGoals,
  createGoalInstance,
  shouldChangeGoal,
  type StrategicIntent,
} from './GoalSelectionService';
import {
  generateEconomicPlan,
  getEconomyAction,
  type EconomicPlan,
} from './AIEconomyManager';
import {
  scoreActionsWithDifficulty,
  type DifficultyAdjustedResult,
} from './DifficultyScaler';
import type { DifficultyLevel } from './DifficultyScaler';
import type { ScoredAction, ActionType } from './UtilityScorer';
import {
  generateStrategicPlan,
  buildPlanningContext,
  evaluatePlan,
  shouldReplan,
} from './AIStrategicPlanner';

// Redux action imports
import {
  moveAsset,
  setGoal,
  repairAsset,
  addAsset,
  inflictDamage,
} from '../../store/slices/factionsSlice';
import {
  setPlan,
  selectFactionPlan,
} from '../../store/slices/aiPlansSlice';
import { getAssetById } from '../../data/assetLibrary';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Phase of the AI turn
 */
export type AITurnPhase =
  | 'idle'
  | 'analysis'
  | 'goal'
  | 'planning'
  | 'economy'
  | 'scoring'
  | 'execution'
  | 'complete';

/**
 * A queued action ready for dispatch
 */
export interface QueuedAction {
  id: string;
  type: ActionType | 'repair' | 'purchase' | 'set_goal';
  description: string;
  dispatch: () => void;
  delay: number; // Milliseconds to wait before executing
}

/**
 * Result of the analysis phase
 */
export interface AnalysisResult {
  influenceMap: InfluenceMap;
  threatOverview: SectorThreatOverview;
}

/**
 * Result of the goal phase
 */
export interface GoalResult {
  strategicIntent: StrategicIntent;
  goalChanged: boolean;
  newGoalType: string | null;
}

/**
 * Complete turn plan for an AI faction
 */
export interface AITurnPlan {
  faction: Faction;
  difficulty: DifficultyLevel;
  analysis: AnalysisResult;
  goal: GoalResult;
  strategicPlan: AIStrategicPlan | null;  // Multi-turn strategic plan
  economy: EconomicPlan;
  scoring: DifficultyAdjustedResult;
  selectedActions: ScoredAction[];
  actionQueue: QueuedAction[];
  reasoning: string[];
}

/**
 * Status of the AI turn execution
 */
export interface AITurnStatus {
  factionId: string;
  factionName: string;
  phase: AITurnPhase;
  progress: number; // 0-100
  currentAction: string | null;
  actionsCompleted: number;
  totalActions: number;
  isComplete: boolean;
  error: string | null;
}

/**
 * Configuration for the AI controller
 */
export interface AIControllerConfig {
  /** Base delay between actions in milliseconds (default: 750) */
  baseActionDelay: number;
  /** Variance in delay (±ms) for more natural feel */
  delayVariance: number;
  /** Maximum actions per turn (safety limit) */
  maxActionsPerTurn: number;
  /** Enable logging for debugging */
  enableLogging: boolean;
}

const DEFAULT_CONFIG: AIControllerConfig = {
  baseActionDelay: 750,
  delayVariance: 250,
  maxActionsPerTurn: 10,
  enableLogging: false,
};

// ============================================================================
// PHASE EXECUTION
// ============================================================================

/**
 * Execute the Analysis Phase
 */
export function executeAnalysisPhase(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[]
): AnalysisResult {
  // Handle empty systems array gracefully
  if (!systems || systems.length === 0) {
    console.warn(`[AI] No systems available for analysis of ${faction.name}`);
    return {
      influenceMap: {
        factionId: faction.id,
        hexes: new Map(),
        friendlyControlled: [],
        enemyControlled: [],
        contested: [],
        unoccupied: [],
      },
      threatOverview: {
        factionId: faction.id,
        assessingFactionId: faction.id,
        primaryThreat: null,
        threatenedSystems: [],
        safeSystems: [],
        overallThreatLevel: 0,
        recommendedPosture: 'balanced',
        systemThreats: {},
      },
    };
  }

  const influenceMap = calculateInfluenceMap(faction.id, allFactions, systems);
  const threatOverview = generateSectorThreatOverview(faction.id, allFactions, systems);

  return { influenceMap, threatOverview };
}

/**
 * Execute the Goal Phase
 */
export function executeGoalPhase(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[],
  dispatch: Dispatch
): GoalResult {
  const evaluation = evaluateGoals(faction, allFactions, systems);
  const changeCheck = shouldChangeGoal(faction, allFactions, systems);

  let goalChanged = false;
  let newGoalType: string | null = null;

  if (changeCheck.shouldChange && evaluation.recommendedGoal) {
    // Create new goal instance
    const newGoal = createGoalInstance(evaluation.recommendedGoal, faction);
    
    // Dispatch goal change
    dispatch(setGoal({ factionId: faction.id, goal: newGoal }));
    
    goalChanged = true;
    newGoalType = evaluation.recommendedGoal;
  }

  return {
    strategicIntent: evaluation.strategicIntent,
    goalChanged,
    newGoalType,
  };
}

/**
 * Execute the Economy Phase
 */
export function executeEconomyPhase(
  faction: Faction,
  systems: StarSystem[],
  threatOverview: SectorThreatOverview,
  strategicIntent: StrategicIntent
): EconomicPlan {
  return generateEconomicPlan(faction, systems, threatOverview, strategicIntent);
}

/**
 * Execute the Planning Phase - Generate or update multi-turn strategic plan
 */
export function executePlanningPhase(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[],
  strategicIntent: StrategicIntent,
  difficulty: DifficultyLevel,
  currentTurn: number,
  existingPlan: AIStrategicPlan | null,
  dispatch: Dispatch
): AIStrategicPlan {
  // Convert difficulty to planning format (medium is an alias for normal)
  const planningDifficulty = difficulty === 'medium' ? 'normal' : difficulty;

  // Check if we should replan
  if (existingPlan) {
    const context = buildPlanningContext(faction, allFactions, systems, currentTurn, planningDifficulty);
    const evaluation = evaluatePlan(existingPlan, context);

    if (!shouldReplan(existingPlan, currentTurn, evaluation)) {
      // Continue with existing plan, just update the turn
      return {
        ...existingPlan,
        lastUpdatedTurn: currentTurn,
      };
    }
  }

  // Generate new strategic plan
  const newPlan = generateStrategicPlan(
    faction,
    allFactions,
    systems,
    currentTurn,
    planningDifficulty,
    strategicIntent
  );

  // Store in Redux for visibility
  dispatch(setPlan(newPlan));

  return newPlan;
}

/**
 * Execute the Scoring Phase
 */
export function executeScoringPhase(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[],
  influenceMap: InfluenceMap,
  threatOverview: SectorThreatOverview,
  strategicIntent: StrategicIntent,
  difficulty: DifficultyLevel
): DifficultyAdjustedResult {
  return scoreActionsWithDifficulty(
    faction,
    allFactions,
    systems,
    influenceMap,
    threatOverview,
    strategicIntent,
    difficulty
  );
}

// ============================================================================
// ACTION QUEUE BUILDING
// ============================================================================

/**
 * Generate a random delay with variance
 */
function generateDelay(config: AIControllerConfig): number {
  const variance = (Math.random() * 2 - 1) * config.delayVariance;
  return Math.max(200, config.baseActionDelay + variance);
}

/**
 * Build action queue from economy plan
 */
function buildEconomyActions(
  faction: Faction,
  economyPlan: EconomicPlan,
  dispatch: Dispatch,
  config: AIControllerConfig
): QueuedAction[] {
  const actions: QueuedAction[] = [];
  const economyAction = getEconomyAction(economyPlan);

  if (economyAction.action === 'repair' && economyPlan.repairDecisions.length > 0) {
    const repair = economyPlan.repairDecisions[0];
    const asset = faction.assets.find((a) => a.id === repair.assetId);
    
    if (asset) {
      actions.push({
        id: `repair-${repair.assetId}`,
        type: 'repair',
        description: `Repair ${repair.assetName}`,
        dispatch: () => {
          dispatch(
            repairAsset({
              factionId: faction.id,
              assetId: repair.assetId,
              hpHealed: repair.damageAmount,
              cost: repair.repairCost,
            })
          );
        },
        delay: generateDelay(config),
      });
    }
  }

  if (economyAction.action === 'purchase' && economyPlan.purchaseRecommendation) {
    const purchase = economyPlan.purchaseRecommendation;
    
    actions.push({
      id: `purchase-${purchase.assetDefinition.id}`,
      type: 'purchase',
      description: `Purchase ${purchase.assetDefinition.name}`,
      dispatch: () => {
        dispatch(
          addAsset({
            factionId: faction.id,
            assetDefinitionId: purchase.assetDefinition.id,
            location: purchase.location,
          })
        );
      },
      delay: generateDelay(config),
    });
  }

  return actions;
}

/**
 * Build action queue from scored actions
 */
function buildScoredActions(
  faction: Faction,
  allFactions: Faction[],
  scoringResult: DifficultyAdjustedResult,
  dispatch: Dispatch,
  config: AIControllerConfig
): QueuedAction[] {
  const actions: QueuedAction[] = [];

  // Get the recommended action type (factions can only do one type per turn)
  if (!scoringResult.bestAction) return actions;

  const actionType = scoringResult.bestAction.action.type;
  const actionsOfType = scoringResult.adjustedActions.filter(
    (a) => a.action.type === actionType
  );

  // Limit actions to config max
  const selectedActions = actionsOfType.slice(0, config.maxActionsPerTurn);

  for (const scored of selectedActions) {
    const action = scored.action;

    switch (action.type) {
      case 'move':
        if (action.targetLocation) {
          actions.push({
            id: `move-${action.actingAssetId}-${action.targetLocation}`,
            type: 'move',
            description: action.description,
            dispatch: () => {
              dispatch(
                moveAsset({
                  factionId: faction.id,
                  assetId: action.actingAssetId,
                  newLocation: action.targetLocation!,
                })
              );
            },
            delay: generateDelay(config),
          });
        }
        break;

      case 'attack':
        if (action.targetFactionId && action.targetAssetId) {
          const targetFaction = allFactions.find((f) => f.id === action.targetFactionId);
          const targetAsset = targetFaction?.assets.find((a) => a.id === action.targetAssetId);
          const attackingAsset = faction.assets.find((a) => a.id === action.actingAssetId);
          const attackingDef = attackingAsset ? getAssetById(attackingAsset.definitionId) : null;

          if (targetAsset && attackingDef?.attack) {
            // Simplified attack - just deal expected damage
            // In a full implementation, this would use the combat resolver
            const damage = Math.ceil(Math.random() * 6) + 1; // Simplified 1d6+1

            actions.push({
              id: `attack-${action.actingAssetId}-${action.targetAssetId}`,
              type: 'attack',
              description: action.description,
              dispatch: () => {
                dispatch(
                  inflictDamage({
                    factionId: action.targetFactionId!,
                    assetId: action.targetAssetId!,
                    damage,
                    sourceFactionId: faction.id,
                  })
                );
              },
              delay: generateDelay(config),
            });
          }
        }
        break;

      case 'defend':
        // Defend is a passive action - no dispatch needed
        actions.push({
          id: `defend-${action.sourceLocation}`,
          type: 'defend',
          description: action.description,
          dispatch: () => {
            // No-op: defending is implicit
          },
          delay: generateDelay(config) / 2, // Shorter delay for passive action
        });
        break;

      case 'expand':
        // Expand influence would require the expand influence action
        // Simplified for now
        actions.push({
          id: `expand-${action.targetLocation}`,
          type: 'expand',
          description: action.description,
          dispatch: () => {
            // Would dispatch addBaseOfInfluence in full implementation
          },
          delay: generateDelay(config),
        });
        break;
    }
  }

  return actions;
}

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

/**
 * Plan an AI faction's turn (does not execute)
 */
export function planAITurn(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[],
  difficulty: DifficultyLevel,
  dispatch: Dispatch,
  config: AIControllerConfig = DEFAULT_CONFIG,
  currentTurn: number = 1,
  existingPlan: AIStrategicPlan | null = null
): AITurnPlan {
  const reasoning: string[] = [];

  // Phase 1: Analysis
  const analysis = executeAnalysisPhase(faction, allFactions, systems);
  reasoning.push(`Analysis: Threat level ${analysis.threatOverview.overallThreatLevel.toFixed(0)}%`);

  // Phase 2: Goal Selection
  const goal = executeGoalPhase(faction, allFactions, systems, dispatch);
  if (goal.goalChanged) {
    reasoning.push(`Goal: Changed to ${goal.newGoalType}`);
  } else {
    reasoning.push(`Goal: Maintaining ${faction.goal?.type || 'none'}`);
  }
  reasoning.push(`Intent: ${goal.strategicIntent.primaryFocus} focus`);

  // Phase 3: Strategic Planning (NEW)
  const strategicPlan = executePlanningPhase(
    faction,
    allFactions,
    systems,
    goal.strategicIntent,
    difficulty,
    currentTurn,
    existingPlan,
    dispatch
  );
  reasoning.push(`Strategy: ${strategicPlan.summary}`);
  reasoning.push(`Confidence: ${strategicPlan.overallConfidence.toFixed(0)}%`);

  // Phase 4: Economy
  const economy = executeEconomyPhase(
    faction,
    systems,
    analysis.threatOverview,
    goal.strategicIntent
  );
  reasoning.push(`Economy: ${economy.reasoning}`);

  // Phase 5: Scoring
  const scoring = executeScoringPhase(
    faction,
    allFactions,
    systems,
    analysis.influenceMap,
    analysis.threatOverview,
    goal.strategicIntent,
    difficulty
  );
  reasoning.push(`Scoring: ${scoring.reasoning}`);

  // Build action queue
  const economyActions = buildEconomyActions(faction, economy, dispatch, config);
  const scoredActions = buildScoredActions(faction, allFactions, scoring, dispatch, config);

  // Combine queues (economy first, then scored actions)
  const actionQueue = [...economyActions, ...scoredActions];

  // Get selected scored actions for reference
  const selectedActions = scoring.bestAction
    ? scoring.adjustedActions.filter((a) => a.action.type === scoring.bestAction!.action.type)
    : [];

  return {
    faction,
    difficulty,
    analysis,
    goal,
    strategicPlan,
    economy,
    scoring,
    selectedActions,
    actionQueue,
    reasoning,
  };
}

/**
 * Execute a planned AI turn with delays
 */
export async function executeAITurn(
  plan: AITurnPlan,
  onStatusUpdate?: (status: AITurnStatus) => void,
  config: AIControllerConfig = DEFAULT_CONFIG
): Promise<void> {
  const { faction, actionQueue } = plan;

  const updateStatus = (
    phase: AITurnPhase,
    progress: number,
    currentAction: string | null,
    actionsCompleted: number
  ) => {
    if (onStatusUpdate) {
      onStatusUpdate({
        factionId: faction.id,
        factionName: faction.name,
        phase,
        progress,
        currentAction,
        actionsCompleted,
        totalActions: actionQueue.length,
        isComplete: phase === 'complete',
        error: null,
      });
    }
  };

  // Start execution
  updateStatus('execution', 0, null, 0);

  if (config.enableLogging) {
    console.log(`[AI] ${faction.name} starting turn with ${actionQueue.length} actions`);
  }

  // Execute each action with delay
  for (let i = 0; i < actionQueue.length; i++) {
    const action = actionQueue[i];
    const progress = ((i + 1) / actionQueue.length) * 100;

    updateStatus('execution', progress, action.description, i);

    if (config.enableLogging) {
      console.log(`[AI] ${faction.name}: ${action.description}`);
    }

    // Wait for delay
    await new Promise((resolve) => setTimeout(resolve, action.delay));

    // Execute the action
    try {
      action.dispatch();
    } catch (error) {
      console.error(`[AI] Error executing action: ${action.description}`, error);
    }
  }

  // Complete
  updateStatus('complete', 100, null, actionQueue.length);

  if (config.enableLogging) {
    console.log(`[AI] ${faction.name} turn complete`);
  }
}

/**
 * Run a complete AI turn (plan + execute)
 */
export async function runAITurn(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[],
  difficulty: DifficultyLevel,
  dispatch: Dispatch,
  onStatusUpdate?: (status: AITurnStatus) => void,
  config: AIControllerConfig = DEFAULT_CONFIG,
  currentTurn: number = 1,
  existingPlan: AIStrategicPlan | null = null
): Promise<AITurnPlan> {
  // Plan the turn
  const plan = planAITurn(
    faction,
    allFactions,
    systems,
    difficulty,
    dispatch,
    config,
    currentTurn,
    existingPlan
  );

  // Execute the turn
  await executeAITurn(plan, onStatusUpdate, config);

  return plan;
}

/**
 * Get state from Redux store for AI decision making
 */
export function getAIDecisionContext(state: RootState): {
  factions: Faction[];
  systems: StarSystem[];
  currentTurn: number;
} {
  return {
    factions: state.factions.factions,
    systems: state.sector.currentSector?.systems || [],
    currentTurn: state.turn.turn,
  };
}

/**
 * Get existing strategic plan for a faction from Redux state
 */
export function getExistingPlan(state: RootState, factionId: string): AIStrategicPlan | null {
  return selectFactionPlan(state, factionId) || null;
}

/**
 * Create an AI turn status for a faction that hasn't started
 */
export function createIdleStatus(faction: Faction): AITurnStatus {
  return {
    factionId: faction.id,
    factionName: faction.name,
    phase: 'idle',
    progress: 0,
    currentAction: null,
    actionsCompleted: 0,
    totalActions: 0,
    isComplete: false,
    error: null,
  };
}

/**
 * Check if a faction is AI-controlled (not player-controlled)
 * 
 * A faction is AI-controlled if it's not marked as player-controlled.
 * The playerFactionId should be passed from the game mode state.
 */
export function isAIControlled(faction: Faction, playerFactionId?: string | null): boolean {
  // If a specific player faction is set, only that faction is player-controlled
  if (playerFactionId) {
    return faction.id !== playerFactionId;
  }
  // If no player faction is set, all factions are AI-controlled
  // This allows AI to run in editor mode for testing
  return true;
}

/**
 * Get all AI-controlled factions
 */
export function getAIFactions(factions: Faction[], playerFactionId?: string | null): Faction[] {
  return factions.filter((f) => isAIControlled(f, playerFactionId));
}

