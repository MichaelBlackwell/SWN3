import type { Faction, FactionAsset } from '../types/faction';
import { getAssetById } from '../data/assetLibrary';
import { rollD10, rollDiceExpression, performCombatRoll } from './combatResolver';
import type { RootState } from '../store/store';

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
  'cunning_1_smugglers': (context) => {
    // Smugglers: For one FacCred, transport itself and/or any one Special Forces unit
    // to a planet up to two hexes away.
    // This is a movement ability - handled separately in movement system
    return {
      success: false,
      message: 'Smugglers transport ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'cunning_3_covert_shipping': (context) => {
    // Covert Shipping: Any one Special Forces unit can be moved between any worlds
    // within three hexes at the cost of one FacCred.
    // This is a movement ability - handled separately
    return {
      success: false,
      message: 'Covert Shipping transport ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'cunning_6_covert_transit_net': (context) => {
    // Covert Transit Net: As an action, any Special Forces assets can be moved
    // between any worlds within three hexes.
    // This is a movement ability - handled separately
    return {
      success: false,
      message: 'Covert Transit Net transport ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'cunning_4_party_machine': (context) => {
    // Party Machine: Each turn, provides 1 FacCred to its owning faction.
    // This is passive income, not an action ability
    return {
      success: false,
      message: 'Party Machine provides passive income each turn',
      requiresAction: false,
    };
  },

  // FORCE ASSETS
  'force_2_heavy_drop_assets': (context) => {
    // Heavy Drop Assets: As an action, may move any number of assets on the planet,
    // including itself, to any world within one hex at a cost of one FacCred per asset moved.
    // This is a movement ability - handled separately
    return {
      success: false,
      message: 'Heavy Drop Assets transport ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'force_4_beachhead_landers': (context) => {
    // Beachhead Landers: As an action, may move any number of assets on the planet,
    // including itself, to any world within one hex at a cost of one FacCred per asset moved.
    return {
      success: false,
      message: 'Beachhead Landers transport ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'force_4_extended_theater': (context) => {
    // Extended Theater: As an action, any one non-Starship asset, including itself,
    // can be moved between any two worlds within two hexes at a cost of 1 FacCred.
    return {
      success: false,
      message: 'Extended Theater transport ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'force_5_pretech_logistics': (context) => {
    // Pretech Logistics: As an action, allows the owner to buy one Force asset on that world
    // that requires up to tech level 5 to purchase. This asset costs half again as many
    // FacCreds as usual, rounded up. Only one asset can be purchased per turn.
    return {
      success: false,
      message: 'Pretech Logistics purchase ability requires asset purchase UI integration',
      requiresAction: true,
    };
  },

  'force_7_deep_strike_landers': (context) => {
    // Deep Strike Landers: As an action, any one non-Starship asset, including itself,
    // can be moved between any two worlds within three hexes at a cost of 2 FacCreds.
    return {
      success: false,
      message: 'Deep Strike Landers transport ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'force_4_strike_fleet': (context) => {
    // Strike Fleet: As an action, can move to any world within one hex.
    return {
      success: false,
      message: 'Strike Fleet movement ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'force_5_blockade_fleet': (context) => {
    // Blockade Fleet: As an action, may move itself to a world within one hex.
    return {
      success: false,
      message: 'Blockade Fleet movement ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'force_7_space_marines': (context) => {
    // Space Marines: As an action, can move to any world within one hex.
    return {
      success: false,
      message: 'Space Marines movement ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'force_8_capital_fleet': (context) => {
    // Capital Fleet: As an action, may move to any world within three hexes.
    return {
      success: false,
      message: 'Capital Fleet movement ability is handled through the movement system',
      requiresAction: true,
    };
  },

  // WEALTH ASSETS
  'wealth_1_harvesters': (context) => {
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

  'wealth_2_freighter_contract': (context) => {
    // Freighter Contract: As an action, may move any one non-Force asset, including this one,
    // to any world within two hexes at a cost of one FacCred.
    return {
      success: false,
      message: 'Freighter Contract transport ability is handled through the movement system',
      requiresAction: true,
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

  'wealth_4_shipping_combine': (context) => {
    // Shipping Combine: As an action, may move any number of non-Force assets, including itself,
    // to any world within two hexes at a cost of one FacCred per asset.
    return {
      success: false,
      message: 'Shipping Combine transport ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'wealth_4_monopoly': (context) => {
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

  'wealth_5_marketers': (context) => {
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

  'wealth_5_blockade_runners': (context) => {
    // Blockade Runners: As an action, can transfer itself or any one Military Unit or
    // Special Forces to a world within three hexes for a cost of two FacCreds.
    return {
      success: false,
      message: 'Blockade Runners transport ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'wealth_5_commodities_broker': (context) => {
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

  'wealth_6_venture_capital': (context) => {
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

  'wealth_7_pretech_manufactory': (context) => {
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

  'wealth_7_transit_web': (context) => {
    // Transit Web: For one FacCred, any number of non-starship Cunning or Wealth assets
    // may be moved between any two worlds within three hexes. This may be done freely
    // on the owner's turn so long as the fee can be paid, and using the ability doesn't
    // require an action (FREE ACTION).
    return {
      success: false,
      message: 'Transit Web transport ability is handled through the movement system (free action)',
      requiresAction: false, // FREE ACTION
    };
  },

  'wealth_8_scavenger_fleet': (context) => {
    // Scavenger Fleet: As an action, can be moved to any world within three hexes.
    return {
      success: false,
      message: 'Scavenger Fleet movement ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'wealth_3_mercenaries': (context) => {
    // Mercenaries: As an action, can move to any world within one hex.
    return {
      success: false,
      message: 'Mercenaries movement ability is handled through the movement system',
      requiresAction: true,
    };
  },

  'wealth_4_surveyors': (context) => {
    // Surveyors: As an action, can be moved to any world within two hexes.
    return {
      success: false,
      message: 'Surveyors movement ability is handled through the movement system',
      requiresAction: true,
    };
  },
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
export function getAbilityDescription(assetDefinitionId: string): string | null {
  const assetDef = getAssetById(assetDefinitionId);
  if (!assetDef) return null;

  // Return the description from the asset definition if available
  if (assetDef.description) return assetDef.description;

  // Otherwise, check if it's in the registry and return a generic message
  if (assetDefinitionId in abilityRegistry) {
    return 'This asset has a special ability that can be used during the Action phase';
  }

  return null;
}




