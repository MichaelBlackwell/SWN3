# Asset Special Features Documentation

This document provides comprehensive documentation for all asset special features in the Stars Without Number (SWN) Faction Manager application. Special features are indicated by the 'S' flag on assets and represent passive effects, purchase-time modifiers, or ongoing mechanics that differ from standard asset behavior.

## Overview

Special features are defined in `src/utils/assetSpecialFeatures.ts` and applied during gameplay through `src/utils/applySpecialFeatures.ts`. The system supports 11 different feature types:

1. **cost_modifier** - Modifies purchase or maintenance cost
2. **passive_bonus** - Provides ongoing passive benefits
3. **restriction** - Imposes limitations or requirements
4. **purchase_effect** - Special effect when purchased
5. **defensive_ability** - Special defensive mechanics
6. **attack_modifier** - Modifies attack behavior
7. **counterattack_modifier** - Modifies counterattack behavior
8. **stealth_related** - Special stealth mechanics
9. **tech_level_modifier** - Modifies tech level requirements
10. **maintenance_modifier** - Special maintenance rules
11. **unique_mechanic** - Unique gameplay mechanics

## Feature Application Timing

Special features can apply at different times during gameplay:

- **purchase** - Applied when the asset is purchased
- **maintenance** - Applied during the maintenance phase
- **combat** - Applied during combat resolution
- **ongoing** - Applied continuously throughout gameplay
- **defense** - Applied when defending
- **attack** - Applied when attacking

## Force Assets with Special Features

### Force 3: Zealots
- **Type**: attack_modifier
- **Timing**: combat
- **Description**: Zealots take 1d4 damage every time they launch a successful attack or perform a counterattack. Their fanatical dedication makes them willing to launch suicide attacks or hold positions to the death.
- **Implementation**: Combat resolver should apply self-damage after successful attacks/counterattacks

### Force 5: Blockade Fleet
- **Type**: attack_modifier
- **Timing**: combat
- **Description**: When Blockade Fleet successfully attacks an enemy faction asset, they steal 1d4 FacCreds from the target faction as well. This theft can occur to a faction only once per turn, no matter how many blockade fleets attack.
- **Parameters**: `stealCredits: '1d4'`, `oncePerTurn: true`
- **Implementation**: Combat resolver should steal credits on successful attack (once per turn per faction)

### Force 5: Psychic Assassins
- **Type**: purchase_effect
- **Timing**: purchase
- **Description**: Psychic Assassins automatically start Stealthed when purchased. They are combat-trained psychics equipped with advanced pretech stealth gear and psitech weaponry.
- **Parameters**: `autoStealth: true`
- **Implementation**: ✅ Applied automatically in `addAsset` reducer

### Force 6: Planetary Defenses
- **Type**: defensive_ability
- **Timing**: defense
- **Description**: Planetary Defenses can only defend against attacks by Starship-type assets. They are massive mag cannons and gravitic braker gun arrays designed to defend against starship bombardments and repel unauthorized landings.
- **Parameters**: `onlyDefendsAgainst: 'Starship'`
- **Implementation**: Combat resolver should restrict defense to Starship-type attackers only

### Force 7: Integral Protocols
- **Type**: defensive_ability
- **Timing**: defense
- **Description**: Integral Protocols can defend only against attacks versus Cunning, but they add an additional die to the defender's roll. This complex web of braked-AI supported sensors and redundant security checks is used to defeat attempts to infiltrate an area.
- **Parameters**: `onlyDefendsAgainst: 'Cunning'`, `bonusDie: 1`
- **Implementation**: Combat resolver should add bonus die and restrict to Cunning attacks

### Force 8: Capital Fleet
- **Type**: maintenance_modifier
- **Timing**: maintenance
- **Description**: Capital Fleets are expensive to keep flying and cost an additional 2 FacCreds of maintenance each turn. These are the pride of an empire, massive capital warships without peer in most sectors.
- **Parameters**: `additionalMaintenance: 2`
- **Implementation**: ✅ Applied automatically in `processMaintenancePhase` reducer

