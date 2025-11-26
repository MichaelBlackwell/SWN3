/**
 * Faction Tag Modifiers System
 * 
 * This module defines the mechanical effects of faction tags on combat,
 * economics, and asset permissions based on SWN (Stars Without Number) rules.
 */

import type { Faction, FactionTag } from '../types/faction';
import type { AssetCategory } from '../types/asset';
import { hasBaseOfInfluence } from './expandInfluence';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Combat modifier effects that tags can provide
 */
export interface CombatModifier {
  /** Which attribute attack this modifier applies to */
  attackAttribute?: AssetCategory;
  /** Which attribute defense this modifier applies to */
  defenseAttribute?: AssetCategory;
  /** Applies only to these asset definitions (if provided) */
  assetDefinitionIds?: string[];
  /** Number of extra dice to roll */
  extraDice: number;
  /** Reroll behavior */
  rerollOnes?: boolean;
  /** Always lose ties */
  loseTies?: boolean;
  /** Conditions for the modifier to apply */
  condition?: 'onHomeworld' | 'againstTL5' | 'seizePlanet' | 'withTL0Asset';
  /** Once per turn limitation */
  oncePerTurn?: boolean;
  /** Description of the modifier */
  description: string;
}

/**
 * Economic modifier effects
 */
export interface EconomicModifier {
  /** Income multiplier (1.0 = no change, 1.5 = +50%) */
  incomeMultiplier?: number;
  /** Flat income bonus */
  incomeBonus?: number;
  /** Discount on asset purchases (flat FacCreds) */
  purchaseDiscount?: number;
  /** Conditions for the modifier */
  condition?: 'peaceable' | 'assetDestroyed' | 'enemyMovesToBoI' | 'highTechAsset';
  /** Description */
  description: string;
}

/**
 * Asset permission effects
 */
export interface AssetPermission {
  /** Assets uniquely available to this tag */
  exclusiveAssets?: string[];
  /** All assets start stealthed */
  autoStealth?: boolean;
  /** Treat all BoI worlds as this tech level */
  treatWorldsAsTechLevel?: number;
  /** All assets gain movement ability */
  allAssetsCanMove?: boolean;
  /** Movement range for all assets (in hexes) */
  movementRange?: number;
  /** Skip government permission requirements */
  bypassPermission?: boolean;
  /** Homeworld has Planetary Government benefits */
  homeworldAsGovernment?: boolean;
  /** Description */
  description: string;
}

/**
 * Movement and maintenance modifier effects
 */
export interface MovementMaintenanceModifier {
  /** Per-asset maintenance modifier (can be negative) */
  maintenanceModifier?: number;
  /** Modifier to the base movement cost */
  movementCostModifier?: number;
  /** Additional movement range (hexes beyond default) */
  movementRangeBonus?: number;
  /** Additional cost when leaving homeworld */
  homeworldDeparturePenalty?: number;
  /** Grant universal movement ability */
  grantMovementAbility?: boolean;
  /** Toll charged to enemies moving onto this faction's BoI worlds */
  enemyMovementToll?: number;
  /** Description */
  description: string;
}

/**
 * Complete tag modifier definition
 */
export interface TagModifierDefinition {
  tag: FactionTag;
  combatModifiers: CombatModifier[];
  economicModifiers: EconomicModifier[];
  assetPermissions: AssetPermission[];
  movementMaintenanceModifiers?: MovementMaintenanceModifier[];
}

// ============================================================================
// TAG MODIFIER DEFINITIONS
// ============================================================================

/**
 * Registry of all tag modifier definitions based on SWN rules
 */
