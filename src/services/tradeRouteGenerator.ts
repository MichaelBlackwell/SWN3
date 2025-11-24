/**
 * Trade Route Generation System
 * 
 * Architecture: Generates realistic trade routes based on economic factors
 * rather than random selection.
 * 
 * Key Design Principles:
 * 1. Trade flows from exporters to importers
 * 2. High-value worlds attract more trade
 * 3. Complementary economies create strong trade links
 * 4. Distance matters, but economic value can overcome it
 * 
 * Trade Route Scoring:
 * - Economic Complementarity: Do they trade what each other needs?
 * - Economic Value: Combined wealth of both systems
 * - Distance Penalty: Closer is better
 * - Tech Differential: Tech flows from high to low tech worlds
 */

import type { StarSystem, Route } from '../types/sector';
import { getWorldEconomicProfile } from './worldGenerator';

interface TradeScore {
  systemId1: string;
  systemId2: string;
  score: number;
  distance: number;
  reason: string[];
}

interface EconomicProfile {
  systemId: string;
  economicValue: number;
  exports: string[];
  imports: string[];
  techLevel: number;
  population: number;
}

/**
 * Calculate hex distance between two coordinates
 */
function hexDistance(coord1: { x: number; y: number }, coord2: { x: number; y: number }): number {
  const q1 = coord1.x;
  const r1 = coord1.y - Math.floor((coord1.x - (coord1.x & 1)) / 2);
  const s1 = -q1 - r1;
  const q2 = coord2.x;
  const r2 = coord2.y - Math.floor((coord2.x - (coord2.x & 1)) / 2);
  const s2 = -q2 - r2;
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(s1 - s2)) / 2;
}

/**
 * Calculate economic complementarity between two worlds
 * Returns a score from 0-100 based on how well their economies match
 */
function calculateComplementarity(
  profile1: EconomicProfile,
  profile2: EconomicProfile
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  
  // Check if exports match imports
  const exports1ToImports2 = profile1.exports.filter(exp =>
    profile2.imports.includes(exp)
  );
  const exports2ToImports1 = profile2.exports.filter(exp =>
    profile1.imports.includes(exp)
  );
  
  // Bidirectional trade is valuable
  if (exports1ToImports2.length > 0 && exports2ToImports1.length > 0) {
    score += 40;
    reasons.push('Bidirectional trade possible');
  } else if (exports1ToImports2.length > 0 || exports2ToImports1.length > 0) {
    score += 20;
    reasons.push('One-way trade beneficial');
  }
  
  // Tech level differential creates trade opportunities
  const techDiff = Math.abs(profile1.techLevel - profile2.techLevel);
  if (techDiff >= 2) {
    score += 15;
    reasons.push('Technology exchange potential');
  }
  
  // High population worlds are good customers
  if (profile1.population >= 5 || profile2.population >= 5) {
    score += 10;
    reasons.push('Large consumer market');
  }
  
  // Specific commodity matches
  const commodityMatches = exports1ToImports2.length + exports2ToImports1.length;
  score += Math.min(25, commodityMatches * 5);
  if (commodityMatches > 0) {
    reasons.push(`${commodityMatches} commodity match${commodityMatches > 1 ? 'es' : ''}`);
  }
  
  return { score, reasons };
}

/**
 * Score a potential trade route between two systems
 */
