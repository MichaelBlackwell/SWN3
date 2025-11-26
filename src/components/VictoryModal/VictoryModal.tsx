import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store/store';
import {
  selectIsVictory,
  selectVictorFactionId,
  selectEliminatedFactionIds,
  continueAfterVictory,
  resetGameState,
} from '../../store/slices/gameStateSlice';
import { clearAllFactions } from '../../store/slices/factionsSlice';
import { resetTurnState } from '../../store/slices/turnSlice';
import { getFactionColor } from '../../utils/factionColors';
import { useSoundEffect } from '../../hooks/useAudio';
import './VictoryModal.css';

export default function VictoryModal() {
  const dispatch = useDispatch<AppDispatch>();
  const isVictory = useSelector(selectIsVictory);
  const victorFactionId = useSelector(selectVictorFactionId);
  const eliminatedFactionIds = useSelector(selectEliminatedFactionIds);
  const factions = useSelector((state: RootState) => state.factions.factions);
  const playSound = useSoundEffect();

  // Get victor faction details
  const victorFaction = factions.find((f) => f.id === victorFactionId);
  const victorColor = victorFactionId ? getFactionColor(victorFactionId) : '#fbbf24';

  // Get eliminated faction names
  const eliminatedFactions = factions.filter((f) => eliminatedFactionIds.includes(f.id));

  // Play victory sound when modal appears
  useEffect(() => {
    if (isVictory) {
      playSound('turn_complete'); // Reuse existing sound or add a victory sound
    }
  }, [isVictory, playSound]);

  const handleContinuePlaying = () => {
    playSound('ui_click');
    dispatch(continueAfterVictory());
  };

  const handleNewGame = () => {
    playSound('ui_click');
    // Reset all game state
    dispatch(resetGameState());
    dispatch(clearAllFactions());
    dispatch(resetTurnState());
    // Note: The actual new game flow would typically reload or navigate
    // For now, we just reset the state
  };

  if (!isVictory || !victorFaction) {
    return null;
  }

  return (
    <div className="victory-modal-overlay">
      <div className="victory-modal" style={{ '--victor-color': victorColor } as React.CSSProperties}>
        {/* Animated background effects */}
        <div className="victory-bg-effects">
          <div className="victory-glow" />
          <div className="victory-rays" />
          <div className="victory-particles">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="victory-particle" style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties} />
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="victory-content">
          <div className="victory-crown">
            <span className="victory-crown-icon">👑</span>
          </div>

          <h1 className="victory-title">VICTORY</h1>

          <div className="victory-winner">
            <div className="victory-winner-accent" style={{ backgroundColor: victorColor }} />
            <div className="victory-winner-info">
              <span className="victory-winner-label">DOMINATION ACHIEVED BY</span>
              <span className="victory-winner-name" style={{ color: victorColor }}>
                {victorFaction.name}
              </span>
              <span className="victory-winner-type">{victorFaction.type}</span>
            </div>
          </div>

          {eliminatedFactions.length > 0 && (
            <div className="victory-eliminated">
              <h3 className="victory-eliminated-title">Factions Eliminated</h3>
              <div className="victory-eliminated-list">
                {eliminatedFactions.map((faction) => {
                  const factionColor = getFactionColor(faction.id);
                  return (
                    <div key={faction.id} className="victory-eliminated-item">
                      <span
                        className="victory-eliminated-accent"
                        style={{ backgroundColor: factionColor }}
                      />
                      <span className="victory-eliminated-name">{faction.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="victory-stats">
            <div className="victory-stat">
              <span className="victory-stat-value">{victorFaction.attributes.force}</span>
              <span className="victory-stat-label">Force</span>
            </div>
            <div className="victory-stat">
              <span className="victory-stat-value">{victorFaction.attributes.cunning}</span>
              <span className="victory-stat-label">Cunning</span>
            </div>
            <div className="victory-stat">
              <span className="victory-stat-value">{victorFaction.attributes.wealth}</span>
              <span className="victory-stat-label">Wealth</span>
            </div>
            <div className="victory-stat">
              <span className="victory-stat-value">{victorFaction.assets.length}</span>
              <span className="victory-stat-label">Assets</span>
            </div>
          </div>

          <div className="victory-actions">
            <button className="victory-btn victory-btn-continue" onClick={handleContinuePlaying}>
              <span className="victory-btn-text">Continue Playing</span>
              <span className="victory-btn-hint">Sandbox mode</span>
            </button>
            <button className="victory-btn victory-btn-new" onClick={handleNewGame}>
              <span className="victory-btn-text">New Game</span>
              <span className="victory-btn-hint">Start fresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


