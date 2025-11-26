/**
 * AI Strategic Planning Types
 * 
 * Defines the data structures for multi-turn AI planning with
 * goal-directed reasoning, resource management, and contingencies.
 */

import type { ActionType } from '../services/ai/UtilityScorer';

// ============================================================================
// PLANNED ACTION TYPES
// ============================================================================

/**
 * A single planned action in the AI's strategy
 */
export interface PlannedAction {
  id: string;
  type: ActionType | 'purchase' | 'repair' | 'save';
  
  // Action details
  description: string;
  assetId?: string;           // Asset performing the action
  assetName?: string;         // Human-readable asset name
  targetAssetId?: string;     // Target of attack
  targetAssetName?: string;   // Human-readable target name
  targetFactionId?: string;   // Target faction for attacks
  targetFactionName?: string; // Human-readable faction name
  targetLocation?: string;    // Destination for moves
  targetLocationName?: string;// Human-readable location name
  
  // Planning metadata
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;         // 0-100, how confident AI is this will succeed
  expectedOutcome: string;    // What AI expects to happen
  
  // Dependencies
  dependsOn?: string[];       // IDs of actions that must complete first
  enablesActions?: string[];  // IDs of actions this enables
  
  // Resource requirements
  facCredsCost: number;       // FacCreds needed for this action
}

/**
 * A contingency plan - alternative actions if primary plan fails
 */
export interface PlanContingency {
  id: string;
  triggeredBy: string;        // Condition that triggers this contingency
  triggerCondition: 'action_failed' | 'asset_destroyed' | 'enemy_moved' | 'low_hp' | 'custom';
  description: string;
  alternativeActions: PlannedAction[];
  priority: number;           // Higher = more important contingency
}

/**
 * Actions planned for a single turn
 */
export interface TurnPlan {
  turn: number;               // Which turn this plan is for (relative: 0 = this turn, 1 = next turn, etc.)
  actions: PlannedAction[];   // Actions to take this turn
  expectedFacCreds: number;   // Expected FacCreds at start of turn
  expectedFacCredsAfter: number; // Expected FacCreds after actions
  reasoning: string;          // Why these actions were chosen
}

// ============================================================================
// STRATEGIC OBJECTIVE TYPES
// ============================================================================

/**
 * A strategic objective the AI is working toward
 */
export interface StrategicObjective {
  id: string;
  type: 'destroy_asset' | 'capture_system' | 'eliminate_faction' | 'expand_influence' | 
        'build_army' | 'economic_growth' | 'defensive_posture';
  
  // Target details
  targetFactionId?: string;
  targetFactionName?: string;
  targetAssetId?: string;
  targetAssetName?: string;
  targetSystemId?: string;
  targetSystemName?: string;
  
  // Progress
  description: string;
  progress: number;           // 0-100
  estimatedTurnsToComplete: number;
  
  // Planning
  requiredActions: string[];  // High-level steps needed
  blockers: string[];         // What's preventing progress
  
  priority: 'primary' | 'secondary' | 'opportunistic';
}

/**
 * Resource budget across multiple turns
 */
export interface ResourceBudget {
  currentFacCreds: number;
  projectedIncome: number[];  // Expected income per turn [turn0, turn1, turn2, ...]
  plannedExpenses: Array<{
    turn: number;
    amount: number;
    purpose: string;
  }>;
  savingGoal?: {
    targetAmount: number;
    targetTurn: number;
    purpose: string;          // e.g., "Purchase Capital Fleet"
  };
}

// ============================================================================
// MAIN STRATEGIC PLAN TYPE
// ============================================================================

/**
 * Complete strategic plan for an AI faction
 */
export interface AIStrategicPlan {
  factionId: string;
  factionName: string;
  
  // Plan metadata
  createdAtTurn: number;      // Game turn when plan was created
  lastUpdatedTurn: number;    // When plan was last revised
  planHorizon: number;        // How many turns ahead this plan covers
  overallConfidence: number;  // 0-100, overall plan viability
  
  // Strategic layer
  primaryObjective: StrategicObjective;
  secondaryObjectives: StrategicObjective[];
  
  // Tactical layer - turn by turn actions
  turnPlans: TurnPlan[];      // Plans for each turn in horizon
  
  // Contingencies
  contingencies: PlanContingency[];
  
  // Resource management
  resourceBudget: ResourceBudget;
  
  // Plan summary for display
  summary: string;            // One-line summary of current strategy
  detailedReasoning: string[];// Step by step reasoning
  
  // Threats and opportunities identified
  identifiedThreats: Array<{
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    response: string;
  }>;
  identifiedOpportunities: Array<{
    description: string;
    value: 'high' | 'medium' | 'low';
    action: string;
  }>;
}

// ============================================================================
// PLAN STATE FOR REDUX
// ============================================================================

/**
 * AI Plans state stored in Redux
 */
export interface AIPlansState {
  plansByFaction: Record<string, AIStrategicPlan>;
  lastPlanningTurn: Record<string, number>;  // Track when each faction last planned
  planningInProgress: string | null;         // Faction ID currently planning
}

// ============================================================================
// PLAN EVALUATION TYPES
// ============================================================================

/**
 * Result of evaluating how well a plan is progressing
 */
export interface PlanEvaluation {
  planId: string;
  factionId: string;
  
  // Progress assessment
  onTrack: boolean;
  progressPercent: number;
  
  // Issues identified
  blockers: string[];
  unexpectedEvents: string[];
  
  // Recommendation
  recommendation: 'continue' | 'adjust' | 'replan';
  adjustments?: PlannedAction[];
  reasoning: string;
}

/**
 * Input for the planning algorithm
 */
export interface PlanningContext {
  faction: {
    id: string;
    name: string;
    facCreds: number;
    attributes: { force: number; cunning: number; wealth: number; hp: number; maxHp: number };
    homeworld: string;
    assets: Array<{
      id: string;
      definitionId: string;
      name: string;
      location: string;
      hp: number;
      maxHp: number;
      hasAttack: boolean;
      hasMobility: boolean;
    }>;
    goal: {
      type: string;
      description: string;
      progress: number;
      target: number;
    } | null;
  };
  
  enemies: Array<{
    id: string;
    name: string;
    homeworld: string;
    strength: number;  // Combined force+cunning+wealth
    assets: Array<{
      id: string;
      definitionId: string;
      name: string;
      location: string;
      hp: number;
      value: number;   // Cost of the asset
      isBase: boolean; // Is Base of Influence
    }>;
  }>;
  
  systems: Array<{
    id: string;
    name: string;
    hasOurAssets: boolean;
    hasEnemyAssets: boolean;
    distanceFromHomeworld: number;
  }>;
  
  currentTurn: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'expert';
}


