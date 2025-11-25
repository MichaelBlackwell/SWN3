// Utility functions to apply special feature effects during gameplay
// Handles purchase-time effects, maintenance modifiers, and other runtime logic

import type { FactionAsset } from '../types/faction';
import {
  getAssetSpecialFeatures,
  getSpecialFeaturesByType,
} from './assetSpecialFeatures';

/**
 * Context for applying special feature effects
 */
export interface SpecialFeatureContext {
  factionId: string;
  asset: FactionAsset;
  assetDefinitionId: string;
  location: string; // systemId
  currentTurn?: number;
}

/**
 * Result of applying special feature effects
 */
export interface SpecialFeatureResult {
  modifiedAsset?: Partial<FactionAsset>; // Properties to modify on the asset
  costModifier?: number; // Additional cost to add/subtract
  maintenanceModifier?: number; // Additional maintenance cost
  autoStealth?: boolean; // Whether to automatically set asset as stealthed
  techLevelModifier?: number; // Effective tech level for this asset
  messages?: string[]; // Informational messages about applied effects
}

/**
 * Apply special feature effects that occur at purchase time
 * @param context - Context for the asset purchase
 * @returns Result with any modifications to apply
 */
export function applyPurchaseTimeEffects(
  context: SpecialFeatureContext,
): SpecialFeatureResult {
  const result: SpecialFeatureResult = {
    messages: [],
  };

  const features = getAssetSpecialFeatures(context.assetDefinitionId);
  const purchaseFeatures = features.filter(
    (f) => f.appliesAt === 'purchase' || f.type === 'purchase_effect',
  );

  for (const feature of purchaseFeatures) {
    switch (feature.type) {
      case 'purchase_effect':
        // Check for auto-stealth effect (e.g., Psychic Assassins)
        if (feature.parameters?.autoStealth === true) {
          result.autoStealth = true;
          result.messages?.push(
            `${feature.description.split('.')[0]} - Asset starts stealthed.`,
          );
        }
        break;
    }
  }

  return result;
}

/**
 * Calculate maintenance cost modifier from special features
 * @param assetDefinitionId - The asset definition ID
 * @returns Additional maintenance cost (0 if none)
 */
export function getMaintenanceModifier(assetDefinitionId: string): number {
  const features = getSpecialFeaturesByType(
    assetDefinitionId,
    'maintenance_modifier',
  );

  let modifier = 0;

  for (const feature of features) {
    if (feature.parameters?.maintenanceCost) {
      modifier += feature.parameters.maintenanceCost as number;
    } else if (feature.parameters?.additionalMaintenance) {
      modifier += feature.parameters.additionalMaintenance as number;
    }
  }

  return modifier;
}

/**
 * Get effective tech level modifier for an asset
 * This affects what assets can be purchased on worlds with this asset
 * @param assetDefinitionId - The asset definition ID
 * @returns Effective tech level, or undefined if no modifier
 */
export function getTechLevelModifier(assetDefinitionId: string): {
  effectiveTechLevel: number;
  categories?: string[];
  allPlanets?: boolean;
} | null {
  const features = getSpecialFeaturesByType(
    assetDefinitionId,
    'tech_level_modifier',
  );

  if (features.length === 0) {
    return null;
  }

  // Get the first tech level modifier (assets typically have one)
  const feature = features[0];
  if (feature.parameters?.effectiveTechLevel) {
    return {
      effectiveTechLevel: feature.parameters.effectiveTechLevel as number,
      categories: feature.parameters.categories as string[] | undefined,
      allPlanets: feature.parameters.allPlanets as boolean | undefined,
    };
  }

  return null;
}

/**
 * Check if an asset has a special feature that affects purchase cost
 * Currently, no assets modify purchase cost, but this function is here for future use
 * @param assetDefinitionId - The asset definition ID
 * @returns Cost modifier (0 if none)
 */
