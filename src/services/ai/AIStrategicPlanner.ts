/**
 * AIStrategicPlanner - Multi-Turn Strategic Planning for AI Factions
 *
 * This service implements advanced planning capabilities:
 * - Multi-turn lookahead (3-4 turns)
 * - Goal-directed backward planning
 * - Resource budgeting across turns
 * - Contingency planning
 * - Plan evaluation and replanning
 *
 * The planner creates visible plans that players can see, adding
 * strategic depth and allowing players to anticipate AI moves.
 */

import type { Faction } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import type {
  AIStrategicPlan,
  PlannedAction,
  TurnPlan,
  StrategicObjective,
  PlanContingency,
  ResourceBudget,
  PlanningContext,
  PlanEvaluation,
} from '../../types/aiPlan';
import { getAssetById } from '../../data/assetLibrary';
import { hasMovementAbility } from '../../utils/movementAbilities';
import type { StrategicIntent } from './GoalSelectionService';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLANNING_CONFIG = {
  defaultHorizon: 3,          // Plan 3 turns ahead by default
  maxHorizon: 5,              // Maximum turns to plan ahead
  replanThreshold: 0.4,       // Replan if confidence drops below 40%
  minConfidenceForAction: 0.3,// Don't plan actions with <30% confidence
};

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build planning context from game state
 */
export function buildPlanningContext(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[],
  currentTurn: number,
  difficulty: 'easy' | 'normal' | 'hard' | 'expert'
): PlanningContext {
  // Build faction context
  const factionAssets = faction.assets.map((asset) => {
    const def = getAssetById(asset.definitionId);
    return {
      id: asset.id,
      definitionId: asset.definitionId,
      name: def?.name || 'Unknown',
      location: asset.location,
      hp: asset.hp,
      maxHp: asset.maxHp,
      hasAttack: !!def?.attack,
      hasMobility: hasMovementAbility(asset.definitionId) || def?.type === 'Starship',
    };
  });

  // Build enemy contexts
  const enemies = allFactions
    .filter((f) => f.id !== faction.id)
    .map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      homeworld: enemy.homeworld,
      strength: enemy.attributes.force + enemy.attributes.cunning + enemy.attributes.wealth,
      assets: enemy.assets
        .filter((a) => !a.stealthed) // Can't plan against stealthed assets
        .map((asset) => {
          const def = getAssetById(asset.definitionId);
          return {
            id: asset.id,
            definitionId: asset.definitionId,
            name: def?.name || 'Unknown',
            location: asset.location,
            hp: asset.hp,
            value: def?.cost || 0,
            isBase: asset.definitionId === 'base_of_influence',
          };
        }),
    }));

  // Build system contexts
  const systemContexts = systems.map((system) => {
    const ourAssets = faction.assets.filter((a) => a.location === system.id);
    const enemyAssets = allFactions
      .filter((f) => f.id !== faction.id)
      .flatMap((f) => f.assets)
      .filter((a) => a.location === system.id && !a.stealthed);

    return {
      id: system.id,
      name: system.name,
      hasOurAssets: ourAssets.length > 0,
      hasEnemyAssets: enemyAssets.length > 0,
      distanceFromHomeworld: calculateDistance(faction.homeworld, system.id, systems),
    };
  });

  return {
    faction: {
      id: faction.id,
      name: faction.name,
      facCreds: faction.facCreds,
      attributes: faction.attributes,
      homeworld: faction.homeworld,
      assets: factionAssets,
      goal: faction.goal
        ? {
            type: faction.goal.type,
            description: faction.goal.description,
            progress: faction.goal.progress.current,
            target: faction.goal.progress.target,
          }
        : null,
    },
    enemies,
    systems: systemContexts,
    currentTurn,
    difficulty,
  };
}

/**
 * Simple distance calculation (placeholder - should use actual pathfinding)
 */
function calculateDistance(
  fromId: string,
  toId: string,
  _systems: StarSystem[]
): number {
  if (fromId === toId) return 0;
  // Simplified: assume all systems are 1-2 hexes apart
  return 1;
}

// ============================================================================
// OBJECTIVE IDENTIFICATION
// ============================================================================

/**
 * Identify strategic objectives based on faction goal and situation
 */
