import { faker } from '@faker-js/faker';
import { defineHex, Grid, rectangle } from 'honeycomb-grid';
import type {
  Sector,
  StarSystem,
  Coordinates,
  PrimaryWorld,
  AtmosphereType,
  TemperatureType,
  BiosphereType,
} from '../types/sector';

const GRID_WIDTH = 8;
const GRID_HEIGHT = 10;
const MIN_SYSTEMS = 21;
const MAX_SYSTEMS = 30;
const MAX_CONNECTIONS_PER_SYSTEM = 4;
const MAX_SPIKE_DRIVE_RANGE = 3;

const Hex = defineHex({ dimensions: 30 });

const WORLD_TAGS = [
  'Abandoned Colony', 'Alien Ruins', 'Altered Humanity', 'Anarchists', 'Anthropomorphs',
  'Area 51', 'Badlands World', 'Battleground', 'Beastmasters', 'Bubble Cities',
  'Cheap Life', 'Civil War', 'Cold War', 'Colonized Population', 'Cultural Power',
  'Cybercommunists', 'Cyborgs', 'Cyclical Doom', 'Desert World', 'Doomed World',
  'Dying Race', 'Eugenic Cult', 'Exchange Consulate', 'Fallen Hegemon', 'Flying Cities',
  'Forbidden Tech', 'Former Warriors', 'Freak Geology', 'Freak Weather', 'Friendly Foe',
  'Gold Rush', 'Great Work', 'Hatred', 'Heavy Industry', 'Heavy Mining',
  'Hivemind', 'Holy War', 'Hostile Biosphere', 'Hostile Space', 'Immortals',
  'Local Specialty', 'Local Tech', 'Major Spaceyard', 'Mandarinate', 'Mandate Base',
  'Maneaters', 'Megacorps', 'Mercenaries', 'Minimal Contact', 'Misandry/Misogyny',
  'Night World', 'Nomads', 'Oceanic World', 'Out of Contact', 'Outpost World',
  'Perimeter Agency', 'Pilgrimage Site', 'Pleasure World', 'Police State', 'Post-Scarcity',
  'Preceptor Archive', 'Pretech Cultists', 'Primitive Aliens', 'Prison Planet', 'Psionics Academy',
  'Psionics Fear', 'Psionics Worship', 'Quarantined World', 'Radioactive World', 'Refugees',
  'Regional Hegemon', 'Restrictive Laws', 'Revanchists', 'Revolutionaries', 'Rigid Culture',
  'Rising Hegemon', 'Ritual Combat', 'Robots', 'Seagoing Cities', 'Sealed Menace',
  'Secret Masters', 'Sectarians', 'Seismic Instability', 'Shackled World', 'Societal Despair',
  'Sole Supplier', 'Taboo Treasure', 'Terraform Failure', 'Theocracy', 'Tomb World',
  'Trade Hub', 'Tyranny', 'Unbraked AI', 'Urbanized Surface', 'Utopia',
  'Warlords', 'Xenophiles', 'Xenophobes', 'Zombies',
];

