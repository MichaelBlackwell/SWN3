import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Faction, FactionAsset } from '../../types/faction';
import { getAssetById } from '../../data/assetLibrary';
import type { AssetCategory } from '../../types/asset';
import { calculateTurnIncome } from '../../utils/factionCalculations';
import {
  applyPurchaseTimeEffects,
  getMaintenanceModifier,
} from '../../utils/applySpecialFeatures';

interface FactionsState {
  factions: Faction[];
  selectedFactionId: string | null;
  // Track assets that failed maintenance (assetId -> number of consecutive turns failed)
  assetsFailedMaintenance: Record<string, number>;
}

const initialState: FactionsState = {
  factions: [],
  selectedFactionId: null,
  assetsFailedMaintenance: {},
};

// Export payload types for use in components
export interface AddAssetPayload {
  factionId: string;
  assetDefinitionId: string;
  location: string; // systemId
  stealthed?: boolean;
  purchasedTurn?: number;
}

export interface RemoveAssetPayload {
  factionId: string;
  assetId: string;
  refund?: boolean; // If true, refund half the cost (rounded down)
}

export interface InflictDamagePayload {
  factionId: string;
  assetId: string;
  damage: number;
  damageToBase?: boolean; // If true, damage is being applied to a Base of Influence
}

const factionsSlice = createSlice({
  name: 'factions',
  initialState,
  reducers: {
    addFaction: (state, action: PayloadAction<Faction>) => {
      state.factions.push(action.payload);
    },
    removeFaction: (state, action: PayloadAction<string>) => {
      const faction = state.factions.find((f) => f.id === action.payload);
      if (faction) {
        // Clean up failed maintenance tracking for this faction's assets
        faction.assets.forEach((asset) => {
          if (state.assetsFailedMaintenance[asset.id]) {
            delete state.assetsFailedMaintenance[asset.id];
          }
        });
      }
      state.factions = state.factions.filter((f) => f.id !== action.payload);
      if (state.selectedFactionId === action.payload) {
        state.selectedFactionId = null;
      }
    },
    updateFaction: (state, action: PayloadAction<Faction>) => {
      const index = state.factions.findIndex((f) => f.id === action.payload.id);
      if (index !== -1) {
        state.factions[index] = action.payload;
      }
    },
    selectFaction: (state, action: PayloadAction<string | null>) => {
      state.selectedFactionId = action.payload;
    },
    clearAllFactions: (state) => {
      state.factions = [];
      state.selectedFactionId = null;
    },
    // Hydrate state from a save file
    hydrateFactions: (state, action: PayloadAction<Faction[]>) => {
      state.factions = action.payload;
      // Reset selected faction when hydrating
      state.selectedFactionId = null;
      // Reset failed maintenance tracking when hydrating
      state.assetsFailedMaintenance = {};
    },
    addAsset: (state, action: PayloadAction<AddAssetPayload>) => {
      const { factionId, assetDefinitionId, location, stealthed = false, purchasedTurn } =
        action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      // Get asset definition from library
      const assetDef = getAssetById(assetDefinitionId);
      if (!assetDef) return;

      // Validate faction has enough credits
      if (faction.facCreds < assetDef.cost) return;

      // Validate faction has required rating for this asset category
      const requiredRating = assetDef.requiredRating;
      const hasRating =
        assetDef.category === 'Force'
          ? faction.attributes.force >= requiredRating
          : assetDef.category === 'Cunning'
            ? faction.attributes.cunning >= requiredRating
            : faction.attributes.wealth >= requiredRating;

      if (!hasRating) return;

      // Check asset count limit: faction can own max N assets of a category where N = rating
      // Assets over the limit cost +1 FacCred maintenance per turn (enforced elsewhere)
      // For now, we allow purchase but the limit will be enforced during maintenance phase
      // Count current assets of this category by looking up their definitions
      const currentAssetsOfCategory = faction.assets.filter((asset) => {
        const existingAssetDef = getAssetById(asset.definitionId);
        return existingAssetDef?.category === assetDef.category;
      }).length;

      const maxAssets = assetDef.category === 'Force'
        ? faction.attributes.force
        : assetDef.category === 'Cunning'
          ? faction.attributes.cunning
          : faction.attributes.wealth;

      // Note: We allow exceeding the limit - excess assets will cost extra maintenance
      // This is per SWN rules where you can exceed but pay +1 FacCred per asset over limit

      // Generate unique asset instance ID
      const assetInstanceId = crypto.randomUUID();

      // Apply purchase-time special feature effects
      const purchaseEffects = applyPurchaseTimeEffects({
        factionId,
        asset: {
          id: assetInstanceId,
          definitionId: assetDefinitionId,
          location,
          hp: assetDef.hp,
          maxHp: assetDef.hp,
          stealthed: false,
        },
        assetDefinitionId,
        location,
        currentTurn: purchasedTurn,
      });

      // Determine if asset should start stealthed (from special features or explicit parameter)
      const finalStealthed = stealthed || purchaseEffects.autoStealth || false;

      // Create the asset instance
      const newAsset: FactionAsset = {
        id: assetInstanceId,
        definitionId: assetDefinitionId,
        location,
        hp: assetDef.hp,
        maxHp: assetDef.hp,
        stealthed: finalStealthed,
        purchasedTurn,
      };

      // Calculate final cost (base cost + any modifiers from special features)
      // Currently no purchase cost modifiers exist, but this is where they would be applied
      const finalCost = assetDef.cost;

      // Deduct cost from faction credits
      faction.facCreds -= finalCost;

      // Add asset to faction
      faction.assets.push(newAsset);
    },
    removeAsset: (state, action: PayloadAction<RemoveAssetPayload>) => {
      const { factionId, assetId, refund = false } = action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      const assetIndex = faction.assets.findIndex((a) => a.id === assetId);
      if (assetIndex === -1) return;

      // If refunding, calculate half the purchase cost
      if (refund) {
        const asset = faction.assets[assetIndex];
        const assetDef = getAssetById(asset.definitionId);
        if (assetDef) {
          const refundAmount = Math.floor(assetDef.cost / 2);
          faction.facCreds += refundAmount;
        }
      }

      // Remove the asset
      faction.assets.splice(assetIndex, 1);

      // Clean up failed maintenance tracking for this asset
      if (state.assetsFailedMaintenance[assetId]) {
        delete state.assetsFailedMaintenance[assetId];
      }
    },
    updateAsset: (
      state,
      action: PayloadAction<{
        factionId: string;
        assetId: string;
        updates: Partial<FactionAsset>;
      }>
    ) => {
      const { factionId, assetId, updates } = action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      const asset = faction.assets.find((a) => a.id === assetId);
      if (!asset) return;

      // Update the asset with provided fields
      Object.assign(asset, updates);
    },
    moveAsset: (
      state,
      action: PayloadAction<{
        factionId: string;
        assetId: string;
        newLocation: string; // systemId
      }>
    ) => {
      const { factionId, assetId, newLocation } = action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      const asset = faction.assets.find((a) => a.id === assetId);
      if (!asset) return;

      asset.location = newLocation;
    },
    // Process Income Phase: Calculate and distribute income to all factions
    processIncomePhase: (state) => {
      state.factions.forEach((faction) => {
        const income = calculateTurnIncome(faction.attributes);
        faction.facCreds += income;
      });
    },
    // Process Maintenance Phase: Calculate and deduct maintenance costs
    processMaintenancePhase: (state) => {
      state.factions.forEach((faction) => {
        // Calculate maintenance cost per asset
        const assetMaintenanceMap = new Map<string, number>(); // assetId -> maintenance cost

        // Count assets by category to check for excess
        const assetCounts: Record<AssetCategory, number> = {
          Force: 0,
          Cunning: 0,
          Wealth: 0,
        };

        // First pass: count assets and calculate base maintenance
        faction.assets.forEach((asset) => {
          const assetDef = getAssetById(asset.definitionId);
          if (!assetDef) return;

          // Count assets by category
          assetCounts[assetDef.category]++;

          // Base maintenance cost
          const baseMaintenance = assetDef.maintenance || 0;
          
          // Apply special feature maintenance modifiers (e.g., Capital Fleet +2, Mercenaries +1)
          const maintenanceModifier = getMaintenanceModifier(asset.definitionId);
          
          const totalMaintenance = baseMaintenance + maintenanceModifier;
          assetMaintenanceMap.set(asset.id, totalMaintenance);
        });

        // Second pass: add excess asset penalties (+1 FacCred per excess asset)
        faction.assets.forEach((asset) => {
          const assetDef = getAssetById(asset.definitionId);
          if (!assetDef) return;

          const maxAssets =
            assetDef.category === 'Force'
              ? faction.attributes.force
              : assetDef.category === 'Cunning'
                ? faction.attributes.cunning
                : faction.attributes.wealth;

          const currentCount = assetCounts[assetDef.category];
          if (currentCount > maxAssets) {
            // This asset is in excess, add +1 maintenance
            const currentMaintenance = assetMaintenanceMap.get(asset.id) || 0;
            assetMaintenanceMap.set(asset.id, currentMaintenance + 1);
          }
        });

        // Calculate total maintenance
        let totalMaintenance = 0;
        assetMaintenanceMap.forEach((cost) => {
          totalMaintenance += cost;
        });

        // Track assets that couldn't be paid for
        const assetsToRemove: string[] = [];
        let remainingCredits = faction.facCreds;

        // Process each asset's maintenance
        assetMaintenanceMap.forEach((cost, assetId) => {
          if (cost > 0) {
            if (remainingCredits >= cost) {
              // Can pay for this asset's maintenance
              remainingCredits -= cost;
              // Reset failure count if it was previously failed
              if (state.assetsFailedMaintenance[assetId]) {
                delete state.assetsFailedMaintenance[assetId];
              }
            } else {
              // Cannot pay for this asset's maintenance
              const currentFailures = state.assetsFailedMaintenance[assetId] || 0;
              const newFailures = currentFailures + 1;

              if (newFailures >= 2) {
                // Asset is lost after two consecutive turns of failed maintenance
                assetsToRemove.push(assetId);
                delete state.assetsFailedMaintenance[assetId];
              } else {
                // Mark as failed for this turn
                state.assetsFailedMaintenance[assetId] = newFailures;
              }
            }
          }
        });

        // Deduct what we can pay (allow negative balances if we tried to pay more than available)
        faction.facCreds = remainingCredits;

        // Remove assets that failed maintenance for two consecutive turns
        assetsToRemove.forEach((assetId) => {
          const assetIndex = faction.assets.findIndex((a) => a.id === assetId);
          if (assetIndex !== -1) {
            faction.assets.splice(assetIndex, 1);
          }
        });
      });
    },
    // Inflict damage to an asset or Base of Influence
    inflictDamage: (state, action: PayloadAction<InflictDamagePayload>) => {
      const { factionId, assetId, damage, damageToBase = false } = action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      const asset = faction.assets.find((a) => a.id === assetId);
      if (!asset) return;

      // Apply damage to asset
      asset.hp -= damage;

      // Check if asset is a Base of Influence
      // Bases of Influence have special rules: damage to base also damages faction HP
      const assetDef = getAssetById(asset.definitionId);
      const isBaseOfInfluence = damageToBase || assetDef?.name === 'Base of Influence';

      // Store original HP before damage for base damage calculation
      const originalHp = asset.hp + damage; // HP before this damage was applied

      if (isBaseOfInfluence) {
        // Damage to Base of Influence also damages faction HP
        // But overflow damage (when base is destroyed) does NOT go to faction HP
        // So we only apply damage equal to what the base actually had (up to its max HP)
        const damageToFaction = Math.min(damage, originalHp);
        faction.attributes.hp = Math.max(0, faction.attributes.hp - damageToFaction);
      }

      // Check if asset is destroyed (HP <= 0)
      if (asset.hp <= 0) {
        const overflowDamage = Math.abs(asset.hp); // Damage beyond destruction

        // Remove the asset
        const assetIndex = faction.assets.findIndex((a) => a.id === assetId);
        if (assetIndex !== -1) {
          faction.assets.splice(assetIndex, 1);
        }

        // Clean up failed maintenance tracking
        if (state.assetsFailedMaintenance[assetId]) {
          delete state.assetsFailedMaintenance[assetId];
        }

        // Apply overflow damage to faction HP (except for Bases of Influence)
        // For bases, overflow damage is already excluded from faction damage above
        if (!isBaseOfInfluence && overflowDamage > 0) {
          faction.attributes.hp = Math.max(0, faction.attributes.hp - overflowDamage);
        }
      }
    },
    // Inflict damage directly to faction HP (for attacks that bypass assets)
    inflictFactionDamage: (state, action: PayloadAction<{ factionId: string; damage: number }>) => {
      const { factionId, damage } = action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      faction.attributes.hp = Math.max(0, faction.attributes.hp - damage);
    },
    // Repair an asset
    repairAsset: (
      state,
      action: PayloadAction<{
        factionId: string;
        assetId: string;
        hpHealed: number;
        cost: number;
      }>
    ) => {
      const { factionId, assetId, hpHealed, cost } = action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      // Validate faction has enough credits
      if (faction.facCreds < cost) return;

      const asset = faction.assets.find((a) => a.id === assetId);
      if (!asset) return;

      // Deduct cost
      faction.facCreds -= cost;

      // Heal the asset
      asset.hp = Math.min(asset.maxHp, asset.hp + hpHealed);
    },
    // Repair multiple assets
    repairMultipleAssets: (
      state,
      action: PayloadAction<{
        factionId: string;
        repairs: Array<{
          assetId: string;
          hpHealed: number;
          cost: number;
        }>;
        totalCost: number;
      }>
    ) => {
      const { factionId, repairs, totalCost } = action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      // Validate faction has enough credits
      if (faction.facCreds < totalCost) return;

      // Deduct total cost
      faction.facCreds -= totalCost;

      // Apply all repairs
      repairs.forEach((repair) => {
        const asset = faction.assets.find((a) => a.id === repair.assetId);
        if (asset) {
          asset.hp = Math.min(asset.maxHp, asset.hp + repair.hpHealed);
        }
      });
    },
    // Repair faction HP
    repairFactionHp: (
      state,
      action: PayloadAction<{
        factionId: string;
        hpHealed: number;
        cost: number;
      }>
    ) => {
      const { factionId, hpHealed, cost } = action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      // Validate faction has enough credits
      if (faction.facCreds < cost) return;

      // Deduct cost
      faction.facCreds -= cost;

      // Heal faction HP
      faction.attributes.hp = Math.min(
        faction.attributes.maxHp,
        faction.attributes.hp + hpHealed
      );
    },
    // Execute asset ability
    executeAssetAbility: (
      state,
      action: PayloadAction<{
        factionId: string;
        assetId: string;
        facCredsGained?: number;
        facCredsLost?: number;
        cost?: number;
        shouldDestroyAsset?: boolean;
      }>
    ) => {
      const { factionId, assetId, facCredsGained, facCredsLost, cost, shouldDestroyAsset } =
        action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      // Handle costs
      if (cost && faction.facCreds >= cost) {
        faction.facCreds -= cost;
      }

      // Handle FacCred gains/losses
      if (facCredsGained) {
        faction.facCreds += facCredsGained;
      }
      if (facCredsLost) {
        // If faction can't pay, check if asset should be destroyed
        if (faction.facCreds < facCredsLost) {
          if (shouldDestroyAsset) {
            // Remove the asset
            const assetIndex = faction.assets.findIndex((a) => a.id === assetId);
            if (assetIndex !== -1) {
              faction.assets.splice(assetIndex, 1);
            }
          }
          faction.facCreds = 0; // Can't go negative
        } else {
          faction.facCreds -= facCredsLost;
        }
      }

      // Destroy asset if required (e.g., Venture Capital on roll of 1)
      if (shouldDestroyAsset) {
        const assetIndex = faction.assets.findIndex((a) => a.id === assetId);
        if (assetIndex !== -1) {
          faction.assets.splice(assetIndex, 1);
        }
      }
    },
    // Add or upgrade Base of Influence
    addBaseOfInfluence: (
      state,
      action: PayloadAction<{
        factionId: string;
        systemId: string;
        hp: number; // Desired HP for the base
        cost: number; // Cost in FacCreds (should equal hp)
      }>
    ) => {
      const { factionId, systemId, hp, cost } = action.payload;
      const faction = state.factions.find((f) => f.id === factionId);
      if (!faction) return;

      // Validate faction has enough credits
      if (faction.facCreds < cost) return;

      // Check if base already exists
      const existingBaseIndex = faction.assets.findIndex((asset) => {
        const assetDef = getAssetById(asset.definitionId);
        return (
          asset.location === systemId &&
          (assetDef?.name === 'Base of Influence' || asset.definitionId === 'base_of_influence')
        );
      });

      if (existingBaseIndex !== -1) {
        // Upgrade existing base
        const existingBase = faction.assets[existingBaseIndex];
        const newMaxHp = Math.min(hp, faction.attributes.maxHp);
        existingBase.maxHp = newMaxHp;
        existingBase.hp = newMaxHp; // Restore to full when upgrading
        faction.facCreds -= cost;
      } else {
        // Create new base
        const newBase: FactionAsset = {
          id: crypto.randomUUID(),
          definitionId: 'base_of_influence', // Special identifier
          location: systemId,
          hp: hp,
          maxHp: hp,
          stealthed: false,
        };
        faction.assets.push(newBase);
        faction.facCreds -= cost;
      }
    },
  },
});

export const {
  addFaction,
  removeFaction,
  updateFaction,
  selectFaction,
  clearAllFactions,
  hydrateFactions,
  addAsset,
  removeAsset,
  updateAsset,
  moveAsset,
  processIncomePhase,
  processMaintenancePhase,
  inflictDamage,
  inflictFactionDamage,
  repairAsset,
  repairMultipleAssets,
  repairFactionHp,
  executeAssetAbility,
  addBaseOfInfluence,
} = factionsSlice.actions;
export default factionsSlice.reducer;

