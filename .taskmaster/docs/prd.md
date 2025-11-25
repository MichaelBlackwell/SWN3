# Stars Without Number: Sector & Faction Management Game
## Product Requirements Document

---

# Overview

**Stars Without Number: Sector & Faction Manager** is a React-based strategy management game that implements the Sector Creation and Faction management systems from the Stars Without Number tabletop RPG. Players generate procedurally-created stellar sectors filled with unique worlds, then create and manage competing factions vying for control, resources, and influence across the stars.

The game solves the problem of running complex faction-level strategic gameplay that traditionally requires a Game Master to adjudicate. By automating the dice rolls, turn management, and rules enforcement, players can experience the emergent storytelling and strategic depth of the SWN faction system as a standalone game.

**Target Audience:**
- Fans of Stars Without Number who want to explore faction gameplay
- Strategy game enthusiasts who enjoy 4X-lite and grand strategy games
- Solo players looking for procedurally-generated sci-fi sandbox experiences
- Groups who want to run competitive faction campaigns

**Core Value Proposition:**
- Faithful implementation of SWN's elegant faction mechanics
- Procedurally generated sectors with hundreds of unique world combinations
- Automated turn resolution with clear narrative output
- Save/load functionality for long-running campaigns

---

# Core Features

## 1. Sector Generation System

**What it does:** Generates a complete stellar sector with 21-30 star systems, each containing a primary world with unique characteristics determined by the SWN world generation tables.

**Why it's important:** The sector serves as the game board and provides the strategic landscape where factions compete. Each world's characteristics (tech level, population, atmosphere, etc.) determine what assets can be built there and what strategic value it holds.

**How it works:**
- Creates an 8x10 hex grid map
- Places 21-30 stars using weighted random distribution (1d10+20)
- For each star system, generates a primary world with:
  - Two World Tags (from 100-entry d100 table)
  - Atmosphere (2d6 table: Airless → Corrosive/Invasive)
  - Temperature (2d6 table: Frozen → Burning)
  - Biosphere (2d6 table: Remnant → Engineered)
  - Population (2d6 table: Failed Colony → Billions/Alien)
  - Tech Level (2d6 table: TL0-TL5)
- Automatically calculates trade route connections (max 3 hex range for standard spike drives)
- Generates world names and brief descriptions

## 2. Faction Creation & Management

**What it does:** Allows players to create, customize, and manage factions with the full SWN attribute and asset system.

**Why it's important:** Factions are the primary actors in the game. Their attributes determine capabilities, and their assets represent tangible resources that can attack, defend, and generate income.

**How it works:**
- Factions have three core attributes (1-8 scale):
  - **Force:** Military capability and violence application
  - **Cunning:** Espionage, infiltration, covert operations
  - **Wealth:** Commercial, scientific, industrial resources
- Derived statistics:
  - **Hit Points:** 4 + XP cost of highest Force + Cunning + Wealth ratings
  - **FacCreds:** Currency for purchasing assets and operations
  - **Experience Points:** Earned by completing goals, spent to raise attributes
- Faction Tags: Special traits providing unique bonuses (20 tag options)
- Homeworld designation with automatic Base of Influence

## 3. Asset System

**What it does:** Implements the complete catalog of ~75 faction assets across Force, Cunning, and Wealth categories.

**Why it's important:** Assets are the "units" of the faction game - they attack, defend, generate income, transport other assets, and provide special abilities.

**How it works:**
- Assets organized by type and minimum attribute requirement (1-8)
- Each asset has:
  - Hit Points
  - Purchase Cost (FacCreds)
  - Tech Level Requirement
  - Asset Type (Military Unit, Special Forces, Starship, Facility, Tactic, Logistics)
  - Attack stat (attribute vs. attribute, damage dice)
  - Counterattack stat (damage to failed attackers)
  - Special abilities and notes
- Assets are location-bound to specific star systems
- Asset limits: Cannot exceed attribute rating in that asset type without paying extra maintenance

### Cunning Assets (24 types)
Including: Informers, Saboteurs, Cyberninjas, Blackmail, Covert Shipping, Party Machine, Demagogue, Panopticon Matrix, etc.

### Force Assets (25 types)
Including: Militia Units, Postech Infantry, Strike Fleets, Capital Fleets, Space Marines, Planetary Defenses, Psychic Assassins, etc.

