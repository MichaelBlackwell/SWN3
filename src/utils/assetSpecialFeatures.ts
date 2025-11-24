// Special features registry for Stars Without Number faction assets
// Based on the official SWN faction rules from FACTIONS.txt
// Special features are passive effects, purchase-time modifiers, or ongoing mechanics
// that differ from standard asset behavior (indicated by the 'S' flag)

import type { AssetDefinition } from '../types/asset';

/**
 * Types of special features that assets can have
 */
export type SpecialFeatureType =
  | 'cost_modifier' // Modifies purchase or maintenance cost
  | 'passive_bonus' // Provides ongoing passive benefits
  | 'restriction' // Imposes limitations or requirements
  | 'purchase_effect' // Special effect when purchased
  | 'defensive_ability' // Special defensive mechanics
  | 'attack_modifier' // Modifies attack behavior
  | 'counterattack_modifier' // Modifies counterattack behavior
  | 'stealth_related' // Special stealth mechanics
  | 'tech_level_modifier' // Modifies tech level requirements
  | 'maintenance_modifier' // Special maintenance rules
  | 'unique_mechanic'; // Unique gameplay mechanics

/**
 * Interface for special feature definitions
 */
export interface SpecialFeature {
  type: SpecialFeatureType;
  description: string; // Human-readable description of the feature
  parameters?: Record<string, unknown>; // Optional parameters (costs, bonuses, etc.)
  appliesAt?: 'purchase' | 'maintenance' | 'combat' | 'ongoing' | 'defense' | 'attack';
}

/**
 * Registry mapping asset IDs to their special feature definitions
 * Based on SWN faction rules from FACTIONS.txt
 */
