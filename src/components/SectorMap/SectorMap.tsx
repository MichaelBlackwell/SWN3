import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { defineHex, Grid, rectangle, Hex } from 'honeycomb-grid';
import * as d3 from 'd3';
import type { RootState } from '../../store/store';
import type { StarSystem, Route } from '../../types/sector';
import { selectSystem } from '../../store/slices/sectorSlice';
import { addAsset } from '../../store/slices/factionsSlice';
import { validateAssetPurchase } from '../../utils/assetValidation';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import { showNotification } from '../NotificationContainer';
import { getAssetById } from '../../data/assetLibrary';
import { stageActionWithPayload, cancelMovementMode, selectMovementMode } from '../../store/slices/turnSlice';
import { getValidMovementDestinations } from '../../utils/movementUtils';
import { getFactionColor, getAssetsBySystem, getFactionsWithHomeworld } from '../../utils/factionColors';
import SystemTooltip from './SystemTooltip';
import WorldDetails from './WorldDetails';
import SystemDropZone from './SystemDropZone';
import './SectorMap.css';

// Define hex shape for honeycomb-grid (pointy-top orientation)
const HexShape = defineHex({ dimensions: 30 });

// Grid dimensions
const GRID_WIDTH = 8;
const GRID_HEIGHT = 10;

// Helper function to get the center point of a hex from its corners
function getHexCenter(hex: Hex): { x: number; y: number } {
  const corners = hex.corners; // corners is a property, not a method
  const sumX = corners.reduce((sum, corner) => sum + corner.x, 0);
  const sumY = corners.reduce((sum, corner) => sum + corner.y, 0);
  return {
    x: sumX / corners.length,
    y: sumY / corners.length,
  };
}

interface SectorMapProps {
  width?: number;
  height?: number;
}