### Wealth Assets (24 types)
Including: Harvesters, Lawyers, Mercenaries, Monopoly, Blockade Runners, Pretech Manufactories, Scavenger Fleets, etc.

## 4. Turn-Based Faction Gameplay

**What it does:** Executes faction turns with proper action economy, income calculation, and resolution.

**Why it's important:** The turn structure creates meaningful strategic decisions and pacing for the gameplay loop.

**How it works:**
- Turn order randomized each round
- Each faction's turn:
  1. **Income Phase:** Gain FacCreds = (Wealth/2 rounded up) + ((Force+Cunning)/4 rounded down)
  2. **Maintenance Phase:** Pay costs for expensive assets and assets exceeding attribute limits
  3. **Action Phase:** Take ONE action type (can apply to multiple assets)

### Available Actions:
- **Attack:** Strike enemy assets; 1d10+Attribute vs 1d10+Attribute
- **Buy Asset:** Purchase one new asset on homeworld or Base of Influence
- **Expand Influence:** Create a Base of Influence on a world with existing assets
- **Refit Asset:** Transform one asset into another of same type
- **Repair Asset/Faction:** Heal damage to assets or faction HP
- **Sell Asset:** Liquidate for half purchase cost
- **Seize Planet:** Take governmental control (extended action)
- **Use Asset Ability:** Trigger special abilities of any/all assets
- **Change Homeworld:** Relocate faction headquarters

## 5. Combat Resolution System

**What it does:** Resolves attacks between faction assets with proper dice mechanics and damage application.

**Why it's important:** Combat is the primary way factions contest for control and weaken rivals.

**How it works:**
- Attacker selects attacking asset(s) and target faction
- Defender chooses which asset defends against each attack
- Resolution: 1d10 + Attacker's Attribute vs 1d10 + Defender's Attribute
- If Attacker wins: Deal Attack damage to defending asset
- If Defender wins: Deal Counterattack damage to attacking asset
- Ties: Both take damage
- Damage to Bases of Influence also damages faction HP directly
- Assets at 0 HP are destroyed

## 6. Goal & Experience System

**What it does:** Tracks faction objectives and awards experience for completion.

**Why it's important:** Goals drive faction behavior and provide advancement opportunities.

**How it works:**
- Each faction pursues one Goal at a time
- Completing a Goal awards Experience Points based on difficulty
- XP can be spent to raise attributes (increasing costs: 1→2→4→6→9→12→16→20)

### Available Goals:
| Goal | Requirement | Difficulty |
|------|-------------|------------|
| Military Conquest | Destroy Force assets = your Force rating | Assets destroyed / 2 |
| Commercial Expansion | Destroy Wealth assets = your Wealth rating | Assets destroyed / 2 |
| Intelligence Coup | Destroy Cunning assets = your Cunning rating | Assets destroyed / 2 |
| Planetary Seizure | Take control of a planet | Avg of defender's attributes / 2 |
| Expand Influence | Plant Base of Influence on new world | 1 (+1 if contested) |
| Blood the Enemy | Deal HP damage = sum of your attributes | 2 |
| Peaceable Kingdom | No Attack actions for 4 turns | 1 |
| Destroy the Foe | Destroy a rival faction | 1 + avg of target's attributes |
| Inside Enemy Territory | Place stealthed assets = Cunning rating | 2 |
| Invincible Valor | Destroy Force asset above your Force rating | 2 |
| Wealth of Worlds | Spend 4× Wealth rating in FacCreds | 2 |

## 7. News & Event Generation

**What it does:** Translates faction actions into narrative news reports and event descriptions.

**Why it's important:** Transforms mechanical actions into engaging story content, providing context and immersion.

**How it works:**
- After each faction turn, generate news items based on:
  - Successful attacks ("Typhon First Fleet suppresses piracy in Danube System")
  - Asset purchases ("Rathskeller Combine commissions new asteroid mining wing")
  - Territory changes ("Popular uprising deposes Governor of Perihelion")
  - Goal completions
- News items reference world names, faction names, and asset types
- Maintain a chronological news log for campaign history

---

# User Experience

## User Personas

### Primary: Solo Strategist
- Plays alone against AI-controlled factions
- Enjoys emergent narrative and strategic puzzles
- Values save/load for long campaigns
- Wants clear information display and easy-to-understand mechanics

### Secondary: Competitive Group
- Multiple players each controlling a faction
- Hot-seat or online multiplayer
- Wants fair turn order and hidden information options
- Values social dynamics and negotiation