export const specialFeaturesRegistry: Record<string, SpecialFeature[]> = {
  // FORCE ASSETS
  'force_3_zealots': [
    {
      type: 'attack_modifier',
      description: 'Zealots take 1d4 damage every time they launch a successful attack or perform a counterattack. Their fanatical dedication makes them willing to launch suicide attacks or hold positions to the death.',
      appliesAt: 'combat',
    },
  ],

  'force_5_blockade_fleet': [
    {
      type: 'attack_modifier',
      description: 'When Blockade Fleet successfully attacks an enemy faction asset, they steal 1d4 FacCreds from the target faction as well. This theft can occur to a faction only once per turn, no matter how many blockade fleets attack.',
      appliesAt: 'combat',
      parameters: { stealCredits: '1d4', oncePerTurn: true },
    },
  ],

  'force_5_psychic_assassins': [
    {
      type: 'purchase_effect',
      description: 'Psychic Assassins automatically start Stealthed when purchased. They are combat-trained psychics equipped with advanced pretech stealth gear and psitech weaponry.',
      appliesAt: 'purchase',
      parameters: { autoStealth: true },
    },
  ],

  'force_6_planetary_defenses': [
    {
      type: 'defensive_ability',
      description: 'Planetary Defenses can only defend against attacks by Starship-type assets. They are massive mag cannons and gravitic braker gun arrays designed to defend against starship bombardments and repel unauthorized landings.',
      appliesAt: 'defense',
      parameters: { onlyDefendsAgainst: 'Starship' },
    },
  ],

  'force_7_integral_protocols': [
    {
      type: 'defensive_ability',
      description: 'Integral Protocols can defend only against attacks versus Cunning, but they add an additional die to the defender\'s roll. This complex web of braked-AI supported sensors and redundant security checks is used to defeat attempts to infiltrate an area.',
      appliesAt: 'defense',
      parameters: { onlyDefendsAgainst: 'Cunning', bonusDie: 1 },
    },
  ],

  'force_8_capital_fleet': [
    {
      type: 'maintenance_modifier',
      description: 'Capital Fleets are expensive to keep flying and cost an additional 2 FacCreds of maintenance each turn. These are the pride of an empire, massive capital warships without peer in most sectors.',
      appliesAt: 'maintenance',
      parameters: { additionalMaintenance: 2 },
    },
  ],

  // CUNNING ASSETS
  'cunning_1_informers': [
    {
      type: 'attack_modifier',
      description: 'Informers can choose to Attack a faction without specifying a target asset. On a successful Cunning vs. Cunning attack, all Stealthed assets on the planet belonging to that faction are revealed. They can target a faction even if none of their assets are visible on a world.',
      appliesAt: 'attack',
      parameters: { revealsStealth: true, noTargetRequired: true },
    },
  ],

  'cunning_1_false_front': [
    {
      type: 'defensive_ability',
      description: 'False Front allows a faction to preserve more valuable resources. If another asset on the planet suffers enough damage to destroy it, the faction can sacrifice the False Front instead to nullify the killing blow.',
      appliesAt: 'defense',
      parameters: { canSacrifice: true },
    },
  ],

  'cunning_2_lobbyists': [
    {
      type: 'restriction',
      description: 'Lobbyists can be used to block the governmental permission that is sometimes required to buy an asset or transport it into a system. When a rival faction gains permission to do so, the Lobbyists can make an immediate Cunning vs. Cunning test against the faction; if successful, the permission is withdrawn and cannot be re-attempted until next turn.',
      appliesAt: 'ongoing',
      parameters: { blocksPermission: true },
    },
  ],

  'cunning_2_saboteurs': [
    {
      type: 'attack_modifier',
      description: 'An asset attacked by Saboteurs cannot apply any Use Asset Ability action until the start of the attacking faction\'s next turn. This applies whether or not the attack was successful.',
      appliesAt: 'attack',
      parameters: { disablesAbilities: true },
    },
  ],

  'cunning_2_blackmail': [
    {
      type: 'attack_modifier',
      description: 'Blackmail selectively degrades the effectiveness of an asset. Any attempt to attack or defend against Blackmail loses any bonus dice earned by tags.',
      appliesAt: 'combat',
      parameters: { removesTagBonuses: true },
    },
  ],

  'cunning_2_seductress': [
    {
      type: 'attack_modifier',
      description: 'As an attack, a Seductress does no damage, but an asset that has been successfully attacked immediately reveals any other Stealthed assets of that faction on the planet. Only Special Forces units can attack a Seductress.',
      appliesAt: 'attack',
      parameters: { revealsStealth: true, noDamage: true, onlyAttackedBy: 'Special Forces' },
    },
  ],

  'cunning_3_covert_shipping': [
    {
      type: 'stealth_related',
      description: 'Covert Shipping provides quiet interstellar asset transport. Any one Special Forces unit can be moved between any worlds within three hexes of the Covert Shipping at the cost of one FacCred.',
      appliesAt: 'ongoing',
    },
  ],

  'cunning_4_party_machine': [
    {
      type: 'passive_bonus',
      description: 'Each turn, a Party Machine provides 1 FacCred to its owning faction. Political blocks control particular cities or regions, blocks that are firmly in control of the faction.',
      appliesAt: 'ongoing',
      parameters: { incomePerTurn: 1 },
    },
  ],

  'cunning_4_tripwire_cells': [
    {
      type: 'defensive_ability',
      description: 'Tripwire Cells are alert to the arrival of stealthed units. Whenever a stealthed asset lands or is purchased on a planet with Tripwire Cells, the Cells make an immediate Cunning vs. Cunning attack against the owning faction. If successful, the asset loses its stealth.',
      appliesAt: 'defense',
      parameters: { detectsStealth: true },
    },
  ],

  'cunning_5_cracked_comms': [
    {
      type: 'counterattack_modifier',
      description: 'If the Cracked Comms succeeds in defending against an attack, it can immediately cause the attacking asset to make an attack against itself for normal damage or counterattack results. This cryptographic asset intercepts and deciphers enemy communications, allowing friendly fire to be induced with the right interference.',
      appliesAt: 'defense',
      parameters: { causesSelfAttack: true },
    },
  ],

  'cunning_5_boltholes': [
    {
      type: 'defensive_ability',
      description: 'Boltholes are equipped with postech innovations to make cleaning them out costly and dangerous. If a faction Special Forces or Military Unit asset on the same planet as the Boltholes suffers damage sufficient to destroy it, it is instead set at 0 HP and rendered untouchable and unusable until it is repaired to full strength. If the Boltholes are destroyed before this happens, the asset is destroyed with them.',
      appliesAt: 'defense',
      parameters: { preventsDestruction: true, requiresRepair: true },
    },
  ],

  'cunning_6_transport_lockdown': [
    {
      type: 'attack_modifier',
      description: 'On a successful Cunning vs. Cunning attack against a rival faction, the rival faction cannot transport assets onto that planet without spending 1d4 FacCreds and waiting one turn. These techniques involve selective pressure on local routing and shipping companies.',
      appliesAt: 'attack',
      parameters: { blocksTransport: true, cost: '1d4', delay: 1 },
    },
  ],

  'cunning_7_popular_movement': [
    {
      type: 'restriction',
      description: 'A planet-wide surge of enthusiasm for a cause controlled by the faction. This support pervades all levels of government, and the government always grants any asset purchase or movement requests made by the faction.',
      appliesAt: 'ongoing',
      parameters: { autoPermission: true },
    },
  ],

  'cunning_7_book_of_secrets': [
    {
      type: 'passive_bonus',
      description: 'Once per turn, a Book of Secrets allows the faction to reroll one die for an action taken on that world or force an enemy faction to reroll one die. This reroll can only be forced once per turn, no matter how many Books of Secrets are owned. Exhaustively cataloged psychometric records on important and influential local figures allow uncanny accuracy in predicting their actions.',
      appliesAt: 'ongoing',
      parameters: { rerollOncePerTurn: true },
    },
  ],

  'cunning_7_treachery': [
    {
      type: 'attack_modifier',
      description: 'On a successful attack, the Treachery asset is lost, 5 FacCreds are gained, and the targeted asset switches sides to join the traitor\'s faction, even if the faction does not otherwise have the attributes necessary. Traitors can attack an enemy asset.',
      appliesAt: 'attack',
      parameters: { assetLost: true, creditsGained: 5, assetSwitchesSides: true },
    },
  ],

  'cunning_8_panopticon_matrix': [
    {
      type: 'defensive_ability',
      description: 'Every rival Stealthed asset on the planet must succeed in a Cunning vs. Cunning test at the beginning of every turn or lose their Stealth. The owner also gains an additional die on all Cunning attacks and defenses on that planet. These facilities weave braked-AI intelligence analysts into a web of observation capable of detecting the slightest evidence of intruders on a world.',
      appliesAt: 'ongoing',
      parameters: { detectsStealth: true, bonusDieOnCunning: true },
    },
  ],

  // WEALTH ASSETS
  'wealth_1_franchise': [
    {
      type: 'attack_modifier',
      description: 'When a Franchise successfully attacks an enemy asset, the enemy faction loses one FacCred (if available), which is gained by the Franchise\'s owner. This loss can happen only once a turn, no matter how many Franchises attack. This asset reflects a deniable connection with a local licensee for the faction\'s goods and services.',
      appliesAt: 'attack',
      parameters: { stealsCredits: 1, oncePerTurn: true },
    },
  ],

  'wealth_1_local_investments': [
    {
      type: 'restriction',
      description: 'Any other faction that tries to buy an asset on that planet must pay one extra FacCred. This money is not given to the investments\' owner, but is lost. This penalty is only applied once. These give the faction substantial influence over the commerce on a world.',
      appliesAt: 'ongoing',
      parameters: { extraCostForOthers: 1, oncePerTurn: true },
    },
  ],

  'wealth_2_lawyers': [
    {
      type: 'restriction',
      description: 'Lawyers cannot attack or counterattack Force assets. They have the ability to tie an enemy up in the coils of their own internal rules, damaging assets with confusion and red tape.',
      appliesAt: 'combat',
      parameters: { cannotAttack: 'Force' },
    },
  ],

  'wealth_2_surveyors': [
    {
      type: 'passive_bonus',
      description: 'The presence of a Surveyor crew allows one additional die to be rolled on Expand Influence actions. Surveyors explore potential resource and investment options on worlds.',
      appliesAt: 'ongoing',
      parameters: { expandInfluenceBonus: 1 },
    },
  ],

  'wealth_3_laboratory': [
    {
      type: 'tech_level_modifier',
      description: 'The lab allows a world to make hesitant progress in tech. The presence of a Laboratory allows assets to be purchased on that world as if it had Tech Level 4.',
      appliesAt: 'ongoing',
      parameters: { effectiveTechLevel: 4 },
    },
  ],

  'wealth_3_mercenaries': [
    {
      type: 'maintenance_modifier',
      description: 'Mercenaries have a maintenance cost of 1 FacCred per turn. Groups of well-equipped, highly-trained soldiers willing to serve the highest bidder.',
      appliesAt: 'maintenance',
      parameters: { maintenanceCost: 1 },
    },
  ],

  'wealth_4_monopoly': [
    {
      type: 'restriction',
      description: 'An open or tacit stranglehold on certain vital businesses or resources on a world. As an action, owners of a monopoly may force one other faction with unstealthed assets on that world to pay them one FacCred. If the target faction can\'t pay, they lose one asset of their choice on the world.',
      appliesAt: 'ongoing',
    },
  ],

  'wealth_4_medical_center': [
    {
      type: 'defensive_ability',
      description: 'Once between turns, if a Special Forces or Military Unit asset on the world is destroyed, the faction may immediately pay half its purchase cost to restore it with one hit point. Any Repair Asset action taken on that world costs one less FacCred for Special Forces and Military Units.',
      appliesAt: 'ongoing',
      parameters: { canRestoreDestroyed: true, repairDiscount: 1 },
    },
  ],

  'wealth_4_bank': [
    {
      type: 'passive_bonus',
      description: 'Once per turn, the faction can ignore one cost or FacCred loss imposed by another faction. This does not require an action. Multiple bank assets allow multiple losses to be ignored.',
      appliesAt: 'ongoing',
      parameters: { ignoreLossOncePerTurn: true, stacks: true },
    },
  ],

  'wealth_5_pretech_researchers': [
    {
      type: 'tech_level_modifier',
      description: 'Any world with Pretech Researchers on it is treated as tech level 5 for the purpose of buying Cunning and Wealth assets. A highly versatile team of research and design specialists capable of supporting limited pretech, as long as they\'re adequately funded.',
      appliesAt: 'ongoing',
      parameters: { effectiveTechLevel: 5, categories: ['Cunning', 'Wealth'] },
    },
    {
      type: 'maintenance_modifier',
      description: 'Pretech Researchers have a maintenance cost of 1 FacCred per turn.',
      appliesAt: 'maintenance',
      parameters: { maintenanceCost: 1 },
    },
  ],

  'wealth_6_rd_department': [
    {
      type: 'tech_level_modifier',
      description: 'A faction with an R&D Department may treat all planets as having tech level 4 for purposes of buying Wealth assets. These allow the smooth extension of wealth-creation and industrial principles to the farthest reaches of the faction\'s operations.',
      appliesAt: 'ongoing',
      parameters: { effectiveTechLevel: 4, categories: ['Wealth'], allPlanets: true },
    },
  ],

  'wealth_7_pretech_manufactory': [
    {
      type: 'unique_mechanic',
      description: 'Rare, precious examples of functioning pretech industrial facilities, retrofitted to work without the benefit of specialized psychic disciplines. As an action, the owning faction can roll 1d8 for a Pretech Manufactory, and gain half that many FacCreds (rounded up).',
      appliesAt: 'ongoing',
    },
  ],

  'wealth_7_hostile_takeover': [
    {
      type: 'attack_modifier',
      description: 'If a Hostile Takeover does enough damage to destroy an asset, the target is instead reduced to 1 hit point and acquired by the Hostile Takeover\'s owning faction. This asset can seize control of damaged and poorly-controlled assets.',
      appliesAt: 'attack',
      parameters: { capturesAsset: true, setsHpTo: 1 },
    },
  ],

  'wealth_7_transit_web': [
    {
      type: 'unique_mechanic',
      description: 'For 1 FacCred, any number of non-starship Cunning or Wealth assets may be moved between any two worlds within three hexes of the Transit Web. This may be done freely on the owner\'s turn so long as the fee can be paid, and using the ability doesn\'t require an action.',
      appliesAt: 'ongoing',
      parameters: { freeAction: true },
    },
  ],

  'wealth_8_scavenger_fleet': [
    {
      type: 'maintenance_modifier',
      description: 'Scavenger Fleets cost 2 FacCreds a turn in maintenance. These rag-tag armadas bring enormous technical and mercantile resources to their patrons, along with a facility with heavy guns.',
      appliesAt: 'maintenance',
      parameters: { maintenanceCost: 2 },
    },
  ],

  // BASE OF INFLUENCE (special asset)
  'base_of_influence': [
    {
      type: 'unique_mechanic',
      description: 'A Base of Influence represents a faction\'s foothold on a world. Required to purchase assets on that world. Any damage done to a Base of Influence is also done directly to a faction\'s hit points. If a Base of Influence is brought below zero hit points, the overflow damage is not counted against the owning faction\'s hit points. Bases of Influence do not count against a faction\'s maximum assets.',
      appliesAt: 'ongoing',
      parameters: { damageToFaction: true, noOverflow: true, notCountedInMax: true },
    },
  ],
};

