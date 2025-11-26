import type { FactionAsset } from '../types/faction';
import { getAssetById } from '../data/assetLibrary';

/**
 * Configuration for a movement ability
 */
export interface MovementAbilityConfig {
  /** Asset definition ID */
  assetId: string;
  /** Range in hexes */
  range: number;
  /** Cost in FacCreds per asset moved */
  costPerAsset: number;
  /** Whether this ability requires an action */
  requiresAction: boolean;
  /** Whether this can move multiple assets */
  canMoveMultiple: boolean;
  /** Whether the asset can move itself */
  canMoveSelf: boolean;
  /** Function to filter which assets can be moved */
  assetFilter?: (asset: FactionAsset) => boolean;
  /** Whether government permission is ignored */
  ignoresPermission: boolean;
  /** Description for UI */
  description: string;
}

/**
 * Asset filter functions
 */
export const AssetFilters = {
  /** Only Special Forces units */
  specialForces: (asset: FactionAsset): boolean => {
    const def = getAssetById(asset.definitionId);
    return def?.type === 'Special Forces';
  },

  /** Only non-Starship assets */
  nonStarship: (asset: FactionAsset): boolean => {
    const def = getAssetById(asset.definitionId);
    return def?.type !== 'Starship';
  },

  /** Only non-Force assets */
  nonForce: (asset: FactionAsset): boolean => {
    const def = getAssetById(asset.definitionId);
    return def?.category !== 'Force';
  },

  /** Only non-starship Cunning or Wealth assets */
  nonStarshipCunningOrWealth: (asset: FactionAsset): boolean => {
    const def = getAssetById(asset.definitionId);
    if (!def) return false;
    const isNonStarship = def.type !== 'Starship';
    const isCunningOrWealth = def.category === 'Cunning' || def.category === 'Wealth';
    return isNonStarship && isCunningOrWealth;
  },

  /** Military Unit or Special Forces */
  militaryOrSpecialForces: (asset: FactionAsset): boolean => {
    const def = getAssetById(asset.definitionId);
    return def?.type === 'Military Unit' || def?.type === 'Special Forces';
  },

  /** Any asset (no filter) */
  any: (_asset: FactionAsset): boolean => {
    return true;
  },
};

/**
 * Movement ability configurations for all assets with movement capabilities
 */
