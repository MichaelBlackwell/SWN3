import type { Faction, FactionAsset } from '../types/faction';
import { getAssetById } from '../data/assetLibrary';
import { rollDiceExpression } from './combatResolver';
import type { RootState } from '../store/store';
import { getMovementAbility } from './movementAbilities';

/**
 * Result of executing an asset ability
 */
export interface AbilityResult {
  success: boolean;
  message: string;
  cost?: number; // FacCred cost (if any)
  facCredsGained?: number; // FacCreds gained (if any)
  facCredsLost?: number; // FacCreds lost (if any)
  requiresAction: boolean; // Whether this ability consumes the turn's action slot
  isMovementAbility?: boolean; // Whether this is a movement ability that needs destination selection
  movementConfig?: ReturnType<typeof getMovementAbility>; // Movement configuration if applicable
  data?: Record<string, unknown>; // Additional result data
}

/**
 * Context for executing an ability
 */
export interface AbilityContext {
  faction: Faction;
  asset: FactionAsset;
  assetDef: ReturnType<typeof getAssetById>;
  state: RootState; // Full Redux state for accessing other factions, systems, etc.
}

/**
 * Type for ability execution functions
 */
export type AbilityExecutor = (context: AbilityContext) => AbilityResult;

/**
 * Registry of asset abilities
 * Maps asset definition IDs to their ability execution functions
 */
