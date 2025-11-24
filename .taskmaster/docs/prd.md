# Stars Without Number: Faction Management Game PRD

## Overview

A web-based faction management game implementing the sector creation and faction systems from Stars Without Number. Players generate procedural stellar sectors with interconnected star systems, then manage competing factions vying for control through economic, military, and political means. The game automates all Game Master functions, allowing solo or multiplayer strategic gameplay in a living, reactive sci-fi universe.

The core experience combines two phases: **Sector Genesis** (creating the game world) and **Faction Dominance** (playing competing organizations within that world). Players first generate a unique sector of 21-30 star systems with diverse worlds, then establish and guide factions through strategic turns as they build assets, forge alliances, and pursue their goals.

### Target Audience
- Stars Without Number fans wanting automated faction gameplay
- Strategy game enthusiasts who enjoy emergent narratives
- Players seeking persistent worlds with meaningful choices
- GMs looking for campaign management tools

### Core Value Propositions
- **Automated GM**: All referee decisions handled algorithmically
- **Emergent Stories**: Faction interactions generate organic narratives
- **Strategic Depth**: Multiple paths to victory through Force, Cunning, or Wealth
- **Living Universe**: Sectors evolve based on faction actions

## Core Features

### 1. Sector Generation System

#### Stellar Map Creation
- **Hexagonal Grid**: 8x10 hex grid representing metadimensional space
- **System Placement**: Algorithm places 21-30 star systems across grid
- **Spike Routes**: Generate connections between systems based on:
  - Metadimensional proximity (not physical distance)
  - Spike drive ratings (1-6)
  - Natural chokepoints and clusters
- **Visual Representation**: Interactive hex map with:
  - System markers colored by primary world attributes
  - Route lines showing spike drive connections
  - Zoom/pan navigation
  - System detail overlays on hover

#### World Generation
Each system's primary world generates with:
- **Name Generator**: Culturally-diverse procedural names
- **Atmosphere**: Corrosive, Inert, Airless, Breathable, Thick, Thin, Exotic
- **Temperature**: Frozen, Cold, Temperate, Warm, Hot, Burning
- **Biosphere**: None, Microbial, Immiscible, Human-miscible, Hybrid, Engineered
- **Population**: Ranges from Failed Colony (0) to Billions (10+)
- **Tech Level**: TL0 (Stone Age) through TL5 (Pretech)
- **Government Type**: Various forms from anarchy to AI control
- **World Tags**: Two tags per world from extensive list (e.g., "Desert World", "Police State", "Psionics Academy")
- **Trade Codes**: Automatically derived from world stats

#### Additional System Features
- **Secondary Worlds**: Option to add 1-3 additional inhabited planets
- **Points of Interest**: Space stations, asteroid bases, ancient ruins
- **Resource Distribution**: Valuable materials, pretech caches, alien artifacts
- **System Hazards**: Radiation zones, debris fields, gravitational anomalies

### 2. Faction Management System

#### Faction Creation
- **Faction Types**: Governments, Corporations, Religions, Criminal Organizations, etc.
- **Attributes**:
  - **Hit Points**: Cohesion and resilience (base 15-29)
  - **Force**: Military might (1-8)
  - **Cunning**: Espionage and subterfuge (1-8)
  - **Wealth**: Economic power (1-8)
- **Homeworld Selection**: Choose starting base of operations
- **Tag Selection**: 1-2 tags defining faction nature (e.g., "Imperialist", "Secretive")
- **Starting Assets**: Initial resources based on faction type
- **Goal Assignment**: Victory conditions from preset list or custom

#### Asset System
Three categories of assets:
- **Force Assets**: Military units, fleets, mercenaries
- **Cunning Assets**: Spies, hackers, propaganda networks
- **Wealth Assets**: Trade routes, banks, industrial facilities

Each asset has:
- **Purchase Cost**: FacCreds required
- **Maintenance**: Ongoing costs if applicable
- **Hit Points**: Durability in conflicts
- **Attack/Defense Ratings**: Combat effectiveness
- **Special Abilities**: Unique actions or bonuses
- **Stealth Rating**: Visibility to enemies
- **Location**: Current star system placement

#### Faction Turn System
Turn structure:
1. **Income Phase**: Collect FacCreds from Wealth + bonuses
2. **Maintenance Phase**: Pay asset upkeep costs
3. **Action Phase**: Choose one action:
   - **Attack**: Assault enemy assets
   - **Buy Asset**: Purchase new resources
   - **Move Asset**: Relocate forces
   - **Repair Asset**: Restore damaged units
   - **Use Asset Ability**: Activate special powers
   - **Expand Influence**: Establish new bases
4. **News Generation**: Create narrative events from actions