function scoreTradeRoute(
  system1: StarSystem,
  system2: StarSystem,
  profile1: EconomicProfile,
  profile2: EconomicProfile,
  maxDistance: number
): TradeScore {
  const distance = hexDistance(system1.coordinates, system2.coordinates);
  
  // Base score from economic values
  let score = (profile1.economicValue + profile2.economicValue) / 2;
  const reasons: string[] = [];
  
  // Distance penalty (exponential dropoff)
  const distanceFactor = Math.max(0, 1 - (distance / (maxDistance * 1.5)));
  score *= distanceFactor;
  
  if (distance <= 1) {
    reasons.push('Adjacent systems');
  } else if (distance <= 2) {
    reasons.push('Close proximity');
  } else {
    reasons.push('Long-range route');
  }
  
  // Complementarity bonus
  const complementarity = calculateComplementarity(profile1, profile2);
  score += complementarity.score;
  reasons.push(...complementarity.reasons);
  
  // Hub bonus: High-value worlds with many existing routes
  const existingRoutes1 = system1.routes?.length || 0;
  const existingRoutes2 = system2.routes?.length || 0;
  
  if (profile1.economicValue >= 70 || profile2.economicValue >= 70) {
    score += 20;
    reasons.push('Major economic hub');
  }
  
  // Route saturation penalty
  const avgRoutes = (existingRoutes1 + existingRoutes2) / 2;
  if (avgRoutes > 3) {
    score *= 0.8; // Reduce score if systems already have many routes
  }
  
  return {
    systemId1: system1.id,
    systemId2: system2.id,
    score: Math.max(0, score),
    distance,
    reason: reasons,
  };
}

/**
 * Build economic profiles for all systems
 */
function buildEconomicProfiles(systems: StarSystem[]): Map<string, EconomicProfile> {
  const profiles = new Map<string, EconomicProfile>();
  
  for (const system of systems) {
    const worldProfile = getWorldEconomicProfile(system.primaryWorld);
    
    profiles.set(system.id, {
      systemId: system.id,
      economicValue: worldProfile.economicValue,
      exports: worldProfile.resourceExport,
      imports: worldProfile.resourceImport,
      techLevel: system.primaryWorld.techLevel,
      population: system.primaryWorld.population,
    });
  }
  
  return profiles;
}

/**
 * Generate trade routes based on economic factors
 * 
 * @param systems - All star systems in the sector
 * @param existingRoutes - Existing spike drive routes (already calculated)
 * @returns Updated systems with trade routes marked
 */
export function generateTradeRoutes(systems: StarSystem[]): void {
  const profiles = buildEconomicProfiles(systems);
  
  // Build a map of existing routes for quick lookup
  const routeExists = new Set<string>();
  for (const system of systems) {
    for (const route of system.routes) {
      const key = [system.id, route.systemId].sort().join('|');
      routeExists.add(key);
    }
  }
  
  // Score all potential trade routes (only on existing spike drive routes)
  const tradeScores: TradeScore[] = [];
  
  for (const system of systems) {
    const profile1 = profiles.get(system.id);
    if (!profile1) continue;
    
    // Only consider routes where a spike drive connection already exists
    for (const route of system.routes) {
      // Avoid double-processing (only process each pair once)
      const key = [system.id, route.systemId].sort().join('|');
      if (tradeScores.some(ts => 
        [ts.systemId1, ts.systemId2].sort().join('|') === key
      )) {
        continue;
      }
      
      const system2 = systems.find(s => s.id === route.systemId);
      const profile2 = system2 ? profiles.get(system2.id) : undefined;
      
      if (!system2 || !profile2) continue;
      
      const score = scoreTradeRoute(system, system2, profile1, profile2, 3);
      tradeScores.push(score);
    }
  }
  
  // Sort by score (highest first)
  tradeScores.sort((a, b) => b.score - a.score);
  
  // Select top trade routes
  // Aim for about 30-40% of existing routes to be trade routes
  const totalRoutes = routeExists.size;
  const targetTradeRoutes = Math.max(
    Math.floor(totalRoutes * 0.35),
    Math.min(3, totalRoutes) // At least 3 trade routes, or all routes if fewer than 3
  );
  
  // Mark the top scoring routes as trade routes
  const selectedTradeRoutes = tradeScores.slice(0, targetTradeRoutes);
  
  for (const tradeRoute of selectedTradeRoutes) {
    const system1 = systems.find(s => s.id === tradeRoute.systemId1);
    const system2 = systems.find(s => s.id === tradeRoute.systemId2);
    
    if (!system1 || !system2) continue;
    
    // Mark route as trade route in both directions
    const route1 = system1.routes.find(r => r.systemId === system2.id);
    const route2 = system2.routes.find(r => r.systemId === system1.id);
    
    if (route1) route1.isTradeRoute = true;
    if (route2) route2.isTradeRoute = true;
  }
  
  // Ensure economic hubs have at least one trade route
  ensureHubConnectivity(systems, profiles);
}