export const TAG_MODIFIERS: Record<FactionTag, TagModifierDefinition> = {
  // ---------------------------------------------------------------------------
  // COLONISTS
  // ---------------------------------------------------------------------------
  'Colonists': {
    tag: 'Colonists',
    combatModifiers: [],
    economicModifiers: [],
    assetPermissions: [
      {
        homeworldAsGovernment: true,
        treatWorldsAsTechLevel: 4, // Homeworld treated as TL4
        description: 'Has Planetary Government benefits for homeworld. Homeworld treated as TL4.'
      }
    ],
    movementMaintenanceModifiers: []
  },

  // ---------------------------------------------------------------------------
  // DEEP ROOTED
  // ---------------------------------------------------------------------------
  'Deep Rooted': {
    tag: 'Deep Rooted',
    combatModifiers: [
      {
        defenseAttribute: undefined, // All defenses
        extraDice: 1,
        condition: 'onHomeworld',
        oncePerTurn: false, // Always applies on homeworld
        description: 'Roll one additional d10 when defending on homeworld.'
      }
    ],
    economicModifiers: [],
    assetPermissions: [],
    movementMaintenanceModifiers: [
      {
        homeworldDeparturePenalty: 1,
        description: 'Moving assets away from the homeworld costs +1 FacCred.'
      }
    ]
    // Note: Tag is lost if faction changes homeworld (handled in reducer)
  },

  // ---------------------------------------------------------------------------
  // EUGENICS CULT
  // ---------------------------------------------------------------------------
  'Eugenics Cult': {
    tag: 'Eugenics Cult',
    combatModifiers: [
      {
        extraDice: 1,
        assetDefinitionIds: ['force_1_gengineered_slaves'],
        oncePerTurn: true,
        description: 'Once per turn, roll an extra d10 on attack or defense by Gengineered Slaves.'
      }
    ],
    economicModifiers: [],
    assetPermissions: [
      {
        exclusiveAssets: ['force_1_gengineered_slaves'],
        description: 'Can purchase the Gengineered Slaves asset.'
      }
    ],
    movementMaintenanceModifiers: []
  },

  // ---------------------------------------------------------------------------
  // EXCHANGE CONSULATE
  // ---------------------------------------------------------------------------
  'Exchange Consulate': {
    tag: 'Exchange Consulate',
    combatModifiers: [
      {
        defenseAttribute: 'Wealth',
        extraDice: 1,
        oncePerTurn: true,
        description: 'Once per turn, roll an extra d10 when defending against a Wealth attack.'
      }
    ],
    economicModifiers: [],
    assetPermissions: []
  },

  // ---------------------------------------------------------------------------
  // FANATICAL
  // ---------------------------------------------------------------------------
  'Fanatical': {
    tag: 'Fanatical',
    combatModifiers: [
      {
        extraDice: 0,
        rerollOnes: true,
        loseTies: true,
        description: 'Always reroll dice that come up as 1. Always lose ties during attacks.'
      }
    ],
    economicModifiers: [],
    assetPermissions: []
  },

  // ---------------------------------------------------------------------------
  // IMPERIALISTS
  // ---------------------------------------------------------------------------
  'Imperialists': {
    tag: 'Imperialists',
    combatModifiers: [
      {
        attackAttribute: undefined, // Any attack
        extraDice: 1,
        condition: 'seizePlanet',
        description: 'Roll an extra d10 for attacks made as part of a Seize Planet action.'
      }
    ],
    economicModifiers: [],
    assetPermissions: []
  },

  // ---------------------------------------------------------------------------
  // MACHIAVELLIAN
  // ---------------------------------------------------------------------------
  'Machiavellian': {
    tag: 'Machiavellian',
    combatModifiers: [
      {
        attackAttribute: 'Cunning',
        extraDice: 1,
        oncePerTurn: true,
        description: 'Once per turn, roll an additional d10 when making a Cunning attack.'
      }
    ],
    economicModifiers: [],
    assetPermissions: []
  },

  // ---------------------------------------------------------------------------
  // MERCENARY GROUP
  // ---------------------------------------------------------------------------
  'Mercenary Group': {
    tag: 'Mercenary Group',
    combatModifiers: [],
    economicModifiers: [],
    assetPermissions: [
      {
        allAssetsCanMove: true,
        movementRange: 1,
        description: 'All faction assets can move to any world within one hex as an action.'
      }
    ],
    movementMaintenanceModifiers: [
      {
        movementCostModifier: -1,
        grantMovementAbility: true,
        description: 'Veteran logistics crews eliminate the standard 1 FacCred movement cost.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // PERIMETER AGENCY
  // ---------------------------------------------------------------------------
  'Perimeter Agency': {
    tag: 'Perimeter Agency',
    combatModifiers: [
      {
        extraDice: 1,
        condition: 'againstTL5',
        oncePerTurn: true,
        description: 'Once per turn, roll an additional d10 when attacking TL5 assets.'
      }
    ],
    economicModifiers: [],
    assetPermissions: [
      {
        description: 'Roll an extra die when making tests to detect Stealthed assets.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // PIRATES
  // ---------------------------------------------------------------------------
  'Pirates': {
    tag: 'Pirates',
    combatModifiers: [],
    economicModifiers: [],
    assetPermissions: [],
    movementMaintenanceModifiers: [
      {
        enemyMovementToll: 1,
        description: 'Charge +1 FacCred to enemies moving assets onto worlds with your Base of Influence.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // PLANETARY GOVERNMENT
  // ---------------------------------------------------------------------------
  'Planetary Government': {
    tag: 'Planetary Government',
    combatModifiers: [],
    economicModifiers: [],
    assetPermissions: [
      {
        description: 'Permission is required from this faction to buy or import assets marked as needing government permission.'
      }
    ]
    // Note: Can be acquired multiple times, once per planet controlled
  },

  // ---------------------------------------------------------------------------
  // PLUTOCRATIC
  // ---------------------------------------------------------------------------
  'Plutocratic': {
    tag: 'Plutocratic',
    combatModifiers: [
      {
        attackAttribute: 'Wealth',
        extraDice: 1,
        oncePerTurn: true,
        description: 'Once per turn, roll an additional d10 when making a Wealth attack.'
      }
    ],
    economicModifiers: [
      {
        incomeMultiplier: 1.25,
        description: 'Gain +25% FacCred income due to oligarch-controlled markets.'
      }
    ],
    assetPermissions: []
  },

  // ---------------------------------------------------------------------------
  // PRECEPTOR ARCHIVE
  // ---------------------------------------------------------------------------
  'Preceptor Archive': {
    tag: 'Preceptor Archive',
    combatModifiers: [],
    economicModifiers: [
      {
        purchaseDiscount: 1,
        condition: 'highTechAsset',
        description: 'Assets requiring TL4+ cost 1 fewer FacCred.'
      }
    ],
    assetPermissions: [
      {
        description: 'Can perform "Teach Planetary Population" action: 2 FacCreds, roll 1d12; on 12, world becomes TL4 for this faction.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // PSYCHIC ACADEMY
  // ---------------------------------------------------------------------------
  'Psychic Academy': {
    tag: 'Psychic Academy',
    combatModifiers: [
      {
        extraDice: 0, // Not extra dice, but forced reroll
        oncePerTurn: true,
        description: 'Once per turn, force a rival faction to reroll any one d10 (whether involved or not).'
      }
    ],
    economicModifiers: [],
    assetPermissions: [
      {
        description: 'Can provide psionic mentor training to qualified psychics.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // SAVAGE
  // ---------------------------------------------------------------------------
  'Savage': {
    tag: 'Savage',
    combatModifiers: [
      {
        defenseAttribute: undefined, // Any defense
        extraDice: 1,
        condition: 'withTL0Asset',
        oncePerTurn: true,
        description: 'Once per turn, roll an extra die when defending with a TL0 asset.'
      }
    ],
    economicModifiers: [],
    assetPermissions: []
  },

  // ---------------------------------------------------------------------------
  // SCAVENGERS
  // ---------------------------------------------------------------------------
  'Scavengers': {
    tag: 'Scavengers',
    combatModifiers: [],
    economicModifiers: [],
    assetPermissions: [],
    movementMaintenanceModifiers: [
      {
        maintenanceModifier: -1,
        description: 'Reduce per-asset maintenance costs by 1 thanks to relentless salvaging.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // SECRETIVE
  // ---------------------------------------------------------------------------
  'Secretive': {
    tag: 'Secretive',
    combatModifiers: [],
    economicModifiers: [],
    assetPermissions: [
      {
        autoStealth: true,
        description: 'All assets purchased automatically begin Stealthed.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // TECHNICAL EXPERTISE
  // ---------------------------------------------------------------------------
  'Technical Expertise': {
    tag: 'Technical Expertise',
    combatModifiers: [],
    economicModifiers: [],
    assetPermissions: [
      {
        treatWorldsAsTechLevel: 4,
        description: 'All planets with a Base of Influence are treated as TL4. Can build Starship-type assets on any world with 10k+ occupants.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // THEOCRATIC
  // ---------------------------------------------------------------------------
  'Theocratic': {
    tag: 'Theocratic',
    combatModifiers: [
      {
        defenseAttribute: 'Cunning',
        extraDice: 1,
        oncePerTurn: true,
        description: 'Once per turn, roll an extra d10 when defending against a Cunning attack.'
      }
    ],
    economicModifiers: [],
    assetPermissions: []
  },

  // ---------------------------------------------------------------------------
  // WARLIKE
  // ---------------------------------------------------------------------------
  'Warlike': {
    tag: 'Warlike',
    combatModifiers: [
      {
        attackAttribute: 'Force',
        extraDice: 1,
        oncePerTurn: true,
        description: 'Once per turn, roll an additional d10 when making a Force attack.'
      }
    ],
    economicModifiers: [],
    assetPermissions: []
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all combat modifiers for a faction based on its tags
 */
export function getFactionCombatModifiers(faction: Faction): CombatModifier[] {
  const modifiers: CombatModifier[] = [];
  
  for (const tag of faction.tags) {
    const tagDef = TAG_MODIFIERS[tag];
    if (tagDef) {
      modifiers.push(...tagDef.combatModifiers);
    }
  }
  
  return modifiers;
}

/**
 * Get all economic modifiers for a faction based on its tags
 */
export function getFactionEconomicModifiers(faction: Faction): EconomicModifier[] {
  const modifiers: EconomicModifier[] = [];
  
  for (const tag of faction.tags) {
    const tagDef = TAG_MODIFIERS[tag];
    if (tagDef) {
      modifiers.push(...tagDef.economicModifiers);
    }
  }
  
  return modifiers;
}

/**
 * Get all asset permissions for a faction based on its tags
 */
export function getFactionAssetPermissions(faction: Faction): AssetPermission[] {
  const permissions: AssetPermission[] = [];
  
  for (const tag of faction.tags) {
    const tagDef = TAG_MODIFIERS[tag];
    if (tagDef) {
      permissions.push(...tagDef.assetPermissions);
    }
  }
  
  return permissions;
}

/**
 * Check if a faction has a specific tag
 */
export function factionHasTag(faction: Faction, tag: FactionTag): boolean {
  return faction.tags.includes(tag);
}

/**
 * Get the number of extra combat dice a faction gets for a specific attack type
 */
export function getCombatExtraDice(
  faction: Faction,
  attackAttribute: AssetCategory | null,
  isDefense: boolean,
  context: {
    isOnHomeworld?: boolean;
    isSeizePlanet?: boolean;
    targetTechLevel?: number;
    assetTechLevel?: number;
    assetDefinitionId?: string;
  }
): number {
  let extraDice = 0;
  const modifiers = getFactionCombatModifiers(faction);
  
  for (const mod of modifiers) {
    // Check attribute match
    const attrMatches = isDefense
      ? (!mod.defenseAttribute || mod.defenseAttribute === attackAttribute || !attackAttribute)
      : (!mod.attackAttribute || mod.attackAttribute === attackAttribute || !attackAttribute);
    
    if (!attrMatches) continue;
    
    // Check asset constraints
    const assetMatches =
      !mod.assetDefinitionIds ||
      (context.assetDefinitionId ? mod.assetDefinitionIds.includes(context.assetDefinitionId) : false);

    if (!assetMatches) continue;

    // Check conditions
    if (mod.condition) {
      switch (mod.condition) {
        case 'onHomeworld':
          if (!context.isOnHomeworld) continue;
          break;
        case 'seizePlanet':
          if (!context.isSeizePlanet) continue;
          break;
        case 'againstTL5':
          if (context.targetTechLevel !== 5) continue;
          break;
        case 'withTL0Asset':
          if (context.assetTechLevel !== 0) continue;
          break;
      }
    }
    
    extraDice += mod.extraDice;
  }
  
  return extraDice;
}

/**
 * Check if faction should reroll ones in combat
 */
export function shouldRerollOnes(faction: Faction): boolean {
  return factionHasTag(faction, 'Fanatical');
}

/**
 * Check if faction always loses ties in combat
 */
export function alwaysLosesTies(faction: Faction): boolean {
  return factionHasTag(faction, 'Fanatical');
}

/**
 * Check if faction's assets automatically start stealthed
 */
export function assetsAutoStealth(faction: Faction): boolean {
  return factionHasTag(faction, 'Secretive');
}

/**
 * Get the effective tech level of a world for a faction
 * (accounts for Technical Expertise and Colonists tags)
 */
export function getEffectiveTechLevel(
  faction: Faction,
  worldTechLevel: number,
  options: {
    isHomeworld?: boolean;
    hasBaseOfInfluence?: boolean;
  } = {}
): number {
  let effectiveTL = worldTechLevel;
  
  // Technical Expertise: All BoI worlds treated as TL4
  if (
    factionHasTag(faction, 'Technical Expertise') &&
    options.hasBaseOfInfluence &&
    effectiveTL < 4
  ) {
    effectiveTL = 4;
  }
  
  // Colonists: Homeworld treated as TL4
  if (factionHasTag(faction, 'Colonists') && options.isHomeworld && effectiveTL < 4) {
    effectiveTL = 4;
  }
  
  return effectiveTL;
}

/**
 * Check if faction can purchase a specific exclusive asset
 */
export function canPurchaseExclusiveAsset(faction: Faction, assetId: string): boolean {
  // Gengineered Slaves requires Eugenics Cult tag
  if (assetId === 'force_1_gengineered_slaves') {
    return factionHasTag(faction, 'Eugenics Cult');
  }

  if (assetId === 'force_5_psychic_assassins') {
    return factionHasTag(faction, 'Psychic Academy');
  }
  
  return true;
}

/**
 * Apply passive income modifiers provided by faction tags
 */
export function applyIncomeModifiers(faction: Faction, baseIncome: number): number {
  const modifiers = getFactionEconomicModifiers(faction);
  let income = baseIncome;

  modifiers.forEach((modifier) => {
    // Skip modifiers that require contextual triggers
    if (modifier.condition) {
      return;
    }

    if (modifier.incomeMultiplier) {
      income *= modifier.incomeMultiplier;
    }

    if (modifier.incomeBonus) {
      income += modifier.incomeBonus;
    }
  });

  // Income should be an integer
  return Math.max(0, Math.floor(income));
}

/**
 * Get purchase discount for an asset based on tags
 */
export function getPurchaseDiscount(faction: Faction, assetTechLevel: number): number {
  let discount = 0;
  
  // Preceptor Archive: TL4+ assets cost 1 less
  if (factionHasTag(faction, 'Preceptor Archive') && assetTechLevel >= 4) {
    discount += 1;
  }
  
  return discount;
}

/**
 * Check if all faction assets can move (Mercenary Group tag)
 */
export function allAssetsCanMove(faction: Faction): boolean {
  return getMovementModifierSummary(faction).grantMovementAbility;
}

/**
 * Get movement range for all assets (if applicable)
 */
export function getAllAssetsMovementRange(faction: Faction): number {
  return Math.max(0, getMovementModifierSummary(faction).movementRangeBonus);
}

/**
 * Check if faction has Planetary Government benefits on homeworld
 */
export function hasHomeworldGovernmentBenefits(faction: Faction): boolean {
  return factionHasTag(faction, 'Colonists') || factionHasTag(faction, 'Planetary Government');
}

/**
 * Get the tag definition for a specific tag
 */
export function getTagModifiers(tag: FactionTag): TagModifierDefinition | undefined {
  return TAG_MODIFIERS[tag];
}

function getMovementMaintenanceModifiersForFaction(faction: Faction): MovementMaintenanceModifier[] {
  const modifiers: MovementMaintenanceModifier[] = [];
  faction.tags.forEach((tag) => {
    const tagDefinition = TAG_MODIFIERS[tag];
    if (tagDefinition?.movementMaintenanceModifiers?.length) {
      modifiers.push(...tagDefinition.movementMaintenanceModifiers);
    }
  });
  return modifiers;
}

export interface MovementModifierSummary {
  movementCostModifier: number;
  movementRangeBonus: number;
  homeworldDeparturePenalty: number;
  grantMovementAbility: boolean;
}

export function getMovementModifierSummary(faction: Faction): MovementModifierSummary {
  const summary: MovementModifierSummary = {
    movementCostModifier: 0,
    movementRangeBonus: 0,
    homeworldDeparturePenalty: 0,
    grantMovementAbility: factionHasTag(faction, 'Mercenary Group'),
  };

  const modifiers = getMovementMaintenanceModifiersForFaction(faction);
  modifiers.forEach((modifier) => {
    summary.movementCostModifier += modifier.movementCostModifier ?? 0;
    summary.movementRangeBonus += modifier.movementRangeBonus ?? 0;
    summary.homeworldDeparturePenalty += modifier.homeworldDeparturePenalty ?? 0;
    if (modifier.grantMovementAbility) {
      summary.grantMovementAbility = true;
    }
  });

  return summary;
}

export function getFactionMaintenanceModifier(faction: Faction): number {
  return getMovementMaintenanceModifiersForFaction(faction).reduce(
    (total, modifier) => total + (modifier.maintenanceModifier ?? 0),
    0
  );
}

export interface MovementTollCharge {
  factionId: string;
  amount: number;
}

export function getMovementTollCharges(
  factions: Faction[],
  movingFactionId: string,
  destinationSystemId: string
): MovementTollCharge[] {
  const charges: MovementTollCharge[] = [];

  factions.forEach((faction) => {
    if (faction.id === movingFactionId) return;
    if (!hasBaseOfInfluence(faction, destinationSystemId)) return;

    const tollAmount = getMovementMaintenanceModifiersForFaction(faction).reduce(
      (total, modifier) => total + (modifier.enemyMovementToll ?? 0),
      0
    );

    if (tollAmount > 0) {
      charges.push({ factionId: faction.id, amount: tollAmount });
    }
  });

  return charges;
}

