# World Generation System Architecture

## Overview

The world generation system has been redesigned from the ground up to create realistic, interconnected worlds with meaningful trade relationships. This document describes the architecture, design decisions, and how the system works.

## Core Design Philosophy

### 1. Causality-Driven Generation
Traits are not randomly assigned. Instead, they follow a causal chain:
- **Physical traits** (atmosphere, temperature, biosphere) are generated first
- **Physical traits influence** societal development (population, tech level)
- **Societal traits influence** economic profile (trade codes, exports/imports)
- **Economic profiles drive** trade route formation

### 2. Emergent Complexity
Complex world characteristics emerge from simple, interconnected rules rather than being randomly assigned. For example:
- A corrosive atmosphere makes life difficult → reduces habitability
- Low habitability → smaller populations
- Smaller populations → lower tech development
- Lower tech + harsh conditions → "Poor" trade code
- Poor worlds → need imports like technology and medical supplies

### 3. Meaningful Trade
Trade routes are no longer random. They form based on:
- **Economic complementarity**: Do worlds trade what each other needs?
- **Economic value**: Wealthy, populous worlds attract more trade
- **Resource flow**: Raw materials flow to industrial worlds, manufactured goods flow back
- **Tech differential**: Advanced worlds export technology to less developed ones

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SECTOR GENERATION                         │
│  (sectorGenerator.ts)                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├── Step 1: Generate System Coordinates
                   │
                   ├── Step 2: Generate Worlds
                   │   └──> worldGenerator.ts
                   │
                   ├── Step 3: Generate Spike Routes
                   │   └──> Physical connectivity (MST algorithm)
                   │
                   └── Step 4: Generate Trade Routes
                       └──> tradeRouteGenerator.ts
```

## Module Breakdown

### worldGenerator.ts

**Purpose**: Generate realistic worlds with interconnected traits

**Generation Phases**:

#### Phase 1: Physical World Generation
```typescript
1. Generate atmosphere (2d6 roll)
   ├─> Breathable (common)
   ├─> Thin/Thick (moderate)
   ├─> Exotic/Corrosive (rare)
   └─> Airless (rare)

2. Generate temperature (2d6 + atmosphere modifier)
   ├─> Thick atmosphere → warmer (greenhouse effect)
   ├─> Airless → colder (no heat retention)
   └─> Results: Frozen → Cold → Temperate → Warm → Burning

3. Generate biosphere (2d6 + atmosphere + temperature modifiers)
   ├─> Hostile conditions → None/Microbial
   ├─> Moderate conditions → Immiscible/Human-miscible
   └─> Ideal conditions → Engineered/Hybrid
```

#### Phase 2: Societal Development
```typescript
1. Calculate habitability score
   ├─> Atmosphere contribution (0-4 points)
   ├─> Temperature contribution (0-3 points)
   └─> Biosphere contribution (0-3 points)
   
2. Generate population (2d6 + habitability modifier)
   ├─> High habitability → larger populations
   └─> Low habitability → outposts or failed colonies
   
3. Generate tech level (2d6 + population modifier)
   ├─> Larger populations → innovation
   ├─> Tiny populations → stagnation
   └─> Range: 0 (none) → 5 (advanced)
   
4. Generate government (based on population + tech)
   ├─> Low pop → Corporate/Military/Anarchy
   ├─> Low tech → Monarchy/Feudalism/Theocracy
   └─> High tech → Technocracy/AI Control possible
```

#### Phase 3: Economic Profile
```typescript
1. Generate trade codes (rule-based on traits)
   Examples:
   ├─> Agricultural: Breathable + Temperate + Moderate pop
   ├─> Industrial: High pop + High tech
   ├─> Mining: Harsh conditions + Tech
   ├─> Rich: High pop + High tech
   └─> Poor: Low tech OR harsh environment

2. Calculate economic value (0-100)
   ├─> Population × 15
   ├─> Tech level × 10
   ├─> Trade code bonuses/penalties
   └─> Used for trade route scoring