## Cunning Assets with Special Features

### Cunning 1: Informers
- **Type**: attack_modifier
- **Timing**: attack
- **Description**: Informers can choose to Attack a faction without specifying a target asset. On a successful Cunning vs. Cunning attack, all Stealthed assets on the planet belonging to that faction are revealed. They can target a faction even if none of their assets are visible on a world.
- **Parameters**: `revealsStealth: true`, `noTargetRequired: true`
- **Implementation**: Combat resolver should allow faction-level attacks and reveal stealth on success

### Cunning 1: False Front
- **Type**: defensive_ability
- **Timing**: defense
- **Description**: False Front allows a faction to preserve more valuable resources. If another asset on the planet suffers enough damage to destroy it, the faction can sacrifice the False Front instead to nullify the killing blow.
- **Parameters**: `canSacrifice: true`
- **Implementation**: Damage resolver should allow sacrificing False Front to prevent asset destruction

### Cunning 1: Base of Influence
- **Type**: unique_mechanic
- **Timing**: ongoing
- **Description**: This asset is special, and is required for purchasing or upgrading units on a particular world. Any damage done to a Base of Influence is also done to a faction's hit points. The cost of a Base of Influence equals its maximum hit points, which can be any number up to the total maximum hit points of its owning faction. A faction's bases of influence don't count against their maximum assets. A Base of Influence can only be purchased with the Expand Influence action.
- **Implementation**: ✅ Handled separately in expand influence system

### Cunning 2: Lobbyists
- **Type**: restriction
- **Timing**: ongoing
- **Description**: Lobbyists can be used to block the governmental permission that is sometimes required to buy an asset or transport it into a system. When a rival faction gains permission to do so, the Lobbyists can make an immediate Cunning vs. Cunning test against the faction; if successful, the permission is withdrawn and cannot be re-attempted until next turn.
- **Parameters**: `blocksPermission: true`
- **Implementation**: Purchase validation should check for Lobbyists and allow blocking permission

### Cunning 2: Saboteurs
- **Type**: attack_modifier
- **Timing**: attack
- **Description**: An asset attacked by Saboteurs cannot apply any Use Asset Ability action until the start of the attacking faction's next turn. This applies whether or not the attack was successful.
- **Parameters**: `disablesAbilities: true`
- **Implementation**: Asset ability system should check for disabled status before allowing ability use

### Cunning 2: Blackmail
- **Type**: attack_modifier
- **Timing**: combat
- **Description**: Blackmail selectively degrades the effectiveness of an asset. Any attempt to attack or defend against Blackmail loses any bonus dice earned by tags.
- **Parameters**: `removesTagBonuses: true`
- **Implementation**: Combat resolver should remove tag bonuses when Blackmail is involved

### Cunning 2: Seductress
- **Type**: attack_modifier
- **Timing**: attack
- **Description**: They and their male equivalents subvert the leadership of enemy assets. As an attack, a Seductress does no damage, but an asset that has been successfully attacked immediately reveals any other Stealthed assets of that faction on the planet. Only Special Forces units can attack a Seductress.
- **Parameters**: `revealsStealth: true`, `noDamage: true`, `onlyAttackedBy: 'Special Forces'`
- **Implementation**: Combat resolver should reveal stealth on success, apply no damage, and restrict attackers

### Cunning 3: Covert Shipping
- **Type**: stealth_related
- **Timing**: ongoing
- **Description**: Quiet interstellar asset transport. Any one Special Forces unit can be moved between any worlds within three hexes of the Covert Shipping at the cost of one FacCred.
- **Implementation**: ✅ Handled as special action ability

### Cunning 4: Party Machine
- **Type**: passive_bonus
- **Timing**: ongoing
- **Description**: Each turn, a Party Machine provides 1 FacCred to its owning faction. Political blocks control particular cities or regions, blocks that are firmly in control of the faction.
- **Parameters**: `incomePerTurn: 1`
- **Implementation**: Helper function available; can be integrated into income phase

