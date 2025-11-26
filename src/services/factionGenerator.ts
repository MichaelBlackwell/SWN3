import { faker } from '@faker-js/faker';
import type { Faction, FactionType, FactionTag, FactionAsset, FactionAttributes } from '../types/faction';
import type { StarSystem } from '../types/sector';
import { getAssetById } from '../data/assetLibrary';

// Define the faction templates
interface FactionTemplate {
  name: string;
  description: string;
  type: FactionType;
  attributes: FactionAttributes;
  assets: { id: string; count?: number }[];
  tags: FactionTag[];
  // Conditions for this template to be suitable
  suitability?: (system: StarSystem) => boolean;
}

type AttributeFocus = 'force' | 'cunning' | 'wealth';

const ATTRIBUTE_PRESETS: Record<AttributeFocus, Pick<FactionAttributes, 'force' | 'cunning' | 'wealth'>> = {
  force: { force: 2, cunning: 1, wealth: 1 },
  cunning: { force: 1, cunning: 2, wealth: 1 },
  wealth: { force: 1, cunning: 1, wealth: 2 }
};

const DEFAULT_LEVEL_ONE_ASSETS: Record<AttributeFocus, string> = {
  force: 'force_1_security_personnel',
  cunning: 'cunning_1_informers',
  wealth: 'wealth_1_harvesters'
};

const TAG_FOCUS_OVERRIDES: Partial<Record<FactionTag, AttributeFocus>> = {
  Warlike: 'force',
  'Mercenary Group': 'force',
  Imperialists: 'force',
  Pirates: 'force',
  Savage: 'force',
  Fanatical: 'force',
  'Planetary Government': 'force',
  Secretive: 'cunning',
  Machiavellian: 'cunning',
  'Perimeter Agency': 'cunning',
  'Psychic Academy': 'cunning',
  Theocratic: 'cunning',
  'Preceptor Archive': 'cunning',
  Colonists: 'wealth',
  'Deep Rooted': 'wealth',
  Plutocratic: 'wealth',
  'Exchange Consulate': 'wealth',
  'Technical Expertise': 'wealth'
};

const TYPE_FOCUS_OVERRIDES: Partial<Record<FactionType, AttributeFocus>> = {
  Government: 'force',
  Corporation: 'wealth',
  Religion: 'cunning',
  'Criminal Organization': 'cunning',
  'Mercenary Group': 'force',
  'Rebel Movement': 'force',
  'Eugenics Cult': 'force',
  Colony: 'wealth',
  'Regional Hegemon': 'force',
  Other: 'cunning'
};

const LEVEL_ONE_PATTERN = /_1_/;

function pickAttributeFocus(template: FactionTemplate): AttributeFocus {
  const { force, cunning, wealth } = template.attributes;
  const highest = Math.max(force, cunning, wealth);
  const candidates: AttributeFocus[] = [];

  if (force === highest) candidates.push('force');
  if (cunning === highest) candidates.push('cunning');
  if (wealth === highest) candidates.push('wealth');

  if (candidates.length === 1) {
    return candidates[0];
  }

  for (const tag of template.tags) {
    const tagFocus = TAG_FOCUS_OVERRIDES[tag];
    if (tagFocus && candidates.includes(tagFocus)) {
      return tagFocus;
    }
  }

  const typeFocus = TYPE_FOCUS_OVERRIDES[template.type];
  if (typeFocus && candidates.includes(typeFocus)) {
    return typeFocus;
  }

  return candidates[0];
}

function selectLevelOneAsset(template: FactionTemplate, focus: AttributeFocus): string {
  const existingLevelOne = template.assets.find(asset => LEVEL_ONE_PATTERN.test(asset.id));
  if (existingLevelOne) {
    return existingLevelOne.id;
  }
  return DEFAULT_LEVEL_ONE_ASSETS[focus];
}

