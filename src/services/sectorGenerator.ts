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

const Hex = defineHex({ dimensions: 30 });

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStarCoordinates(count: number): Coordinates[] {
  const grid = new Grid(Hex, rectangle({ width: GRID_WIDTH, height: GRID_HEIGHT }));
  const allHexes = Array.from(grid);
  const coordinates: Coordinates[] = [];
  const usedCoords = new Set<string>();
  const shuffledHexes = [...allHexes].sort(() => Math.random() - 0.5);
  for (const hex of shuffledHexes) {
    if (coordinates.length >= count) break;
    const key = `${hex.col},${hex.row}`;
    if (!usedCoords.has(key)) {
      coordinates.push({ x: hex.col, y: hex.row });
      usedCoords.add(key);
    }
  }
  return coordinates;
}

function hexDistance(coord1: Coordinates, coord2: Coordinates): number {
  const q1 = coord1.x;
  const r1 = coord1.y - Math.floor((coord1.x - (coord1.x & 1)) / 2);
  const s1 = -q1 - r1;
  const q2 = coord2.x;
  const r2 = coord2.y - Math.floor((coord2.x - (coord2.x & 1)) / 2);
  const s2 = -q2 - r2;
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(s1 - s2)) / 2;
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
 * 1. Generate star system coordinates
 * 2. Generate realistic worlds with interconnected traits
 * 3. Generate spike drive routes (connectivity backbone)
 * 4. Generate trade routes based on economic factors
 */
export function generateSector(): Sector {
  const systemCount = randomInt(MIN_SYSTEMS, MAX_SYSTEMS);
  const coordinates = generateStarCoordinates(systemCount);
  
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
