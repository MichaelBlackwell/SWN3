import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import type { StarSystem } from '../../types/sector';
import { getPlanetSprite } from '../../utils/planetSpriteMapping';
import { getLandscapeSprite } from '../../utils/landscapeMapping';
import { getSystemDisplayName } from '../../utils/systemDisplay';
import { getTechLevelColor } from '../../utils/techLevelColors';
import { withAlpha } from '../../utils/colorUtils';
import TagBadge from '../common/TagBadge';
import ExpandInfluenceButton from '../FactionManager/ExpandInfluenceButton';
import './WorldDetailsFloatingCard.css';

const POPULATION_LABELS = [
  'Failed Colony',
  'Outpost',
  'Fewer than a million',
  'Several million',
  'Hundreds of millions',
  'Billions',
  'Alien inhabitants',
];

export default function WorldDetailsFloatingCard() {
  const sector = useSelector((state: RootState) => state.sector.currentSector);
  const selectedSystemId = useSelector((state: RootState) => state.sector.selectedSystemId);
  const selectedFactionId = useSelector((state: RootState) => state.factions.selectedFactionId);

  if (!sector || !selectedSystemId) return null;

  const system = sector.systems.find((s: StarSystem) => s.id === selectedSystemId);
  if (!system) return null;

  const systemDisplayName = getSystemDisplayName(system.name);
  const populationLabel = POPULATION_LABELS[system.primaryWorld.population] || 'Unknown';
  const planetSprite = getPlanetSprite(
    system.primaryWorld.atmosphere,
    system.primaryWorld.temperature,
    system.primaryWorld.biosphere,
    system.primaryWorld.tags,
    { seed: system.id }
  );
  const landscapeSprite = getLandscapeSprite(planetSprite.category, { seed: system.id });
  const techLevelColor = getTechLevelColor(system.primaryWorld.techLevel);

  const content = (
    <div className="world-details-floating-card" aria-label={`Quick view for ${systemDisplayName}`}>
      {/* Header with planet image and landscape background */}
      <div 
        className="world-details-floating-card__header"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10, 10, 15, 0.75) 0%, rgba(10, 10, 15, 0.55) 50%, rgba(10, 10, 15, 0.35) 100%), url(${landscapeSprite.imagePath})`,
        }}
      >
        <div className="world-details-floating-card__planet-wrapper">
          <div className="world-details-floating-card__planet-glow" />
          {planetSprite.overlays.map((overlay, index) => (
            <img
              key={`${overlay.type}-${index}`}
              src={overlay.spritePath}
              alt=""
              aria-hidden="true"
              className={`world-details-floating-card__overlay world-details-floating-card__overlay--${overlay.type}`}
              draggable={false}
            />
          ))}
          <img
            src={planetSprite.spritePath}
            alt={`Planet sprite for ${system.primaryWorld.name}`}
            className="world-details-floating-card__planet-image"
            draggable={false}
          />
        </div>
        <div className="world-details-floating-card__titles">
          <h4 className="world-details-floating-card__system-name">{systemDisplayName}</h4>
          <p className="world-details-floating-card__world-name">
            Primary World: {system.primaryWorld.name}
          </p>
        </div>
      </div>

      {/* Attributes Grid */}
      <div className="world-details-floating-card__attributes">
        <div className="world-details-floating-card__attr">
          <span className="world-details-floating-card__attr-label">Atmosphere</span>
          <span className="world-details-floating-card__attr-value">{system.primaryWorld.atmosphere}</span>
        </div>
        <div className="world-details-floating-card__attr">
          <span className="world-details-floating-card__attr-label">Temperature</span>
          <span className="world-details-floating-card__attr-value">{system.primaryWorld.temperature}</span>
        </div>
        <div className="world-details-floating-card__attr">
          <span className="world-details-floating-card__attr-label">Biosphere</span>
          <span className="world-details-floating-card__attr-value">{system.primaryWorld.biosphere}</span>
        </div>
        <div className="world-details-floating-card__attr">
          <span className="world-details-floating-card__attr-label">Population</span>
          <span className="world-details-floating-card__attr-value">{populationLabel}</span>
        </div>
        <div className="world-details-floating-card__attr">
          <span className="world-details-floating-card__attr-label">Tech Level</span>
          <span 
            className="world-details-floating-card__attr-value world-details-floating-card__attr-value--tech"
            style={{ 
              color: techLevelColor,
              textShadow: `0 0 6px ${withAlpha(techLevelColor, 0.5)}`
            }}
          >
            TL{system.primaryWorld.techLevel}
          </span>
        </div>
        <div className="world-details-floating-card__attr">
          <span className="world-details-floating-card__attr-label">Government</span>
          <span className="world-details-floating-card__attr-value">{system.primaryWorld.government}</span>
        </div>
      </div>

      {/* World Tags */}
      {system.primaryWorld.tags && system.primaryWorld.tags.length > 0 && (
        <div className="world-details-floating-card__tags">
          <span className="world-details-floating-card__tags-label">World Tags</span>
          <div className="world-details-floating-card__tags-list">
            {system.primaryWorld.tags.map((tag: string, index: number) => (
              <TagBadge
                key={`${tag}-${index}`}
                label={tag}
                tone="world"
                description={`World tag: ${tag}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expand Influence Button */}
      {selectedFactionId && (
        <div className="world-details-floating-card__actions">
          <ExpandInfluenceButton
            factionId={selectedFactionId}
            currentSystemId={selectedSystemId}
          />
        </div>
      )}
    </div>
  );

  // Use portal to render outside the overflow:hidden container
  return createPortal(content, document.body);
}

