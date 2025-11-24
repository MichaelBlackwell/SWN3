import type { StarSystem } from '../types/sector';

/**
 * Get valid movement destinations for an asset at a given location.
 * Valid destinations include:
 * 1. Systems connected via routes from the current location
 * 2. Systems that are adjacent (one hex coordinate away)
 * 
 * @param currentLocationId - The ID of the system where the asset is currently located
 * @param systems - Array of all systems in the sector
 * @returns Array of system IDs that are valid movement destinations
 */
export function getValidMovementDestinations(
  currentLocationId: string,
  systems: StarSystem[]
): string[] {
  const currentSystem = systems.find((s) => s.id === currentLocationId);
  if (!currentSystem) {
    return [];
  }

  const validDestinations = new Set<string>();

  // 1. Add systems connected via routes
  currentSystem.routes.forEach((route) => {
    validDestinations.add(route.systemId);
  });

  // 2. Add adjacent systems (one hex coordinate away)
  // In a hex grid, adjacent hexes can be at these offsets:
  // For pointy-top hexes: (0, -1), (1, -1), (1, 0), (0, 1), (-1, 1), (-1, 0)
  const adjacentOffsets = [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
  ];

  adjacentOffsets.forEach((offset) => {
    const adjacentX = currentSystem.coordinates.x + offset.x;
    const adjacentY = currentSystem.coordinates.y + offset.y;

    const adjacentSystem = systems.find(
      (s) =>
        s.coordinates.x === adjacentX && s.coordinates.y === adjacentY
    );

    if (adjacentSystem) {
      validDestinations.add(adjacentSystem.id);
    }
  });

  return Array.from(validDestinations);
}




