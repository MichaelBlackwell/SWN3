// Unit tests for factions slice, specifically combat damage actions

import { describe, it, expect, beforeEach } from 'vitest';
import factionsReducer, {
  addFaction,
  addAsset,
  inflictDamage,
  inflictFactionDamage,
  addXP,
  setGoal,
  completeGoal,
  updateGoalProgress,
  upgradeAttribute,
  type FactionsState,
} from './factionsSlice';
import type { Faction, FactionGoal } from '../../types/faction';

describe('factionsSlice - Combat Damage', () => {
  let initialState: FactionsState;
  let testFaction: Faction;

  beforeEach(() => {
    initialState = {
      factions: [],
      selectedFactionId: null,
      assetsFailedMaintenance: {},
    };

    // Create a test faction with assets
    testFaction = {
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
  });

  describe('inflictDamage', () => {
    it('should reduce asset HP when damage is applied', () => {
      // Add faction with an asset
      let state = factionsReducer(initialState, addFaction(testFaction));
      state = factionsReducer(
        state,
        addAsset({
          factionId: 'faction-1',
          assetDefinitionId: 'force_1_security_personnel', // 3 HP
          location: 'system-1',
        })
      );

      const assetId = state.factions[0].assets[0].id;
      const initialHp = state.factions[0].assets[0].hp;

      // Apply 2 damage
      state = factionsReducer(
        state,
        inflictDamage({
          factionId: 'faction-1',
          assetId,
          damage: 2,
        })
      );

      expect(state.factions[0].assets[0].hp).toBe(initialHp - 2);
      expect(state.factions[0].attributes.hp).toBe(29); // Faction HP unchanged for regular assets
    });

    it('should destroy asset when HP reaches 0', () => {
      let state = factionsReducer(initialState, addFaction(testFaction));
      state = factionsReducer(
        state,
        addAsset({
          factionId: 'faction-1',
          assetDefinitionId: 'force_1_security_personnel', // 3 HP
          location: 'system-1',
        })
      );

      const assetId = state.factions[0].assets[0].id;
      expect(state.factions[0].assets.length).toBe(1);

      // Apply 3 damage (exactly the HP)
      state = factionsReducer(
        state,
        inflictDamage({
          factionId: 'faction-1',
          assetId,
          damage: 3,
        })
      );

      expect(state.factions[0].assets.length).toBe(0);
      expect(state.factions[0].assets.find((a) => a.id === assetId)).toBeUndefined();
    });

    it('should apply overflow damage to faction HP when asset is destroyed', () => {
      let state = factionsReducer(initialState, addFaction(testFaction));
      state = factionsReducer(
        state,
        addAsset({
          factionId: 'faction-1',
          assetDefinitionId: 'force_1_security_personnel', // 3 HP
          location: 'system-1',
        })
      );

      const assetId = state.factions[0].assets[0].id;
      const initialFactionHp = state.factions[0].attributes.hp;

      // Apply 5 damage (3 to destroy asset, 2 overflow)
      state = factionsReducer(
        state,
        inflictDamage({
          factionId: 'faction-1',
          assetId,
          damage: 5,
        })
      );

      expect(state.factions[0].assets.length).toBe(0);
      expect(state.factions[0].attributes.hp).toBe(initialFactionHp - 2); // Overflow damage applied
    });

    it('should not apply overflow damage for Base of Influence', () => {
      let state = factionsReducer(initialState, addFaction(testFaction));
      
      // Add a Base of Influence (we'll simulate it by using damageToBase flag)
      // For now, we'll test with a regular asset but mark it as a base
      state = factionsReducer(
        state,
        addAsset({
          factionId: 'faction-1',
          assetDefinitionId: 'force_1_security_personnel', // 3 HP
          location: 'system-1',
        })
      );

      const assetId = state.factions[0].assets[0].id;
      const initialFactionHp = state.factions[0].attributes.hp;

      // Apply 5 damage to a "base" (3 to destroy, 2 overflow)
      // Base damage: faction takes 3 damage (what base had)
      // Overflow: faction does NOT take the 2 overflow
      state = factionsReducer(
        state,
        inflictDamage({
          factionId: 'faction-1',
          assetId,
          damage: 5,
          damageToBase: true,
        })
      );

      expect(state.factions[0].assets.length).toBe(0);
      // Faction should take 3 damage (base HP), not 5 (no overflow)
      expect(state.factions[0].attributes.hp).toBe(initialFactionHp - 3);
    });

    it('should apply damage to faction HP when Base of Influence is damaged', () => {
      let state = factionsReducer(initialState, addFaction(testFaction));
      state = factionsReducer(
        state,
        addAsset({
          factionId: 'faction-1',
          assetDefinitionId: 'force_1_security_personnel', // 3 HP
          location: 'system-1',
        })
      );

      const assetId = state.factions[0].assets[0].id;
      const initialFactionHp = state.factions[0].attributes.hp;

      // Apply 2 damage to a base (not enough to destroy)
      state = factionsReducer(
        state,
        inflictDamage({
          factionId: 'faction-1',
          assetId,
          damage: 2,
          damageToBase: true,
        })
      );

      // Asset should take 2 damage
      expect(state.factions[0].assets[0].hp).toBe(1);
      // Faction should also take 2 damage
      expect(state.factions[0].attributes.hp).toBe(initialFactionHp - 2);
    });

    it('should handle multiple assets and only damage the specified one', () => {
      let state = factionsReducer(initialState, addFaction(testFaction));
      
      // Add two assets
      state = factionsReducer(
        state,
        addAsset({
          factionId: 'faction-1',
          assetDefinitionId: 'force_1_security_personnel', // 3 HP
          location: 'system-1',
        })
      );
      state = factionsReducer(
        state,
        addAsset({
          factionId: 'faction-1',
          assetDefinitionId: 'force_1_hitmen', // 1 HP
          location: 'system-1',
        })
      );

      expect(state.factions[0].assets.length).toBe(2);
      const firstAssetId = state.factions[0].assets[0].id;
      const secondAssetId = state.factions[0].assets[1].id;

      // Damage only the first asset
      state = factionsReducer(
        state,
        inflictDamage({
          factionId: 'faction-1',
          assetId: firstAssetId,
          damage: 2,
        })
      );

      expect(state.factions[0].assets.length).toBe(2);
      expect(state.factions[0].assets[0].hp).toBe(1); // First asset damaged
      expect(state.factions[0].assets[1].hp).toBe(1); // Second asset unchanged
    });

    it('should not allow faction HP to go below 0', () => {
      let state = factionsReducer(initialState, addFaction(testFaction));
      state.factions[0].attributes.hp = 2; // Low HP
      
      state = factionsReducer(
        state,
        addAsset({
          factionId: 'faction-1',
          assetDefinitionId: 'force_1_security_personnel', // 3 HP
          location: 'system-1',
        })
      );

      const assetId = state.factions[0].assets[0].id;

      // Apply massive damage that would overflow
      state = factionsReducer(
        state,
        inflictDamage({
          factionId: 'faction-1',
          assetId,
          damage: 100,
        })
      );

      expect(state.factions[0].attributes.hp).toBe(0); // Not negative
      expect(state.factions[0].assets.length).toBe(0); // Asset destroyed
    });
  });

  describe('inflictFactionDamage', () => {
    it('should reduce faction HP directly', () => {
      let state = factionsReducer(initialState, addFaction(testFaction));
      const initialHp = state.factions[0].attributes.hp;

      state = factionsReducer(
        state,
        inflictFactionDamage({
          factionId: 'faction-1',
          damage: 5,
        })
      );

      expect(state.factions[0].attributes.hp).toBe(initialHp - 5);
    });

    it('should not allow faction HP to go below 0', () => {
      let state = factionsReducer(initialState, addFaction(testFaction));
      state.factions[0].attributes.hp = 3;

      state = factionsReducer(
        state,
        inflictFactionDamage({
          factionId: 'faction-1',
          damage: 100,
        })
      );

      expect(state.factions[0].attributes.hp).toBe(0);
    });

    it('should do nothing if faction does not exist', () => {
      const state = factionsReducer(
        initialState,
        inflictFactionDamage({
          factionId: 'non-existent',
          damage: 10,
        })
      );

      expect(state.factions.length).toBe(0);
    });
  });

  describe('Special Features Integration', () => {
    describe('Purchase-time effects', () => {
      it('should automatically set Psychic Assassins as stealthed when purchased', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        // Ensure faction has enough credits and Force rating
        state.factions[0].facCreds = 20;
        state.factions[0].attributes.force = 5;

        state = factionsReducer(
          state,
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'force_5_psychic_assassins',
            location: 'system-1',
          })
        );

        const asset = state.factions[0].assets[0];
        expect(asset).toBeDefined();
        expect(asset.stealthed).toBe(true);
        expect(asset.definitionId).toBe('force_5_psychic_assassins');
      });

      it('should not auto-stealth assets without purchase effects', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        state.factions[0].facCreds = 20;
        state.factions[0].attributes.force = 3;

        state = factionsReducer(
          state,
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'force_3_zealots',
            location: 'system-1',
          })
        );

        const asset = state.factions[0].assets[0];
        expect(asset).toBeDefined();
        expect(asset.stealthed).toBe(false);
      });
    });

    describe('Maintenance modifiers', () => {
      it('should apply additional maintenance cost for Capital Fleet', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        // Set up faction with enough credits and Force rating
        state.factions[0].facCreds = 50;
        state.factions[0].attributes.force = 8;

        // Purchase Capital Fleet (cost 40, base maintenance 0, special +2)
        state = factionsReducer(
          state,
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'force_8_capital_fleet',
            location: 'system-1',
          })
        );

        expect(state.factions[0].facCreds).toBe(10); // 50 - 40 = 10

        // Process maintenance phase
        state = factionsReducer(state, { type: 'factions/processMaintenancePhase' });

        // Capital Fleet should cost 2 FacCreds maintenance (0 base + 2 special)
        expect(state.factions[0].facCreds).toBe(8); // 10 - 2 = 8
      });

      it('should apply additional maintenance cost for Mercenaries', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        state.factions[0].facCreds = 20;
        state.factions[0].attributes.wealth = 3;

        // Purchase Mercenaries (cost 8, base maintenance 0, special +1)
        state = factionsReducer(
          state,
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'wealth_3_mercenaries',
            location: 'system-1',
          })
        );

        expect(state.factions[0].facCreds).toBe(12); // 20 - 8 = 12

        // Process maintenance phase
        state = factionsReducer(state, { type: 'factions/processMaintenancePhase' });

        // Mercenaries should cost 1 FacCred maintenance (0 base + 1 special)
        expect(state.factions[0].facCreds).toBe(11); // 12 - 1 = 11
      });

      it('should apply additional maintenance cost for Pretech Researchers', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        state.factions[0].facCreds = 20;
        state.factions[0].attributes.wealth = 5;

        // Purchase Pretech Researchers (cost 14, base maintenance 0, special +1)
        state = factionsReducer(
          state,
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'wealth_5_pretech_researchers',
            location: 'system-1',
          })
        );

        expect(state.factions[0].facCreds).toBe(6); // 20 - 14 = 6

        // Process maintenance phase
        state = factionsReducer(state, { type: 'factions/processMaintenancePhase' });

        // Pretech Researchers should cost 1 FacCred maintenance (0 base + 1 special)
        expect(state.factions[0].facCreds).toBe(5); // 6 - 1 = 5
      });

      it('should apply additional maintenance cost for Scavenger Fleet', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        state.factions[0].facCreds = 40;
        state.factions[0].attributes.wealth = 8;

        // Purchase Scavenger Fleet (cost 30, base maintenance 0, special +2)
        state = factionsReducer(
          state,
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'wealth_8_scavenger_fleet',
            location: 'system-1',
          })
        );

        expect(state.factions[0].facCreds).toBe(10); // 40 - 30 = 10

        // Process maintenance phase
        state = factionsReducer(state, { type: 'factions/processMaintenancePhase' });

        // Scavenger Fleet should cost 2 FacCreds maintenance (0 base + 2 special)
        expect(state.factions[0].facCreds).toBe(8); // 10 - 2 = 8
      });

      it('should combine base maintenance with special feature modifiers', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        state.factions[0].facCreds = 50;
        state.factions[0].attributes.force = 8;

        // Purchase Capital Fleet and another asset with base maintenance
        state = factionsReducer(
          state,
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'force_8_capital_fleet', // 0 base + 2 special = 2 total
            location: 'system-1',
          })
        );

        // Process maintenance phase
        state = factionsReducer(state, { type: 'factions/processMaintenancePhase' });

        // Should have paid 2 FacCreds for Capital Fleet maintenance
        expect(state.factions[0].facCreds).toBe(8); // 10 (after purchase) - 2 = 8
      });

      it('should handle multiple assets with maintenance modifiers', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        state.factions[0].facCreds = 100;
        state.factions[0].attributes.force = 8;
        state.factions[0].attributes.wealth = 8;

        // Purchase Capital Fleet (2 maintenance) and Scavenger Fleet (2 maintenance)
        state = factionsReducer(
          state,
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'force_8_capital_fleet',
            location: 'system-1',
          })
        );
        state = factionsReducer(
          state,
          addAsset({
            factionId: 'faction-1',
            assetDefinitionId: 'wealth_8_scavenger_fleet',
            location: 'system-1',
          })
        );

        expect(state.factions[0].facCreds).toBe(30); // 100 - 40 - 30 = 30

        // Process maintenance phase
        state = factionsReducer(state, { type: 'factions/processMaintenancePhase' });

        // Should have paid 4 FacCreds total (2 + 2)
        expect(state.factions[0].facCreds).toBe(26); // 30 - 4 = 26
      });
    });
  });

  describe('XP and Goals System', () => {
    describe('Initial State', () => {
      it('should have xp initialized to 0 when faction is created', () => {
        const state = factionsReducer(initialState, addFaction(testFaction));

        expect(state.factions[0].xp).toBe(0);
        expect(state.factions[0].xp).toBeDefined();
      });

      it('should have goal initialized to null when faction is created', () => {
        const state = factionsReducer(initialState, addFaction(testFaction));

        expect(state.factions[0].goal).toBeNull();
      });
    });

    describe('addXP', () => {
      it('should add XP to a faction', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        expect(state.factions[0].xp).toBe(0);

        state = factionsReducer(
          state,
          addXP({
            factionId: 'faction-1',
            amount: 5,
          })
        );

        expect(state.factions[0].xp).toBe(5);
      });

      it('should accumulate XP correctly with multiple additions', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));

        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 3 }));
        expect(state.factions[0].xp).toBe(3);

        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 7 }));
        expect(state.factions[0].xp).toBe(10);

        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 2 }));
        expect(state.factions[0].xp).toBe(12);
      });

      it('should not allow XP to go negative', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));

        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 5 }));
        expect(state.factions[0].xp).toBe(5);

        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: -10 }));
        expect(state.factions[0].xp).toBe(0); // Should be capped at 0
      });

      it('should maintain state immutability', () => {
        const state = factionsReducer(initialState, addFaction(testFaction));
        const originalXP = state.factions[0].xp;

        const newState = factionsReducer(
          state,
          addXP({ factionId: 'faction-1', amount: 5 })
        );

        // Original state should be unchanged
        expect(state.factions[0].xp).toBe(originalXP);
        // New state should have updated XP
        expect(newState.factions[0].xp).toBe(originalXP + 5);
        // Should be different objects
        expect(newState).not.toBe(state);
        expect(newState.factions[0]).not.toBe(state.factions[0]);
      });
    });

    describe('setGoal', () => {
      it('should set a goal for a faction', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        expect(state.factions[0].goal).toBeNull();

        const testGoal: FactionGoal = {
          id: 'goal-1',
          type: 'Military Conquest',
          description: 'Destroy Force assets equal to faction Force rating',
          progress: {
            current: 0,
            target: 6, // Force rating of test faction
          },
          difficulty: 3,
          isCompleted: false,
        };

        state = factionsReducer(
          state,
          setGoal({
            factionId: 'faction-1',
            goal: testGoal,
          })
        );

        expect(state.factions[0].goal).toEqual(testGoal);
        expect(state.factions[0].goal?.type).toBe('Military Conquest');
        expect(state.factions[0].goal?.isCompleted).toBe(false);
      });

      it('should clear a goal when set to null', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));

        const testGoal: FactionGoal = {
          id: 'goal-1',
          type: 'Expand Influence',
          description: 'Plant Base of Influence on a new world',
          progress: { current: 0, target: 1 },
          difficulty: 1,
          isCompleted: false,
        };

        state = factionsReducer(state, setGoal({ factionId: 'faction-1', goal: testGoal }));
        expect(state.factions[0].goal).not.toBeNull();

        state = factionsReducer(state, setGoal({ factionId: 'faction-1', goal: null }));
        expect(state.factions[0].goal).toBeNull();
      });
    });

    describe('updateGoalProgress', () => {
      it('should update goal progress', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));

        const testGoal: FactionGoal = {
          id: 'goal-1',
          type: 'Blood the Enemy',
          description: 'Inflict HP damage equal to sum of attributes',
          progress: { current: 0, target: 14 }, // 6+5+3 = 14
          difficulty: 2,
          isCompleted: false,
        };

        state = factionsReducer(state, setGoal({ factionId: 'faction-1', goal: testGoal }));

        state = factionsReducer(
          state,
          updateGoalProgress({
            factionId: 'faction-1',
            current: 7,
          })
        );

        expect(state.factions[0].goal?.progress.current).toBe(7);
        expect(state.factions[0].goal?.isCompleted).toBe(false);
      });

      it('should auto-complete goal when target is reached', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));

        const testGoal: FactionGoal = {
          id: 'goal-1',
          type: 'Expand Influence',
          description: 'Plant Base of Influence',
          progress: { current: 0, target: 1 },
          difficulty: 1,
          isCompleted: false,
        };

        state = factionsReducer(state, setGoal({ factionId: 'faction-1', goal: testGoal }));
        expect(state.factions[0].xp).toBe(0);

        state = factionsReducer(
          state,
          updateGoalProgress({
            factionId: 'faction-1',
            current: 1,
          })
        );

        expect(state.factions[0].goal?.isCompleted).toBe(true);
        expect(state.factions[0].xp).toBe(1); // Should award XP automatically
      });

      it('should update metadata when provided', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));

        const testGoal: FactionGoal = {
          id: 'goal-1',
          type: 'Peaceable Kingdom',
          description: 'No attacks for 4 turns',
          progress: { current: 0, target: 4, metadata: { turnsWithoutAttack: 0 } },
          difficulty: 1,
          isCompleted: false,
        };

        state = factionsReducer(state, setGoal({ factionId: 'faction-1', goal: testGoal }));

        state = factionsReducer(
          state,
          updateGoalProgress({
            factionId: 'faction-1',
            current: 2,
            metadata: { turnsWithoutAttack: 2, lastTurnNumber: 5 },
          })
        );

        expect(state.factions[0].goal?.progress.metadata?.turnsWithoutAttack).toBe(2);
        expect(state.factions[0].goal?.progress.metadata?.lastTurnNumber).toBe(5);
      });
    });

    describe('completeGoal', () => {
      it('should mark goal as completed and award XP', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));

        const testGoal: FactionGoal = {
          id: 'goal-1',
          type: 'Wealth of Worlds',
          description: 'Spend 4x Wealth rating in FacCreds',
          progress: { current: 12, target: 12 }, // 3 * 4 = 12
          difficulty: 2,
          isCompleted: false,
        };

        state = factionsReducer(state, setGoal({ factionId: 'faction-1', goal: testGoal }));
        expect(state.factions[0].xp).toBe(0);

        state = factionsReducer(state, completeGoal({ factionId: 'faction-1' }));

        expect(state.factions[0].goal?.isCompleted).toBe(true);
        expect(state.factions[0].xp).toBe(2); // difficulty = 2
      });

      it('should do nothing if faction has no goal', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        expect(state.factions[0].goal).toBeNull();
        expect(state.factions[0].xp).toBe(0);

        state = factionsReducer(state, completeGoal({ factionId: 'faction-1' }));

        expect(state.factions[0].goal).toBeNull();
        expect(state.factions[0].xp).toBe(0);
      });
    });
  });

  describe('upgradeAttribute', () => {
    describe('successful upgrades', () => {
      it('should upgrade force attribute when sufficient XP is available', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        // Give faction 10 XP (enough to upgrade from 6 to 7, cost = 16 would fail, but 6->7 needs cost for level 7 which is 16)
        // Wait, let me recalculate: faction has force=6, to upgrade to 7 costs xpCosts[7] = 16
        // So we need 16 XP
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 16 }));
        
        const initialForce = state.factions[0].attributes.force;
        const initialXP = state.factions[0].xp;
        const initialMaxHp = state.factions[0].attributes.maxHp;
        const initialHp = state.factions[0].attributes.hp;
        
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'force' })
        );
        
        expect(state.factions[0].attributes.force).toBe(initialForce + 1); // 6 -> 7
        expect(state.factions[0].xp).toBe(initialXP - 16); // 16 - 16 = 0
        expect(state.factions[0].attributes.maxHp).toBeGreaterThan(initialMaxHp);
        expect(state.factions[0].attributes.hp).toBeGreaterThan(initialHp); // HP increases with maxHp
      });

      it('should upgrade cunning attribute', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        // Faction has cunning=5, upgrading to 6 costs xpCosts[6] = 12
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 12 }));
        
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'cunning' })
        );
        
        expect(state.factions[0].attributes.cunning).toBe(6);
        expect(state.factions[0].xp).toBe(0);
      });

      it('should upgrade wealth attribute', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        // Faction has wealth=3, upgrading to 4 costs xpCosts[4] = 6
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 6 }));
        
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'wealth' })
        );
        
        expect(state.factions[0].attributes.wealth).toBe(4);
        expect(state.factions[0].xp).toBe(0);
      });

      it('should leave remaining XP after upgrade', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        // Give faction 10 XP, upgrade wealth from 3->4 costs 6
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 10 }));
        
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'wealth' })
        );
        
        expect(state.factions[0].attributes.wealth).toBe(4);
        expect(state.factions[0].xp).toBe(4); // 10 - 6 = 4
      });

      it('should allow multiple consecutive upgrades', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        // Give faction 100 XP for multiple upgrades
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 100 }));
        
        // Upgrade wealth from 3->4 (cost 6)
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'wealth' })
        );
        expect(state.factions[0].attributes.wealth).toBe(4);
        expect(state.factions[0].xp).toBe(94);
        
        // Upgrade wealth from 4->5 (cost 9)
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'wealth' })
        );
        expect(state.factions[0].attributes.wealth).toBe(5);
        expect(state.factions[0].xp).toBe(85);
      });
    });

    describe('validation and edge cases', () => {
      it('should reject upgrade when XP is insufficient', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        // Give only 5 XP, but upgrading wealth from 3->4 costs 6
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 5 }));
        
        const initialWealth = state.factions[0].attributes.wealth;
        const initialXP = state.factions[0].xp;
        
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'wealth' })
        );
        
        // Should not change
        expect(state.factions[0].attributes.wealth).toBe(initialWealth);
        expect(state.factions[0].xp).toBe(initialXP);
      });

      it('should reject upgrade when attribute is already at max (8)', () => {
        // Create a faction with force already at 8
        const maxForceFaction: Faction = {
          ...testFaction,
          attributes: {
            ...testFaction.attributes,
            force: 8,
          },
        };
        
        let state = factionsReducer(initialState, addFaction(maxForceFaction));
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 100 }));
        
        const initialXP = state.factions[0].xp;
        
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'force' })
        );
        
        // Should not change
        expect(state.factions[0].attributes.force).toBe(8);
        expect(state.factions[0].xp).toBe(initialXP); // XP not deducted
      });

      it('should do nothing for non-existent faction', () => {
        const state = factionsReducer(
          initialState,
          upgradeAttribute({ factionId: 'non-existent', attributeName: 'force' })
        );
        
        expect(state.factions.length).toBe(0);
      });
    });

    describe('maxHp and hp updates', () => {
      it('should increase maxHp when attribute is upgraded', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 6 }));
        
        const initialMaxHp = state.factions[0].attributes.maxHp;
        
        // Upgrade wealth from 3->4
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'wealth' })
        );
        
        // maxHp formula: 4 + xpCosts[force] + xpCosts[cunning] + xpCosts[wealth]
        // Initial: 4 + 12 + 9 + 4 = 29
        // After upgrade: 4 + 12 + 9 + 6 = 31
        expect(state.factions[0].attributes.maxHp).toBe(31);
        expect(state.factions[0].attributes.maxHp).toBeGreaterThan(initialMaxHp);
      });

      it('should increase current HP by the same amount as maxHp increase', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 6 }));
        
        const initialHp = state.factions[0].attributes.hp;
        const initialMaxHp = state.factions[0].attributes.maxHp;
        
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'wealth' })
        );
        
        const newHp = state.factions[0].attributes.hp;
        const newMaxHp = state.factions[0].attributes.maxHp;
        const hpIncrease = newHp - initialHp;
        const maxHpIncrease = newMaxHp - initialMaxHp;
        
        expect(hpIncrease).toBe(maxHpIncrease);
        expect(newHp).toBe(initialHp + 2); // 29 + 2 = 31
      });

      it('should correctly update HP even when faction is damaged', () => {
        let state = factionsReducer(initialState, addFaction(testFaction));
        
        // Damage the faction to 20 HP (from 29)
        state = factionsReducer(
          state,
          inflictFactionDamage({ factionId: 'faction-1', damage: 9 })
        );
        expect(state.factions[0].attributes.hp).toBe(20);
        
        // Give XP and upgrade
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 6 }));
        
        state = factionsReducer(
          state,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'wealth' })
        );
        
        // maxHp goes from 29 to 31 (+2), so HP should go from 20 to 22
        expect(state.factions[0].attributes.maxHp).toBe(31);
        expect(state.factions[0].attributes.hp).toBe(22);
      });
    });

    describe('state immutability', () => {
      it('should maintain state immutability during upgrade', () => {
        const originalState = factionsReducer(initialState, addFaction(testFaction));
        const stateWithXP = factionsReducer(
          originalState,
          addXP({ factionId: 'faction-1', amount: 10 })
        );
        
        const newState = factionsReducer(
          stateWithXP,
          upgradeAttribute({ factionId: 'faction-1', attributeName: 'wealth' })
        );
        
        expect(newState).not.toBe(stateWithXP);
        expect(newState.factions[0]).not.toBe(stateWithXP.factions[0]);
        expect(newState.factions[0].attributes.wealth).toBe(4);
        expect(stateWithXP.factions[0].attributes.wealth).toBe(3);
      });
    });

    describe('cost table validation', () => {
      it('should follow exact SWN cost progression for all levels', () => {
        // Create a faction with low attributes
        const lowLevelFaction: Faction = {
          ...testFaction,
          attributes: {
            hp: 6,
            maxHp: 6,
            force: 1,
            cunning: 1,
            wealth: 1,
          },
        };
        
        let state = factionsReducer(initialState, addFaction(lowLevelFaction));
        
        // Give enough XP for all upgrades (1+2+4+6+9+12+16+20 = 70 per attribute)
        state = factionsReducer(state, addXP({ factionId: 'faction-1', amount: 210 }));
        
        const expectedCosts = [2, 4, 6, 9, 12, 16, 20]; // Cost to upgrade from 1->2, 2->3, ..., 7->8
        
        for (let i = 0; i < expectedCosts.length; i++) {
          const xpBefore = state.factions[0].xp;
          const ratingBefore = state.factions[0].attributes.force;
          
          state = factionsReducer(
            state,
            upgradeAttribute({ factionId: 'faction-1', attributeName: 'force' })
          );
          
          const xpAfter = state.factions[0].xp;
          const ratingAfter = state.factions[0].attributes.force;
          const actualCost = xpBefore - xpAfter;
          
          expect(actualCost).toBe(expectedCosts[i]);
          expect(ratingAfter).toBe(ratingBefore + 1);
        }
        
        // Should now be at max rating (8)
        expect(state.factions[0].attributes.force).toBe(8);
      });
    });
  });
});






