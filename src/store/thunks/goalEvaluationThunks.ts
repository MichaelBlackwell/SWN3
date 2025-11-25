/**
 * Redux thunks for evaluating faction goals
 * 
 * These thunks handle state-based goal evaluation during turn phases
 * (e.g., at the end of Action phase or during Maintenance)
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '../rootReducer';
import { updateGoalProgress } from '../slices/factionsSlice';
import { evaluateFactionGoal } from '../../services/GoalRegistry';
import type { Faction } from '../../types/faction';

/**
 * Evaluate all state-based goals for all factions
 * 
 * This should be called during turn transitions (e.g., at the end of Action phase)
 * to check if any state-based goals have been completed.
 */
export const evaluateStateGoals = createAsyncThunk<
  void,
  void,
  { state: RootState }
>('goals/evaluateStateGoals', async (_, { getState, dispatch }) => {
  const state = getState();
  const factions = state.factions.factions;
  
  // Evaluate each faction's goal
  for (const faction of factions) {
    // Skip if faction has no goal or goal is already completed
    if (!faction.goal || faction.goal.isCompleted) {
      continue;
    }
    
    // Evaluate the goal
    const evaluation = evaluateFactionGoal(faction, state);
    
    // Skip if goal cannot be evaluated from state (event-based goal)
    if (!evaluation) {
      continue;
    }
    
    // Update goal progress
    dispatch(
      updateGoalProgress({
        factionId: faction.id,
        current: evaluation.current,
        metadata: evaluation.metadata,
      })
    );
    
    // The updateGoalProgress reducer will handle marking as complete and awarding XP if target is reached
  }
});

/**
 * Evaluate goals for a specific faction
 * 
 * Useful when you want to check a single faction's goal status
 * (e.g., after a specific action that might affect their goal)
 */
export const evaluateFactionGoals = createAsyncThunk<
  void,
  { factionId: string },
  { state: RootState }
>('goals/evaluateFactionGoals', async ({ factionId }, { getState, dispatch }) => {
  const state = getState();
  const faction = state.factions.factions.find((f: Faction) => f.id === factionId);
  
  if (!faction || !faction.goal || faction.goal.isCompleted) {
    return;
  }
  
  const evaluation = evaluateFactionGoal(faction, state);
  
  if (!evaluation) {
    return;
  }
  
  dispatch(
    updateGoalProgress({
      factionId: faction.id,
      current: evaluation.current,
      metadata: evaluation.metadata,
    })
  );
});

