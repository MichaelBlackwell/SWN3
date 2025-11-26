import type { Faction } from '../types/faction';

/**
 * Faction color management utilities.
 *
 * Requirements:
 * - Each faction should have a distinct color.
 * - Colors should avoid clashing with commonly used attribute colors
 *   (Force #dc2626, Cunning #9333ea, Wealth #eab308).
 */

const GOLDEN_ANGLE = 137.508;
const MIN_HUE_DISTANCE = 22;
const COLOR_SATURATION = 68;
const COLOR_LIGHTNESS = 52;
const RESERVED_COLOR_HEX = ['#dc2626', '#9333ea', '#eab308'];

const factionColorRegistry = new Map<string, string>();
const RESERVED_HUES = RESERVED_COLOR_HEX.map((hex) => colorStringToHue(hex)).filter(
  (hue): hue is number => hue !== null
);

/**
 * Assign colors to a batch of factions, ensuring uniqueness and avoiding reserved hues.
 * Does not mutate the original array, but may reuse faction object references.
 */
export function assignColorsToFactions(factions: Faction[]): Faction[] {
  const usedHues = [...RESERVED_HUES];
  return factions.map((faction) => ensureColorWithUsedHues(faction, usedHues));
}

/**
 * Ensure a single faction has a valid color relative to existing factions.
 */
export function assignColorToFaction(faction: Faction, existingFactions: Faction[]): Faction {
  const usedHues = getUsedHuesFromFactions(existingFactions);
  return ensureColorWithUsedHues(faction, usedHues);
}

/**
 * Remove a faction's color mapping (e.g., when the faction is deleted).
 */
export function removeFactionColor(factionId: string): void {
  factionColorRegistry.delete(factionId);
}

/**
 * Clear all stored faction colors. Useful when wiping game state.
 */
export function clearFactionColorRegistry(): void {
  factionColorRegistry.clear();
}

/**
 * Retrieve the registered color for a faction. If none exists, generate one on the fly.
 */
export function getFactionColor(factionId: string): string {
  const existing = factionColorRegistry.get(factionId);
  if (existing) {
    return existing;
  }

  const usedHues = getUsedHuesFromRegistry();
  const hue = generateDistinctHue(factionId, usedHues);
  const color = hslFromHue(hue);
  factionColorRegistry.set(factionId, color);
  return color;
}

/**
 * Gets assets grouped by system ID
 * Returns a map of systemId -> array of { factionId, assetCount, factionName }
 */
export function getAssetsBySystem(
  factions: Array<{ id: string; name: string; assets: Array<{ location: string }> }>
): Map<string, Array<{ factionId: string; assetCount: number; factionName: string }>> {
  const assetsBySystem = new Map<string, Array<{ factionId: string; assetCount: number; factionName: string }>>();

  factions.forEach((faction) => {
    // Count assets per system for this faction
    const systemAssetCounts = new Map<string, number>();
    
    faction.assets.forEach((asset) => {
      const count = systemAssetCounts.get(asset.location) || 0;
      systemAssetCounts.set(asset.location, count + 1);
    });

    // Add to the main map
    systemAssetCounts.forEach((count, systemId) => {
      if (!assetsBySystem.has(systemId)) {
        assetsBySystem.set(systemId, []);
      }
      assetsBySystem.get(systemId)!.push({
        factionId: faction.id,
        assetCount: count,
        factionName: faction.name,
      });
    });
  });

  return assetsBySystem;
}

/**
 * Gets the homeworld system ID for a given faction
 */
export function getHomeworldForFaction(
  factionId: string,
  factions: Array<{ id: string; homeworld: string }>
): string | null {
  const faction = factions.find((f) => f.id === factionId);
  return faction?.homeworld || null;
}

/**
 * Gets all factions that have a given system as their homeworld
 */
export function getFactionsWithHomeworld(
  systemId: string,
  factions: Array<{ id: string; name: string; homeworld: string }>
): Array<{ id: string; name: string }> {
  return factions
    .filter((f) => f.homeworld === systemId)
    .map((f) => ({ id: f.id, name: f.name }));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureColorWithUsedHues(faction: Faction, usedHues: number[]): Faction {
  const existingHue = colorStringToHue(faction.color);

  if (faction.color && existingHue !== null && isHueAllowed(existingHue, usedHues)) {
    factionColorRegistry.set(faction.id, faction.color);
    usedHues.push(existingHue);
    return faction;
  }

  const hue = generateDistinctHue(faction.id, usedHues);
  const color = hslFromHue(hue);
  factionColorRegistry.set(faction.id, color);
  usedHues.push(hue);
  return { ...faction, color };
}

function getUsedHuesFromFactions(factions: Faction[]): number[] {
  const hues = [...RESERVED_HUES];
  factions.forEach((faction) => {
    const hue = colorStringToHue(faction.color);
    if (hue !== null) {
      hues.push(hue);
    }
  });
  return hues;
}

function getUsedHuesFromRegistry(): number[] {
  const hues = [...RESERVED_HUES];
  factionColorRegistry.forEach((color) => {
    const hue = colorStringToHue(color);
    if (hue !== null) {
      hues.push(hue);
    }
  });
  return hues;
}

function generateDistinctHue(seed: string, usedHues: number[]): number {
  const base = ((Math.abs(hashString(seed)) % 360) + 360) % 360;

  for (let attempt = 0; attempt < 720; attempt += 1) {
    const hue = (base + attempt * GOLDEN_ANGLE) % 360;
    if (isHueAllowed(hue, usedHues)) {
      return hue;
    }
  }

  // Fallback if we somehow can't find a hue with spacing
  return (base + 90) % 360;
}

function hslFromHue(hue: number): string {
  const normalizedHue = ((Math.round(hue) % 360) + 360) % 360;
  return `hsl(${normalizedHue}, ${COLOR_SATURATION}%, ${COLOR_LIGHTNESS}%)`;
}

function isHueAllowed(hue: number, usedHues: number[]): boolean {
  return usedHues.every((usedHue) => hueDistance(hue, usedHue) >= MIN_HUE_DISTANCE);
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function colorStringToHue(color?: string | null): number | null {
  if (!color) return null;

  const trimmed = color.trim().toLowerCase();

  if (trimmed.startsWith('hsl')) {
    const match = trimmed.match(/hsl\(\s*([-\d.]+)/);
    if (match) {
      return ((parseFloat(match[1]) % 360) + 360) % 360;
    }
    return null;
  }

  if (trimmed.startsWith('#')) {
    return hexToHue(trimmed);
  }

  return null;
}

function hexToHue(hex: string): number | null {
  const sanitized = hex.replace('#', '');
  if (![3, 6].includes(sanitized.length)) {
    return null;
  }

  const normalized =
    sanitized.length === 3
      ? sanitized
          .split('')
          .map((char) => char + char)
          .join('')
      : sanitized;

  const r = parseInt(normalized.substring(0, 2), 16) / 255;
  const g = parseInt(normalized.substring(2, 4), 16) / 255;
  const b = parseInt(normalized.substring(4, 6), 16) / 255;

  return rgbToHue(r, g, b);
}

function rgbToHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  let hue: number;
  switch (max) {
    case r:
      hue = ((g - b) / delta) % 6;
      break;
    case g:
      hue = (b - r) / delta + 2;
      break;
    default:
      hue = (r - g) / delta + 4;
      break;
  }

  return ((hue * 60 + 360) % 360);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return hash;
}