### Tertiary: Worldbuilder
- Primarily interested in sector generation
- May export generated sectors for tabletop use
- Values customization and manual editing options
- Wants detailed world information

## Key User Flows

### Flow 1: New Campaign Setup
1. Launch game → Main Menu
2. Select "New Campaign"
3. Choose sector generation options (size, density)
4. Generate sector (with option to regenerate)
5. Review sector map and world details
6. Create factions (2-6 recommended):
   - Set name and homeworld
   - Allocate attributes (Force/Cunning/Wealth)
   - Select faction tag(s)
   - Choose starting goal
7. Assign starting assets based on faction power level
8. Begin Turn 1

### Flow 2: Faction Turn Execution
1. Turn begins → Show current faction
2. Display income calculation and new FacCred total
3. Pay maintenance costs (highlight any problems)
4. Present action options based on available assets
5. Player selects action and targets
6. Resolve action with animated dice rolls
7. Display results and update game state
8. Generate news item for the action
9. Advance to next faction or end round

### Flow 3: Combat Resolution
1. Attacker selects "Attack" action
2. Choose attacking asset(s) from current location
3. Select target faction
4. Defender chooses defending asset
5. Display combat stats (attributes, attack/counter values)
6. Animate dice roll resolution
7. Show damage results with visual feedback
8. Update asset HP, destroy if at 0
9. If Base of Influence damaged, show faction HP change
10. Repeat for additional attacks or end action

### Flow 4: Sector Exploration
1. Click hex on sector map
2. Display system panel with:
   - Star name
   - Primary world details (tags, atmosphere, temp, bio, pop, TL)
   - Present factions and their assets
   - Trade connections to adjacent systems
3. Option to zoom in for detailed world view
4. Option to filter map by faction control/influence

## UI/UX Considerations

### Map Interface
- Hex-based sector map as primary view
- Color-coded faction territories
- Icons for faction presence and asset types
- Zoom and pan controls
- Information tooltips on hover

### Faction Dashboard
- Tabbed interface for each faction
- At-a-glance stats: HP, FacCreds, XP, Attributes
- Asset list with locations and status
- Current goal progress tracker
- Action buttons contextual to turn phase

### Combat/Resolution Modals
- Clear display of combatants and odds
- Animated dice rolling
- Damage calculation breakdown
- Before/after state comparison

### Information Architecture
- Minimize required page navigation
- Progressive disclosure for complex data
- Consistent iconography for asset types
- Comprehensive in-game help/rules reference

### Visual Design
- Sci-fi aesthetic matching SWN tone
- Dark theme with high contrast for readability
- Clear visual hierarchy
- Responsive layout for various screen sizes

---

# Technical Architecture

## System Components

### Frontend (React)
```
src/
├── components/
│   ├── Map/
│   │   ├── SectorMap.tsx          # Main hex grid renderer
│   │   ├── HexTile.tsx            # Individual hex component
│   │   ├── StarSystem.tsx         # System icon and info
│   │   └── TradeRoutes.tsx        # Connection lines
│   ├── Faction/
│   │   ├── FactionPanel.tsx       # Faction info display
│   │   ├── FactionCreator.tsx     # New faction form
│   │   ├── AttributeDisplay.tsx   # F/C/W visualization
│   │   └── GoalTracker.tsx        # Goal progress
│   ├── Assets/
│   │   ├── AssetList.tsx          # Asset inventory
│   │   ├── AssetCard.tsx          # Individual asset display
│   │   ├── AssetShop.tsx          # Purchase interface
│   │   └── AssetDetail.tsx        # Full asset information
│   ├── Turn/
│   │   ├── TurnManager.tsx        # Turn phase controller
│   │   ├── ActionSelector.tsx     # Action menu
│   │   ├── CombatResolver.tsx     # Attack resolution
│   │   └── IncomePhase.tsx        # Income/maintenance display
│   ├── World/
│   │   ├── WorldDetail.tsx        # Full world information
│   │   ├── WorldTags.tsx          # Tag display with tooltips
│   │   └── WorldGenerator.tsx     # Generation controls
│   ├── News/
│   │   ├── NewsFeed.tsx           # Scrolling news display
│   │   └── NewsItem.tsx           # Individual news entry
│   └── Common/
│       ├── DiceRoller.tsx         # Animated dice component
│       ├── Modal.tsx              # Reusable modal
│       └── Tooltip.tsx            # Info tooltips
├── hooks/
│   ├── useSectorGeneration.ts
│   ├── useFactionTurn.ts
│   ├── useCombat.ts
│   └── useGameState.ts
├── store/
│   ├── gameSlice.ts               # Redux slice for game state
│   ├── sectorSlice.ts             # Sector data
│   ├── factionSlice.ts            # Faction data
│   └── store.ts                   # Store configuration
├── utils/
│   ├── diceRoller.ts              # Dice rolling utilities
│   ├── sectorGenerator.ts         # World generation logic
│   ├── combatResolver.ts          # Combat math
│   ├── incomeCalculator.ts        # FacCred calculations
│   └── newsGenerator.ts           # News text generation
├── data/
│   ├── worldTags.ts               # 100 world tags with details
│   ├── assets.ts                  # All asset definitions
│   ├── factionTags.ts             # Faction tag definitions
│   └── tables.ts                  # Generation tables
└── types/
    ├── sector.ts                  # Sector/World types
    ├── faction.ts                 # Faction types
    ├── asset.ts                   # Asset types
    └── game.ts                    # Game state types
```