/**
 * Get special features for a specific asset
 * @param assetId - The asset definition ID
 * @returns Array of special features, or empty array if none
 */
export function getAssetSpecialFeatures(assetId: string): SpecialFeature[] {
  return specialFeaturesRegistry[assetId] || [];
}

/**
 * Check if an asset has special features
 * @param assetId - The asset definition ID
 * @returns True if the asset has special features
 */
export function assetHasSpecialFeatures(assetId: string): boolean {
  return assetId in specialFeaturesRegistry && specialFeaturesRegistry[assetId].length > 0;
}

/**
 * Get a formatted description of all special features for an asset
 * @param assetId - The asset definition ID
 * @returns Formatted description string, or empty string if none
 */
export function getSpecialFeatureDescription(assetId: string): string {
  const features = getAssetSpecialFeatures(assetId);
  if (features.length === 0) {
    return '';
  }

  if (features.length === 1) {
    return features[0].description;
  }

  // Multiple features - combine them
  return features.map((feature, index) => `${index + 1}. ${feature.description}`).join('\n\n');
}

/**
 * Get a short summary description for tooltips or compact displays
 * @param assetId - The asset definition ID
 * @param maxLength - Maximum length of the summary (default: 100)
 * @returns Short summary string, or empty string if none
 */
export function getSpecialFeatureSummary(assetId: string, maxLength: number = 100): string {
  const features = getAssetSpecialFeatures(assetId);
  if (features.length === 0) {
    return '';
  }

  // Get the first feature's description
  let summary = features[0].description;
  
  // If multiple features, indicate that
  if (features.length > 1) {
    summary = `Multiple special features: ${summary}`;
  }

  // Truncate if too long
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength - 3) + '...';
  }

  return summary;
}

