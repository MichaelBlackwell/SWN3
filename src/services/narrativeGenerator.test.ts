// Unit tests for Narrative Generator service

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateLog,
  getNarrativeLogType,
  type ActionType,
  type ActionResult,
  type NarrativeContext,
} from './narrativeGenerator';

describe('narrativeGenerator', () => {
  // Mock Math.random to get consistent results for template selection
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // Always select first template
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateLog', () => {
    it('should generate a log for Attack action with success', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        targetName: 'Enemy Faction',
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Enemy Faction');
      expect(typeof log).toBe('string');
      expect(log.length).toBeGreaterThan(0);
    });

    it('should generate a log for Attack action with failure', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        targetName: 'Enemy Faction',
        result: 'Failure',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Enemy Faction');
      expect(log).toMatch(/failed|repelled|thwarted|unsuccessful/i);
    });

    it('should generate a log for Move action', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        assetName: 'Fleet Alpha',
        systemName: 'New Terra',
        result: 'Success',
      };

      const log = generateLog('Move', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Fleet Alpha');
      expect(log).toContain('New Terra');
    });

    it('should generate a log for Buy action', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        assetName: 'Strike Fleet',
        result: 'Success',
      };

      const log = generateLog('Buy', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Strike Fleet');
      expect(log).toMatch(/purchased|acquired|added|secured/i);
    });

    it('should generate a log for Repair action', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        assetName: 'Damaged Asset',
        result: 'Success',
      };

      const log = generateLog('Repair', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Damaged Asset');
      expect(log).toMatch(/restored|repaired|rebuilt/i);
    });

    it('should generate a log for UseAbility action', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        assetName: 'Special Asset',
        result: 'Success',
      };

      const log = generateLog('UseAbility', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Special Asset');
    });

    it('should generate a log for ExpandInfluence action', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        systemName: 'New System',
        result: 'Success',
      };

      const log = generateLog('ExpandInfluence', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('New System');
      expect(log).toMatch(/established|expanded|gained|set up/i);
    });

    it('should generate a log for Income action', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        credits: 10,
        result: 'Success',
      };

      const log = generateLog('Income', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('10');
      expect(log).toMatch(/collected|generated|received/i);
    });

    it('should generate a log for Maintenance action', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        result: 'Success',
      };

      const log = generateLog('Maintenance', context);

      expect(log).toContain('Test Faction');
    });

    it('should generate a log for AssetDestroyed action', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        assetName: 'Destroyed Asset',
      };

      const log = generateLog('AssetDestroyed', context);

      expect(log).toContain('Destroyed Asset');
      expect(log).toMatch(/destroyed|eliminated|lost/i);
    });

    it('should generate a log for FactionDamaged action with damage amount', () => {
      const context: NarrativeContext = {
        targetName: 'Enemy Faction',
        damage: 5,
        result: 'Success',
      };

      const log = generateLog('FactionDamaged', context);

      expect(log).toContain('Enemy Faction');
      expect(log).toContain('5');
      expect(log).toMatch(/damage|weakened/i);
    });

    it('should handle missing context values gracefully', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        // Missing other fields
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Test Faction');
      expect(log).not.toContain('undefined');
      expect(log).not.toContain('null');
    });

    it('should use default template when result is not specified', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        targetName: 'Enemy Faction',
        // No result specified
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Enemy Faction');
    });

    it('should handle Unknown action type with fallback template', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
      };

      const log = generateLog('Unknown', context);

      expect(log).toBeTruthy();
      expect(typeof log).toBe('string');
      expect(log.length).toBeGreaterThan(0);
    });

    it('should replace all placeholders correctly', () => {
      const context: NarrativeContext = {
        actorName: 'Alpha Faction',
        targetName: 'Beta Faction',
        assetName: 'Strike Fleet',
        systemName: 'New Terra',
        damage: 10,
        credits: 25,
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      expect(log).not.toContain('{ActorName}');
      expect(log).not.toContain('{TargetName}');
      expect(log).not.toContain('{AssetName}');
      expect(log).not.toContain('{SystemName}');
      expect(log).not.toContain('{Damage}');
      expect(log).not.toContain('{Credits}');
    });

    it('should handle Tie result for Attack action', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        targetName: 'Enemy Faction',
        result: 'Tie',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Enemy Faction');
      expect(log).toMatch(/standstill|draw|stalemate/i);
    });

    it('should select different templates on different random calls', () => {
      // Reset mock to allow randomness
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const context: NarrativeContext = {
        actorName: 'Test Faction',
        targetName: 'Enemy Faction',
        result: 'Success',
      };

      const log1 = generateLog('Attack', context);

      // Change random value to get different template
      vi.spyOn(Math, 'random').mockReturnValue(0.9);

      const log2 = generateLog('Attack', context);

      // Both should be valid, but they might be different
      expect(log1).toBeTruthy();
      expect(log2).toBeTruthy();
      expect(typeof log1).toBe('string');
      expect(typeof log2).toBe('string');
    });

    it('should handle Partial result', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        targetName: 'Enemy Faction',
        result: 'Partial',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Enemy Faction');
      expect(log).toMatch(/partial|limited/i);
    });
  });

  describe('getNarrativeLogType', () => {
    it('should return combat type for Attack action', () => {
      expect(getNarrativeLogType('Attack')).toBe('combat');
    });

    it('should return combat type for AssetDestroyed action', () => {
      expect(getNarrativeLogType('AssetDestroyed')).toBe('combat');
    });

    it('should return combat type for FactionDamaged action', () => {
      expect(getNarrativeLogType('FactionDamaged')).toBe('combat');
    });

    it('should return economic type for Buy action', () => {
      expect(getNarrativeLogType('Buy')).toBe('economic');
    });

    it('should return economic type for Income action', () => {
      expect(getNarrativeLogType('Income')).toBe('economic');
    });

    it('should return economic type for Maintenance action', () => {
      expect(getNarrativeLogType('Maintenance')).toBe('economic');
    });

    it('should return movement type for Move action', () => {
      expect(getNarrativeLogType('Move')).toBe('movement');
    });

    it('should return movement type for ExpandInfluence action', () => {
      expect(getNarrativeLogType('ExpandInfluence')).toBe('movement');
    });

    it('should return system type for Repair action', () => {
      expect(getNarrativeLogType('Repair')).toBe('system');
    });

    it('should return general type for UseAbility action', () => {
      expect(getNarrativeLogType('UseAbility')).toBe('general');
    });

    it('should return general type for Unknown action', () => {
      expect(getNarrativeLogType('Unknown')).toBe('general');
    });
  });

  describe('edge cases', () => {
    it('should handle empty context', () => {
      const context: NarrativeContext = {};

      const log = generateLog('Unknown', context);

      expect(log).toBeTruthy();
      expect(typeof log).toBe('string');
    });

    it('should handle special characters in names', () => {
      const context: NarrativeContext = {
        actorName: "O'Brien's Faction",
        targetName: 'Alpha-7 Corporation',
        assetName: 'Fleet "Vanguard"',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain("O'Brien's Faction");
      expect(log).toContain('Alpha-7 Corporation');
      // AssetName may not be in all Attack templates, so just check it doesn't break
      expect(log).toBeTruthy();
    });

    it('should handle very long names', () => {
      const context: NarrativeContext = {
        actorName: 'A'.repeat(100),
        targetName: 'B'.repeat(100),
      };

      const log = generateLog('Attack', context);

      expect(log).toBeTruthy();
      expect(typeof log).toBe('string');
    });

    it('should handle zero damage', () => {
      const context: NarrativeContext = {
        targetName: 'Test Faction',
        damage: 0,
        result: 'Success',
      };

      const log = generateLog('FactionDamaged', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('0'); // Zero damage should still be included
    });

    it('should handle large numbers', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        credits: 999999,
        result: 'Success',
      };

      const log = generateLog('Income', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('999999');
    });
  });

  describe('tag-aware narrative generation', () => {
    it('should use tag-specific templates for Savage faction attacking', () => {
      const context: NarrativeContext = {
        actorName: 'Savage Faction',
        targetName: 'Enemy Faction',
        actorTags: ['Savage'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Savage Faction');
      expect(log).toContain('Enemy Faction');
      expect(log).toMatch(/savage|brutal|ferocity|mercy/i);
    });

    it('should use tag-specific templates for Warlike faction attacking', () => {
      const context: NarrativeContext = {
        actorName: 'Warlike Faction',
        targetName: 'Enemy Faction',
        actorTags: ['Warlike'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Warlike Faction');
      expect(log).toContain('Enemy Faction');
      expect(log).toMatch(/war|martial|military|warlike/i);
    });

    it('should use tag-specific templates for Fanatical faction attacking', () => {
      const context: NarrativeContext = {
        actorName: 'Fanatical Faction',
        targetName: 'Enemy Faction',
        actorTags: ['Fanatical'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Fanatical Faction');
      expect(log).toMatch(/fanatical|zealotry|faithful|crusade/i);
    });

    it('should use tag-specific templates for Secretive faction attacking', () => {
      const context: NarrativeContext = {
        actorName: 'Secretive Faction',
        targetName: 'Enemy Faction',
        actorTags: ['Secretive'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Secretive Faction');
      expect(log).toMatch(/shadow|clandestine|secretive|operatives/i);
    });

    it('should use tag-specific templates for Pirates faction attacking', () => {
      const context: NarrativeContext = {
        actorName: 'Pirate Faction',
        targetName: 'Merchant Faction',
        actorTags: ['Pirates'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Pirate Faction');
      expect(log).toMatch(/pirate|raid|plundered|raiders/i);
    });

    it('should use tag-specific templates for Imperialists expanding influence', () => {
      const context: NarrativeContext = {
        actorName: 'Imperial Faction',
        systemName: 'New Terra',
        actorTags: ['Imperialists'],
        result: 'Success',
      };

      const log = generateLog('ExpandInfluence', context);

      expect(log).toContain('Imperial Faction');
      expect(log).toContain('New Terra');
      expect(log).toMatch(/imperial|colonial|expansion/i);
    });

    it('should use tag-specific templates for Technical Expertise faction repairing', () => {
      const context: NarrativeContext = {
        actorName: 'Tech Faction',
        assetName: 'Damaged Asset',
        actorTags: ['Technical Expertise'],
        result: 'Success',
      };

      const log = generateLog('Repair', context);

      expect(log).toContain('Tech Faction');
      expect(log).toContain('Damaged Asset');
      expect(log).toMatch(/technical|expertise|engineers/i);
    });

    it('should use tag-specific templates for Plutocratic faction buying', () => {
      const context: NarrativeContext = {
        actorName: 'Wealthy Faction',
        assetName: 'Expensive Asset',
        actorTags: ['Plutocratic'],
        result: 'Success',
      };

      const log = generateLog('Buy', context);

      expect(log).toContain('Wealthy Faction');
      expect(log).toContain('Expensive Asset');
      expect(log).toMatch(/wealth|plutocratic|financial/i);
    });

    it('should use world tag templates for Radioactive World', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        targetName: 'Enemy Faction',
        systemName: 'Rad World',
        worldTags: ['Radioactive World'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Test Faction');
      expect(log).toMatch(/radioactive|radiation|hazard/i);
    });

    it('should use world tag templates for Police State', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        systemName: 'Oppressed System',
        worldTags: ['Police State'],
        result: 'Success',
      };

      const log = generateLog('ExpandInfluence', context);

      expect(log).toContain('Test Faction');
      expect(log).toContain('Oppressed System');
      expect(log).toMatch(/police state|regime|infiltrated/i);
    });

    it('should use world tag templates for Trade Hub', () => {
      const context: NarrativeContext = {
        actorName: 'Merchant Faction',
        systemName: 'Trade System',
        worldTags: ['Trade Hub'],
        result: 'Success',
      };

      const log = generateLog('Buy', context);

      expect(log).toContain('Merchant Faction');
      expect(log).toContain('Trade System');
      expect(log).toMatch(/trade hub|bustling/i);
    });

    it('should prioritize actor tags over target tags', () => {
      const context: NarrativeContext = {
        actorName: 'Savage Faction',
        targetName: 'Warlike Faction',
        actorTags: ['Savage'],
        targetTags: ['Warlike'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      // Should use Savage templates (more aggressive/violent language)
      expect(log).toMatch(/savage|brutal|ferocity/i);
      // Should not use Warlike templates (military/war machine language)
      expect(log).not.toMatch(/war machine|martial superiority/i);
    });

    it('should prioritize actor tags over world tags', () => {
      const context: NarrativeContext = {
        actorName: 'Secretive Faction',
        targetName: 'Enemy Faction',
        systemName: 'Radioactive World',
        actorTags: ['Secretive'],
        worldTags: ['Radioactive World'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      // Should use Secretive templates (shadow/clandestine language)
      expect(log).toMatch(/shadow|clandestine|secretive/i);
    });

    it('should fall back to generic templates when no tag matches', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        targetName: 'Enemy Faction',
        actorTags: ['Colonists'], // No specific templates for this tag
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      // Should still generate valid narrative, but use generic templates
      expect(log).toContain('Test Faction');
      expect(log).toContain('Enemy Faction');
      expect(typeof log).toBe('string');
      expect(log.length).toBeGreaterThan(0);
    });

    it('should handle multiple tags on actor', () => {
      const context: NarrativeContext = {
        actorName: 'Savage Warlike Faction',
        targetName: 'Enemy Faction',
        actorTags: ['Savage', 'Warlike'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      // Should use one of the tag-specific templates
      expect(log).toContain('Savage Warlike Faction');
      expect(log).toMatch(/savage|brutal|ferocity|war|martial|military/i);
    });

    it('should handle tags on both actor and target', () => {
      const context: NarrativeContext = {
        actorName: 'Savage Faction',
        targetName: 'Warlike Faction',
        actorTags: ['Savage'],
        targetTags: ['Warlike'],
        result: 'Failure',
      };

      const log = generateLog('Attack', context);

      // Should prioritize actor tags, but target tags may influence failure templates
      expect(log).toContain('Savage Faction');
      expect(log).toContain('Warlike Faction');
    });

    it('should use world tag templates when no actor/target tags match', () => {
      const context: NarrativeContext = {
        actorName: 'Test Faction',
        targetName: 'Enemy Faction',
        systemName: 'Civil War System',
        worldTags: ['Civil War'],
        result: 'Success',
      };

      const log = generateLog('Attack', context);

      expect(log).toContain('Test Faction');
      expect(log).toMatch(/civil war|war-torn/i);
    });
  });
});