### 3. Conflict Resolution

#### Combat Mechanics
- **Attack Rolls**: 1d10 + attacker attribute vs 1d10 + defender attribute
- **Damage Types**: Based on asset matchups (Force vs Force, Cunning vs Cunning, etc.)
- **Counterattack**: Defenders can damage attackers on successful defense
- **Asset Protection**: Owners choose which assets defend
- **Collateral Effects**: Some attacks affect multiple assets or worlds

#### Economic Warfare
- **Trade Disruption**: Block enemy income sources
- **Market Manipulation**: Affect FacCred values
- **Industrial Sabotage**: Damage production assets
- **Resource Monopolies**: Control key materials

#### Information Warfare
- **Espionage**: Reveal hidden assets
- **Propaganda**: Reduce enemy faction HP
- **False Intelligence**: Misdirect enemy actions
- **Blackmail**: Force disadvantageous moves

### 4. User Interface

#### Main Views
- **Sector Map**: Interactive hex grid with system details
- **Faction Dashboard**: Current stats, assets, available actions
- **Turn Planner**: Queue actions, preview outcomes
- **News Feed**: Narrative events from faction actions
- **Asset Manager**: Detailed asset list with filters/sorting

#### Controls and Interaction
- **Drag-and-Drop**: Move assets between systems
- **Context Menus**: Right-click for quick actions
- **Hotkeys**: Keyboard shortcuts for common commands
- **Multi-Select**: Batch operations on assets
- **Undo/Redo**: Reverse recent actions

### 5. Persistence and Save System

- **Auto-Save**: Every turn and major action
- **Manual Saves**: Named save slots
- **Cloud Sync**: Optional online backup
- **Import/Export**: JSON format for sharing
- **Version Control**: Track save compatibility

## User Experience

### User Personas

1. **The Strategist**: Enjoys complex systems, optimal play, min-maxing
   - Needs: Detailed stats, predictable mechanics, planning tools
   
2. **The Storyteller**: Values emergent narrative, roleplay elements
   - Needs: Rich lore generation, event descriptions, customization

3. **The Explorer**: Wants to discover unique sectors and scenarios
   - Needs: Varied generation, hidden features, achievements

4. **The Competitor**: Seeks challenging AI or multiplayer matches
   - Needs: Difficulty settings, balanced mechanics, rankings

### Key User Flows

#### First-Time Setup
1. Launch application → Welcome screen
2. Choose "New Sector" or "Load Sector"
3. If new: Configure generation parameters
4. Generate sector → Review and regenerate if desired
5. Select faction creation mode
6. Design starting faction(s)
7. Begin first turn

#### Standard Turn Flow
1. Review news from previous turn
2. Check faction status and resources
3. Scout enemy positions and assets
4. Plan action for turn
5. Execute action with confirmation
6. View resolution and effects
7. Read generated narrative
8. Auto-save and proceed

#### Conflict Resolution Flow
1. Select attacking asset(s)
2. Choose target system
3. Pick specific enemy asset to attack
4. Preview combat odds
5. Confirm attack
6. View animated resolution
7. See damage/counterattack results
8. Update strategic situation

### UI/UX Considerations

- **Responsive Design**: Scales from mobile to 4K displays
- **Dark Theme Default**: Easier on eyes for long sessions
- **Accessibility**: Screen reader support, colorblind modes
- **Tooltips**: Comprehensive hover information
- **Tutorial System**: Interactive onboarding for new players
- **Performance**: Smooth rendering of large sectors

## Technical Architecture

### Frontend (React)

#### Component Structure
```
/src
  /components
    /SectorMap
      HexGrid.jsx
      SystemNode.jsx
      RouteOverlay.jsx
    /FactionManager
      FactionDashboard.jsx
      AssetList.jsx
      ActionPlanner.jsx
    /WorldGenerator
      GeneratorControls.jsx
      WorldDetails.jsx
    /Combat
      CombatResolver.jsx
      BattleAnimation.jsx
    /UI
      NewsFeed.jsx
      SaveManager.jsx
      Settings.jsx
```

#### State Management
- **Redux Toolkit**: Global state for sector and factions
- **React Query**: Server synchronization (if multiplayer)
- **Local Storage**: Persist game state and preferences
- **Immer**: Immutable state updates

#### Key Libraries
- **D3.js/Hexagon.js**: Hex map rendering
- **Framer Motion**: Combat animations
- **React DnD**: Drag-and-drop asset management
- **Faker.js**: Name and description generation

### Data Models