/**
 * Get special features grouped by when they apply
 * @param assetId - The asset definition ID
 * @returns Object with features grouped by appliesAt timing
 */
export function getSpecialFeaturesByTiming(assetId: string): Record<string, SpecialFeature[]> {
  const features = getAssetSpecialFeatures(assetId);
  const grouped: Record<string, SpecialFeature[]> = {
    purchase: [],
    maintenance: [],
    combat: [],
    ongoing: [],
    defense: [],
    attack: [],
    unspecified: [],
  };

  for (const feature of features) {
    const timing = feature.appliesAt || 'unspecified';
    if (timing in grouped) {
      grouped[timing].push(feature);
    } else {
      grouped.unspecified.push(feature);
    }
  }

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(grouped).filter(([_, features]) => features.length > 0)
  );
}

/**
 * Get special features formatted for HTML/JSX display
 * Returns an array of formatted feature objects suitable for rendering
 * @param assetId - The asset definition ID
 * @returns Array of formatted feature objects with type, description, and display info
 */
export function getSpecialFeaturesForDisplay(assetId: string): Array<{
  type: SpecialFeatureType;
  typeLabel: string;
  description: string;
  appliesAt?: string;
  appliesAtLabel?: string;
  parameters?: Record<string, unknown>;
}> {
  const features = getAssetSpecialFeatures(assetId);
  
  const typeLabels: Record<SpecialFeatureType, string> = {
    cost_modifier: 'Cost Modifier',
    passive_bonus: 'Passive Bonus',
    restriction: 'Restriction',
    purchase_effect: 'Purchase Effect',
    defensive_ability: 'Defensive Ability',
    attack_modifier: 'Attack Modifier',
    counterattack_modifier: 'Counterattack Modifier',
    stealth_related: 'Stealth Related',
    tech_level_modifier: 'Tech Level Modifier',
    maintenance_modifier: 'Maintenance Modifier',
    unique_mechanic: 'Unique Mechanic',
  };

  const timingLabels: Record<string, string> = {
    purchase: 'On Purchase',
    maintenance: 'During Maintenance',
    combat: 'In Combat',
    ongoing: 'Ongoing Effect',
    defense: 'When Defending',
    attack: 'When Attacking',
  };

  return features.map((feature) => ({
    type: feature.type,
    typeLabel: typeLabels[feature.type] || feature.type,
    description: feature.description,
    appliesAt: feature.appliesAt,
    appliesAtLabel: feature.appliesAt ? timingLabels[feature.appliesAt] : undefined,
    parameters: feature.parameters,
  }));
}

