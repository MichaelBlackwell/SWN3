// Faction types based on SWN rules and PRD

export type FactionType =
  | 'Government'
  | 'Corporation'
  | 'Religion'
  | 'Criminal Organization'
  | 'Mercenary Group'
  | 'Rebel Movement'
  | 'Eugenics Cult'
  | 'Colony'
  | 'Regional Hegemon'
  | 'Other';

export type FactionTag =
  | 'Colonists'
  | 'Deep Rooted'
  | 'Eugenics Cult'
  | 'Exchange Consulate'
  | 'Fanatical'
  | 'Imperialists'
  | 'Machiavellian'
  | 'Mercenary Group'
  | 'Perimeter Agency'
  | 'Pirates'
  | 'Planetary Government'
  | 'Plutocratic'
  | 'Preceptor Archive'
  | 'Psychic Academy'
  | 'Savage'
  | 'Scavengers'
  | 'Secretive'
  | 'Technical Expertise'
  | 'Theocratic'
  | 'Warlike';

export type FactionGoalType =
  | 'Military Conquest'
  | 'Commercial Expansion'
  | 'Intelligence Coup'
  | 'Planetary Seizure'
  | 'Expand Influence'
  | 'Blood the Enemy'
  | 'Peaceable Kingdom'
  | 'Destroy the Foe'
  | 'Inside Enemy Territory'
  | 'Invincible Valor'
  | 'Wealth of Worlds';

export interface FactionAttributes {
  hp: number;
  maxHp: number;
  force: number;
  cunning: number;
  wealth: number;
}

export interface FactionGoal {
  type: FactionGoalType;
  requirements: Record<string, unknown>;
  progress: Record<string, unknown>;
}

export interface FactionAsset {
  id: string; // Unique instance ID
  definitionId: string; // References AssetDefinition.id from asset library
  location: string; // systemId where the asset is located
  hp: number; // Current hit points
  maxHp: number; // Maximum hit points
  stealthed: boolean; // Whether asset is hidden
  purchasedTurn?: number; // Optional: track when purchased for turn-based rules
}

export interface Faction {
  id: string;
  name: string;
  type: FactionType;
  homeworld: string; // systemId
  attributes: FactionAttributes;
  facCreds: number;
  tags: FactionTag[];
  goal: FactionGoal | null;
  assets: FactionAsset[];
}