const FACTION_TEMPLATES: Record<string, FactionTemplate> = {
  // ============================================================================
  // TIER 1: WEAK FACTIONS (HP 15, Low Resources)
  // ============================================================================
  
  'Frontier Colony': {
    name: 'Frontier Colony',
    description: 'Thinly-populated worlds with limited infrastructure tend to have weak colonial governments concerned chiefly with issues of basic survival rather than expansion or intrigue.',
    type: 'Colony',
    attributes: { hp: 15, maxHp: 15, force: 4, cunning: 3, wealth: 1 },
    assets: [
      { id: 'force_2_guerrilla_populace' },
      { id: 'cunning_2_saboteurs' }
    ],
    tags: ['Colonists', 'Planetary Government'],
    suitability: (system) => system.primaryWorld.population <= 2 && system.primaryWorld.techLevel >= 3
  },
  
  'Tribal Confederation': {
    name: 'Tribal Confederation',
    description: 'Primitive and barbaric by the standards of the space-going worlds, these tribal societies lack technical resources but possess fierce warriors and strong cultural bonds.',
    type: 'Government',
    attributes: { hp: 15, maxHp: 15, force: 4, cunning: 1, wealth: 3 },
    assets: [
      { id: 'force_3_zealots' },
      { id: 'wealth_1_harvesters' }
    ],
    tags: ['Savage', 'Warlike'],
    suitability: (system) => system.primaryWorld.techLevel <= 2 && system.primaryWorld.population >= 2
  },
  
  'Resistance Cell': {
    name: 'Resistance Cell',
    description: 'Even in the most tyrannical corners of the galaxy, the human heart yearns for freedom. These factions spring up in the shadow of oppressive governments.',
    type: 'Rebel Movement',
    attributes: { hp: 15, maxHp: 15, force: 3, cunning: 4, wealth: 1 },
    assets: [
      { id: 'cunning_4_seditionists' },
      { id: 'force_3_zealots' }
    ],
    tags: ['Secretive', 'Fanatical'],
    suitability: (system) => system.primaryWorld.government === 'Dictatorship' || system.primaryWorld.tags.includes('Tyranny') || system.primaryWorld.tags.includes('Police State')
  },
  
  'Mining Consortium': {
    name: 'Mining Consortium',
    description: 'A rough-and-tumble organization extracting valuable resources from hostile environments. They have the credits but lack sophistication and military might.',
    type: 'Corporation',
    attributes: { hp: 15, maxHp: 15, force: 2, cunning: 3, wealth: 5 },
    assets: [
      { id: 'wealth_1_harvesters' },
      { id: 'wealth_2_surveyors' },
      { id: 'wealth_2_union_toughs' }
    ],
    tags: ['Scavengers', 'Plutocratic'],
    suitability: (system) => system.primaryWorld.tradeCodes.includes('Mining') || system.primaryWorld.tags.includes('Heavy Mining')
  },
  
  'Pirate Fleet': {
    name: 'Pirate Fleet',
    description: 'Raiders and outlaws who prey on shipping lanes and isolated colonies. They strike fast and disappear into the void.',
    type: 'Criminal Organization',
    attributes: { hp: 15, maxHp: 15, force: 4, cunning: 4, wealth: 2 },
    assets: [
      { id: 'force_1_hitmen' },
      { id: 'cunning_1_smugglers' },
      { id: 'force_2_hardened_personnel' }
    ],
    tags: ['Pirates', 'Savage'],
    suitability: (system) => system.primaryWorld.population <= 2 || system.primaryWorld.tags.includes('Anarchy')
  },
  
  'Isolated Outpost': {
    name: 'Isolated Outpost',
    description: 'A remote research station, military base, or corporate facility operating far from civilization with minimal support.',
    type: 'Colony',
    attributes: { hp: 15, maxHp: 15, force: 3, cunning: 3, wealth: 2 },
    assets: [
      { id: 'force_1_security_personnel' },
      { id: 'cunning_1_informers' },
      { id: 'wealth_1_local_investments' }
    ],
    tags: ['Colonists', 'Secretive'],
    suitability: (system) => system.primaryWorld.population === 1
  },

  'Terraforming Project': {
    name: 'Terraforming Project',
    description: 'A dedicated group attempting to tame a hostile world. They possess advanced environmental tech but are vulnerable.',
    type: 'Colony',
    attributes: { hp: 15, maxHp: 15, force: 2, cunning: 2, wealth: 4 },
    assets: [
      { id: 'wealth_1_harvesters' },
      { id: 'wealth_3_laboratory' },
      { id: 'force_1_security_personnel' }
    ],
    tags: ['Colonists', 'Technical Expertise'],
    suitability: (system) => system.primaryWorld.atmosphere !== 'Breathable'
  },

  'Raider Flotilla': {
    name: 'Raider Flotilla',
    description: 'A loose alliance of ship captains who refuse to bow to any planetary law. They live and die by their ships.',
    type: 'Criminal Organization',
    attributes: { hp: 18, maxHp: 18, force: 4, cunning: 3, wealth: 2 },
    assets: [
      { id: 'cunning_1_smugglers' },
      { id: 'force_1_hitmen' },
      { id: 'wealth_2_freighter_contract' }
    ],
    tags: ['Pirates', 'Scavengers'],
    suitability: (system) => system.primaryWorld.tags.includes('Pirates')
  },

  'Survivalist Enclave': {
    name: 'Survivalist Enclave',
    description: 'Paranoid isolationists who have prepared for the worst. They are heavily armed and trust no outsiders.',
    type: 'Rebel Movement',
    attributes: { hp: 15, maxHp: 15, force: 4, cunning: 3, wealth: 1 },
    assets: [
      { id: 'force_2_guerrilla_populace' },
      { id: 'force_3_cunning_trap' },
      { id: 'wealth_1_harvesters' }
    ],
    tags: ['Savage', 'Secretive'],
    suitability: (system) => system.primaryWorld.tags.includes('Hostile Biosphere')
  },

  'Orbital Salvage Crew': {
    name: 'Orbital Salvage Crew',
    description: 'Teams that operate in the vacuum, cutting apart derelicts and selling the scrap.',
    type: 'Corporation',
    attributes: { hp: 15, maxHp: 15, force: 2, cunning: 3, wealth: 3 },
    assets: [
      { id: 'wealth_1_harvesters' },
      { id: 'cunning_1_smugglers' },
      { id: 'force_1_security_personnel' }
    ],
    tags: ['Scavengers', 'Technical Expertise'],
    suitability: (system) => system.primaryWorld.tags.includes('Orbital Ruins')
  },

  'Smuggler Cartel': {
    name: 'Smuggler Cartel',
    description: 'A network of blockade runners and fences who move goods through restricted space.',
    type: 'Criminal Organization',
    attributes: { hp: 18, maxHp: 18, force: 2, cunning: 5, wealth: 3 },
    assets: [
      { id: 'cunning_1_smugglers' },
      { id: 'wealth_2_freighter_contract' },
      { id: 'cunning_2_blackmail' }
    ],
    tags: ['Secretive', 'Plutocratic'],
    suitability: (system) => system.primaryWorld.tags.includes('Trade Hub')
  },

  'Wandering Teachers': {
    name: 'Wandering Teachers',
    description: 'Itinerant educators from a Preceptor Archive, spreading knowledge to those who will listen.',
    type: 'Other',
    attributes: { hp: 15, maxHp: 15, force: 1, cunning: 4, wealth: 3 },
    assets: [
      { id: 'wealth_3_laboratory' },
      { id: 'cunning_2_lobbyists' },
      { id: 'wealth_1_local_investments' }
    ],
    tags: ['Preceptor Archive', 'Deep Rooted'],
    suitability: (system) => system.primaryWorld.techLevel < 4
  },

  'Trade Arbitrators': {
    name: 'Trade Arbitrators',
    description: 'Neutral mediators affiliated with the Exchange Consulate, resolving disputes for a fee.',
    type: 'Corporation',
    attributes: { hp: 18, maxHp: 18, force: 2, cunning: 4, wealth: 4 },
    assets: [
      { id: 'wealth_2_lawyers' },
      { id: 'wealth_4_bank' },
      { id: 'force_1_security_personnel' }
    ],
    tags: ['Exchange Consulate', 'Plutocratic'],
    suitability: (system) => system.primaryWorld.tradeCodes.includes('Rich')
  },
  
  // ============================================================================
  // TIER 2: MODERATE FACTIONS (HP 20-29, Balanced Resources)
  // ============================================================================
  
  'Planetary Government': {
    name: 'Planetary Government',
    description: 'Perhaps this world was important once, but disaster, ennui, or the Scream has left it a sleepy planet disinterested in the wider galaxy.',
    type: 'Government',
    attributes: { hp: 29, maxHp: 29, force: 6, cunning: 3, wealth: 5 },
    assets: [
      { id: 'force_4_postech_infantry' },
      { id: 'force_6_planetary_defenses' },
      { id: 'cunning_1_informers' },
      { id: 'wealth_4_bank' }
    ],
    tags: ['Deep Rooted', 'Planetary Government'],
    suitability: (system) => system.primaryWorld.techLevel >= 3 && system.primaryWorld.population >= 3
  },
  
  'Religious Order': {
    name: 'Religious Order',
    description: 'This religious organization is a powerful force in the sector, likely with major congregations on several worlds.',
    type: 'Religion',
    attributes: { hp: 29, maxHp: 29, force: 3, cunning: 6, wealth: 5 },
    assets: [
      { id: 'cunning_6_demagogue' },
      { id: 'cunning_5_organization_moles' },
      { id: 'force_3_zealots' },
      { id: 'wealth_5_marketers' }
    ],
    tags: ['Theocratic', 'Fanatical'],
    suitability: (system) => system.primaryWorld.government === 'Theocracy' || system.primaryWorld.tags.includes('Theocracy')
  },
  
  'Trade Syndicate': {
    name: 'Trade Syndicate',
    description: 'A star-spanning consortium of merchants whose final loyalty is always to their credit balance.',
    type: 'Corporation',
    attributes: { hp: 29, maxHp: 29, force: 3, cunning: 5, wealth: 6 },
    assets: [
      { id: 'wealth_6_venture_capital' },
      { id: 'wealth_4_shipping_combine' },
      { id: 'force_2_hardened_personnel' },
      { id: 'cunning_2_blackmail' }
    ],
    tags: ['Plutocratic', 'Machiavellian'],
    suitability: (system) => system.primaryWorld.tradeCodes.includes('Rich') || system.primaryWorld.tags.includes('Trade Hub')
  },
  
  'Genetic Supremacists': {
    name: 'Genetic Supremacists',
    description: 'These eugenics cults believe superior breeds of humanity can be engineered, and that genetic background legitimizes rule. Widely loathed, their experimental treatments create unwilling converts.',
    type: 'Eugenics Cult',
    attributes: { hp: 29, maxHp: 29, force: 3, cunning: 6, wealth: 5 },
    assets: [
      { id: 'cunning_5_boltholes' },
      { id: 'cunning_6_demagogue' },
      { id: 'wealth_3_laboratory' },
      { id: 'force_1_gengineered_slaves' }
    ],
    tags: ['Eugenics Cult', 'Secretive'],
    suitability: (system) => system.primaryWorld.tags.includes('Altered Humanity') || system.primaryWorld.tags.includes('Eugenic Cult')
  },
  
  'Mercenary Legion': {
    name: 'Mercenary Legion',
    description: 'Professional soldiers for hire, these warriors sell their services to the highest bidder. Their reputation is their currency.',
    type: 'Mercenary Group',
    attributes: { hp: 22, maxHp: 22, force: 6, cunning: 3, wealth: 4 },
    assets: [
      { id: 'force_4_postech_infantry' },
      { id: 'wealth_3_mercenaries' },
      { id: 'force_2_hardened_personnel' }
    ],
    tags: ['Mercenary Group', 'Warlike'],
    suitability: (system) => system.primaryWorld.tags.includes('Mercenaries') || system.primaryWorld.tags.includes('Battleground')
  },
  
  'Criminal Syndicate': {
    name: 'Criminal Syndicate',
    description: 'An organized crime network with deep roots in the underworld. They control smuggling, protection rackets, and illegal trade.',
    type: 'Criminal Organization',
    attributes: { hp: 22, maxHp: 22, force: 4, cunning: 6, wealth: 4 },
    assets: [
      { id: 'cunning_4_seditionists' },
      { id: 'cunning_2_blackmail' },
      { id: 'cunning_1_smugglers' },
      { id: 'force_2_hardened_personnel' }
    ],
    tags: ['Secretive', 'Plutocratic'],
    suitability: (system) => system.primaryWorld.population >= 4 || system.primaryWorld.tags.includes('Cheap Life')
  },
  
  'Tech Collective': {
    name: 'Tech Collective',
    description: 'A group of technologists and scientists dedicated to preserving and advancing technology. They jealously guard their knowledge.',
    type: 'Corporation',
    attributes: { hp: 22, maxHp: 22, force: 3, cunning: 5, wealth: 6 },
    assets: [
      { id: 'wealth_3_laboratory' },
      { id: 'wealth_3_postech_industry' },
      { id: 'cunning_3_cyberninjas' },
      { id: 'force_2_hardened_personnel' }
    ],
    tags: ['Technical Expertise', 'Secretive'],
    suitability: (system) => system.primaryWorld.techLevel >= 4 || system.primaryWorld.tags.includes('High Tech')
  },
  
  'Agricultural Cooperative': {
    name: 'Agricultural Cooperative',
    description: 'Farmers and food producers who control vital agricultural resources. They may seem simple, but hunger is a powerful weapon.',
    type: 'Corporation',
    attributes: { hp: 22, maxHp: 22, force: 3, cunning: 4, wealth: 6 },
    assets: [
      { id: 'wealth_1_harvesters' },
      { id: 'wealth_4_monopoly' },
      { id: 'force_2_guerrilla_populace' },
      { id: 'cunning_2_lobbyists' }
    ],
    tags: ['Deep Rooted', 'Plutocratic'],
    suitability: (system) => system.primaryWorld.tradeCodes.includes('Agricultural')
  },
  
  'Psychic Academy': {
    name: 'Psychic Academy',
    description: 'A school and sanctuary for psychics, training them in the use of their powers. They wield influence through mental abilities.',
    type: 'Religion',
    attributes: { hp: 22, maxHp: 22, force: 5, cunning: 5, wealth: 3 },
    assets: [
      { id: 'force_5_psychic_assassins' },
      { id: 'cunning_3_cyberninjas' },
      { id: 'force_3_counterintel_unit' }
    ],
    tags: ['Psychic Academy', 'Secretive'],
    suitability: (system) => system.primaryWorld.tags.includes('Psionics Academy') || system.primaryWorld.tags.includes('Psionics Worship')
  },
  
  'Military Junta': {
    name: 'Military Junta',
    description: 'A military government that seized power through force. They rule with an iron fist and maintain order through strength.',
    type: 'Government',
    attributes: { hp: 25, maxHp: 25, force: 7, cunning: 3, wealth: 3 },
    assets: [
      { id: 'force_4_postech_infantry' },
      { id: 'force_2_elite_skirmishers' },
      { id: 'force_6_planetary_defenses' }
    ],
    tags: ['Warlike', 'Imperialists'],
    suitability: (system) => system.primaryWorld.government === 'Military' || system.primaryWorld.tags.includes('Warlords')
  },

  'Gene-Spliced Nobility': {
    name: 'Gene-Spliced Nobility',
    description: 'A ruling class that uses genetic modification to distinguish themselves from the common populace.',
    type: 'Eugenics Cult',
    attributes: { hp: 25, maxHp: 25, force: 4, cunning: 5, wealth: 5 },
    assets: [
      { id: 'force_1_gengineered_slaves' },
      { id: 'wealth_3_laboratory' },
      { id: 'cunning_4_party_machine' },
      { id: 'wealth_4_medical_center' }
    ],
    tags: ['Eugenics Cult', 'Plutocratic'],
    suitability: (system) => system.primaryWorld.tags.includes('Eugenic Cult')
  },

  'Interstellar Mint': {
    name: 'Interstellar Mint',
    description: 'A financial institution that issues currency and bonds recognized across multiple sectors.',
    type: 'Corporation',
    attributes: { hp: 29, maxHp: 29, force: 2, cunning: 5, wealth: 7 },
    assets: [
      { id: 'wealth_4_bank' },
      { id: 'wealth_6_venture_capital' },
      { id: 'cunning_3_covert_shipping' },
      { id: 'force_1_security_personnel' }
    ],
    tags: ['Exchange Consulate', 'Secretive'],
    suitability: (system) => system.primaryWorld.tradeCodes.includes('Rich')
  },

  'Purist Crusade': {
    name: 'Purist Crusade',
    description: 'Zealots dedicated to cleansing the sector of perceived impurities, be they alien, mutant, or heretical.',
    type: 'Religion',
    attributes: { hp: 25, maxHp: 25, force: 6, cunning: 4, wealth: 3 },
    assets: [
      { id: 'force_3_zealots' },
      { id: 'force_4_postech_infantry' },
      { id: 'cunning_6_demagogue' }
    ],
    tags: ['Fanatical', 'Warlike'],
    suitability: (system) => system.primaryWorld.tags.includes('Xenophobes')
  },

  'Information Brokers': {
    name: 'Information Brokers',
    description: 'Spies and hackers who sell secrets to the highest bidder. They know everyone\'s skeletons.',
    type: 'Criminal Organization',
    attributes: { hp: 22, maxHp: 22, force: 2, cunning: 7, wealth: 4 },
    assets: [
      { id: 'cunning_7_book_of_secrets' },
      { id: 'cunning_5_cracked_comms' },
      { id: 'cunning_1_informers' },
      { id: 'cunning_3_cyberninjas' }
    ],
    tags: ['Machiavellian', 'Secretive'],
    suitability: (system) => system.primaryWorld.techLevel >= 4
  },

  'Private Security Firm': {
    name: 'Private Security Firm',
    description: 'A corporate-structured mercenary group offering high-end protection services.',
    type: 'Mercenary Group',
    attributes: { hp: 25, maxHp: 25, force: 5, cunning: 3, wealth: 5 },
    assets: [
      { id: 'force_2_elite_skirmishers' },
      { id: 'wealth_3_mercenaries' },
      { id: 'force_4_strike_fleet' }
    ],
    tags: ['Mercenary Group', 'Technical Expertise'],
    suitability: (system) => system.primaryWorld.tags.includes('Mercenaries')
  },

  'Maltech Hunters': {
    name: 'Maltech Hunters',
    description: 'Specialists who track down and neutralize forbidden technologies.',
    type: 'Other',
    attributes: { hp: 25, maxHp: 25, force: 5, cunning: 5, wealth: 3 },
    assets: [
      { id: 'force_3_counterintel_unit' },
      { id: 'cunning_4_tripwire_cells' },
      { id: 'force_2_hardened_personnel' },
      { id: 'wealth_2_surveyors' }
    ],
    tags: ['Perimeter Agency', 'Technical Expertise'],
    suitability: (system) => system.primaryWorld.tags.includes('Perimeter Agency')
  },

  'Corsair Kingdom': {
    name: 'Corsair Kingdom',
    description: 'A system where pirates rule openly, demanding tribute from passing ships.',
    type: 'Government',
    attributes: { hp: 29, maxHp: 29, force: 6, cunning: 3, wealth: 4 },
    assets: [
      { id: 'force_5_blockade_fleet' },
      { id: 'wealth_5_blockade_runners' },
      { id: 'force_6_planetary_defenses' }
    ],
    tags: ['Pirates', 'Warlike'],
    suitability: (system) => system.primaryWorld.tags.includes('Pirates')
  },

  'Bureaucratic Federation': {
    name: 'Bureaucratic Federation',
    description: 'A massive government apparatus where procedure and regulation reign supreme.',
    type: 'Government',
    attributes: { hp: 29, maxHp: 29, force: 4, cunning: 4, wealth: 6 },
    assets: [
      { id: 'wealth_2_lawyers' },
      { id: 'force_1_security_personnel' },
      { id: 'wealth_4_bank' },
      { id: 'cunning_2_lobbyists' }
    ],
    tags: ['Planetary Government', 'Deep Rooted'],
    suitability: (system) => system.primaryWorld.government === 'Democracy'
  },

  'Merchant Princes': {
    name: 'Merchant Princes',
    description: 'Dynastic families who control vast trade networks and treat planets as personal fiefdoms.',
    type: 'Government',
    attributes: { hp: 29, maxHp: 29, force: 3, cunning: 5, wealth: 7 },
    assets: [
      { id: 'wealth_6_venture_capital' },
      { id: 'wealth_5_marketers' },
      { id: 'force_2_elite_skirmishers' },
      { id: 'wealth_4_monopoly' }
    ],
    tags: ['Plutocratic', 'Machiavellian'],
    suitability: (system) => system.primaryWorld.government === 'Oligarchy'
  },

  'Technology Monks': {
    name: 'Technology Monks',
    description: 'A religious order that worships technology as a divine gift, maintaining ancient machines.',
    type: 'Religion',
    attributes: { hp: 25, maxHp: 25, force: 3, cunning: 4, wealth: 5 },
    assets: [
      { id: 'wealth_5_pretech_researchers' },
      { id: 'wealth_3_postech_industry' },
      { id: 'force_1_militia_unit' }
    ],
    tags: ['Preceptor Archive', 'Theocratic'],
    suitability: (system) => system.primaryWorld.techLevel >= 4
  },

  'Mindwalker Coven': {
    name: 'Mindwalker Coven',
    description: 'A secretive group of psychics who use their powers to guide events from the shadows.',
    type: 'Other',
    attributes: { hp: 22, maxHp: 22, force: 4, cunning: 6, wealth: 3 },
    assets: [
      { id: 'force_5_psychic_assassins' },
      { id: 'cunning_7_book_of_secrets' },
      { id: 'cunning_3_cyberninjas' }
    ],
    tags: ['Psychic Academy', 'Machiavellian'],
    suitability: (system) => system.primaryWorld.tags.includes('Psionics Academy')
  },

  'Raider Clans': {
    name: 'Raider Clans',
    description: 'Nomadic warrior families who roam the wastes or the void, taking what they need.',
    type: 'Rebel Movement',
    attributes: { hp: 22, maxHp: 22, force: 5, cunning: 3, wealth: 2 },
    assets: [
      { id: 'force_2_guerrilla_populace' },
      { id: 'force_2_elite_skirmishers' },
      { id: 'wealth_1_harvesters' }
    ],
    tags: ['Savage', 'Warlike'],
    suitability: (system) => system.primaryWorld.tags.includes('Nomads')
  },

  'Ascetic Monks': {
    name: 'Ascetic Monks',
    description: 'A religious order that shuns material wealth, focusing on spiritual purity and discipline.',
    type: 'Religion',
    attributes: { hp: 25, maxHp: 25, force: 4, cunning: 5, wealth: 2 },
    assets: [
      { id: 'cunning_6_demagogue' },
      { id: 'force_3_zealots' },
      { id: 'cunning_4_party_machine' }
    ],
    tags: ['Theocratic', 'Deep Rooted'],
    suitability: (system) => system.primaryWorld.government === 'Theocracy'
  },

  'Militant Order': {
    name: 'Militant Order',
    description: 'A knighthood or warrior society dedicated to martial perfection and honor.',
    type: 'Mercenary Group',
    attributes: { hp: 25, maxHp: 25, force: 6, cunning: 3, wealth: 3 },
    assets: [
      { id: 'force_6_pretech_infantry' },
      { id: 'force_2_elite_skirmishers' },
      { id: 'force_1_militia_unit' }
    ],
    tags: ['Warlike', 'Fanatical'],
    suitability: (system) => system.primaryWorld.tags.includes('Militant')
  },
  
  // ============================================================================
  // TIER 3: POWERFUL FACTIONS (HP 35-49, High Resources)
  // ============================================================================
  
  'Stellar Hegemon': {
    name: 'Stellar Hegemon',
    description: 'This world is the mightiest military power in the sector and leads neighboring worlds in a "voluntary confederation" that it ever seeks to expand.',
    type: 'Regional Hegemon',
    attributes: { hp: 49, maxHp: 49, force: 8, cunning: 5, wealth: 7 },
    assets: [
      { id: 'force_7_space_marines' },
      { id: 'force_6_planetary_defenses' },
      { id: 'force_5_blockade_fleet' },
      { id: 'force_4_extended_theater' },
      { id: 'wealth_7_pretech_manufactory' },
      { id: 'wealth_4_shipping_combine' },
      { id: 'cunning_4_tripwire_cells' },
      { id: 'cunning_3_cyberninjas' }
    ],
    tags: ['Imperialists', 'Planetary Government'],
    suitability: (system) => system.primaryWorld.population >= 5 && system.primaryWorld.techLevel >= 4 && system.primaryWorld.tags.includes('Regional Hegemon')
  },
  
  'Megacorporation': {
    name: 'Megacorporation',
    description: 'A massive interstellar corporation with near-unlimited resources. They own planets, control governments, and answer to no one but their shareholders.',
    type: 'Corporation',
    attributes: { hp: 40, maxHp: 40, force: 5, cunning: 7, wealth: 8 },
    assets: [
      { id: 'wealth_7_pretech_manufactory' },
      { id: 'wealth_6_venture_capital' },
      { id: 'wealth_4_shipping_combine' },
      { id: 'cunning_4_party_machine' },
      { id: 'force_4_postech_infantry' },
      { id: 'cunning_2_lobbyists' }
    ],
    tags: ['Plutocratic', 'Imperialists'],
    suitability: (system) => system.primaryWorld.population >= 5 && system.primaryWorld.tradeCodes.includes('Rich') && system.primaryWorld.tags.includes('Megacorps')
  },
  
  'Pretech Enclave': {
    name: 'Pretech Enclave',
    description: 'Guardians of ancient technology from before the Scream. They possess weapons and knowledge that make them nearly invincible.',
    type: 'Corporation',
    attributes: { hp: 35, maxHp: 35, force: 6, cunning: 6, wealth: 7 },
    assets: [
      { id: 'force_6_pretech_infantry' },
      { id: 'wealth_7_pretech_manufactory' },
      { id: 'wealth_5_pretech_researchers' },
      { id: 'cunning_5_boltholes' },
      { id: 'force_5_pretech_logistics' }
    ],
    tags: ['Technical Expertise', 'Secretive'],
    suitability: (system) => system.primaryWorld.techLevel === 5 || system.primaryWorld.tags.includes('Alien Ruins')
  },
  
  'Fallen Empire': {
    name: 'Fallen Empire',
    description: 'Once a mighty power, this faction clings to past glories. They still possess formidable resources but are shadows of their former greatness.',
    type: 'Government',
    attributes: { hp: 35, maxHp: 35, force: 7, cunning: 5, wealth: 6 },
    assets: [
      { id: 'force_6_planetary_defenses' },
      { id: 'force_4_postech_infantry' },
      { id: 'wealth_6_rd_department' },
      { id: 'cunning_4_party_machine' },
      { id: 'wealth_4_bank' }
    ],
    tags: ['Deep Rooted', 'Imperialists'],
    suitability: (system) => system.primaryWorld.population >= 4 && system.primaryWorld.techLevel <= 3 && system.primaryWorld.tags.includes('Fallen Hegemon')
  },
  
  'Hive Mind Collective': {
    name: 'Hive Mind Collective',
    description: 'A terrifying union of minds linked through technology or psychic power. Individual identity is subsumed into the collective consciousness.',
    type: 'Religion',
    attributes: { hp: 35, maxHp: 35, force: 6, cunning: 7, wealth: 5 },
    assets: [
      { id: 'force_5_psychic_assassins' },
      { id: 'cunning_6_demagogue' },
      { id: 'cunning_5_organization_moles' },
      { id: 'force_4_postech_infantry' },
      { id: 'cunning_4_party_machine' }
    ],
    tags: ['Fanatical', 'Theocratic'],
    suitability: (system) => system.primaryWorld.tags.includes('Unbraked AI') || system.primaryWorld.tags.includes('Psionics Worship')
  },
  
  'Warlord Coalition': {
    name: 'Warlord Coalition',
    description: 'A loose alliance of military strongmen who carved up a world or system. They fight amongst themselves as much as external threats.',
    type: 'Mercenary Group',
    attributes: { hp: 32, maxHp: 32, force: 8, cunning: 4, wealth: 4 },
    assets: [
      { id: 'force_6_gravtank_formation' },
      { id: 'force_4_strike_fleet' },
      { id: 'force_4_postech_infantry' },
      { id: 'force_3_zealots' },
      { id: 'wealth_3_mercenaries' }
    ],
    tags: ['Warlike', 'Mercenary Group'],
    suitability: (system) => system.primaryWorld.tags.includes('Warlords') || system.primaryWorld.tags.includes('Civil War')
  },
  
  'AI Sovereignty': {
    name: 'AI Sovereignty',
    description: 'An artificial intelligence that has achieved independence and now rules its domain. Its logic is alien and its goals inscrutable.',
    type: 'Government',
    attributes: { hp: 38, maxHp: 38, force: 6, cunning: 8, wealth: 6 },
    assets: [
      { id: 'cunning_8_panopticon_matrix' },
      { id: 'cunning_6_transport_lockdown' },
      { id: 'force_6_planetary_defenses' },
      { id: 'wealth_6_rd_department' },
      { id: 'force_4_postech_infantry' }
    ],
    tags: ['Technical Expertise', 'Planetary Government'],
    suitability: (system) => system.primaryWorld.tags.includes('Unbraked AI')
  },

  'Banking Union': {
    name: 'Banking Union',
    description: 'A sophisticated financial organization with ties to the Exchange Consulate. They prefer economic pressure to direct conflict.',
    type: 'Corporation',
    attributes: { hp: 29, maxHp: 29, force: 3, cunning: 5, wealth: 6 },
    assets: [
      { id: 'wealth_6_venture_capital' },
      { id: 'wealth_4_bank' },
      { id: 'cunning_2_blackmail' },
      { id: 'wealth_2_lawyers' }
    ],
    tags: ['Exchange Consulate', 'Plutocratic'],
    suitability: (system) => system.primaryWorld.tradeCodes.includes('Rich')
  },

  'Doomsday Cult': {
    name: 'Doomsday Cult',
    description: 'A fanatical group believing the end is nigh. They fight with terrifying disregard for their own lives.',
    type: 'Religion',
    attributes: { hp: 22, maxHp: 22, force: 5, cunning: 5, wealth: 2 },
    assets: [
      { id: 'force_3_zealots' },
      { id: 'cunning_5_organization_moles' },
      { id: 'cunning_2_saboteurs' }
    ],
    tags: ['Fanatical', 'Secretive'],
    suitability: (system) => system.primaryWorld.tags.includes('Religious Dictatorship')
  },

  'Expansionist Empire': {
    name: 'Expansionist Empire',
    description: 'A rising power with dreams of sector-wide domination. They are aggressive and constantly seek new territories.',
    type: 'Regional Hegemon',
    attributes: { hp: 35, maxHp: 35, force: 7, cunning: 4, wealth: 5 },
    assets: [
      { id: 'force_4_strike_fleet' },
      { id: 'force_7_deep_strike_landers' },
      { id: 'force_4_postech_infantry' },
      { id: 'wealth_5_marketers' }
    ],
    tags: ['Imperialists', 'Warlike'],
    suitability: (system) => system.primaryWorld.population >= 4
  },

  'Shadow Council': {
    name: 'Shadow Council',
    description: 'A secret cabal that pulls the strings from behind the scenes. They revel in intrigue and manipulation.',
    type: 'Government',
    attributes: { hp: 29, maxHp: 29, force: 3, cunning: 7, wealth: 5 },
    assets: [
      { id: 'cunning_7_book_of_secrets' },
      { id: 'cunning_5_organization_moles' },
      { id: 'wealth_2_lawyers' },
      { id: 'force_1_hitmen' }
    ],
    tags: ['Machiavellian', 'Secretive'],
    suitability: (system) => system.primaryWorld.government === 'Oligarchy'
  },

  'Perimeter Watch': {
    name: 'Perimeter Watch',
    description: 'An organization dedicated to containing maltech threats. They maintain ancient protocols and watch for dangerous technologies.',
    type: 'Other',
    attributes: { hp: 25, maxHp: 25, force: 5, cunning: 6, wealth: 4 },
    assets: [
      { id: 'force_5_pretech_logistics' },
      { id: 'cunning_6_demagogue' },
      { id: 'cunning_3_cyberninjas' },
      { id: 'force_3_counterintel_unit' }
    ],
    tags: ['Perimeter Agency', 'Technical Expertise'],
    suitability: (system) => system.primaryWorld.tags.includes('Perimeter Agency')
  },

  'Archive Keepers': {
    name: 'Archive Keepers',
    description: 'Scholars and guardians of knowledge associated with a Preceptor Archive. They use education and technology to influence the sector.',
    type: 'Other',
    attributes: { hp: 25, maxHp: 25, force: 2, cunning: 6, wealth: 6 },
    assets: [
      { id: 'wealth_5_pretech_researchers' },
      { id: 'wealth_3_laboratory' },
      { id: 'wealth_6_rd_department' },
      { id: 'cunning_3_cyberninjas' }
    ],
    tags: ['Preceptor Archive', 'Technical Expertise'],
    suitability: (system) => system.primaryWorld.tags.includes('Preceptor Archive')
  },

  'Void Scavengers': {
    name: 'Void Scavengers',
    description: 'Nomadic fleets that pick through the ruins of the past. They find value in what others discard.',
    type: 'Corporation',
    attributes: { hp: 35, maxHp: 35, force: 5, cunning: 4, wealth: 8 },
    assets: [
      { id: 'wealth_8_scavenger_fleet' },
      { id: 'wealth_1_harvesters' },
      { id: 'wealth_5_blockade_runners' }
    ],
    tags: ['Scavengers', 'Deep Rooted'],
    suitability: (system) => system.primaryWorld.tags.includes('Scavengers')
  },

  'Clone Army Cadre': {
    name: 'Clone Army Cadre',
    description: 'A massive military force composed of genetically identical soldiers, bred for loyalty and war.',
    type: 'Eugenics Cult',
    attributes: { hp: 35, maxHp: 35, force: 7, cunning: 4, wealth: 5 },
    assets: [
      { id: 'force_6_pretech_infantry' },
      { id: 'force_1_gengineered_slaves' },
      { id: 'wealth_3_laboratory' },
      { id: 'force_7_space_marines' }
    ],
    tags: ['Eugenics Cult', 'Warlike'],
    suitability: (system) => system.primaryWorld.tags.includes('Clones')
  },

  'Crusading Kingdom': {
    name: 'Crusading Kingdom',
    description: 'A religious or ideological monarchy bent on converting or conquering all known space.',
    type: 'Regional Hegemon',
    attributes: { hp: 40, maxHp: 40, force: 8, cunning: 4, wealth: 6 },
    assets: [
      { id: 'force_8_capital_fleet' },
      { id: 'force_7_space_marines' },
      { id: 'cunning_6_demagogue' },
      { id: 'wealth_4_shipping_combine' }
    ],
    tags: ['Imperialists', 'Theocratic'],
    suitability: (system) => system.primaryWorld.government === 'Theocracy'
  },

  'Noble House Conspiracy': {
    name: 'Noble House Conspiracy',
    description: 'A powerful family with influence across multiple sectors, plotting to seize the throne.',
    type: 'Government',
    attributes: { hp: 35, maxHp: 35, force: 4, cunning: 8, wealth: 6 },
    assets: [
      { id: 'cunning_8_panopticon_matrix' },
      { id: 'cunning_7_treachery' },
      { id: 'wealth_6_venture_capital' },
      { id: 'force_1_hitmen' }
    ],
    tags: ['Machiavellian', 'Plutocratic'],
    suitability: (system) => system.primaryWorld.government === 'Monarchy'
  },

  'Ancient Sentinel': {
    name: 'Ancient Sentinel',
    description: 'A remnant of the Terran Mandate, still functioning and dedicated to its original defense protocols.',
    type: 'Other',
    attributes: { hp: 40, maxHp: 40, force: 7, cunning: 7, wealth: 5 },
    assets: [
      { id: 'force_7_integral_protocols' },
      { id: 'cunning_8_panopticon_matrix' },
      { id: 'force_6_planetary_defenses' },
      { id: 'force_5_pretech_logistics' }
    ],
    tags: ['Perimeter Agency', 'Deep Rooted'],
    suitability: (system) => system.primaryWorld.tags.includes('Perimeter Agency')
  },

  'Feudal Monarchy': {
    name: 'Feudal Monarchy',
    description: 'A rigid class system where a king rules over landed gentry and serfs, backed by high-tech weaponry.',
    type: 'Government',
    attributes: { hp: 35, maxHp: 35, force: 6, cunning: 4, wealth: 6 },
    assets: [
      { id: 'force_6_planetary_defenses' },
      { id: 'wealth_4_bank' },
      { id: 'force_4_postech_infantry' },
      { id: 'cunning_4_party_machine' }
    ],
    tags: ['Planetary Government', 'Deep Rooted'],
    suitability: (system) => system.primaryWorld.government === 'Monarchy'
  },

  'Psionic Enforcement Agency': {
    name: 'Psionic Enforcement Agency',
    description: 'A government or corporate branch dedicated to policing and utilizing psychic talents.',
    type: 'Government',
    attributes: { hp: 35, maxHp: 35, force: 6, cunning: 6, wealth: 5 },
    assets: [
      { id: 'force_5_psychic_assassins' },
      { id: 'cunning_7_book_of_secrets' },
      { id: 'force_3_counterintel_unit' },
      { id: 'wealth_3_laboratory' }
    ],
    tags: ['Psychic Academy', 'Secretive'],
    suitability: (system) => system.primaryWorld.tags.includes('Psionics Academy')
  },

  'Divine Mandate': {
    name: 'Divine Mandate',
    description: 'A theocracy led by a living god or prophet, commanding absolute obedience.',
    type: 'Religion',
    attributes: { hp: 40, maxHp: 40, force: 5, cunning: 7, wealth: 6 },
    assets: [
      { id: 'cunning_6_demagogue' },
      { id: 'cunning_8_panopticon_matrix' },
      { id: 'wealth_5_marketers' },
      { id: 'force_3_zealots' }
    ],
    tags: ['Theocratic', 'Imperialists'],
    suitability: (system) => system.primaryWorld.tags.includes('Theocracy')
  },

  'Berserker Horde': {
    name: 'Berserker Horde',
    description: 'A massive fleet of reavers who live only for battle and plunder.',
    type: 'Mercenary Group',
    attributes: { hp: 35, maxHp: 35, force: 8, cunning: 3, wealth: 5 },
    assets: [
      { id: 'force_8_capital_fleet' },
      { id: 'force_3_zealots' },
      { id: 'wealth_8_scavenger_fleet' },
      { id: 'force_6_gravtank_formation' }
    ],
    tags: ['Warlike', 'Savage'],
    suitability: (system) => system.primaryWorld.tags.includes('Warlords')
  }
};