### Cunning 4: Tripwire Cells
- **Type**: defensive_ability
- **Timing**: ongoing
- **Description**: These observers are alert to the arrival of stealthed units. Whenever a stealthed asset lands or is purchased on a planet with tripwire cells, the Cells make an immediate Cunning vs. Cunning attack against the owning faction. If successful, the asset loses its stealth.
- **Parameters**: `detectsStealth: true`
- **Implementation**: Purchase/movement system should check for Tripwire Cells and trigger detection roll

### Cunning 4: Seditionists
- **Type**: unique_mechanic
- **Timing**: ongoing
- **Description**: These asset sap a target's loyalty and will to obey. For a cost of 1d4 FacCreds, the Seditionists can attach themselves to an enemy asset. Until they attach to a different asset or no longer share the same planet, the affected asset cannot attack. If the asset is destroyed, the Seditionists survive.
- **Parameters**: `cost: '1d4'`, `disablesAttacks: true`
- **Implementation**: ✅ Handled as special action ability

### Cunning 5: Organization Moles
- **Type**: attack_modifier
- **Timing**: attack
- **Description**: These can subvert and confuse enemy assets, striking to damage their cohesion.
- **Implementation**: Standard attack behavior

### Cunning 5: Cracked Comms
- **Type**: counterattack_modifier
- **Timing**: defense
- **Description**: A cryptographic asset for the interception and deciphering of enemy communications. Friendly fire can be induced with the right interference. If the Cracked Comms succeeds in defending against an attack, it can immediately cause the attacking asset to make an attack against itself for normal damage or counterattack results.
- **Parameters**: `causesSelfAttack: true`
- **Implementation**: Combat resolver should trigger self-attack on successful defense

### Cunning 5: Boltholes
- **Type**: defensive_ability
- **Timing**: defense
- **Description**: Equipped with a number of postech innovations to make cleaning them out a costly and dangerous pursuit. If a faction Special Forces or Military Unit asset on the same planet as the Boltholes suffers damage sufficient to destroy it, it is instead set at 0 HP and rendered untouchable and unusable until it is repaired to full strength. If the Boltholes are destroyed before this happens, the asset is destroyed with them.
- **Parameters**: `preventsDestruction: true`, `requiresRepair: true`
- **Implementation**: Damage resolver should prevent destruction and set HP to 0 instead

### Cunning 6: Transport Lockdown
- **Type**: attack_modifier
- **Timing**: attack
- **Description**: These techniques involve selective pressure on local routing and shipping companies. On a successful Cunning vs. Cunning attack against a rival faction, the rival faction cannot transport assets onto that planet without spending 1d4 FacCreds and waiting one turn.
- **Parameters**: `blocksTransport: true`, `cost: '1d4'`, `duration: 1`
- **Implementation**: Movement system should check for transport lockdown and apply restrictions

### Cunning 6: Covert Transit Net
- **Type**: stealth_related
- **Timing**: ongoing
- **Description**: Facilities web an area of space with a network of smugglers and gray-market freighter captains. As an action, any Special Forces assets can be moved between any worlds within three hexes of the Covert Transit Net.
- **Implementation**: ✅ Handled as special action ability

### Cunning 6: Demagogue
- **Type**: attack_modifier
- **Timing**: attack
- **Description**: Popular leaders of a particular faith or ideology that can be relied upon to point their followers in the direction of maximum utility.
- **Implementation**: Standard attack behavior

### Cunning 7: Popular Movement
- **Type**: passive_bonus
- **Timing**: ongoing
- **Description**: A planet-wide surge of enthusiasm for a cause controlled by the faction. This support pervades all levels of government, and the government always grants any asset purchase or movement requests made by the faction.
- **Parameters**: `grantsPermission: true`
- **Implementation**: Purchase validation should automatically grant permission when Popular Movement is present

