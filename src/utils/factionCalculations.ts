// Utility functions for calculating faction statistics based on SWN rules

import type { FactionType, FactionAttributes } from '../types/faction';

/**
 * Calculate initial faction attributes based on type
 * Based on SWN rules: minor factions (15 HP), major powers (29 HP), sector hegemons (49 HP)
 * 
 * Attribute distribution:
 * - Primary attribute: 4 (minor), 6 (major), 8 (hegemon)
 * - Secondary attribute: primary - 1
 * - Tertiary attribute: primary - 3
 * 
 * Max HP = 4 + sum of XP costs for each attribute level
 * XP costs: 1=1, 2=2, 3=4, 4=6, 5=9, 6=12, 7=16, 8=20
 */
const xpCosts: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 6,
  5: 9,
  6: 12,
  7: 16,
  8: 20,
};

function calculateMaxHp(force: number, cunning: number, wealth: number): number {
  return 4 + xpCosts[force] + xpCosts[cunning] + xpCosts[wealth];
}

/**
 * Get attribute distribution for a faction type
 */
function getAttributeDistribution(type: FactionType): {
  primary: 'force' | 'cunning' | 'wealth';
  primaryValue: number;
  secondaryValue: number;
  tertiaryValue: number;
} {
  switch (type) {
    case 'Government':
    case 'Regional Hegemon':
      return {
        primary: 'force',
        primaryValue: 6,
        secondaryValue: 5,
        tertiaryValue: 3,
      };
    case 'Corporation':
      return {
        primary: 'wealth',
        primaryValue: 6,
        secondaryValue: 5,
        tertiaryValue: 3,
      };
    case 'Religion':
    case 'Eugenics Cult':
      return {
        primary: 'cunning',
        primaryValue: 6,
        secondaryValue: 5,
        tertiaryValue: 3,
      };
    case 'Criminal Organization':
      return {
        primary: 'cunning',
        primaryValue: 4,
        secondaryValue: 3,
        tertiaryValue: 1,
      };
    case 'Mercenary Group':
      return {
        primary: 'force',
        primaryValue: 5,
        secondaryValue: 4,
        tertiaryValue: 2,
      };
    case 'Rebel Movement':
      return {
        primary: 'cunning',
        primaryValue: 4,
        secondaryValue: 3,
        tertiaryValue: 1,
      };
    case 'Colony':
      return {
        primary: 'force',
        primaryValue: 4,
        secondaryValue: 3,
        tertiaryValue: 1,
      };
    default:
      // Default to balanced minor faction
      return {
        primary: 'force',
        primaryValue: 4,
        secondaryValue: 3,
        tertiaryValue: 1,
      };
  }
}

/**
 * Calculate initial faction attributes based on type
 */
export function calculateFactionStats(type: FactionType): FactionAttributes {
  const distribution = getAttributeDistribution(type);
  
  let force = 1;
  let cunning = 1;
  let wealth = 1;
  
  // Set primary attribute
  if (distribution.primary === 'force') {
    force = distribution.primaryValue;
    cunning = distribution.secondaryValue;
    wealth = distribution.tertiaryValue;
  } else if (distribution.primary === 'cunning') {
    cunning = distribution.primaryValue;
    force = distribution.secondaryValue;
    wealth = distribution.tertiaryValue;
  } else {
    wealth = distribution.primaryValue;
    force = distribution.secondaryValue;
    cunning = distribution.tertiaryValue;
  }
  
  const maxHp = calculateMaxHp(force, cunning, wealth);
  
  return {
    hp: maxHp,
    maxHp,
    force,
    cunning,
    wealth,
  };
}

/**
 * Generate a unique UUID for factions
 */
export function generateFactionId(): string {
  return crypto.randomUUID();
}

/**
 * Calculate starting FacCreds based on attributes
 * Formula: half Wealth (rounded up) + quarter of (Force + Cunning) (rounded down)
 */
export function calculateStartingFacCreds(attributes: FactionAttributes): number {
  const wealthIncome = Math.ceil(attributes.wealth / 2);
  const otherIncome = Math.floor((attributes.force + attributes.cunning) / 4);
  return wealthIncome + otherIncome;
}

/**
 * Calculate turn income for a faction based on attributes
 * Formula per SWN rules: half Wealth (rounded up) + one-quarter of (Force + Cunning) (rounded down)
 * This is the base income before any asset bonuses
 */
export function calculateTurnIncome(attributes: FactionAttributes): number {
  const wealthIncome = Math.ceil(attributes.wealth / 2);
  const otherIncome = Math.floor((attributes.force + attributes.cunning) / 4);
  return wealthIncome + otherIncome;
}

/**
 * Calculate the XP cost to upgrade an attribute from its current rating to the next level
 * Based on SWN rules: Current Rating -> Cost
 * 1->1, 2->2, 3->4, 4->6, 5->9, 6->12, 7->16, 8->20
 * 
 * @param currentRating - The current rating of the attribute (1-8)
 * @returns The XP cost to upgrade to the next level, or 0 if already at max (8) or invalid rating
 */
export function calculateUpgradeCost(currentRating: number): number {
  // Validate rating range
  if (currentRating < 1 || currentRating >= 8) {
    return 0; // Cannot upgrade beyond 8 or from invalid ratings
  }
  
  // The cost to upgrade FROM currentRating TO (currentRating + 1)
  // is the XP cost of the NEW rating level
  const nextRating = currentRating + 1;
  return xpCosts[nextRating] || 0;
}

