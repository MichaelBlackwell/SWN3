// Narrative Generator Service
// Constructs narrative text based on faction actions and game events

import type { NarrativeLogType } from '../store/slices/narrativeSlice';
import type { FactionTag } from '../types/faction';

/**
 * Types of actions that can generate narrative
 */
export type ActionType =
  | 'Attack'
  | 'Move'
  | 'Buy'
  | 'Repair'
  | 'UseAbility'
  | 'ExpandInfluence'
  | 'Income'
  | 'Maintenance'
  | 'AssetDestroyed'
  | 'FactionDamaged'
  | 'Unknown';

/**
 * Result of an action that affects narrative generation
 */
export type ActionResult = 'Success' | 'Failure' | 'Partial' | 'Tie';

/**
 * Context information for narrative generation
 */
export interface NarrativeContext {
  actorName?: string; // Faction or entity performing the action
  targetName?: string; // Faction, asset, or entity being targeted
  assetName?: string; // Asset involved in the action
  systemName?: string; // Star system location
  damage?: number; // Amount of damage dealt
  credits?: number; // FacCreds amount
  result?: ActionResult; // Success/failure of the action
  actorTags?: FactionTag[]; // Tags of the faction performing the action
  targetTags?: FactionTag[]; // Tags of the target faction
  worldTags?: string[]; // World tags of the system/location where action occurs
}

/**
 * Tag-specific template overrides
 * These templates take priority over generic templates when matching tags are present
 */
const tagSpecificTemplates: Record<
  string, // Tag name (faction tag or world tag)
  Partial<Record<ActionType, Partial<Record<ActionResult | 'default', string[]>>>>