### Cunning 7: Book of Secrets
- **Type**: unique_mechanic
- **Timing**: ongoing
- **Description**: Exhaustively cataloged psychometric records on important and influential local figures, allowing uncanny accuracy in predicting their actions. Once per turn, a Book of Secrets allows the faction to reroll one die for an action taken on that world or force an enemy faction to reroll one die. This reroll can only be forced once per turn, no matter how many Books of Secrets are owned.
- **Parameters**: `rerollOncePerTurn: true`
- **Implementation**: Action system should allow reroll when Book of Secrets is present

### Cunning 7: Treachery
- **Type**: unique_mechanic
- **Timing**: attack
- **Description**: Traitors can attack an enemy asset. On a successful attack, the Treachery asset is lost, 5 FacCreds are gained, and the targeted asset switches sides to join the traitor's faction, even if the faction does not otherwise have the attributes necessary.
- **Parameters**: `switchesSides: true`, `gainCredits: 5`, `selfDestructs: true`
- **Implementation**: Combat resolver should handle side-switching and asset destruction on success

### Cunning 8: Panopticon Matrix
- **Type**: defensive_ability
- **Timing**: ongoing
- **Description**: These facilities weave braked-AI intelligence analysts into a web of observation capable of detecting the slightest evidence of intruders on a world. Every rival Stealthed asset on the planet must succeed in a Cunning vs. Cunning test at the beginning of every turn or lose their Stealth. The owner also gains an additional die on all Cunning attacks and defenses on that planet.
- **Parameters**: `detectsStealth: true`, `bonusDieOnCunning: true`
- **Implementation**: Turn system should check for stealth detection at turn start; combat resolver should add bonus die

## Wealth Assets with Special Features

### Wealth 1: Franchise
- **Type**: attack_modifier
- **Timing**: attack
- **Description**: When a Franchise successfully attacks an enemy asset, the enemy faction loses one FacCred (if available), which is gained by the Franchise's owner. This loss can happen only once a turn, no matter how many Franchises attack. This asset reflects a deniable connection with a local licensee for the faction's goods and services.
- **Parameters**: `stealsCredits: 1`, `oncePerTurn: true`
- **Implementation**: Combat resolver should steal 1 FacCred on successful attack (once per turn)

### Wealth 1: Local Investments
- **Type**: restriction
- **Timing**: ongoing
- **Description**: Any other faction that tries to buy an asset on that planet must pay one extra FacCred. This money is not given to the investments' owner, but is lost. This penalty is only applied once. These give the faction substantial influence over the commerce on a world.
- **Parameters**: `extraCostForOthers: 1`, `oncePerTurn: true`
- **Implementation**: Purchase validation should add extra cost for other factions

### Wealth 1: Base of Influence
- **Type**: unique_mechanic
- **Timing**: ongoing
- **Description**: Same as Cunning Base of Influence (see above)
- **Implementation**: ✅ Handled separately in expand influence system

### Wealth 2: Lawyers
- **Type**: restriction
- **Timing**: combat
- **Description**: Lawyers cannot attack or counterattack Force assets. They have the ability to tie an enemy up in the coils of their own internal rules, damaging assets with confusion and red tape.
- **Parameters**: `cannotAttack: 'Force'`
- **Implementation**: Combat resolver should prevent Lawyers from attacking Force assets

### Wealth 2: Surveyors
- **Type**: passive_bonus
- **Timing**: ongoing
- **Description**: The presence of a Surveyor crew allows one additional die to be rolled on Expand Influence actions. Surveyors explore potential resource and investment options on worlds.
- **Parameters**: `expandInfluenceBonus: 1`
- **Implementation**: ✅ Applied in expand influence system

### Wealth 3: Laboratory
- **Type**: tech_level_modifier
- **Timing**: ongoing
- **Description**: The lab allows a world to make hesitant progress in tech. The presence of a Laboratory allows assets to be purchased on that world as if it had Tech Level 4.
- **Parameters**: `effectiveTechLevel: 4`
- **Implementation**: Helper function available; can be integrated into purchase validation