3. Determine exports (based on trade codes)
   Examples:
   ├─> Agricultural → Food, Organic Materials
   ├─> Industrial → Manufactured Goods, Machinery
   ├─> High Tech → Electronics, Advanced Tech
   └─> Mining → Raw Ores, Rare Metals

4. Determine imports (based on deficiencies)
   Examples:
   ├─> High pop non-agricultural → needs Food
   ├─> Low tech → needs Technology, Medical Supplies
   ├─> Industrial → needs Raw Materials
   └─> Desert/Ice worlds → need Water, Life Support
```

#### Phase 4: Tag Selection
```typescript
1. Filter tags by conditions
   ├─> Each tag has eligibility rules
   ├─> Example: "Desert World" only on hot, dry planets
   └─> Example: "Trade Hub" only on high-value worlds

2. Weighted random selection
   ├─> Select 2 tags from eligible pool
   ├─> Higher weight = more likely
   └─> Respect incompatibility rules

3. Fallback to generic tags if needed
```

**Key Data Structure**:
```typescript
interface WorldProfile {
  // Physical traits
  atmosphere: AtmosphereType;
  temperature: TemperatureType;
  biosphere: BiosphereType;
  
  // Societal traits
  population: number; // 0-6
  techLevel: number;  // 0-5
  government: string;
  
  // Economic profile
  tags: string[];
  tradeCodes: string[];
  economicValue: number; // 0-100
  resourceExport: string[];
  resourceImport: string[];
}
```

### tradeRouteGenerator.ts

**Purpose**: Generate realistic trade routes based on economic factors

**Trade Route Scoring Algorithm**:

```typescript
Base Score = (Economic Value 1 + Economic Value 2) / 2

Modifiers:
├─> Distance Penalty: score × (1 - distance/max_range)
├─> Complementarity Bonus: +40 for bidirectional trade
│   └─> +20 for one-way beneficial trade
├─> Tech Differential: +15 if tech gap ≥ 2 levels
├─> Large Market: +10 if either pop ≥ 5
├─> Commodity Matches: +5 per matched export/import
├─> Major Hub: +20 if economic value ≥ 70
└─> Saturation Penalty: ×0.8 if avg routes > 3

Final Score determines if route becomes a trade route
```

**Generation Process**:

```typescript
1. Build economic profiles for all systems
   └─> Extract economic data from world generation

2. Score all potential routes
   ├─> Only consider existing spike drive routes
   └─> Calculate trade score for each

3. Select top trade routes
   ├─> Sort by score (highest first)
   ├─> Select top 30-40% of routes
   └─> Minimum of 3 trade routes

4. Ensure hub connectivity
   └─> Major hubs (value ≥60) get at least one trade route

5. Mark routes as trade routes
   └─> Update isTradeRoute flag in both directions
