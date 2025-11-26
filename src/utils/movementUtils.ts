import type { StarSystem } from '../types/sector';

interface QueueNode {
  id: string;
  distance: number;
}

const ADJACENT_OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
];

/**
 * Get valid movement destinations for an asset at a given location.
 * Valid destinations include any systems reachable within the specified range
 * by traversing route connections or adjacent hexes.
 *
 * @param currentLocationId - The ID of the system where the asset is currently located
 * @param systems - Array of all systems in the sector
 * @param range - Number of steps the asset can travel (default: 1)
 * @returns Array of system IDs that are valid movement destinations
 */
export function getValidMovementDestinations(
  currentLocationId: string,
  systems: StarSystem[],
  range = 1
): string[] {
  if (range < 1) range = 1;

  const systemMap = new Map<string, StarSystem>();
  systems.forEach((system) => {
    systemMap.set(system.id, system);
  });

  const startSystem = systemMap.get(currentLocationId);
  if (!startSystem) {
    return [];
  }

  const visited = new Set<string>([currentLocationId]);
  const results = new Set<string>();
  const queue: QueueNode[] = [{ id: currentLocationId, distance: 0 }];

  while (queue.length > 0) {
    const { id, distance } = queue.shift() as QueueNode;
    if (distance === range) continue;

    const system = systemMap.get(id);
    if (!system) continue;

    const neighbors = new Set<string>();

    // Route-connected systems
    system.routes.forEach((route) => {
      neighbors.add(route.systemId);
    });

    // Adjacent hexes
    ADJACENT_OFFSETS.forEach((offset) => {
      const adjacentX = system.coordinates.x + offset.x;
      const adjacentY = system.coordinates.y + offset.y;
      const adjacentSystem = systems.find(
        (s) => s.coordinates.x === adjacentX && s.coordinates.y === adjacentY
      );
      if (adjacentSystem) {
        neighbors.add(adjacentSystem.id);
      }
    });

    neighbors.forEach((neighborId) => {
      if (visited.has(neighborId)) return;

      visited.add(neighborId);
      results.add(neighborId);
      queue.push({ id: neighborId, distance: distance + 1 });
    });
  }

  results.delete(currentLocationId);
  return Array.from(results);
}













