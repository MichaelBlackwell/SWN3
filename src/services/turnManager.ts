// Turn Manager Service
// Coordinates phase transitions and automatic phase processing

import type { AppDispatch, RootState } from '../store/store';
import { advancePhase, setPhase as setTurnPhase, type TurnPhase } from '../store/slices/turnSlice';
import { processIncomePhase, processMaintenancePhase } from '../store/slices/factionsSlice';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction } from '../utils/narrativeHelpers';
import { calculateTurnIncome } from '../utils/factionCalculations';
import { getAssetById } from '../data/assetLibrary';
import type { Faction, FactionAsset } from '../types/faction';
import type { StarSystem } from '../types/sector';

/**
 * Service to manage turn phase transitions and automatic processing
 */
export class TurnManager {
  /**
   * Advance to the next phase in the turn cycle
   * Automatically processes phase-specific logic (e.g., Income phase)
   */
  static advanceTurnPhase(dispatch: AppDispatch, getState: () => RootState) {
    // const state = getState();
    // const currentPhase = state.turn.phase;

    // Advance to next phase
    dispatch(advancePhase());

    // Get the new phase after advancement
    const newState = getState();
    const newPhase = newState.turn.phase;

    // Process phase-specific logic
    if (newPhase === 'Income') {
      // Automatically process income for all factions
      dispatch(processIncomePhase());
      
      // Generate narrative entries for income phase
      const stateAfterProcessing = getState();
      const systems = stateAfterProcessing.sector.currentSector?.systems || [];
      
      stateAfterProcessing.factions.factions.forEach((faction: Faction) => {
        const income = calculateTurnIncome(faction.attributes);
        if (income > 0) {
          const getSystemName = (systemId: string): string => {
            const system = systems.find((s: StarSystem) => s.id === systemId);
            return system?.name || 'Unknown System';
          };
          const getSystem = (systemId: string) => systems.find((s: StarSystem) => s.id === systemId);
          
          const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
          
          dispatchNarrativeEntry(dispatch, 'Income', {
            ...actorContext,
            credits: income,
            result: 'Success',
            relatedEntityIds: [faction.id],
          });
        }
      });
    } else if (newPhase === 'Maintenance') {
      // Track maintenance results before processing
      const stateBeforeProcessing = getState();
      const systems = stateBeforeProcessing.sector.currentSector?.systems || [];
      
      // Automatically process maintenance for all factions
      dispatch(processMaintenancePhase());
      
      // Generate narrative entries for maintenance phase
      const stateAfterProcessing = getState();
      
      stateAfterProcessing.factions.factions.forEach((faction: Faction) => {
        // Calculate what was paid (difference in credits)
        const factionBefore = stateBeforeProcessing.factions.factions.find((f: Faction) => f.id === faction.id);
        if (!factionBefore) return;
        
        // const maintenancePaid = factionBefore.facCreds - faction.facCreds;
        const hasFailedAssets = Object.keys(stateAfterProcessing.factions.assetsFailedMaintenance)
          .some((assetId: string) => {
            const asset = faction.assets.find((a: FactionAsset) => a.id === assetId);
            return asset !== undefined;
          });
        
        const getSystemName = (systemId: string): string => {
          const system = systems.find((s: StarSystem) => s.id === systemId);
          return system?.name || 'Unknown System';
        };
        const getSystem = (systemId: string) => systems.find((s: StarSystem) => s.id === systemId);
        
        const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
        
        dispatchNarrativeEntry(dispatch, 'Maintenance', {
          ...actorContext,
          result: hasFailedAssets ? 'Failure' : 'Success',
          relatedEntityIds: [faction.id],
        });
        
        // Generate narrative for assets that were destroyed due to maintenance failure
        factionBefore.assets.forEach((assetBefore: FactionAsset) => {
          const assetAfter = faction.assets.find((a: FactionAsset) => a.id === assetBefore.id);
          if (!assetAfter) {
            // Asset was removed during maintenance
            const assetDef = getAssetById(assetBefore.definitionId);
            if (assetDef) {
              dispatchNarrativeEntry(dispatch, 'AssetDestroyed', {
                ...actorContext,
                assetName: assetDef.name,
                result: 'Success',
                relatedEntityIds: [faction.id, assetBefore.id],
              });
            }
          }
        });
      });
    }
    // Other phases (Action, News) will be handled by their respective systems
  }

  /**
   * Start a new turn (sets phase to Income and processes it)
   */
  static startNewTurn(dispatch: AppDispatch, getState: () => RootState) {
    // Set phase to Income
    dispatch(setTurnPhase('Income'));

    // Process income phase
    dispatch(processIncomePhase());
    
    // Generate narrative entries for income phase
    const stateAfterProcessing = getState();
    const systems = stateAfterProcessing.sector.currentSector?.systems || [];
    
    stateAfterProcessing.factions.factions.forEach((faction: Faction) => {
      const income = calculateTurnIncome(faction.attributes);
      if (income > 0) {
        const getSystemName = (systemId: string): string => {
          const system = systems.find((s: StarSystem) => s.id === systemId);
          return system?.name || 'Unknown System';
        };
        const getSystem = (systemId: string) => systems.find((s: StarSystem) => s.id === systemId);
        
        const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
        
        dispatchNarrativeEntry(dispatch, 'Income', {
          ...actorContext,
          credits: income,
          result: 'Success',
          relatedEntityIds: [faction.id],
        });
      }
    });
  }

  /**
   * Set a specific phase (useful for initialization or testing)
   */
  static setPhase(dispatch: AppDispatch, getState: () => RootState, phase: TurnPhase) {
    dispatch(setTurnPhase(phase));

    // If setting to Income, process it
    if (phase === 'Income') {
      dispatch(processIncomePhase());
      
      // Generate narrative entries for income phase
      const stateAfterProcessing = getState();
      const systems = stateAfterProcessing.sector.currentSector?.systems || [];
      
      stateAfterProcessing.factions.factions.forEach((faction: Faction) => {
        const income = calculateTurnIncome(faction.attributes);
        if (income > 0) {
          const getSystemName = (systemId: string): string => {
            const system = systems.find((s: StarSystem) => s.id === systemId);
            return system?.name || 'Unknown System';
          };
          const getSystem = (systemId: string) => systems.find((s: StarSystem) => s.id === systemId);
          
          const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
          
          dispatchNarrativeEntry(dispatch, 'Income', {
            ...actorContext,
            credits: income,
            result: 'Success',
            relatedEntityIds: [faction.id],
          });
        }
      });
    }
  }
}

