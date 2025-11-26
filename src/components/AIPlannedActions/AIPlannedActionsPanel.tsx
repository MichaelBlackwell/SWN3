/**
 * AIPlannedActionsPanel - Displays AI faction strategic plans
 *
 * Shows players what AI factions are planning over the next few turns,
 * including their objectives, threats, and planned actions.
 */

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../../store/rootReducer';
import { selectAllPlans, selectAllUpcomingActions } from '../../store/slices/aiPlansSlice';
import type { AIStrategicPlan, PlannedAction, StrategicObjective } from '../../types/aiPlan';
import { getFactionColor } from '../../utils/factionColors';
import './AIPlannedActionsPanel.css';

// ============================================================================
// ICONS
// ============================================================================

const actionIcons: Record<string, string> = {
  attack: '⚔️',
  move: '🚀',
  defend: '🛡️',
  expand: '🏴',
  purchase: '💰',
  repair: '🔧',
  save: '💎',
  use_ability: '✨',
};

const priorityColors: Record<string, string> = {
  critical: '#ff4444',
  high: '#ff8844',
  medium: '#ffcc44',
  low: '#88cc44',
};

const threatSeverityColors: Record<string, string> = {
  critical: '#ff4444',
  high: '#ff8844',
  medium: '#ffcc44',
  low: '#88cc44',
};

const objectiveTypeIcons: Record<string, string> = {
  destroy_asset: '💥',
  capture_system: '🌍',
  eliminate_faction: '☠️',
  expand_influence: '📈',
  build_army: '🏗️',
  economic_growth: '📊',
  defensive_posture: '🏰',
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ObjectiveDisplay({ objective }: { objective: StrategicObjective }) {
  return (
    <div className="ai-plan__objective">
      <span className="ai-plan__objective-icon">
        {objectiveTypeIcons[objective.type] || '🎯'}
      </span>
      <div className="ai-plan__objective-content">
        <span className="ai-plan__objective-description">{objective.description}</span>
        <div className="ai-plan__objective-progress">
          <div className="ai-plan__objective-progress-bar">
            <div
              className="ai-plan__objective-progress-fill"
              style={{ width: `${objective.progress}%` }}
            />
          </div>
          <span className="ai-plan__objective-eta">
            ~{objective.estimatedTurnsToComplete} turns
          </span>
        </div>
      </div>
      <span
        className="ai-plan__objective-priority"
        data-priority={objective.priority}
      >
        {objective.priority}
      </span>
    </div>
  );
}

function PlannedActionItem({
  action,
  turnOffset,
}: {
  action: PlannedAction;
  turnOffset: number;
}) {
  return (
    <motion.div
      className="ai-plan__action"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: turnOffset * 0.1 }}
    >
      <span className="ai-plan__action-icon">
        {actionIcons[action.type] || '▶️'}
      </span>
      <div className="ai-plan__action-content">
        <span className="ai-plan__action-description">{action.description}</span>
        {action.targetFactionName && (
          <span className="ai-plan__action-target">
            vs {action.targetFactionName}
          </span>
        )}
      </div>
      <div className="ai-plan__action-meta">
        <span
          className="ai-plan__action-confidence"
          style={{
            color:
              action.confidence >= 70
                ? '#88cc44'
                : action.confidence >= 40
                  ? '#ffcc44'
                  : '#ff8844',
          }}
        >
          {action.confidence}%
        </span>
        <span
          className="ai-plan__action-priority"
          style={{ color: priorityColors[action.priority] }}
        >
          {action.priority}
        </span>
      </div>
    </motion.div>
  );
}

function ThreatItem({
  threat,
}: {
  threat: AIStrategicPlan['identifiedThreats'][0];
}) {
  return (
    <div className="ai-plan__threat">
      <span
        className="ai-plan__threat-severity"
        style={{ color: threatSeverityColors[threat.severity] }}
      >
        ⚠️
      </span>
      <div className="ai-plan__threat-content">
        <span className="ai-plan__threat-description">{threat.description}</span>
        <span className="ai-plan__threat-response">→ {threat.response}</span>
      </div>
    </div>
  );
}

