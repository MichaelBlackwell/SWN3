import { describe, expect, it } from 'vitest';

import { getPlanetSprite, determineSpriteCategory } from './planetSpriteMapping';

describe('planetSpriteMapping', () => {
  it('maps breathable atmospheres to Terran sprites', () => {
    const result = getPlanetSprite('Breathable', 'Temperate', 'Human-miscible', []);
    expect(result.category).toBe('Terran_or_Earth-like');
    expect(result.spritePath.startsWith('/assets/planets/Terran_or_Earth-like/')).toBe(true);
  });

  it('uses ice sprites for frozen worlds', () => {
    const result = getPlanetSprite('Thin', 'Frozen', 'Immiscible', []);
    expect(result.category).toBe('Ice_or_Snow');
    expect(result.spritePath.startsWith('/assets/planets/Ice_or_Snow/')).toBe(true);
  });

  it('uses lava sprites for burning worlds', () => {
    const result = getPlanetSprite('Breathable', 'Burning', 'Immiscible', []);
    expect(result.category).toBe('Lava');
    expect(result.spritePath.startsWith('/assets/planets/Lava/')).toBe(true);
  });

  it('maps corrosive atmospheres to gas giant sprites', () => {
    const result = getPlanetSprite('Corrosive', 'Variable Warm', 'None', []);
    expect(result.category).toBe('Gas_Giant_or_Toxic');
    expect(result.spritePath.startsWith('/assets/planets/Gas_Giant_or_Toxic/')).toBe(true);
  });

  it('maps inert atmospheres to barren sprites', () => {
    const result = getPlanetSprite('Inert', 'Temperate', 'Microbial', []);
    expect(result.category).toBe('Barren_or_Moon');
    expect(result.spritePath.startsWith('/assets/planets/Barren_or_Moon/')).toBe(true);
  });

  it('splits thick atmospheres between tundra and ocean', () => {
    const tundra = determineSpriteCategory({
      atmosphere: 'Thick',
      temperature: 'Cold',
      biosphere: 'Immiscible',
      tags: [],
    });
    const ocean = determineSpriteCategory({
      atmosphere: 'Thick',
      temperature: 'Temperate',
      biosphere: 'Human-miscible',
      tags: [],
    });

    expect(tundra).toBe('Tundra');
    expect(ocean).toBe('Ocean');
  });

  it('falls back to default category when no match applies', () => {
    const result = getPlanetSprite('Thin', 'Temperate', 'Hybrid', []);
    expect(result.category).toBe('Rocky');
    expect(result.spritePath.startsWith('/assets/planets/Rocky/')).toBe(true);
  });

  it('returns deterministic sprite paths for identical inputs', () => {
    const first = getPlanetSprite('Breathable', 'Temperate', 'Human-miscible', ['Agricultural']);
    const second = getPlanetSprite('Breathable', 'Temperate', 'Human-miscible', ['Agricultural']);
    expect(first.spritePath).toBe(second.spritePath);
    expect(first.overlays).toEqual(second.overlays);
  });

  it('adds ring overlays for ringed tags', () => {
    const result = getPlanetSprite('Breathable', 'Temperate', 'Human-miscible', ['Ringed World']);
    expect(result.overlays.some((overlay) => overlay.type === 'ring')).toBe(true);
  });

  it('adds black hole overlays for black hole tags', () => {
    const result = getPlanetSprite('Exotic', 'Cold', 'None', ['Black Hole']);
    expect(result.overlays.some((overlay) => overlay.type === 'blackhole')).toBe(true);
  });
});