```

**Key Functions**:
- `calculateComplementarity()`: Measures how well two economies match
- `scoreTradeRoute()`: Comprehensive trade route scoring
- `ensureHubConnectivity()`: Guarantees major worlds have trade
- `getSystemTradeInfo()`: Extract trade data for UI display

### sectorGenerator.ts (Updated)

**Purpose**: Orchestrate the entire sector generation process

**Generation Flow**:
```typescript
1. Generate coordinates (hex grid)
2. Generate systems with realistic worlds
3. Generate spike drive routes (MST algorithm)
4. Generate trade routes (economic algorithm)
5. Return complete sector
```

**Route Generation Strategy**:
- **Spike Routes**: Use Minimum Spanning Tree to ensure connectivity
- **Trade Routes**: Use economic scoring on top of spike routes
- **Separation of Concerns**: Physical and economic connectivity are separate

## Tag System

### Tag Categories

#### Environmental Tags
- **Desert World**: Hot, dry planets
- **Oceanic World**: Water-covered worlds
- **Ice World**: Frozen planets
- **Tomb World**: Dead/abandoned worlds
- **Hostile Biosphere**: Dangerous alien life
- **Radioactive World**: Contaminated planets

#### Population Tags
- **Outpost World**: Small populations (hundreds/thousands)
- **Urbanized Surface**: Billions of inhabitants
- **Bubble Cities**: Enclosed habitats on hostile worlds
- **Flying Cities**: Airborne settlements
- **Refugees**: Displaced populations

#### Technology Tags
- **High Tech**: TL 4-5, advanced civilizations
- **Low Tech**: TL 1-2, pre-space societies
- **Forbidden Tech**: Restricted technologies
- **Unbraked AI**: Dangerous AI presence
- **Pretech Cultists**: Worshippers of old tech

#### Economic Tags
- **Trade Hub**: Major commercial centers
- **Heavy Industry**: Manufacturing worlds
- **Heavy Mining**: Resource extraction
- **Major Spaceyard**: Shipbuilding facilities
- **Local Specialty**: Unique products

#### Political Tags
- **Tyranny**: Oppressive governments
- **Police State**: Authoritarian control
- **Civil War**: Internal conflict
- **Warlords**: Fragmented authority
- **Regional Hegemon**: Dominant power

### Tag Selection Rules

**Conditions Example**:
```typescript
{
  name: 'Desert World',
  weight: 1,
  conditions: (p) => p.tradeCodes.includes('Desert'),
}
```

**Incompatibility Example**:
```typescript
{
  name: 'Ice World',
  weight: 1,
  conditions: (p) => p.temperature === 'Frozen',
  incompatible: ['Desert World'], // Can't be both
}
```

## Trade Code System

### Trade Codes

| Code | Conditions | Meaning |
|------|-----------|---------|
| **Agricultural** | Breathable + Temperate + Pop 2-4 + Life | Food producer |
| **Industrial** | Pop ≥4 + Tech ≥3 | Manufacturing hub |
| **High Tech** | Pop ≥4 + Tech ≥4 | Advanced technology |
| **Low Tech** | Pop ≥2 + Tech ≤2 | Primitive society |
| **Rich** | Pop ≥5 + Tech ≥4 | Wealthy world |
| **Poor** | Tech ≤2 OR harsh conditions | Struggling economy |
| **Mining** | Pop ≥2 + Harsh + Tech ≥3 | Resource extraction |
| **Desert** | Hot + No water | Arid world |
| **Ice** | Frozen + Hostile | Frozen world |
| **Water** | Breathable + Temperate + Life | Ocean world |
| **Vacuum** | Airless | No atmosphere |

### Trade Code Effects

Trade codes directly influence:
1. **Economic Value**: Rich +20, Poor -15, etc.
2. **Exports**: Agricultural → Food, Industrial → Goods
3. **Imports**: Poor → Everything, Low Tech → Technology
4. **Trade Route Likelihood**: Complementary codes attract trade

## Example Generation

Let's trace a world generation:

### Physical Generation
```
1. Atmosphere Roll: 7 → Breathable
2. Temperature Roll: 8 (+0 modifier) → Temperate
3. Biosphere Roll: 8 (+3 modifier) → Human-miscible
```

### Habitability Calculation
```
Atmosphere: Breathable = +4
Temperature: Temperate = +3
Biosphere: Human-miscible = +3
Total Habitability: 10 (excellent!)
```

### Societal Development
```
Population Roll: 9 (+3 modifier) → 5 (hundreds of millions)
Tech Roll: 8 (+2 modifier) → 4 (standard interstellar)
Government: High pop + High tech → Democracy
```

### Economic Profile
```
Trade Codes:
- Agricultural ✓ (Breathable + Temperate + Pop 3-5)
- Industrial ✓ (Pop ≥4 + Tech ≥3)
- Rich ✓ (Pop ≥5 + Tech ≥4)

Economic Value: 5×15 + 4×10 + 20+15+20 = 150 (capped at 100)

Exports:
- Food, Organic Materials (Agricultural)
- Manufactured Goods, Machinery (Industrial)
- Luxury Goods, Cultural Exports (Rich)

