/**
 * AI Plans Slice - Redux state for AI strategic plans
 * 
 * Stores multi-turn plans for each AI faction, making them
 * visible to the player and persistent across turns.
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AIStrategicPlan, AIPlansState, PlannedAction } from '../../types/aiPlan';
import type { RootState } from '../rootReducer';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AIPlansState = {
  plansByFaction: {},
  lastPlanningTurn: {},
  planningInProgress: null,
};

// ============================================================================
// SLICE DEFINITION
// ============================================================================

const aiPlansSlice = createSlice({
  name: 'aiPlans',
  initialState,
  reducers: {
    /**
     * Set or update a faction's strategic plan
     */
    setPlan: (state, action: PayloadAction<AIStrategicPlan>) => {
      const plan = action.payload;
      state.plansByFaction[plan.factionId] = plan;
      state.lastPlanningTurn[plan.factionId] = plan.createdAtTurn;
    },

    /**
     * Update an existing plan without replacing entirely
     */
    updatePlan: (
      state,
      action: PayloadAction<{
        factionId: string;
        updates: Partial<AIStrategicPlan>;
      }>
    ) => {
      const { factionId, updates } = action.payload;
      const existingPlan = state.plansByFaction[factionId];
      if (existingPlan) {
        state.plansByFaction[factionId] = {
          ...existingPlan,
          ...updates,
          lastUpdatedTurn: updates.lastUpdatedTurn ?? existingPlan.lastUpdatedTurn,
        };
      }
    },

    /**
     * Mark a planned action as completed
     */
    markActionCompleted: (
      state,
      action: PayloadAction<{
        factionId: string;
        actionId: string;
      }>
    ) => {
      const { factionId, actionId } = action.payload;
      const plan = state.plansByFaction[factionId];
      if (!plan) return;

      // Remove the action from turn plans
      for (const turnPlan of plan.turnPlans) {
        const actionIndex = turnPlan.actions.findIndex((a) => a.id === actionId);
        if (actionIndex !== -1) {
          turnPlan.actions.splice(actionIndex, 1);
          break;
        }
      }
    },

    /**
     * Mark a planned action as failed (triggers contingency consideration)
     */
    markActionFailed: (
      state,
      action: PayloadAction<{
        factionId: string;
        actionId: string;
        reason: string;
      }>
    ) => {
      const { factionId, actionId, reason } = action.payload;
      const plan = state.plansByFaction[factionId];
      if (!plan) return;

      // Find and remove the failed action
      for (const turnPlan of plan.turnPlans) {
        const actionIndex = turnPlan.actions.findIndex((a) => a.id === actionId);
        if (actionIndex !== -1) {
          turnPlan.actions.splice(actionIndex, 1);
          break;
        }
      }

      // Find applicable contingency
      const contingency = plan.contingencies.find(
        (c) => c.triggeredBy.includes(actionId) || c.triggerCondition === 'action_failed'
      );

      if (contingency) {
        // Add contingency actions to the first turn plan
        if (plan.turnPlans.length > 0) {
          plan.turnPlans[0].actions.push(...contingency.alternativeActions);
          plan.turnPlans[0].reasoning = `Contingency activated: ${reason}`;
        }
      }

      // Lower confidence
      plan.overallConfidence = Math.max(0, plan.overallConfidence - 20);
    },

    /**
     * Advance plans by one turn (shift turn indices)
     */
    advancePlans: (state, action: PayloadAction<{ currentTurn: number }>) => {
      const { currentTurn } = action.payload;

      for (const factionId of Object.keys(state.plansByFaction)) {
        const plan = state.plansByFaction[factionId];
        if (!plan) continue;

        // Remove completed turn (turn 0)
        if (plan.turnPlans.length > 0 && plan.turnPlans[0].turn === 0) {
          plan.turnPlans.shift();
        }

        // Decrement turn indices
        for (const turnPlan of plan.turnPlans) {
          turnPlan.turn = Math.max(0, turnPlan.turn - 1);
        }

        plan.lastUpdatedTurn = currentTurn;
      }
    },

    /**
     * Clear a faction's plan
     */
    clearPlan: (state, action: PayloadAction<{ factionId: string }>) => {
      const { factionId } = action.payload;
      delete state.plansByFaction[factionId];
      delete state.lastPlanningTurn[factionId];
    },

    /**
     * Set planning in progress flag
     */
    setPlanningInProgress: (state, action: PayloadAction<string | null>) => {
      state.planningInProgress = action.payload;
    },

    /**
     * Add a threat to a faction's plan
     */
    addIdentifiedThreat: (
      state,
      action: PayloadAction<{
        factionId: string;
        threat: AIStrategicPlan['identifiedThreats'][0];
      }>
    ) => {
      const { factionId, threat } = action.payload;
      const plan = state.plansByFaction[factionId];
      if (plan) {
        plan.identifiedThreats.push(threat);
      }
    },

    /**
     * Add an opportunity to a faction's plan
     */
    addIdentifiedOpportunity: (
      state,
      action: PayloadAction<{
        factionId: string;
        opportunity: AIStrategicPlan['identifiedOpportunities'][0];
      }>
    ) => {
      const { factionId, opportunity } = action.payload;
      const plan = state.plansByFaction[factionId];
      if (plan) {
        plan.identifiedOpportunities.push(opportunity);
      }
    },

    /**
     * Update plan confidence based on events
     */
    adjustPlanConfidence: (
      state,
      action: PayloadAction<{
        factionId: string;
        adjustment: number; // Positive or negative
        reason: string;
      }>
    ) => {
      const { factionId, adjustment } = action.payload;
      const plan = state.plansByFaction[factionId];
      if (plan) {
        plan.overallConfidence = Math.max(0, Math.min(100, plan.overallConfidence + adjustment));
      }
    },
  },
});

