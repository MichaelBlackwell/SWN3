import type { Faction } from '../types/faction';
import type { StarSystem } from '../types/sector';
import { getAssetById } from '../data/assetLibrary';
import { hasBaseOfInfluence } from './expandInfluence';
import { canPurchaseExclusiveAsset, factionHasTag, getEffectiveTechLevel } from './tagModifiers';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface AssetPurchaseContext {
  /**
   * Resolved system object where the asset will be placed.
   */
  targetSystem?: StarSystem | null;
  /**
   * Optional list of systems used to resolve systemId when a system object isn't passed.
   */
  systems?: StarSystem[];
  /**
   * Target system ID (used when combined with systems array).
   */
  systemId?: string;
}

function resolveTargetSystem(context: AssetPurchaseContext, fallbackSystemId?: string): StarSystem | undefined {
  if (context.targetSystem) {
    return context.targetSystem;
  }

  if (context.systemId && context.systems) {
    return context.systems.find((system) => system.id === context.systemId);
  }

  if (fallbackSystemId && context.systems) {
    return context.systems.find((system) => system.id === fallbackSystemId);
  }

  return undefined;
}

export function validateAssetPurchase(
  faction: Faction,
  assetDefinitionId: string,
  context: AssetPurchaseContext = {}
): ValidationResult {
  const assetDef = getAssetById(assetDefinitionId);
  
  if (!assetDef) {
    return {
      valid: false,
      reason: 'Asset definition not found',
    };
  }

  // Check if faction has enough credits
  if (faction.facCreds < assetDef.cost) {
    return {
      valid: false,
      reason: `Insufficient FacCreds. Need ${assetDef.cost}, have ${faction.facCreds}`,
    };
  }

  // Check if faction has required rating
  const requiredRating = assetDef.requiredRating;
  const hasRating =
    assetDef.category === 'Force'
      ? faction.attributes.force >= requiredRating
      : assetDef.category === 'Cunning'
        ? faction.attributes.cunning >= requiredRating
        : faction.attributes.wealth >= requiredRating;

  if (!hasRating) {
    const currentRating =
      assetDef.category === 'Force'
        ? faction.attributes.force
        : assetDef.category === 'Cunning'
          ? faction.attributes.cunning
          : faction.attributes.wealth;

    return {
      valid: false,
      reason: `Insufficient ${assetDef.category} rating. Need ${requiredRating}, have ${currentRating}`,
    };
  }

  if (!canPurchaseExclusiveAsset(faction, assetDefinitionId)) {
    return {
      valid: false,
      reason: 'This asset requires a specific faction tag to purchase.',
    };
  }

  const targetSystem = resolveTargetSystem(context, faction.homeworld);

  if (targetSystem) {
    const isHomeworld = targetSystem.id === faction.homeworld;
    const hasBase = hasBaseOfInfluence(faction, targetSystem.id);
    const hasBoI = hasBase || isHomeworld;
    const worldTechLevel = targetSystem.primaryWorld.techLevel ?? 0;
    const effectiveTechLevel = getEffectiveTechLevel(faction, worldTechLevel, {
      isHomeworld,
      hasBaseOfInfluence: hasBoI,
    });

    if (assetDef.techLevel > effectiveTechLevel) {
      return {
        valid: false,
        reason: `Requires tech level ${assetDef.techLevel}, but ${targetSystem.name} is effectively TL${effectiveTechLevel}.`,
      };
    }

    if (assetDef.specialFlags.requiresPermission) {
      const controlsHomeworld =
        isHomeworld && (factionHasTag(faction, 'Planetary Government') || factionHasTag(faction, 'Colonists'));
      const controlsWorld = hasBase && factionHasTag(faction, 'Planetary Government');

      if (!controlsHomeworld && !controlsWorld) {
        return {
          valid: false,
          reason: `${targetSystem.name} requires planetary government permission to raise ${assetDef.name}.`,
        };
      }
    }
  }

  return { valid: true };
}












