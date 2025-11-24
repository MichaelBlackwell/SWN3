import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { useTurnPhase } from '../../hooks/useTurnPhase';
import { store } from '../../store/store';
import { TurnManager as TurnManagerService } from '../../services/turnManager';
import { calculateTurnIncome } from '../../utils/factionCalculations';
import type { TurnPhase } from '../../store/slices/turnSlice';
import { selectFaction } from '../../store/slices/factionsSlice';
import './TurnManager.css';

export default function TurnManager() {
  const dispatch = useDispatch<AppDispatch>();
  const turnPhase = useTurnPhase();
  const factions = useSelector((state: RootState) => state.factions.factions);
  const selectedFactionId = useSelector((state: RootState) => state.factions.selectedFactionId);

  const selectedFaction = selectedFactionId
    ? factions.find((f) => f.id === selectedFactionId)
    : null;

  const handleAdvancePhase = () => {
    TurnManagerService.advanceTurnPhase(dispatch, store.getState);
  };

  const handleStartNewTurn = () => {
    TurnManagerService.startNewTurn(dispatch, store.getState);
  };

  const handleSelectFaction = (factionId: string) => {
    // Toggle selection: if already selected, deselect; otherwise select
    if (selectedFactionId === factionId) {
      dispatch(selectFaction(null));
    } else {
      dispatch(selectFaction(factionId));
    }
  };

  const phaseColors: Record<TurnPhase, string> = {
    Income: '#4a9eff',
    Maintenance: '#ff8c00',
    Action: '#ff4444',
    News: '#9b59b6',
  };

  const phaseDescriptions: Record<TurnPhase, string> = {
    Income: 'Factions receive FacCreds based on their Wealth, Force, and Cunning attributes.',
    Maintenance:
      'Factions pay maintenance costs for their assets. Assets that cannot be maintained become unusable.',
    Action: 'Factions can take one action: Attack, Buy Asset, Move Asset, Repair, Use Ability, or Expand Influence.',
    News: 'Narrative events are generated from the turn\'s actions.',
  };

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
            <div
              className="phase-indicator"
              style={{ backgroundColor: phaseColors[turnPhase.phase] }}
            >
              <span className="phase-label">Current Phase:</span>
              <span className="phase-name">{turnPhase.phase}</span>
            </div>
          </div>
          <div className="phase-description">{phaseDescriptions[turnPhase.phase]}</div>
        </div>

        {/* Phase Controls */}
        <div className="phase-controls">
          <button
            onClick={handleAdvancePhase}
            className="btn btn-primary"
            disabled={turnPhase.phase === 'Action' && turnPhase.actionStaged && !turnPhase.actionCommitted}
          >
            Advance to Next Phase
          </button>
          <button onClick={handleStartNewTurn} className="btn btn-secondary">
            Start New Turn
          </button>
        </div>

        {/* Action Phase Controls */}
        {turnPhase.phase === 'Action' && (
          <div className="action-phase-controls">
            <h3>Action Phase</h3>
            {turnPhase.actionStaged ? (
              <div className="staged-action">
                <p>
                  <strong>Staged Action:</strong> {turnPhase.stagedActionType || 'Unknown'}
                </p>
                <div className="action-buttons">
                  <button
                    onClick={turnPhase.commitAction}
                    className="btn btn-success"
                    disabled={!turnPhase.canCommitAction}
                  >
                    Commit Action
                  </button>
                  <button
                    onClick={turnPhase.cancelStagedAction}
                    className="btn btn-secondary"
                    disabled={turnPhase.actionCommitted}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="info-text">No action staged. Stage an action to proceed.</p>
            )}

            {/* Undo/Redo Controls */}
            <div className="history-controls">
              <button
                onClick={turnPhase.undo}
                className="btn btn-secondary"
                disabled={!turnPhase.canUndo}
              >
                Undo
              </button>
              <button
                onClick={turnPhase.redo}
                className="btn btn-secondary"
                disabled={!turnPhase.canRedo}
              >
                Redo
              </button>
              {turnPhase.history.length > 0 && (
                <span className="history-info">
                  History: {turnPhase.historyIndex + 1} / {turnPhase.history.length}
                </span>
              )}
            </div>
          </div>
        )}

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
              {factions.map((faction) => {
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

        {/* Phase Information */}
        <div className="phase-info">
          <h3>Phase Cycle</h3>
          <div className="phase-cycle">
            {(['Income', 'Maintenance', 'Action', 'News'] as TurnPhase[]).map((phase, index) => (
              <div
                key={phase}
                className={`phase-step ${turnPhase.phase === phase ? 'active' : ''} ${
                  index < (['Income', 'Maintenance', 'Action', 'News'] as TurnPhase[]).indexOf(turnPhase.phase)
                    ? 'completed'
                    : ''
                }`}
                style={{
                  borderColor: phaseColors[phase],
                  backgroundColor:
                    turnPhase.phase === phase ? phaseColors[phase] + '20' : 'transparent',
                }}
              >
                {phase}
                {index < 3 && <span className="arrow">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

