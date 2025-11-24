# Faction Generator Implementation

## Overview
Replaced the generic faction generation system with a template-based system that creates contextually appropriate factions based on homeworld characteristics, following the *Stars Without Number* faction templates.

## Files Created

### `src/services/factionGenerator.ts`
New service that implements template-based faction generation with **23 predefined faction templates** organized into three power tiers:

#### Tier 1: Weak Factions (HP 15, Low Resources)
1. **Frontier Colony** - Struggling colonial governments on thinly-populated worlds
2. **Tribal Confederation** - Primitive societies with fierce warriors
3. **Resistance Cell** - Freedom fighters opposing tyranny
4. **Mining Consortium** - Resource extraction operations
5. **Pirate Fleet** - Raiders and outlaws preying on shipping
6. **Isolated Outpost** - Remote stations far from civilization

#### Tier 2: Moderate Factions (HP 20-29, Balanced Resources)
7. **Planetary Government** - Standard world governments
8. **Religious Order** - Powerful religious organizations
9. **Trade Syndicate** - Merchant consortiums
10. **Genetic Supremacists** - Eugenics cults (widely loathed)
11. **Mercenary Legion** - Professional soldiers for hire
12. **Criminal Syndicate** - Organized crime networks
13. **Tech Collective** - Technology preservationists
14. **Agricultural Cooperative** - Food producers with economic power
15. **Psychic Academy** - Schools for psychic training
16. **Military Junta** - Military governments ruling by force

#### Tier 3: Powerful Factions (HP 35-49, High Resources)
17. **Stellar Hegemon** - Mightiest military powers leading confederations
18. **Megacorporation** - Massive interstellar corporations
19. **Pretech Enclave** - Guardians of ancient technology
20. **Fallen Empire** - Once-mighty powers clinging to past glories
21. **Hive Mind Collective** - Linked consciousness through tech or psionics
22. **Warlord Coalition** - Alliance of military strongmen
23. **AI Sovereignty** - Independent artificial intelligence rulers

### Key Features:
- **Intelligent Selection**: Factions are automatically matched to homeworld characteristics
  - **Frontier Colony**: Population ≤ 2 with Tech Level ≥ 3
  - **Tribal Confederation**: Tech Level ≤ 2 with Population ≥ 2
  - **Resistance Cell**: Dictatorship, Tyranny, or Police State tags
  - **Mining Consortium**: Mining trade code or Heavy Mining tag
  - **Pirate Fleet**: Population ≤ 2 or Anarchy tag
  - **Isolated Outpost**: Population = 1
  - **Planetary Government**: Tech Level ≥ 3 and Population ≥ 3
  - **Religious Order**: Theocracy government or tag
  - **Trade Syndicate**: Rich or Trade Hub worlds
  - **Genetic Supremacists**: Altered Humanity or Eugenic Cult tags
  - **Mercenary Legion**: Mercenaries or Battleground tags
  - **Criminal Syndicate**: Population ≥ 4 or Cheap Life tag
  - **Tech Collective**: Tech Level ≥ 4 or High Tech tag
  - **Agricultural Cooperative**: Agricultural trade code
  - **Psychic Academy**: Psionics Academy or Worship tags
  - **Military Junta**: Military government or Warlords tag
  - **Stellar Hegemon**: Population ≥ 5, Tech Level ≥ 4, Regional Hegemon tag
  - **Megacorporation**: Population ≥ 5, Rich, and Megacorps tag
  - **Pretech Enclave**: Tech Level 5 or Alien Ruins tag
  - **Fallen Empire**: Population ≥ 4, Tech Level ≤ 3, Fallen Hegemon tag
  - **Hive Mind Collective**: Unbraked AI or Psionics Worship tags
  - **Warlord Coalition**: Warlords or Civil War tags
  - **AI Sovereignty**: Unbraked AI tag

- **Complete Faction Setup**: Each template includes:
  - Predefined attributes (Force, Cunning, Wealth, HP)
  - Starting assets appropriate to faction type
  - Faction tags
  - Automatic Base of Influence on homeworld

## Files Modified

### `src/data/assetLibrary.ts`
- Added **Gengineered Slaves** asset (Force 1, Cost 3) for Eugenics Cult template

### `src/services/sectorGeneratorWithConfig.ts`
- Replaced generic faction generation with template-based system
- Removed old faction name/type generation functions
- Now uses `generateRandomFactionForSystem()` for contextual faction creation

### `src/components/FactionManager/FactionCreationForm.tsx`
- Updated UI to support template-based creation
- Added **Auto-Generate** toggle (enabled by default)
  - When ON: Automatically generates appropriate faction for selected homeworld
  - When OFF: Allows manual template selection and custom naming
