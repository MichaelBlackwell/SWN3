/**
 * Auto-generated manifest for landscapes.
 * Generated on 2025-11-24T20:48:19.965Z
 */
export const landscapesManifest = {
  "Arctic": [
    "/assets/landscapes/Arctic/1.png"
  ],
  "Barren": [
    "/assets/landscapes/Barren/1.png",
    "/assets/landscapes/Barren/2.png",
    "/assets/landscapes/Barren/3.png",
    "/assets/landscapes/Barren/4.png"
  ],
  "Desert": [
    "/assets/landscapes/Desert/1.png",
    "/assets/landscapes/Desert/2.png"
  ],
  "Forest": [
    "/assets/landscapes/Forest/1.png",
    "/assets/landscapes/Forest/2.png"
  ],
  "Gas_giant_rings": [
    "/assets/landscapes/Gas_giant_rings/1.png",
    "/assets/landscapes/Gas_giant_rings/2.png",
    "/assets/landscapes/Gas_giant_rings/3.png",
    "/assets/landscapes/Gas_giant_rings/4.png"
  ],
  "Lava": [
    "/assets/landscapes/Lava/1.png",
    "/assets/landscapes/Lava/2.png"
  ],
  "Ocean": [
    "/assets/landscapes/Ocean/1.png"
  ],
  "Terran": [
    "/assets/landscapes/Terran/1.png",
    "/assets/landscapes/Terran/2.png"
  ],
  "Tundra": [
    "/assets/landscapes/Tundra/1.png"
  ]
} as const;

export type LandscapeCategory = keyof typeof landscapesManifest;

export const landscapeCategories = Object.keys(landscapesManifest) as LandscapeCategory[];

export function getLandscapePaths(category: LandscapeCategory) {
  return landscapesManifest[category];
}
