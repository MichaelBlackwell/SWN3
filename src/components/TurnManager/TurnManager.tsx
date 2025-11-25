import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { useTurnPhase } from '../../hooks/useTurnPhase';
import { store } from '../../store/store';
import { setPhase, setTurn } from '../../store/slices/turnSlice';
import { processIncomePhase, processMaintenancePhase } from '../../store/slices/factionsSlice';
import { calculateTurnIncome } from '../../utils/factionCalculations';
import type { TurnPhase } from '../../store/slices/turnSlice';
import { selectFaction } from '../../store/slices/factionsSlice';
import type { Faction } from '../../types/faction';
import { useSoundEffect } from '../../hooks/useAudio';
import PhaseSummaryModal from './PhaseSummaryModal';
import './TurnManager.css';

// Human-readable action type names
const ACTION_TYPE_LABELS: Record<string, string> = {
  'Attack': 'Attack',
  'MOVE_ASSET': 'Move Asset',
  'REPAIR': 'Repair',
  'USE_ABILITY': 'Use Asset Ability',
  'EXPAND_INFLUENCE': 'Expand Influence',
  'BUY_ASSET': 'Buy Asset',
};

export default function TurnManager() {
  const dispatch = useDispatch<AppDispatch>();
  const turnPhase = useTurnPhase();
  const factions = useSelector((state: RootState) => state.factions.factions);
  const selectedFactionId = useSelector((state: RootState) => state.factions.selectedFactionId);
  const [showSummary, setShowSummary] = useState(false);
  const playSound = useSoundEffect();

  const selectedFaction = selectedFactionId
    ? factions.find((f: Faction) => f.id === selectedFactionId)
    : null;

  const handleAdvancePhase = () => {
    // Play phase transition sounds
    playSound('phase_income');
    
    // Process all three phases: Income, Maintenance, News
    // Income Phase
    dispatch(processIncomePhase());
    
    // Maintenance Phase
    dispatch(processMaintenancePhase());
    
    // News Phase (no processing needed, just for narrative)
    
    // Show the summary modal
    setShowSummary(true);
  };

  const handleCloseSummary = () => {
    setShowSummary(false);
    
    // Play turn complete sound
    playSound('turn_complete');
    
    // Increment turn number
    const currentTurn = store.getState().turn.turn;
    dispatch(setTurn(currentTurn + 1));
    
    // Return to Action phase
    dispatch(setPhase('Action'));
  };

  const handleSelectFaction = (factionId: string) => {
    playSound('ui_click');
    // Toggle selection: if already selected, deselect; otherwise select
    if (selectedFactionId === factionId) {
      dispatch(selectFaction(null));
    } else {
      dispatch(selectFaction(factionId));
    }
  };

  const phaseDescriptions: Record<TurnPhase, string> = {
    Income: 'Factions receive FacCreds based on their Wealth, Force, and Cunning attributes.',
    Maintenance:
      'Factions pay maintenance costs for their assets. Assets that cannot be maintained become unusable.',
    Action: 'Each faction can take one action TYPE per turn, but can perform that action with multiple assets.',
    News: 'Narrative events are generated from the turn\'s actions.',
  };

  // Get human-readable label for the used action type
  const usedActionLabel = turnPhase.usedActionType 
    ? ACTION_TYPE_LABELS[turnPhase.usedActionType] || turnPhase.usedActionType
    : null;

  return (
    <div className="turn-manager">
      <div className="turn-manager-content">
        {/* Current Turn and Phase Display */}
        <div className="turn-phase-display">
          <div className="turn-info">
            <div className="turn-number">
              <span className="label">Turn:</span>
              <span className="value">{turnPhase.turn}</span>
            </div>
          </div>
          <div className="phase-description">{phaseDescriptions[turnPhase.phase as TurnPhase]}</div>
        </div>

        {/* Phase Controls */}
        <div className="phase-controls">
          <button
            onClick={handleAdvancePhase}
            className="btn-end-turn"
          >
            <span className="btn-end-turn__glow"></span>
            <span className="btn-end-turn__scanlines"></span>
            <span className="btn-end-turn__content">
              <span className="btn-end-turn__icon">⟫</span>
              <span className="btn-end-turn__text">END TURN</span>
              <span className="btn-end-turn__icon">⟪</span>
            </span>
            <span className="btn-end-turn__border"></span>
          </button>
        </div>

        {/* Selected Faction Status */}
        {selectedFaction ? (
          <div className="faction-status">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>{selectedFaction.name}</h3>
              <button
                onClick={() => dispatch(selectFaction(null))}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  color: '#aaa',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
                title="Deselect faction"
              >
                ✕
              </button>
            </div>
            <div className="faction-stats">
              <div className="stat-item">
                <span className="stat-label">FacCreds:</span>
                <span className="stat-value">{selectedFaction.facCreds}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Assets:</span>
                <span className="stat-value">{selectedFaction.assets.length}</span>
              </div>
              {turnPhase.phase === 'Income' && (
                <div className="stat-item">
                  <span className="stat-label">Next Income:</span>
                  <span className="stat-value">
                    +{calculateTurnIncome(selectedFaction.attributes)}
                  </span>
                </div>
              )}
            </div>
            {turnPhase.phase === 'Action' && (
              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#2a2a2a', borderRadius: '4px', fontSize: '12px', color: '#aaa' }}>
                <strong style={{ color: '#fff' }}>Selected for Actions:</strong> Click on assets in World Details to perform actions.
                {usedActionLabel && (
                  <div style={{ marginTop: '6px', padding: '6px 8px', backgroundColor: '#4a9eff20', borderRadius: '4px', border: '1px solid #4a9eff' }}>
                    <span style={{ color: '#4a9eff', fontWeight: '600' }}>Action Type: {usedActionLabel}</span>
                    <div style={{ color: '#aaa', fontSize: '11px', marginTop: '2px' }}>
                      You can perform more {usedActionLabel} actions with other assets.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          turnPhase.phase === 'Action' && factions.length > 0 && (
            <div style={{ padding: '12px', backgroundColor: '#2a2a2a', borderRadius: '4px', border: '1px solid #4a9eff', marginBottom: '16px' }}>
              <div style={{ color: '#4a9eff', fontWeight: '600', marginBottom: '4px', fontSize: '13px' }}>
                Select a Faction
              </div>
              <div style={{ color: '#aaa', fontSize: '12px' }}>
                Click on a faction below to select it. Action buttons will appear for that faction's assets in World Details.
              </div>
            </div>
          )
        )}

        {/* All Factions Summary */}
        {factions.length > 0 && (
          <div className="factions-summary">
            <h3>All Factions {selectedFactionId && <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 'normal' }}>(Click to select)</span>}</h3>
            <div className="factions-list">
              {factions.map((faction: Faction) => {
                const isSelected = selectedFactionId === faction.id;
                return (
                  <div
                    key={faction.id}
                    className="faction-summary-item"
                    onClick={() => handleSelectFaction(faction.id)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#4a9eff20' : 'transparent',
                      border: isSelected ? '2px solid #4a9eff' : '1px solid #333',
                      borderRadius: '4px',
                      padding: '8px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#2a2a2a';
                        e.currentTarget.style.borderColor = '#555';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = '#333';
                      }
                    }}
                    title={isSelected ? 'Click to deselect' : 'Click to select this faction'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div className="faction-name" style={{ fontWeight: isSelected ? '600' : 'normal', color: isSelected ? '#4a9eff' : '#fff' }}>
                        {faction.name}
                        {isSelected && <span style={{ marginLeft: '6px', fontSize: '10px' }}>✓</span>}
                      </div>
                    </div>
                    <div className="faction-credits">{faction.facCreds} FacCreds</div>
                    <div className="faction-assets">{faction.assets.length} assets</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Phase Summary Modal */}
      {showSummary && (
        <PhaseSummaryModal
          onClose={handleCloseSummary}
          turnNumber={turnPhase.turn}
        />
      )}
    </div>
  );
}

