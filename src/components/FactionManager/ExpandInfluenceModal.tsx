import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import {
  getValidExpandTargets,
  hasBaseOfInfluence,
  hasAssetsOnWorld,
  calculateBaseOfInfluenceCost,
  resolveExpandInfluenceRoll,
  BASE_OF_INFLUENCE_ID,
} from '../../utils/expandInfluence';
import './ExpandInfluenceModal.css';

interface ExpandInfluenceModalProps {
  factionId: string;
  currentSystemId: string | null; // The system where the button was clicked (optional)
  onClose: () => void;
  onConfirm: (expansion: {
    targetSystemId: string;
    hp: number;
    cost: number;
    rollResult: ReturnType<typeof resolveExpandInfluenceRoll>;
  }) => void;
}

export default function ExpandInfluenceModal({
  factionId,
  currentSystemId,
  onClose,
  onConfirm,
}: ExpandInfluenceModalProps) {
  const faction = useSelector((state: RootState) =>
    state.factions.factions.find((f) => f.id === factionId)
  );
  const systems = useSelector(
    (state: RootState) => state.sector.currentSector?.systems || []
  );
  const state = useSelector((state: RootState) => state);

  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(
    currentSystemId || null
  );
  const [desiredHp, setDesiredHp] = useState<number>(1);

  if (!faction) {
    return null;
  }

  // Get valid target worlds
  const validTargets = getValidExpandTargets(faction, systems);

  // If current system is selected, check if it's valid
  const currentSystemValid =
    currentSystemId &&
    hasAssetsOnWorld(faction, currentSystemId) &&
    !hasBaseOfInfluence(faction, currentSystemId);

  // Calculate cost for selected system
  const costInfo =
    selectedSystemId && desiredHp > 0
      ? calculateBaseOfInfluenceCost(faction, desiredHp)
      : { cost: 0, actualHp: 0 };

  const canAfford = faction.facCreds >= costInfo.cost;
  const canExpand = selectedSystemId && canAfford && costInfo.actualHp > 0;

  const handleConfirm = () => {
    if (!canExpand || !selectedSystemId) return;

    // Perform the roll resolution
    const rollResult = resolveExpandInfluenceRoll(faction, selectedSystemId, state);

    onConfirm({
      targetSystemId: selectedSystemId,
      hp: costInfo.actualHp,
      cost: costInfo.cost,
      rollResult,
    });
  };

  const selectedSystem = selectedSystemId
    ? systems.find((s) => s.id === selectedSystemId)
    : null;

  return (
    <div className="expand-influence-modal-overlay" onClick={onClose}>
      <div className="expand-influence-modal" onClick={(e) => e.stopPropagation()}>
        <div className="expand-influence-modal-header">
          <h2>Expand Influence</h2>
          <button className="expand-influence-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="expand-influence-modal-content">
          <div className="expand-influence-resources">
            <div className="expand-influence-resource-item">
              <span>Available FacCreds:</span>
              <span className={canAfford ? '' : 'insufficient'}>{faction.facCreds}</span>
            </div>
            <div className="expand-influence-resource-item">
              <span>Faction Max HP:</span>
              <span>{faction.attributes.maxHp}</span>
            </div>
            <div className="expand-influence-resource-item">
              <span>Base HP Cost:</span>
              <span className={canAfford ? '' : 'insufficient'}>{costInfo.cost} FacCred</span>
            </div>
            {!canAfford && costInfo.cost > 0 && (
              <div className="expand-influence-error">
                Insufficient FacCreds. Need {costInfo.cost}, have {faction.facCreds}
              </div>
            )}
          </div>

          <div className="expand-influence-section">
            <h3>Select Target World</h3>
            {validTargets.length === 0 ? (
              <div className="expand-influence-empty">
                <p>No valid targets available.</p>
                <p className="hint">
                  You need at least one asset on a world (other than a Base of Influence) to
                  expand influence there.
                </p>
              </div>
            ) : (
              <div className="expand-influence-targets">
                {validTargets.map((system) => {
                  const isSelected = selectedSystemId === system.id;
                  const assetsOnWorld = faction.assets.filter(
                    (asset) =>
                      asset.location === system.id &&
                      asset.definitionId !== BASE_OF_INFLUENCE_ID
                  );

                  return (
                    <div
                      key={system.id}
                      className={`expand-influence-target ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedSystemId(system.id)}
                    >
                      <div className="target-header">
                        <input
                          type="radio"
                          checked={isSelected}
                          onChange={() => setSelectedSystemId(system.id)}
                        />
                        <span className="target-name">{system.name}</span>
                      </div>
                      <div className="target-details">
                        <span className="target-assets">
                          {assetsOnWorld.length} asset{assetsOnWorld.length !== 1 ? 's' : ''} on
                          this world
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedSystemId && (
            <div className="expand-influence-section">
              <h3>Base of Influence Size</h3>
              <div className="expand-influence-hp-selector">
                <label>
                  <span>Hit Points:</span>
                  <input
                    type="number"
                    min="1"
                    max={faction.attributes.maxHp}
                    value={desiredHp}
                    onChange={(e) => setDesiredHp(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <span className="hp-hint">
                    (Max: {faction.attributes.maxHp}, Cost: {costInfo.cost} FacCred)
                  </span>
                </label>
                <div className="hp-explanation">
                  <p>
                    Larger bases are more expensive but harder to destroy. Damage to a Base of
                    Influence also damages your faction HP.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedSystemId && (
            <div className="expand-influence-section">
              <h3>Expansion Rules</h3>
              <div className="expand-influence-rules">
                <p>
                  • You will roll 1d10 + your Cunning ({faction.attributes.cunning}) against
                  similar rolls by other factions on this world.
                </p>
                <p>
                  • If any opposing faction equals or beats your roll, they may make a free
                  immediate Attack action against the new Base of Influence.
                </p>
                <p>
                  • Your assets on the world may defend against such attacks as normal.
                </p>
                <p>• The Base of Influence cannot be used until your next turn.</p>
              </div>
            </div>
          )}
        </div>

        <div className="expand-influence-modal-footer">
          <button className="expand-influence-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="expand-influence-confirm-btn"
            onClick={handleConfirm}
            disabled={!canExpand}
          >
            Expand Influence ({costInfo.cost} FacCred)
          </button>
        </div>
      </div>
    </div>
  );
}