export default function SectorMap({ width = 800, height = 600 }: SectorMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [tooltipState, setTooltipState] = useState<{
    system: StarSystem | null;
    position: { x: number; y: number } | null;
  }>({ system: null, position: null });
  const [systemPositions, setSystemPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const sector = useSelector((state: RootState) => state.sector.currentSector);
  const selectedFactionId = useSelector((state: RootState) => state.factions.selectedFactionId);
  const factions = useSelector((state: RootState) => state.factions.factions);
  const movementMode = useSelector(selectMovementMode);
  const dispatch = useDispatch();
  
  const handleAssetDrop = useCallback((assetDefinitionId: string, systemId: string) => {
    if (!selectedFactionId) {
      showNotification('No faction selected', 'error');
      return;
    }

    // Validate system exists
    if (!sector || !sector.systems.find((s) => s.id === systemId)) {
      showNotification('Invalid system location', 'error');
      return;
    }

    // Get faction
    const faction = factions.find((f) => f.id === selectedFactionId);
    if (!faction) {
      showNotification('Faction not found', 'error');
      return;
    }

    // Validate purchase
    const validation = validateAssetPurchase(faction, assetDefinitionId);
    if (!validation.valid) {
      showNotification(validation.reason || 'Cannot purchase asset', 'error');
      return;
    }

    // Get asset definition for success message
    const assetDef = getAssetById(assetDefinitionId);
    const system = sector.systems.find((s) => s.id === systemId);
    const systemName = system?.name || 'Unknown System';
    
    // Dispatch the purchase
    dispatch(
      addAsset({
        factionId: selectedFactionId,
        assetDefinitionId,
        location: systemId,
      })
    );

    // Generate narrative for the purchase
    const getSystemName = (id: string) => sector.systems.find((s) => s.id === id)?.name || 'Unknown System';
    const getSystem = (id: string) => sector.systems.find((s) => s.id === id);

    const actorContext = createNarrativeContextFromFaction(faction, getSystemName, getSystem);
    const systemContext = createNarrativeContextFromSystem(system);

    dispatchNarrativeEntry(dispatch, 'Buy', {
      ...actorContext,
      ...systemContext,
      assetName: assetDef?.name,
      credits: assetDef?.cost,
      result: 'Success',
      relatedEntityIds: [selectedFactionId, systemId].filter(Boolean),
    });

    // Show success notification
    showNotification(
      `Purchased ${assetDef?.name || 'asset'} and placed at ${systemName}`,
      'success'
    );
  }, [dispatch, selectedFactionId, sector, factions]);

  // Update dimensions when container resizes
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height });
        }
      }
    };

    // Initial size - use a small delay to ensure container is rendered
    const timeoutId = setTimeout(() => {
      updateDimensions();
    }, 0);

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(containerRef.current);

    // Also listen to window resize as a fallback
    window.addEventListener('resize', updateDimensions);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Render the map
  useEffect(() => {
    if (!svgRef.current || !sector) return;
    
    // Wait for dimensions to be set
    if (dimensions.width === 0 || dimensions.height === 0) {
      // Try to get dimensions from container if not set yet
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height });
          return; // Will re-run when dimensions update
        }
      }
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render
    
    // Set SVG dimensions explicitly for D3 calculations
    svg.attr('width', dimensions.width).attr('height', dimensions.height);

    // Create main container group for zoom/pan
    const container = svg.append('g').attr('class', 'map-container');

    // Create grid using honeycomb-grid
    const grid = new Grid(HexShape, rectangle({ width: GRID_WIDTH, height: GRID_HEIGHT }));
    const allHexes = Array.from(grid);

    // Create coordinate to hex map for quick lookup
    const coordToHex = new Map<string, Hex>();
    allHexes.forEach((hex) => {
      const key = `${hex.col},${hex.row}`;
      coordToHex.set(key, hex);
    });

    // Calculate grid bounds for centering
    const hexPoints = allHexes.map((hex) => getHexCenter(hex));

    const minX = Math.min(...hexPoints.map((p) => p.x));
    const maxX = Math.max(...hexPoints.map((p) => p.x));
    const minY = Math.min(...hexPoints.map((p) => p.y));
    const maxY = Math.max(...hexPoints.map((p) => p.y));

    const gridWidth = maxX - minX;
    const gridHeight = maxY - minY;
    const gridCenterX = (minX + maxX) / 2;
    const gridCenterY = (minY + maxY) / 2;

    // Create system map for quick lookup
    const systemMap = new Map<string, StarSystem>();
    sector.systems.forEach((system) => {
      systemMap.set(system.id, system);
    });

    // Render base hex grid
    const hexGroup = container.append('g').attr('class', 'hex-grid');
    hexGroup
      .selectAll('path')
      .data(allHexes)
      .enter()
      .append('path')
      .attr('d', (hex: Hex) => {
        const corners = hex.corners; // corners is a property, not a method
        const path = corners
          .map((corner: { x: number; y: number }, i: number) => {
            const cmd = i === 0 ? 'M' : 'L';
            return `${cmd} ${corner.x} ${corner.y}`;
          })
          .join(' ');
        return `${path} Z`;
      })
      .attr('fill', 'none')
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
      .attr('opacity', 0.3);

    // Render routes (below systems)
    // First collect all routes to separate regular and trade routes
    const routesGroup = container.append('g').attr('class', 'routes');
    const regularRoutesGroup = routesGroup.append('g').attr('class', 'regular-routes');
    const tradeRoutesGroup = routesGroup.append('g').attr('class', 'trade-routes');
    const routePairs = new Set<string>();

    // Collect all routes with their properties
    const allRoutes: Array<{
      fromPoint: { x: number; y: number };
      toPoint: { x: number; y: number };
      isTradeRoute: boolean;
    }> = [];

    sector.systems.forEach((system) => {
      system.routes.forEach((route: Route) => {
        const pair = [system.id, route.systemId].sort().join('-');
        if (!routePairs.has(pair)) {
          routePairs.add(pair);

          const targetSystem = systemMap.get(route.systemId);
          if (!targetSystem) return;

          // Get hex positions for both systems using coordinate map
          const fromKey = `${system.coordinates.x},${system.coordinates.y}`;
          const toKey = `${targetSystem.coordinates.x},${targetSystem.coordinates.y}`;
          const fromHex = coordToHex.get(fromKey);
          const toHex = coordToHex.get(toKey);

          if (!fromHex || !toHex) return;

          const fromPoint = getHexCenter(fromHex);
          const toPoint = getHexCenter(toHex);

          // Store route info for later rendering
          allRoutes.push({
            fromPoint,
            toPoint,
            isTradeRoute: Boolean(route.isTradeRoute),
          });
        }
      });
    });

    // Calculate valid movement destinations if in movement mode
    let validDestinations: string[] = [];
    if (movementMode.active && movementMode.assetId && movementMode.factionId) {
      const faction = factions.find((f) => f.id === movementMode.factionId);
      if (faction) {
        const asset = faction.assets.find((a) => a.id === movementMode.assetId);
        if (asset) {
          validDestinations = getValidMovementDestinations(asset.location, sector.systems);
        }
      }
    }

    // Render regular routes first (thin blue lines)
    allRoutes
      .filter((r) => !r.isTradeRoute)
      .forEach((route) => {
        regularRoutesGroup
          .append('line')
          .attr('x1', route.fromPoint.x)
          .attr('y1', route.fromPoint.y)
          .attr('x2', route.toPoint.x)
          .attr('y2', route.toPoint.y)
          .attr('stroke', '#4a9eff') // Blue for regular
          .attr('stroke-width', 1.5) // Thin
          .attr('opacity', 0.7)
          .attr('stroke-linecap', 'round');
      });

    // Render trade routes on top (thick orange lines)
    const tradeRoutes = allRoutes.filter((r) => r.isTradeRoute);
    console.log(`Total routes: ${allRoutes.length}, Trade routes: ${tradeRoutes.length}`);
    
    tradeRoutes.forEach((route) => {
      tradeRoutesGroup
        .append('line')
        .attr('x1', route.fromPoint.x)
        .attr('y1', route.fromPoint.y)
        .attr('x2', route.toPoint.x)
        .attr('y2', route.toPoint.y)
        .attr('stroke', '#ff8c00') // Orange for trade
        .attr('stroke-width', 5) // Thick - increased for visibility
        .attr('opacity', 1) // Fully opaque for visibility
        .attr('stroke-linecap', 'round');
    });

    // Get assets grouped by system for efficient lookup
    const assetsBySystem = getAssetsBySystem(factions);

    // Render system markers
    const systemsGroup = container.append('g').attr('class', 'systems');
    sector.systems.forEach((system) => {
      const coordKey = `${system.coordinates.x},${system.coordinates.y}`;
      const hex = coordToHex.get(coordKey);
      if (!hex) return;

      const point = getHexCenter(hex);

      // Determine color based on atmosphere
      const atmosphereColors: Record<string, string> = {
        Corrosive: '#8b4513',
        Inert: '#696969',
        Airless: '#2f4f4f',
        Breathable: '#228b22',
        Thick: '#4169e1',
        Thin: '#87ceeb',
        Exotic: '#9370db',
      };

      const atmosphereColor = atmosphereColors[system.primaryWorld.atmosphere] || '#ffffff';
      const isValidDestination = validDestinations.includes(system.id);
      const isCurrentLocation = movementMode.active && movementMode.assetId && movementMode.factionId && 
        (() => {
          const faction = factions.find((f) => f.id === movementMode.factionId);
          if (faction) {
            const asset = faction.assets.find((a) => a.id === movementMode.assetId);
            return asset?.location === system.id;
          }
          return false;
        })();

      // Get assets and homeworld info for this system
      const systemAssets = assetsBySystem.get(system.id) || [];
      const homeworldFactions = getFactionsWithHomeworld(system.id, factions);
      const hasAssets = systemAssets.length > 0;
      const isHomeworld = homeworldFactions.length > 0;

      // Base radius - larger if it has assets or is a valid destination
      const baseRadius = isValidDestination ? 12 : hasAssets ? 10 : 8;
      const markerGroup = systemsGroup.append('g')
        .attr('class', `system-marker-group ${isValidDestination ? 'valid-destination' : ''} ${isCurrentLocation ? 'current-location' : ''}`)
        .attr('data-system-id', system.id)
        .attr('transform', `translate(${point.x}, ${point.y})`);

      // Draw faction ownership rings (outermost layer)
      // Each faction with assets gets a colored ring
      if (hasAssets) {
        systemAssets.forEach((factionAsset, index) => {
          const factionColor = getFactionColor(factionAsset.factionId);
          const ringRadius = baseRadius + 2 + (index * 2.5); // Stack rings outward
          const ringWidth = 2;
          
          markerGroup
            .append('circle')
            .attr('r', ringRadius)
            .attr('fill', 'none')
            .attr('stroke', factionColor)
            .attr('stroke-width', ringWidth)
            .attr('opacity', 0.8)
            .attr('pointer-events', 'none');
        });
      }

      // Draw base system circle with atmosphere color
      const baseCircle = markerGroup
        .append('circle')
        .attr('r', baseRadius)
        .attr('fill', atmosphereColor)
        .attr('stroke', isValidDestination ? '#4ecdc4' : isCurrentLocation ? '#ff6b6b' : '#fff')
        .attr('stroke-width', isValidDestination ? 3 : 2)
        .attr('class', 'system-marker-base')
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', `Select system ${system.name}`)
        .style('cursor', isValidDestination ? 'pointer' : 'default')
        .style('opacity', isValidDestination ? 1 : isCurrentLocation ? 0.7 : 1);

      // Draw homeworld star symbol if this is a homeworld
      if (isHomeworld) {
        const starPoints = 5;
        const outerRadius = baseRadius * 0.7;
        const innerRadius = outerRadius * 0.4;
        const angleStep = (Math.PI * 2) / starPoints;
        
        let starPath = '';
        for (let i = 0; i < starPoints * 2; i++) {
          const angle = (i * angleStep) / 2 - Math.PI / 2; // Start at top
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          starPath += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
        }
        starPath += ' Z';

        markerGroup
          .append('path')
          .attr('d', starPath)
          .attr('fill', '#FFD700') // Gold color for homeworld
          .attr('stroke', '#FFA500')
          .attr('stroke-width', 0.5)
          .attr('opacity', 0.9)
          .attr('pointer-events', 'none');
      }

      // Draw asset count indicators (small dots or numbers)
      if (hasAssets) {
        const totalAssets = systemAssets.reduce((sum, sa) => sum + sa.assetCount, 0);
        
        // If only one faction, show number; if multiple, show dots
        if (systemAssets.length === 1) {
          // Single faction: show asset count as number
          markerGroup
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', baseRadius >= 10 ? '8px' : '6px')
            .attr('font-weight', 'bold')
            .attr('font-family', 'sans-serif')
            .attr('pointer-events', 'none')
            .attr('stroke', '#000')
            .attr('stroke-width', '0.5px')
            .attr('paint-order', 'stroke')
            .text(totalAssets.toString());
        } else {
          // Multiple factions: show small dots around the edge
          const dotRadius = 1.5;
          const dotOffset = baseRadius * 0.6;
          systemAssets.forEach((factionAsset, index) => {
            const angle = (index / systemAssets.length) * Math.PI * 2 - Math.PI / 2;
            const dotX = Math.cos(angle) * dotOffset;
            const dotY = Math.sin(angle) * dotOffset;
            const factionColor = getFactionColor(factionAsset.factionId);
            
            markerGroup
              .append('circle')
              .attr('cx', dotX)
              .attr('cy', dotY)
              .attr('r', dotRadius)
              .attr('fill', factionColor)
              .attr('stroke', '#fff')
              .attr('stroke-width', 0.5)
              .attr('pointer-events', 'none');
          });
        }
      }

      // Add interactivity to the base circle
      baseCircle
        .on('mouseenter', function (this: SVGCircleElement, event: MouseEvent) {
          // Get mouse position relative to viewport
          const [mouseX, mouseY] = d3.pointer(event, svgRef.current);
          
          // Convert to viewport coordinates for tooltip
          const rect = svgRef.current!.getBoundingClientRect();
          setTooltipState({
            system,
            position: {
              x: rect.left + mouseX,
              y: rect.top + mouseY,
            },
          });
          
          // Highlight marker (preserve valid destination highlighting)
          const currentIsValid = validDestinations.includes(system.id);
          const newRadius = currentIsValid ? 14 : 10;
          markerGroup.select('.system-marker-base')
            .attr('r', newRadius)
            .attr('stroke-width', currentIsValid ? 4 : 3);
        })
        .on('mouseleave', function (this: SVGCircleElement) {
          setTooltipState({ system: null, position: null });
          const currentIsValid = validDestinations.includes(system.id);
          markerGroup.select('.system-marker-base')
            .attr('r', baseRadius)
            .attr('stroke-width', isValidDestination ? 3 : 2);
        })
        .on('click', function (event: MouseEvent) {
          event.stopPropagation();
          
          // Handle movement mode
          if (movementMode.active && movementMode.assetId && movementMode.factionId) {
            const faction = factions.find((f) => f.id === movementMode.factionId);
            if (!faction) {
              showNotification('Faction not found', 'error');
              dispatch(cancelMovementMode());
              return;
            }

            const asset = faction.assets.find((a) => a.id === movementMode.assetId);
            if (!asset) {
              showNotification('Asset not found', 'error');
              dispatch(cancelMovementMode());
              return;
            }

            // Check if this system is a valid destination
            const validDestinations = getValidMovementDestinations(asset.location, sector.systems);
            if (!validDestinations.includes(system.id)) {
              showNotification('Invalid destination: Must be adjacent hex or route-connected system', 'error');
              return;
            }

            // Check if trying to move to the same location
            if (asset.location === system.id) {
              showNotification('Asset is already at this location', 'error');
              return;
            }

            // Stage the movement action with payload
            dispatch(stageActionWithPayload({
              type: 'MOVE_ASSET',
              payload: {
                assetId: movementMode.assetId,
                destination: system.id,
                factionId: movementMode.factionId,
              },
            }));

            showNotification(`Movement staged: Asset will move to ${system.name}`, 'success');
            dispatch(cancelMovementMode());
            return;
          }

          // Normal system selection
          dispatch(selectSystem(system.id));
        })
        .on('keydown', function (event: KeyboardEvent) {
          // Handle keyboard navigation
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            dispatch(selectSystem(system.id));
          }
        });

      // Draw system name label with rotation and outline
      const labelY = point.y + 20;
      systemsGroup
        .append('text')
        .attr('x', point.x)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', '10px')
        .attr('font-family', 'sans-serif')
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .attr('stroke', '#000')
        .attr('stroke-width', '3px')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('paint-order', 'stroke fill')
        .attr('transform', `rotate(-15 ${point.x} ${labelY})`)
        .text(system.name);
    });

    // Center the grid in the viewport
    const initialScale = Math.min(
      (dimensions.width * 0.9) / gridWidth,
      (dimensions.height * 0.9) / gridHeight
    );

    const initialX = dimensions.width / 2 - gridCenterX * initialScale;
    const initialY = dimensions.height / 2 - gridCenterY * initialScale;

    // Set up zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        container.attr('transform', event.transform.toString());
        
        // Update system positions in screen space
        updateSystemPositions(event.transform);
      });

    svg.call(zoom);

    // Set initial transform
    const initialTransform = d3.zoomIdentity
      .translate(initialX, initialY)
      .scale(initialScale);
    svg.call(zoom.transform, initialTransform);
    
    // Initial position update
    updateSystemPositions(initialTransform);
    
    function updateSystemPositions(transform: d3.ZoomTransform) {
      if (!svgRef.current || !containerRef.current || !sector) return;
      
      const positions = new Map<string, { x: number; y: number }>();
      
      sector.systems.forEach((system) => {
        const coordKey = `${system.coordinates.x},${system.coordinates.y}`;
        const hex = coordToHex.get(coordKey);
        if (!hex) return;
        
        const point = getHexCenter(hex);
        // Transform from SVG space to container-relative coordinates
        const transformed = transform.apply([point.x, point.y]);
        
        positions.set(system.id, {
          x: transformed[0],
          y: transformed[1],
        });
      });
      
      setSystemPositions(positions);
    }
  }, [sector, dimensions, movementMode, factions]);

  if (!sector) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        <p>No sector loaded. Generate a sector to view the map.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="sector-map-container"
      tabIndex={0}
      role="application"
      aria-label="Sector map"
      onClick={(e) => {
        // Deselect if clicking directly on the SVG background (not on system markers or other elements)
        if (e.target === svgRef.current) {
          dispatch(selectSystem(null));
        }
      }}
    >
      <svg ref={svgRef}>
        {/* SVG content is rendered via D3 - dimensions set by D3 based on container */}
      </svg>
      <SystemTooltip system={tooltipState.system} position={tooltipState.position} factions={factions} />
      <WorldDetails />
      {/* Render drop zones for each system */}
      {selectedFactionId && sector.systems.map((system) => {
        const position = systemPositions.get(system.id);
        if (!position) return null;
        
        return (
          <SystemDropZone
            key={system.id}
            systemId={system.id}
            systemName={system.name}
            x={position.x}
            y={position.y}
            onDrop={handleAssetDrop}
          />
        );
      })}
    </div>
  );
}