// ============================================================================
// ACTIONS EXPORT
// ============================================================================

export const {
  setPlan,
  updatePlan,
  markActionCompleted,
  markActionFailed,
  advancePlans,
  clearPlan,
  setPlanningInProgress,
  addIdentifiedThreat,
  addIdentifiedOpportunity,
  adjustPlanConfidence,
} = aiPlansSlice.actions;

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get all AI plans
 */
export const selectAllPlans = (state: RootState) => state.aiPlans.plansByFaction;

/**
 * Get a specific faction's plan
 */
export const selectFactionPlan = (state: RootState, factionId: string) =>
  state.aiPlans.plansByFaction[factionId];

/**
 * Get the current turn's planned actions for a faction
 */
export const selectCurrentTurnActions = (state: RootState, factionId: string): PlannedAction[] => {
  const plan = state.aiPlans.plansByFaction[factionId];
  if (!plan || plan.turnPlans.length === 0) return [];
  
  const currentTurnPlan = plan.turnPlans.find((tp) => tp.turn === 0);
  return currentTurnPlan?.actions || [];
};

/**
 * Get next turn's planned actions for a faction (for player preview)
 */
export const selectNextTurnActions = (state: RootState, factionId: string): PlannedAction[] => {
  const plan = state.aiPlans.plansByFaction[factionId];
  if (!plan || plan.turnPlans.length < 2) return [];
  
  const nextTurnPlan = plan.turnPlans.find((tp) => tp.turn === 1);
  return nextTurnPlan?.actions || [];
};

/**
 * Get all upcoming actions across all AI factions (for player intel)
 */
export const selectAllUpcomingActions = (state: RootState): Array<{
  factionId: string;
  factionName: string;
  actions: PlannedAction[];
  turn: number;
}> => {
  const result: Array<{
    factionId: string;
    factionName: string;
    actions: PlannedAction[];
    turn: number;
  }> = [];

  for (const [factionId, plan] of Object.entries(state.aiPlans.plansByFaction)) {
    if (!plan) continue;

    for (const turnPlan of plan.turnPlans) {
      if (turnPlan.actions.length > 0) {
        result.push({
          factionId,
          factionName: plan.factionName,
          actions: turnPlan.actions,
          turn: turnPlan.turn,
        });
      }
    }
  }

  // Sort by turn, then by faction
  return result.sort((a, b) => a.turn - b.turn || a.factionName.localeCompare(b.factionName));
};

/**
 * Get threats identified by AI factions
 */
export const selectIdentifiedThreats = (state: RootState, factionId: string) => {
  const plan = state.aiPlans.plansByFaction[factionId];
  return plan?.identifiedThreats || [];
};

/**
 * Get opportunities identified by AI factions  
 */
export const selectIdentifiedOpportunities = (state: RootState, factionId: string) => {
  const plan = state.aiPlans.plansByFaction[factionId];
  return plan?.identifiedOpportunities || [];
};

/**
 * Check if any faction is currently planning
 */
export const selectIsPlanningInProgress = (state: RootState) =>
  state.aiPlans.planningInProgress !== null;

/**
 * Get the faction currently planning
 */
export const selectPlanningFaction = (state: RootState) =>
  state.aiPlans.planningInProgress;

/**
 * Get plan summary for display
 */
export const selectPlanSummary = (state: RootState, factionId: string): string | null => {
  const plan = state.aiPlans.plansByFaction[factionId];
  return plan?.summary || null;
};

/**
 * Get plan confidence
 */
export const selectPlanConfidence = (state: RootState, factionId: string): number => {
  const plan = state.aiPlans.plansByFaction[factionId];
  return plan?.overallConfidence || 0;
};

// ============================================================================
// REDUCER EXPORT
// ============================================================================

export default aiPlansSlice.reducer;


