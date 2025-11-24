import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CombatResult } from '../../utils/combatResolver';
import type { AttackType } from '../../types/asset';
import './CombatAnimation.css';

interface CombatAnimationProps {
  combatResult: CombatResult;
  attackerName: string;
  defenderName: string;
  attackerAttribute: AttackType;
  attackerAttributeValue: number;
  defenderAttribute: AttackType;
  defenderAttributeValue: number;
  attackerHpBefore: number;
  attackerHpAfter: number;
  attackerMaxHp: number;
  defenderHpBefore: number;
  defenderHpAfter: number;
  defenderMaxHp: number;
  onComplete: () => void;
}

type AnimationPhase =
  | 'rolling'
  | 'showing-rolls'
  | 'showing-result'
  | 'showing-damage'
  | 'complete';

export default function CombatAnimation({
  combatResult,
  attackerName,
  defenderName,
  attackerAttribute,
  attackerAttributeValue,
  defenderAttribute,
  defenderAttributeValue,
  attackerHpBefore,
  attackerHpAfter,
  attackerMaxHp,
  defenderHpBefore,
  defenderHpAfter,
  defenderMaxHp,
  onComplete,
}: CombatAnimationProps) {
  const [phase, setPhase] = useState<AnimationPhase>('rolling');
  const [diceValues, setDiceValues] = useState<{ attacker: number; defender: number }>({
    attacker: 0,
    defender: 0,
  });

  // Animate dice rolling
  useEffect(() => {
    if (phase === 'rolling') {
      // Simulate dice rolling with random values
      const interval = setInterval(() => {
        setDiceValues({
          attacker: Math.floor(Math.random() * 10) + 1,
          defender: Math.floor(Math.random() * 10) + 1,
        });
      }, 100);

      // Stop rolling after 1.5 seconds and show actual results
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setDiceValues({
          attacker: combatResult.rollResult.attackerRoll,
          defender: combatResult.rollResult.defenderRoll,
        });
        setPhase('showing-rolls');
      }, 1500);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [phase, combatResult.rollResult]);

  // Progress through animation phases
  useEffect(() => {
    if (phase === 'showing-rolls') {
      const timer = setTimeout(() => setPhase('showing-result'), 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'showing-result') {
      const timer = setTimeout(() => setPhase('showing-damage'), 1500);
      return () => clearTimeout(timer);
    } else if (phase === 'showing-damage') {
      const timer = setTimeout(() => {
        setPhase('complete');
        onComplete();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  const { rollResult, attackDamage, counterattackDamage, attackerWins, bothSucceed } =
    combatResult;

  const attackerTotal = rollResult.attackerTotal;
  const defenderTotal = rollResult.defenderTotal;

  return (
    <div className="combat-animation-overlay">
      <motion.div
        className="combat-animation-container"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3 }}
      >
        {/* Dice Roll Phase */}
        <AnimatePresence mode="wait">
          {phase === 'rolling' && (
            <motion.div
              key="rolling"
              className="animation-phase rolling-phase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2>Rolling Dice...</h2>
              <div className="dice-container">
                <motion.div
                  className="dice attacker-dice"
                  animate={{
                    rotate: [0, 360, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 0.3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <div className="dice-value">{diceValues.attacker}</div>
                  <div className="dice-label">Attacker</div>
                </motion.div>
                <div className="vs-divider">VS</div>
                <motion.div
                  className="dice defender-dice"
                  animate={{
                    rotate: [0, -360, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 0.3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <div className="dice-value">{diceValues.defender}</div>
                  <div className="dice-label">Defender</div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Show Rolls Phase */}
          {phase === 'showing-rolls' && (
            <motion.div
              key="showing-rolls"
              className="animation-phase rolls-phase"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2>Combat Roll</h2>
              <div className="rolls-display">
                <div className="roll-card attacker-roll">
                  <div className="roll-faction-name">{attackerName}</div>
                  <div className="roll-breakdown">
                    <div className="roll-dice">
                      <span className="roll-label">Roll:</span>
                      <span className="roll-number">{rollResult.attackerRoll}</span>
                    </div>
                    <div className="roll-modifier">
                      <span className="roll-label">+ {attackerAttribute}:</span>
                      <span className="roll-number">{attackerAttributeValue}</span>
                    </div>
                    <div className="roll-total">
                      <span className="roll-label">Total:</span>
                      <span className="roll-number large">{attackerTotal}</span>
                    </div>
                  </div>
                </div>

                <div className="vs-divider-large">VS</div>

                <div className="roll-card defender-roll">
                  <div className="roll-faction-name">{defenderName}</div>
                  <div className="roll-breakdown">
                    <div className="roll-dice">
                      <span className="roll-label">Roll:</span>
                      <span className="roll-number">{rollResult.defenderRoll}</span>
                    </div>
                    <div className="roll-modifier">
                      <span className="roll-label">+ {defenderAttribute}:</span>
                      <span className="roll-number">{defenderAttributeValue}</span>
                    </div>
                    <div className="roll-total">
                      <span className="roll-label">Total:</span>
                      <span className="roll-number large">{defenderTotal}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Show Result Phase */}
          {phase === 'showing-result' && (
            <motion.div
              key="showing-result"
              className="animation-phase result-phase"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <motion.div
                className={`result-badge ${attackerWins ? 'hit' : bothSucceed ? 'tie' : 'miss'}`}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                {bothSucceed ? (
                  <>
                    <div className="result-text">TIE!</div>
                    <div className="result-subtext">Both attacks succeed</div>
                  </>
                ) : attackerWins ? (
                  <>
                    <div className="result-text">HIT!</div>
                    <div className="result-subtext">Attack succeeds</div>
                  </>
                ) : (
                  <>
                    <div className="result-text">MISS!</div>
                    <div className="result-subtext">Counterattack triggers</div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Show Damage Phase */}
          {phase === 'showing-damage' && (
            <motion.div
              key="showing-damage"
              className="animation-phase damage-phase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2>Damage Results</h2>
              <div className="damage-display">
                {attackDamage > 0 && (
                  <motion.div
                    className="damage-card"
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                  >
                    <div className="damage-label">Attack Damage</div>
                    <div className="damage-value">{attackDamage}</div>
                    <div className="damage-target">{defenderName}</div>
                    <div className="health-bar-container">
                      <div className="health-bar-label">HP: {defenderHpBefore} → {defenderHpAfter}</div>
                      <div className="health-bar">
                        <motion.div
                          className="health-bar-fill"
                          initial={{ width: `${(defenderHpBefore / defenderMaxHp) * 100}%` }}
                          animate={{ width: `${(defenderHpAfter / defenderMaxHp) * 100}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {counterattackDamage > 0 && (
                  <motion.div
                    className="damage-card"
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: attackDamage > 0 ? 0.5 : 0 }}
                  >
                    <div className="damage-label">Counterattack Damage</div>
                    <div className="damage-value">{counterattackDamage}</div>
                    <div className="damage-target">{attackerName}</div>
                    <div className="health-bar-container">
                      <div className="health-bar-label">HP: {attackerHpBefore} → {attackerHpAfter}</div>
                      <div className="health-bar">
                        <motion.div
                          className="health-bar-fill"
                          initial={{ width: `${(attackerHpBefore / attackerMaxHp) * 100}%` }}
                          animate={{ width: `${(attackerHpAfter / attackerMaxHp) * 100}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: attackDamage > 0 ? 0.5 : 0 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {attackDamage === 0 && counterattackDamage === 0 && (
                  <div className="no-damage">No damage dealt</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}