/**
 * Extract key gameplay information from special features
 * Useful for quick reference or tooltips
 * @param assetId - The asset definition ID
 * @returns Object with extracted key information
 */
export function getSpecialFeatureKeyInfo(assetId: string): {
  hasCostModifier: boolean;
  hasPassiveBonus: boolean;
  hasRestriction: boolean;
  hasPurchaseEffect: boolean;
  maintenanceModifier?: number;
  techLevelModifier?: number;
  summary: string;
} {
  const features = getAssetSpecialFeatures(assetId);
  
  const result = {
    hasCostModifier: false,
    hasPassiveBonus: false,
    hasRestriction: false,
    hasPurchaseEffect: false,
    maintenanceModifier: undefined as number | undefined,
    techLevelModifier: undefined as number | undefined,
    summary: '',
  };

  for (const feature of features) {
    switch (feature.type) {
      case 'cost_modifier':
        result.hasCostModifier = true;
        break;
      case 'passive_bonus':
        result.hasPassiveBonus = true;
        break;
      case 'restriction':
        result.hasRestriction = true;
        break;
      case 'purchase_effect':
        result.hasPurchaseEffect = true;
        break;
      case 'maintenance_modifier':
        if (feature.parameters?.maintenanceCost) {
          result.maintenanceModifier = feature.parameters.maintenanceCost as number;
        }
        break;
      case 'tech_level_modifier':
        if (feature.parameters?.effectiveTechLevel) {
          result.techLevelModifier = feature.parameters.effectiveTechLevel as number;
        }
        break;
    }
  }

  // Generate a short summary
  const summaries: string[] = [];
  if (result.hasCostModifier) summaries.push('Cost modifier');
  if (result.hasPassiveBonus) summaries.push('Passive bonus');
  if (result.hasRestriction) summaries.push('Restrictions apply');
  if (result.hasPurchaseEffect) summaries.push('Purchase effect');
  if (result.maintenanceModifier) summaries.push(`+${result.maintenanceModifier} maintenance`);
  if (result.techLevelModifier) summaries.push(`TL${result.techLevelModifier} modifier`);

  result.summary = summaries.length > 0 ? summaries.join(', ') : 'Special features';

  return result;
}

