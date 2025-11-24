// Combat resolution utility for Stars Without Number faction combat
// Implements the 1d10 + Attribute vs 1d10 + Attribute combat system

import type { AttackType, AttackPattern, CounterattackPattern } from '../types/asset';

/**
 * Configuration for a combat roll
 */
export interface CombatRollConfig {
  attackerAttribute: AttackType;
  attackerAttributeValue: number; // The faction's attribute rating (1-8)
  defenderAttribute: AttackType;
  defenderAttributeValue: number; // The faction's attribute rating (1-8)
  attackerRoll?: number; // Optional: provide a fixed roll for testing
  defenderRoll?: number; // Optional: provide a fixed roll for testing
}

/**
 * Result of a combat roll comparison
 */
export interface CombatRollResult {
  attackerTotal: number; // 1d10 + attacker attribute
  defenderTotal: number; // 1d10 + defender attribute
  attackerRoll: number; // Raw d10 roll (1-10)
  defenderRoll: number; // Raw d10 roll (1-10)
  success: boolean; // true if attacker wins
  tie: boolean; // true if both rolls are equal
  margin: number; // Difference between totals (positive = attacker wins, negative = defender wins)
}

/**
 * Result of a complete combat resolution including damage
 */
export interface CombatResult {
  rollResult: CombatRollResult;
  attackDamage: number; // Damage dealt by attacker (0 if attack failed)
  counterattackDamage: number; // Damage dealt by defender (0 if no counterattack or attack succeeded)
  attackerWins: boolean; // true if attack succeeded
  bothSucceed: boolean; // true if tie (both attack and counterattack succeed)
}

/**
 * Rolls a single d10 die (returns 1-10)
 * Can be overridden for testing with fixed seeds
 */
export function rollD10(): number {
  return Math.floor(Math.random() * 10) + 1;
}

/**
 * Parses a dice expression string and rolls the dice
 * Supports formats like: "1d6", "2d4+2", "1d8+1", "2d6+3", "1d4-1"
 * Returns the total result
 */
export function rollDiceExpression(expression: string): number {
  if (!expression || expression === 'None' || expression === 'special') {
    return 0;
  }

  // Remove whitespace
  expression = expression.trim();

  // Pattern: (number)d(number)(+/-number)?
  const match = expression.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    // If it doesn't match, try to parse as a simple number
    const numMatch = expression.match(/^(\d+)$/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }
    // If we can't parse it, return 0 (for "special" cases)
    console.warn(`Unable to parse dice expression: ${expression}`);
    return 0;
  }

  const numDice = parseInt(match[1], 10);
  const dieSize = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  let total = modifier;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * dieSize) + 1;
  }

  return total;
}

/**
 * Calculates the expected value of a dice expression (for odds calculation)
 * Does not roll dice, just calculates average
 */
export function calculateDiceAverage(expression: string): number {
  if (!expression || expression === 'None' || expression === 'special') {
    return 0;
  }

  expression = expression.trim();
  const match = expression.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    const numMatch = expression.match(/^(\d+)$/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }
    return 0;
  }

  const numDice = parseInt(match[1], 10);
  const dieSize = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  // Average of a dN is (N+1)/2
  const averagePerDie = (dieSize + 1) / 2;
  return numDice * averagePerDie + modifier;
}

/**
 * Performs a combat roll comparison
 * Returns the roll results and comparison outcome
 */
export function performCombatRoll(config: CombatRollConfig): CombatRollResult {
  const attackerRoll = config.attackerRoll ?? rollD10();
  const defenderRoll = config.defenderRoll ?? rollD10();

  const attackerTotal = attackerRoll + config.attackerAttributeValue;
  const defenderTotal = defenderRoll + config.defenderAttributeValue;

  const margin = attackerTotal - defenderTotal;
  const tie = margin === 0;
  const success = margin > 0;

  return {
    attackerTotal,
    defenderTotal,
    attackerRoll,
    defenderRoll,
    success,
    tie,
    margin,
  };
}

/**
 * Resolves a complete combat action including damage calculation
 * Handles attack success/failure and counterattack logic
 */
export function resolveCombat(
  rollConfig: CombatRollConfig,
  attackPattern: AttackPattern | null,
  counterattackPattern: CounterattackPattern | null
): CombatResult {
  // If no attack pattern, combat cannot proceed
  if (!attackPattern) {
    throw new Error('Cannot resolve combat: attacker has no attack pattern');
  }

  // Perform the combat roll
  const rollResult = performCombatRoll(rollConfig);

  let attackDamage = 0;
  let counterattackDamage = 0;
  let attackerWins = false;
  let bothSucceed = false;

  if (rollResult.tie) {
    // On a tie, both attack and counterattack succeed
    bothSucceed = true;
    attackDamage = rollDiceExpression(attackPattern.damage);
    if (counterattackPattern && counterattackPattern.damage !== 'None') {
      counterattackDamage = rollDiceExpression(counterattackPattern.damage);
    }
  } else if (rollResult.success) {
    // Attack succeeds, defender takes damage
    attackerWins = true;
    attackDamage = rollDiceExpression(attackPattern.damage);
  } else {
    // Attack fails, counterattack triggers (if available)
    attackerWins = false;
    if (counterattackPattern && counterattackPattern.damage !== 'None') {
      counterattackDamage = rollDiceExpression(counterattackPattern.damage);
    }
  }

  return {
    rollResult,
    attackDamage,
    counterattackDamage,
    attackerWins,
    bothSucceed,
  };
}

/**
 * Calculates the probability of an attack succeeding
 * Returns a value between 0 and 1
 * Uses expected values for dice expressions
 */
export function calculateAttackOdds(
  attackerAttribute: AttackType,
  attackerAttributeValue: number,
  defenderAttribute: AttackType,
  defenderAttributeValue: number
): number {
  // Average d10 roll is 5.5
  const attackerAverage = 5.5 + attackerAttributeValue;
  const defenderAverage = 5.5 + defenderAttributeValue;

  // Calculate probability using normal approximation
  // For discrete uniform distribution, variance of 1d10 is 8.25
  // Standard deviation is sqrt(8.25) ≈ 2.87
  const attackerStdDev = 2.87;
  const defenderStdDev = 2.87;
  const combinedStdDev = Math.sqrt(attackerStdDev ** 2 + defenderStdDev ** 2);

  // Z-score for attacker winning (margin > 0)
  const meanDiff = attackerAverage - defenderAverage;
  const zScore = meanDiff / combinedStdDev;

  // Use normal CDF approximation
  // For simplicity, we'll use a basic approximation
  // More accurate would require a proper normal CDF function
  const probability = 0.5 * (1 + Math.tanh(zScore * 0.8));

  return Math.max(0, Math.min(1, probability));
}

/**
 * Calculates the expected damage for an attack
 * Returns the average damage value
 */
export function calculateExpectedDamage(damageExpression: string): number {
  return calculateDiceAverage(damageExpression);
}

/**
 * Calculates the expected damage for a counterattack
 * Returns the average damage value
 */
export function calculateExpectedCounterattackDamage(
  counterattackPattern: CounterattackPattern | null
): number {
  if (!counterattackPattern || counterattackPattern.damage === 'None') {
    return 0;
  }
  return calculateDiceAverage(counterattackPattern.damage);
}






