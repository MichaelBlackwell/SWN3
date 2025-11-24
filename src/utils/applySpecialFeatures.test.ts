// Unit tests for Special Feature Application Logic
// Tests the runtime application of special features during purchase and gameplay

import { describe, it, expect } from 'vitest';
import {
  applyPurchaseTimeEffects,
  getMaintenanceModifier,
  getTechLevelModifier,
  getPurchaseCostModifier,
  getAssetRestrictions,
  applySpecialFeatureEffects,
  shouldStartStealthed,
  getPassiveBonusIncome,
  getWorldTechLevelModifier,
  type SpecialFeatureContext,
} from './applySpecialFeatures';
import type { FactionAsset } from '../types/faction';

describe('applySpecialFeatures', () => {
  describe('applyPurchaseTimeEffects', () => {
    it('should return empty result for assets without purchase effects', () => {
      const context: SpecialFeatureContext = {
        factionId: 'test-faction',
        asset: {
          id: 'test-asset',
          definitionId: 'force_1_security_personnel',
          location: 'test-system',
          hp: 3,
          maxHp: 3,
          stealthed: false,
        },
        assetDefinitionId: 'force_1_security_personnel',
        location: 'test-system',
      };

      const result = applyPurchaseTimeEffects(context);
      expect(result.autoStealth).toBeUndefined();
      expect(result.messages?.length || 0).toBe(0);
    });

    it('should apply auto-stealth for Psychic Assassins', () => {
      const context: SpecialFeatureContext = {
        factionId: 'test-faction',
        asset: {
          id: 'test-asset',
          definitionId: 'force_5_psychic_assassins',
          location: 'test-system',
          hp: 4,
          maxHp: 4,
          stealthed: false,
        },
        assetDefinitionId: 'force_5_psychic_assassins',
        location: 'test-system',
      };

      const result = applyPurchaseTimeEffects(context);
      expect(result.autoStealth).toBe(true);
      expect(result.messages?.length || 0).toBeGreaterThan(0);
    });
  });

  describe('getMaintenanceModifier', () => {
    it('should return 0 for assets without maintenance modifiers', () => {
      const modifier = getMaintenanceModifier('force_1_security_personnel');
      expect(modifier).toBe(0);
    });

    it('should return correct modifier for Capital Fleet', () => {
      const modifier = getMaintenanceModifier('force_8_capital_fleet');
      expect(modifier).toBe(2);
    });

    it('should return correct modifier for Mercenaries', () => {
      const modifier = getMaintenanceModifier('wealth_3_mercenaries');
      expect(modifier).toBe(1);
    });

    it('should return correct modifier for Pretech Researchers', () => {
      const modifier = getMaintenanceModifier('wealth_5_pretech_researchers');
      expect(modifier).toBe(1);
    });

    it('should return correct modifier for Scavenger Fleet', () => {
      const modifier = getMaintenanceModifier('wealth_8_scavenger_fleet');
      expect(modifier).toBe(2);
    });
  });

  describe('getTechLevelModifier', () => {
    it('should return null for assets without tech level modifiers', () => {
      const modifier = getTechLevelModifier('force_1_security_personnel');
      expect(modifier).toBeNull();
    });

    it('should return modifier for Laboratory', () => {
      const modifier = getTechLevelModifier('wealth_3_laboratory');
      expect(modifier).not.toBeNull();
      expect(modifier?.effectiveTechLevel).toBe(4);
    });

    it('should return modifier for Pretech Researchers', () => {
      const modifier = getTechLevelModifier('wealth_5_pretech_researchers');
      expect(modifier).not.toBeNull();
      expect(modifier?.effectiveTechLevel).toBe(5);
      expect(modifier?.categories).toEqual(['Cunning', 'Wealth']);
    });

    it('should return modifier for R&D Department', () => {
      const modifier = getTechLevelModifier('wealth_6_r_and_d_department');
      expect(modifier).not.toBeNull();
      expect(modifier?.effectiveTechLevel).toBe(4);
      expect(modifier?.categories).toEqual(['Wealth']);
      expect(modifier?.allPlanets).toBe(true);
    });
  });

  describe('getPurchaseCostModifier', () => {
    it('should return 0 for assets without cost modifiers', () => {
      const modifier = getPurchaseCostModifier('force_1_security_personnel');
      expect(modifier).toBe(0);
    });

    // Currently no assets have purchase cost modifiers
    // This test documents the expected behavior for future features
    it('should return 0 for all current assets (no cost modifiers exist)', () => {
      const testAssets = [
        'force_3_zealots',
        'force_5_psychic_assassins',
        'force_8_capital_fleet',
        'cunning_4_party_machine',
        'wealth_3_mercenaries',
      ];

      testAssets.forEach((assetId) => {
        const modifier = getPurchaseCostModifier(assetId);
        expect(modifier).toBe(0);
      });
    });
  });

  describe('getAssetRestrictions', () => {
    it('should return empty array for assets without restrictions', () => {
      const restrictions = getAssetRestrictions('force_1_security_personnel');
      expect(restrictions).toEqual([]);
    });

    it('should detect restrictions for Lawyers', () => {
      const restrictions = getAssetRestrictions('wealth_2_lawyers');
      expect(restrictions.length).toBeGreaterThan(0);
      expect(restrictions.some((r) => r.includes('attack'))).toBe(true);
    });

    it('should detect restrictions for Lobbyists', () => {
      const restrictions = getAssetRestrictions('cunning_2_lobbyists');
      expect(restrictions.length).toBeGreaterThan(0);
    });
  });

  describe('applySpecialFeatureEffects', () => {
    it('should handle purchase phase correctly', () => {
      const context: SpecialFeatureContext = {
        factionId: 'test-faction',
        asset: {
          id: 'test-asset',
          definitionId: 'force_5_psychic_assassins',
          location: 'test-system',
          hp: 4,
          maxHp: 4,
          stealthed: false,
        },
        assetDefinitionId: 'force_5_psychic_assassins',
        location: 'test-system',
      };

      const result = applySpecialFeatureEffects(context, 'purchase');
      expect(result.autoStealth).toBe(true);
    });

    it('should handle maintenance phase correctly', () => {
      const context: SpecialFeatureContext = {
        factionId: 'test-faction',
        asset: {
          id: 'test-asset',
          definitionId: 'force_8_capital_fleet',
          location: 'test-system',
          hp: 30,
          maxHp: 30,
          stealthed: false,
        },
        assetDefinitionId: 'force_8_capital_fleet',
        location: 'test-system',
      };

      const result = applySpecialFeatureEffects(context, 'maintenance');
      expect(result.maintenanceModifier).toBe(2);
      expect(result.messages?.length || 0).toBeGreaterThan(0);
    });

    it('should handle combat phase (returns empty result for now)', () => {
      const context: SpecialFeatureContext = {
        factionId: 'test-faction',
        asset: {
          id: 'test-asset',
          definitionId: 'force_3_zealots',
          location: 'test-system',
          hp: 4,
          maxHp: 4,
          stealthed: false,
        },
        assetDefinitionId: 'force_3_zealots',
        location: 'test-system',
      };

      const result = applySpecialFeatureEffects(context, 'combat');
      expect(result.messages).toBeDefined();
    });

    it('should handle ongoing phase (returns empty result for now)', () => {
      const context: SpecialFeatureContext = {
        factionId: 'test-faction',
        asset: {
          id: 'test-asset',
          definitionId: 'cunning_4_party_machine',
          location: 'test-system',
          hp: 10,
          maxHp: 10,
          stealthed: false,
        },
        assetDefinitionId: 'cunning_4_party_machine',
        location: 'test-system',
      };

      const result = applySpecialFeatureEffects(context, 'ongoing');
      expect(result.messages).toBeDefined();
    });
  });

  describe('shouldStartStealthed', () => {
    it('should return false for assets without auto-stealth', () => {
      expect(shouldStartStealthed('force_1_security_personnel')).toBe(false);
      expect(shouldStartStealthed('force_3_zealots')).toBe(false);
    });

    it('should return true for Psychic Assassins', () => {
      expect(shouldStartStealthed('force_5_psychic_assassins')).toBe(true);
    });
  });

  describe('getPassiveBonusIncome', () => {
    it('should return 0 for assets without passive income', () => {
      const assets: FactionAsset[] = [
        {
          id: 'asset-1',
          definitionId: 'force_1_security_personnel',
          location: 'system-1',
          hp: 3,
          maxHp: 3,
          stealthed: false,
        },
      ];

      const income = getPassiveBonusIncome(assets);
      expect(income).toBe(0);
    });

    it('should calculate income from Party Machine', () => {
      const assets: FactionAsset[] = [
        {
          id: 'asset-1',
          definitionId: 'cunning_4_party_machine',
          location: 'system-1',
          hp: 10,
          maxHp: 10,
          stealthed: false,
        },
      ];

      const income = getPassiveBonusIncome(assets);
      expect(income).toBe(1);
    });

    it('should sum income from multiple Party Machines', () => {
      const assets: FactionAsset[] = [
        {
          id: 'asset-1',
          definitionId: 'cunning_4_party_machine',
          location: 'system-1',
          hp: 10,
          maxHp: 10,
          stealthed: false,
        },
        {
          id: 'asset-2',
          definitionId: 'cunning_4_party_machine',
          location: 'system-2',
          hp: 10,
          maxHp: 10,
          stealthed: false,
        },
      ];

      const income = getPassiveBonusIncome(assets);
      expect(income).toBe(2);
    });
  });

  describe('getWorldTechLevelModifier', () => {
    it('should return null for worlds without tech level modifiers', () => {
      const assets: FactionAsset[] = [
        {
          id: 'asset-1',
          definitionId: 'force_1_security_personnel',
          location: 'system-1',
          hp: 3,
          maxHp: 3,
          stealthed: false,
        },
      ];

      const modifier = getWorldTechLevelModifier(assets);
      expect(modifier).toBeNull();
    });

    it('should return modifier when Laboratory is present', () => {
      const assets: FactionAsset[] = [
        {
          id: 'asset-1',
          definitionId: 'wealth_3_laboratory',
          location: 'system-1',
          hp: 4,
          maxHp: 4,
          stealthed: false,
        },
      ];

      const modifier = getWorldTechLevelModifier(assets);
      expect(modifier).not.toBeNull();
      expect(modifier?.effectiveTechLevel).toBe(4);
    });

    it('should filter by category when specified', () => {
      const assets: FactionAsset[] = [
        {
          id: 'asset-1',
          definitionId: 'wealth_5_pretech_researchers',
          location: 'system-1',
          hp: 6,
          maxHp: 6,
          stealthed: false,
        },
      ];

      const modifier = getWorldTechLevelModifier(assets, 'Cunning');
      expect(modifier).not.toBeNull();
      expect(modifier?.effectiveTechLevel).toBe(5);
    });

    it('should return null when category filter excludes modifier', () => {
      const assets: FactionAsset[] = [
        {
          id: 'asset-1',
          definitionId: 'wealth_5_pretech_researchers',
          location: 'system-1',
          hp: 6,
          maxHp: 6,
          stealthed: false,
        },
      ];

      const modifier = getWorldTechLevelModifier(assets, 'Force');
      expect(modifier).toBeNull();
    });
  });
});







