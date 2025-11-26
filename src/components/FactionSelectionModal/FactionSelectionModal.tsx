import { createPortal } from 'react-dom';
import type { Faction } from '../../types/faction';
import type { Sector } from '../../types/sector';
import { getFactionColor } from '../../utils/factionColors';
import { useSoundEffect } from '../../hooks/useAudio';
import TagBadge from '../common/TagBadge';
import { FACTION_TAG_METADATA } from '../../data/factionTagMetadata';
import './FactionSelectionModal.css';

interface FactionSelectionModalProps {
  factions: Faction[];
  sector: Sector | null;
  onSelectFaction: (factionId: string) => void;
}

export default function FactionSelectionModal({
  factions,
  sector,
  onSelectFaction,
}: FactionSelectionModalProps) {
  const playSound = useSoundEffect();

  const handleFactionClick = (factionId: string) => {
    playSound('ui_click');
    onSelectFaction(factionId);
  };

  const getHomeworldName = (faction: Faction): string => {
    if (!sector || !faction.homeworld) return 'Unknown';
    const system = sector.systems.find((s) => s.id === faction.homeworld);
    return system?.name || 'Unknown';
  };

  const content = (
    <div className="faction-selection-overlay">
      <div className="faction-selection-modal">
        <div className="faction-selection-header">
          <h2 className="faction-selection-title">Choose Your Faction</h2>
          <p className="faction-selection-subtitle">
            Select a faction to lead through the coming turns
          </p>
        </div>

        <div className="faction-selection-content">
          <div className="faction-selection-grid">
            {factions.map((faction) => {
              const factionColor = getFactionColor(faction.id);
              return (
                <button
                  key={faction.id}
                  className="faction-selection-card"
                  onClick={() => handleFactionClick(faction.id)}
                  style={{
                    '--faction-color': factionColor,
                    '--faction-color-dim': `${factionColor}33`,
                  } as React.CSSProperties}
                >
                  <div className="faction-selection-card__accent" />
                  
                  <div className="faction-selection-card__header">
                    <h3 className="faction-selection-card__name">{faction.name}</h3>
                    <span className="faction-selection-card__type">{faction.type}</span>
                  </div>

                  <div className="faction-selection-card__homeworld">
                    <span className="faction-selection-card__homeworld-icon">🏠</span>
                    <span className="faction-selection-card__homeworld-name">
                      {getHomeworldName(faction)}
                    </span>
                  </div>

                  {faction.tags.length > 0 && (
                    <div className="faction-selection-card__tags">
                      {faction.tags.map((tag) => {
                        const metadata = FACTION_TAG_METADATA[tag];
                        return (
                          <TagBadge
                            key={`${faction.id}-${tag}`}
                            label={tag}
                            description={metadata?.description}
                            effects={metadata?.effects}
                            tone="faction"
                          />
                        );
                      })}
                    </div>
                  )}

                  <div className="faction-selection-card__stats">
                    <div className="faction-selection-card__stat">
                      <span className="faction-selection-card__stat-label">Force</span>
                      <span className="faction-selection-card__stat-value">
                        {faction.attributes.force}
                      </span>
                    </div>
                    <div className="faction-selection-card__stat">
                      <span className="faction-selection-card__stat-label">Cunning</span>
                      <span className="faction-selection-card__stat-value">
                        {faction.attributes.cunning}
                      </span>
                    </div>
                    <div className="faction-selection-card__stat">
                      <span className="faction-selection-card__stat-label">Wealth</span>
                      <span className="faction-selection-card__stat-value">
                        {faction.attributes.wealth}
                      </span>
                    </div>
                    <div className="faction-selection-card__stat faction-selection-card__stat--highlight">
                      <span className="faction-selection-card__stat-label">FacCreds</span>
                      <span className="faction-selection-card__stat-value">
                        {faction.facCreds}
                      </span>
                    </div>
                  </div>

                  <div className="faction-selection-card__hp">
                    <span className="faction-selection-card__hp-label">HP</span>
                    <div className="faction-selection-card__hp-bar">
                      <div
                        className="faction-selection-card__hp-fill"
                        style={{
                          width: `${(faction.attributes.hp / faction.attributes.maxHp) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="faction-selection-card__hp-text">
                      {faction.attributes.hp}/{faction.attributes.maxHp}
                    </span>
                  </div>

                  <div className="faction-selection-card__assets">
                    <span className="faction-selection-card__assets-count">
                      {faction.assets.length}
                    </span>
                    <span className="faction-selection-card__assets-label">
                      {faction.assets.length === 1 ? 'Asset' : 'Assets'}
                    </span>
                  </div>

                  <div className="faction-selection-card__select">
                    Select This Faction
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

