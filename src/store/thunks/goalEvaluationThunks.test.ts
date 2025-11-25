import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import factionsReducer from '../slices/factionsSlice';
import sectorReducer from '../slices/sectorSlice';
import turnReducer from '../slices/turnSlice';
import { evaluateStateGoals, evaluateFactionGoals } from './goalEvaluationThunks';
import type { Faction } from '../../types/faction';

describe('goalEvaluationThunks', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        factions: factionsReducer,
        sector: sectorReducer,
        turn: turnReducer,
      },
    });
  });

  describe('evaluateStateGoals', () => {
    it('should evaluate Wealth of Worlds goal', async () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Rich Faction',
        type: 'Corporation',
        homeworld: 'system-1',
        attributes: { hp: 20, maxHp: 20, force: 3, cunning: 3, wealth: 5 },
        facCreds: 100,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Wealth of Worlds',
          description: 'Spend 20 FacCreds (4 x 5)',
          isCompleted: false,
          progress: {
            current: 20,
            target: 20,
            metadata: { creditsSpent: 20 },
          },
          difficulty: 2,
        },
        assets: [],
      };

      // Add faction to store
      store.dispatch({ type: 'factions/addFaction', payload: faction });

      // Evaluate goals
      await store.dispatch(evaluateStateGoals());

      // Check that goal was marked complete and XP awarded
      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      expect(updatedFaction?.goal?.isCompleted).toBe(true);
      expect(updatedFaction?.xp).toBe(2); // XP reward
    });

    it('should evaluate Peaceable Kingdom goal', async () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Peaceful Faction',
        type: 'Religion',
        homeworld: 'system-1',
        attributes: { hp: 15, maxHp: 15, force: 2, cunning: 4, wealth: 2 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Peaceable Kingdom',
          description: 'No attacks for 4 turns',
          isCompleted: false,
          progress: {
            current: 4,
            target: 4,
            metadata: { turnsWithoutAttack: 4 },
          },
          difficulty: 1,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      await store.dispatch(evaluateStateGoals());

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      expect(updatedFaction?.goal?.isCompleted).toBe(true);
      expect(updatedFaction?.xp).toBe(1);
    });

    it('should skip factions with no goals', async () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Goalless Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: { hp: 29, maxHp: 29, force: 6, cunning: 5, wealth: 3 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: null,
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      await store.dispatch(evaluateStateGoals());

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      expect(updatedFaction?.goal).toBeNull();
      expect(updatedFaction?.xp).toBe(0);
    });

    it('should skip factions with event-based goals', async () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Military Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: { hp: 29, maxHp: 29, force: 6, cunning: 5, wealth: 3 },
        facCreds: 10,
        xp: 5,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Military Conquest',
          description: 'Destroy 6 Force assets',
          isCompleted: false,
          progress: { current: 2, target: 6 },
          difficulty: 3,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      await store.dispatch(evaluateStateGoals());

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      // Goal should remain unchanged (not evaluated)
      expect(updatedFaction?.goal?.progress.current).toBe(2);
      expect(updatedFaction?.xp).toBe(5); // No XP change
    });

    it('should skip already completed goals', async () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Rich Faction',
        type: 'Corporation',
        homeworld: 'system-1',
        attributes: { hp: 20, maxHp: 20, force: 3, cunning: 3, wealth: 5 },
        facCreds: 100,
        xp: 2,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Wealth of Worlds',
          description: 'Spend 20 FacCreds',
          isCompleted: true,
          progress: {
            current: 20,
            target: 20,
            metadata: { creditsSpent: 20 },
          },
          difficulty: 2,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      await store.dispatch(evaluateStateGoals());

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      // Should not double-award XP
      expect(updatedFaction?.xp).toBe(2);
    });

    it('should evaluate multiple factions simultaneously', async () => {
      const faction1: Faction = {
        id: 'faction-1',
        name: 'Faction 1',
        type: 'Corporation',
        homeworld: 'system-1',
        attributes: { hp: 20, maxHp: 20, force: 3, cunning: 3, wealth: 5 },
        facCreds: 100,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Wealth of Worlds',
          description: 'Spend 20 FacCreds',
          isCompleted: false,
          progress: {
            current: 20,
            target: 20,
            metadata: { creditsSpent: 20 },
          },
          difficulty: 2,
        },
        assets: [],
      };

      const faction2: Faction = {
        id: 'faction-2',
        name: 'Faction 2',
        type: 'Religion',
        homeworld: 'system-2',
        attributes: { hp: 15, maxHp: 15, force: 2, cunning: 4, wealth: 2 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-2',
          type: 'Peaceable Kingdom',
          description: 'No attacks for 4 turns',
          isCompleted: false,
          progress: {
            current: 4,
            target: 4,
            metadata: { turnsWithoutAttack: 4 },
          },
          difficulty: 1,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction1 });
      store.dispatch({ type: 'factions/addFaction', payload: faction2 });

      await store.dispatch(evaluateStateGoals());

      const state = store.getState();
      const updated1 = state.factions.factions.find(f => f.id === 'faction-1');
      const updated2 = state.factions.factions.find(f => f.id === 'faction-2');
      
      expect(updated1?.goal?.isCompleted).toBe(true);
      expect(updated1?.xp).toBe(2);
      
      expect(updated2?.goal?.isCompleted).toBe(true);
      expect(updated2?.xp).toBe(1);
    });
  });

  describe('evaluateFactionGoals', () => {
    it('should evaluate goals for a specific faction', async () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Rich Faction',
        type: 'Corporation',
        homeworld: 'system-1',
        attributes: { hp: 20, maxHp: 20, force: 3, cunning: 3, wealth: 5 },
        facCreds: 100,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Wealth of Worlds',
          description: 'Spend 20 FacCreds',
          isCompleted: false,
          progress: {
            current: 15,
            target: 20,
            metadata: { creditsSpent: 15 },
          },
          difficulty: 2,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      await store.dispatch(evaluateFactionGoals({ factionId: 'faction-1' }));

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      // Goal not complete yet, but progress should be updated
      expect(updatedFaction?.goal?.progress.current).toBe(15);
      expect(updatedFaction?.xp).toBe(0);
    });

    it('should do nothing for non-existent faction', async () => {
      await store.dispatch(evaluateFactionGoals({ factionId: 'non-existent' }));
      
      // Should not throw and state should be unchanged
      const state = store.getState();
      expect(state.factions.factions).toHaveLength(0);
    });

    it('should do nothing for faction with event-based goal', async () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Military Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: { hp: 29, maxHp: 29, force: 6, cunning: 5, wealth: 3 },
        facCreds: 10,
        xp: 5,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Blood the Enemy',
          description: 'Inflict 14 HP damage',
          isCompleted: false,
          progress: { current: 8, target: 14 },
          difficulty: 2,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      await store.dispatch(evaluateFactionGoals({ factionId: 'faction-1' }));

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      // Should remain unchanged
      expect(updatedFaction?.goal?.progress.current).toBe(8);
      expect(updatedFaction?.xp).toBe(5);
    });
  });
});