#### Sector Schema
```javascript
{
  id: uuid,
  name: string,
  created: timestamp,
  systems: [
    {
      id: uuid,
      name: string,
      coordinates: {x, y},
      primaryWorld: {
        name: string,
        atmosphere: enum,
        temperature: enum,
        biosphere: enum,
        population: number,
        techLevel: number,
        government: string,
        tags: [string],
        tradeCodes: [string]
      },
      secondaryWorlds: [...],
      pointsOfInterest: [...],
      routes: [systemId]
    }
  ]
}
```

#### Faction Schema
```javascript
{
  id: uuid,
  name: string,
  type: enum,
  homeworld: systemId,
  attributes: {
    hp: number,
    maxHp: number,
    force: number,
    cunning: number,
    wealth: number
  },
  facCreds: number,
  tags: [string],
  goal: {
    type: string,
    requirements: object,
    progress: object
  },
  assets: [
    {
      id: uuid,
      type: string,
      category: enum,
      location: systemId,
      hp: number,
      maxHp: number,
      stealthed: boolean
    }
  ]
}
```

### APIs and Integrations

#### Internal APIs
- **Generation Service**: Procedural content creation
- **Combat Engine**: Resolution calculations
- **Narrative Generator**: Event descriptions
- **Save Service**: State persistence

#### External Integrations (Optional)
- **Authentication**: OAuth for multiplayer
- **Cloud Storage**: Save game backup
- **Analytics**: Anonymous usage metrics
- **Mod Support**: Steam Workshop or similar

### Infrastructure Requirements

#### Client-Side
- Modern browser with ES6 support
- 2GB RAM minimum
- WebGL support for advanced graphics

#### Server-Side (Optional Multiplayer)
- Node.js backend for real-time turns
- PostgreSQL for persistent storage
- Redis for session management
- WebSocket support

## Development Roadmap

### Phase 1: Core Sector Generation (MVP)
**Goal**: Functioning sector generator with visual display

- Hex grid rendering system
- Basic world generation algorithm
- System placement and route generation
- Interactive map with pan/zoom
- System detail panels
- Name generation for systems/worlds
- World tags and basic attributes
- Save/load functionality for sectors
- Export sector as JSON

### Phase 2: Enhanced World Building
**Goal**: Rich, detailed worlds worth exploring

- Secondary world generation
- Points of interest system
- Trade route visualization
- Resource distribution
- Government type effects
- Cultural details generation
- World tag interactions
- System hazards and anomalies
- History generation for worlds

### Phase 3: Basic Faction System
**Goal**: Working faction creation and management

- Faction creation interface
- Attribute system implementation
- Asset purchasing and placement
- Basic movement and positioning
- Income/maintenance calculations
- Turn order processing
- Manual action selection
- Simple combat resolution
- Faction persistence

### Phase 4: Advanced Faction Warfare
**Goal**: Full strategic depth with all asset types

- Complete asset library (30+ types)
- Special ability implementation
- Stealth and detection mechanics
- Complex combat calculations
- Counterattack system
- Area effect attacks
- Asset upgrade paths
- Faction goals and victory conditions
- AI faction opponents

### Phase 5: Narrative and Polish
**Goal**: Emergent storytelling and refined UX

- News feed generator
- Event description system
- Historical timeline tracking
- Achievement system
- Tutorial and onboarding
- UI themes and customization
- Performance optimizations
- Accessibility features
- Sound effects and music

### Phase 6: Extended Features
**Goal**: Replayability and community features

- Scenario editor
- Custom faction/asset creator
- Mod support framework
- Multiplayer infrastructure
- Asynchronous play mode
- Replay system
- Statistics and analytics
- Steam integration
- Mobile responsive design

## Logical Dependency Chain

### Foundation Layer (Week 1-2)
1. **React project setup** → Base application structure
2. **Redux store configuration** → State management ready
3. **Hex grid mathematics** → Coordinate system working
4. **Basic rendering** → Visual hex display

### Data Layer (Week 2-3)
1. **RNG utilities** → Consistent procedural generation
2. **World data structures** → System/planet models
3. **Generation algorithms** → Create sector data
4. **State persistence** → Save/load capability

### Interaction Layer (Week 3-4)
1. **Map controls** → Pan, zoom, selection
2. **System details UI** → Information display
3. **Route visualization** → Connection display
4. **Regeneration controls** → Iterate on sectors

### Faction Foundation (Week 5-6)
1. **Faction data models** → Organization structure
2. **Asset definitions** → Unit types and stats
3. **Turn manager** → Action processing
4. **Basic combat math** → Conflict resolution

### Strategic Layer (Week 7-8)
1. **Asset placement** → Positioning system
2. **Movement system** → Asset relocation
3. **Vision/detection** → Information hiding
4. **Income system** → Economic loop