const GOVERNMENT_TYPES = [
  'Anarchy', 'Atavism', 'Bureaucracy', 'Clan/Tribal', 'Corporate',
  'Democracy', 'Dictatorship', 'Feudalism', 'Military', 'Monarchy',
  'Oligarchy', 'Plutocracy', 'Theocracy', 'Technocracy', 'AI Control',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roll2d6(): number {
  return randomInt(1, 6) + randomInt(1, 6);
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

function generateAtmosphere(): AtmosphereType {
  const roll = roll2d6();
  if (roll <= 2) return 'Corrosive';
  if (roll <= 4) return 'Inert';
  if (roll <= 5) return 'Airless';
  if (roll <= 8) return 'Breathable';
  if (roll <= 10) return 'Thick';
  if (roll === 11) return 'Thin';
  return 'Exotic';
}

function generateTemperature(): TemperatureType {
  const roll = roll2d6();
  if (roll === 2) return 'Frozen';
  if (roll === 3) return 'Cold';
  if (roll <= 5) return 'Variable Cold';
  if (roll <= 8) return 'Temperate';
  if (roll <= 10) return 'Variable Warm';
  if (roll === 11) return 'Warm';
  return 'Burning';
}

function generateBiosphere(): BiosphereType {
  const roll = roll2d6();
  if (roll === 2) return 'Remnant';
  if (roll === 3) return 'Microbial';
  if (roll <= 5) return 'None';
  if (roll <= 8) return 'Human-miscible';
  if (roll <= 10) return 'Immiscible';
  if (roll === 11) return 'Hybrid';
  return 'Engineered';
}

function generatePopulation(): number {
  const roll = roll2d6();
  if (roll === 2) return 0;
  if (roll === 3) return 1;
  if (roll <= 5) return 2;
  if (roll <= 8) return 3;
  if (roll <= 10) return 4;
  if (roll === 11) return 5;
  return 6;
}

function generateTechLevel(): number {
  const roll = roll2d6();
  if (roll === 2) return 0;
  if (roll === 3) return 1;
  if (roll <= 5) return 2;
  if (roll <= 8) return 4;
  if (roll <= 10) return 3;
  if (roll === 11) return 4;
  return 5;
}

function generateWorldTags(): string[] {
  const tags: string[] = [];
  const usedIndices = new Set<number>();
  while (tags.length < 2) {
    const index = randomInt(0, WORLD_TAGS.length - 1);
    if (!usedIndices.has(index)) {
      tags.push(WORLD_TAGS[index]);
      usedIndices.add(index);
    }
  }
  return tags;
}

function generatePrimaryWorld(): PrimaryWorld {
  return {
    name: faker.location.city() + ' ' + faker.science.chemicalElement().name,
    atmosphere: generateAtmosphere(),
    temperature: generateTemperature(),
    biosphere: generateBiosphere(),
    population: generatePopulation(),
    techLevel: generateTechLevel(),
    government: GOVERNMENT_TYPES[randomInt(0, GOVERNMENT_TYPES.length - 1)],
    tags: generateWorldTags(),
    tradeCodes: [],
  };
}

interface Edge {
  from: string;
  to: string;
  distance: number;
}

function generateRoutes(systems: StarSystem[]): void {
  for (const system of systems) {
    system.routes = [];
  }
  const edges: Edge[] = [];
  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      const distance = hexDistance(systems[i].coordinates, systems[j].coordinates);
      if (distance <= MAX_SPIKE_DRIVE_RANGE) {
        edges.push({ from: systems[i].id, to: systems[j].id, distance });
      }
    }
  }
  edges.sort((a, b) => a.distance - b.distance);
  const connectionCounts = new Map<string, number>();
  systems.forEach((s) => connectionCounts.set(s.id, 0));
  const systemMap = new Map<string, StarSystem>();
  systems.forEach((s) => systemMap.set(s.id, s));
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
  for (const edge of edges) {
    const fromCount = connectionCounts.get(edge.from)!;
    const toCount = connectionCounts.get(edge.to)!;
    if (fromCount < MAX_CONNECTIONS_PER_SYSTEM && toCount < MAX_CONNECTIONS_PER_SYSTEM && union(edge.from, edge.to)) {
      const fromSystem = systemMap.get(edge.from)!;
      const toSystem = systemMap.get(edge.to)!;
      fromSystem.routes.push({ systemId: edge.to, isTradeRoute: false });
      toSystem.routes.push({ systemId: edge.from, isTradeRoute: false });
      connectionCounts.set(edge.from, fromCount + 1);
      connectionCounts.set(edge.to, toCount + 1);
    }
  }
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
  const routePairs = new Set<string>();
  for (const system of systems) {
    if (!system.routes) {
      system.routes = [];
      continue;
    }
    for (const route of system.routes) {
      const pair = [system.id, route.systemId].sort().join('|');
      routePairs.add(pair);
    }
  }
  const totalConnections = routePairs.size;
  const targetTradeRoutes = Math.floor(totalConnections / 3);
  const routePairsArray = Array.from(routePairs);
  const shuffledPairs = routePairsArray.sort(() => Math.random() - 0.5);
  const tradeRoutePairs = shuffledPairs.slice(0, targetTradeRoutes);
  for (const pair of tradeRoutePairs) {
    const [id1, id2] = pair.split('|');
    const system1 = systemMap.get(id1);
    const system2 = systemMap.get(id2);
    if (!system1 || !system2) continue;
    const route1 = system1.routes.find((r) => r.systemId === id2);
    const route2 = system2.routes.find((r) => r.systemId === id1);
    if (route1) route1.isTradeRoute = true;
    if (route2) route2.isTradeRoute = true;
  }
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
        }
      }
    }
  }
}

export function generateSector(): Sector {
  const systemCount = randomInt(MIN_SYSTEMS, MAX_SYSTEMS);
  const coordinates = generateStarCoordinates(systemCount);
  const systems: StarSystem[] = coordinates.map((coord, index) => {
    const systemId = `system-${index + 1}`;
    return {
      id: systemId,
      name: faker.location.city() + ' System',
      coordinates: coord,
      primaryWorld: generatePrimaryWorld(),
      secondaryWorlds: [],
      pointsOfInterest: [],
      routes: [],
    };
  });
  generateRoutes(systems);
  const sector: Sector = {
    id: faker.string.uuid(),
    name: faker.location.city() + ' Sector',
    created: Date.now(),
    systems,
  };
  return sector;
}