/**
 * Format special features as a structured list for display
 * Returns an array of formatted strings, one per feature
 * @param assetId - The asset definition ID
 * @param includeType - Whether to include the feature type in the output
 * @returns Array of formatted feature strings
 */
export function formatSpecialFeaturesAsList(
  assetId: string,
  includeType: boolean = false,
): string[] {
  const features = getAssetSpecialFeatures(assetId);
  
  return features.map((feature, index) => {
    let formatted = '';
    
    if (includeType) {
      const typeLabels: Record<SpecialFeatureType, string> = {
        cost_modifier: '[Cost]',
        passive_bonus: '[Bonus]',
        restriction: '[Restriction]',
        purchase_effect: '[Purchase]',
        defensive_ability: '[Defense]',
        attack_modifier: '[Attack]',
        counterattack_modifier: '[Counterattack]',
        stealth_related: '[Stealth]',
        tech_level_modifier: '[Tech Level]',
        maintenance_modifier: '[Maintenance]',
        unique_mechanic: '[Unique]',
      };
      formatted += `${typeLabels[feature.type] || '[Feature]'} `;
    }
    
    formatted += feature.description;
    
    return formatted;
  });
}

/**
 * Get a human-readable label for a special feature type
 * @param featureType - The feature type
 * @returns Human-readable label
 */
