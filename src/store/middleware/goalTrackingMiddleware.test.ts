import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import factionsReducer, { removeAsset, addBaseOfInfluence, updateAsset, removeFaction } from '../slices/factionsSlice';
import sectorReducer from '../slices/sectorSlice';
import turnReducer from '../slices/turnSlice';
import { goalTrackingMiddleware } from './goalTrackingMiddleware';
import type { Faction } from '../../types/faction';

describe('goalTrackingMiddleware', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        factions: factionsReducer,
        sector: sectorReducer,
        turn: turnReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(goalTrackingMiddleware),
    });
  });

  describe('Military Conquest', () => {
    it('should increment progress when Force asset is destroyed', () => {
      const faction: Faction = {
        id: 'attacker',
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
          progress: { current: 2, target: 6 },
          difficulty: 3,
          isCompleted: false,
        },
        assets: [],
      };

      const defender: Faction = {
        id: 'defender',
        name: 'Defender',
        type: 'Government',
        homeworld: 'system-2',
        attributes: { hp: 20, maxHp: 20, force: 4, cunning: 3, wealth: 2 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: null,
        assets: [
          {
            id: 'asset-1',
            definitionId: 'force_4_strike_fleet',
            location: 'system-2',
            hp: 8,
            maxHp: 8,
            stealthed: false,
          },
        ],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });
      store.dispatch({ type: 'factions/addFaction', payload: defender });

      // Simulate combat resolution
      store.dispatch({
        type: 'combat/resolved',
        payload: {
          attackerFactionId: 'attacker',
          defenderFactionId: 'defender',
          attackerDamage: 10,
          defenderDamage: 0,
          destroyedAssetId: 'asset-1',
          destroyedAssetDefinitionId: 'force_4_strike_fleet',
        },
      });

      const state = store.getState();
      const attackerFaction = state.factions.factions.find(f => f.id === 'attacker');
      
      // Progress should increment from 2 to 3
      expect(attackerFaction?.goal?.progress.current).toBe(3);
    });
  });

  describe('Commercial Expansion', () => {
    it('should increment progress when Wealth asset is destroyed', () => {
      const faction: Faction = {
        id: 'attacker',
        name: 'Corporate Faction',
        type: 'Corporation',
        homeworld: 'system-1',
        attributes: { hp: 20, maxHp: 20, force: 3, cunning: 3, wealth: 6 },
        facCreds: 50,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Commercial Expansion',
          description: 'Destroy 6 Wealth assets',
          progress: { current: 1, target: 6 },
          difficulty: 3,
          isCompleted: false,
        },
        assets: [],
      };

      const defender: Faction = {
        id: 'defender',
        name: 'Defender',
        type: 'Corporation',
        homeworld: 'system-2',
        attributes: { hp: 15, maxHp: 15, force: 2, cunning: 2, wealth: 4 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: null,
        assets: [
          {
            id: 'asset-1',
            definitionId: 'wealth_2_freighter_contract',
            location: 'system-2',
            hp: 4,
            maxHp: 4,
            stealthed: false,
          },
        ],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });
      store.dispatch({ type: 'factions/addFaction', payload: defender });

      store.dispatch({
        type: 'combat/resolved',
        payload: {
          attackerFactionId: 'attacker',
          defenderFactionId: 'defender',
          attackerDamage: 5,
          defenderDamage: 0,
          destroyedAssetId: 'asset-1',
          destroyedAssetDefinitionId: 'wealth_2_freighter_contract',
        },
      });

      const state = store.getState();
      const attackerFaction = state.factions.factions.find(f => f.id === 'attacker');
      
      expect(attackerFaction?.goal?.progress.current).toBe(2);
    });
  });

  describe('Intelligence Coup', () => {
    it('should increment progress when Cunning asset is destroyed', () => {
      const faction: Faction = {
        id: 'attacker',
        name: 'Spy Network',
        type: 'Criminal Organization',
        homeworld: 'system-1',
        attributes: { hp: 15, maxHp: 15, force: 2, cunning: 5, wealth: 2 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Intelligence Coup',
          description: 'Destroy 5 Cunning assets',
          progress: { current: 3, target: 5 },
          difficulty: 3,
          isCompleted: false,
        },
        assets: [],
      };

      const defender: Faction = {
        id: 'defender',
        name: 'Defender',
        type: 'Government',
        homeworld: 'system-2',
        attributes: { hp: 20, maxHp: 20, force: 4, cunning: 3, wealth: 2 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: null,
        assets: [
          {
            id: 'asset-1',
            definitionId: 'cunning_2_saboteurs',
            location: 'system-2',
            hp: 4,
            maxHp: 4,
            stealthed: false,
          },
        ],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });
      store.dispatch({ type: 'factions/addFaction', payload: defender });

      store.dispatch({
        type: 'combat/resolved',
        payload: {
          attackerFactionId: 'attacker',
          defenderFactionId: 'defender',
          attackerDamage: 5,
          defenderDamage: 0,
          destroyedAssetId: 'asset-1',
          destroyedAssetDefinitionId: 'cunning_2_saboteurs',
        },
      });

      const state = store.getState();
      const attackerFaction = state.factions.factions.find(f => f.id === 'attacker');
      
      expect(attackerFaction?.goal?.progress.current).toBe(4);
    });
  });

  describe('Blood the Enemy', () => {
    it('should accumulate damage dealt', () => {
      const faction: Faction = {
        id: 'attacker',
        name: 'Warlike Faction',
        type: 'Mercenary Group',
        homeworld: 'system-1',
        attributes: { hp: 25, maxHp: 25, force: 5, cunning: 3, wealth: 3 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Blood the Enemy',
          description: 'Inflict 11 HP damage (5+3+3)',
          progress: { current: 5, target: 11 },
          difficulty: 2,
          isCompleted: false,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      // Simulate combat where attacker deals 4 damage
      store.dispatch({
        type: 'combat/resolved',
        payload: {
          attackerFactionId: 'attacker',
          defenderFactionId: 'defender',
          attackerDamage: 4,
          defenderDamage: 0,
          destroyedAssetId: null,
        },
      });

      const state = store.getState();
      const attackerFaction = state.factions.factions.find(f => f.id === 'attacker');
      
      // Progress should go from 5 to 9
      expect(attackerFaction?.goal?.progress.current).toBe(9);
    });
  });

  describe('Invincible Valor', () => {
    it('should complete goal when destroying high-rating Force asset', () => {
      const faction: Faction = {
        id: 'attacker',
        name: 'Brave Warriors',
        type: 'Mercenary Group',
        homeworld: 'system-1',
        attributes: { hp: 20, maxHp: 20, force: 3, cunning: 2, wealth: 2 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Invincible Valor',
          description: 'Destroy a Force asset with rating > 3',
          progress: { current: 0, target: 1 },
          difficulty: 2,
          isCompleted: false,
        },
        assets: [],
      };

      const defender: Faction = {
        id: 'defender',
        name: 'Defender',
        type: 'Government',
        homeworld: 'system-2',
        attributes: { hp: 29, maxHp: 29, force: 6, cunning: 5, wealth: 3 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: null,
        assets: [
          {
            id: 'asset-1',
            definitionId: 'force_6_planetary_defenses', // Requires Force 6
            location: 'system-2',
            hp: 20,
            maxHp: 20,
            stealthed: false,
          },
        ],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });
      store.dispatch({ type: 'factions/addFaction', payload: defender });

      store.dispatch({
        type: 'combat/resolved',
        payload: {
          attackerFactionId: 'attacker',
          defenderFactionId: 'defender',
          attackerDamage: 12,
          defenderDamage: 0,
          destroyedAssetId: 'asset-1',
          destroyedAssetDefinitionId: 'force_6_planetary_defenses',
        },
      });

      const state = store.getState();
      const attackerFaction = state.factions.factions.find(f => f.id === 'attacker');
      
      // Goal should complete immediately
      expect(attackerFaction?.goal?.progress.current).toBe(1);
    });

    it('should not complete goal when destroying lower-rating Force asset', () => {
      const faction: Faction = {
        id: 'attacker',
        name: 'Brave Warriors',
        type: 'Mercenary Group',
        homeworld: 'system-1',
        attributes: { hp: 20, maxHp: 20, force: 5, cunning: 2, wealth: 2 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Invincible Valor',
          description: 'Destroy a Force asset with rating > 5',
          progress: { current: 0, target: 1 },
          difficulty: 2,
          isCompleted: false,
        },
        assets: [],
      };

      const defender: Faction = {
        id: 'defender',
        name: 'Defender',
        type: 'Government',
        homeworld: 'system-2',
        attributes: { hp: 20, maxHp: 20, force: 4, cunning: 3, wealth: 2 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: null,
        assets: [
          {
            id: 'asset-1',
            definitionId: 'force_3_strike_fleet', // Requires Force 3
            location: 'system-2',
            hp: 8,
            maxHp: 8,
            stealthed: false,
          },
        ],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });
      store.dispatch({ type: 'factions/addFaction', payload: defender });

      store.dispatch({
        type: 'combat/resolved',
        payload: {
          attackerFactionId: 'attacker',
          defenderFactionId: 'defender',
          attackerDamage: 10,
          defenderDamage: 0,
          destroyedAssetId: 'asset-1',
          destroyedAssetDefinitionId: 'force_4_strike_fleet',
        },
      });

      const state = store.getState();
      const attackerFaction = state.factions.factions.find(f => f.id === 'attacker');
      
      // Goal should not progress (asset rating not high enough)
      expect(attackerFaction?.goal?.progress.current).toBe(0);
    });
  });

  describe('Expand Influence', () => {
    it('should complete goal when placing base on new planet', () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Expansionist Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: { hp: 25, maxHp: 25, force: 4, cunning: 4, wealth: 4 },
        facCreds: 20,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Expand Influence',
          description: 'Place a base on a new planet',
          progress: { current: 0, target: 1 },
          difficulty: 1,
          isCompleted: false,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      // Place base on a new system
      store.dispatch(
        addBaseOfInfluence({
          factionId: 'faction-1',
          systemId: 'system-2',
          hp: 5,
          cost: 5,
        })
      );

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      expect(updatedFaction?.goal?.progress.current).toBe(1);
    });

    it('should not complete goal when placing base on homeworld', () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Expansionist Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: { hp: 25, maxHp: 25, force: 4, cunning: 4, wealth: 4 },
        facCreds: 20,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Expand Influence',
          description: 'Place a base on a new planet',
          progress: { current: 0, target: 1 },
          difficulty: 1,
          isCompleted: false,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      // Try to place base on homeworld
      store.dispatch(
        addBaseOfInfluence({
          factionId: 'faction-1',
          systemId: 'system-1',
          hp: 5,
          cost: 5,
        })
      );

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      // Should not progress (homeworld doesn't count)
      expect(updatedFaction?.goal?.progress.current).toBe(0);
    });
  });

  describe('Inside Enemy Territory', () => {
    it('should track stealthed assets on enemy worlds', () => {
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
          progress: {
            current: 1,
            target: 4,
            metadata: {
              trackedAssetIds: ['existing-asset'],
              stealthedCount: 1,
            },
          },
          difficulty: 2,
          isCompleted: false,
        },
        assets: [
          {
            id: 'asset-1',
            definitionId: 'cunning_3_covert_ops',
            location: 'system-2',
            hp: 5,
            maxHp: 5,
            stealthed: false,
          },
        ],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      // Stealth an asset on enemy world
      store.dispatch(
        updateAsset({
          factionId: 'faction-1',
          assetId: 'asset-1',
          updates: { stealthed: true },
        })
      );

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      // Progress should increment from 1 to 2
      expect(updatedFaction?.goal?.progress.current).toBe(2);
    });

    it('should not track assets stealthed on homeworld', () => {
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
          progress: {
            current: 0,
            target: 4,
            metadata: {
              trackedAssetIds: [],
              stealthedCount: 0,
            },
          },
          difficulty: 2,
          isCompleted: false,
        },
        assets: [
          {
            id: 'asset-1',
            definitionId: 'cunning_3_covert_ops',
            location: 'system-1', // Homeworld
            hp: 5,
            maxHp: 5,
            stealthed: false,
          },
        ],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      store.dispatch(
        updateAsset({
          factionId: 'faction-1',
          assetId: 'asset-1',
          updates: { stealthed: true },
        })
      );

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      // Should not progress (homeworld doesn't count)
      expect(updatedFaction?.goal?.progress.current).toBe(0);
    });
  });

  describe('Destroy the Foe', () => {
    it('should complete goal when targeted faction is destroyed', () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Destroyer',
        type: 'Government',
        homeworld: 'system-1',
        attributes: { hp: 29, maxHp: 29, force: 6, cunning: 5, wealth: 3 },
        facCreds: 10,
        xp: 0,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Destroy the Foe',
          description: 'Destroy faction-2',
          progress: {
            current: 0,
            target: 1,
            metadata: {
              targetFactionId: 'faction-2',
            },
          },
          difficulty: 5,
          isCompleted: false,
        },
        assets: [],
      };

      const targetFaction: Faction = {
        id: 'faction-2',
        name: 'Target',
        type: 'Government',
        homeworld: 'system-2',
        attributes: { hp: 0, maxHp: 20, force: 4, cunning: 3, wealth: 2 },
        facCreds: 0,
        xp: 0,
        tags: [],
        goal: null,
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });
      store.dispatch({ type: 'factions/addFaction', payload: targetFaction });

      // Destroy the target faction
      store.dispatch(removeFaction('faction-2'));

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      expect(updatedFaction?.goal?.progress.current).toBe(1);
    });
  });

  describe('Peaceable Kingdom', () => {
    it('should reset progress when faction attacks', () => {
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
          progress: {
            current: 3,
            target: 4,
            metadata: {
              turnsWithoutAttack: 3,
            },
          },
          difficulty: 1,
          isCompleted: false,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      // Faction attacks
      store.dispatch({
        type: 'combat/resolved',
        payload: {
          attackerFactionId: 'faction-1',
          defenderFactionId: 'other-faction',
          attackerDamage: 5,
          defenderDamage: 2,
          destroyedAssetId: null,
        },
      });

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      // Progress should reset to 0
      expect(updatedFaction?.goal?.progress.current).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should not update goals for factions without goals', () => {
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

      store.dispatch({
        type: 'combat/resolved',
        payload: {
          attackerFactionId: 'faction-1',
          defenderFactionId: 'other',
          attackerDamage: 5,
          defenderDamage: 0,
          destroyedAssetId: null,
        },
      });

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      expect(updatedFaction?.goal).toBeNull();
    });

    it('should not update already completed goals', () => {
      const faction: Faction = {
        id: 'faction-1',
        name: 'Completed Goal Faction',
        type: 'Government',
        homeworld: 'system-1',
        attributes: { hp: 29, maxHp: 29, force: 6, cunning: 5, wealth: 3 },
        facCreds: 10,
        xp: 2,
        tags: [],
        goal: {
          id: 'goal-1',
          type: 'Military Conquest',
          description: 'Destroy 6 Force assets',
          progress: { current: 6, target: 6 },
          difficulty: 3,
          isCompleted: true,
        },
        assets: [],
      };

      store.dispatch({ type: 'factions/addFaction', payload: faction });

      store.dispatch({
        type: 'combat/resolved',
        payload: {
          attackerFactionId: 'faction-1',
          defenderFactionId: 'other',
          attackerDamage: 10,
          defenderDamage: 0,
          destroyedAssetId: 'some-asset',
        },
      });

      const state = store.getState();
      const updatedFaction = state.factions.factions.find(f => f.id === 'faction-1');
      
      // Progress should remain at 6 (not increment)
      expect(updatedFaction?.goal?.progress.current).toBe(6);
    });
  });
});