### Wealth 3: Mercenaries
- **Type**: maintenance_modifier
- **Timing**: maintenance
- **Description**: Mercenaries have a maintenance cost of 1 FacCred per turn. Groups of well-equipped, highly-trained soldiers willing to serve the highest bidder.
- **Parameters**: `maintenanceCost: 1`
- **Implementation**: ✅ Applied automatically in `processMaintenancePhase` reducer

### Wealth 4: Monopoly
- **Type**: restriction
- **Timing**: ongoing
- **Description**: An open or tacit stranglehold on certain vital businesses or resources on a world. As an action, owners of a monopoly may force one other faction with unstealthed assets on that world to pay them one FacCred. If the target faction can't pay, they lose one asset of their choice on the world.
- **Implementation**: ✅ Handled as special action ability

### Wealth 4: Medical Center
- **Type**: passive_bonus
- **Timing**: ongoing
- **Description**: Salvage and repair damaged assets. Once between turns, if a Special Forces or Military Unit asset on the world is destroyed, the faction may immediately pay half its purchase cost to restore it with one hit point. Any Repair Asset action taken on that world costs one less FacCred for Special Forces and Military Units.
- **Parameters**: `repairDiscount: 1`, `canRestoreDestroyed: true`
- **Implementation**: Repair system should apply discount; destruction system should allow restoration

### Wealth 4: Bank
- **Type**: passive_bonus
- **Timing**: ongoing
- **Description**: Once per turn, the faction can ignore one cost or FacCred loss imposed by another faction. This does not require an action. Multiple bank assets allow multiple losses to be ignored.
- **Parameters**: `ignoresCosts: true`, `oncePerTurn: true`
- **Implementation**: Cost application system should check for Bank assets and allow ignoring costs

### Wealth 5: Marketers
- **Type**: attack_modifier
- **Timing**: attack
- **Description**: Deployed to confuse enemy factions into untimely investments. As an action, the marketers may test Cunning vs. Wealth against a rival faction's asset. If successful, the target faction must immediately pay half the asset's purchase cost, rounded down, or have it become disabled and useless until this price is paid.
- **Implementation**: ✅ Handled as special action ability

### Wealth 5: Pretech Researchers
- **Type**: tech_level_modifier, maintenance_modifier
- **Timing**: ongoing, maintenance
- **Description**: A highly versatile team of research and design specialists capable of supporting limited pretech… as long as they're adequately funded. Any world with Pretech Researchers on it is treated as tech level 5 for the purpose of buying Cunning and Wealth assets. Pretech researchers have a maintenance cost of 1 FacCred per turn.
- **Parameters**: `effectiveTechLevel: 5`, `categories: ['Cunning', 'Wealth']`, `maintenanceCost: 1`
- **Implementation**: ✅ Maintenance applied automatically; tech level helper function available

### Wealth 5: Blockade Runners
- **Type**: stealth_related
- **Timing**: ongoing
- **Description**: These starship captains excel at transporting goods through unfriendly lines. As an action, a blockade runner can transfer itself or any one Military Unit or Special Forces to a world within three hexes for a cost of two FacCreds. They can even move units that would otherwise require planetary government permission to enter.
- **Implementation**: ✅ Handled as special action ability

### Wealth 6: Venture Capital
- **Type**: passive_bonus
- **Timing**: ongoing
- **Description**: This asset grows resources out of seemingly nowhere, harvesting the best of entrepreneurship for the faction's benefit. As an action, venture capital can be tapped. 1d8 is rolled; on a 1, the asset is destroyed, while on a 2-3 one FacCred is gained, 4-7 yields two FacCreds and 8 grants three FacCreds.
- **Implementation**: ✅ Handled as special action ability

### Wealth 6: R&D Department
- **Type**: tech_level_modifier
- **Timing**: ongoing
- **Description**: These allow the smooth extension of wealth-creation and industrial principles to the farthest reaches of the faction's operations. A faction with an R&D department may treat all planets as having tech level 4 for purposes of buying Wealth assets.
- **Parameters**: `effectiveTechLevel: 4`, `categories: ['Wealth']`, `allPlanets: true`
- **Implementation**: Helper function available; can be integrated into purchase validation