export function getFeatureTypeLabel(featureType: SpecialFeatureType): string {
  const labels: Record<SpecialFeatureType, string> = {
    cost_modifier: 'Cost Modifier',
    passive_bonus: 'Passive Bonus',
    restriction: 'Restriction',
    purchase_effect: 'Purchase Effect',
    defensive_ability: 'Defensive Ability',
    attack_modifier: 'Attack Modifier',
    counterattack_modifier: 'Counterattack Modifier',
    stealth_related: 'Stealth Related',
    tech_level_modifier: 'Tech Level Modifier',
    maintenance_modifier: 'Maintenance Modifier',
    unique_mechanic: 'Unique Mechanic',
  };
  
  return labels[featureType] || featureType;
}

/**
 * Get a human-readable label for when a feature applies
 * @param appliesAt - The timing value
 * @returns Human-readable label
 */
export function getFeatureTimingLabel(appliesAt?: string): string {
  if (!appliesAt) return 'Always Active';
  
  const labels: Record<string, string> = {
    purchase: 'On Purchase',
    maintenance: 'During Maintenance',
    combat: 'In Combat',
    ongoing: 'Ongoing Effect',
    defense: 'When Defending',
    attack: 'When Attacking',
  };
  
  return labels[appliesAt] || appliesAt;
}

/**
 * Get special features by type
 * @param assetId - The asset definition ID
 * @param featureType - The type of feature to filter by
 * @returns Array of matching special features
 */
export function getSpecialFeaturesByType(
  assetId: string,
  featureType: SpecialFeatureType,
): SpecialFeature[] {
  return getAssetSpecialFeatures(assetId).filter((feature) => feature.type === featureType);
}

/**
 * Get all asset IDs that have special features
 * @returns Array of asset IDs with special features
 */
export function getAllAssetsWithSpecialFeatures(): string[] {
  return Object.keys(specialFeaturesRegistry);
}

/**
 * Validate that all assets with hasSpecial flag have entries in the registry
 * This is a utility function for development/testing
 * @param assets - Array of all asset definitions
 * @returns Array of asset IDs that have hasSpecial flag but no registry entry
 */
export function validateSpecialFeaturesRegistry(
  assets: AssetDefinition[],
): string[] {
  const missing: string[] = [];
  
  for (const asset of assets) {
    if (asset.specialFlags.hasSpecial && !assetHasSpecialFeatures(asset.id)) {
      missing.push(asset.id);
    }
  }
  
  return missing;
}