Imports:
- Raw Materials, Rare Metals (Industrial needs)
```

### Tag Selection
```
Eligible tags (high scores):
- Trade Hub (economic value 100)
- Cultural Power (Rich + High pop)
- Heavy Industry (Industrial code)
- Major Spaceyard (Industrial + High tech)
- Urbanized Surface (Pop 5)

Selected: "Trade Hub", "Major Spaceyard"
```

### Result
**Prosperous Prime** - A wealthy, industrialized world with billions of inhabitants, serving as a major trade hub and shipbuilding center in the sector.

## Trade Route Example

### System A (Mining World)
```
Population: 3
Tech: 4
Trade Codes: Mining, Poor
Exports: Raw Ores, Rare Metals
Imports: Food, Manufactured Goods, Medical Supplies
Economic Value: 45
```

### System B (Industrial World)
```
Population: 5
Tech: 4
Trade Codes: Industrial, Rich
Exports: Manufactured Goods, Machinery
Imports: Raw Materials, Rare Metals
Economic Value: 95
```

### Trade Route Score
```
Base: (45 + 95) / 2 = 70
Distance: 1 hex (adjacent) = no penalty
Complementarity:
- A exports "Rare Metals" → B imports "Rare Metals" ✓
- B exports "Manufactured Goods" → A imports "Manufactured Goods" ✓
- Bidirectional trade: +40
- 2 commodity matches: +10
Major Hub: B value 95 ≥70: +20

Final Score: 70 + 40 + 10 + 20 = 140

Result: HIGH PRIORITY TRADE ROUTE ✓
```

**Narrative**: Raw materials flow from the mining outpost to the industrial powerhouse, which ships back essential supplies and equipment.

## Benefits of the New System

### 1. Realism
- Worlds feel like they belong in their environment
- Trade patterns make economic sense
- Tags reflect actual world conditions

### 2. Meaningful Choices
- Players can predict what worlds might offer
- Trade routes indicate actual economic relationships
- World traits inform strategic decisions

### 3. Emergent Storytelling
- Each world has a logical backstory implied by its traits
- Trade relationships create natural alliances
- Conflicts arise from resource competition

### 4. Strategic Depth
- Factions can target specific world types for different resources
- Trade hubs become strategically important
- Tech differentials create expansion opportunities

## Future Enhancements

### Potential Additions
1. **Secondary Worlds**: Generate moons and outer planets with complementary traits
2. **Points of Interest**: Space stations, asteroid belts, anomalies
3. **Trade Goods**: Specific commodities with supply/demand mechanics
4. **Economic Simulation**: Dynamic trade values over time
5. **Faction Starting Positions**: Place factions on appropriate world types
6. **Political Relationships**: Generate alliances/conflicts based on trade
7. **Resource Scarcity**: Rare resources distributed across sector
8. **Tech Spread**: Technology diffusion along trade routes

### Extension Points
The system is designed to be extended:
- `TAG_DATABASE` can be expanded with new tags
- Trade code generation rules can be refined
- Economic scoring factors can be adjusted
- Additional world traits can be added to the profile

## Technical Notes

### Performance
- World generation: O(1) per world
- Trade route scoring: O(n²) where n = number of existing routes
- Acceptable for 20-30 systems (typical sector size)

### Randomization
- Uses 2d6 rolls (bell curve distribution) for core traits
- Weighted random selection for tags
- Deterministic economic calculations

### Extensibility
- Modular architecture (separate concerns)
- Clear interfaces between modules
- Easy to add new trade codes or tags
- Economic profiles can be queried separately

## Testing

### Validation Checks
1. **World Coherence**: Hostile worlds have small populations
2. **Trade Logic**: Trade routes connect complementary economies
3. **Connectivity**: All systems reachable via spike routes
4. **Economic Balance**: Mix of rich and poor worlds
5. **Tag Appropriateness**: Tags match world conditions

### Test Scenarios
- Generate 100 sectors, verify distributions
- Check trade route percentages (30-40% target)
- Validate tag conditions are met
- Ensure no impossible combinations
- Verify economic values are reasonable

---

**Version**: 1.0  
**Last Updated**: November 2024  
**Author**: Systems Architect

