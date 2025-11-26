/**
 * Seize Planet Validation and State Machine
 * 
 * Per SWN rules:
 * - The faction must destroy all enemy unstealthed assets on the planet
 * - If not completed in one turn, the faction must continue the attack next turn
 * - The faction can take no other actions until the seizure is complete or abandoned
 * - Once cleared, the faction must hold the planet for 3 turns with at least one unstealthed asset
 * - Success grants Planetary Government tag (replacing current government if any)
 * - Auto-completes Planetary Seizure goal if active
 */

import type { Faction, FactionAsset } from '../types/faction';
import type { StarSystem } from '../types/sector';

export interface SeizePlanetValidationResult {
  valid: boolean;
  reason?: string;
}

export interface SeizePlanetStatus {
  phase: 'clearing' | 'holding' | 'not_started' | 'complete';
  enemyAssetsRemaining: number;
  turnsHeld: number;
  turnsRequired: number;
  canComplete: boolean;
  factionHasAssets: boolean;
}

/**
 * Get all enemy (non-faction-owned) unstealthed assets on a planet
 */
export function getEnemyUnstealthedAssets(
  systemId: string,
  factionId: string,
  allFactions: Faction[]
): Array<{ asset: FactionAsset; factionId: string; factionName: string }> {
  const enemyAssets: Array<{ asset: FactionAsset; factionId: string; factionName: string }> = [];

  for (const faction of allFactions) {
    if (faction.id === factionId) continue; // Skip own faction

    for (const asset of faction.assets) {
      if (asset.location === systemId && !asset.stealthed) {
        enemyAssets.push({
          asset,
          factionId: faction.id,
          factionName: faction.name,
        });
      }
    }
  }

  return enemyAssets;
}

/**
 * Get faction's own unstealthed assets on a planet
 */
export function getFactionUnstealthedAssets(
  faction: Faction,
  systemId: string
): FactionAsset[] {
  return faction.assets.filter(
    (asset: FactionAsset) => asset.location === systemId && !asset.stealthed
  );
}

/**
 * Validate if a faction can start a seize planet campaign
 */
export function validateSeizePlanetStart(
  faction: Faction,
  systemId: string,
  allFactions: Faction[],
  systems: StarSystem[]
): SeizePlanetValidationResult {
  // Check if already in a campaign
  if (faction.seizePlanetCampaign) {
    return {
      valid: false,
      reason: `Already conducting a seizure campaign on ${systems.find(s => s.id === faction.seizePlanetCampaign?.targetSystemId)?.name || 'another planet'}.`,
    };
  }

  // Check if in homeworld transition
  if (faction.homeworldTransition) {
    return {
      valid: false,
      reason: 'Cannot start seizure while relocating homeworld.',
    };
  }

  // Check if faction has at least one asset on the planet
  const factionAssets = getFactionUnstealthedAssets(faction, systemId);
  if (factionAssets.length === 0) {
    return {
      valid: false,
      reason: 'Must have at least one unstealthed asset on the planet to begin seizure.',
    };
  }

  // Check if the planet has enemy assets to clear (otherwise it's instant)
  const enemyAssets = getEnemyUnstealthedAssets(systemId, faction.id, allFactions);
  if (enemyAssets.length === 0) {
    // Planet is clear, can start holding phase immediately
    return { valid: true };
  }

  // Has enemy assets to clear
  return { valid: true };
}

/**
 * Get the current status of a seize planet campaign
 */
export function getSeizePlanetStatus(
  faction: Faction,
  systemId: string,
  allFactions: Faction[]
): SeizePlanetStatus {
  const campaign = faction.seizePlanetCampaign;
  const enemyAssets = getEnemyUnstealthedAssets(systemId, faction.id, allFactions);
  const factionAssets = getFactionUnstealthedAssets(faction, systemId);

  // Not in a campaign
  if (!campaign || campaign.targetSystemId !== systemId) {
    return {
      phase: 'not_started',
      enemyAssetsRemaining: enemyAssets.length,
      turnsHeld: 0,
      turnsRequired: 3,
      canComplete: false,
      factionHasAssets: factionAssets.length > 0,
    };
  }

  // In a campaign
  if (campaign.phase === 'clearing') {
    return {
      phase: 'clearing',
      enemyAssetsRemaining: enemyAssets.length,
      turnsHeld: 0,
      turnsRequired: 3,
      canComplete: false,
      factionHasAssets: factionAssets.length > 0,
    };
  }

  // Holding phase
  return {
    phase: 'holding',
    enemyAssetsRemaining: enemyAssets.length,
    turnsHeld: campaign.turnsHeld,
    turnsRequired: 3,
    canComplete: campaign.turnsHeld >= 3 && enemyAssets.length === 0 && factionAssets.length > 0,
    factionHasAssets: factionAssets.length > 0,
  };
}

/**
 * Check if a seizure should fail (no assets on planet or enemy assets in holding phase)
 */
export function checkSeizureFailure(
  faction: Faction,
  allFactions: Faction[]
): { failed: boolean; reason?: string } {
  const campaign = faction.seizePlanetCampaign;
  if (!campaign) return { failed: false };

  const systemId = campaign.targetSystemId;
  const factionAssets = getFactionUnstealthedAssets(faction, systemId);
  const enemyAssets = getEnemyUnstealthedAssets(systemId, faction.id, allFactions);

  // Fail if faction has no unstealthed assets on the planet
  if (factionAssets.length === 0) {
    return {
      failed: true,
      reason: 'Seizure failed: No unstealthed assets remaining on planet.',
    };
  }

  // Fail if in holding phase and enemy unstealthed assets appear
  if (campaign.phase === 'holding' && enemyAssets.length > 0) {
    return {
      failed: true,
      reason: 'Seizure interrupted: Enemy assets appeared during holding phase.',
    };
  }

  return { failed: false };
}

/**
 * Check if seizure can advance to holding phase (all enemies cleared)
 */
export function canAdvanceToHolding(
  faction: Faction,
  allFactions: Faction[]
): boolean {
  const campaign = faction.seizePlanetCampaign;
  if (!campaign || campaign.phase !== 'clearing') return false;

  const enemyAssets = getEnemyUnstealthedAssets(campaign.targetSystemId, faction.id, allFactions);
  return enemyAssets.length === 0;
}

/**
 * Check if seizure is complete (held for 3 turns, no enemies, has assets)
 */
export function isSeizureComplete(
  faction: Faction,
  allFactions: Faction[]
): boolean {
  const campaign = faction.seizePlanetCampaign;
  if (!campaign || campaign.phase !== 'holding') return false;

  const systemId = campaign.targetSystemId;
  const factionAssets = getFactionUnstealthedAssets(faction, systemId);
  const enemyAssets = getEnemyUnstealthedAssets(systemId, faction.id, allFactions);

  return (
    campaign.turnsHeld >= 3 &&
    enemyAssets.length === 0 &&
    factionAssets.length > 0
  );
}

/**
 * Check if a faction can take other actions (not in a seizure campaign)
 */
export function canFactionTakeOtherActions(faction: Faction): { canAct: boolean; reason?: string } {
  if (faction.seizePlanetCampaign) {
    return {
      canAct: false,
      reason: `Must complete planet seizure campaign (${faction.seizePlanetCampaign.phase} phase).`,
    };
  }

  if (faction.homeworldTransition) {
    return {
      canAct: false,
      reason: `Homeworld transition in progress (${faction.homeworldTransition.turnsRemaining} turns remaining).`,
    };
  }

  return { canAct: true };
}


