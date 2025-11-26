import { describe, it, expect } from 'vitest';
import { calculateUpgradeCost } from './factionCalculations';

describe('calculateUpgradeCost', () => {
  // Test cost table for all valid upgrade levels (1->2 through 7->8)
  it.each([
    [1, 2],  // Upgrading from 1 to 2 costs 2 XP
    [2, 4],  // Upgrading from 2 to 3 costs 4 XP
    [3, 6],  // Upgrading from 3 to 4 costs 6 XP
    [4, 9],  // Upgrading from 4 to 5 costs 9 XP
    [5, 12], // Upgrading from 5 to 6 costs 12 XP
    [6, 16], // Upgrading from 6 to 7 costs 16 XP
    [7, 20], // Upgrading from 7 to 8 costs 20 XP
  ])('should return %i XP cost to upgrade from rating %i', (currentRating, expectedCost) => {
    const cost = calculateUpgradeCost(currentRating);
    expect(cost).toBe(expectedCost);
  });

  // Test edge cases
  describe('edge cases', () => {
    it('should return 0 for rating 8 (already at max)', () => {
      expect(calculateUpgradeCost(8)).toBe(0);
    });

    it('should return 0 for rating above 8', () => {
      expect(calculateUpgradeCost(9)).toBe(0);
      expect(calculateUpgradeCost(10)).toBe(0);
      expect(calculateUpgradeCost(100)).toBe(0);
    });

    it('should return 0 for rating 0', () => {
      expect(calculateUpgradeCost(0)).toBe(0);
    });

    it('should return 0 for negative ratings', () => {
      expect(calculateUpgradeCost(-1)).toBe(0);
      expect(calculateUpgradeCost(-5)).toBe(0);
    });
  });

  // Test that the cost progression matches SWN rules exactly
  describe('SWN cost curve validation', () => {
    it('should match the exact cost progression: 1, 2, 4, 6, 9, 12, 16, 20', () => {
      const expectedCosts = [2, 4, 6, 9, 12, 16, 20];
      const actualCosts = [1, 2, 3, 4, 5, 6, 7].map((rating) => calculateUpgradeCost(rating));
      
      expect(actualCosts).toEqual(expectedCosts);
    });
  });
});