### Conflict Layer (Week 9-10)
1. **Combat UI** → Attack interfaces
2. **Damage calculation** → Resolution system
3. **Counterattacks** → Defensive options
4. **Multi-asset battles** → Complex engagements

### Polish Layer (Week 11-12)
1. **News generation** → Narrative output
2. **Visual effects** → Animations and transitions
3. **Tutorial system** → Onboarding flow
4. **Balance testing** → Gameplay refinement

## Risks and Mitigations

### Technical Challenges

**Risk**: Complex hex grid calculations causing performance issues
- **Mitigation**: Use established libraries (Honeycomb.js), implement viewport culling, cache calculations

**Risk**: State management becoming unwieldy with many factions/assets
- **Mitigation**: Normalize Redux state, implement lazy loading, use React.memo for optimization

**Risk**: Procedural generation creating unbalanced or broken sectors
- **Mitigation**: Multiple generation passes with validation, manual override tools, preset scenarios

### Design Challenges

**Risk**: Faction turns becoming tedious with many assets
- **Mitigation**: Bulk action tools, AI automation options, streamlined UI workflows

**Risk**: Combat resolution too random or predictable
- **Mitigation**: Implement modifier systems, partial damage options, strategic positioning bonuses

**Risk**: Learning curve too steep for new players
- **Mitigation**: Progressive complexity unlocking, comprehensive tutorial, AI advisors

### Scope Management

**Risk**: Feature creep delaying MVP
- **Mitigation**: Strict phase gates, feature flags for experimental content, focus on core loop first

**Risk**: Asset creation becoming time sink
- **Mitigation**: Start with minimal viable set (10-15 assets), use generic types initially

**Risk**: Narrative generation requiring too much content
- **Mitigation**: Template-based system, procedural mixing, community content later

## MVP Definition

### Minimum Viable Sector Generator
- Generate 21-30 systems on hex grid
- Basic world attributes (atmosphere, temperature, population, tech)
- Simple name generation
- Visual hex map with system markers
- Click for system details
- Save/load sectors
- Regenerate capability

### Minimum Viable Faction Game
- Create 2-4 factions with basic attributes
- 10 asset types (3-4 per category)
- Turn-based actions (buy, move, attack)
- Simple combat resolution
- Income and maintenance
- Basic news feed
- Win condition checking
- Save game state

### What Can Wait
- Secondary worlds
- Points of interest
- Complex world tags
- Special asset abilities
- Stealth mechanics
- AI opponents
- Achievements
- Multiplayer
- Tutorial system
- Advanced graphics

## Appendix

### Research Findings

#### Similar Games Analysis
- **Stellaris**: Grand strategy with procedural galaxies - *Learning*: UI complexity management
- **Dominions**: Turn-based faction warfare - *Learning*: Async multiplayer value
- **Crusader Kings**: Character/dynasty focus - *Learning*: Emergent narrative techniques
- **Neptune's Pride**: Minimalist space strategy - *Learning*: Simple mechanics create depth

#### Technical Specifications

**Browser Requirements**
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- ES6/ES2015 JavaScript support
- LocalStorage minimum 50MB
- WebGL 1.0 for advanced graphics

**Performance Targets**
- Sector generation: <3 seconds
- Turn processing: <500ms
- Frame rate: 60fps map navigation
- Save/load: <1 second
- Memory usage: <500MB active

**Accessibility Standards**
- WCAG 2.1 Level AA compliance
- Keyboard navigation for all features
- Screen reader support via ARIA
- Colorblind-friendly palettes
- Scalable UI elements

### Asset Examples

#### Force Assets
- **Strike Fleet**: 12 HP, Force 3 vs Force, 1d8 counterattack
- **Planetary Defenses**: 20 HP, Force 4 vs Force, 2d6 counterattack
- **Guerrilla Forces**: 6 HP, Force 2 vs Cunning, 1d4 counterattack

#### Cunning Assets
- **Spy Network**: 4 HP, Cunning 2 vs Cunning, discovers hidden assets
- **Saboteurs**: 6 HP, Cunning 3 vs Force, 2d4 damage to facilities
- **Blackmail**: 4 HP, Cunning 3 vs Wealth, forces bad trades

#### Wealth Assets
- **Franchise**: 8 HP, generates 1d6 FacCreds
- **Shipping Combine**: 10 HP, Wealth 2 vs Wealth, controls trade
- **Bank**: 12 HP, loans FacCreds with interest

### Faction Goal Examples
- **Blood the Enemy**: Deal 14+ HP damage to rival assets
- **Expand Influence**: Control bases on 4+ worlds
- **Peaceable Kingdom**: Take no Attack actions for 4 turns
- **Economic Dominance**: Accumulate 30+ FacCreds
- **Intelligence Supremacy**: Have 5+ Cunning assets deployed