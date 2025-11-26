import { describe, it, expect } from 'vitest';
import { GOAL_METADATA, getGoalMetadata, getGoalsByCategory } from './goalMetadata';
import type { FactionGoalType } from '../types/faction';

describe('goalMetadata', () => {
  describe('GOAL_METADATA', () => {
    it('contains metadata for all 11 goal types', () => {
      const goalTypes: FactionGoalType[] = [
        'Military Conquest',
        'Commercial Expansion',
        'Intelligence Coup',
        'Planetary Seizure',
        'Expand Influence',
        'Blood the Enemy',
        'Peaceable Kingdom',
        'Destroy the Foe',
        'Inside Enemy Territory',
        'Invincible Valor',
        'Wealth of Worlds',
      ];

      goalTypes.forEach(type => {
        expect(GOAL_METADATA[type]).toBeDefined();
        expect(GOAL_METADATA[type].icon).toBeTruthy();
        expect(GOAL_METADATA[type].tooltip).toBeTruthy();
        expect(GOAL_METADATA[type].color).toBeTruthy();
      });
    });

    it('assigns unique icons to each goal', () => {
      const icons = Object.values(GOAL_METADATA).map(meta => meta.icon);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(11);
    });

    it('provides tooltips for all goals', () => {
      Object.values(GOAL_METADATA).forEach(meta => {
        expect(meta.tooltip.length).toBeGreaterThan(20); // Non-trivial tooltips
      });
    });
  });

  describe('getGoalMetadata', () => {
    it('returns metadata for valid goal type', () => {
      const metadata = getGoalMetadata('Military Conquest');
      expect(metadata).toBeDefined();
      expect(metadata?.icon).toBe('⚔️');
      expect(metadata?.tooltip).toContain('Force assets');
    });

    it('returns undefined for invalid goal type', () => {
      const metadata = getGoalMetadata('Invalid Goal' as FactionGoalType);
      expect(metadata).toBeUndefined();
    });
  });

  describe('getGoalsByCategory', () => {
    it('categorizes goals correctly', () => {
      const categories = getGoalsByCategory();

      expect(categories.Force).toContain('Military Conquest');
      expect(categories.Force).toContain('Invincible Valor');
      expect(categories.Force.length).toBe(2);

      expect(categories.Cunning).toContain('Intelligence Coup');
      expect(categories.Cunning).toContain('Inside Enemy Territory');
      expect(categories.Cunning.length).toBe(2);

      expect(categories.Wealth).toContain('Commercial Expansion');
      expect(categories.Wealth).toContain('Wealth of Worlds');
      expect(categories.Wealth.length).toBe(2);

      expect(categories.Mixed).toContain('Planetary Seizure');
      expect(categories.Mixed).toContain('Blood the Enemy');
      expect(categories.Mixed).toContain('Destroy the Foe');
      expect(categories.Mixed.length).toBe(3);

      expect(categories.Special).toContain('Expand Influence');
      expect(categories.Special).toContain('Peaceable Kingdom');
      expect(categories.Special.length).toBe(2);
    });

    it('categorizes all 11 goals', () => {
      const categories = getGoalsByCategory();
      const totalGoals = 
        categories.Force.length +
        categories.Cunning.length +
        categories.Wealth.length +
        categories.Mixed.length +
        categories.Special.length;

      expect(totalGoals).toBe(11);
    });
  });

  describe('Goal Icons', () => {
    it('uses appropriate icons for Force goals', () => {
      expect(GOAL_METADATA['Military Conquest'].icon).toBe('⚔️');
      expect(GOAL_METADATA['Invincible Valor'].icon).toBe('🛡️');
    });

    it('uses appropriate icons for Cunning goals', () => {
      expect(GOAL_METADATA['Intelligence Coup'].icon).toBe('🕵️');
      expect(GOAL_METADATA['Inside Enemy Territory'].icon).toBe('👁️');
    });

    it('uses appropriate icons for Wealth goals', () => {
      expect(GOAL_METADATA['Commercial Expansion'].icon).toBe('📈');
      expect(GOAL_METADATA['Wealth of Worlds'].icon).toBe('💰');
    });

    it('uses appropriate icons for Mixed goals', () => {
      expect(GOAL_METADATA['Planetary Seizure'].icon).toBe('🌍');
      expect(GOAL_METADATA['Blood the Enemy'].icon).toBe('💥');
      expect(GOAL_METADATA['Destroy the Foe'].icon).toBe('💀');
    });

    it('uses appropriate icons for Special goals', () => {
      expect(GOAL_METADATA['Expand Influence'].icon).toBe('🏛️');
      expect(GOAL_METADATA['Peaceable Kingdom'].icon).toBe('🕊️');
    });
  });
});