const abilityRegistry: Record<string, AbilityExecutor> = {
  // CUNNING ASSETS
  'cunning_1_smugglers': (_context) => {
    // Smugglers: For one FacCred, transport itself and/or any one Special Forces unit
    // to a planet up to two hexes away.
    const movementConfig = getMovementAbility('cunning_1_smugglers')!;
    return {
      success: true,
      message: 'Click a destination within 2 hexes to move Smugglers and/or Special Forces unit',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'cunning_2_seductress': (_context) => {
    // Seductress: As an action, can travel to any world within one hex
    const movementConfig = getMovementAbility('cunning_2_seductress')!;
    return {
      success: true,
      message: 'Click a destination within 1 hex to move Seductress',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'cunning_3_covert_shipping': (_context) => {
    // Covert Shipping: Any one Special Forces unit can be moved between any worlds
    // within three hexes at the cost of one FacCred.
    const movementConfig = getMovementAbility('cunning_3_covert_shipping')!;
    return {
      success: true,
      message: 'Click a destination within 3 hexes to move Special Forces unit',
      requiresAction: false, // This doesn't use the action
      isMovementAbility: true,
      movementConfig,
    };
  },

  'cunning_6_covert_transit_net': (_context) => {
    // Covert Transit Net: As an action, any Special Forces assets can be moved
    // between any worlds within three hexes.
    const movementConfig = getMovementAbility('cunning_6_covert_transit_net')!;
    return {
      success: true,
      message: 'Click a destination within 3 hexes to move Special Forces assets',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'cunning_4_party_machine': (_context) => {
    // Party Machine: Each turn, provides 1 FacCred to its owning faction.
    // This is passive income, not an action ability
    return {
      success: false,
      message: 'Party Machine provides passive income each turn',
      requiresAction: false,
    };
  },

  // FORCE ASSETS
  'force_2_heavy_drop_assets': (_context) => {
    // Heavy Drop Assets: As an action, may move any number of non-Starship assets,
    // including itself, to any world within one hex at a cost of one FacCred per asset moved.
    const movementConfig = getMovementAbility('force_2_heavy_drop_assets')!;
    return {
      success: true,
      message: 'Click a destination within 1 hex to move non-Starship assets',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'force_4_beachhead_landers': (_context) => {
    // Beachhead Landers: As an action, may move any number of assets on the planet,
    // including itself, to any world within one hex at a cost of one FacCred per asset moved.
    const movementConfig = getMovementAbility('force_4_beachhead_landers')!;
    return {
      success: true,
      message: 'Click a destination within 1 hex to move assets',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'force_4_extended_theater': (_context) => {
    // Extended Theater: As an action, any one non-Starship asset, including itself,
    // can be moved between any two worlds within two hexes at a cost of 1 FacCred.
    const movementConfig = getMovementAbility('force_4_extended_theater')!;
    return {
      success: true,
      message: 'Click a destination within 2 hexes to move one non-Starship asset',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'force_5_pretech_logistics': (_context) => {
    // Pretech Logistics: As an action, allows the owner to buy one Force asset on that world
    // that requires up to tech level 5 to purchase. This asset costs half again as many
    // FacCreds as usual, rounded up. Only one asset can be purchased per turn.
    return {
      success: false,
      message: 'Pretech Logistics purchase ability requires asset purchase UI integration',
      requiresAction: true,
    };
  },

  'force_7_deep_strike_landers': (_context) => {
    // Deep Strike Landers: As an action, any one non-Starship asset, including itself,
    // can be moved between any two worlds within three hexes at a cost of 2 FacCreds.
    const movementConfig = getMovementAbility('force_7_deep_strike_landers')!;
    return {
      success: true,
      message: 'Click a destination within 3 hexes to move one non-Starship asset (ignores permission)',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'force_4_strike_fleet': (_context) => {
    // Strike Fleet: As an action, can move to any world within one hex.
    const movementConfig = getMovementAbility('force_4_strike_fleet')!;
    return {
      success: true,
      message: 'Click a destination within 1 hex to move Strike Fleet',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'force_5_blockade_fleet': (_context) => {
    // Blockade Fleet: As an action, may move itself to a world within one hex.
    const movementConfig = getMovementAbility('force_5_blockade_fleet')!;
    return {
      success: true,
      message: 'Click a destination within 1 hex to move Blockade Fleet',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'force_7_space_marines': (_context) => {
    // Space Marines: As an action, can move to any world within one hex.
    const movementConfig = getMovementAbility('force_7_space_marines')!;
    return {
      success: true,
      message: 'Click a destination within 1 hex to move Space Marines (ignores permission)',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'force_8_capital_fleet': (_context) => {
    // Capital Fleet: As an action, may move to any world within three hexes.
    const movementConfig = getMovementAbility('force_8_capital_fleet')!;
    return {
      success: true,
      message: 'Click a destination within 3 hexes to move Capital Fleet',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  // WEALTH ASSETS
  'wealth_1_harvesters': (_context) => {
    // Harvesters: As an action, the owning faction may roll 1d6. On 3+, gain one FacCred.
    const roll = rollDiceExpression('1d6');
    const success = roll >= 3;
    const facCredsGained = success ? 1 : 0;

    return {
      success,
      message: success
        ? `Harvesters gathered resources: Rolled ${roll}, gained ${facCredsGained} FacCred`
        : `Harvesters found little: Rolled ${roll}, no FacCreds gained`,
      facCredsGained,
      requiresAction: true,
    };
  },

  'wealth_2_freighter_contract': (_context) => {
    // Freighter Contract: As an action, may move any one non-Force asset, including this one,
    // to any world within two hexes at a cost of one FacCred.
    const movementConfig = getMovementAbility('wealth_2_freighter_contract')!;
    return {
      success: true,
      message: 'Click a destination within 2 hexes to move one non-Force asset',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'wealth_2_surveyors': (_context) => {
    // Surveyors: As an action, can be moved to any world within two hexes
    const movementConfig = getMovementAbility('wealth_2_surveyors')!;
    return {
      success: true,
      message: 'Click a destination within 2 hexes to move Surveyors',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'wealth_3_postech_industry': (context) => {
    // Postech Industry: As an action, roll 1d6. On 1, one FacCred is lost, on 2-4 one FacCred
    // is earned, and a 5-6 returns two FacCreds. If money is lost and no resources are available
    // to pay it, the Postech Industry is destroyed.
    const roll = rollDiceExpression('1d6');
    let facCredsGained = 0;
    let facCredsLost = 0;
    let message = '';

    if (roll === 1) {
      facCredsLost = 1;
      message = `Postech Industry had losses: Rolled ${roll}, lost ${facCredsLost} FacCred`;
      if (context.faction.facCreds < facCredsLost) {
        message += ' (Industry will be destroyed if unable to pay)';
      }
    } else if (roll >= 2 && roll <= 4) {
      facCredsGained = 1;
      message = `Postech Industry produced goods: Rolled ${roll}, gained ${facCredsGained} FacCred`;
    } else {
      facCredsGained = 2;
      message = `Postech Industry had excellent production: Rolled ${roll}, gained ${facCredsGained} FacCreds`;
    }

    return {
      success: true,
      message,
      facCredsGained,
      facCredsLost,
      requiresAction: true,
      data: { shouldDestroyIfCannotPay: roll === 1 && context.faction.facCreds < 1 },
    };
  },

  'wealth_4_shipping_combine': (_context) => {
    // Shipping Combine: As an action, may move any number of non-Force assets, including itself,
    // to any world within two hexes at a cost of one FacCred per asset.
    const movementConfig = getMovementAbility('wealth_4_shipping_combine')!;
    return {
      success: true,
      message: 'Click a destination within 2 hexes to move non-Force assets',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'wealth_4_monopoly': (_context) => {
    // Monopoly: As an action, owners may force one other faction with unstealthed assets
    // on that world to pay them one FacCred. If the target faction can't pay, they lose
    // one asset of their choice on the world.
    // This requires selecting a target faction - handled in UI
    return {
      success: false,
      message: 'Monopoly requires selecting a target faction (not yet implemented)',
      requiresAction: true,
    };
  },

  'wealth_5_marketers': (_context) => {
    // Marketers: As an action, may test Cunning vs. Wealth against a rival faction's asset.
    // If successful, the target faction must immediately pay half the asset's purchase cost,
    // rounded down, or have it become disabled and useless until this price is paid.
    // This requires selecting a target - handled in UI
    return {
      success: false,
      message: 'Marketers requires selecting a target asset (not yet implemented)',
      requiresAction: true,
    };
  },

  'wealth_5_blockade_runners': (_context) => {
    // Blockade Runners: As an action, can transfer itself or any one Military Unit or
    // Special Forces to a world within three hexes for a cost of two FacCreds.
    const movementConfig = getMovementAbility('wealth_5_blockade_runners')!;
    return {
      success: true,
      message: 'Click a destination within 3 hexes to move Blockade Runners or Military/Special Forces (ignores permission)',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'wealth_5_commodities_broker': (_context) => {
    // Commodities Brokers: As an action, roll 1d8; that many FacCreds are subtracted
    // from the cost of their next asset purchase, down to a minimum of half normal price,
    // rounded down.
    const roll = rollDiceExpression('1d8');
    return {
      success: true,
      message: `Commodities Broker negotiated discounts: Rolled ${roll}, next asset purchase costs ${roll} fewer FacCreds (min half price)`,
      requiresAction: true,
      data: { discountAmount: roll },
    };
  },

  'wealth_6_venture_capital': (_context) => {
    // Venture Capital: As an action, 1d8 is rolled; on a 1, the asset is destroyed,
    // while on a 2-3 one FacCred is gained, 4-7 yields two FacCreds and 8 grants three FacCreds.
    const roll = rollDiceExpression('1d8');
    let facCredsGained = 0;
    let message = '';
    let shouldDestroy = false;

    if (roll === 1) {
      shouldDestroy = true;
      message = `Venture Capital investment failed catastrophically: Rolled ${roll}, asset will be destroyed`;
    } else if (roll >= 2 && roll <= 3) {
      facCredsGained = 1;
      message = `Venture Capital had modest returns: Rolled ${roll}, gained ${facCredsGained} FacCred`;
    } else if (roll >= 4 && roll <= 7) {
      facCredsGained = 2;
      message = `Venture Capital had good returns: Rolled ${roll}, gained ${facCredsGained} FacCreds`;
    } else {
      facCredsGained = 3;
      message = `Venture Capital had excellent returns: Rolled ${roll}, gained ${facCredsGained} FacCreds`;
    }

    return {
      success: !shouldDestroy,
      message,
      facCredsGained,
      requiresAction: true,
      data: { shouldDestroy },
    };
  },

  'wealth_7_pretech_manufactory': (_context) => {
    // Pretech Manufactory: As an action, roll 1d8 for a Pretech Manufactory, and gain
    // half that many FacCreds, rounded up.
    const roll = rollDiceExpression('1d8');
    const facCredsGained = Math.ceil(roll / 2);

    return {
      success: true,
      message: `Pretech Manufactory produced advanced goods: Rolled ${roll}, gained ${facCredsGained} FacCreds`,
      facCredsGained,
      requiresAction: true,
    };
  },

  'wealth_7_transit_web': (_context) => {
    // Transit Web: For one FacCred, any number of non-starship Cunning or Wealth assets
    // may be moved between any two worlds within three hexes. This may be done freely
    // on the owner's turn so long as the fee can be paid, and using the ability doesn't
    // require an action (FREE ACTION).
    const movementConfig = getMovementAbility('wealth_7_transit_web')!;
    return {
      success: true,
      message: 'Click a destination within 3 hexes to move non-starship Cunning/Wealth assets (free action)',
      requiresAction: false, // FREE ACTION
      isMovementAbility: true,
      movementConfig,
    };
  },

  'wealth_8_scavenger_fleet': (_context) => {
    // Scavenger Fleet: As an action, can be moved to any world within three hexes.
    const movementConfig = getMovementAbility('wealth_8_scavenger_fleet')!;
    return {
      success: true,
      message: 'Click a destination within 3 hexes to move Scavenger Fleet',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },

  'wealth_3_mercenaries': (_context) => {
    // Mercenaries: As an action, can move to any world within one hex.
    const movementConfig = getMovementAbility('wealth_3_mercenaries')!;
    return {
      success: true,
      message: 'Click a destination within 1 hex to move Mercenaries (requires permission)',
      requiresAction: true,
      isMovementAbility: true,
      movementConfig,
    };
  },
};

const abilityDescriptions: Record<string, string> = {
  'cunning_4_seditionists':
    'Pay 1d4 FacCreds to attach to an enemy asset on the same planet. That asset cannot attack until the Seditionists move or attach elsewhere. If the target asset is destroyed, the Seditionists survive and can be reassigned.',
  'wealth_3_mercenaries': 'As an action, Mercenaries can move to any world within one hex of their current location.',
  'wealth_1_harvesters': 'As an action, roll 1d6. On 3+, gain 1 FacCred.',
  'wealth_3_postech_industry': 'As an action, roll 1d6. 1 = lose 1 FacCred (asset destroyed if you cannot pay), 2-4 = gain 1 FacCred, 5-6 = gain 2 FacCreds.',
  'wealth_6_venture_capital': 'As an action, roll 1d8. On 1 the asset is destroyed, 2-3 gain 1 FacCred, 4-7 gain 2 FacCreds, 8 gain 3 FacCreds.',
  'wealth_7_pretech_manufactory': 'As an action, roll 1d8 and gain half that many FacCreds (rounded up).',
  'wealth_5_commodities_broker': 'As an action, roll 1d8. Subtract that number of FacCreds from the cost of your next asset purchase (minimum half price).',
  'wealth_4_monopoly': 'As an action, force one rival with unstealthed assets on the world to pay you 1 FacCred or lose an asset of their choice.',
  'wealth_5_marketers': 'As an action, test Cunning vs. Wealth against a rival asset. On success they must pay half the asset cost or it becomes disabled.',
  'force_2_heavy_drop_assets': 'As an action, move any number of assets (including itself) to a world within one hex. Costs 1 FacCred per asset moved.',
  'force_4_beachhead_landers': 'As an action, move any number of assets (including itself) to a world within one hex. Costs 1 FacCred per asset.',
  'force_4_extended_theater': 'As an action, move any one non-Starship asset up to two hexes away for 1 FacCred.',
  'force_7_deep_strike_landers': 'As an action, move any one non-Starship asset up to three hexes away for 2 FacCreds.',
  'force_5_pretech_logistics': 'As an action, buy one Force asset on this world up to TL5. It costs 1.5× normal (rounded up).',
  'cunning_1_smugglers': 'For 1 FacCred, transport itself and/or one Special Forces unit up to two hexes away.',
  'cunning_3_covert_shipping': 'As an action, move any one Special Forces unit within three hexes for 1 FacCred.',
  'cunning_6_covert_transit_net': 'As an action, move any Special Forces assets between any worlds within three hexes.',
  'wealth_2_freighter_contract': 'As an action, move any one non-Force asset (including itself) to any world within two hexes for 1 FacCred.',
  'wealth_4_shipping_combine': 'As an action, move any number of non-Force assets within two hexes for 1 FacCred per asset.',
  'wealth_5_blockade_runners': 'As an action, move itself or any one Military/Special Forces unit within three hexes for 2 FacCreds.',
  'wealth_4_surveyors': 'As an action, move to any world within two hexes and gain +1 die when expanding influence.',
  'wealth_7_transit_web': 'For 1 FacCred (free action), move any number of non-starship Cunning or Wealth assets between worlds within three hexes.',
  'force_4_strike_fleet': 'As an action, can move to any world within one hex.',
  'force_5_blockade_fleet': 'As an action, may move to a world within one hex.',
  'force_7_space_marines': 'As an action, can move to any world within one hex.',
  'force_8_capital_fleet': 'As an action, may move to any world within three hexes.',
};

/**
 * Check if an asset has a special ability
 */
export function assetHasAbility(assetDefinitionId: string): boolean {
  const assetDef = getAssetById(assetDefinitionId);
  if (!assetDef) return false;

  // Check if asset has hasAction flag or is in the ability registry
  return assetDef.specialFlags.hasAction || assetDefinitionId in abilityRegistry;
}

export function getAbilityDescription(assetDefinitionId: string): string {
  if (abilityDescriptions[assetDefinitionId]) {
    return abilityDescriptions[assetDefinitionId];
  }

  const assetDef = getAssetById(assetDefinitionId);
  if (assetDef?.specialFlags?.hasAction) {
    return `${assetDef.name} has a unique special action described in the faction rules.`;
  }

  return 'This asset has a special ability that can be used during the Action phase.';
}

/**
 * Check if an asset's ability is a "free" action (doesn't consume action slot)
 */
export function isFreeAction(assetDefinitionId: string): boolean {
  const executor = abilityRegistry[assetDefinitionId];
  if (!executor) return false;

  // Create a dummy context to check if it's a free action
  // We'll use a minimal context just to check the requiresAction flag
  const dummyContext: AbilityContext = {
    faction: {} as Faction,
    asset: {} as FactionAsset,
    assetDef: getAssetById(assetDefinitionId)!,
    state: {} as RootState,
  };

  try {
    const result = executor(dummyContext);
    return !result.requiresAction;
  } catch {
    return false;
  }
}

/**
 * Execute an asset's special ability
 */
export function executeAbility(
  faction: Faction,
  asset: FactionAsset,
  state: RootState
): AbilityResult {
  const assetDef = getAssetById(asset.definitionId);
  if (!assetDef) {
    return {
      success: false,
      message: 'Asset definition not found',
      requiresAction: true,
    };
  }

  const executor = abilityRegistry[asset.definitionId];
  if (!executor) {
    return {
      success: false,
      message: 'This asset does not have an executable ability',
      requiresAction: true,
    };
  }

  const context: AbilityContext = {
    faction,
    asset,
    assetDef,
    state,
  };

  return executor(context);
}

/**
 * Get a description of what an asset's ability does
 */
