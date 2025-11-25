import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { calculateTurnIncome } from '../../utils/factionCalculations';
import { getAssetById } from '../../data/assetLibrary';
import type { Faction } from '../../types/faction';
import { useSoundEffect } from '../../hooks/useAudio';
import './PhaseSummaryModal.css';

interface PhaseSummaryModalProps {
  onClose: () => void;
  turnNumber: number;
}

export default function PhaseSummaryModal({ onClose, turnNumber }: PhaseSummaryModalProps) {
  const factions = useSelector((state: RootState) => state.factions.factions);
  const failedAssets = useSelector((state: RootState) => state.factions.assetsFailedMaintenance);
  const playSound = useSoundEffect();

  // Play modal open sound on mount
  useEffect(() => {
    playSound('ui_modal_open');
  }, [playSound]);

  const handleClose = () => {
    playSound('ui_modal_close');
    onClose();
  };

  return (
    <div className="phase-summary-modal-overlay" onClick={handleClose}>
      <div className="phase-summary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Turn {turnNumber} Summary</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-content">
          {/* Income Phase Summary */}
          <div className="phase-section income-section">
            <h3>💰 Income Phase</h3>
            <div className="faction-summaries">
              {factions.map((faction: Faction) => {
                const income = calculateTurnIncome(faction.attributes);
                return (
                  <div key={faction.id} className="faction-summary">
                    <span className="faction-name">{faction.name}</span>
                    <span className="income-amount">+{income} FacCreds</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Maintenance Phase Summary */}
          <div className="phase-section maintenance-section">
            <h3>🔧 Maintenance Phase</h3>
            <div className="faction-summaries">
              {factions.map((faction: Faction) => {
                const totalMaintenance = faction.assets.reduce((sum, asset) => {
                  const assetDef = getAssetById(asset.definitionId);
                  return sum + (assetDef?.maintenance || 0);
                }, 0);
                
                const failedCount = faction.assets.filter(asset => 
                  failedAssets[asset.id]
                ).length;

                return (
                  <div key={faction.id} className="faction-summary">
                    <span className="faction-name">{faction.name}</span>
                    <div className="maintenance-details">
                      <span className="maintenance-cost">-{totalMaintenance} FacCreds</span>
                      {failedCount > 0 && (
                        <span className="failed-assets">
                          ⚠️ {failedCount} asset{failedCount > 1 ? 's' : ''} failed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* News Phase Summary */}
          <div className="phase-section news-section">
            <h3>📰 News Phase</h3>
            <div className="news-content">
              <p>Turn events have been recorded in the narrative log.</p>
              <p className="news-hint">Check the narrative panel for detailed reports of faction activities.</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleClose}>
            Continue to Action Phase
          </button>
        </div>
      </div>
    </div>
  );
}

