// Unit tests for combat resolution utility
// Tests use fixed dice rolls to ensure deterministic results

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  rollD10,
  rollDiceExpression,
  calculateDiceAverage,
  performCombatRoll,
  resolveCombat,
  calculateAttackOdds,
  calculateExpectedDamage,
  calculateExpectedCounterattackDamage,
  type CombatRollConfig,
} from './combatResolver';
import type { AttackPattern, CounterattackPattern } from '../types/asset';
import type { Faction } from '../types/faction';

const createFaction = (overrides: Partial<Faction> = {}): Faction => {
  const base: Faction = {
    id: 'faction-test',
    name: 'Test Faction',
    type: 'Government',
    homeworld: 'system-1',
    attributes: {
      hp: 20,
      maxHp: 20,
      force: 4,
      cunning: 4,
      wealth: 4,
    },
    facCreds: 0,
    xp: 0,
    tags: [],
    goal: null,
    assets: [],
  };

  return {
    ...base,
    ...overrides,
    attributes: {
      ...base.attributes,
      ...(overrides.attributes || {}),
    },
  };
};

describe('combatResolver', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('rollD10', () => {
    it('should return a number between 1 and 10', () => {
      for (let i = 0; i < 100; i++) {
        const roll = rollD10();
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('rollDiceExpression', () => {
    it('should parse and roll simple dice expressions', () => {
      // Test 1d6 - should return 1-6
      const result1d6 = rollDiceExpression('1d6');
      expect(result1d6).toBeGreaterThanOrEqual(1);
      expect(result1d6).toBeLessThanOrEqual(6);

      // Test 2d4 - should return 2-8
      const result2d4 = rollDiceExpression('2d4');
      expect(result2d4).toBeGreaterThanOrEqual(2);
      expect(result2d4).toBeLessThanOrEqual(8);
    });

    it('should handle dice expressions with modifiers', () => {
      // Test 1d6+2 - should return 3-8
      const result1d6p2 = rollDiceExpression('1d6+2');
      expect(result1d6p2).toBeGreaterThanOrEqual(3);
      expect(result1d6p2).toBeLessThanOrEqual(8);

      // Test 2d4+3 - should return 5-11
      const result2d4p3 = rollDiceExpression('2d4+3');
      expect(result2d4p3).toBeGreaterThanOrEqual(5);
      expect(result2d4p3).toBeLessThanOrEqual(11);

      // Test 1d4-1 - should return 0-3
      const result1d4m1 = rollDiceExpression('1d4-1');
      expect(result1d4m1).toBeGreaterThanOrEqual(0);
      expect(result1d4m1).toBeLessThanOrEqual(3);
    });

    it('should handle special cases', () => {
      expect(rollDiceExpression('None')).toBe(0);
      expect(rollDiceExpression('special')).toBe(0);
      expect(rollDiceExpression('')).toBe(0);
    });

    it('should handle simple numeric values', () => {
      expect(rollDiceExpression('5')).toBe(5);
      expect(rollDiceExpression('10')).toBe(10);
    });

    it('should handle complex expressions from asset library', () => {
      // Test expressions that appear in the asset library
      const result1d3p1 = rollDiceExpression('1d3+1');
      expect(result1d3p1).toBeGreaterThanOrEqual(2);
      expect(result1d3p1).toBeLessThanOrEqual(4);

      const result2d6p2 = rollDiceExpression('2d6+2');
      expect(result2d6p2).toBeGreaterThanOrEqual(4);
      expect(result2d6p2).toBeLessThanOrEqual(14);

      const result3d10p4 = rollDiceExpression('3d10+4');
      expect(result3d10p4).toBeGreaterThanOrEqual(7);
      expect(result3d10p4).toBeLessThanOrEqual(34);
    });
  });

  describe('calculateDiceAverage', () => {
    it('should calculate correct averages for simple dice', () => {
      expect(calculateDiceAverage('1d6')).toBeCloseTo(3.5, 1);
      expect(calculateDiceAverage('1d10')).toBeCloseTo(5.5, 1);
      expect(calculateDiceAverage('2d4')).toBeCloseTo(5, 1);
    });

    it('should calculate correct averages with modifiers', () => {
      expect(calculateDiceAverage('1d6+2')).toBeCloseTo(5.5, 1);
      expect(calculateDiceAverage('2d4+3')).toBeCloseTo(8, 1);
      expect(calculateDiceAverage('1d4-1')).toBeCloseTo(1.5, 1);
    });

    it('should handle special cases', () => {
      expect(calculateDiceAverage('None')).toBe(0);
      expect(calculateDiceAverage('special')).toBe(0);
    });

    it('should handle numeric values', () => {
      expect(calculateDiceAverage('5')).toBe(5);
      expect(calculateDiceAverage('10')).toBe(10);
    });
  });

  describe('performCombatRoll', () => {
    it('should correctly calculate totals with fixed rolls', () => {
      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 5,
        defenderAttribute: 'Force',
        defenderAttributeValue: 3,
        attackerRoll: 7,
        defenderRoll: 4,
      };

      const result = performCombatRoll(config);

      expect(result.attackerRoll).toBe(7);
      expect(result.defenderRoll).toBe(4);
      expect(result.attackerTotal).toBe(12); // 7 + 5
      expect(result.defenderTotal).toBe(7); // 4 + 3
      expect(result.success).toBe(true);
      expect(result.tie).toBe(false);
      expect(result.margin).toBe(5);
    });

    it('should handle ties correctly', () => {
      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 5,
        defenderAttribute: 'Force',
        defenderAttributeValue: 5,
        attackerRoll: 5,
        defenderRoll: 5,
      };

      const result = performCombatRoll(config);

      expect(result.attackerTotal).toBe(10);
      expect(result.defenderTotal).toBe(10);
      expect(result.success).toBe(false); // On tie, success is false (both succeed)
      expect(result.tie).toBe(true);
      expect(result.margin).toBe(0);
    });

    it('should handle defender winning', () => {
      const config: CombatRollConfig = {
        attackerAttribute: 'Cunning',
        attackerAttributeValue: 3,
        defenderAttribute: 'Cunning',
        defenderAttributeValue: 6,
        attackerRoll: 3,
        defenderRoll: 8,
      };

      const result = performCombatRoll(config);

      expect(result.attackerTotal).toBe(6); // 3 + 3
      expect(result.defenderTotal).toBe(14); // 8 + 6
      expect(result.success).toBe(false);
      expect(result.tie).toBe(false);
      expect(result.margin).toBe(-8);
    });

    it('should use random rolls when not provided', () => {
      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 5,
        defenderAttribute: 'Force',
        defenderAttributeValue: 3,
      };

      const result = performCombatRoll(config);

      expect(result.attackerRoll).toBeGreaterThanOrEqual(1);
      expect(result.attackerRoll).toBeLessThanOrEqual(10);
      expect(result.defenderRoll).toBeGreaterThanOrEqual(1);
      expect(result.defenderRoll).toBeLessThanOrEqual(10);
      expect(result.attackerTotal).toBe(result.attackerRoll + 5);
      expect(result.defenderTotal).toBe(result.defenderRoll + 3);
    });

    it('should apply extra dice from attacker tags', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy
        .mockReturnValueOnce(0.15) // attacker base roll -> 2
        .mockReturnValueOnce(0.85) // attacker extra die -> 9
        .mockReturnValueOnce(0.35); // defender roll -> 4

      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 5,
        defenderAttribute: 'Force',
        defenderAttributeValue: 5,
        attackerFaction: createFaction({ tags: ['Warlike'] }),
        defenderFaction: createFaction(),
        defenderAssetTechLevel: 4,
      };

      const result = performCombatRoll(config);
      expect(result.attackerRoll).toBe(9);
    });

    it('should grant defensive dice on homeworld for Deep Rooted tag', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy
        .mockReturnValueOnce(0.55) // attacker roll -> 6
        .mockReturnValueOnce(0.05) // defender base roll -> 1
        .mockReturnValueOnce(0.75); // defender extra die -> 8

      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 4,
        defenderAttribute: 'Force',
        defenderAttributeValue: 4,
        attackerFaction: createFaction(),
        defenderFaction: createFaction({ tags: ['Deep Rooted'] }),
        defenderAssetTechLevel: 3,
        defenderIsOnHomeworld: true,
      };

      const result = performCombatRoll(config);
      expect(result.defenderRoll).toBe(8);
    });

    it('should reroll ones for Fanatical factions', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy
        .mockReturnValueOnce(0.05) // attacker initial roll -> 1
        .mockReturnValueOnce(0.65) // reroll due to Fanatical -> 7
        .mockReturnValueOnce(0.45); // defender roll -> 5

      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 4,
        defenderAttribute: 'Force',
        defenderAttributeValue: 4,
        attackerFaction: createFaction({ tags: ['Fanatical'] }),
        defenderFaction: createFaction(),
      };

      const result = performCombatRoll(config);
      expect(result.attackerRoll).toBe(7);
    });

    it('should treat ties as losses when attacker always loses ties', () => {
      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 5,
        defenderAttribute: 'Force',
        defenderAttributeValue: 5,
        attackerRoll: 5,
        defenderRoll: 5,
        attackerFaction: createFaction({ tags: ['Fanatical'] }),
        defenderFaction: createFaction(),
      };

      const result = performCombatRoll(config);
      expect(result.tie).toBe(false);
      expect(result.success).toBe(false);
    });

    it('applies asset-specific combat bonuses for Eugenics Cult factions', () => {
      const randomSpy = vi
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.1) // attacker die #1 -> 2
        .mockReturnValueOnce(0.9) // attacker die #2 -> 10 (extra die)
        .mockReturnValueOnce(0.3); // defender die -> 4

      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 4,
        defenderAttribute: 'Force',
        defenderAttributeValue: 4,
        attackerFaction: createFaction({ tags: ['Eugenics Cult'] }),
        defenderFaction: createFaction(),
        attackerAssetDefinitionId: 'force_1_gengineered_slaves',
      };

      const result = performCombatRoll(config);
      expect(result.attackerRoll).toBe(10);
      expect(result.defenderRoll).toBe(4);
      randomSpy.mockRestore();
    });
  });

  describe('resolveCombat', () => {
    const mockAttackPattern: AttackPattern = {
      attackerAttribute: 'Force',
      defenderAttribute: 'Force',
      damage: '1d6',
    };

    const mockCounterattackPattern: CounterattackPattern = {
      damage: '1d4',
    };

    it('should throw error if no attack pattern provided', () => {
      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 5,
        defenderAttribute: 'Force',
        defenderAttributeValue: 3,
      };

      expect(() => {
        resolveCombat(config, null, null);
      }).toThrow('Cannot resolve combat: attacker has no attack pattern');
    });

    it('should resolve successful attack with no counterattack', () => {
      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 5,
        defenderAttribute: 'Force',
        defenderAttributeValue: 3,
        attackerRoll: 7,
        defenderRoll: 4,
      };

      const result = resolveCombat(config, mockAttackPattern, null);

      expect(result.rollResult.success).toBe(true);
      expect(result.attackerWins).toBe(true);
      expect(result.bothSucceed).toBe(false);
      expect(result.attackDamage).toBeGreaterThanOrEqual(1);
      expect(result.attackDamage).toBeLessThanOrEqual(6);
      expect(result.counterattackDamage).toBe(0);
    });

    it('should resolve failed attack with counterattack', () => {
      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 3,
        defenderAttribute: 'Force',
        defenderAttributeValue: 5,
        attackerRoll: 2,
        defenderRoll: 8,
      };

      const result = resolveCombat(config, mockAttackPattern, mockCounterattackPattern);

      expect(result.rollResult.success).toBe(false);
      expect(result.attackerWins).toBe(false);
      expect(result.bothSucceed).toBe(false);
      expect(result.attackDamage).toBe(0);
      expect(result.counterattackDamage).toBeGreaterThanOrEqual(1);
      expect(result.counterattackDamage).toBeLessThanOrEqual(4);
    });

    it('should resolve tie with both attack and counterattack succeeding', () => {
      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 5,
        defenderAttribute: 'Force',
        defenderAttributeValue: 5,
        attackerRoll: 5,
        defenderRoll: 5,
      };

      const result = resolveCombat(config, mockAttackPattern, mockCounterattackPattern);

      expect(result.rollResult.tie).toBe(true);
      expect(result.bothSucceed).toBe(true);
      expect(result.attackDamage).toBeGreaterThanOrEqual(1);
      expect(result.attackDamage).toBeLessThanOrEqual(6);
      expect(result.counterattackDamage).toBeGreaterThanOrEqual(1);
      expect(result.counterattackDamage).toBeLessThanOrEqual(4);
    });

    it('should handle counterattack with "None" damage', () => {
      const noneCounterattack: CounterattackPattern = {
        damage: 'None',
      };

      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 3,
        defenderAttribute: 'Force',
        defenderAttributeValue: 5,
        attackerRoll: 2,
        defenderRoll: 8,
      };

      const result = resolveCombat(config, mockAttackPattern, noneCounterattack);

      expect(result.attackerWins).toBe(false);
      expect(result.counterattackDamage).toBe(0);
    });

    it('should handle complex damage expressions', () => {
      const complexAttack: AttackPattern = {
        attackerAttribute: 'Force',
        defenderAttribute: 'Force',
        damage: '2d6+2',
      };

      const config: CombatRollConfig = {
        attackerAttribute: 'Force',
        attackerAttributeValue: 5,
        defenderAttribute: 'Force',
        defenderAttributeValue: 3,
        attackerRoll: 7,
        defenderRoll: 4,
      };

      const result = resolveCombat(config, complexAttack, null);

      expect(result.attackerWins).toBe(true);
      expect(result.attackDamage).toBeGreaterThanOrEqual(4); // 2d6+2 minimum
      expect(result.attackDamage).toBeLessThanOrEqual(14); // 2d6+2 maximum
    });
  });

  describe('calculateAttackOdds', () => {
    it('should return higher odds for stronger attacker', () => {
      const odds1 = calculateAttackOdds('Force', 8, 'Force', 1);
      const odds2 = calculateAttackOdds('Force', 1, 'Force', 8);

      expect(odds1).toBeGreaterThan(0.5);
      expect(odds2).toBeLessThan(0.5);
      expect(odds1).toBeGreaterThan(odds2);
    });

    it('should return approximately 0.5 for equal attributes', () => {
      const odds = calculateAttackOdds('Force', 5, 'Force', 5);
      expect(odds).toBeCloseTo(0.5, 1);
    });

    it('should return values between 0 and 1', () => {
      const odds1 = calculateAttackOdds('Force', 1, 'Force', 8);
      const odds2 = calculateAttackOdds('Force', 8, 'Force', 1);
      const odds3 = calculateAttackOdds('Cunning', 5, 'Wealth', 5);

      expect(odds1).toBeGreaterThanOrEqual(0);
      expect(odds1).toBeLessThanOrEqual(1);
      expect(odds2).toBeGreaterThanOrEqual(0);
      expect(odds2).toBeLessThanOrEqual(1);
      expect(odds3).toBeGreaterThanOrEqual(0);
      expect(odds3).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateExpectedDamage', () => {
    it('should calculate expected damage for simple expressions', () => {
      expect(calculateExpectedDamage('1d6')).toBeCloseTo(3.5, 1);
      expect(calculateExpectedDamage('2d4')).toBeCloseTo(5, 1);
    });

    it('should calculate expected damage with modifiers', () => {
      expect(calculateExpectedDamage('1d6+2')).toBeCloseTo(5.5, 1);
      expect(calculateExpectedDamage('2d4+3')).toBeCloseTo(8, 1);
    });
  });

  describe('calculateExpectedCounterattackDamage', () => {
    it('should return 0 for null counterattack', () => {
      expect(calculateExpectedCounterattackDamage(null)).toBe(0);
    });

    it('should return 0 for "None" counterattack', () => {
      const counterattack: CounterattackPattern = {
        damage: 'None',
      };
      expect(calculateExpectedCounterattackDamage(counterattack)).toBe(0);
    });

    it('should calculate expected damage for valid counterattack', () => {
      const counterattack: CounterattackPattern = {
        damage: '1d4',
      };
      expect(calculateExpectedCounterattackDamage(counterattack)).toBeCloseTo(2.5, 1);
    });
  });
});