## Data Models

### Sector
```typescript
interface Sector {
  id: string;
  name: string;
  width: number;              // Default 8
  height: number;             // Default 10
  systems: StarSystem[];
  tradeRoutes: TradeRoute[];
}

interface StarSystem {
  id: string;
  name: string;
  hexX: number;
  hexY: number;
  primaryWorld: World;
  additionalWorlds?: World[];
  pointsOfInterest?: PointOfInterest[];
}

interface World {
  id: string;
  name: string;
  tags: [WorldTag, WorldTag];
  atmosphere: Atmosphere;
  temperature: Temperature;
  biosphere: Biosphere;
  population: Population;
  techLevel: TechLevel;
  description: string;
}

interface TradeRoute {
  systemA: string;            // System ID
  systemB: string;            // System ID
  distance: number;           // Hex distance
}
```

### Faction
```typescript
interface Faction {
  id: string;
  name: string;
  homeworld: string;          // System ID
  force: number;              // 1-8
  cunning: number;            // 1-8
  wealth: number;             // 1-8
  hitPoints: number;
  maxHitPoints: number;
  facCreds: number;
  experiencePoints: number;
  tags: FactionTag[];
  currentGoal: Goal | null;
  goalProgress: GoalProgress;
  assets: FactionAsset[];
  basesOfInfluence: BaseOfInfluence[];
  isPlayerControlled: boolean;
}

interface FactionAsset {
  id: string;
  assetType: string;          // Reference to asset definition
  location: string;           // System ID
  hitPoints: number;
  maxHitPoints: number;
  isStealthed: boolean;
  isDisabled: boolean;
  purchasedThisTurn: boolean;
}

interface BaseOfInfluence {
  systemId: string;
  hitPoints: number;
  maxHitPoints: number;
}

interface Goal {
  type: GoalType;
  difficulty: number;
  targetFaction?: string;
  targetSystem?: string;
}

interface GoalProgress {
  turnsWithoutAttack?: number;    // For Peaceable Kingdom
  damageDealt?: number;           // For Blood the Enemy
  assetsDestroyed?: number;       // For Conquest goals
  // ... other goal-specific tracking
}
```

### Asset Definition
```typescript
interface AssetDefinition {
  id: string;
  name: string;
  category: 'Force' | 'Cunning' | 'Wealth';
  requiredRating: number;         // 1-8
  hitPoints: number;
  cost: number;
  techLevelRequired: number;
  assetType: AssetType;
  attack?: AttackDefinition;
  counterattack?: CounterattackDefinition;
  specialAbility?: SpecialAbility;
  maintenanceCost?: number;
  requiresPermission: boolean;
  notes: string;
}

interface AttackDefinition {
  attackAttribute: 'Force' | 'Cunning' | 'Wealth';
  defendAttribute: 'Force' | 'Cunning' | 'Wealth';
  damage: DiceExpression;         // e.g., "2d6" or "1d8+2"
}

interface CounterattackDefinition {
  damage: DiceExpression;
}
```

### Game State
```typescript
interface GameState {
  sector: Sector;
  factions: Faction[];
  currentTurn: number;
  turnOrder: string[];            // Faction IDs
  currentFactionIndex: number;
  turnPhase: TurnPhase;
  newsLog: NewsItem[];
  settings: GameSettings;
}

type TurnPhase = 'income' | 'maintenance' | 'action' | 'resolution' | 'between_turns';

interface NewsItem {
  turn: number;
  factionId: string;
  text: string;
  type: 'attack' | 'purchase' | 'expansion' | 'destruction' | 'goal' | 'other';
  timestamp: number;
}
```

