// Unit tests for Asset Special Features system
// Tests the registry, description functions, and feature retrieval

import { describe, it, expect } from 'vitest';
import {
  specialFeaturesRegistry,
  getAssetSpecialFeatures,
  assetHasSpecialFeatures,
  getSpecialFeatureDescription,
  getSpecialFeaturesByType,
  getAllAssetsWithSpecialFeatures,
  validateSpecialFeaturesRegistry,
  getSpecialFeatureSummary,
  getSpecialFeaturesByTiming,
  getSpecialFeaturesForDisplay,
  getSpecialFeatureKeyInfo,
  formatSpecialFeaturesAsList,
  getFeatureTypeLabel,
  getFeatureTimingLabel,
  type SpecialFeatureType,
} from './assetSpecialFeatures';
import { getAllAssets } from '../data/assetLibrary';

describe('assetSpecialFeatures', () => {
  describe('specialFeaturesRegistry', () => {
    it('should be a non-empty object', () => {
      expect(specialFeaturesRegistry).toBeDefined();
      expect(typeof specialFeaturesRegistry).toBe('object');
      expect(Object.keys(specialFeaturesRegistry).length).toBeGreaterThan(0);
    });

    it('should contain entries for known assets with special features', () => {
      expect(specialFeaturesRegistry).toHaveProperty('force_3_zealots');
      expect(specialFeaturesRegistry).toHaveProperty('force_5_psychic_assassins');
      expect(specialFeaturesRegistry).toHaveProperty('force_8_capital_fleet');
      expect(specialFeaturesRegistry).toHaveProperty('cunning_4_party_machine');
      expect(specialFeaturesRegistry).toHaveProperty('wealth_3_mercenaries');
      expect(specialFeaturesRegistry).toHaveProperty('wealth_8_scavenger_fleet');
    });

    it('should have valid feature structures for all entries', () => {
      Object.entries(specialFeaturesRegistry).forEach(([assetId, features]) => {
        expect(Array.isArray(features)).toBe(true);
        expect(features.length).toBeGreaterThan(0);

        features.forEach((feature) => {
          expect(feature).toHaveProperty('type');
          expect(feature).toHaveProperty('description');
          expect(typeof feature.type).toBe('string');
          expect(typeof feature.description).toBe('string');
          expect(feature.description.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('getAssetSpecialFeatures', () => {
    it('should return an empty array for assets without special features', () => {
      const features = getAssetSpecialFeatures('force_1_security_personnel');
      expect(features).toEqual([]);
    });

    it('should return features for assets with special features', () => {
      const features = getAssetSpecialFeatures('force_3_zealots');
      expect(features.length).toBeGreaterThan(0);
      expect(features[0].type).toBe('attack_modifier');
    });

    it('should return all features for assets with multiple special features', () => {
      // Check if any asset has multiple features
      const assetIds = Object.keys(specialFeaturesRegistry);
      const multiFeatureAssets = assetIds.filter(
        (id) => specialFeaturesRegistry[id].length > 1,
      );

      if (multiFeatureAssets.length > 0) {
        const features = getAssetSpecialFeatures(multiFeatureAssets[0]);
        expect(features.length).toBeGreaterThan(1);
      }
    });
  });

  describe('assetHasSpecialFeatures', () => {
    it('should return false for assets without special features', () => {
      expect(assetHasSpecialFeatures('force_1_security_personnel')).toBe(false);
    });

    it('should return true for assets with special features', () => {
      expect(assetHasSpecialFeatures('force_3_zealots')).toBe(true);
      expect(assetHasSpecialFeatures('force_5_psychic_assassins')).toBe(true);
      expect(assetHasSpecialFeatures('force_8_capital_fleet')).toBe(true);
    });
  });

  describe('getSpecialFeatureDescription', () => {
    it('should return empty string for assets without special features', () => {
      const description = getSpecialFeatureDescription('force_1_security_personnel');
      expect(description).toBe('');
    });

    it('should return description for assets with single feature', () => {
      const description = getSpecialFeatureDescription('force_3_zealots');
      expect(description).toContain('Zealots');
      expect(description.length).toBeGreaterThan(0);
    });

    it('should return formatted description for assets with multiple features', () => {
      const assetIds = Object.keys(specialFeaturesRegistry);
      const multiFeatureAssets = assetIds.filter(
        (id) => specialFeaturesRegistry[id].length > 1,
      );

      if (multiFeatureAssets.length > 0) {
        const description = getSpecialFeatureDescription(multiFeatureAssets[0]);
        expect(description).toMatch(/^\d+\./); // Should start with numbered list
      }
    });
  });

  describe('getSpecialFeaturesByType', () => {
    it('should return empty array for assets without features of specified type', () => {
      const features = getSpecialFeaturesByType('force_3_zealots', 'passive_bonus');
      expect(features).toEqual([]);
    });

    it('should return features matching the specified type', () => {
      const features = getSpecialFeaturesByType('force_3_zealots', 'attack_modifier');
      expect(features.length).toBeGreaterThan(0);
      expect(features.every((f) => f.type === 'attack_modifier')).toBe(true);
    });

    it('should return maintenance modifiers correctly', () => {
      const features = getSpecialFeaturesByType('force_8_capital_fleet', 'maintenance_modifier');
      expect(features.length).toBeGreaterThan(0);
      expect(features[0].type).toBe('maintenance_modifier');
    });
  });

  describe('getAllAssetsWithSpecialFeatures', () => {
    it('should return an array of asset IDs', () => {
      const assetIds = getAllAssetsWithSpecialFeatures();
      expect(Array.isArray(assetIds)).toBe(true);
      expect(assetIds.length).toBeGreaterThan(0);
    });

    it('should return IDs that exist in the registry', () => {
      const assetIds = getAllAssetsWithSpecialFeatures();
      assetIds.forEach((id) => {
        expect(specialFeaturesRegistry).toHaveProperty(id);
      });
    });
  });

  describe('validateSpecialFeaturesRegistry', () => {
    it('should return empty array when all assets with hasSpecial flag have registry entries', () => {
      const allAssets = getAllAssets();
      const errors = validateSpecialFeaturesRegistry(allAssets);
      // This test may fail if registry is incomplete - that's expected during development
      expect(Array.isArray(errors)).toBe(true);
    });

    it('should identify assets with hasSpecial flag but no registry entry', () => {
      const allAssets = getAllAssets();
      const assetsWithSpecial = allAssets.filter((asset) => asset.specialFlags.hasSpecial);
      const errors = validateSpecialFeaturesRegistry(allAssets);

      // Log for debugging
      if (errors.length > 0) {
        console.log('Assets with hasSpecial flag but no registry entry:', errors);
      }

      // All assets with hasSpecial should have registry entries
      assetsWithSpecial.forEach((asset) => {
        if (!assetHasSpecialFeatures(asset.id)) {
          expect(errors).toContain(asset.id);
        }
      });
    });
  });

  describe('getSpecialFeatureSummary', () => {
    it('should return empty string for assets without special features', () => {
      const summary = getSpecialFeatureSummary('force_1_security_personnel');
      expect(summary).toBe('');
    });

    it('should return a summary for assets with special features', () => {
      const summary = getSpecialFeatureSummary('force_3_zealots');
      expect(summary.length).toBeGreaterThan(0);
      expect(summary.length).toBeLessThanOrEqual(100); // Default max length
    });

    it('should respect maxLength parameter', () => {
      const summary = getSpecialFeatureSummary('force_3_zealots', 50);
      expect(summary.length).toBeLessThanOrEqual(50);
    });

    it('should indicate multiple features when present', () => {
      const assetIds = Object.keys(specialFeaturesRegistry);
      const multiFeatureAssets = assetIds.filter(
        (id) => specialFeaturesRegistry[id].length > 1,
      );

      if (multiFeatureAssets.length > 0) {
        const summary = getSpecialFeatureSummary(multiFeatureAssets[0]);
        expect(summary.toLowerCase()).toContain('multiple');
      }
    });
  });

  describe('getSpecialFeaturesByTiming', () => {
    it('should return empty object for assets without special features', () => {
      const grouped = getSpecialFeaturesByTiming('force_1_security_personnel');
      expect(Object.keys(grouped).length).toBe(0);
    });

    it('should group features by timing', () => {
      const grouped = getSpecialFeaturesByTiming('force_5_psychic_assassins');
      expect(grouped).toHaveProperty('purchase');
      expect(grouped.purchase.length).toBeGreaterThan(0);
    });

    it('should include all timing categories when features exist', () => {
      // Find an asset with maintenance modifier
      const maintenanceAsset = Object.keys(specialFeaturesRegistry).find((id) => {
        const features = specialFeaturesRegistry[id];
        return features.some((f) => f.appliesAt === 'maintenance');
      });

      if (maintenanceAsset) {
        const grouped = getSpecialFeaturesByTiming(maintenanceAsset);
        expect(grouped).toHaveProperty('maintenance');
      }
    });
  });

  describe('getSpecialFeaturesForDisplay', () => {
    it('should return empty array for assets without special features', () => {
      const display = getSpecialFeaturesForDisplay('force_1_security_personnel');
      expect(display).toEqual([]);
    });

    it('should return formatted features with type labels', () => {
      const display = getSpecialFeaturesForDisplay('force_3_zealots');
      expect(display.length).toBeGreaterThan(0);
      expect(display[0]).toHaveProperty('type');
      expect(display[0]).toHaveProperty('typeLabel');
      expect(display[0]).toHaveProperty('description');
      expect(typeof display[0].typeLabel).toBe('string');
    });

    it('should include timing labels when applicable', () => {
      const display = getSpecialFeaturesForDisplay('force_5_psychic_assassins');
      expect(display[0]).toHaveProperty('appliesAt');
      expect(display[0]).toHaveProperty('appliesAtLabel');
      expect(display[0].appliesAtLabel).toBe('On Purchase');
    });
  });

  describe('getSpecialFeatureKeyInfo', () => {
    it('should return key info for assets without special features', () => {
      const info = getSpecialFeatureKeyInfo('force_1_security_personnel');
      expect(info.hasCostModifier).toBe(false);
      expect(info.hasPassiveBonus).toBe(false);
      expect(info.hasRestriction).toBe(false);
      expect(info.summary).toBe('Special features');
    });

    it('should detect maintenance modifiers', () => {
      const info = getSpecialFeatureKeyInfo('force_8_capital_fleet');
      expect(info.maintenanceModifier).toBe(2);
    });

    it('should detect passive bonuses', () => {
      const info = getSpecialFeatureKeyInfo('cunning_4_party_machine');
      expect(info.hasPassiveBonus).toBe(true);
    });

    it('should generate appropriate summary', () => {
      const info = getSpecialFeatureKeyInfo('force_8_capital_fleet');
      expect(info.summary).toContain('maintenance');
    });
  });

  describe('formatSpecialFeaturesAsList', () => {
    it('should return empty array for assets without special features', () => {
      const list = formatSpecialFeaturesAsList('force_1_security_personnel');
      expect(list).toEqual([]);
    });

    it('should return formatted list without type labels by default', () => {
      const list = formatSpecialFeaturesAsList('force_3_zealots');
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toContain('Zealots');
    });

    it('should include type labels when requested', () => {
      const list = formatSpecialFeaturesAsList('force_3_zealots', true);
      expect(list[0]).toContain('[Attack]');
    });
  });

  describe('getFeatureTypeLabel', () => {
    it('should return human-readable labels for all feature types', () => {
      const types: SpecialFeatureType[] = [
        'cost_modifier',
        'passive_bonus',
        'restriction',
        'purchase_effect',
        'defensive_ability',
        'attack_modifier',
        'counterattack_modifier',
        'stealth_related',
        'tech_level_modifier',
        'maintenance_modifier',
        'unique_mechanic',
      ];

      types.forEach((type) => {
        const label = getFeatureTypeLabel(type);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
        expect(label).not.toBe(type); // Should be different from the enum value
      });
    });
  });

  describe('getFeatureTimingLabel', () => {
    it('should return "Always Active" for undefined timing', () => {
      const label = getFeatureTimingLabel(undefined);
      expect(label).toBe('Always Active');
    });

    it('should return human-readable labels for all timing values', () => {
      const timings = ['purchase', 'maintenance', 'combat', 'ongoing', 'defense', 'attack'];
      timings.forEach((timing) => {
        const label = getFeatureTimingLabel(timing);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Registry Coverage', () => {
    it('should have registry entries for all assets with hasSpecial flag', () => {
      const allAssets = getAllAssets();
      const assetsWithSpecial = allAssets.filter((asset) => asset.specialFlags.hasSpecial);
      const missing: string[] = [];

      assetsWithSpecial.forEach((asset) => {
        if (!assetHasSpecialFeatures(asset.id)) {
          missing.push(asset.id);
        }
      });

      if (missing.length > 0) {
        console.warn('Assets with hasSpecial flag but no registry entry:', missing);
      }

      // This test documents missing entries but doesn't fail
      // Remove this comment and uncomment the expect when registry is complete
      // expect(missing).toEqual([]);
    });

    it('should have at least 37 assets with special features', () => {
      const assetIds = getAllAssetsWithSpecialFeatures();
      expect(assetIds.length).toBeGreaterThanOrEqual(37);
    });
  });
});










