import type { FactionTag } from '../types/faction';

export interface FactionTagMetadata {
  description: string;
}

export const FACTION_TAG_METADATA: Record<FactionTag, FactionTagMetadata> = {
  Colonists: {
    description: 'Frontier settlers focused on expanding into new systems and building infrastructure from scratch.',
  },
  'Deep Rooted': {
    description: 'Entrenched local support and cultural legitimacy make this faction almost impossible to uproot.',
  },
  'Eugenics Cult': {
    description: 'Fanatics obsessed with engineered “perfection,” often reviled by neighboring powers.',
  },
  'Exchange Consulate': {
    description: 'Diplomatic brokers affiliated with the Exchange of Light who mediate disputes for mutual profit.',
  },
  Fanatical: {
    description: 'Driven by zealous belief; morale is unshakable even when diplomacy suffers.',
  },
  Imperialists: {
    description: 'Aggressively expansionist powers that live to seize territory and dominate rivals.',
  },
  Machiavellian: {
    description: 'Masters of intrigue, leverage, and subtle manipulation behind the scenes.',
  },
  'Mercenary Group': {
    description: 'Professional soldiers for hire with reputations built on reliable battlefield performance.',
  },
  'Perimeter Agency': {
    description: 'Post-Scream watchdogs trained to monitor pretech dangers and unbraked AIs.',
  },
  Pirates: {
    description: 'Raiders, smugglers, and corsairs who thrive on interdiction and plunder.',
  },
  'Planetary Government': {
    description: 'Recognized ruling authority of a world with bureaucrats, armies, and tax collectors.',
  },
  Plutocratic: {
    description: 'Wealthy elites dominate leadership, policy, and strategic priorities.',
  },
  'Preceptor Archive': {
    description: 'Scholars safeguarding libraries and oral traditions dating back before the Scream.',
  },
  'Psychic Academy': {
    description: 'Institution dedicated to training and regulating psionic talent across the sector.',
  },
  Savage: {
    description: 'Feared for ruthless tactics and unwillingness to offer mercy once battle is joined.',
  },
  Scavengers: {
    description: 'Salvagers and junk magnates who strip ruins, hulks, and battlefields for profit.',
  },
  Secretive: {
    description: 'Operate behind layers of compartmentalization, leaks, and cutouts.',
  },
  'Technical Expertise': {
    description: 'Engineers and scientists provide cutting-edge support, fabrication, and analysis.',
  },
  Theocratic: {
    description: 'Clerical leadership merges faith and governance under divine mandate.',
  },
  Warlike: {
    description: 'Honor, glory, or simple brutality push this faction toward constant conflict.',
  },
};


