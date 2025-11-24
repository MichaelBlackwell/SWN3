// Sector generation types based on PRD schema

export type AtmosphereType =
  | 'Corrosive'
  | 'Inert'
  | 'Airless'
  | 'Breathable'
  | 'Thick'
  | 'Thin'
  | 'Exotic';

export type TemperatureType =
  | 'Frozen'
  | 'Cold'
  | 'Variable Cold'
  | 'Temperate'
  | 'Variable Warm'
  | 'Warm'
  | 'Burning';

export type BiosphereType =
  | 'Remnant'
  | 'Microbial'
  | 'None'
  | 'Human-miscible'
  | 'Immiscible'
  | 'Hybrid'
  | 'Engineered';

export type PopulationType =
  | 'Failed Colony'
  | 'Outpost'
  | 'Fewer than a million'
  | 'Several million'
  | 'Hundreds of millions'
  | 'Billions'
  | 'Alien inhabitants';

export interface Coordinates {
  x: number;
  y: number;
}

export interface PrimaryWorld {
  name: string;
  atmosphere: AtmosphereType;
  temperature: TemperatureType;
  biosphere: BiosphereType;
  population: number; // Population index (0-6) matching PopulationType
  techLevel: number; // 0-5
  government: string;
  tags: string[];
  tradeCodes: string[];
}

export interface Route {
  systemId: string; // ID of the connected system
  isTradeRoute: boolean; // Whether this is a trade route
}

export interface StarSystem {
  id: string;
  name: string;
  coordinates: Coordinates;
  primaryWorld: PrimaryWorld;
  secondaryWorlds: unknown[]; // Placeholder for future implementation
  pointsOfInterest: unknown[]; // Placeholder for future implementation
  routes: Route[]; // Array of routes to connected systems
}

export interface Sector {
  id: string;
  name: string;
  created: number; // timestamp
  systems: StarSystem[];
}

