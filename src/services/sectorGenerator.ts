import { faker } from '@faker-js/faker';
import { defineHex, Grid, rectangle } from 'honeycomb-grid';
import type {
  Sector,
  StarSystem,
  Coordinates,
} from '../types/sector';
import { generatePrimaryWorld } from './worldGenerator';
import { generateTradeRoutes } from './tradeRouteGenerator';

const GRID_WIDTH = 8;
const GRID_HEIGHT = 10;
const MIN_SYSTEMS = 21;
const MAX_SYSTEMS = 30;
const MAX_CONNECTIONS_PER_SYSTEM = 4;
const MAX_SPIKE_DRIVE_RANGE = 3;

// New constraints
const MAX_SYSTEM_NEIGHBORS = 3; // Maximum number of adjacent hexes that can contain systems
const MAX_DISTANCE_TO_SYSTEM = 3; // Every hex must be within this distance of a system

const Hex = defineHex({ dimensions: 30 });

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate hex distance using cube coordinates
 */
function hexDistance(coord1: Coordinates, coord2: Coordinates): number {
  // Convert offset coordinates to cube coordinates
  const q1 = coord1.x;
  const r1 = coord1.y - Math.floor((coord1.x - (coord1.x & 1)) / 2);
  const s1 = -q1 - r1;
  const q2 = coord2.x;
  const r2 = coord2.y - Math.floor((coord2.x - (coord2.x & 1)) / 2);
  const s2 = -q2 - r2;
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(s1 - s2)) / 2;
}

/**
 * Get all 6 neighboring hex coordinates for a given hex (offset coordinates, odd-q layout)
 */
function getNeighbors(coord: Coordinates): Coordinates[] {
  const { x, y } = coord;
  const isOddColumn = x & 1;
  
  // Neighbor offsets for odd-q offset coordinates
  const neighbors: Coordinates[] = isOddColumn
    ? [
        { x: x + 1, y: y },     // East
        { x: x + 1, y: y + 1 }, // Southeast
        { x: x, y: y + 1 },     // South-ish (down)
        { x: x - 1, y: y + 1 }, // Southwest
        { x: x - 1, y: y },     // West
        { x: x, y: y - 1 },     // North-ish (up)
      ]
    : [
        { x: x + 1, y: y - 1 }, // Northeast
        { x: x + 1, y: y },     // East-ish
        { x: x, y: y + 1 },     // South-ish (down)
        { x: x - 1, y: y },     // West-ish
        { x: x - 1, y: y - 1 }, // Northwest
        { x: x, y: y - 1 },     // North-ish (up)
      ];

  // Filter to only valid grid coordinates
  return neighbors.filter(
    (n) => n.x >= 0 && n.x < GRID_WIDTH && n.y >= 0 && n.y < GRID_HEIGHT
  );
}

/**
 * Count how many neighboring hexes contain systems
 */
function countSystemNeighbors(
  coord: Coordinates,
  systemCoords: Set<string>
): number {
  const neighbors = getNeighbors(coord);
  return neighbors.filter((n) => systemCoords.has(`${n.x},${n.y}`)).length;
}

/**
 * Check if placing a system at coord would violate the max neighbors constraint
 * for the new system OR any of its neighbors
 */