export function getPurchaseCostModifier(assetDefinitionId: string): number {
  const features = getSpecialFeaturesByType(
    assetDefinitionId,
    'cost_modifier',
  );

  let modifier = 0;

  for (const feature of features) {
    if (feature.parameters?.costModifier) {
      modifier += feature.parameters.costModifier as number;
    }
  }

  return modifier;
}

/**
 * Check if an asset has restrictions that should be validated
 * @param assetDefinitionId - The asset definition ID
 * @returns Array of restriction messages, or empty array if none
 */
export function getAssetRestrictions(assetDefinitionId: string): string[] {
  const features = getSpecialFeaturesByType(assetDefinitionId, 'restriction');
  const restrictions: string[] = [];

  for (const feature of features) {
    // Extract key restriction information from description
    if (feature.description.includes('cannot attack')) {
      restrictions.push('Cannot attack certain asset types');
    }
    if (feature.description.includes('requires permission')) {
      restrictions.push('May require special permissions');
    }
  }

  return restrictions;
}

/**
 * Apply all special feature effects for a given context
 * This is the main entry point for applying special features
 * @param context - Context for applying effects
 * @param phase - The phase when effects are being applied
 * @returns Result with all modifications to apply
 */
export function applySpecialFeatureEffects(
  context: SpecialFeatureContext,
  phase: 'purchase' | 'maintenance' | 'combat' | 'ongoing',
): SpecialFeatureResult {
  const result: SpecialFeatureResult = {
    messages: [],
  };

  switch (phase) {
    case 'purchase':
      return applyPurchaseTimeEffects(context);
    case 'maintenance':
      result.maintenanceModifier = getMaintenanceModifier(
        context.assetDefinitionId,
      );
      if (result.maintenanceModifier > 0) {
        result.messages?.push(
          `Additional maintenance cost: ${result.maintenanceModifier} FacCreds`,
        );
      }
      return result;
    case 'combat':
    case 'ongoing':
      // These are handled elsewhere (combat resolver, income phase, etc.)
      return result;
    default:
      return result;
  }
}

/**
 * Check if an asset should start stealthed based on special features
 * @param assetDefinitionId - The asset definition ID
 * @returns True if asset should start stealthed
 */
export function shouldStartStealthed(assetDefinitionId: string): boolean {
  const result = applyPurchaseTimeEffects({
    factionId: '',
    asset: {
      id: '',
      definitionId: assetDefinitionId,
      location: '',
      hp: 0,
      maxHp: 0,
      stealthed: false,
    },
    assetDefinitionId,
    location: '',
  });

  return result.autoStealth === true;
}

/**
 * Get passive bonus income from assets (e.g., Party Machine provides 1 FacCred per turn)
 * @param assets - Array of faction assets
 * @returns Total passive income from assets
 */
export function getPassiveBonusIncome(assets: FactionAsset[]): number {
  let totalIncome = 0;

  for (const asset of assets) {
    const features = getAssetSpecialFeatures(asset.definitionId);
    const passiveBonuses = features.filter(
      (f) => f.type === 'passive_bonus' && f.parameters?.incomePerTurn,
    );

    for (const bonus of passiveBonuses) {
      if (bonus.parameters?.incomePerTurn) {
        totalIncome += bonus.parameters.incomePerTurn as number;
      }
    }
  }

  return totalIncome;
}

/**
 * Get tech level modifier for a world based on assets present
 * @param assets - Array of assets on the world
 * @param category - Asset category to check (optional, if not provided checks all)
 * @returns Effective tech level, or null if no modifier
 */
export function getWorldTechLevelModifier(
  assets: FactionAsset[],
  category?: string,
): { effectiveTechLevel: number; categories?: string[] } | null {
  for (const asset of assets) {
    const modifier = getTechLevelModifier(asset.definitionId);
    if (modifier) {
      // If category filter is specified, check if this modifier applies
      if (category && modifier.categories) {
        if (modifier.categories.includes(category)) {
          return modifier;
        }
      } else if (!category) {
        // No category filter, return first modifier found
        return modifier;
      }
    }
  }

  return null;
}