export const MOVEMENT_ABILITIES: Record<string, MovementAbilityConfig> = {
  // CUNNING ASSETS
  'cunning_1_smugglers': {
    assetId: 'cunning_1_smugglers',
    range: 2,
    costPerAsset: 1,
    requiresAction: true, // Text says "For one FacCred..." which uses the action
    canMoveMultiple: true, // Can move itself and/or one Special Forces
    canMoveSelf: true,
    assetFilter: AssetFilters.specialForces,
    ignoresPermission: false,
    description: 'Move Smugglers and/or one Special Forces unit up to 2 hexes (1 FacCred)',
  },

  'cunning_2_seductress': {
    assetId: 'cunning_2_seductress',
    range: 1,
    costPerAsset: 0, // Free
    requiresAction: true,
    canMoveMultiple: false,
    canMoveSelf: true,
    assetFilter: undefined, // Only moves itself
    ignoresPermission: false,
    description: 'Move Seductress to any world within 1 hex (Free)',
  },

  'cunning_3_covert_shipping': {
    assetId: 'cunning_3_covert_shipping',
    range: 3,
    costPerAsset: 1,
    requiresAction: false, // Text says "can be moved", not "As an action"
    canMoveMultiple: false, // One Special Forces asset
    canMoveSelf: false,
    assetFilter: AssetFilters.specialForces,
    ignoresPermission: false,
    description: 'Move one Special Forces asset within 3 hexes (1 FacCred)',
  },

  'cunning_6_covert_transit_net': {
    assetId: 'cunning_6_covert_transit_net',
    range: 3,
    costPerAsset: 0, // No specific cost mentioned beyond action
    requiresAction: true,
    canMoveMultiple: true, // Any Special Forces assets (plural)
    canMoveSelf: false,
    assetFilter: AssetFilters.specialForces,
    ignoresPermission: false,
    description: 'Move any Special Forces assets within 3 hexes',
  },

  // FORCE ASSETS
  'force_2_heavy_drop_assets': {
    assetId: 'force_2_heavy_drop_assets',
    range: 1,
    costPerAsset: 1,
    requiresAction: true,
    canMoveMultiple: true, // Any number of non-Starship assets
    canMoveSelf: true,
    assetFilter: AssetFilters.nonStarship,
    ignoresPermission: false,
    description: 'Move any non-Starship assets to world within 1 hex (1 FacCred per asset)',
  },

  'force_4_beachhead_landers': {
    assetId: 'force_4_beachhead_landers',
    range: 1,
    costPerAsset: 1,
    requiresAction: true,
    canMoveMultiple: true, // Any number of assets
    canMoveSelf: true,
    assetFilter: AssetFilters.any,
    ignoresPermission: false,
    description: 'Move any assets to world within 1 hex (1 FacCred per asset)',
  },

  'force_4_extended_theater': {
    assetId: 'force_4_extended_theater',
    range: 2,
    costPerAsset: 1,
    requiresAction: true,
    canMoveMultiple: false, // One non-Starship asset
    canMoveSelf: true,
    assetFilter: AssetFilters.nonStarship,
    ignoresPermission: false,
    description: 'Move one non-Starship asset within 2 hexes (1 FacCred)',
  },

  'force_4_strike_fleet': {
    assetId: 'force_4_strike_fleet',
    range: 1,
    costPerAsset: 0, // Free
    requiresAction: true,
    canMoveMultiple: false,
    canMoveSelf: true,
    assetFilter: undefined, // Only moves itself
    ignoresPermission: false,
    description: 'Move Strike Fleet to world within 1 hex (Free)',
  },

  'force_5_blockade_fleet': {
    assetId: 'force_5_blockade_fleet',
    range: 1,
    costPerAsset: 0, // Free
    requiresAction: true,
    canMoveMultiple: false,
    canMoveSelf: true,
    assetFilter: undefined, // Only moves itself
    ignoresPermission: false,
    description: 'Move Blockade Fleet to world within 1 hex (Free)',
  },

  'force_7_deep_strike_landers': {
    assetId: 'force_7_deep_strike_landers',
    range: 3,
    costPerAsset: 2,
    requiresAction: true,
    canMoveMultiple: false, // One non-Starship asset
    canMoveSelf: true,
    assetFilter: AssetFilters.nonStarship,
    ignoresPermission: true, // Can move even if government objects
    description: 'Move one non-Starship asset within 3 hexes, ignores permission (2 FacCreds)',
  },

  'force_7_space_marines': {
    assetId: 'force_7_space_marines',
    range: 1,
    costPerAsset: 0, // Free
    requiresAction: true,
    canMoveMultiple: false,
    canMoveSelf: true,
    assetFilter: undefined, // Only moves itself
    ignoresPermission: true, // Can move whether or not government permits
    description: 'Move Space Marines to world within 1 hex, ignores permission (Free)',
  },

  'force_8_capital_fleet': {
    assetId: 'force_8_capital_fleet',
    range: 3,
    costPerAsset: 0, // Free
    requiresAction: true,
    canMoveMultiple: false,
    canMoveSelf: true,
    assetFilter: undefined, // Only moves itself
    ignoresPermission: false,
    description: 'Move Capital Fleet to world within 3 hexes (Free)',
  },

  // WEALTH ASSETS
  'wealth_2_freighter_contract': {
    assetId: 'wealth_2_freighter_contract',
    range: 2,
    costPerAsset: 1,
    requiresAction: true,
    canMoveMultiple: false, // One non-Force asset
    canMoveSelf: true,
    assetFilter: AssetFilters.nonForce,
    ignoresPermission: false,
    description: 'Move one non-Force asset within 2 hexes (1 FacCred)',
  },

  'wealth_2_surveyors': {
    assetId: 'wealth_2_surveyors',
    range: 2,
    costPerAsset: 0, // Free
    requiresAction: true,
    canMoveMultiple: false,
    canMoveSelf: true,
    assetFilter: undefined, // Only moves itself
    ignoresPermission: false,
    description: 'Move Surveyors to world within 2 hexes (Free)',
  },

  'wealth_3_mercenaries': {
    assetId: 'wealth_3_mercenaries',
    range: 1,
    costPerAsset: 0, // Free
    requiresAction: true,
    canMoveMultiple: false,
    canMoveSelf: true,
    assetFilter: undefined, // Only moves itself
    ignoresPermission: false, // Requires permission to move to a world
    description: 'Move Mercenaries to world within 1 hex (Free, requires permission)',
  },

  'wealth_4_shipping_combine': {
    assetId: 'wealth_4_shipping_combine',
    range: 2,
    costPerAsset: 1,
    requiresAction: true,
    canMoveMultiple: true, // Any number of non-Force assets
    canMoveSelf: true,
    assetFilter: AssetFilters.nonForce,
    ignoresPermission: false,
    description: 'Move any non-Force assets within 2 hexes (1 FacCred per asset)',
  },

  'wealth_5_blockade_runners': {
    assetId: 'wealth_5_blockade_runners',
    range: 3,
    costPerAsset: 2,
    requiresAction: true,
    canMoveMultiple: false, // Itself or one Military/Special Forces
    canMoveSelf: true,
    assetFilter: AssetFilters.militaryOrSpecialForces,
    ignoresPermission: true, // Can move units that normally require permission
    description: 'Move Blockade Runners or one Military/Special Forces within 3 hexes, ignores permission (2 FacCreds)',
  },

  'wealth_7_transit_web': {
    assetId: 'wealth_7_transit_web',
    range: 3,
    costPerAsset: 1, // 1 FacCred per use (covers any number)
    requiresAction: false, // FREE ACTION - doesn't require action
    canMoveMultiple: true, // Any number of eligible assets
    canMoveSelf: false,
    assetFilter: AssetFilters.nonStarshipCunningOrWealth,
    ignoresPermission: false,
    description: 'Move any non-starship Cunning/Wealth assets within 3 hexes (1 FacCred total, free action)',
  },

  'wealth_8_scavenger_fleet': {
    assetId: 'wealth_8_scavenger_fleet',
    range: 3,
    costPerAsset: 0, // No extra cost beyond maintenance
    requiresAction: true,
    canMoveMultiple: false,
    canMoveSelf: true,
    assetFilter: undefined, // Only moves itself
    ignoresPermission: false,
    description: 'Move Scavenger Fleet to world within 3 hexes (Free)',
  },
};

