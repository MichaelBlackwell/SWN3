import { describe, it, expect } from 'vitest';
import {
  GOAL_DEFINITIONS,
  getGoalDefinition,
  calculateGoalDifficulty,
  getStateBasedGoals,
  getEventBasedGoals,
  evaluateFactionGoal,
} from './GoalRegistry';
import type { Faction } from '../types/faction';
import type { RootState } from '../store/store';

describe('GoalRegistry', () => {
  describe('GOAL_DEFINITIONS', () => {
    it('should contain all 12 faction goals', () => {
      const goalTypes = Object.keys(GOAL_DEFINITIONS);
      expect(goalTypes).toHaveLength(11); // Actually 11 unique types in FactionGoalType
      
      // Verify all expected goals are present
      expect(GOAL_DEFINITIONS['Military Conquest']).toBeDefined();
      expect(GOAL_DEFINITIONS['Commercial Expansion']).toBeDefined();
      expect(GOAL_DEFINITIONS['Intelligence Coup']).toBeDefined();
      expect(GOAL_DEFINITIONS['Planetary Seizure']).toBeDefined();
      expect(GOAL_DEFINITIONS['Expand Influence']).toBeDefined();
      expect(GOAL_DEFINITIONS['Blood the Enemy']).toBeDefined();
      expect(GOAL_DEFINITIONS['Peaceable Kingdom']).toBeDefined();
      expect(GOAL_DEFINITIONS['Destroy the Foe']).toBeDefined();
      expect(GOAL_DEFINITIONS['Inside Enemy Territory']).toBeDefined();
      expect(GOAL_DEFINITIONS['Invincible Valor']).toBeDefined();
      expect(GOAL_DEFINITIONS['Wealth of Worlds']).toBeDefined();
    });

    it('should have proper difficulty values', () => {
      expect(GOAL_DEFINITIONS['Peaceable Kingdom'].difficulty).toBe(1);
      expect(GOAL_DEFINITIONS['Blood the Enemy'].difficulty).toBe(2);
      expect(GOAL_DEFINITIONS['Wealth of Worlds'].difficulty).toBe(2);
    });

    it('should correctly categorize state-based vs event-based goals', () => {
      // State-based goals
      expect(GOAL_DEFINITIONS['Peaceable Kingdom'].isStateBased).toBe(true);
      expect(GOAL_DEFINITIONS['Inside Enemy Territory'].isStateBased).toBe(true);
      expect(GOAL_DEFINITIONS['Wealth of Worlds'].isStateBased).toBe(true);
      
      // Event-based goals
      expect(GOAL_DEFINITIONS['Military Conquest'].isStateBased).toBe(false);
      expect(GOAL_DEFINITIONS['Commercial Expansion'].isStateBased).toBe(false);
      expect(GOAL_DEFINITIONS['Blood the Enemy'].isStateBased).toBe(false);
    });
  });

  describe('getGoalDefinition', () => {
    it('should return the correct goal definition', () => {
      const def = getGoalDefinition('Wealth of Worlds');
      expect(def).toBeDefined();
      expect(def?.type).toBe('Wealth of Worlds');
      expect(def?.difficulty).toBe(2);
    });

    it('should return undefined for invalid goal type', () => {
      const def = getGoalDefinition('Invalid Goal' as any);
      expect(def).toBeUndefined();
    });
  });

  describe('calculateGoalDifficulty', () => {
    const testFaction: Faction = {
      id: 'faction-1',
      name: 'Test Faction',
      type: 'Government',
      homeworld: 'system-1',
      attributes: {
        hp: 29,
        maxHp: 29,
        force: 6,
        cunning: 5,
        wealth: 3,
      },
      facCreds: 10,
      xp: 0,
      tags: [],
      goal: null,
      assets: [],
    };

    it('should calculate difficulty for Military Conquest based on Force', () => {
      const difficulty = calculateGoalDifficulty('Military Conquest', testFaction);
      expect(difficulty).toBe(3); // ceil(6 / 2)
    });

    it('should calculate difficulty for Commercial Expansion based on Wealth', () => {
      const difficulty = calculateGoalDifficulty('Commercial Expansion', testFaction);
      expect(difficulty).toBe(2); // ceil(3 / 2)
    });

    it('should calculate difficulty for Intelligence Coup based on Cunning', () => {
      const difficulty = calculateGoalDifficulty('Intelligence Coup', testFaction);
      expect(difficulty).toBe(3); // ceil(5 / 2)
    });

    it('should return fixed difficulty for non-function difficulties', () => {
      const difficulty = calculateGoalDifficulty('Blood the Enemy', testFaction);
      expect(difficulty).toBe(2);
    });
  });

  describe('getStateBasedGoals', () => {
    it('should return only state-based goals', () => {
      const stateGoals = getStateBasedGoals();
      expect(stateGoals.length).toBeGreaterThan(0);
      expect(stateGoals.every(g => g.isStateBased)).toBe(true);
      
      // Should include known state-based goals
      const types = stateGoals.map(g => g.type);
      expect(types).toContain('Peaceable Kingdom');
      expect(types).toContain('Wealth of Worlds');
      expect(types).toContain('Inside Enemy Territory');
    });
  });

  describe('getEventBasedGoals', () => {
    it('should return only event-based goals', () => {
      const eventGoals = getEventBasedGoals();
      expect(eventGoals.length).toBeGreaterThan(0);
      expect(eventGoals.every(g => !g.isStateBased)).toBe(true);
      
      // Should include known event-based goals
      const types = eventGoals.map(g => g.type);
      expect(types).toContain('Military Conquest');
      expect(types).toContain('Blood the Enemy');
    });
  });

  describe('evaluateFactionGoal', () => {
    const mockState = {
      factions: { factions: [], selectedFactionId: null, assetsFailedMaintenance: {} },
      sector: { systems: [], selectedSystemId: null, sector: null },
      turn: { currentTurn: 5, phase: 'Action', actionsThisTurn: [] },
    } as RootState;

    describe('Wealth of Worlds', () => {
      it('should evaluate progress correctly', () => {
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
            progress: {
              current: 12,
              target: 20,
              metadata: { creditsSpent: 12 },
            },
            difficulty: 2,
            isCompleted: false,
          },
          assets: [],
        };

        const result = evaluateFactionGoal(faction, mockState);
        
        expect(result).not.toBeNull();
        expect(result?.current).toBe(12);
        expect(result?.target).toBe(20); // 5 * 4
        expect(result?.isCompleted).toBe(false);
      });

      it('should mark as completed when target reached', () => {
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
              current: 20,
              target: 20,
              metadata: { creditsSpent: 20 },
            },
            difficulty: 2,
          },
          assets: [],
        };

        const result = evaluateFactionGoal(faction, mockState);
        
        expect(result?.isCompleted).toBe(true);
      });
    });

    describe('Peaceable Kingdom', () => {
      it('should evaluate turns without attack', () => {
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
              current: 2,
              target: 4,
              metadata: { turnsWithoutAttack: 2 },
            },
            difficulty: 1,
          },
          assets: [],
        };

        const result = evaluateFactionGoal(faction, mockState);
        
        expect(result?.current).toBe(2);
        expect(result?.target).toBe(4);
        expect(result?.isCompleted).toBe(false);
      });

      it('should mark as completed after 4 turns', () => {
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

        const result = evaluateFactionGoal(faction, mockState);
        
        expect(result?.isCompleted).toBe(true);
      });
    });

    describe('Inside Enemy Territory', () => {
      it('should count stealthed assets on enemy worlds', () => {
        const faction: Faction = {
          id: 'faction-1',
          name: 'Sneaky Faction',
          type: 'Criminal Organization',
          homeworld: 'system-1',
          attributes: { hp: 15, maxHp: 15, force: 2, cunning: 4, wealth: 2 },
          facCreds: 10,
          xp: 0,
          tags: [],
          goal: {
            id: 'goal-1',
            type: 'Inside Enemy Territory',
            description: 'Have 4 stealthed assets on enemy worlds',
            isCompleted: false,
            progress: {
              current: 2,
              target: 4,
              metadata: { 
                goalStartTurn: 3,
                trackedAssetIds: ['asset-1', 'asset-2'],
                stealthedCount: 2,
              },
            },
            difficulty: 2,
          },
          assets: [
            {
              id: 'asset-1',
              definitionId: 'cunning_3_covert_ops',
              location: 'system-2', // Enemy territory
              hp: 5,
              maxHp: 5,
              stealthed: true,
            },
            {
              id: 'asset-2',
              definitionId: 'cunning_2_sabotage_teams',
              location: 'system-3', // Enemy territory
              hp: 4,
              maxHp: 4,
              stealthed: true,
            },
            {
              id: 'asset-3',
              definitionId: 'force_1_security_personnel',
              location: 'system-1', // Homeworld, shouldn't count
              hp: 3,
              maxHp: 3,
              stealthed: true,
            },
          ],
        };

        const result = evaluateFactionGoal(faction, mockState);
        
        expect(result?.current).toBe(2);
        expect(result?.target).toBe(4);
        expect(result?.isCompleted).toBe(false);
      });
    });

    describe('Event-based goals', () => {
      it('should return null for event-based goals', () => {
        const faction: Faction = {
          id: 'faction-1',
          name: 'Military Faction',
          type: 'Government',
          homeworld: 'system-1',
          attributes: { hp: 29, maxHp: 29, force: 6, cunning: 5, wealth: 3 },
          facCreds: 10,
          xp: 0,
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

        const result = evaluateFactionGoal(faction, mockState);
        
        expect(result).toBeNull();
      });
    });

    describe('No goal', () => {
      it('should return null when faction has no goal', () => {
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

        const result = evaluateFactionGoal(faction, mockState);
        
        expect(result).toBeNull();
      });
    });
  });
});