## State Management

Using Redux Toolkit for centralized state:

- **Sector Slice:** Immutable sector data, world information
- **Faction Slice:** All faction data, assets, goals
- **Game Slice:** Turn management, phase tracking, settings
- **UI Slice:** Modal states, selected items, view preferences

Persistence via localStorage or IndexedDB for save/load functionality.

## Key Algorithms

### Sector Generation Algorithm
```
1. Determine star count: roll(1d10) + 20
2. For first 20 stars:
   a. Roll column (1d8) and row (1d10)
   b. If hex occupied, place in nearest empty adjacent hex
3. Place remaining stars to connect isolated clusters
4. For each star, generate primary world:
   a. Roll 2x d100 for world tags
   b. Roll 2d6 for each: atmosphere, temperature, biosphere, population, tech level
   c. Generate name using name generator
   d. Create brief description based on tags
5. Calculate trade routes (connections within 3 hexes)
```

### Combat Resolution Algorithm
```
1. Attacker declares attacking assets and target faction
2. For each attacking asset:
   a. Defender selects defending asset
   b. Get attack attribute from attacker's asset definition
   c. Get defense attribute from attack definition
   d. Attacker rolls: 1d10 + faction's attack attribute
   e. Defender rolls: 1d10 + faction's defense attribute
   f. Apply tag bonuses (extra dice, rerolls)
   g. Compare results:
      - Attacker > Defender: Deal attack damage to defender
      - Defender > Attacker: Deal counterattack damage to attacker
      - Tie: Both take damage
   h. Check for asset destruction (HP ≤ 0)
   i. If Base of Influence hit, apply damage to faction HP
```

### Income Calculation
```
income = ceil(wealth / 2) + floor((force + cunning) / 4)
```

### Hit Point Calculation
```
maxHP = 4 + xpCost(force) + xpCost(cunning) + xpCost(wealth)

where xpCost(rating) = {
  1: 1, 2: 2, 3: 4, 4: 6, 5: 9, 6: 12, 7: 16, 8: 20
}
```

---

# Development Roadmap

## Phase 1: MVP Foundation (Core Loop)

### 1.1 Project Setup
- Initialize React project with TypeScript
- Set up Redux Toolkit store structure
- Configure routing (React Router)
- Establish component library foundation
- Set up testing framework (Jest + React Testing Library)

### 1.2 Data Layer
- Implement all data types and interfaces
- Create world tag database (100 entries with full details)
- Create asset definitions database (75+ assets)
- Create faction tag definitions (20 tags)
- Implement generation tables as typed constants

### 1.3 Sector Generation (Basic)
- Build hex grid rendering system
- Implement star placement algorithm
- Create world generation functions (all tables)
- Build trade route calculation
- Create basic sector map display
- Add hex selection and system info panel

### 1.4 Faction System (Basic)
- Implement faction creation form
- Build attribute allocation interface
- Create faction dashboard component
- Implement Base of Influence system
- Add homeworld selection

### 1.5 Asset System (Basic)
- Build asset purchase interface
- Implement asset placement on map
- Create asset list/inventory view
- Add asset detail modal
- Implement tech level restrictions

### 1.6 Turn System (Basic)
- Build turn manager component
- Implement turn order randomization
- Create income phase logic and display
- Implement maintenance cost calculation
- Add basic action selection interface

### 1.7 Combat System (Basic)
- Build attack action flow
- Implement defender selection
- Create dice rolling utility with animations
- Build damage calculation logic
- Implement asset destruction
- Handle Base of Influence damage → faction HP

**MVP Deliverable:** Playable game loop where player can generate a sector, create factions, buy assets, and execute attack actions with proper resolution.

## Phase 2: Complete Mechanics

### 2.1 All Faction Actions
- Expand Influence action
- Refit Asset action
- Repair Asset/Faction action
- Sell Asset action
- Seize Planet action (multi-turn)
- Use Asset Ability action
- Change Homeworld action (multi-turn)

