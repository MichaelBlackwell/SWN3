import { useEffect, useRef } from 'react';
import type { StarSystem } from '../../types/sector';
import type { Faction } from '../../types/faction';
import { getAssetsBySystem, getFactionsWithHomeworld, getFactionColor } from '../../utils/factionColors';

interface SystemTooltipProps {
  system: StarSystem | null;
  position: { x: number; y: number } | null;
  factions?: Faction[];
}

export default function SystemTooltip({ system, position, factions = [] }: SystemTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tooltipRef.current || !position) return;

    // Position tooltip relative to viewport, avoiding edges
    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = position.x + 15; // Offset from cursor
    let top = position.y - 10;

    // Adjust if tooltip would go off right edge
    if (left + rect.width > viewportWidth) {
      left = position.x - rect.width - 15; // Show on left side instead
    }

    // Adjust if tooltip would go off bottom edge
    if (top + rect.height > viewportHeight) {
      top = position.y - rect.height - 10; // Show above cursor
    }

    // Adjust if tooltip would go off top edge
    if (top < 0) {
      top = 10;
    }

    // Adjust if tooltip would go off left edge
    if (left < 0) {
      left = 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }, [position]);

  if (!system || !position) return null;

  // Get assets and homeworld info for this system
  const assetsBySystem = getAssetsBySystem(factions);
  const systemAssets = assetsBySystem.get(system.id) || [];
  const homeworldFactions = getFactionsWithHomeworld(system.id, factions);
  const hasAssets = systemAssets.length > 0;
  const isHomeworld = homeworldFactions.length > 0;

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'sans-serif',
        zIndex: 1000,
        border: '1px solid #555',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
        maxWidth: '250px',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {system.name}
        {isHomeworld && (
          <span style={{ fontSize: '14px' }} title="Homeworld">⭐</span>
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#ccc', marginBottom: hasAssets || isHomeworld ? '6px' : '0' }}>
        {system.primaryWorld.atmosphere} • TL{system.primaryWorld.techLevel}
      </div>
      
      {isHomeworld && (
        <div style={{ fontSize: '11px', color: '#FFD700', marginTop: '4px', marginBottom: hasAssets ? '4px' : '0' }}>
          Homeworld: {homeworldFactions.map(f => f.name).join(', ')}
        </div>
      )}
      
      {hasAssets && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #555' }}>
          <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Assets:</div>
          {systemAssets.map((factionAsset) => {
            const factionColor = getFactionColor(factionAsset.factionId);
            return (
              <div
                key={factionAsset.factionId}
                style={{
                  fontSize: '11px',
                  marginBottom: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: factionColor,
                    border: '1px solid #fff',
                  }}
                />
                <span>{factionAsset.factionName}: {factionAsset.assetCount} asset{factionAsset.assetCount !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