> = {
  // Faction Tags
  Savage: {
    Attack: {
      Success: [
        '{ActorName} unleashed brutal, savage fury upon {TargetName}',
        '{ActorName} tore into {TargetName} with primitive ferocity',
        'The savagery of {ActorName} overwhelmed {TargetName}',
        '{ActorName} showed no mercy in their assault on {TargetName}',
      ],
      Failure: [
        '{ActorName} savage attack was repelled by {TargetName}',
        '{TargetName} proved too civilized for {ActorName} brutish tactics',
      ],
    },
  },
  Warlike: {
    Attack: {
      Success: [
        '{ActorName} war machine crushed {TargetName}',
        '{ActorName} demonstrated their martial superiority over {TargetName}',
        'The warlike {ActorName} proved victorious against {TargetName}',
        '{ActorName} military might overwhelmed {TargetName}',
      ],
      Failure: [
        '{TargetName} stood firm against {ActorName} aggressive assault',
        '{ActorName} warlike advance was halted by {TargetName}',
      ],
    },
  },
  Fanatical: {
    Attack: {
      Success: [
        '{ActorName} fanatical zealotry drove them to victory over {TargetName}',
        'Driven by fanaticism, {ActorName} crushed {TargetName}',
        '{ActorName} faithful warriors overwhelmed {TargetName}',
      ],
      Failure: [
        '{TargetName} resisted {ActorName} fanatical crusade',
        '{ActorName} zealous assault was repelled by {TargetName}',
      ],
    },
  },
  Secretive: {
    Attack: {
      Success: [
        '{ActorName} struck from the shadows against {TargetName}',
        'Unknown operatives from {ActorName} eliminated {TargetName} assets',
        '{ActorName} clandestine operation succeeded against {TargetName}',
      ],
      Failure: [
        '{ActorName} secretive attack was exposed and repelled by {TargetName}',
      ],
    },
  },
  Pirates: {
    Attack: {
      Success: [
        '{ActorName} raiders plundered {TargetName}',
        '{ActorName} pirate fleet overwhelmed {TargetName}',
        'The pirates of {ActorName} looted {TargetName}',
      ],
      Failure: [
        '{TargetName} defenders repelled {ActorName} pirate raid',
      ],
    },
  },
  Imperialists: {
    ExpandInfluence: {
      Success: [
        '{ActorName} imperial expansion reached {SystemName}',
        '{ActorName} colonial ambitions extended to {SystemName}',
        '{SystemName} fell under {ActorName} imperial control',
      ],
    },
  },
  'Technical Expertise': {
    Repair: {
      Success: [
        '{ActorName} technical expertise restored {AssetName} to peak efficiency',
        '{ActorName} engineers completely rebuilt {AssetName}',
      ],
    },
    Buy: {
      Success: [
        '{ActorName} technical specialists acquired {AssetName}',
        '{ActorName} procured {AssetName} through technical channels',
      ],
    },
  },
  Plutocratic: {
    Buy: {
      Success: [
        '{ActorName} wealth purchased {AssetName} with ease',
        '{ActorName} plutocrats acquired {AssetName} through financial means',
      ],
    },
    Income: {
      Success: [
        '{ActorName} plutocratic networks generated {Credits} FacCreds',
        'The wealth of {ActorName} grew by {Credits} FacCreds',
      ],
    },
  },
  
  // World Tags
  'Radioactive World': {
    Attack: {
      Success: [
        '{ActorName} attacked {TargetName} despite the radioactive hazards of {SystemName}',
        'Amid the radiation of {SystemName}, {ActorName} defeated {TargetName}',
      ],
      Failure: [
        'The radioactive environment of {SystemName} hampered {ActorName} attack on {TargetName}',
      ],
    },
  },
  'Police State': {
    ExpandInfluence: {
      Success: [
        '{ActorName} established influence on {SystemName} despite its police state',
        '{ActorName} infiltrated {SystemName} repressive regime',
      ],
      Failure: [
        '{SystemName} police state resisted {ActorName} expansion',
      ],
    },
  },
  'Civil War': {
    Attack: {
      Success: [
        '{ActorName} exploited the civil war on {SystemName} to attack {TargetName}',
        'Amid {SystemName} civil war, {ActorName} struck at {TargetName}',
      ],
    },
  },
  'Trade Hub': {
    Buy: {
      Success: [
        '{ActorName} purchased {AssetName} at {SystemName} bustling trade hub',
      ],
    },
    Income: {
      Success: [
        '{ActorName} trade routes through {SystemName} generated {Credits} FacCreds',
      ],
    },
  },
  'Battleground': {
    Attack: {
      Success: [
        '{SystemName} war-torn surface saw {ActorName} defeat {TargetName}',
        '{ActorName} added another victory to {SystemName} battleground history',
      ],
    },
  },
  'Prison Planet': {
    ExpandInfluence: {
      Success: [
        '{ActorName} established control over {SystemName} prison planet',
        '{ActorName} infiltrated {SystemName} penal colony',
      ],
    },
  },
  'Holy War': {
    Attack: {
      Success: [
        '{ActorName} holy crusade against {TargetName} on {SystemName} succeeded',
        'The religious war on {SystemName} saw {ActorName} triumph over {TargetName}',
      ],
    },
  },
};

/**
 * Template library for different action types
 * These are the default/generic templates, used when no tag-specific templates match
 */
const narrativeTemplates: Record<
  ActionType,
  {
    Success?: string[];
    Failure?: string[];
    Partial?: string[];
    Tie?: string[];
    default: string[];
  }