### 2.2 Asset Special Abilities
- Transport abilities (Heavy Drop, Strike Fleet movement, etc.)
- Income generation abilities (Harvesters, Postech Industry, etc.)
- Detection abilities (Informers, Tripwire Cells, etc.)
- Stealth system implementation
- Defensive abilities (Boltholes, False Front, etc.)
- All unique asset abilities from rulebook

### 2.3 Goal System
- Goal selection interface
- Progress tracking for all 11 goal types
- XP reward calculation
- Attribute advancement spending
- Goal abandonment with penalties

### 2.4 Faction Tags
- Implement all 20 faction tag effects
- Tag selection during faction creation
- Planetary Government tag (acquirable/losable)
- Tag-based combat modifiers (extra dice, rerolls)

### 2.5 Advanced Combat Features
- Multiple simultaneous attacks
- Asset type restrictions (e.g., Planetary Defenses vs Starships only)
- Permission-required asset restrictions
- Stealthed asset targeting rules

### 2.6 News Generation System
- Template-based news generation
- Context-aware descriptions
- News log with filtering
- Turn summaries

## Phase 3: Polish & Extended Features

### 3.1 AI Faction Controller
- Goal selection heuristics
- Asset purchase priorities
- Target selection logic
- Defensive asset allocation
- Difficulty settings

### 3.2 UI/UX Enhancements
- Animated transitions
- Sound effects
- Tutorial/onboarding flow
- Comprehensive rules reference
- Keyboard shortcuts

### 3.3 Save/Load System
- Campaign serialization
- Multiple save slots
- Auto-save functionality
- Export/import campaigns

### 3.4 Sector Customization
- Manual world editing
- Custom world tags
- Sector templates
- Import from external sources

### 3.5 Additional Points of Interest
- System points of interest generation
- Additional inhabited worlds per system
- Deep space stations and ruins

### 3.6 Campaign Features
- Campaign naming and notes
- Timeline/history view
- Faction relationship tracking
- Victory conditions

## Phase 4: Future Enhancements

### 4.1 Multiplayer Support
- Hot-seat multiplayer
- Online multiplayer (WebSocket)
- Hidden information handling
- Simultaneous turn resolution option

### 4.2 Extended Content
- Custom asset creator
- Faction tag creator
- Mod support
- Community sharing

### 4.3 Visualization
- Faction power graphs over time
- Territory change animations
- Battle replay viewer
- Statistical analysis tools

---

# Logical Dependency Chain

## Foundation Layer (Must Build First)

1. **Type Definitions** → Everything depends on well-defined TypeScript interfaces
2. **Data Constants** → World tags, assets, tables needed before any generation
3. **Dice Utilities** → Used by generation and combat
4. **Redux Store Setup** → State management foundation

## Sector Layer (Build Second)

5. **Hex Grid Renderer** → Visual foundation for the game
6. **World Generator** → Requires data constants, dice utilities
7. **Sector Generator** → Combines hex grid and world generator
8. **Trade Route Calculator** → Requires completed sector
9. **Map Interaction** → Hex selection, zoom, pan

## Faction Layer (Build Third)

10. **Faction Data Model** → Depends on sector (for homeworld)
11. **Faction Creator UI** → Depends on faction model
12. **Base of Influence System** → Links factions to sectors
13. **HP/Income Calculations** → Pure functions, no dependencies

## Asset Layer (Build Fourth)

14. **Asset Database** → Static data, early dependency
15. **Asset Purchase Logic** → Depends on faction FacCreds, location tech level
16. **Asset Display Components** → Depends on asset database
17. **Asset Location Binding** → Links assets to sector systems

## Turn Layer (Build Fifth)

18. **Turn Order System** → Depends on faction list
19. **Income Phase** → Depends on faction attributes
20. **Maintenance Phase** → Depends on asset ownership
21. **Action Phase Framework** → Shell for all actions

## Combat Layer (Build Sixth)

22. **Attack Action** → Depends on assets, dice, factions
23. **Damage Resolution** → Depends on asset HP system
24. **Counterattack System** → Extension of attack
25. **Base of Influence Damage** → Links to faction HP

## Goal Layer (Build Seventh)

26. **Goal Selection UI** → Depends on faction system
27. **Goal Progress Tracking** → Depends on turn actions
28. **XP Awards** → Depends on goal completion
29. **Attribute Advancement** → Depends on XP system

## Getting to Playable ASAP

The fastest path to a visible, playable frontend:

