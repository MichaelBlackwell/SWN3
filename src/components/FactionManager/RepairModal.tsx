import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import type { FactionAsset } from '../../types/faction';
import { getAssetById } from '../../data/assetLibrary';
import {
  calculateAssetRepairCost,
  calculateFactionRepairCost,
  calculateMultipleAssetRepairCost,
} from '../../utils/repairCalculations';
import './RepairModal.css';

interface RepairModalProps {
  factionId: string;
  onClose: () => void;
  onConfirm: (repairs: {
    assetRepairs?: Array<{ assetId: string; hpHealed: number; cost: number }>;
    factionRepair?: { hpHealed: number; cost: number };
  }) => void;
}

export default function RepairModal({
  factionId,
  onClose,
  onConfirm,
}: RepairModalProps) {
  const faction = useSelector((state: RootState) =>
    state.factions.factions.find((f) => f.id === factionId)
  );
  const systems = useSelector(
    (state: RootState) => state.sector.currentSector?.systems || []
  );

  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [repairFactionHp, setRepairFactionHp] = useState(false);

  if (!faction) {
    return null;
  }

  const getSystemName = (systemId: string): string => {
    const system = systems.find((s) => s.id === systemId);
    return system?.name || 'Unknown System';
  };

  // Get damaged assets (HP < maxHp)
  const damagedAssets = faction.assets.filter((asset) => asset.hp < asset.maxHp);
  const factionNeedsRepair = faction.attributes.hp < faction.attributes.maxHp;

  // Calculate costs for selected repairs
  const selectedAssets = damagedAssets.filter((asset) =>
    selectedAssetIds.has(asset.id)
  );

  const assetRepairs = selectedAssets.length > 0
    ? calculateMultipleAssetRepairCost(faction, selectedAssets)
    : { cost: 0, repairs: [] };

  const factionRepair = repairFactionHp
    ? calculateFactionRepairCost(faction)
    : { cost: 0, hpHealed: 0 };

  const totalCost = assetRepairs.cost + factionRepair.cost;
  const canAfford = faction.facCreds >= totalCost;

  const handleToggleAsset = (assetId: string) => {
    const newSelected = new Set(selectedAssetIds);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssetIds(newSelected);
  };

  const handleConfirm = () => {
    if (!canAfford) return;

    onConfirm({
      assetRepairs: assetRepairs.repairs.length > 0 ? assetRepairs.repairs : undefined,
      factionRepair: repairFactionHp ? factionRepair : undefined,
    });
  };

  return (
    <div className="repair-modal-overlay" onClick={onClose}>
      <div className="repair-modal" onClick={(e) => e.stopPropagation()}>
        <div className="repair-modal-header">
          <h2>Repair Assets and Faction HP</h2>
          <button className="repair-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="repair-modal-content">
          <div className="repair-resources">
            <div className="repair-resource-item">
              <span>Available FacCreds:</span>
              <span className={canAfford ? '' : 'insufficient'}>
                {faction.facCreds}
              </span>
            </div>
            <div className="repair-resource-item">
              <span>Total Cost:</span>
              <span className={canAfford ? '' : 'insufficient'}>
                {totalCost}
              </span>
            </div>
            {!canAfford && totalCost > 0 && (
              <div className="repair-error">
                Insufficient FacCreds. Need {totalCost}, have {faction.facCreds}
              </div>
            )}
          </div>

          {factionNeedsRepair && (
            <div className="repair-section">
              <h3>Faction HP</h3>
              <div className="repair-item">
                <label>
                  <input
                    type="checkbox"
                    checked={repairFactionHp}
                    onChange={(e) => setRepairFactionHp(e.target.checked)}
                  />
                  <span>
                    Repair Faction HP ({faction.attributes.hp} / {faction.attributes.maxHp})
                  </span>
                </label>
                {repairFactionHp && (
                  <div className="repair-details">
                    <span>Cost: {factionRepair.cost} FacCred</span>
                    <span>Healing: +{factionRepair.hpHealed} HP</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {damagedAssets.length > 0 && (
            <div className="repair-section">
              <h3>Damaged Assets</h3>
              <div className="repair-assets-list">
                {damagedAssets.map((asset) => {
                  const assetDef = getAssetById(asset.definitionId);
                  const isSelected = selectedAssetIds.has(asset.id);
                  const repair = calculateAssetRepairCost(faction, asset);

                  return (
                    <div key={asset.id} className="repair-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleAsset(asset.id)}
                        />
                        <span>
                          {assetDef?.name || asset.definitionId} ({asset.hp} / {asset.maxHp} HP)
                          <span className="asset-location">
                            {' '}at {getSystemName(asset.location)}
                          </span>
                        </span>
                      </label>
                      {isSelected && (
                        <div className="repair-details">
                          <span>Cost: {repair.cost} FacCred</span>
                          <span>Healing: +{repair.hpHealed} HP</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {damagedAssets.length === 0 && !factionNeedsRepair && (
            <div className="repair-empty">
              <p>No repairs needed. All assets and faction HP are at maximum.</p>
            </div>
          )}
        </div>

        <div className="repair-modal-footer">
          <button className="repair-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="repair-confirm-btn"
            onClick={handleConfirm}
            disabled={!canAfford || (selectedAssetIds.size === 0 && !repairFactionHp)}
          >
            Confirm Repair ({totalCost} FacCred)
          </button>
        </div>
      </div>
    </div>
  );
}




