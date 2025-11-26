import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { useTurnPhase } from '../../hooks/useTurnPhase';
import { store } from '../../store/store';
import { setPhase, setTurn } from '../../store/slices/turnSlice';
import { processIncomePhase, processMaintenancePhase, selectFaction } from '../../store/slices/factionsSlice';
import { selectIsAIProcessing } from '../../store/slices/aiTurnSlice';
import type { Faction } from '../../types/faction';
import { useSoundEffect } from '../../hooks/useAudio';
import { useAITurnExecution } from '../../hooks/useAITurnExecution';
import PhaseSummaryModal from './PhaseSummaryModal';
import AITurnOverlay from '../AITurnOverlay';
import './TurnManager.css';
import { getFactionColor } from '../../utils/factionColors';

const toHsla = (hslColor: string, alpha: number, fallbackAlphaColor = `rgba(255,255,255,${alpha})`) => {
  const match = /hsl\(([-\d.]+),\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/i.exec(hslColor);
  if (!match) {
    return fallbackAlphaColor;
  }
  const [, hue, saturation, lightness] = match;
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
};

export default function TurnManager() {
  const dispatch = useDispatch<AppDispatch>();
  const turnPhase = useTurnPhase();
  const factions = useSelector((state: RootState) => state.factions.factions);
  const selectedFactionId = useSelector((state: RootState) => state.factions.selectedFactionId);
  const gameMode = useSelector((state: RootState) => state.gameMode.mode);
  const isAIProcessing = useSelector(selectIsAIProcessing);
  const [showSummary, setShowSummary] = useState(false);
  const playSound = useSoundEffect();
  const { executeAITurns, hasAIFactions } = useAITurnExecution();

  const handleAdvancePhase = async () => {
    // Play phase transition sounds
    playSound('phase_income');
    
    // Process all three phases: Income, Maintenance, News
    // Income Phase
    dispatch(processIncomePhase());
    
    // Maintenance Phase
    dispatch(processMaintenancePhase());
    
    // Execute AI faction turns (in scenario or editor mode with AI factions)
    if ((gameMode === 'scenario' || gameMode === 'editor') && hasAIFactions()) {
      console.log('[TurnManager] Executing AI turns...');
      await executeAITurns();
      console.log('[TurnManager] AI turns complete');
    } else {
      console.log('[TurnManager] Skipping AI turns:', { gameMode, hasAI: hasAIFactions() });
    }
    
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

  const endTurnButton = (
    <button
      onClick={handleAdvancePhase}
      className="btn-end-turn"
      disabled={isAIProcessing}
    >
      <span className="btn-end-turn__glow"></span>
      <span className="btn-end-turn__scanlines"></span>
      <span className="btn-end-turn__content">
        <span className="btn-end-turn__icon">⟫</span>
        <span className="btn-end-turn__text">{isAIProcessing ? 'AI Turn...' : 'End Turn'}</span>
        <span className="btn-end-turn__icon">⟪</span>
      </span>
      <span className="btn-end-turn__border"></span>
    </button>
  );

  // Use state to track portal slots - they may not exist during initial render
  const [floatingControlsSlot, setFloatingControlsSlot] = useState<HTMLElement | null>(null);
  const [factionsSummarySlot, setFactionsSummarySlot] = useState<HTMLElement | null>(null);

  // Find portal slots after mount (elements may not exist during render phase)
  useEffect(() => {
    const endTurnSlot = document.getElementById('end-turn-button-slot');
    const factionsSlot = document.getElementById('factions-summary-slot');
    setFloatingControlsSlot(endTurnSlot);
    setFactionsSummarySlot(factionsSlot);
  }, []);

  const factionsSummaryContent = factions.length > 0 ? (
    <div className="factions-summary factions-summary--compact">
      <div className="factions-summary__title">
        <span>All Factions</span>
        <span className="factions-summary__hint">(tap to focus)</span>
      </div>
      <div className="faction-chip-grid">
        {factions.map((faction: Faction) => {
          const isSelected = selectedFactionId === faction.id;
          const accentColor = getFactionColor(faction.id);
          const backgroundColor = toHsla(accentColor, 0.22, 'rgba(255,255,255,0.05)');
          const glowColor = toHsla(accentColor, 0.45, 'rgba(74,158,255,0.35)');
          return (
            <button
              key={faction.id}
              type="button"
              className={`faction-chip ${isSelected ? 'faction-chip--selected' : ''}`}
              onClick={() => handleSelectFaction(faction.id)}
              aria-pressed={isSelected}
              style={{
                borderColor: accentColor,
                background: `linear-gradient(135deg, ${backgroundColor} 0%, rgba(10, 12, 20, 0.88) 100%)`,
                boxShadow: isSelected ? `0 0 18px ${glowColor}` : '0 0 0 rgba(0,0,0,0)',
              }}
            >
              <span className="faction-chip__accent" style={{ backgroundColor: accentColor }} aria-hidden />
              <span className="faction-chip__body">
                <span className="faction-chip__name">
                  {faction.name}
                  {isSelected && <span className="faction-chip__check">✓</span>}
                </span>
                <span className="faction-chip__type">{faction.type}</span>
              </span>
              <span className="faction-chip__stat">{faction.facCreds} FC</span>
              <span className="faction-chip__stat">{faction.assets.length} assets</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* AI Turn Overlay */}
      <AITurnOverlay />

      {/* Phase Summary Modal */}
      {showSummary && (
        <PhaseSummaryModal
          onClose={handleCloseSummary}
          turnNumber={turnPhase.turn}
        />
      )}
      {floatingControlsSlot && createPortal(endTurnButton, floatingControlsSlot)}
      {/* Only show factions summary panel in editor mode */}
      {gameMode === 'editor' && factionsSummarySlot && factionsSummaryContent && createPortal(factionsSummaryContent, factionsSummarySlot)}
    </>
  );
}