1. **Week 1:** Types + Data + Hex Grid + Basic Sector Display
2. **Week 2:** World Generation + Sector Map Complete
3. **Week 3:** Faction Creation + Dashboard
4. **Week 4:** Asset System + Purchase Flow
5. **Week 5:** Turn Loop + Income + Basic Actions
6. **Week 6:** Combat Resolution + MVP Complete

Each phase produces a visible, testable increment. By end of Week 2, users can see generated sectors. By Week 4, they can create factions with assets. By Week 6, basic gameplay loop works.

---

# Risks and Mitigations

## Technical Risks

### Risk: Complex State Management
**Description:** Game state is highly interconnected (factions own assets, assets at locations, locations in sector, etc.)
**Mitigation:**
- Use normalized Redux state with entity adapters
- Implement selectors for derived data
- Add comprehensive unit tests for state transitions
- Consider using RTK Query for complex updates

### Risk: Hex Grid Performance
**Description:** Large sector maps with many assets could cause render performance issues
**Mitigation:**
- Implement virtualization for hex grid
- Use React.memo for hex tiles
- Batch state updates during turn resolution
- Consider canvas rendering for very large maps

### Risk: Rules Complexity
**Description:** SWN faction rules have many edge cases and special interactions
**Mitigation:**
- Build comprehensive test suite against rulebook examples
- Create decision trees for complex rule interactions
- Implement verbose logging for debugging
- Start with simplified rules, add complexity iteratively

## Design Risks

### Risk: Information Overload
**Description:** Too much data on screen could overwhelm users
**Mitigation:**
- Progressive disclosure of information
- Focus on immediate action context
- Collapsible/expandable sections
- Strong visual hierarchy

### Risk: Turn Length
**Description:** Faction turns with many assets could be tedious
**Mitigation:**
- Batch similar actions
- Quick-action shortcuts
- Auto-resolve option for minor decisions
- Skip animations option

## Scope Risks

### Risk: Feature Creep
**Description:** Temptation to implement optional SWN rules
**Mitigation:**
- Strict MVP definition
- Phase gates before adding features
- User feedback prioritization
- "Nice to have" backlog separate from roadmap

### Risk: Incomplete Asset Implementation
**Description:** 75+ assets with special abilities is substantial
**Mitigation:**
- Implement generic assets first
- Prioritize commonly-used assets
- Create extensible ability framework
- Mark unimplemented abilities clearly in UI

## MVP Definition

The Minimum Viable Product must include:
- ✅ Sector generation with full world detail
- ✅ Faction creation with attributes and homeworld
- ✅ Asset purchase (Force, Cunning, Wealth basics)
- ✅ Turn structure with income and maintenance
- ✅ Attack action with full combat resolution
- ✅ Asset destruction and Base of Influence damage
- ✅ Save/load single campaign

MVP explicitly excludes:
- ❌ All special asset abilities
- ❌ Goal system
- ❌ Faction tags
- ❌ AI opponents
- ❌ Multiplayer
- ❌ Advanced actions (Seize Planet, etc.)

---

# Appendix

## A. World Tags Reference

The 100 world tags (d100) include categories such as:
- **Political:** Anarchists, Civil War, Police State, Theocracy, Tyranny, Warlords
- **Economic:** Gold Rush, Heavy Industry, Heavy Mining, Trade Hub, Sole Supplier
- **Social:** Altered Humanity, Anthropomorphs, Eugenic Cult, Pilgrimage Site
- **Environmental:** Badlands World, Desert World, Oceanic World, Tomb World
- **Technological:** Forbidden Tech, Pretech Cultists, Unbraked AI, Mandate Base
- **Exotic:** Alien Ruins, Flying Cities, Psionics Academy, Sealed Menace

Each tag includes:
- Description
- Enemies (example antagonists)
- Friends (example allies)
- Complications (plot hooks)
- Things (valuable objects)
- Places (notable locations)

## B. Generation Tables Summary

| Attribute | Roll | Values |
|-----------|------|--------|
| Atmosphere | 2d6 | 2: Corrosive, 3: Inert gas, 4: Airless/thin, 5-9: Breathable, 10: Thick, 11: Invasive, 12: Corrosive+Invasive |
| Temperature | 2d6 | 2: Frozen, 3: Cold, 4-5: Variable cold, 6-8: Temperate, 9-10: Variable warm, 11: Warm, 12: Burning |
| Biosphere | 2d6 | 2: Remnant, 3: Microbial, 4-5: None, 6-8: Human-miscible, 9-10: Immiscible, 11: Hybrid, 12: Engineered |
| Population | 2d6 | 2: Failed colony, 3: Outpost, 4-5: <1 million, 6-8: Several million, 9-10: Hundreds of millions, 11: Billions, 12: Alien |
| Tech Level | 2d6 | 2: TL0, 3: TL1, 4-5: TL2, 6-8: TL4, 9-10: TL3, 11: TL4+, 12: TL5 |