- Displays template descriptions to help users understand each faction type
- Shows preview of faction attributes based on selected template

### `src/App.tsx`
- Updated test faction creation to use new template-based system
- Test factions now generated contextually based on their homeworld

## Usage Examples

### Automatic Generation (Recommended)
```typescript
import { generateRandomFactionForSystem } from './services/factionGenerator';

const system = sector.systems[0];
const faction = generateRandomFactionForSystem(system);
// Faction is automatically matched to system characteristics
```

### Manual Template Selection
```typescript
import { generateFactionFromTemplate } from './services/factionGenerator';

const system = sector.systems[0];
const faction = generateFactionFromTemplate(
  'Regional Hegemon',
  system,
  'The Stellar Empire' // Optional custom name
);
```

### Get Available Templates
```typescript
import { getFactionTemplates } from './services/factionGenerator';

const templates = getFactionTemplates();
// Returns array of all faction templates with descriptions
```

## Benefits

1. **Thematic Consistency**: Factions now match their homeworld's characteristics
2. **Balanced Gameplay**: Each template has carefully balanced attributes and starting assets
3. **Rich Storytelling**: Faction types create natural narrative hooks
4. **Easy Expansion**: New templates can be easily added to the system
5. **Flexible Creation**: Users can auto-generate or manually select templates

## Template Attributes Summary

### Tier 1: Weak Factions
| Template | Force | Cunning | Wealth | HP | Key Assets |
|----------|-------|---------|--------|----|------------|
| Frontier Colony | 4 | 3 | 1 | 15 | Guerrilla Populace, Saboteurs |
| Tribal Confederation | 4 | 1 | 3 | 15 | Zealots, Harvesters |
| Resistance Cell | 3 | 4 | 1 | 15 | Seditionists, Zealots |
| Mining Consortium | 2 | 3 | 5 | 15 | Harvesters, Surveyors, Union Toughs |
| Pirate Fleet | 4 | 4 | 2 | 15 | Hitmen, Smugglers, Hardened Personnel |
| Isolated Outpost | 3 | 3 | 2 | 15 | Security Personnel, Informers |

### Tier 2: Moderate Factions
| Template | Force | Cunning | Wealth | HP | Key Assets |
|----------|-------|---------|--------|----|------------|
| Planetary Government | 6 | 3 | 5 | 29 | Postech Infantry, Planetary Defenses, Bank |
| Religious Order | 3 | 6 | 5 | 29 | Demagogue, Organization Moles, Zealots, Marketers |
| Trade Syndicate | 3 | 5 | 6 | 29 | Venture Capital, Shipping Combine, Blackmail |
| Genetic Supremacists | 3 | 6 | 5 | 29 | Boltholes, Demagogue, Laboratory, Gengineered Slaves |
| Mercenary Legion | 6 | 3 | 4 | 22 | Postech Infantry, Mercenaries |
| Criminal Syndicate | 4 | 6 | 4 | 22 | Seditionists, Blackmail, Smugglers |
| Tech Collective | 3 | 5 | 6 | 22 | Laboratory, Postech Industry, Cyberninjas |
| Agricultural Cooperative | 3 | 4 | 6 | 22 | Harvesters, Monopoly, Guerrilla Populace |
| Psychic Academy | 5 | 5 | 3 | 22 | Psychic Assassins, Cyberninjas |
| Military Junta | 7 | 3 | 3 | 25 | Postech Infantry, Elite Skirmishers, Planetary Defenses |

### Tier 3: Powerful Factions
| Template | Force | Cunning | Wealth | HP | Key Assets |
|----------|-------|---------|--------|----|------------|
| Stellar Hegemon | 8 | 5 | 7 | 49 | Space Marines, Blockade Fleet, Pretech Manufactory, Cyberninjas |
| Megacorporation | 5 | 7 | 8 | 40 | Pretech Manufactory, Venture Capital, Party Machine |
| Pretech Enclave | 6 | 6 | 7 | 35 | Pretech Infantry, Pretech Manufactory, Pretech Researchers |
| Fallen Empire | 7 | 5 | 6 | 35 | Planetary Defenses, R&D Department, Party Machine |
| Hive Mind Collective | 6 | 7 | 5 | 35 | Psychic Assassins, Demagogue, Organization Moles |
| Warlord Coalition | 8 | 4 | 4 | 32 | Gravtank Formation, Strike Fleet, Zealots |
| AI Sovereignty | 6 | 8 | 6 | 38 | Panopticon Matrix, Transport Lockdown, Planetary Defenses |

## Future Enhancements

Potential additions to the system:
- More faction templates (Pirates, Psychic Academy, etc.)
- Dynamic asset allocation based on difficulty settings
- Faction relationship generation based on types
- Historical event generation for established factions
- Custom template creation interface