function OpportunityItem({
  opportunity,
}: {
  opportunity: AIStrategicPlan['identifiedOpportunities'][0];
}) {
  return (
    <div className="ai-plan__opportunity">
      <span className="ai-plan__opportunity-icon">💡</span>
      <div className="ai-plan__opportunity-content">
        <span className="ai-plan__opportunity-description">
          {opportunity.description}
        </span>
        <span className="ai-plan__opportunity-action">→ {opportunity.action}</span>
      </div>
      <span
        className="ai-plan__opportunity-value"
        data-value={opportunity.value}
      >
        {opportunity.value}
      </span>
    </div>
  );
}

function FactionPlanCard({
  plan,
  isExpanded,
  onToggle,
}: {
  plan: AIStrategicPlan;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const factionColor = getFactionColor(plan.factionId);

  return (
    <motion.div
      className="ai-plan__faction-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderColor: factionColor,
        boxShadow: isExpanded ? `0 0 20px ${factionColor}30` : 'none',
      }}
    >
      {/* Header - Always visible */}
      <div
        className="ai-plan__faction-header"
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
      >
        <div
          className="ai-plan__faction-indicator"
          style={{ backgroundColor: factionColor }}
        />
        <div className="ai-plan__faction-title">
          <span className="ai-plan__faction-name" style={{ color: factionColor }}>
            {plan.factionName}
          </span>
          <span className="ai-plan__faction-summary">{plan.summary}</span>
        </div>
        <div className="ai-plan__faction-confidence">
          <div
            className="ai-plan__confidence-ring"
            style={{
              background: `conic-gradient(${factionColor} ${plan.overallConfidence}%, transparent ${plan.overallConfidence}%)`,
            }}
          >
            <span className="ai-plan__confidence-value">
              {Math.round(plan.overallConfidence)}%
            </span>
          </div>
        </div>
        <span className={`ai-plan__expand-icon ${isExpanded ? 'expanded' : ''}`}>
          ▼
        </span>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="ai-plan__faction-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Primary Objective */}
            <div className="ai-plan__section">
              <h4 className="ai-plan__section-title">🎯 Primary Objective</h4>
              <ObjectiveDisplay objective={plan.primaryObjective} />
            </div>

            {/* Secondary Objectives */}
            {plan.secondaryObjectives.length > 0 && (
              <div className="ai-plan__section">
                <h4 className="ai-plan__section-title">📋 Secondary Objectives</h4>
                {plan.secondaryObjectives.map((obj) => (
                  <ObjectiveDisplay key={obj.id} objective={obj} />
                ))}
              </div>
            )}

            {/* Planned Actions by Turn */}
            <div className="ai-plan__section">
              <h4 className="ai-plan__section-title">📅 Planned Actions</h4>
              {plan.turnPlans.map((turnPlan) => (
                <div key={turnPlan.turn} className="ai-plan__turn">
                  <div className="ai-plan__turn-header">
                    <span className="ai-plan__turn-label">
                      {turnPlan.turn === 0
                        ? 'This Turn'
                        : turnPlan.turn === 1
                          ? 'Next Turn'
                          : `In ${turnPlan.turn} Turns`}
                    </span>
                    <span className="ai-plan__turn-budget">
                      💰 {turnPlan.expectedFacCreds} → {turnPlan.expectedFacCredsAfter}
                    </span>
                  </div>
                  {turnPlan.actions.length > 0 ? (
                    turnPlan.actions.map((action) => (
                      <PlannedActionItem
                        key={action.id}
                        action={action}
                        turnOffset={turnPlan.turn}
                      />
                    ))
                  ) : (
                    <div className="ai-plan__no-actions">
                      Conserving resources...
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Threats */}
            {plan.identifiedThreats.length > 0 && (
              <div className="ai-plan__section">
                <h4 className="ai-plan__section-title">⚠️ Identified Threats</h4>
                {plan.identifiedThreats.map((threat, i) => (
                  <ThreatItem key={i} threat={threat} />
                ))}
              </div>
            )}

            {/* Opportunities */}
            {plan.identifiedOpportunities.length > 0 && (
              <div className="ai-plan__section">
                <h4 className="ai-plan__section-title">💡 Opportunities</h4>
                {plan.identifiedOpportunities.slice(0, 3).map((opp, i) => (
                  <OpportunityItem key={i} opportunity={opp} />
                ))}
              </div>
            )}

            {/* Reasoning */}
            <div className="ai-plan__section ai-plan__section--reasoning">
              <h4 className="ai-plan__section-title">🧠 Reasoning</h4>
              <ul className="ai-plan__reasoning-list">
                {plan.detailedReasoning.map((reason, i) => (
                  <li key={i} className="ai-plan__reasoning-item">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface AIPlannedActionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIPlannedActionsPanel({
  isOpen,
  onClose,
}: AIPlannedActionsPanelProps) {
  const plans = useSelector(selectAllPlans);
  const upcomingActions = useSelector(selectAllUpcomingActions);
  const playerFactionId = useSelector(
    (state: RootState) => state.gameMode.playerFactionId
  );

  const [expandedFaction, setExpandedFaction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'timeline'>('timeline');

  // Filter to show only AI faction plans (not player)
  const aiFactionPlans = Object.values(plans).filter(
    (plan): plan is AIStrategicPlan =>
      plan !== undefined && plan.factionId !== playerFactionId
  );

  const toggleFaction = (factionId: string) => {
    setExpandedFaction((prev) => (prev === factionId ? null : factionId));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ai-plan-panel"
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="ai-plan-panel__header">
            <h2 className="ai-plan-panel__title">
              <span className="ai-plan-panel__title-icon">🔮</span>
              AI Intelligence
            </h2>
            <button
              className="ai-plan-panel__close"
              onClick={onClose}
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="ai-plan-panel__tabs">
            <button
              className={`ai-plan-panel__tab ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              📅 Timeline
            </button>
            <button
              className={`ai-plan-panel__tab ${activeTab === 'plans' ? 'active' : ''}`}
              onClick={() => setActiveTab('plans')}
            >
              📊 Full Plans
            </button>
          </div>

          {/* Content */}
          <div className="ai-plan-panel__content">
            {aiFactionPlans.length === 0 ? (
              <div className="ai-plan-panel__empty">
                <span className="ai-plan-panel__empty-icon">🔍</span>
                <p>No AI plans available yet.</p>
                <p className="ai-plan-panel__empty-hint">
                  AI factions will develop plans during their turns.
                </p>
              </div>
            ) : activeTab === 'timeline' ? (
              /* Timeline View - Grouped by turn */
              <div className="ai-plan-panel__timeline">
                {upcomingActions.length === 0 ? (
                  <div className="ai-plan-panel__empty">
                    <p>No planned actions visible.</p>
                  </div>
                ) : (
                  Object.entries(
                    upcomingActions.reduce(
                      (acc, item) => {
                        const turnKey =
                          item.turn === 0
                            ? 'This Turn'
                            : item.turn === 1
                              ? 'Next Turn'
                              : `In ${item.turn} Turns`;
                        if (!acc[turnKey]) acc[turnKey] = [];
                        acc[turnKey].push(item);
                        return acc;
                      },
                      {} as Record<
                        string,
                        typeof upcomingActions
                      >
                    )
                  ).map(([turnLabel, items]) => (
                    <div key={turnLabel} className="ai-plan-panel__timeline-turn">
                      <h3 className="ai-plan-panel__timeline-turn-label">
                        {turnLabel}
                      </h3>
                      {items.map((item, idx) => (
                        <div
                          key={`${item.factionId}-${idx}`}
                          className="ai-plan-panel__timeline-faction"
                        >
                          <div
                            className="ai-plan-panel__timeline-faction-header"
                            style={{
                              borderLeftColor: getFactionColor(item.factionId),
                            }}
                          >
                            <span
                              className="ai-plan-panel__timeline-faction-name"
                              style={{ color: getFactionColor(item.factionId) }}
                            >
                              {item.factionName}
                            </span>
                          </div>
                          {item.actions.map((action) => (
                            <PlannedActionItem
                              key={action.id}
                              action={action}
                              turnOffset={0}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Full Plans View */
              <div className="ai-plan-panel__plans">
                {aiFactionPlans.map((plan) => (
                  <FactionPlanCard
                    key={plan.factionId}
                    plan={plan}
                    isExpanded={expandedFaction === plan.factionId}
                    onToggle={() => toggleFaction(plan.factionId)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