## C. Asset Quick Reference

### Force Assets by Rating
| Rating | Assets |
|--------|--------|
| 1 | Security Personnel, Hitmen, Militia Unit, Base of Influence |
| 2 | Heavy Drop Assets, Elite Skirmishers, Hardened Personnel, Guerrilla Populace |
| 3 | Zealots, Cunning Trap, Counterintel Unit |
| 4 | Beachhead Landers, Extended Theater, Strike Fleet, Postech Infantry |
| 5 | Blockade Fleet, Pretech Logistics, Psychic Assassins |
| 6 | Pretech Infantry, Planetary Defenses, Gravtank Formation |
| 7 | Deep Strike Landers, Integral Protocols, Space Marines |
| 8 | Capital Fleet |

### Cunning Assets by Rating
| Rating | Assets |
|--------|--------|
| 1 | Smugglers, Informers, False Front, Base of Influence |
| 2 | Lobbyists, Saboteurs, Blackmail, Seductress |
| 3 | Cyberninjas, Stealth, Covert Shipping |
| 4 | Party Machine, Vanguard Cadres, Tripwire Cells, Seditionists |
| 5 | Organization Moles, Cracked Comms, Boltholes |
| 6 | Transport Lockdown, Covert Transit Net, Demagogue |
| 7 | Popular Movement, Book of Secrets, Treachery |
| 8 | Panopticon Matrix |

### Wealth Assets by Rating
| Rating | Assets |
|--------|--------|
| 1 | Franchise, Harvesters, Local Investments, Base of Influence |
| 2 | Freighter Contract, Lawyers, Union Toughs, Surveyors |
| 3 | Postech Industry, Laboratory, Mercenaries |
| 4 | Shipping Combine, Monopoly, Medical Center, Bank |
| 5 | Marketers, Pretech Researchers, Blockade Runners |
| 6 | Venture Capital, R&D Department, Commodities Broker |
| 7 | Pretech Manufactory, Hostile Takeover, Transit Web |
| 8 | Scavenger Fleet |

## D. Faction Tags Summary

| Tag | Primary Effect |
|-----|----------------|
| Colonists | Homeworld treated as government + TL4 |
| Deep Rooted | Extra d10 defending on homeworld |
| Eugenics Cult | Access to Gengineered Slaves asset |
| Exchange Consulate | Bonus XP on Peaceable Kingdom; extra d10 vs Wealth attacks |
| Fanatical | Reroll 1s; lose ties |
| Imperialists | Extra d10 on Seize Planet attacks |
| Machiavellian | Extra d10 on Cunning attacks (1/turn) |
| Mercenary Group | All assets can move 1 hex as action |
| Perimeter Agency | Extra d10 vs TL5 assets; bonus stealth detection |
| Pirates | Asset movement to faction's BoI costs +1 FacCred |
| Planetary Government | Control permission for marked assets |
| Plutocratic | Extra d10 on Wealth attacks (1/turn) |
| Preceptor Archive | TL4+ assets cost -1 FacCred; can teach planets |
| Psychic Academy | Force enemy reroll (1/turn) |
| Savage | Extra d10 defending with TL0 assets |
| Scavengers | Gain 1 FacCred when any asset destroyed |
| Secretive | All purchased assets start Stealthed |
| Technical Expertise | BoI worlds treated as TL4; build Starships at 10k pop |
| Theocratic | Extra d10 defending vs Cunning attacks (1/turn) |
| Warlike | Extra d10 on Force attacks (1/turn) |

## E. XP Cost Table

| Rating | XP Cost to Reach | HP Value |
|--------|------------------|----------|
| 1 | - | 1 |
| 2 | 2 | 2 |
| 3 | 4 | 4 |
| 4 | 6 | 6 |
| 5 | 9 | 9 |
| 6 | 12 | 12 |
| 7 | 16 | 16 |
| 8 | 20 | 20 |

Example: Faction with Force 4, Cunning 3, Wealth 2
- Max HP = 4 + 6 + 4 + 2 = 16 HP