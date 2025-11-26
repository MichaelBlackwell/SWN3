import type { FactionTag } from '../types/faction';

export interface FactionTagMetadata {
  description: string;
  effects: string[];
}

export const FACTION_TAG_METADATA: Record<FactionTag, FactionTagMetadata> = {
  Colonists: {
    description: 'Frontier settlers focused on expanding into new systems and building infrastructure from scratch.',
    effects: [
      'Homeworld counts as a Planetary Government for permission requirements.',
      'Treat the homeworld as Tech Level 4 when purchasing assets.',
    ],
  },
  'Deep Rooted': {
    description: 'Entrenched local support and cultural legitimacy make this faction almost impossible to uproot.',
    effects: [
      'Roll an extra defense die when protecting assets on the homeworld.',
      'Moving assets away from the homeworld costs an additional FacCred.',
    ],
  },
  'Eugenics Cult': {
    description: 'Fanatics obsessed with engineered “perfection,” often reviled by neighboring powers.',
    effects: [
      'Unlock the exclusive Gengineered Slaves asset.',
      'Once per turn, Gengineered Slaves roll an extra d10 on attack or defense.',
    ],
  },
  'Exchange Consulate': {
    description: 'Diplomatic brokers affiliated with the Exchange of Light who mediate disputes for mutual profit.',
    effects: [
      'Once per turn, roll an extra die when defending against Wealth attacks.',
      'On completing a Peaceable Kingdom goal, roll 1d6; on 4+, gain 1 bonus XP.',
    ],
  },
  Fanatical: {
    description: 'Driven by zealous belief; morale is unshakable even when diplomacy suffers.',
    effects: [
      'Always reroll combat dice that show a 1.',
      'Automatically lose combat ties if the opponent does not.',
    ],
  },
  Imperialists: {
    description: 'Aggressively expansionist powers that live to seize territory and dominate rivals.',
    effects: ['Roll an extra d10 on attacks that are part of a Seize Planet action.'],
  },
  Machiavellian: {
    description: 'Masters of intrigue, leverage, and subtle manipulation behind the scenes.',
    effects: ['Once per turn, roll an extra d10 when making a Cunning attack.'],
  },
  'Mercenary Group': {
    description: 'Professional soldiers for hire with reputations built on reliable battlefield performance.',
    effects: [
      'All assets can move to an adjacent world as an action.',
      'Standard 1 FacCred movement cost is waived.',
    ],
  },
  'Perimeter Agency': {
    description: 'Post-Scream watchdogs trained to monitor pretech dangers and unbraked AIs.',
    effects: [
      'Once per turn, roll an extra die when attacking Tech Level 5 assets.',
      'Gain an additional die on tests to detect Stealthed assets.',
    ],
  },
  Pirates: {
    description: 'Raiders, smugglers, and corsairs who thrive on interdiction and plunder.',
    effects: [
      'Charge enemies +1 FacCred when they move assets onto a world with your Base of Influence.',
      'Collect the toll payment whenever it is enforced.',
    ],
  },
  'Planetary Government': {
    description: 'Recognized ruling authority of a world with bureaucrats, armies, and tax collectors.',
    effects: [
      'Other factions require your permission to raise or import assets flagged with the P requirement.',
    ],
  },
  Plutocratic: {
    description: 'Wealthy elites dominate leadership, policy, and strategic priorities.',
    effects: [
      'Gain +25% FacCred income each turn.',
      'Once per turn, roll an extra d10 on Wealth attacks.',
    ],
  },
  'Preceptor Archive': {
    description: 'Scholars safeguarding libraries and oral traditions dating back before the Scream.',
    effects: [
      'Assets requiring TL4+ cost 1 fewer FacCred.',
      'May spend 2 FacCreds to roll 1d12; on 12, permanently treat a world as TL4 for this faction.',
    ],
  },
  'Psychic Academy': {
    description: 'Institution dedicated to training and regulating psionic talent across the sector.',
    effects: [
      'May provide psionic mentor training.',
      'Once per turn, can force a rival to reroll a single d10.',
    ],
  },
  Savage: {
    description: 'Feared for ruthless tactics and unwillingness to offer mercy once battle is joined.',
    effects: ['Once per turn, roll an extra defense die when a TL0 asset is attacked.'],
  },
  Scavengers: {
    description: 'Salvagers and junk magnates who strip ruins, hulks, and battlefields for profit.',
    effects: [
      'Gain +1 FacCred every time you destroy an asset or lose one of your own.',
      'Reduce maintenance costs by 1 FacCred per asset.',
    ],
  },
  Secretive: {
    description: 'Operate behind layers of compartmentalization, leaks, and cutouts.',
    effects: ['All newly purchased assets automatically begin Stealthed.'],
  },
  'Technical Expertise': {
    description: 'Engineers and scientists provide cutting-edge support, fabrication, and analysis.',
    effects: [
      'Worlds with your Base of Influence count as TL4.',
      'You may build Starship assets on any world with 10k+ inhabitants.',
    ],
  },
  Theocratic: {
    description: 'Clerical leadership merges faith and governance under divine mandate.',
    effects: ['Once per turn, roll an extra d10 when defending against Cunning attacks.'],
  },
  Warlike: {
    description: 'Honor, glory, or simple brutality push this faction toward constant conflict.',
    effects: ['Once per turn, roll an extra d10 on Force attacks.'],
  },
};