Object.values(FACTION_TEMPLATES).forEach((template) => {
  const { hp, maxHp } = template.attributes;
  const focus = pickAttributeFocus(template);
  template.attributes = {
    hp,
    maxHp,
    ...ATTRIBUTE_PRESETS[focus]
  };
  template.assets = [
    {
      id: selectLevelOneAsset(template, focus)
    }
  ];
});

/**
 * Generate a faction based on a template name and starting system
 */
export function generateFactionFromTemplate(
  templateName: string,
  homeworld: StarSystem,
  customName?: string
): Faction {
  const template = FACTION_TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }

  // Generate name if not provided
  let factionName = customName;
  if (!factionName) {
    // Basic name generation logic based on type
    if (template.type === 'Corporation') {
      factionName = `${faker.company.name()} Corp`;
    } else if (template.type === 'Religion') {
      factionName = `Order of ${faker.word.noun()}`;
    } else if (template.type === 'Government' || template.type === 'Regional Hegemon' || template.type === 'Colony') {
      factionName = `${homeworld.name} Government`;
    } else {
      factionName = `${faker.word.adjective()} ${faker.word.noun()}`;
    }
  }

  // Create assets
  const factionAssets: FactionAsset[] = [];
  
  // All factions start with a Base of Influence (20 HP) on their homeworld
  factionAssets.push({
    id: crypto.randomUUID(),
    definitionId: 'base_of_influence',
    location: homeworld.id,
    hp: 20,
    maxHp: 20,
    stealthed: false
  });
  
  template.assets.forEach(assetItem => {
    const assetDef = getAssetById(assetItem.id);
    if (assetDef) {
      const count = assetItem.count || 1;
      for (let i = 0; i < count; i++) {
        factionAssets.push({
          id: crypto.randomUUID(),
          definitionId: assetDef.id,
          location: homeworld.id,
          hp: assetDef.hp,
          maxHp: assetDef.hp,
          stealthed: false
        });
      }
    }
  });

  return {
    id: crypto.randomUUID(),
    name: factionName,
    type: template.type,
    homeworld: homeworld.id,
    attributes: { ...template.attributes },
    facCreds: 5,
    xp: 0, // Experience points start at 0
    tags: [...template.tags],
    goal: null, // To be determined by AI or user
    assets: factionAssets
  };
}

/**
 * Generate a suitable faction for a given system based on its characteristics
 */
export function generateRandomFactionForSystem(system: StarSystem): Faction {
  // Filter templates by suitability
  const suitableTemplates = Object.values(FACTION_TEMPLATES).filter(t => 
    t.suitability ? t.suitability(system) : false
  );

  // Fallback to 'Backwater Planet' or 'Colony World' if no specific match
  let selectedTemplate: FactionTemplate;
  
  if (suitableTemplates.length > 0) {
    const randomIndex = Math.floor(Math.random() * suitableTemplates.length);
    selectedTemplate = suitableTemplates[randomIndex];
  } else {
    // Default logic
    if (system.primaryWorld.population <= 2) {
      selectedTemplate = FACTION_TEMPLATES['Colony World'];
    } else {
      selectedTemplate = FACTION_TEMPLATES['Backwater Planet'];
    }
  }

  return generateFactionFromTemplate(selectedTemplate.name, system);
}

/**
 * Get all available faction templates
 */
export function getFactionTemplates(): FactionTemplate[] {
  return Object.values(FACTION_TEMPLATES);
}

