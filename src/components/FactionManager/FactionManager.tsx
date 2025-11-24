import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import type { AppDispatch } from '../../store/store';
import { removeFaction, addAsset } from '../../store/slices/factionsSlice';
import type { Faction } from '../../types/faction';
import type { StarSystem } from '../../types/sector';
import { validateAssetPurchase } from '../../utils/assetValidation';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import { showNotification } from '../NotificationContainer';
import { getAssetById } from '../../data/assetLibrary';
import FactionCreationForm from './FactionCreationForm';
import FactionDashboard from './FactionDashboard';
import './FactionManager.css';

export default function FactionManager() {
  const dispatch = useDispatch<AppDispatch>();
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const factions = useSelector((state: RootState) => state.factions.factions);
  const systems = useSelector(
    (state: RootState) => state.sector.currentSector?.systems || []
  );

  const getSystemName = (systemId: string): string => {
    const system = systems.find((s: StarSystem) => s.id === systemId);
    return system?.name || 'Unknown System';
  };

  const handleRemoveFaction = (e: React.MouseEvent, factionId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this faction?')) {
      dispatch(removeFaction(factionId));
    }
  };

  const handlePurchaseAsset = (factionId: string, assetDefinitionId: string) => {
    const faction = factions.find((f: Faction) => f.id === factionId);
    if (!faction) {
      showNotification('Faction not found', 'error');
      return;
    }

    // Validate purchase
    const validation = validateAssetPurchase(faction, assetDefinitionId);
    if (!validation.valid) {
      showNotification(validation.reason || 'Cannot purchase asset', 'error');
      return;
    }

    // Get asset definition for success message
    const assetDef = getAssetById(assetDefinitionId);
    const systemName = getSystemName(faction.homeworld);

    // Assets are purchased at the homeworld when using the button
    dispatch(
      addAsset({
        factionId: factionId,
        assetDefinitionId,
        location: faction.homeworld,
      })
    );

    // Generate narrative for the purchase
    const homeworldSystem = systems.find((s: StarSystem) => s.id === faction.homeworld);
    const getSystemHelper = (id: string) => systems.find((s: StarSystem) => s.id === id);
    const getSystemNameHelper = (id: string): string => {
      const system = getSystemHelper(id);
      return system?.name || 'Unknown System';
    };

    const actorContext = createNarrativeContextFromFaction(faction, getSystemNameHelper, getSystemHelper);
    const systemContext = createNarrativeContextFromSystem(homeworldSystem);

    dispatchNarrativeEntry(dispatch, 'Buy', {
      ...actorContext,
      ...systemContext,
      assetName: assetDef?.name,
      credits: assetDef?.cost,
      result: 'Success',
      relatedEntityIds: [factionId, faction.homeworld].filter(Boolean),
    });

    // Show success notification
    showNotification(
      `Purchased ${assetDef?.name || 'asset'} and placed at ${systemName}`,
      'success'
    );
  };

  return (
    <div className="faction-manager">
      <div className="faction-manager-header">
        <h2>Faction Management</h2>
        <div className="faction-manager-header__count">
          <strong>{factions.length}</strong> faction{factions.length !== 1 ? 's' : ''} created
        </div>
      </div>
      <div className="faction-manager-content">
        <div className={`faction-creation-form ${isFormCollapsed ? 'faction-creation-form--collapsed' : ''}`}>
          <div className="faction-creation-form__header">
            <h2>Create New Faction</h2>
            <button
              className="faction-creation-form__toggle"
              onClick={() => setIsFormCollapsed(!isFormCollapsed)}
              aria-label={isFormCollapsed ? 'Expand form' : 'Collapse form'}
              aria-expanded={!isFormCollapsed}
            >
              {isFormCollapsed ? '▼' : '▲'}
            </button>
          </div>
          {!isFormCollapsed && (
            <div className="faction-creation-form__content">
              <FactionCreationForm />
            </div>
          )}
        </div>
        <div className="faction-dashboards-list">
          <h2>Factions</h2>
          {factions.length === 0 ? (
            <div className="empty-state">
              <p>No factions created yet.</p>
              <p>Create your first faction using the form on the left.</p>
            </div>
          ) : (
            <div className="faction-dashboards-container">
              {factions.map((faction: Faction) => (
                <div key={faction.id} className="faction-dashboard-wrapper">
                  <FactionDashboard
                    factionId={faction.id}
                    onPurchaseAsset={(assetDefinitionId) =>
                      handlePurchaseAsset(faction.id, assetDefinitionId)
                    }
                  />
                  <button
                    className="faction-remove-btn"
                    onClick={(e) => handleRemoveFaction(e, faction.id)}
                    title="Remove faction"
                    aria-label={`Remove ${faction.name}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