> = {
  Attack: {
    Success: [
      '{ActorName} successfully assaulted {TargetName}',
      '{ActorName} launched a devastating strike against {TargetName}',
      '{ActorName} overwhelmed {TargetName} in combat',
      'Forces from {ActorName} crushed {TargetName}',
      '{ActorName} achieved victory over {TargetName}',
    ],
    Failure: [
      '{ActorName} failed to breach {TargetName} defenses',
      '{TargetName} repelled the attack from {ActorName}',
      '{ActorName} assault on {TargetName} was unsuccessful',
      'Defenders from {TargetName} held off {ActorName}',
      '{ActorName} attack on {TargetName} was thwarted',
    ],
    Tie: [
      '{ActorName} and {TargetName} clashed to a standstill',
      'The conflict between {ActorName} and {TargetName} ended in a draw',
      '{ActorName} and {TargetName} fought to a stalemate',
    ],
    Partial: [
      '{ActorName} partially succeeded against {TargetName}',
      '{ActorName} achieved limited success against {TargetName}',
    ],
    default: [
      '{ActorName} engaged {TargetName} in conflict',
    ],
  },
  Move: {
    Success: [
      '{ActorName} relocated {AssetName} to {SystemName}',
      '{ActorName} successfully moved {AssetName} to {SystemName}',
      '{AssetName} was transported to {SystemName} by {ActorName}',
      '{ActorName} deployed {AssetName} to {SystemName}',
    ],
    Failure: [
      '{ActorName} failed to move {AssetName}',
      'Movement of {AssetName} by {ActorName} was interrupted',
      '{ActorName} could not relocate {AssetName}',
    ],
    Partial: [
      '{ActorName} partially relocated {AssetName}',
    ],
    default: [
      '{ActorName} attempted to move {AssetName}',
    ],
  },
  Buy: {
    Success: [
      '{ActorName} purchased {AssetName}',
      '{ActorName} acquired {AssetName}',
      '{ActorName} added {AssetName} to their forces',
      '{ActorName} secured {AssetName}',
    ],
    Failure: [
      '{ActorName} could not afford {AssetName}',
      '{ActorName} purchase of {AssetName} was blocked',
      'Insufficient resources prevented {ActorName} from acquiring {AssetName}',
    ],
    Partial: [
      '{ActorName} partially acquired {AssetName}',
    ],
    default: [
      '{ActorName} attempted to purchase {AssetName}',
    ],
  },
  Repair: {
    Success: [
      '{ActorName} restored {AssetName} to full capacity',
      '{ActorName} successfully repaired {AssetName}',
      '{AssetName} was fully restored by {ActorName}',
      '{ActorName} rebuilt {AssetName}',
    ],
    Failure: [
      '{ActorName} could not repair {AssetName}',
      'Repair efforts by {ActorName} on {AssetName} failed',
      '{ActorName} lacked resources to restore {AssetName}',
    ],
    Partial: [
      '{ActorName} partially repaired {AssetName}',
    ],
    default: [
      '{ActorName} attempted to repair {AssetName}',
    ],
  },
  UseAbility: {
    Success: [
      '{ActorName} activated {AssetName} special ability',
      '{ActorName} successfully used {AssetName}',
      '{ActorName} leveraged {AssetName} capabilities',
    ],
    Failure: [
      '{ActorName} failed to activate {AssetName}',
      '{AssetName} ability activation by {ActorName} was unsuccessful',
    ],
    Partial: [
      '{ActorName} partially activated {AssetName}',
    ],
    default: [
      '{ActorName} attempted to use {AssetName}',
    ],
  },
  ExpandInfluence: {
    Success: [
      '{ActorName} established influence on {SystemName}',
      '{ActorName} expanded their presence to {SystemName}',
      '{ActorName} gained a foothold on {SystemName}',
      '{ActorName} set up operations on {SystemName}',
    ],
    Failure: [
      '{ActorName} failed to expand influence to {SystemName}',
      '{SystemName} rejected {ActorName} expansion attempts',
      '{ActorName} could not establish presence on {SystemName}',
    ],
    Partial: [
      '{ActorName} partially established influence on {SystemName}',
    ],
    default: [
      '{ActorName} attempted to expand influence',
    ],
  },
  Income: {
    Success: [
      '{ActorName} collected {Credits} FacCreds',
      '{ActorName} generated {Credits} FacCreds in income',
      '{ActorName} received {Credits} FacCreds',
    ],
    default: [
      '{ActorName} processed income',
    ],
  },
  Maintenance: {
    Success: [
      '{ActorName} paid maintenance costs',
      '{ActorName} maintained their assets',
    ],
    Failure: [
      '{ActorName} could not afford maintenance',
      '{ActorName} assets deteriorated due to lack of maintenance',
    ],
    default: [
      '{ActorName} processed maintenance',
    ],
  },
  AssetDestroyed: {
    Success: [
      '{AssetName} was destroyed',
      '{AssetName} was eliminated',
      '{ActorName} lost {AssetName}',
    ],
    default: [
      '{AssetName} was destroyed',
    ],
  },
  FactionDamaged: {
    Success: [
      '{TargetName} suffered {Damage} damage',
      '{TargetName} cohesion weakened by {Damage} points',
      '{TargetName} took {Damage} damage',
    ],
    default: [
      '{TargetName} was damaged',
    ],
  },
  Unknown: {
    default: [
      '{ActorName} performed an action',
      'An action was taken',
      'Events transpired',
    ],
  },
};

/**
 * Replaces template placeholders with actual values
 */
