import type { Faction } from '../types/faction';
import { getAssetById } from '../data/assetLibrary';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAssetPurchase(
  faction: Faction,
  assetDefinitionId: string
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

  return { valid: true };
}












