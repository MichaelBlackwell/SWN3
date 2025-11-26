/**
 * Change Homeworld Validation Utilities
 * 
 * Per SWN rules:
 * - The faction must have a Base of Influence on the new homeworld
 * - The move takes 1 turn plus 1 turn per hex of distance
 * - The faction can take no other actions during this time
 * - The Deep Rooted tag is lost when changing homeworld (already in reducer)
 */

import type { Faction, FactionAsset } from '../types/faction';
import type { StarSystem } from '../types/sector';
import { BASE_OF_INFLUENCE_ID } from './expandInfluence';

export interface ChangeHomeworldValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ChangeHomeworldCostResult {
  turnsRequired: number;
  hexDistance: number;
}

/**
 * Check if a faction has a Base of Influence on a specific system
 */
export function hasBaseOfInfluenceOn(faction: Faction, systemId: string): boolean {
  return faction.assets.some(
    (asset: FactionAsset) =>
      asset.definitionId === BASE_OF_INFLUENCE_ID && asset.location === systemId
  );
}

/**
 * Get all systems where a faction has a Base of Influence (potential homeworld destinations)
 */
export function getValidHomeworldDestinations(
  faction: Faction,
  systems: StarSystem[]
): StarSystem[] {
  // Get all system IDs where faction has a Base of Influence
  const boiSystemIds = faction.assets
    .filter((asset: FactionAsset) => asset.definitionId === BASE_OF_INFLUENCE_ID)
    .map((asset: FactionAsset) => asset.location);

  // Filter to systems that are not the current homeworld
  return systems.filter(
    (system) =>
      boiSystemIds.includes(system.id) && system.id !== faction.homeworld
  );
}

/**
 * Calculate hex distance between two systems
 * This is a simplified calculation - assumes direct hex distance
 * In a full implementation, this would use actual hex coordinates
 */
export function calculateHexDistance(
  fromSystem: StarSystem,
  toSystem: StarSystem
): number {
  // Use the systems' hex coordinates if available
  const fromCoords = fromSystem.coordinates;
  const toCoords = toSystem.coordinates;

  if (fromCoords && toCoords) {
    // Hex distance calculation (using axial coordinates)
    // In axial coordinates: distance = (|q1-q2| + |q1+r1-q2-r2| + |r1-r2|) / 2
    // Simplified: use Chebyshev distance as approximation
    const dx = Math.abs(fromCoords.x - toCoords.x);
    const dy = Math.abs(fromCoords.y - toCoords.y);
    return Math.max(dx, dy);
  }

  // Fallback: assume 1 hex if coordinates not available
  return 1;
}

/**
 * Calculate the number of turns required to change homeworld
 * Per SWN: 1 turn + 1 turn per hex of distance
 */
export function calculateHomeworldChangeCost(
  fromSystem: StarSystem,
  toSystem: StarSystem
): ChangeHomeworldCostResult {
  const hexDistance = calculateHexDistance(fromSystem, toSystem);
  const turnsRequired = 1 + hexDistance;

  return {
    turnsRequired,
    hexDistance,
  };
}

/**
 * Validate if a faction can change to a specific homeworld
 */
export function validateHomeworldChange(
  faction: Faction,
  targetSystemId: string,
  systems: StarSystem[]
): ChangeHomeworldValidationResult {
  // Check if already transitioning
  if (faction.homeworldTransition) {
    return {
      valid: false,
      reason: `Already transitioning homeworld. ${faction.homeworldTransition.turnsRemaining} turns remaining.`,
    };
  }

  // Check if faction is in a seize planet campaign
  if (faction.seizePlanetCampaign) {
    return {
      valid: false,
      reason: 'Cannot change homeworld while conducting a planet seizure campaign.',
    };
  }

  // Check if target is different from current homeworld
  if (faction.homeworld === targetSystemId) {
    return {
      valid: false,
      reason: 'Target is already the current homeworld.',
    };
  }

  // Check if faction has a Base of Influence on the target system
  if (!hasBaseOfInfluenceOn(faction, targetSystemId)) {
    return {
      valid: false,
      reason: 'Must have a Base of Influence on the target planet to change homeworld.',
    };
  }

  // Check if target system exists
  const targetSystem = systems.find((s) => s.id === targetSystemId);
  if (!targetSystem) {
    return {
      valid: false,
      reason: 'Target system not found.',
    };
  }

  return { valid: true };
}

/**
 * Check if a faction can take actions this turn
 * Returns false if they are in a homeworld transition or seize planet campaign
 */
export function canFactionActThisTurn(faction: Faction): { canAct: boolean; reason?: string } {
  if (faction.homeworldTransition) {
    return {
      canAct: false,
      reason: `Homeworld transition in progress. ${faction.homeworldTransition.turnsRemaining} turns remaining.`,
    };
  }

  // Seize planet campaigns allow attacks but no other actions
  // This is handled separately in the seize planet logic

  return { canAct: true };
}