function replacePlaceholders(template: string, context: NarrativeContext): string {
  let result = template;

  // Replace standard placeholders
  if (context.actorName) {
    result = result.replace(/{ActorName}/g, context.actorName);
  }
  if (context.targetName) {
    result = result.replace(/{TargetName}/g, context.targetName);
  }
  if (context.assetName) {
    result = result.replace(/{AssetName}/g, context.assetName);
  }
  if (context.systemName) {
    result = result.replace(/{SystemName}/g, context.systemName);
  }
  if (context.damage !== undefined) {
    result = result.replace(/{Damage}/g, context.damage.toString());
  }
  if (context.credits !== undefined) {
    result = result.replace(/{Credits}/g, context.credits.toString());
  }

  // Remove any remaining placeholders (in case they weren't provided)
  result = result.replace(/{[^}]+}/g, '[unknown]');

  return result;
}

/**
 * Selects a random template from an array
 */
function selectRandomTemplate(templates: string[]): string {
  if (templates.length === 0) {
    return 'An event occurred';
  }
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Determines the narrative log type based on action type
 */
function getLogType(actionType: ActionType): NarrativeLogType {
  switch (actionType) {
    case 'Attack':
    case 'AssetDestroyed':
    case 'FactionDamaged':
      return 'combat';
    case 'Buy':
    case 'Income':
    case 'Maintenance':
      return 'economic';
    case 'Move':
    case 'ExpandInfluence':
      return 'movement';
    case 'UseAbility':
      return 'general';
    case 'Repair':
      return 'system';
    default:
      return 'general';
  }
}

/**
 * Checks if tag-specific templates exist for the given tags and action
 * Returns templates if found, null otherwise
 */
function getTagSpecificTemplates(
  actionType: ActionType,
  result: ActionResult | 'default',
  tags: string[]
): string[] | null {
  // Check each tag for specific templates
  for (const tag of tags) {
    const tagTemplates = tagSpecificTemplates[tag];
    if (tagTemplates && tagTemplates[actionType]) {
      const actionTemplates = tagTemplates[actionType]!;
      const resultTemplates = actionTemplates[result] || actionTemplates.default;
      if (resultTemplates && resultTemplates.length > 0) {
        return resultTemplates;
      }
    }
  }
  return null;
}

/**
 * Generates a narrative log entry based on action type and context
 * @param actionType The type of action that occurred
 * @param context Context information about the action
 * @returns A narrative text string
 */
export function generateLog(
  actionType: ActionType,
  context: NarrativeContext
): string {
  // Determine which result template to use
  const result = context.result || 'default';
  
  // Collect all relevant tags (actor tags have priority, then target tags, then world tags)
  const allTags: string[] = [];
  if (context.actorTags) {
    allTags.push(...context.actorTags);
  }
  if (context.targetTags) {
    allTags.push(...context.targetTags);
  }
  if (context.worldTags) {
    allTags.push(...context.worldTags);
  }

  // Try to get tag-specific templates (prioritize actor tags first)
  let templates: string[] | null = null;
  if (context.actorTags) {
    templates = getTagSpecificTemplates(actionType, result, context.actorTags);
  }
  
  // If no actor tag templates, try target tags
  if (!templates && context.targetTags) {
    templates = getTagSpecificTemplates(actionType, result, context.targetTags);
  }
  
  // If no target tag templates, try world tags
  if (!templates && context.worldTags) {
    templates = getTagSpecificTemplates(actionType, result, context.worldTags);
  }
  
  // If still no tag-specific templates, try all tags together
  if (!templates && allTags.length > 0) {
    templates = getTagSpecificTemplates(actionType, result, allTags);
  }
  
  // Fall back to generic templates if no tag-specific templates found
  if (!templates) {
    const actionTemplates = narrativeTemplates[actionType] || narrativeTemplates.Unknown;
    templates = actionTemplates[result] || actionTemplates.default || narrativeTemplates.Unknown.default;
  }

  // Select a random template and replace placeholders
  const selectedTemplate = selectRandomTemplate(templates);
  return replacePlaceholders(selectedTemplate, context);
}

/**
 * Gets the narrative log type for a given action type
 * Useful when creating log entries in the Redux store
 */
export function getNarrativeLogType(actionType: ActionType): NarrativeLogType {
  return getLogType(actionType);
}

