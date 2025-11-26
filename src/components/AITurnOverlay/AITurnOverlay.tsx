/**
 * AITurnOverlay - Visual feedback during AI faction turns
 *
 * Displays a sleek overlay showing which AI faction is taking its turn,
 * what phase they're in, and what actions they're executing.
 */

import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  selectIsAIProcessing,
  selectCurrentAIFactionId,
  selectCurrentAIFactionName,
  selectAITurnPhase,
  selectAITurnProgress,
  selectAICurrentAction,
  selectShowAIOverlay,
  selectAIFactionQueue,
  selectAICompletedFactions,
} from '../../store/slices/aiTurnSlice';
import { getFactionColor } from '../../utils/factionColors';
import './AITurnOverlay.css';

const phaseLabels: Record<string, string> = {
  idle: 'Waiting',
  analysis: 'Analyzing Sector',
  goal: 'Setting Goals',
  economy: 'Managing Economy',
  scoring: 'Evaluating Options',
  execution: 'Taking Action',
  complete: 'Turn Complete',
};

const phaseIcons: Record<string, string> = {
  idle: '⏳',
  analysis: '🔍',
  goal: '🎯',
  economy: '💰',
  scoring: '⚖️',
  execution: '⚔️',
  complete: '✓',
};

export default function AITurnOverlay() {
  const isProcessing = useSelector(selectIsAIProcessing);
  const currentFactionId = useSelector(selectCurrentAIFactionId);
  const currentFactionName = useSelector(selectCurrentAIFactionName);
  const phase = useSelector(selectAITurnPhase);
  const progress = useSelector(selectAITurnProgress);
  const currentAction = useSelector(selectAICurrentAction);
  const showOverlay = useSelector(selectShowAIOverlay);
  const factionQueue = useSelector(selectAIFactionQueue);
  const completedFactions = useSelector(selectAICompletedFactions);

  if (!isProcessing || !showOverlay) {
    return null;
  }

  const factionColor = currentFactionId ? getFactionColor(currentFactionId) : 'hsl(220, 70%, 50%)';
  const totalFactions = factionQueue.length + completedFactions.length;
  const factionsCompleted = completedFactions.length;

  return (
    <AnimatePresence>
      <motion.div
        className="ai-turn-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Backdrop with faction color glow */}
        <div
          className="ai-turn-overlay__backdrop"
          style={{
            background: `radial-gradient(ellipse at center, ${factionColor}15 0%, transparent 70%)`,
          }}
        />

        {/* Main content card */}
        <motion.div
          className="ai-turn-overlay__card"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          style={{
            borderColor: factionColor,
            boxShadow: `0 0 40px ${factionColor}40, inset 0 0 20px ${factionColor}10`,
          }}
        >
          {/* Header */}
          <div className="ai-turn-overlay__header">
            <div className="ai-turn-overlay__faction-indicator" style={{ backgroundColor: factionColor }} />
            <div className="ai-turn-overlay__title">
              <span className="ai-turn-overlay__label">AI FACTION TURN</span>
            <motion.span
              className="ai-turn-overlay__faction-name"
              key={currentFactionName}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ color: factionColor }}
            >
              {currentFactionName || 'Unknown Faction'}
            </motion.span>
            </div>
            {totalFactions > 1 && (
              <div className="ai-turn-overlay__faction-count">
                {factionsCompleted + 1} / {totalFactions}
              </div>
            )}
          </div>

          {/* Phase indicator */}
          <div className="ai-turn-overlay__phase">
            <motion.span
              className="ai-turn-overlay__phase-icon"
              key={phase}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
            >
              {phaseIcons[phase] || '⏳'}
            </motion.span>
            <motion.span
              className="ai-turn-overlay__phase-label"
              key={`label-${phase}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {phaseLabels[phase] || phase}
            </motion.span>
          </div>

          {/* Progress bar */}
          <div className="ai-turn-overlay__progress-container">
            <div className="ai-turn-overlay__progress-track">
              <motion.div
                className="ai-turn-overlay__progress-fill"
                style={{ backgroundColor: factionColor }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
              <div
                className="ai-turn-overlay__progress-glow"
                style={{
                  background: `linear-gradient(90deg, transparent, ${factionColor}80, transparent)`,
                  left: `${progress - 10}%`,
                }}
              />
            </div>
            <span className="ai-turn-overlay__progress-text">{Math.round(progress)}%</span>
          </div>

          {/* Current action */}
          <AnimatePresence mode="wait">
            {currentAction && (
              <motion.div
                className="ai-turn-overlay__action"
                key={currentAction}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <span className="ai-turn-overlay__action-icon">▶</span>
                <span className="ai-turn-overlay__action-text">{currentAction}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scanning animation */}
          <div className="ai-turn-overlay__scanner">
            <motion.div
              className="ai-turn-overlay__scanner-line"
              style={{ backgroundColor: factionColor }}
              animate={{
                top: ['0%', '100%', '0%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>
        </motion.div>

        {/* Decorative elements */}
        <div className="ai-turn-overlay__corners">
          <div className="ai-turn-overlay__corner ai-turn-overlay__corner--tl" style={{ borderColor: factionColor }} />
          <div className="ai-turn-overlay__corner ai-turn-overlay__corner--tr" style={{ borderColor: factionColor }} />
          <div className="ai-turn-overlay__corner ai-turn-overlay__corner--bl" style={{ borderColor: factionColor }} />
          <div className="ai-turn-overlay__corner ai-turn-overlay__corner--br" style={{ borderColor: factionColor }} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

