import {
  planetSpriteManifest,
  type PlanetSpriteCategory,
} from '../data/planetsManifest';
import type {
  AtmosphereType,
  TemperatureType,
  BiosphereType,
} from '../types/sector';

export interface PlanetSpriteOptions {
  /**
   * Optional seed used to pick a deterministic variant within a category.
   * Falls back to a hash of the physical attributes when not provided.
   */
  seed?: string;
}

export interface PlanetSpriteResult {
  category: PlanetSpriteCategory;
  spritePath: string;
  overlays: PlanetSpriteOverlay[];
}

export type PlanetSpriteOverlay =
  | { type: 'ring'; spritePath: string }
  | { type: 'blackhole'; spritePath: string };

const FALLBACK_CATEGORY: PlanetSpriteCategory = 'Rocky';
const COLD_TEMPERATURES: ReadonlySet<TemperatureType> = new Set([
  'Frozen',
  'Cold',
  'Variable Cold',
]);
const WARM_TEMPERATURES: ReadonlySet<TemperatureType> = new Set([
  'Warm',
  'Variable Warm',
  'Burning',
]);

/**
 * Main helper exposed to the rest of the app.
 * Maps a world's physical traits to a sprite category and returns a deterministic sprite path.
 */
export function getPlanetSprite(
  atmosphere: AtmosphereType,
  temperature: TemperatureType,
  biosphere: BiosphereType,
  tags: string[] = [],
  options?: PlanetSpriteOptions,
): PlanetSpriteResult {
  const category = determineSpriteCategory({
    atmosphere,
    temperature,
    biosphere,
    tags,
  });

  return {
    category,
    spritePath: pickSpriteFromCategory(category, buildSeed(options?.seed, {
      atmosphere,
      temperature,
      biosphere,
      tags,
    })),
    overlays: determineSpriteOverlays(tags),
  };
}
function determineSpriteOverlays(tags: string[]): PlanetSpriteOverlay[] {
  const normalized = tags.map((tag) => tag.toLowerCase());
  const overlays: PlanetSpriteOverlay[] = [];

  if (normalized.some((tag) => tag.includes('ringed'))) {
    overlays.push({
      type: 'ring',
      spritePath: pickSpriteFromCategory('Rings', 'rings-overlay'),
    });
  }

  if (normalized.some((tag) => tag.includes('black hole'))) {
    overlays.push({
      type: 'blackhole',
      spritePath: pickSpriteFromCategory('Black_holes', 'black-hole-overlay'),
    });
  }

  return overlays;
}

interface SpriteCategoryContext {
  atmosphere: AtmosphereType;
  temperature: TemperatureType;
  biosphere: BiosphereType;
  tags: string[];
}

/**
 * Determine the sprite category for a world.
 * Exported for potential reuse in UI logic when the category itself matters.
 */
export function determineSpriteCategory({
  atmosphere,
  temperature,
  biosphere,
  tags,
}: SpriteCategoryContext): PlanetSpriteCategory {
  const normalizedTags = tags.map((tag) => tag.toLowerCase());

  // Tag-driven overrides (users may add bespoke lore-specific tags)
  if (normalizedTags.some((tag) => tag.includes('black hole'))) {
    return 'Black_holes';
  }
  if (normalizedTags.some((tag) => tag.includes('ringed'))) {
    return 'Rings';
  }
  if (
    normalizedTags.some(
      (tag) =>
        tag.includes('ocean') ||
        tag.includes('water world') ||
        tag.includes('water-world'),
    )
  ) {
    return 'Ocean';
  }
  if (normalizedTags.some((tag) => tag.includes('desert'))) {
    return 'Desert_or_Martian';
  }
  if (
    normalizedTags.some(
      (tag) =>
        tag.includes('jungle') ||
        tag.includes('forest') ||
        tag.includes('swamp'),
    )
  ) {
    return 'Forest_or_Jungle_or_Swamp';
  }
  if (normalizedTags.some((tag) => tag.includes('lava') || tag.includes('volcan'))) {
    return 'Lava';
  }
  if (normalizedTags.some((tag) => tag.includes('tundra'))) {
    return 'Tundra';
  }
  if (normalizedTags.some((tag) => tag.includes('ice'))) {
    return 'Ice_or_Snow';
  }
  if (normalizedTags.some((tag) => tag.includes('gas giant'))) {
    return 'Gas_Giant_or_Toxic';
  }

  // Atmosphere-driven mapping (handle Thick first per requirements)
  if (atmosphere === 'Thick') {
    return COLD_TEMPERATURES.has(temperature) ? 'Tundra' : 'Ocean';
  }

  // Temperature-driven categories
  if (temperature === 'Burning') {
    return 'Lava';
  }
  if (COLD_TEMPERATURES.has(temperature)) {
    return 'Ice_or_Snow';
  }

  // Remaining atmosphere mapping
  switch (atmosphere) {
    case 'Breathable':
      return 'Terran_or_Earth-like';
    case 'Corrosive':
    case 'Exotic':
      return 'Gas_Giant_or_Toxic';
    case 'Inert':
    case 'Airless':
      return 'Barren_or_Moon';
    case 'Thin':
      if (WARM_TEMPERATURES.has(temperature) && biosphere === 'None') {
        return 'Desert_or_Martian';
      }
      // Allow thin-but-mild worlds to fall back to generic rocky sprites
      break;
    default:
      break;
  }

  // Biosphere heuristics for more varied results
  if (
    biosphere === 'Human-miscible' &&
    (temperature === 'Temperate' || temperature === 'Variable Warm')
  ) {
    return 'Terran_or_Earth-like';
  }

  if (
    biosphere === 'None' ||
    biosphere === 'Remnant' ||
    biosphere === 'Microbial'
  ) {
    if (WARM_TEMPERATURES.has(temperature)) {
      return 'Desert_or_Martian';
    }
    return 'Barren_or_Moon';
  }

  // Final fallback
  return FALLBACK_CATEGORY;
}

function pickSpriteFromCategory(
  category: PlanetSpriteCategory,
  seed: string,
): string {
  const sprites = planetSpriteManifest[category];

  if (sprites && sprites.length > 0) {
    const index = Math.abs(hashString(seed)) % sprites.length;
    return sprites[index];
  }

  // If the requested category has no sprites, fall back recursively
  if (category !== FALLBACK_CATEGORY) {
    return pickSpriteFromCategory(FALLBACK_CATEGORY, seed);
  }

  throw new Error('No sprites available for fallback category.');
}

function buildSeed(
  explicitSeed: string | undefined,
  context: SpriteCategoryContext,
): string {
  if (explicitSeed) {
    return explicitSeed;
  }

  return [
    context.atmosphere,
    context.temperature,
    context.biosphere,
    ...context.tags,
  ].join('|');
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export { FALLBACK_CATEGORY as PLANET_SPRITE_FALLBACK_CATEGORY };

