/**
 * World Generation System
 * 
 * Architecture: This module generates realistic worlds with interconnected traits.
 * 
 * Key Design Principles:
 * 1. Physical traits (atmosphere, temperature, biosphere) are generated first
 * 2. Societal traits (population, tech, government) are influenced by physical traits
 * 3. Tags are contextually selected based on world characteristics
 * 4. Trade codes are derived from the world's economic profile
 * 
 * Generation Flow:
 * Physical Layer → Societal Layer → Economic Layer → Tag Selection
 */

import { faker } from '@faker-js/faker';
import type {
  PrimaryWorld,
  AtmosphereType,
  TemperatureType,
  BiosphereType,
} from '../types/sector';

// ============================================================================
// CORE GENERATION RULES
// ============================================================================

interface WorldProfile {
  atmosphere: AtmosphereType;
  temperature: TemperatureType;
  biosphere: BiosphereType;
  population: number;
  techLevel: number;
  government: string;
  tags: string[];
  tradeCodes: string[];
  // Derived attributes for trade route generation
  economicValue: number; // 0-100: Attractiveness for trade
  resourceExport: string[]; // What this world exports
  resourceImport: string[]; // What this world needs
}

function roll2d6(): number {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

function rollModified2d6(modifier: number): number {
  return Math.max(2, Math.min(12, roll2d6() + modifier));
}

// ============================================================================
// PHASE 1: PHYSICAL WORLD GENERATION
// ============================================================================

/**
 * Generate atmosphere with realistic distribution
 * Breathable atmospheres are rare and valuable in the SWN universe
 */
function generateAtmosphere(): AtmosphereType {
  const roll = roll2d6();
  if (roll === 2) return 'Corrosive';           // 2.78%
  if (roll === 3) return 'Inert';               // 5.56%
  if (roll <= 5) return 'Airless';              // 19.44% (4-5)
  if (roll <= 7) return 'Thin';                 // 30.56% (6-7) - Survivable with masks
  if (roll === 8) return 'Breathable';          // 13.89% - RARE!
  if (roll === 9) return 'Thick';               // 11.11%
  if (roll <= 11) return 'Exotic';              // 13.89% (10-11)
  return 'Corrosive';                           // 2.78% (12)
}

/**
 * Generate temperature, potentially modified by atmosphere
 */
function generateTemperature(atmosphere: AtmosphereType): TemperatureType {
  let modifier = 0;
  
  // Atmospheric effects on temperature
  if (atmosphere === 'Thick') modifier += 2; // Greenhouse effect
  if (atmosphere === 'Airless') modifier -= 1; // No heat retention
  if (atmosphere === 'Thin') modifier -= 1;
  
  const roll = rollModified2d6(modifier);
  
  if (roll <= 2) return 'Frozen';
  if (roll === 3) return 'Cold';
  if (roll <= 5) return 'Variable Cold';
  if (roll <= 8) return 'Temperate';
  if (roll <= 10) return 'Variable Warm';
  if (roll === 11) return 'Warm';
  return 'Burning';
}

/**
 * Generate biosphere based on atmosphere and temperature
 */
function generateBiosphere(
  atmosphere: AtmosphereType,
  temperature: TemperatureType
): BiosphereType {
  let modifier = 0;
  
  // Hostile atmospheres reduce biosphere
  if (atmosphere === 'Corrosive' || atmosphere === 'Exotic') modifier -= 4;
  if (atmosphere === 'Airless' || atmosphere === 'Inert') modifier -= 3;
  if (atmosphere === 'Thin') modifier -= 1;
  if (atmosphere === 'Breathable') modifier += 2;
  
  // Temperature extremes reduce biosphere
  if (temperature === 'Frozen' || temperature === 'Burning') modifier -= 2;
  if (temperature === 'Cold' || temperature === 'Warm') modifier -= 1;
  if (temperature === 'Temperate') modifier += 1;
  
  const roll = rollModified2d6(modifier);
  
  if (roll <= 2) return 'None';
  if (roll === 3) return 'Remnant';
  if (roll === 4) return 'Microbial';
  if (roll <= 7) return 'Immiscible';
  if (roll <= 9) return 'Human-miscible';
  if (roll === 10) return 'Hybrid';
  return 'Engineered';
}

// ============================================================================
// PHASE 2: SOCIETAL WORLD GENERATION
// ============================================================================

/**
 * Calculate habitability score (affects population)
 */
function calculateHabitability(
  atmosphere: AtmosphereType,
  temperature: TemperatureType,
  biosphere: BiosphereType
): number {
  let score = 0;
  
  // Atmosphere habitability
  if (atmosphere === 'Breathable') score += 4;
  else if (atmosphere === 'Thin' || atmosphere === 'Thick') score += 2;
  else if (atmosphere === 'Inert') score += 1;
  // Corrosive, Exotic, Airless = 0
  
  // Temperature habitability
  if (temperature === 'Temperate') score += 3;
  else if (temperature === 'Variable Warm' || temperature === 'Variable Cold') score += 2;
  else if (temperature === 'Warm' || temperature === 'Cold') score += 1;
  // Frozen, Burning = 0
  
  // Biosphere habitability
  if (biosphere === 'Human-miscible' || biosphere === 'Engineered') score += 3;
  else if (biosphere === 'Hybrid') score += 2;
  else if (biosphere === 'Immiscible') score += 1;
  else if (biosphere === 'Microbial') score += 0;
  // None, Remnant = 0
  
  return score;
}

/**
 * Generate population based on habitability
 */
function generatePopulation(habitabilityScore: number): number {
  let modifier = Math.floor(habitabilityScore / 2) - 2;
  const roll = rollModified2d6(modifier);
  
  if (roll <= 2) return 0; // Failed/No colony
  if (roll === 3) return 1; // Outpost (hundreds to thousands)
  if (roll <= 5) return 2; // Small (tens of thousands)
  if (roll <= 7) return 3; // Moderate (hundreds of thousands)
  if (roll <= 9) return 4; // Large (millions)
  if (roll === 10) return 5; // Major (hundreds of millions)
  return 6; // Metroplex (billions)
}

/**
 * Generate tech level based on population and isolation
 */
function generateTechLevel(population: number): number {
  let modifier = 0;
  
  // Population affects tech development
  if (population === 0) return 0; // No population = no tech
  if (population === 1) modifier -= 2; // Outposts struggle
  if (population === 2) modifier -= 1;
  if (population >= 4) modifier += 1; // Large populations innovate
  if (population >= 5) modifier += 1;
  
  const roll = rollModified2d6(modifier);
  
  if (roll <= 3) return 1; // Pre-industrial
  if (roll <= 5) return 2; // Industrial Age
  if (roll <= 8) return 3; // Early Space Age (typical)
  if (roll <= 10) return 4; // Standard Interstellar
  return 5; // Advanced/Pretech Remnants
}

/**
 * Generate government type based on population and tech
 */
function generateGovernment(population: number, techLevel: number): string {
  if (population === 0) return 'None';
  if (population === 1) {
    const outpostTypes = ['Corporate', 'Military', 'Clan/Tribal', 'Anarchy'];
    return outpostTypes[Math.floor(Math.random() * outpostTypes.length)];
  }
  
  const governments = [
    'Democracy', 'Oligarchy', 'Dictatorship', 'Monarchy',
    'Theocracy', 'Corporate', 'Military', 'Technocracy',
    'Bureaucracy', 'Feudalism', 'Plutocracy'
  ];
  
  // Tech level influences government type
  if (techLevel <= 2) {
    // Low tech favors traditional governments
    return ['Monarchy', 'Feudalism', 'Clan/Tribal', 'Theocracy'][
      Math.floor(Math.random() * 4)
    ];
  }
  
  if (techLevel >= 4) {
    // High tech enables more complex governance
    const advancedGovs = [...governments, 'AI Control', 'Technocracy'];
    return advancedGovs[Math.floor(Math.random() * advancedGovs.length)];
  }
  
  return governments[Math.floor(Math.random() * governments.length)];
}

// ============================================================================
// PHASE 3: ECONOMIC PROFILE & TRADE CODES
// ============================================================================

/**
 * Generate trade codes based on world characteristics
 */
function generateTradeCodes(profile: Partial<WorldProfile>): string[] {
  const codes: string[] = [];
  const { atmosphere, temperature, biosphere, population, techLevel } = profile;
  
  if (!atmosphere || population === undefined || techLevel === undefined) return codes;
  
  // Agricultural worlds
  if (
    (atmosphere === 'Breathable' || atmosphere === 'Thin') &&
    (biosphere === 'Human-miscible' || biosphere === 'Engineered') &&
    population >= 2 &&
    population <= 4 &&
    (temperature === 'Temperate' || temperature === 'Variable Warm' || temperature === 'Variable Cold')
  ) {
    codes.push('Agricultural');
  }
  
  // Industrial worlds
  if (population >= 4 && techLevel >= 3 && atmosphere !== 'Corrosive') {
    codes.push('Industrial');
  }
  
  // High tech worlds
  if (techLevel >= 4 && population >= 4) {
    codes.push('High Tech');
  }
  
  // Low tech worlds
  if (techLevel <= 2 && population >= 2) {
    codes.push('Low Tech');
  }
  
  // Rich worlds (high pop + high tech)
  if (population >= 5 && techLevel >= 4) {
    codes.push('Rich');
  }
  
  // Poor worlds (low tech or harsh conditions)
  if (
    techLevel <= 2 ||
    atmosphere === 'Corrosive' ||
    atmosphere === 'Exotic' ||
    biosphere === 'None' ||
    biosphere === 'Remnant'
  ) {
    codes.push('Poor');
  }
  
  // Desert worlds
  if (
    (temperature === 'Warm' || temperature === 'Burning') &&
    (biosphere === 'None' || biosphere === 'Microbial' || biosphere === 'Remnant')
  ) {
    codes.push('Desert');
  }
  
  // Ice worlds
  if (temperature === 'Frozen' && biosphere !== 'Human-miscible') {
    codes.push('Ice');
  }
  
  // Water worlds
  if (
    biosphere === 'Human-miscible' &&
    atmosphere === 'Breathable' &&
    temperature === 'Temperate'
  ) {
    if (Math.random() < 0.3) codes.push('Water');
  }
  
  // Vacuum worlds
  if (atmosphere === 'Airless') {
    codes.push('Vacuum');
  }
  
  // Mining worlds (harsh but with population)
  if (
    population >= 2 &&
    (atmosphere === 'Exotic' || atmosphere === 'Corrosive' || temperature === 'Burning' || temperature === 'Frozen') &&
    techLevel >= 3
  ) {
    codes.push('Mining');
  }
  
  // Research stations (outposts with high tech)
  if (population === 1 && techLevel >= 4) {
    codes.push('Research Station');
  }
  
  // Non-industrial (low population but some tech)
  if (population <= 3 && population >= 1 && techLevel >= 2) {
    codes.push('Non-Industrial');
  }
  
  return codes;
}

/**
 * Calculate economic value for trade route generation
 */
function calculateEconomicValue(profile: WorldProfile): number {
  let value = 0;
  
  // Population is the primary driver
  value += profile.population * 15;
  
  // Tech level multiplier
  value += profile.techLevel * 10;
  
  // Trade codes add value
  if (profile.tradeCodes.includes('Rich')) value += 20;
  if (profile.tradeCodes.includes('Industrial')) value += 15;
  if (profile.tradeCodes.includes('High Tech')) value += 15;
  if (profile.tradeCodes.includes('Agricultural')) value += 10;
  if (profile.tradeCodes.includes('Poor')) value -= 15;
  if (profile.tradeCodes.includes('Low Tech')) value -= 10;
  
  // Cap at 100
  return Math.min(100, Math.max(0, value));
}

/**
 * Determine what resources a world exports
 */
function determineExports(profile: WorldProfile): string[] {
  const exports: string[] = [];
  
  if (profile.tradeCodes.includes('Agricultural')) {
    exports.push('Food', 'Organic Materials');
  }
  if (profile.tradeCodes.includes('Industrial')) {
    exports.push('Manufactured Goods', 'Machinery');
  }
  if (profile.tradeCodes.includes('High Tech')) {
    exports.push('Electronics', 'Advanced Technology', 'Medical Supplies');
  }
  if (profile.tradeCodes.includes('Mining')) {
    exports.push('Raw Ores', 'Rare Metals', 'Industrial Materials');
  }
  if (profile.tradeCodes.includes('Water')) {
    exports.push('Water', 'Pharmaceuticals');
  }
  if (profile.tradeCodes.includes('Rich')) {
    exports.push('Luxury Goods', 'Cultural Exports');
  }
  
  // Even poor worlds export something
  if (exports.length === 0) {
    if (profile.population >= 2) {
      exports.push('Labor', 'Basic Resources');
    }
  }
  
  return exports;
}

/**
 * Determine what resources a world imports
 */
function determineImports(profile: WorldProfile): string[] {
  const imports: string[] = [];
  
  // High population worlds need food
  if (profile.population >= 5 && !profile.tradeCodes.includes('Agricultural')) {
    imports.push('Food');
  }
  
  // Low tech worlds need technology
  if (profile.techLevel <= 2) {
    imports.push('Advanced Technology', 'Medical Supplies', 'Machinery');
  }
  
  // Desert/Ice worlds need water/life support
  if (profile.tradeCodes.includes('Desert') || profile.tradeCodes.includes('Ice')) {
    imports.push('Water', 'Life Support Equipment');
  }
  
  // Poor worlds need basics
  if (profile.tradeCodes.includes('Poor')) {
    imports.push('Manufactured Goods', 'Food', 'Medical Supplies');
  }
  
  // Industrial worlds need raw materials
  if (profile.tradeCodes.includes('Industrial')) {
    imports.push('Raw Materials', 'Rare Metals', 'Energy');
  }
  
  // High tech worlds need exotic materials
  if (profile.tradeCodes.includes('High Tech')) {
    imports.push('Rare Elements', 'Exotic Materials');
  }
  
  return imports;
}

// ============================================================================
// PHASE 4: TAG SELECTION SYSTEM
// ============================================================================

interface TagDefinition {
  name: string;
  weight: number; // Base probability weight
  conditions?: (profile: WorldProfile) => boolean; // Only available if conditions met
  incompatible?: string[]; // Cannot appear with these tags
}

/**
 * Comprehensive tag database with contextual rules
 */
const TAG_DATABASE: TagDefinition[] = [
  // Environmental Tags
  {
    name: 'Desert World',
    weight: 1,
    conditions: (p) => p.tradeCodes.includes('Desert'),
  },
  {
    name: 'Oceanic World',
    weight: 1,
    conditions: (p) => p.tradeCodes.includes('Water'),
  },
  {
    name: 'Ice World',
    weight: 1,
    conditions: (p) => p.temperature === 'Frozen',
    incompatible: ['Desert World'],
  },
  {
    name: 'Tomb World',
    weight: 1,
    conditions: (p) => p.population === 0 && p.biosphere === 'Remnant',
  },
  {
    name: 'Terraform Failure',
    weight: 1,
    conditions: (p) => 
      p.atmosphere === 'Exotic' || 
      (p.biosphere === 'Remnant' && p.population <= 2),
  },
  {
    name: 'Hostile Biosphere',
    weight: 2,
    conditions: (p) => p.biosphere === 'Immiscible' && p.population >= 2,
  },
  {
    name: 'Hostile Space',
    weight: 1,
    conditions: (p) => p.atmosphere === 'Corrosive' || p.temperature === 'Burning',
  },
  {
    name: 'Night World',
    weight: 1,
    conditions: (p) => p.temperature === 'Frozen' && p.population >= 2,
  },
  {
    name: 'Radioactive World',
    weight: 1,
    conditions: (p) => 
      (p.atmosphere === 'Corrosive' || p.atmosphere === 'Exotic') && 
      p.population >= 1,
  },
  {
    name: 'Sealed Menace',
    weight: 1,
    conditions: (p) => p.biosphere === 'Remnant' && p.population >= 2,
  },
  
  // Population & Society Tags
  {
    name: 'Outpost World',
    weight: 2,
    conditions: (p) => p.population === 1,
  },
  {
    name: 'Abandoned Colony',
    weight: 1,
    conditions: (p) => p.population === 0 && p.techLevel >= 1,
  },
  {
    name: 'Urbanized Surface',
    weight: 1,
    conditions: (p) => p.population >= 5,
    incompatible: ['Desert World', 'Tomb World'],
  },
  {
    name: 'Colonized Population',
    weight: 2,
    conditions: (p) => p.population >= 3 && p.population <= 4,
  },
  {
    name: 'Cheap Life',
    weight: 1,
    conditions: (p) => p.population >= 5 && p.tradeCodes.includes('Poor'),
  },
  {
    name: 'Bubble Cities',
    weight: 1,
    conditions: (p) => 
      (p.atmosphere !== 'Breathable' && p.population >= 3) ||
      p.temperature === 'Burning',
  },
  {
    name: 'Flying Cities',
    weight: 1,
    conditions: (p) => 
      p.atmosphere === 'Thick' && 
      p.population >= 3 && 
      p.techLevel >= 4,
  },
  {
    name: 'Seagoing Cities',
    weight: 1,
    conditions: (p) => p.tradeCodes.includes('Water') && p.population >= 3,
  },
  {
    name: 'Refugees',
    weight: 2,
    conditions: (p) => p.population >= 2 && p.tradeCodes.includes('Poor'),
  },
  
  // Technology Tags
  {
    name: 'High Tech',
    weight: 2,
    conditions: (p) => p.techLevel >= 4,
  },
  {
    name: 'Low Tech',
    weight: 2,
    conditions: (p) => p.techLevel <= 2 && p.population >= 2,
  },
  {
    name: 'Pretech Cultists',
    weight: 1,
    conditions: (p) => p.techLevel <= 2 && Math.random() < 0.4,
  },
  {
    name: 'Forbidden Tech',
    weight: 1,
    conditions: (p) => p.techLevel >= 3,
  },
  {
    name: 'Local Tech',
    weight: 2,
    conditions: (p) => p.techLevel >= 3 && p.population >= 3,
  },
  {
    name: 'Unbraked AI',
    weight: 1,
    conditions: (p) => p.techLevel >= 4 && Math.random() < 0.2,
  },
  {
    name: 'Cyborgs',
    weight: 1,
    conditions: (p) => p.techLevel >= 4 && p.population >= 3,
  },
  {
    name: 'Robots',
    weight: 1,
    conditions: (p) => p.techLevel >= 3 && p.population >= 2,
  },
  
  // Government & Politics Tags
  {
    name: 'Tyranny',
    weight: 2,
    conditions: (p) => 
      p.government === 'Dictatorship' || 
      p.government === 'Military',
  },
  {
    name: 'Police State',
    weight: 1,
    conditions: (p) => p.population >= 4,
  },
  {
    name: 'Theocracy',
    weight: 2,
    conditions: (p) => p.government === 'Theocracy',
  },
  {
    name: 'Anarchy',
    weight: 1,
    conditions: (p) => p.government === 'Anarchy' || p.population === 0,
  },
  {
    name: 'Civil War',
    weight: 1,
    conditions: (p) => p.population >= 3,
  },
  {
    name: 'Cold War',
    weight: 1,
    conditions: (p) => p.population >= 4 && p.techLevel >= 3,
  },
  {
    name: 'Warlords',
    weight: 1,
    conditions: (p) => 
      p.population >= 3 && 
      (p.government === 'Military' || p.government === 'Anarchy'),
  },
  {
    name: 'Mandarinate',
    weight: 1,
    conditions: (p) => p.government === 'Bureaucracy' && p.population >= 4,
  },
  {
    name: 'Oligarchy',
    weight: 2,
    conditions: (p) => p.government === 'Oligarchy' || p.government === 'Plutocracy',
  },
  {
    name: 'Revolutionaries',
    weight: 1,
    conditions: (p) => p.population >= 3,
  },
  
  // Economic Tags
  {
    name: 'Trade Hub',
    weight: 2,
    conditions: (p) => p.economicValue >= 60 && p.population >= 4,
  },
  {
    name: 'Major Spaceyard',
    weight: 1,
    conditions: (p) => 
      p.tradeCodes.includes('Industrial') && 
      p.techLevel >= 4 &&
      p.population >= 4,
  },
  {
    name: 'Heavy Industry',
    weight: 2,
    conditions: (p) => p.tradeCodes.includes('Industrial'),
  },
  {
    name: 'Heavy Mining',
    weight: 2,
    conditions: (p) => p.tradeCodes.includes('Mining'),
  },
  {
    name: 'Local Specialty',
    weight: 3,
    conditions: (p) => p.population >= 2,
  },
  {
    name: 'Megacorps',
    weight: 2,
    conditions: (p) => 
      p.population >= 4 && 
      (p.government === 'Corporate' || p.government === 'Plutocracy'),
  },
  {
    name: 'Gold Rush',
    weight: 1,
    conditions: (p) => p.population >= 2 && p.tradeCodes.includes('Mining'),
  },
  {
    name: 'Sole Supplier',
    weight: 1,
    conditions: (p) => p.population >= 3 && Math.random() < 0.3,
  },
  
  // Cultural Tags
  {
    name: 'Pilgrimage Site',
    weight: 1,
    conditions: (p) => p.population >= 2,
  },
  {
    name: 'Cultural Power',
    weight: 1,
    conditions: (p) => p.population >= 5 && p.tradeCodes.includes('Rich'),
  },
  {
    name: 'Pleasure World',
    weight: 1,
    conditions: (p) => 
      p.tradeCodes.includes('Rich') && 
      p.atmosphere === 'Breathable' &&
      p.temperature === 'Temperate',
  },
  {
    name: 'Rigid Culture',
    weight: 2,
    conditions: (p) => p.population >= 3,
  },
  {
    name: 'Restrictive Laws',
    weight: 2,
    conditions: (p) => p.population >= 3,
  },
  {
    name: 'Xenophiles',
    weight: 1,
    conditions: (p) => p.population >= 3,
    incompatible: ['Xenophobes'],
  },
  {
    name: 'Xenophobes',
    weight: 1,
    conditions: (p) => p.population >= 3,
    incompatible: ['Xenophiles'],
  },
  {
    name: 'Altered Humanity',
    weight: 1,
    conditions: (p) => p.population >= 2 && p.techLevel >= 3,
  },
  {
    name: 'Eugenic Cult',
    weight: 1,
    conditions: (p) => p.population >= 3,
  },
  
  // Conflict & Military Tags
  {
    name: 'Battleground',
    weight: 1,
    conditions: (p) => p.population >= 2,
  },
  {
    name: 'Mercenaries',
    weight: 2,
    conditions: (p) => p.population >= 3,
  },
  {
    name: 'Mandate Base',
    weight: 1,
    conditions: (p) => p.population >= 2 && p.techLevel >= 3,
  },
  {
    name: 'Former Warriors',
    weight: 1,
    conditions: (p) => p.population >= 3,
  },
  {
    name: 'Ritual Combat',
    weight: 1,
    conditions: (p) => p.population >= 2,
  },
  
  // Misc Tags
  {
    name: 'Alien Ruins',
    weight: 2,
    conditions: (p) => p.biosphere !== 'Engineered',
  },
  {
    name: 'Primitive Aliens',
    weight: 1,
    conditions: (p) => p.biosphere === 'Immiscible' && Math.random() < 0.3,
  },
  {
    name: 'Psionics Academy',
    weight: 1,
    conditions: (p) => p.techLevel >= 3 && p.population >= 3,
  },
  {
    name: 'Psionics Fear',
    weight: 1,
    conditions: (p) => p.population >= 3,
    incompatible: ['Psionics Worship', 'Psionics Academy'],
  },
  {
    name: 'Psionics Worship',
    weight: 1,
    conditions: (p) => p.population >= 3,
    incompatible: ['Psionics Fear'],
  },
  {
    name: 'Out of Contact',
    weight: 1,
    conditions: (p) => p.population >= 1 && p.techLevel <= 2,
  },
  {
    name: 'Quarantined World',
    weight: 1,
    conditions: (p) => p.population >= 2,
  },
  {
    name: 'Regional Hegemon',
    weight: 1,
    conditions: (p) => p.economicValue >= 70 && p.techLevel >= 4,
  },
  {
    name: 'Rising Hegemon',
    weight: 1,
    conditions: (p) => p.economicValue >= 60 && p.population >= 5,
  },
  {
    name: 'Fallen Hegemon',
    weight: 1,
    conditions: (p) => 
      p.population >= 4 && 
      p.techLevel <= 2 && 
      p.biosphere === 'Remnant',
  },
];

/**
 * Select appropriate tags based on world profile
 */
function selectWorldTags(profile: WorldProfile): string[] {
  // Filter tags based on conditions
  const availableTags = TAG_DATABASE.filter(tag => {
    if (!tag.conditions) return true;
    return tag.conditions(profile);
  });
  
  if (availableTags.length === 0) {
    // Fallback to basic tags
    return ['Colonized Population', 'Local Specialty'];
  }
  
  // Weighted random selection
  const selectedTags: string[] = [];
  const incompatibleTags = new Set<string>();
  
  // Select 2 tags
  while (selectedTags.length < 2 && availableTags.length > 0) {
    // Filter out incompatible tags
    const validTags = availableTags.filter(tag => 
      !incompatibleTags.has(tag.name) &&
      !selectedTags.includes(tag.name) &&
      (!tag.incompatible || !tag.incompatible.some(inc => selectedTags.includes(inc)))
    );
    
    if (validTags.length === 0) break;
    
    // Calculate total weight
    const totalWeight = validTags.reduce((sum, tag) => sum + tag.weight, 0);
    let random = Math.random() * totalWeight;
    
    // Select tag
    for (const tag of validTags) {
      random -= tag.weight;
      if (random <= 0) {
        selectedTags.push(tag.name);
        if (tag.incompatible) {
          tag.incompatible.forEach(inc => incompatibleTags.add(inc));
        }
        break;
      }
    }
  }
  
  // If we couldn't get 2 tags, fill with generic ones
  while (selectedTags.length < 2) {
    const fallbackTags = ['Local Specialty', 'Colonized Population', 'Rigid Culture'];
    const fallback = fallbackTags.find(t => !selectedTags.includes(t));
    if (fallback) selectedTags.push(fallback);
    else break;
  }
  
  return selectedTags;
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate a complete, realistic world with interconnected traits
 */
export function generatePrimaryWorld(): PrimaryWorld {
  // Phase 1: Physical world
  const atmosphere = generateAtmosphere();
  const temperature = generateTemperature(atmosphere);
  const biosphere = generateBiosphere(atmosphere, temperature);
  
  // Phase 2: Societal traits
  const habitability = calculateHabitability(atmosphere, temperature, biosphere);
  const population = generatePopulation(habitability);
  const techLevel = generateTechLevel(population);
  const government = generateGovernment(population, techLevel);
  
  // Phase 3: Economic profile
  const tradeCodes = generateTradeCodes({
    atmosphere,
    temperature,
    biosphere,
    population,
    techLevel,
  });
  
  // Build profile for tag selection
  const profile: WorldProfile = {
    atmosphere,
    temperature,
    biosphere,
    population,
    techLevel,
    government,
    tradeCodes,
    tags: [], // Will be filled next
    economicValue: 0,
    resourceExport: [],
    resourceImport: [],
  };
  
  profile.economicValue = calculateEconomicValue(profile);
  profile.resourceExport = determineExports(profile);
  profile.resourceImport = determineImports(profile);
  
  // Phase 4: Tag selection
  const tags = selectWorldTags(profile);
  
  return {
    name: faker.location.city() + ' ' + faker.science.chemicalElement().name,
    atmosphere,
    temperature,
    biosphere,
    population,
    techLevel,
    government,
    tags,
    tradeCodes,
  };
}

/**
 * Get the economic profile of a world for trade route generation
 */
export function getWorldEconomicProfile(world: PrimaryWorld): {
  economicValue: number;
  resourceExport: string[];
  resourceImport: string[];
} {
  const profile: WorldProfile = {
    atmosphere: world.atmosphere,
    temperature: world.temperature,
    biosphere: world.biosphere,
    population: world.population,
    techLevel: world.techLevel,
    government: world.government,
    tags: world.tags,
    tradeCodes: world.tradeCodes,
    economicValue: 0,
    resourceExport: [],
    resourceImport: [],
  };
  
  profile.economicValue = calculateEconomicValue(profile);
  profile.resourceExport = determineExports(profile);
  profile.resourceImport = determineImports(profile);
  
  return {
    economicValue: profile.economicValue,
    resourceExport: profile.resourceExport,
    resourceImport: profile.resourceImport,
  };
}