function isValidPlacement(
  coord: Coordinates,
  systemCoords: Set<string>
): boolean {
  const key = `${coord.x},${coord.y}`;
  
  // Can't place where there's already a system
  if (systemCoords.has(key)) {
    return false;
  }

  // Check how many system neighbors this position would have
  const newSystemNeighborCount = countSystemNeighbors(coord, systemCoords);
  if (newSystemNeighborCount > MAX_SYSTEM_NEIGHBORS) {
    return false;
  }

  // Check if adding this system would push any existing neighbor over the limit
  const neighbors = getNeighbors(coord);
  for (const neighbor of neighbors) {
    const neighborKey = `${neighbor.x},${neighbor.y}`;
    if (systemCoords.has(neighborKey)) {
      // This neighbor is a system - check if adding us would exceed its limit
      const neighborCurrentCount = countSystemNeighbors(neighbor, systemCoords);
      if (neighborCurrentCount >= MAX_SYSTEM_NEIGHBORS) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Find the minimum distance from a hex to any system
 */
function minDistanceToSystem(
  coord: Coordinates,
  systemCoords: Coordinates[]
): number {
  if (systemCoords.length === 0) return Infinity;
  
  let minDist = Infinity;
  for (const sysCoord of systemCoords) {
    const dist = hexDistance(coord, sysCoord);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

/**
 * Get all hexes in the grid
 */
function getAllHexCoords(): Coordinates[] {
  const grid = new Grid(Hex, rectangle({ width: GRID_WIDTH, height: GRID_HEIGHT }));
  return Array.from(grid).map((hex) => ({ x: hex.col, y: hex.row }));
}

/**
 * Find hexes that are farther than MAX_DISTANCE_TO_SYSTEM from any system
 */
function findUncoveredHexes(
  allHexes: Coordinates[],
  systemCoords: Coordinates[]
): Coordinates[] {
  return allHexes.filter(
    (hex) => minDistanceToSystem(hex, systemCoords) > MAX_DISTANCE_TO_SYSTEM
  );
}

/**
 * Calculate a score for a potential placement position
 * Higher score = better position
 */
function scorePlacement(
  coord: Coordinates,
  systemCoords: Coordinates[],
  uncoveredHexes: Coordinates[]
): number {
  let score = 0;
  
  // Bonus for covering uncovered hexes
  const coveredCount = uncoveredHexes.filter(
    (hex) => hexDistance(coord, hex) <= MAX_DISTANCE_TO_SYSTEM
  ).length;
  score += coveredCount * 10;
  
  // Slight penalty for having many system neighbors (prefer spread out)
  const systemCoordsSet = new Set(systemCoords.map((c) => `${c.x},${c.y}`));
  const neighborCount = countSystemNeighbors(coord, systemCoordsSet);
  score -= neighborCount * 2;
  
  // Small random factor for variety
  score += Math.random() * 3;
  
  return score;
}

/**
 * Generate star system coordinates with constraints:
 * 1. Every hex must be within MAX_DISTANCE_TO_SYSTEM of a system
 * 2. No system can have more than MAX_SYSTEM_NEIGHBORS adjacent systems
 */
function generateConstrainedStarCoordinates(targetCount: number): Coordinates[] {
  const allHexes = getAllHexCoords();
  const coordinates: Coordinates[] = [];
  const usedCoords = new Set<string>();
  
  // Start with seed positions spread across the grid to ensure coverage
  const seedPositions = [
    { x: 1, y: 1 },
    { x: 6, y: 1 },
    { x: 1, y: 8 },
    { x: 6, y: 8 },
    { x: 3, y: 4 },
    { x: 4, y: 5 },
  ];
  
  // Place initial seeds
  for (const seed of seedPositions) {
    if (coordinates.length >= targetCount) break;
    if (seed.x < GRID_WIDTH && seed.y < GRID_HEIGHT) {
      const key = `${seed.x},${seed.y}`;
      if (!usedCoords.has(key) && isValidPlacement(seed, usedCoords)) {
        coordinates.push(seed);
        usedCoords.add(key);
      }
    }
  }
  
  // Phase 1: Ensure coverage - place systems to cover all uncovered hexes
  let iterations = 0;
  const maxIterations = 500;
  
  while (iterations < maxIterations) {
    iterations++;
    
    const uncovered = findUncoveredHexes(allHexes, coordinates);
    
    // If all hexes are covered and we have enough systems, we're done
    if (uncovered.length === 0 && coordinates.length >= targetCount) {
      break;
    }
    
    // Find valid placement candidates
    const candidates: Array<{ coord: Coordinates; score: number }> = [];
    
    for (const hex of allHexes) {
      if (isValidPlacement(hex, usedCoords)) {
        const score = scorePlacement(hex, coordinates, uncovered);
        candidates.push({ coord: hex, score });
      }
    }
    
    if (candidates.length === 0) {
      // No valid placements left - we've done the best we can
      console.warn('No more valid placements available');
      break;
    }
    
    // Sort by score and pick from top candidates
    candidates.sort((a, b) => b.score - a.score);
    
    // Pick from top 3 with some randomness
    const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
    const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    
    coordinates.push(chosen.coord);
    usedCoords.add(`${chosen.coord.x},${chosen.coord.y}`);
  }
  
  // Phase 2: Add more systems if we need them and haven't reached target
  while (coordinates.length < targetCount) {
    const candidates: Coordinates[] = [];
    
    for (const hex of allHexes) {
      if (isValidPlacement(hex, usedCoords)) {
        candidates.push(hex);
      }
    }
    
    if (candidates.length === 0) {
      console.warn(`Could only place ${coordinates.length} systems (target: ${targetCount})`);
      break;
    }
    
    // Pick a random valid candidate
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    coordinates.push(chosen);
    usedCoords.add(`${chosen.x},${chosen.y}`);
  }
  
  // Verify constraints (debug logging)
  const finalUncovered = findUncoveredHexes(allHexes, coordinates);
  if (finalUncovered.length > 0) {
    console.warn(`${finalUncovered.length} hexes are more than ${MAX_DISTANCE_TO_SYSTEM} from any system`);
  }
  
  return coordinates;
}

interface Edge {
  from: string;
  to: string;
  distance: number;
}

/**
 * Generate spike drive routes (connectivity backbone)
 * Trade routes will be determined separately based on economic factors
 */
function generateSpikeRoutes(systems: StarSystem[]): void {
  // Initialize empty route arrays
  for (const system of systems) {
    system.routes = [];
  }
  
  // Build list of all possible edges within spike drive range
  const edges: Edge[] = [];
  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      const distance = hexDistance(systems[i].coordinates, systems[j].coordinates);
      if (distance <= MAX_SPIKE_DRIVE_RANGE) {
        edges.push({ from: systems[i].id, to: systems[j].id, distance });
      }
    }
  }
  
  // Sort edges by distance (shortest first for minimum spanning tree)
  edges.sort((a, b) => a.distance - b.distance);
  
  // Track connections per system
  const connectionCounts = new Map<string, number>();
  systems.forEach((s) => connectionCounts.set(s.id, 0));
  
  const systemMap = new Map<string, StarSystem>();
  systems.forEach((s) => systemMap.set(s.id, s));
  
  // Union-Find for detecting cycles
  const parent = new Map<string, string>();
  systems.forEach((s) => parent.set(s.id, s.id));
  
  function findRoot(id: string): string {
    if (parent.get(id) !== id) {
      parent.set(id, findRoot(parent.get(id)!));
    }
    return parent.get(id)!;
  }
  
  function union(id1: string, id2: string): boolean {
    const root1 = findRoot(id1);
    const root2 = findRoot(id2);
    if (root1 === root2) return false;
    parent.set(root1, root2);
    return true;
  }
  
  // Phase 1: Build minimum spanning tree (ensures connectivity)
  for (const edge of edges) {
    const fromCount = connectionCounts.get(edge.from)!;
    const toCount = connectionCounts.get(edge.to)!;
    
    if (fromCount < MAX_CONNECTIONS_PER_SYSTEM && 
        toCount < MAX_CONNECTIONS_PER_SYSTEM && 
        union(edge.from, edge.to)) {
      const fromSystem = systemMap.get(edge.from)!;
      const toSystem = systemMap.get(edge.to)!;
      
      fromSystem.routes.push({ systemId: edge.to, isTradeRoute: false });
      toSystem.routes.push({ systemId: edge.from, isTradeRoute: false });
      
      connectionCounts.set(edge.from, fromCount + 1);
      connectionCounts.set(edge.to, toCount + 1);
    }
  }
  
  // Phase 2: Add additional routes for redundancy (randomly)
  const remainingEdges = edges.filter((e) => {
    const fromSystem = systemMap.get(e.from)!;
    return !fromSystem.routes.some((r) => r.systemId === e.to);
  }).sort(() => Math.random() - 0.5);
  
  for (const edge of remainingEdges) {
    const fromCount = connectionCounts.get(edge.from)!;
    const toCount = connectionCounts.get(edge.to)!;
    
    if (fromCount < MAX_CONNECTIONS_PER_SYSTEM && toCount < MAX_CONNECTIONS_PER_SYSTEM) {
      const fromSystem = systemMap.get(edge.from)!;
      const toSystem = systemMap.get(edge.to)!;
      
      fromSystem.routes.push({ systemId: edge.to, isTradeRoute: false });
      toSystem.routes.push({ systemId: edge.from, isTradeRoute: false });
      
      connectionCounts.set(edge.from, fromCount + 1);
      connectionCounts.set(edge.to, toCount + 1);
    }
  }
  
  // Phase 3: Ensure all systems are connected (handle edge cases)
  ensureFullConnectivity(systems, systemMap, connectionCounts);
}

/**
 * Ensure all systems are reachable (connect isolated systems)
 */
function ensureFullConnectivity(
  systems: StarSystem[],
  systemMap: Map<string, StarSystem>,
  connectionCounts: Map<string, number>
): void {
  const visited = new Set<string>();
  const queue: string[] = [];
  
  if (systems.length > 0) {
    queue.push(systems[0].id);
    visited.add(systems[0].id);
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentSystem = systemMap.get(currentId);
      if (!currentSystem) continue;
      
      for (const route of currentSystem.routes) {
        if (!visited.has(route.systemId)) {
          visited.add(route.systemId);
          queue.push(route.systemId);
        }
      }
    }
  }
  
  // Connect any isolated systems
  for (const system of systems) {
    if (!visited.has(system.id)) {
      let nearestDistance = Infinity;
      let nearestSystem: StarSystem | null = null;
      
      for (const otherSystem of systems) {
        if (visited.has(otherSystem.id)) {
          const distance = hexDistance(system.coordinates, otherSystem.coordinates);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestSystem = otherSystem;
          }
        }
      }
      
      if (nearestSystem) {
        const fromCount = connectionCounts.get(system.id)!;
        const toCount = connectionCounts.get(nearestSystem.id)!;
        
        if (fromCount < MAX_CONNECTIONS_PER_SYSTEM && toCount < MAX_CONNECTIONS_PER_SYSTEM) {
          system.routes.push({ systemId: nearestSystem.id, isTradeRoute: false });
          nearestSystem.routes.push({ systemId: system.id, isTradeRoute: false });
          visited.add(system.id);
        }
      }
    }
  }
}

/**
 * Generate a complete sector with realistic worlds and trade routes
 * 
 * Generation Process:
 * 1. Generate star system coordinates with constraints
 * 2. Generate realistic worlds with interconnected traits
 * 3. Generate spike drive routes (connectivity backbone)
 * 4. Generate trade routes based on economic factors
 * 
 * Constraints enforced:
 * - Every hex on the map is within 3 hexes of a system
 * - No system has more than 3 neighboring hexes containing systems
 */
export function generateSector(): Sector {
  const systemCount = randomInt(MIN_SYSTEMS, MAX_SYSTEMS);
  const coordinates = generateConstrainedStarCoordinates(systemCount);
  
  // Generate systems with realistic worlds
  const systems: StarSystem[] = coordinates.map((coord, index) => {
    const systemId = `system-${index + 1}`;
    return {
      id: systemId,
      name: faker.location.city() + ' System',
      coordinates: coord,
      primaryWorld: generatePrimaryWorld(), // Now uses the new intelligent generator
      secondaryWorlds: [],
      pointsOfInterest: [],
      routes: [],
    };
  });
  
  // Generate spike drive routes (physical connectivity)
  generateSpikeRoutes(systems);
  
  // Generate trade routes (economic connectivity based on world traits)
  generateTradeRoutes(systems);
  
  const sector: Sector = {
    id: faker.string.uuid(),
    name: faker.location.city() + ' Sector',
    created: Date.now(),
    systems,
  };
  
  return sector;
}