### Wealth 6: Commodities Broker
- **Type**: passive_bonus
- **Timing**: ongoing
- **Description**: They substantially lessen the cost of large-scale investments by timing materials purchases properly. As an action, the owner of a commodities broker can roll 1d8; that many FacCreds are subtracted from the cost of their next asset purchase, down to a minimum of half normal price, rounded down.
- **Implementation**: ✅ Handled as special action ability

### Wealth 7: Pretech Manufactory
- **Type**: passive_bonus
- **Timing**: ongoing
- **Description**: Rare, precious examples of functioning pretech industrial facilities, retrofitted to work without the benefit of specialized psychic disciplines. As an action, the owning faction can roll 1d8 for a Pretech Manufactory, and gain half that many FacCreds, rounded up.
- **Implementation**: ✅ Handled as special action ability

### Wealth 7: Hostile Takeover
- **Type**: unique_mechanic
- **Timing**: attack
- **Description**: This asset can seize control of damaged and poorly-controlled assets. If a Hostile Takeover does enough damage to destroy an asset, the target is instead reduced to 1 hit point and acquired by the Hostile Takeover's owning faction.
- **Parameters**: `switchesSides: true`, `reducesTo1HP: true`
- **Implementation**: Combat resolver should handle side-switching and HP reduction instead of destruction

### Wealth 7: Transit Web
- **Type**: unique_mechanic
- **Timing**: ongoing
- **Description**: These facilities allow almost effortless relocation of all assets. For one FacCred, any number of non-starship Cunning or Wealth assets may be moved between any two worlds within three hexes of the Transit Web. This may be done freely on the owner's turn so long as the fee can be paid, and using the ability doesn't require an action.
- **Parameters**: `freeAction: true`, `categories: ['Cunning', 'Wealth']`
- **Implementation**: ✅ Handled as special action ability (free action)

### Wealth 8: Scavenger Fleet
- **Type**: maintenance_modifier
- **Timing**: maintenance
- **Description**: These rag-tag armadas bring enormous technical and mercantile resources to their patrons, along with a facility with heavy guns. Scavenger Fleets cost 2 FacCreds a turn in maintenance.
- **Parameters**: `maintenanceCost: 2`
- **Implementation**: ✅ Applied automatically in `processMaintenancePhase` reducer

## Implementation Status

### ✅ Fully Implemented
- Purchase-time effects (auto-stealth for Psychic Assassins)
- Maintenance modifiers (Capital Fleet, Mercenaries, Pretech Researchers, Scavenger Fleet)
- Special action abilities (handled through asset abilities system)

### 🔄 Partially Implemented (Helper Functions Available)
- Passive bonuses (Party Machine income) - helper function ready for income phase integration
- Tech level modifiers (Laboratory, Pretech Researchers, R&D Department) - helper functions ready for purchase validation
- Restrictions (Lawyers, Local Investments) - helper functions ready for validation

### ⏳ Pending Implementation (Combat/Gameplay Integration)
- Attack modifiers (stealing credits, revealing stealth, self-damage)
- Defensive abilities (restrictions, bonus dice, prevention)
- Counterattack modifiers (self-attack triggers)
- Ongoing effects (stealth detection, permission blocking)

## Testing

See `src/utils/assetSpecialFeatures.test.ts` and `src/utils/applySpecialFeatures.test.ts` for comprehensive unit tests covering:
- Registry validation
- Description functions
- Feature retrieval and filtering
- Purchase-time effects
- Maintenance modifiers
- Helper functions

## References

- Source: `.taskmaster/docs/FACTIONS.txt` - Official SWN Faction Rules
- Implementation: `src/utils/assetSpecialFeatures.ts`
- Application Logic: `src/utils/applySpecialFeatures.ts`
- Asset Definitions: `src/data/assetLibrary.ts`

