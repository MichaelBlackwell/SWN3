import { landscapesManifest, type LandscapeCategory } from '../data/landscapesManifest';
import type { PlanetSpriteCategory } from '../data/planetsManifest';

interface LandscapeOptions {
  seed?: string;
}

export interface LandscapeResult {
  category: LandscapeCategory;
  imagePath: string;
}

const CATEGORY_MAP: Partial<Record<PlanetSpriteCategory, LandscapeCategory>> = {
  'Terran_or_Earth-like': 'Terran',
  Ocean: 'Ocean',
  Lava: 'Lava',
  'Desert_or_Martian': 'Desert',
  'Forest_or_Jungle_or_Swamp': 'Forest',
  Tundra: 'Tundra',
  'Ice_or_Snow': 'Arctic',
  'Barren_or_Moon': 'Barren',
  Rings: 'Gas_giant_rings',
  'Gas_Giant_or_Toxic': 'Gas_giant_rings',
};

const FALLBACK_CATEGORY: LandscapeCategory = 'Terran';

export function getLandscapeSprite(
  planetCategory: PlanetSpriteCategory,
  options?: LandscapeOptions,
): LandscapeResult {
  const landscapeCategory = CATEGORY_MAP[planetCategory] ?? FALLBACK_CATEGORY;
  const paths = landscapesManifest[landscapeCategory] ?? landscapesManifest[FALLBACK_CATEGORY];
  const pathList = [...paths];

  if (pathList.length === 0) {
    throw new Error('No landscape assets available.');
  }

  const seed = options?.seed ?? planetCategory;
  const index = Math.abs(hashString(seed)) % pathList.length;

  return {
    category: landscapeCategory,
    imagePath: pathList[index],
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