export function identifyObjectives(
  context: PlanningContext,
  strategicIntent: StrategicIntent
): { primary: StrategicObjective; secondary: StrategicObjective[] } {
  const objectives: StrategicObjective[] = [];

  // Goal-based primary objective
  if (context.faction.goal) {
    const goalObjective = createObjectiveFromGoal(context);
    if (goalObjective) {
      objectives.push(goalObjective);
    }
  }

  // Opportunistic objectives - weak enemies
  for (const enemy of context.enemies) {
    // Find vulnerable enemy assets
    const vulnerableAssets = enemy.assets.filter((a) => a.hp <= 3);
    for (const asset of vulnerableAssets) {
      objectives.push({
        id: `destroy-${asset.id}`,
        type: 'destroy_asset',
        targetFactionId: enemy.id,
        targetFactionName: enemy.name,
        targetAssetId: asset.id,
        targetAssetName: asset.name,
        description: `Destroy ${enemy.name}'s weakened ${asset.name}`,
        progress: 0,
        estimatedTurnsToComplete: estimateTurnsToDestroyAsset(context, asset),
        requiredActions: ['position_attacker', 'attack'],
        blockers: [],
        priority: asset.isBase ? 'secondary' : 'opportunistic',
      });
    }

    // Target enemy bases
    const enemyBases = enemy.assets.filter((a) => a.isBase);
    for (const base of enemyBases) {
      objectives.push({
        id: `destroy-base-${base.id}`,
        type: 'destroy_asset',
        targetFactionId: enemy.id,
        targetFactionName: enemy.name,
        targetAssetId: base.id,
        targetAssetName: 'Base of Influence',
        targetSystemId: base.location,
        description: `Destroy ${enemy.name}'s Base of Influence`,
        progress: 0,
        estimatedTurnsToComplete: estimateTurnsToDestroyAsset(context, base),
        requiredActions: ['position_attacker', 'attack_base'],
        blockers: [],
        priority: 'secondary',
      });
    }
  }

  // Economic objective if low on funds
  if (context.faction.facCreds < 5) {
    objectives.push({
      id: 'economic-growth',
      type: 'economic_growth',
      description: 'Build economic capacity',
      progress: 0,
      estimatedTurnsToComplete: 3,
      requiredActions: ['save_faccreds', 'purchase_income_asset'],
      blockers: [],
      priority: 'secondary',
    });
  }

  // Defensive objective if under threat
  const threatenedAssets = findThreatenedAssets(context);
  if (threatenedAssets.length > 0) {
    objectives.push({
      id: 'defensive-posture',
      type: 'defensive_posture',
      description: 'Protect threatened assets',
      progress: 0,
      estimatedTurnsToComplete: 2,
      requiredActions: ['reinforce_position', 'repair_damaged'],
      blockers: [],
      priority: strategicIntent.aggressionLevel < 40 ? 'primary' : 'secondary',
    });
  }

  // Sort by priority and select
  const sorted = objectives.sort((a, b) => {
    const priorityOrder = { primary: 0, secondary: 1, opportunistic: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const primary = sorted[0] || createDefaultObjective(context);
  const secondary = sorted.slice(1, 4); // Up to 3 secondary objectives

  return { primary, secondary };
}

/**
 * Create objective from faction's current goal
 */
function createObjectiveFromGoal(context: PlanningContext): StrategicObjective | null {
  const goal = context.faction.goal;
  if (!goal) return null;

  switch (goal.type) {
    case 'Military Conquest':
    case 'Blood the Enemy': {
      // Find best enemy to attack
      const weakestEnemy = context.enemies.reduce((prev, curr) =>
        curr.strength < prev.strength ? curr : prev
      , context.enemies[0]);
      
      if (!weakestEnemy) return null;

      return {
        id: `goal-${goal.type}`,
        type: 'destroy_asset',
        targetFactionId: weakestEnemy.id,
        targetFactionName: weakestEnemy.name,
        description: `${goal.type}: Attack ${weakestEnemy.name}`,
        progress: (goal.progress / goal.target) * 100,
        estimatedTurnsToComplete: Math.ceil((goal.target - goal.progress) / 2),
        requiredActions: ['position_attackers', 'attack_enemies'],
        blockers: [],
        priority: 'primary',
      };
    }

    case 'Destroy the Foe': {
      const targetEnemy = context.enemies.reduce((prev, curr) =>
        curr.strength < prev.strength ? curr : prev
      , context.enemies[0]);

      if (!targetEnemy) return null;

      return {
        id: 'goal-eliminate',
        type: 'eliminate_faction',
        targetFactionId: targetEnemy.id,
        targetFactionName: targetEnemy.name,
        description: `Eliminate ${targetEnemy.name}`,
        progress: 100 - (targetEnemy.assets.length * 10),
        estimatedTurnsToComplete: targetEnemy.assets.length * 2,
        requiredActions: ['destroy_all_assets', 'destroy_base'],
        blockers: [],
        priority: 'primary',
      };
    }

    case 'Expand Influence': {
      // Find system to expand to
      const expansionTarget = context.systems.find(
        (s) => !s.hasOurAssets && !s.hasEnemyAssets
      );

      return {
        id: 'goal-expand',
        type: 'expand_influence',
        targetSystemId: expansionTarget?.id,
        targetSystemName: expansionTarget?.name,
        description: 'Establish new Base of Influence',
        progress: goal.progress * 100,
        estimatedTurnsToComplete: 3,
        requiredActions: ['move_to_system', 'build_base'],
        blockers: [],
        priority: 'primary',
      };
    }

    default:
      return {
        id: `goal-${goal.type}`,
        type: 'build_army',
        description: goal.description,
        progress: (goal.progress / goal.target) * 100,
        estimatedTurnsToComplete: 3,
        requiredActions: ['execute_goal'],
        blockers: [],
        priority: 'primary',
      };
  }
}

function createDefaultObjective(_context: PlanningContext): StrategicObjective {
  // Default: build military strength
  return {
    id: 'default-build',
    type: 'build_army',
    description: 'Build military strength',
    progress: 0,
    estimatedTurnsToComplete: 4,
    requiredActions: ['purchase_assets', 'position_forces'],
    blockers: [],
    priority: 'primary',
  };
}

function estimateTurnsToDestroyAsset(
  context: PlanningContext,
  targetAsset: { id: string; location: string; hp: number }
): number {
  // Find our nearest attacker
  const attackers = context.faction.assets.filter((a) => a.hasAttack);
  if (attackers.length === 0) return 10; // No attackers, very long

  const attackerAtLocation = attackers.find((a) => a.location === targetAsset.location);
  if (attackerAtLocation) {
    // Already there, estimate based on HP
    return Math.ceil(targetAsset.hp / 4); // Assume ~4 damage per attack
  }

  // Need to move first
  const mobileAttackers = attackers.filter((a) => a.hasMobility);
  if (mobileAttackers.length > 0) {
    return 1 + Math.ceil(targetAsset.hp / 4); // 1 turn to move + attacks
  }

  return 5; // No mobile attackers, need to build/position
}

function findThreatenedAssets(context: PlanningContext): string[] {
  const threatened: string[] = [];

  for (const asset of context.faction.assets) {
    // Check if enemies have attackers at same location
    for (const enemy of context.enemies) {
      const enemyAttackersHere = enemy.assets.filter(
        (a) => a.location === asset.location
      );
      if (enemyAttackersHere.length > 0) {
        threatened.push(asset.id);
        break;
      }
    }
  }

  return threatened;
}

// ============================================================================
// BACKWARD PLANNING (Goal-Directed)
// ============================================================================

/**
 * Plan backward from objective to create action sequence
 */
function planBackwardFromObjective(
  objective: StrategicObjective,
  context: PlanningContext,
  _horizon: number
): PlannedAction[] {
  const actions: PlannedAction[] = [];

  switch (objective.type) {
    case 'destroy_asset': {
      // Goal: Destroy target asset
      // Prerequisites: Have attacker at target location
      const targetAsset = findTargetAsset(objective, context);
      if (!targetAsset) break;

      // Step 1: Do we have an attacker at that location?
      const attackerAtLocation = context.faction.assets.find(
        (a) => a.hasAttack && a.location === targetAsset.location
      );

      if (attackerAtLocation) {
        // Can attack immediately
        actions.push({
          id: `attack-${targetAsset.id}`,
          type: 'attack',
          description: `Attack ${objective.targetFactionName}'s ${targetAsset.name}`,
          assetId: attackerAtLocation.id,
          assetName: attackerAtLocation.name,
          targetAssetId: targetAsset.id,
          targetAssetName: targetAsset.name,
          targetFactionId: objective.targetFactionId,
          targetFactionName: objective.targetFactionName,
          priority: 'high',
          confidence: calculateAttackConfidence(attackerAtLocation, targetAsset),
          expectedOutcome: `Deal damage to ${targetAsset.name}`,
          facCredsCost: 0,
        });
      } else {
        // Need to position first
        const mobileAttacker = context.faction.assets.find(
          (a) => a.hasAttack && a.hasMobility
        );

        if (mobileAttacker) {
          // Move then attack
          actions.push({
            id: `move-to-${targetAsset.location}`,
            type: 'move',
            description: `Move ${mobileAttacker.name} to ${targetAsset.location}`,
            assetId: mobileAttacker.id,
            assetName: mobileAttacker.name,
            targetLocation: targetAsset.location,
            priority: 'high',
            confidence: 90,
            expectedOutcome: `Position for attack on ${targetAsset.name}`,
            enablesActions: [`attack-${targetAsset.id}`],
            facCredsCost: 1,
          });

          actions.push({
            id: `attack-${targetAsset.id}`,
            type: 'attack',
            description: `Attack ${objective.targetFactionName}'s ${targetAsset.name}`,
            assetId: mobileAttacker.id,
            assetName: mobileAttacker.name,
            targetAssetId: targetAsset.id,
            targetAssetName: targetAsset.name,
            targetFactionId: objective.targetFactionId,
            targetFactionName: objective.targetFactionName,
            priority: 'high',
            confidence: calculateAttackConfidence(
              { hp: mobileAttacker.hp, maxHp: mobileAttacker.maxHp },
              targetAsset
            ),
            expectedOutcome: `Deal damage to ${targetAsset.name}`,
            dependsOn: [`move-to-${targetAsset.location}`],
            facCredsCost: 0,
          });
        } else {
          // Need to purchase mobile attacker
          actions.push({
            id: 'purchase-attacker',
            type: 'purchase',
            description: 'Purchase mobile attack asset',
            priority: 'high',
            confidence: context.faction.facCreds >= 4 ? 80 : 40,
            expectedOutcome: 'Gain attack capability',
            enablesActions: [`move-to-${targetAsset.location}`],
            facCredsCost: 4,
          });
        }
      }
      break;
    }

    case 'expand_influence': {
      // Goal: Build Base of Influence in new system
      // Prerequisites: Have asset at location, have FacCreds
      const targetSystem = context.systems.find(
        (s) => s.id === objective.targetSystemId
      );

      if (targetSystem) {
        const assetAtLocation = context.faction.assets.find(
          (a) => a.location === targetSystem.id
        );

        if (!assetAtLocation) {
          // Need to move an asset there first
          const mobileAsset = context.faction.assets.find((a) => a.hasMobility);
          if (mobileAsset) {
            actions.push({
              id: `move-to-${targetSystem.id}`,
              type: 'move',
              description: `Move ${mobileAsset.name} to ${targetSystem.name}`,
              assetId: mobileAsset.id,
              assetName: mobileAsset.name,
              targetLocation: targetSystem.id,
              targetLocationName: targetSystem.name,
              priority: 'high',
              confidence: 85,
              expectedOutcome: `Establish presence in ${targetSystem.name}`,
              facCredsCost: 1,
            });
          }
        }

        actions.push({
          id: `expand-${targetSystem.id}`,
          type: 'expand',
          description: `Expand influence in ${targetSystem.name}`,
          targetLocation: targetSystem.id,
          targetLocationName: targetSystem.name,
          priority: 'high',
          confidence: context.faction.facCreds >= 8 ? 70 : 30,
          expectedOutcome: `Establish Base of Influence in ${targetSystem.name}`,
          facCredsCost: 8,
        });
      }
      break;
    }

    case 'economic_growth': {
      // Save FacCreds and purchase income-generating asset
      actions.push({
        id: 'save-for-income',
        type: 'save',
        description: 'Save FacCreds for income asset',
        priority: 'medium',
        confidence: 95,
        expectedOutcome: 'Accumulate resources',
        facCredsCost: 0,
      });

      if (context.faction.facCreds >= 4) {
        actions.push({
          id: 'purchase-income',
          type: 'purchase',
          description: 'Purchase income-generating asset',
          priority: 'medium',
          confidence: 75,
          expectedOutcome: 'Increase FacCred income',
          facCredsCost: 4,
        });
      }
      break;
    }

    case 'defensive_posture': {
      // Repair damaged assets and position defenders
      const damagedAssets = context.faction.assets.filter(
        (a) => a.hp < a.maxHp
      );

      for (const damaged of damagedAssets.slice(0, 2)) {
        actions.push({
          id: `repair-${damaged.id}`,
          type: 'repair',
          description: `Repair ${damaged.name}`,
          assetId: damaged.id,
          assetName: damaged.name,
          priority: damaged.hp <= 2 ? 'critical' : 'medium',
          confidence: context.faction.facCreds >= 2 ? 90 : 50,
          expectedOutcome: `Restore ${damaged.name} to full strength`,
          facCredsCost: Math.ceil((damaged.maxHp - damaged.hp) / 2),
        });
      }
      break;
    }

    default: {
      // Generic objective - try to make progress
      actions.push({
        id: 'generic-action',
        type: 'defend',
        description: 'Consolidate position',
        priority: 'low',
        confidence: 80,
        expectedOutcome: 'Maintain current status',
        facCredsCost: 0,
      });
    }
  }

  return actions;
}

function findTargetAsset(
  objective: StrategicObjective,
  context: PlanningContext
): { id: string; name: string; location: string; hp: number } | null {
  if (!objective.targetFactionId || !objective.targetAssetId) return null;

  const enemy = context.enemies.find((e) => e.id === objective.targetFactionId);
  if (!enemy) return null;

  const asset = enemy.assets.find((a) => a.id === objective.targetAssetId);
  if (!asset) return null;

  return {
    id: asset.id,
    name: asset.name,
    location: asset.location,
    hp: asset.hp,
  };
}

function calculateAttackConfidence(
  attacker: { hp: number; maxHp: number },
  target: { hp: number }
): number {
  // Simple confidence based on HP comparison
  const hpRatio = attacker.hp / Math.max(1, target.hp);
  if (hpRatio >= 2) return 85;
  if (hpRatio >= 1.5) return 75;
  if (hpRatio >= 1) return 60;
  if (hpRatio >= 0.5) return 40;
  return 25;
}

// ============================================================================
// TURN PLAN GENERATION
// ============================================================================

/**
 * Organize planned actions into turn-by-turn plans
 */
function organizeTurnPlans(
  actions: PlannedAction[],
  context: PlanningContext,
  horizon: number
): TurnPlan[] {
  const turnPlans: TurnPlan[] = [];
  const actionQueue = [...actions];
  const completedActions = new Set<string>();
  
  let projectedFacCreds = context.faction.facCreds;
  const estimatedIncomePerTurn = 2; // Conservative estimate

  for (let turn = 0; turn < horizon && actionQueue.length > 0; turn++) {
    const turnActions: PlannedAction[] = [];
    const facCredsAtStart = projectedFacCreds;

    // Find actions that can be executed this turn
    // (dependencies met, can afford)
    for (let i = actionQueue.length - 1; i >= 0; i--) {
      const action = actionQueue[i];
      
      // Check dependencies
      const dependenciesMet = !action.dependsOn || 
        action.dependsOn.every((dep) => completedActions.has(dep));
      
      if (!dependenciesMet) continue;

      // Check affordability
      if (action.facCredsCost > projectedFacCreds) continue;

      // Can execute this action
      turnActions.push(action);
      projectedFacCreds -= action.facCredsCost;
      completedActions.add(action.id);
      actionQueue.splice(i, 1);

      // SWN rule: only one action TYPE per turn (but multiple of same type)
      // For simplicity, allow 2-3 actions per turn
      if (turnActions.length >= 3) break;
    }

    // Add income for next turn
    projectedFacCreds += estimatedIncomePerTurn;

    if (turnActions.length > 0 || turn === 0) {
      turnPlans.push({
        turn,
        actions: turnActions,
        expectedFacCreds: facCredsAtStart,
        expectedFacCredsAfter: projectedFacCreds,
        reasoning: generateTurnReasoning(turnActions, turn),
      });
    }
  }

  return turnPlans;
}

function generateTurnReasoning(actions: PlannedAction[], turn: number): string {
  if (actions.length === 0) {
    return turn === 0 ? 'Conserving resources this turn' : 'Building up for future actions';
  }

  const actionDescriptions = actions.map((a) => a.description).join(', ');
  return `Turn ${turn}: ${actionDescriptions}`;
}

// ============================================================================
// CONTINGENCY PLANNING
// ============================================================================

/**
 * Generate contingency plans for potential failures
 */
function generateContingencies(
  primaryPlan: TurnPlan[],
  context: PlanningContext
): PlanContingency[] {
  const contingencies: PlanContingency[] = [];

  // Find attack actions and create failure contingencies
  for (const turnPlan of primaryPlan) {
    for (const action of turnPlan.actions) {
      if (action.type === 'attack') {
        contingencies.push({
          id: `contingency-${action.id}-fail`,
          triggeredBy: `${action.description} fails`,
          triggerCondition: 'action_failed',
          description: 'Attack failed - retreat and regroup',
          alternativeActions: [
            {
              id: `retreat-${action.assetId}`,
              type: 'move',
              description: `Retreat ${action.assetName} to safety`,
              assetId: action.assetId,
              assetName: action.assetName,
              targetLocation: context.faction.homeworld,
              priority: 'high',
              confidence: 80,
              expectedOutcome: 'Preserve damaged asset',
              facCredsCost: 1,
            },
            {
              id: `repair-${action.assetId}`,
              type: 'repair',
              description: `Repair ${action.assetName}`,
              assetId: action.assetId,
              assetName: action.assetName,
              priority: 'high',
              confidence: 70,
              expectedOutcome: 'Restore fighting capability',
              facCredsCost: 2,
            },
          ],
          priority: 1,
        });
      }

      if (action.type === 'move' && action.enablesActions?.length) {
        contingencies.push({
          id: `contingency-${action.id}-blocked`,
          triggeredBy: `Movement to ${action.targetLocationName} blocked`,
          triggerCondition: 'enemy_moved',
          description: 'Path blocked - find alternate route or target',
          alternativeActions: [
            {
              id: `alt-target-${action.id}`,
              type: 'attack',
              description: 'Attack nearest available target instead',
              assetId: action.assetId,
              assetName: action.assetName,
              priority: 'medium',
              confidence: 60,
              expectedOutcome: 'Maintain offensive pressure',
              facCredsCost: 0,
            },
          ],
          priority: 2,
        });
      }
    }
  }

  // Asset destruction contingency
  const valuableAssets = context.faction.assets.filter((a) => a.hp >= 5);
  for (const asset of valuableAssets.slice(0, 2)) {
    contingencies.push({
      id: `contingency-asset-lost-${asset.id}`,
      triggeredBy: `${asset.name} destroyed`,
      triggerCondition: 'asset_destroyed',
      description: `${asset.name} lost - purchase replacement`,
      alternativeActions: [
        {
          id: `replace-${asset.id}`,
          type: 'purchase',
          description: `Purchase replacement for ${asset.name}`,
          priority: 'high',
          confidence: 50,
          expectedOutcome: 'Restore capability',
          facCredsCost: 5,
        },
      ],
      priority: 1,
    });
  }

  return contingencies;
}

// ============================================================================
// RESOURCE BUDGETING
// ============================================================================

/**
 * Create resource budget for the plan
 */
function createResourceBudget(
  turnPlans: TurnPlan[],
  context: PlanningContext
): ResourceBudget {
  const estimatedIncomePerTurn = 2; // Conservative

  // Calculate projected income
  const projectedIncome: number[] = [];
  for (let i = 0; i < turnPlans.length; i++) {
    projectedIncome.push(estimatedIncomePerTurn);
  }

  // Extract planned expenses
  const plannedExpenses: Array<{ turn: number; amount: number; purpose: string }> = [];
  for (const turnPlan of turnPlans) {
    for (const action of turnPlan.actions) {
      if (action.facCredsCost > 0) {
        plannedExpenses.push({
          turn: turnPlan.turn,
          amount: action.facCredsCost,
          purpose: action.description,
        });
      }
    }
  }

  // Check for saving goals
  let savingGoal: ResourceBudget['savingGoal'] = undefined;
  const totalCost = plannedExpenses.reduce((sum, e) => sum + e.amount, 0);
  if (totalCost > context.faction.facCreds) {
    savingGoal = {
      targetAmount: totalCost,
      targetTurn: Math.ceil((totalCost - context.faction.facCreds) / estimatedIncomePerTurn),
      purpose: 'Fund planned actions',
    };
  }

  return {
    currentFacCreds: context.faction.facCreds,
    projectedIncome,
    plannedExpenses,
    savingGoal,
  };
}

// ============================================================================
// THREAT & OPPORTUNITY ANALYSIS
// ============================================================================

function analyzeThreats(context: PlanningContext): AIStrategicPlan['identifiedThreats'] {
  const threats: AIStrategicPlan['identifiedThreats'] = [];

  // Check for enemies with attackers near our assets
  for (const asset of context.faction.assets) {
    for (const enemy of context.enemies) {
      const enemyAttackersNearby = enemy.assets.filter(
        (a) => a.location === asset.location
      );
      
      if (enemyAttackersNearby.length > 0) {
        threats.push({
          description: `${enemy.name} has forces threatening our ${asset.name}`,
          severity: asset.definitionId === 'base_of_influence' ? 'critical' : 'high',
          response: `Reinforce position or retreat ${asset.name}`,
        });
      }
    }
  }

  // Check for stronger enemies
  const ourStrength = context.faction.attributes.force + 
    context.faction.attributes.cunning + 
    context.faction.attributes.wealth;

  for (const enemy of context.enemies) {
    if (enemy.strength > ourStrength * 1.5) {
      threats.push({
        description: `${enemy.name} is significantly stronger than us`,
        severity: 'medium',
        response: 'Build up forces before engaging',
      });
    }
  }

  return threats;
}

function analyzeOpportunities(context: PlanningContext): AIStrategicPlan['identifiedOpportunities'] {
  const opportunities: AIStrategicPlan['identifiedOpportunities'] = [];

  // Weak enemy assets
  for (const enemy of context.enemies) {
    const weakAssets = enemy.assets.filter((a) => a.hp <= 3);
    for (const asset of weakAssets) {
      opportunities.push({
        description: `${enemy.name}'s ${asset.name} is weakened (${asset.hp} HP)`,
        value: asset.isBase ? 'high' : 'medium',
        action: `Attack ${asset.name} for easy victory`,
      });
    }
  }

  // Undefended enemy bases
  for (const enemy of context.enemies) {
    const bases = enemy.assets.filter((a) => a.isBase);
    for (const base of bases) {
      const defendersAtBase = enemy.assets.filter(
        (a) => a.location === base.location && !a.isBase
      );
      if (defendersAtBase.length === 0) {
        opportunities.push({
          description: `${enemy.name}'s Base of Influence is undefended`,
          value: 'high',
          action: 'Strike at undefended base',
        });
      }
    }
  }

  // Expansion opportunities
  const uncontestedSystems = context.systems.filter(
    (s) => !s.hasOurAssets && !s.hasEnemyAssets
  );
  if (uncontestedSystems.length > 0) {
    opportunities.push({
      description: `${uncontestedSystems.length} systems available for expansion`,
      value: 'medium',
      action: 'Expand to unclaimed territory',
    });
  }

  return opportunities;
}

// ============================================================================
// MAIN PLANNING FUNCTION
// ============================================================================

/**
 * Generate a complete strategic plan for an AI faction
 */
export function generateStrategicPlan(
  faction: Faction,
  allFactions: Faction[],
  systems: StarSystem[],
  currentTurn: number,
  difficulty: 'easy' | 'normal' | 'hard' | 'expert',
  strategicIntent: StrategicIntent
): AIStrategicPlan {
  // Build context
  const context = buildPlanningContext(faction, allFactions, systems, currentTurn, difficulty);

  // Determine planning horizon based on difficulty
  const horizon = difficulty === 'expert' ? 4 : difficulty === 'hard' ? 3 : 2;

  // Identify objectives
  const { primary: primaryObjective, secondary: secondaryObjectives } = 
    identifyObjectives(context, strategicIntent);

  // Generate actions through backward planning
  const primaryActions = planBackwardFromObjective(primaryObjective, context, horizon);
  const secondaryActions = secondaryObjectives.flatMap(
    (obj) => planBackwardFromObjective(obj, context, horizon).slice(0, 2)
  );

  // Combine and prioritize actions
  const allActions = [...primaryActions, ...secondaryActions];

  // Organize into turn plans
  const turnPlans = organizeTurnPlans(allActions, context, horizon);

  // Generate contingencies
  const contingencies = generateContingencies(turnPlans, context);

  // Create resource budget
  const resourceBudget = createResourceBudget(turnPlans, context);

  // Analyze threats and opportunities
  const identifiedThreats = analyzeThreats(context);
  const identifiedOpportunities = analyzeOpportunities(context);

  // Calculate overall confidence
  const avgConfidence = allActions.length > 0
    ? allActions.reduce((sum, a) => sum + a.confidence, 0) / allActions.length
    : 50;

  // Generate summary
  const summary = generatePlanSummary(primaryObjective, turnPlans);
  const detailedReasoning = generateDetailedReasoning(
    primaryObjective,
    secondaryObjectives,
    turnPlans,
    context
  );

  return {
    factionId: faction.id,
    factionName: faction.name,
    createdAtTurn: currentTurn,
    lastUpdatedTurn: currentTurn,
    planHorizon: horizon,
    overallConfidence: avgConfidence,
    primaryObjective,
    secondaryObjectives,
    turnPlans,
    contingencies,
    resourceBudget,
    summary,
    detailedReasoning,
    identifiedThreats,
    identifiedOpportunities,
  };
}

function generatePlanSummary(
  objective: StrategicObjective,
  turnPlans: TurnPlan[]
): string {
  const actionCount = turnPlans.reduce((sum, tp) => sum + tp.actions.length, 0);
  
  if (actionCount === 0) {
    return 'Consolidating position and gathering resources';
  }

  const firstTurnActions = turnPlans[0]?.actions || [];
  if (firstTurnActions.length > 0) {
    const firstAction = firstTurnActions[0];
    return `${objective.description} - Next: ${firstAction.description}`;
  }

  return objective.description;
}

function generateDetailedReasoning(
  primary: StrategicObjective,
  secondary: StrategicObjective[],
  turnPlans: TurnPlan[],
  context: PlanningContext
): string[] {
  const reasoning: string[] = [];

  reasoning.push(`Primary objective: ${primary.description}`);
  
  if (secondary.length > 0) {
    reasoning.push(`Secondary objectives: ${secondary.map((s) => s.description).join(', ')}`);
  }

  reasoning.push(`Current resources: ${context.faction.facCreds} FacCreds`);
  reasoning.push(`Available assets: ${context.faction.assets.length} total, ${context.faction.assets.filter((a) => a.hasAttack).length} attackers`);

  for (const turnPlan of turnPlans) {
    if (turnPlan.actions.length > 0) {
      reasoning.push(`Turn ${turnPlan.turn + 1}: ${turnPlan.reasoning}`);
    }
  }

  return reasoning;
}

// ============================================================================
// PLAN EVALUATION
// ============================================================================

/**
 * Evaluate how well the current plan is progressing
 */
export function evaluatePlan(
  plan: AIStrategicPlan,
  currentContext: PlanningContext
): PlanEvaluation {
  const blockers: string[] = [];
  const unexpectedEvents: string[] = [];

  // Check if planned assets still exist
  for (const turnPlan of plan.turnPlans) {
    for (const action of turnPlan.actions) {
      if (action.assetId) {
        const assetExists = currentContext.faction.assets.some(
          (a) => a.id === action.assetId
        );
        if (!assetExists) {
          blockers.push(`Asset ${action.assetName} no longer available`);
        }
      }
    }
  }

  // Check if targets still exist
  if (plan.primaryObjective.targetAssetId) {
    const targetExists = currentContext.enemies.some((e) =>
      e.assets.some((a) => a.id === plan.primaryObjective.targetAssetId)
    );
    if (!targetExists) {
      unexpectedEvents.push('Target asset has been destroyed');
    }
  }

  // Check resource availability
  const totalPlannedCost = plan.turnPlans
    .flatMap((tp) => tp.actions)
    .reduce((sum, a) => sum + a.facCredsCost, 0);

  if (totalPlannedCost > currentContext.faction.facCreds + 6) {
    blockers.push('Insufficient resources for planned actions');
  }

  // Determine recommendation
  let recommendation: PlanEvaluation['recommendation'] = 'continue';
  let progressPercent = 100 - (blockers.length + unexpectedEvents.length) * 20;

  if (blockers.length >= 2 || unexpectedEvents.length >= 2) {
    recommendation = 'replan';
    progressPercent = Math.max(0, progressPercent);
  } else if (blockers.length >= 1 || unexpectedEvents.length >= 1) {
    recommendation = 'adjust';
  }

  return {
    planId: plan.factionId,
    factionId: plan.factionId,
    onTrack: blockers.length === 0 && unexpectedEvents.length === 0,
    progressPercent,
    blockers,
    unexpectedEvents,
    recommendation,
    reasoning: blockers.length > 0 
      ? `Plan blocked by: ${blockers.join(', ')}`
      : 'Plan progressing as expected',
  };
}

/**
 * Check if a plan needs to be regenerated
 */
export function shouldReplan(
  plan: AIStrategicPlan,
  currentTurn: number,
  evaluation: PlanEvaluation
): boolean {
  // Replan if explicitly recommended
  if (evaluation.recommendation === 'replan') return true;

  // Replan if plan is too old
  if (currentTurn - plan.lastUpdatedTurn >= 3) return true;

  // Replan if confidence is too low
  if (plan.overallConfidence < PLANNING_CONFIG.replanThreshold * 100) return true;

  // Replan if we've completed all planned actions
  const hasRemainingActions = plan.turnPlans.some((tp) => tp.actions.length > 0);
  if (!hasRemainingActions) return true;

  return false;
}


