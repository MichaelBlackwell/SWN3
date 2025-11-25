/**
 * Faction Goals and Advancement UI Component
 * 
 * Displays:
 * - Active goal with progress bar
 * - Current XP
 * - Attribute advancement section with upgrade buttons
 */

import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import { upgradeAttribute } from '../../store/slices/factionsSlice';
import { calculateUpgradeCost } from '../../utils/factionCalculations';
import { showNotification } from '../NotificationContainer';
import KeywordTooltipText from '../Tutorial/KeywordTooltipText';
import { getGoalMetadata } from '../../data/goalMetadata';
import './FactionGoalsTab.css';
import type { Faction } from '../../types/faction';

interface FactionGoalsTabProps {
  factionId: string;
}

export default function FactionGoalsTab({ factionId }: FactionGoalsTabProps) {
  const dispatch = useDispatch();
  const faction = useSelector((state: RootState) =>
    state.factions.factions.find((faction: Faction) => faction.id === factionId)
  );

  if (!faction) {
    return (
      <div className="goals-tab-empty">
        <p>Faction not found</p>
      </div>
    );
  }

  const handleUpgrade = (attributeName: 'force' | 'cunning' | 'wealth') => {
    const currentRating = faction.attributes[attributeName];
    const cost = calculateUpgradeCost(currentRating);

    if (currentRating >= 8) {
      showNotification('Attribute is already at maximum rating (8)', 'error');
      return;
    }

    if (faction.xp < cost) {
      showNotification(`Insufficient XP: Need ${cost}, have ${faction.xp}`, 'error');
      return;
    }

    dispatch(upgradeAttribute({ factionId, attributeName }));
    showNotification(
      `Upgraded ${attributeName} from ${currentRating} to ${currentRating + 1} (-${cost} XP)`,
      'success'
    );
  };

  // Calculate upgrade costs and affordability
  const forceUpgradeCost = calculateUpgradeCost(faction.attributes.force);
  const cunningUpgradeCost = calculateUpgradeCost(faction.attributes.cunning);
  const wealthUpgradeCost = calculateUpgradeCost(faction.attributes.wealth);

  const canAffordForce = faction.xp >= forceUpgradeCost && forceUpgradeCost > 0;
  const canAffordCunning = faction.xp >= cunningUpgradeCost && cunningUpgradeCost > 0;
  const canAffordWealth = faction.xp >= wealthUpgradeCost && wealthUpgradeCost > 0;

  // Calculate progress percentage for goal
  const goalProgress = faction.goal
    ? Math.min(100, (faction.goal.progress.current / faction.goal.progress.target) * 100)
    : 0;
  const goalUnit =
    faction.goal && typeof faction.goal.progress.metadata?.unit === 'string'
      ? faction.goal.progress.metadata.unit
      : null;

  return (
    <div className="faction-goals-tab">
      {/* XP Display */}
      <div className="goals-section xp-display">
        <div className="xp-container">
          <div className="xp-label">Experience Points</div>
          <div className="xp-value">{faction.xp} XP</div>
          <div className="xp-hint">Earn XP by completing goals to upgrade attributes</div>
        </div>
      </div>

      {/* Active Goal */}
      <div className="goals-section active-goal">
        <h3>Active Goal</h3>
        {faction.goal ? (
          <div className="goal-card">
            <div className="goal-header">
              <div className="goal-type-container">
                {getGoalMetadata(faction.goal.type) && (
                  <span 
                    className="goal-icon"
                    style={{ color: getGoalMetadata(faction.goal.type)?.color }}
                    title={getGoalMetadata(faction.goal.type)?.tooltip}
                    aria-label={getGoalMetadata(faction.goal.type)?.tooltip}
                  >
                    {getGoalMetadata(faction.goal.type)?.icon}
                  </span>
                )}
                <div className="goal-type">{faction.goal.type}</div>
              </div>
              <div className="goal-reward">{faction.goal.difficulty} XP</div>
            </div>
            <div className="goal-description" title={getGoalMetadata(faction.goal.type)?.tooltip}>
              {faction.goal.description}
            </div>
            <div className="goal-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${goalProgress}%` }}
                  aria-valuenow={faction.goal.progress.current}
                  aria-valuemin={0}
                  aria-valuemax={faction.goal.progress.target}
                  role="progressbar"
                />
              </div>
              <div className="progress-text">
                {faction.goal.progress.current} / {faction.goal.progress.target}
                {goalUnit ? ` ${goalUnit}` : ''}
              </div>
            </div>
            {faction.goal.isCompleted && (
              <div className="goal-completed-badge">✓ Completed</div>
            )}
          </div>
        ) : (
          <div className="no-goal">
            <p>No active goal</p>
            <p className="no-goal-hint">Goals will be assigned during the turn cycle</p>
          </div>
        )}
      </div>

      {/* Attribute Advancement */}
      <div className="goals-section advancement">
        <h3>Attribute Advancement</h3>
        <p className="advancement-hint">
          Spend XP to increase your faction's core attributes. Higher ratings unlock better
          assets and increase max HP.
        </p>
        
        <div className="advancement-grid">
          {/* Force */}
          <div className="advancement-card">
            <div className="advancement-header">
              <div className="advancement-icon force-icon">⚔️</div>
              <div className="advancement-info">
                <div className="advancement-label">
                  <KeywordTooltipText as="span" text="Force" />
                </div>
                <div className="advancement-current">
                  Rating: <strong>{faction.attributes.force}</strong>
                  {faction.attributes.force >= 8 && <span className="max-badge">MAX</span>}
                </div>
              </div>
            </div>
            <button
              className="upgrade-btn"
              onClick={() => handleUpgrade('force')}
              disabled={!canAffordForce || faction.attributes.force >= 8}
              title={
                faction.attributes.force >= 8
                  ? 'Already at maximum rating'
                  : !canAffordForce
                    ? `Need ${forceUpgradeCost} XP (have ${faction.xp})`
                    : `Upgrade to ${faction.attributes.force + 1} for ${forceUpgradeCost} XP`
              }
            >
              {faction.attributes.force >= 8 ? (
                'Max Rating'
              ) : (
                <>
                  Upgrade to {faction.attributes.force + 1}
                  <span className="upgrade-cost">
                    {canAffordForce ? '✓' : '✗'} {forceUpgradeCost} XP
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Cunning */}
          <div className="advancement-card">
            <div className="advancement-header">
              <div className="advancement-icon cunning-icon">🎭</div>
              <div className="advancement-info">
                <div className="advancement-label">
                  <KeywordTooltipText as="span" text="Cunning" />
                </div>
                <div className="advancement-current">
                  Rating: <strong>{faction.attributes.cunning}</strong>
                  {faction.attributes.cunning >= 8 && <span className="max-badge">MAX</span>}
                </div>
              </div>
            </div>
            <button
              className="upgrade-btn"
              onClick={() => handleUpgrade('cunning')}
              disabled={!canAffordCunning || faction.attributes.cunning >= 8}
              title={
                faction.attributes.cunning >= 8
                  ? 'Already at maximum rating'
                  : !canAffordCunning
                    ? `Need ${cunningUpgradeCost} XP (have ${faction.xp})`
                    : `Upgrade to ${faction.attributes.cunning + 1} for ${cunningUpgradeCost} XP`
              }
            >
              {faction.attributes.cunning >= 8 ? (
                'Max Rating'
              ) : (
                <>
                  Upgrade to {faction.attributes.cunning + 1}
                  <span className="upgrade-cost">
                    {canAffordCunning ? '✓' : '✗'} {cunningUpgradeCost} XP
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Wealth */}
          <div className="advancement-card">
            <div className="advancement-header">
              <div className="advancement-icon wealth-icon">💰</div>
              <div className="advancement-info">
                <div className="advancement-label">
                  <KeywordTooltipText as="span" text="Wealth" />
                </div>
                <div className="advancement-current">
                  Rating: <strong>{faction.attributes.wealth}</strong>
                  {faction.attributes.wealth >= 8 && <span className="max-badge">MAX</span>}
                </div>
              </div>
            </div>
            <button
              className="upgrade-btn"
              onClick={() => handleUpgrade('wealth')}
              disabled={!canAffordWealth || faction.attributes.wealth >= 8}
              title={
                faction.attributes.wealth >= 8
                  ? 'Already at maximum rating'
                  : !canAffordWealth
                    ? `Need ${wealthUpgradeCost} XP (have ${faction.xp})`
                    : `Upgrade to ${faction.attributes.wealth + 1} for ${wealthUpgradeCost} XP`
              }
            >
              {faction.attributes.wealth >= 8 ? (
                'Max Rating'
              ) : (
                <>
                  Upgrade to {faction.attributes.wealth + 1}
                  <span className="upgrade-cost">
                    {canAffordWealth ? '✓' : '✗'} {wealthUpgradeCost} XP
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* XP Cost Table Reference */}
        <details className="xp-cost-table">
          <summary>View XP Cost Table</summary>
          <table>
            <thead>
              <tr>
                <th>Current Rating</th>
                <th>Upgrade Cost</th>
                <th>New Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>2 XP</td><td>2</td></tr>
              <tr><td>2</td><td>4 XP</td><td>3</td></tr>
              <tr><td>3</td><td>6 XP</td><td>4</td></tr>
              <tr><td>4</td><td>9 XP</td><td>5</td></tr>
              <tr><td>5</td><td>12 XP</td><td>6</td></tr>
              <tr><td>6</td><td>16 XP</td><td>7</td></tr>
              <tr><td>7</td><td>20 XP</td><td>8</td></tr>
              <tr><td>8</td><td>—</td><td>Maximum</td></tr>
            </tbody>
          </table>
        </details>
      </div>
    </div>
  );
}

