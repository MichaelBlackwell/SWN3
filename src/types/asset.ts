// Asset type definitions for Stars Without Number faction assets

export type AssetCategory = 'Force' | 'Cunning' | 'Wealth';

export type AssetType =
  | 'Military Unit'
  | 'Special Forces'
  | 'Starship'
  | 'Facility'
  | 'Tactic'
  | 'Logistics Facility'
  | 'Special';

export type AttackType = 'Force' | 'Cunning' | 'Wealth';

export interface AttackPattern {
  attackerAttribute: AttackType;
  defenderAttribute: AttackType;
  damage: string; // e.g., "1d6", "2d4+2", "special"
}

export interface CounterattackPattern {
  damage: string; // e.g., "1d4", "2d6+3", "special", "None"
}

export interface AssetDefinition {
  id: string; // Unique identifier (e.g., "force_1_security_personnel")
  name: string;
  category: AssetCategory;
  requiredRating: number; // 1-8, the attribute rating needed to purchase
  hp: number;
  cost: number; // Purchase cost in FacCreds
  techLevel: number; // Minimum tech level required (0-5)
  type: AssetType;
  attack: AttackPattern | null; // null if asset cannot attack
  counterattack: CounterattackPattern | null; // null if no counterattack
  maintenance: number; // Per-turn maintenance cost (0 if none)
  specialFlags: {
    hasAction: boolean; // 'A' - can perform special actions
    hasSpecial: boolean; // 'S' - has special features/costs
    requiresPermission: boolean; // 'P' - needs planetary government permission
  };
  description?: string; // Flavor text or special rules description
}

// FactionAsset represents an instance of an asset owned by a faction
// This is different from AssetDefinition which is the template
export interface FactionAssetInstance {
  id: string; // Unique instance ID
  definitionId: string; // References AssetDefinition.id
  location: string; // systemId where the asset is located
  hp: number; // Current hit points
  maxHp: number; // Maximum hit points (from definition)
  stealthed: boolean; // Whether asset is hidden
  purchasedTurn?: number; // Optional: track when purchased
}