/**
 * Ensure major economic hubs have at least one trade route
 */
function ensureHubConnectivity(
  systems: StarSystem[],
  profiles: Map<string, EconomicProfile>
): void {
  const economicHubs = systems.filter(system => {
    const profile = profiles.get(system.id);
    return profile && profile.economicValue >= 60;
  });
  
  for (const hub of economicHubs) {
    const hasTradeRoute = hub.routes.some(r => r.isTradeRoute);
    
    if (!hasTradeRoute && hub.routes.length > 0) {
      // Find the best candidate route to convert to a trade route
      const hubProfile = profiles.get(hub.id)!;
      let bestScore = -1;
      let bestRouteIndex = 0;
      
      hub.routes.forEach((route, index) => {
        const connectedSystem = systems.find(s => s.id === route.systemId);
        const connectedProfile = connectedSystem ? profiles.get(connectedSystem.id) : undefined;
        
        if (connectedSystem && connectedProfile) {
          const score = scoreTradeRoute(
            hub,
            connectedSystem,
            hubProfile,
            connectedProfile,
            3
          ).score;
          
          if (score > bestScore) {
            bestScore = score;
            bestRouteIndex = index;
          }
        }
      });
      
      // Convert best route to trade route
      const bestRoute = hub.routes[bestRouteIndex];
      bestRoute.isTradeRoute = true;
      
      // Also mark the reciprocal route
      const connectedSystem = systems.find(s => s.id === bestRoute.systemId);
      if (connectedSystem) {
        const reciprocalRoute = connectedSystem.routes.find(r => r.systemId === hub.id);
        if (reciprocalRoute) {
          reciprocalRoute.isTradeRoute = true;
        }
      }
    }
  }
}

/**
 * Get trade route statistics for a sector
 */
export function getTradeRouteStats(systems: StarSystem[]): {
  totalRoutes: number;
  tradeRoutes: number;
  tradeRoutePercentage: number;
  majorHubs: string[]; // System IDs of major trade hubs
} {
  let totalRoutes = 0;
  let tradeRoutes = 0;
  const tradeRouteCounts = new Map<string, number>();
  
  // Count routes (avoid double counting)
  const counted = new Set<string>();
  for (const system of systems) {
    for (const route of system.routes) {
      const key = [system.id, route.systemId].sort().join('|');
      if (!counted.has(key)) {
        counted.add(key);
        totalRoutes++;
        if (route.isTradeRoute) {
          tradeRoutes++;
          tradeRouteCounts.set(system.id, (tradeRouteCounts.get(system.id) || 0) + 1);
          tradeRouteCounts.set(route.systemId, (tradeRouteCounts.get(route.systemId) || 0) + 1);
        }
      }
    }
  }
  
  // Identify major hubs (3+ trade routes)
  const majorHubs = Array.from(tradeRouteCounts.entries())
    .filter(([_, count]) => count >= 3)
    .map(([systemId, _]) => systemId);
  
  return {
    totalRoutes,
    tradeRoutes,
    tradeRoutePercentage: totalRoutes > 0 ? (tradeRoutes / totalRoutes) * 100 : 0,
    majorHubs,
  };
}

/**
 * Get detailed trade information for a specific system
 */
export function getSystemTradeInfo(
  system: StarSystem,
  allSystems: StarSystem[]
): {
  isTradeHub: boolean;
  tradeRouteCount: number;
  tradePartners: string[];
  mainExports: string[];
  mainImports: string[];
} {
  const profile = getWorldEconomicProfile(system.primaryWorld);
  const tradeRoutes = system.routes.filter(r => r.isTradeRoute);
  
  const tradePartners = tradeRoutes.map(route => {
    const partner = allSystems.find(s => s.id === route.systemId);
    return partner?.name || 'Unknown';
  });
  
  return {
    isTradeHub: tradeRoutes.length >= 3 || profile.economicValue >= 70,
    tradeRouteCount: tradeRoutes.length,
    tradePartners,
    mainExports: profile.resourceExport,
    mainImports: profile.resourceImport,
  };
}

