// Helper utilities for generating and dispatching narrative entries from game actions

import type { AppDispatch } from '../store/store';
import type { RootState } from '../store/store';
import { addLogEntry } from '../store/slices/narrativeSlice';
import { generateLog, getNarrativeLogType, type ActionType, type NarrativeContext } from '../services/narrativeGenerator';
import type { Faction } from '../types/faction';
import type { StarSystem } from '../types/sector';

/**
 * Helper to generate and dispatch a narrative entry
 */
export function dispatchNarrativeEntry(
  dispatch: AppDispatch,
  actionType: ActionType,
  context: NarrativeContext & { relatedEntityIds?: string[] }
): void {
  const narrativeText = generateLog(actionType, context);
  const logType = getNarrativeLogType(actionType);

  dispatch(
    addLogEntry({
      text: narrativeText,
      type: logType,
      relatedEntityIds: context.relatedEntityIds || [],
    })
  );
}

/**
 * Creates narrative context from faction data
 */
export function createNarrativeContextFromFaction(
  faction: Faction | undefined,
  getSystemName: (systemId: string) => string,
  getSystem: (systemId: string) => StarSystem | undefined
): Partial<NarrativeContext> {
  if (!faction) {
    return {};
  }

  return {
    actorName: faction.name,
    actorTags: faction.tags,
    systemName: faction.homeworld ? getSystemName(faction.homeworld) : undefined,
    worldTags: faction.homeworld ? getSystem(faction.homeworld)?.primaryWorld?.tags : undefined,
  };
}

/**
 * Creates narrative context for a target faction
 */
export function createNarrativeContextFromTargetFaction(
  faction: Faction | undefined,
  getSystemName: (systemId: string) => string,
  getSystem: (systemId: string) => StarSystem | undefined
): Partial<NarrativeContext> {
  if (!faction) {
    return {};
  }

  return {
    targetName: faction.name,
    targetTags: faction.tags,
  };
}

/**
 * Creates narrative context for a system
 */
export function createNarrativeContextFromSystem(
  system: StarSystem | undefined
): Partial<NarrativeContext> {
  if (!system) {
    return {};
  }

  return {
    systemName: system.name,
    worldTags: system.primaryWorld?.tags,
  };
}