/**
 * Check if an asset has a movement ability
 */
export function hasMovementAbility(assetDefinitionId: string): boolean {
  return assetDefinitionId in MOVEMENT_ABILITIES;
}

/**
 * Get the movement ability configuration for an asset
 */
export function getMovementAbility(assetDefinitionId: string): MovementAbilityConfig | undefined {
  return MOVEMENT_ABILITIES[assetDefinitionId];
}

/**
 * Check if a specific asset can be moved by a movement ability
 */
export function canMoveAsset(
  movementConfig: MovementAbilityConfig,
  targetAsset: FactionAsset,
  abilityAsset: FactionAsset
): boolean {
  // If the ability can move itself and target is the ability asset
  if (movementConfig.canMoveSelf && targetAsset.id === abilityAsset.id) {
    return true;
  }

  // If there's an asset filter, check it
  if (movementConfig.assetFilter) {
    return movementConfig.assetFilter(targetAsset);
  }

  // If no filter and can't move others, can't move this asset
  return false;
}

/**
 * Get a list of assets that can be moved by a movement ability
 */
export function getMovableAssets(
  movementConfig: MovementAbilityConfig,
  abilityAsset: FactionAsset,
  allAssetsAtLocation: FactionAsset[]
): FactionAsset[] {
  return allAssetsAtLocation.filter((asset) => 
    canMoveAsset(movementConfig, asset, abilityAsset)
  );
}


