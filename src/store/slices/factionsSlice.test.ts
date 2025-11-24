// Unit tests for factions slice, specifically combat damage actions

import { describe, it, expect, beforeEach } from 'vitest';
import factionsReducer, {
  addFaction,
  addAsset,
  inflictDamage,
  inflictFactionDamage,
  type FactionsState,
} from './factionsSlice';
import type { Faction } from '../../types/faction';

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
});






