/**
 * Utility functions for generating consistent faction colors
 * Uses a deterministic hash-based approach to assign colors to factions
 */

/**
 * Generates a deterministic color from a string (faction ID or name)
 * Returns a vibrant, readable color suitable for UI elements
 */
export function getFactionColor(factionId: string): string {
  // Simple hash function for deterministic color generation
  let hash = 0;
  for (let i = 0; i < factionId.length; i++) {
    hash = factionId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate HSL color with good saturation and lightness for visibility
  const hue = Math.abs(hash) % 360;
  const saturation = 65 + (Math.abs(hash) % 20); // 65-85% saturation
  const lightness = 45 + (Math.abs(hash) % 15); // 45-60% lightness

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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




