import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { defineHex, Grid, rectangle, Hex } from 'honeycomb-grid';
import * as d3 from 'd3';
import type { RootState } from '../../store/store';
import type { StarSystem, Route } from '../../types/sector';
import type { Faction, FactionAsset } from '../../types/faction';
import { selectSystem } from '../../store/slices/sectorSlice';
import { addAsset, moveAsset, updateFaction } from '../../store/slices/factionsSlice';
import { validateAssetPurchase } from '../../utils/assetValidation';
import { dispatchNarrativeEntry, createNarrativeContextFromFaction, createNarrativeContextFromSystem } from '../../utils/narrativeHelpers';
import { showNotification } from '../NotificationContainer';
import { getAssetById } from '../../data/assetLibrary';
import { stageActionWithPayload, cancelMovementMode, selectMovementMode, markActionUsed } from '../../store/slices/turnSlice';
import { getValidMovementDestinations } from '../../utils/movementUtils';
import { getFactionColor, getAssetsBySystem, getFactionsWithHomeworld } from '../../utils/factionColors';
import SystemTooltip from './SystemTooltip';
import WorldDetails from './WorldDetails';
import SystemDropZone from './SystemDropZone';
import { tutorialEventOccurred } from '../../store/slices/tutorialSlice';
import { getPlanetSprite } from '../../utils/planetSpriteMapping';
import { getSystemDisplayName } from '../../utils/systemDisplay';
import './SectorMap.css';

// Define hex shape for honeycomb-grid (pointy-top orientation)
const HexShape = defineHex({ dimensions: 30 });

// Grid dimensions
const GRID_WIDTH = 8;
const GRID_HEIGHT = 10;

const SPRITE_MIN_SIZE = 18;
const computeSpriteSize = (radius: number) =>
  Math.max(SPRITE_MIN_SIZE, radius * 1.68);

const UI_FONT_FAMILY = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';

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
  const previousSectorIdRef = useRef<string | null>(null);

  const factions = useSelector((state: RootState) => state.factions.factions);
  const movementMode = useSelector(selectMovementMode);
  const dispatch = useDispatch();

  const getSystemById = useCallback(
    (systemId: string) => sector?.systems.find((s: StarSystem) => s.id === systemId),
    [sector]
  );

  const getSystemNameById = useCallback(
    (systemId: string) => {
      const systemData = getSystemById(systemId);
      return systemData ? getSystemDisplayName(systemData.name) : 'Unknown System';
    },
    [getSystemById]
  );
  
  const handleAssetDrop = useCallback((assetDefinitionId: string, systemId: string) => {
    if (!selectedFactionId) {
      showNotification('No faction selected', 'error');
      return;
    }

    // Validate system exists
    if (!sector || !sector.systems.find((s: StarSystem) => s.id === systemId)) {
      showNotification('Invalid system location', 'error');
      return;
    }

    // Get faction
    const faction = factions.find((f: Faction) => f.id === selectedFactionId);
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
    const system = sector.systems.find((s: StarSystem) => s.id === systemId);
    const systemName = system ? getSystemDisplayName(system.name) : 'Unknown System';
    
    // Dispatch the purchase
    dispatch(
      addAsset({
        factionId: selectedFactionId,
        assetDefinitionId,
        location: systemId,
      })
    );

    // Generate narrative for the purchase
    const actorContext = createNarrativeContextFromFaction(faction, getSystemNameById, getSystemById);
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
  }, [dispatch, selectedFactionId, sector, factions, getSystemById, getSystemNameById]);

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

    // Add SVG defs for filters and gradients
    const defs = svg.append('defs');
    
    // Glow filter for valid destinations
    const glowFilter = defs.append('filter')
      .attr('id', 'valid-destination-glow')
      .attr('x', '-100%')
      .attr('y', '-100%')
      .attr('width', '300%')
      .attr('height', '300%');
    
    glowFilter.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');
    
    glowFilter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', d => d);

    // Star glow filter
    const starGlow = defs.append('filter')
      .attr('id', 'star-glow')
      .attr('x', '-100%')
      .attr('y', '-100%')
      .attr('width', '300%')
      .attr('height', '300%');
    starGlow.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', '2')
      .attr('result', 'blur');
    const starGlowMerge = starGlow.append('feMerge');
    starGlowMerge.append('feMergeNode').attr('in', 'blur');
    starGlowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Trade route glow filter for heavy traffic lanes
    const tradeRouteGlow = defs.append('filter')
      .attr('id', 'trade-route-glow')
      .attr('x', '-200%')
      .attr('y', '-200%')
      .attr('width', '500%')
      .attr('height', '500%');
    tradeRouteGlow.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', '6')
      .attr('result', 'glow');
    const tradeRouteGlowMerge = tradeRouteGlow.append('feMerge');
    tradeRouteGlowMerge.append('feMergeNode').attr('in', 'glow');
    tradeRouteGlowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Trade route gradient to give the convoy core a sunlit band
    const tradeRouteGradient = defs.append('linearGradient')
      .attr('id', 'trade-route-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');
    tradeRouteGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'rgba(255, 120, 40, 0.65)');
    tradeRouteGradient.append('stop')
      .attr('offset', '35%')
      .attr('stop-color', '#ffd8a0');
    tradeRouteGradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#fff6d8');
    tradeRouteGradient.append('stop')
      .attr('offset', '65%')
      .attr('stop-color', '#ffd8a0');
    tradeRouteGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'rgba(255, 120, 40, 0.65)');

    // Create grid using honeycomb-grid (needed for bounds calculation)
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

    // ============================================
    // PARALLAX STARFIELD BACKGROUND
    // ============================================
    
    // Seeded random for consistent star positions
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9999) * 10000;
      return x - Math.floor(x);
    };

    // Calculate expanded bounds for starfield (larger than visible area for parallax)
    const starfieldPadding = 800;
    const sfMinX = minX - starfieldPadding;
    const sfMaxX = maxX + starfieldPadding;
    const sfMinY = minY - starfieldPadding;
    const sfMaxY = maxY + starfieldPadding;
    const sfWidth = sfMaxX - sfMinX;
    const sfHeight = sfMaxY - sfMinY;

    // Create parallax layer groups (rendered before main container)
    const parallaxDeep = svg.append('g').attr('class', 'starfield-layer-deep');
    const parallaxMedium = svg.append('g').attr('class', 'starfield-layer-medium');
    const parallaxClose = svg.append('g').attr('class', 'starfield-layer-close');

    // Generate stars for each layer
    const generateStars = (
      layer: d3.Selection<SVGGElement, unknown, null, undefined>,
      count: number,
      sizeRange: [number, number],
      opacityRange: [number, number],
      seedOffset: number,
      twinkleClass?: string
    ) => {
      for (let i = 0; i < count; i++) {
        const seed = i + seedOffset;
        const x = sfMinX + seededRandom(seed * 1.1) * sfWidth;
        const y = sfMinY + seededRandom(seed * 2.3) * sfHeight;
        const size = sizeRange[0] + seededRandom(seed * 3.7) * (sizeRange[1] - sizeRange[0]);
        const opacity = opacityRange[0] + seededRandom(seed * 4.9) * (opacityRange[1] - opacityRange[0]);
        
        // Star color variation (mostly white/blue with occasional warm stars)
        const colorRand = seededRandom(seed * 5.1);
        let fill = '#ffffff';
        if (colorRand < 0.15) fill = '#ffeedd'; // warm white
        else if (colorRand < 0.25) fill = '#aaccff'; // blue-white
        else if (colorRand < 0.30) fill = '#ffddaa'; // yellow
        else if (colorRand < 0.32) fill = '#ffaa88'; // orange
        else if (colorRand < 0.33) fill = '#ff8888'; // red giant

        const star = layer.append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', size)
          .attr('fill', fill)
          .attr('opacity', opacity);

        // Removed per-star glow filter for performance optimization
        // if (size > 1.2) {
        //   star.attr('filter', 'url(#star-glow)');
        // }

        // Add twinkling animation to some stars
        if (twinkleClass && seededRandom(seed * 6.3) > 0.7) {
          const duration = 2 + seededRandom(seed * 7.1) * 4;
          const delay = seededRandom(seed * 8.2) * 5;
          star.style('animation', `${twinkleClass} ${duration}s ease-in-out infinite`)
            .style('animation-delay', `${delay}s`);
        }
      }
    };

    // Deep layer: many tiny dim stars
    generateStars(parallaxDeep, 400, [0.3, 0.8], [0.2, 0.5], 1000, 'starTwinkleSlow');
    
    // Medium layer: moderate stars
    generateStars(parallaxMedium, 200, [0.5, 1.2], [0.4, 0.8], 2000, 'starTwinkle');
    
    // Close layer: fewer bright stars
    generateStars(parallaxClose, 80, [0.8, 2.0], [0.6, 1.0], 3000, 'starTwinkleFast');

    // Create main container group for zoom/pan
    const container = svg.append('g').attr('class', 'map-container');

    // Create system map for quick lookup
    const systemMap = new Map<string, StarSystem>();
    sector.systems.forEach((system: StarSystem) => {
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

    sector.systems.forEach((system: StarSystem) => {
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
      const faction = factions.find((f: Faction) => f.id === movementMode.factionId);
      if (faction) {
        const asset = faction.assets.find((a: FactionAsset) => a.id === movementMode.assetId);
        if (asset) {
          validDestinations = getValidMovementDestinations(asset.location, sector.systems);
        }
      }
    }

    // Render regular routes first (subtle stellar trails)
    allRoutes
      .filter((r) => !r.isTradeRoute)
      .forEach((route) => {
        const routeLength = Math.hypot(
          route.toPoint.x - route.fromPoint.x,
          route.toPoint.y - route.fromPoint.y
        );
        const driftDuration = Math.max(6, Math.min(12, routeLength / 8));

        regularRoutesGroup
          .append('line')
          .attr('class', 'route-line route-line--regular')
          .attr('x1', route.fromPoint.x)
          .attr('y1', route.fromPoint.y)
          .attr('x2', route.toPoint.x)
          .attr('y2', route.toPoint.y)
          .style('--route-speed', `${driftDuration.toFixed(2)}s`)
          .style('animation-delay', `${(Math.random() * 4).toFixed(2)}s`)
          .on('mouseenter', () => {
            dispatch(tutorialEventOccurred({ eventId: 'mapNavigation.routeHovered' }));
          });
      });

    // Render trade routes on top (dense, animated shipping lanes)
    const tradeRoutes = allRoutes.filter((r) => r.isTradeRoute);
    
    tradeRoutes.forEach((route, index) => {
      const routeLength = Math.hypot(
        route.toPoint.x - route.fromPoint.x,
        route.toPoint.y - route.fromPoint.y
      );
      const convoyDuration = Math.max(2, Math.min(5.5, routeLength / 50 + 1.5));
      const tradeRouteGroup = tradeRoutesGroup
        .append('g')
        .attr('class', 'trade-route')
        .attr('data-route-index', index);

      const appendSegment = (className: string) =>
        tradeRouteGroup
          .append('line')
          .attr('class', className)
          .attr('x1', route.fromPoint.x)
          .attr('y1', route.fromPoint.y)
          .attr('x2', route.toPoint.x)
          .attr('y2', route.toPoint.y);

      appendSegment('route-line trade-route-glow')
        .attr('filter', 'url(#trade-route-glow)')
        .style('--route-speed', `${(convoyDuration * 1.5).toFixed(2)}s`)
        .style('animation-delay', `${(Math.random() * 1.5).toFixed(2)}s`)
        .style('pointer-events', 'none');

      const coreLine = appendSegment('route-line trade-route-core')
        .attr('stroke', 'url(#trade-route-gradient)')
        .style('--route-speed', `${convoyDuration.toFixed(2)}s`)
        .style('animation-delay', `${(Math.random() * 1.2).toFixed(2)}s`);

      appendSegment('route-line trade-route-convoy')
        .style('--route-speed', `${(convoyDuration * 0.85).toFixed(2)}s`)
        .style('animation-delay', `${(Math.random() * 1).toFixed(2)}s`)
        .style('pointer-events', 'none');

      appendSegment('route-line trade-route-sparks')
        .style('--route-speed', `${(convoyDuration * 0.55).toFixed(2)}s`)
        .style('animation-delay', `${(Math.random() * 0.8).toFixed(2)}s`)
        .style('pointer-events', 'none');

      coreLine.on('mouseenter', () => {
        dispatch(tutorialEventOccurred({ eventId: 'mapNavigation.routeHovered' }));
      });
    });

    // Get assets grouped by system for efficient lookup
    const assetsBySystem = getAssetsBySystem(factions);

    // Render system markers
    const systemsGroup = container.append('g').attr('class', 'systems');
    sector.systems.forEach((system: StarSystem) => {
      const coordKey = `${system.coordinates.x},${system.coordinates.y}`;
      const hex = coordToHex.get(coordKey);
      if (!hex) return;

      const point = getHexCenter(hex);

      const isValidDestination = validDestinations.includes(system.id);
      const isCurrentLocation = movementMode.active && movementMode.assetId && movementMode.factionId && 
        (() => {
          const faction = factions.find((f: Faction) => f.id === movementMode.factionId);
          if (faction) {
            const asset = faction.assets.find((a: FactionAsset) => a.id === movementMode.assetId);
            return asset?.location === system.id;
          }
          return false;
        })();

      // Get assets and homeworld info for this system
      const systemAssets = assetsBySystem.get(system.id) || [];
      const homeworldFactions = getFactionsWithHomeworld(system.id, factions);
      const hasAssets = systemAssets.length > 0;
      const isHomeworld = homeworldFactions.length > 0;

      const systemDisplayName = getSystemDisplayName(system.name);

      // Base radius - larger if it has assets or is a valid destination
      const baseRadius = isValidDestination ? 12 : hasAssets ? 10 : 8;
      const circleRadius = baseRadius * 2;
      const spriteResult = getPlanetSprite(
        system.primaryWorld.atmosphere,
        system.primaryWorld.temperature,
        system.primaryWorld.biosphere,
        system.primaryWorld.tags,
        { seed: system.id }
      );
      const spriteSize = computeSpriteSize(baseRadius);
      const markerGroup = systemsGroup.append('g')
        .attr('class', `system-marker-group ${isValidDestination ? 'valid-destination' : ''} ${isCurrentLocation ? 'current-location' : ''}`)
        .attr('data-system-id', system.id)
        .attr('transform', `translate(${point.x}, ${point.y})`);

      // Add fancy highlighting for valid movement destinations
      if (isValidDestination) {
        const glowRadius = circleRadius + 16;
        
        // Outer expanding ripple (animated via CSS)
        markerGroup
          .append('circle')
          .attr('r', glowRadius * 0.8)
          .attr('fill', 'none')
          .attr('stroke', '#4af7a1')
          .attr('stroke-width', 2)
          .attr('class', 'valid-destination-ripple')
          .attr('opacity', 0.6);

        // Main pulsing glow ring
        markerGroup
          .append('circle')
          .attr('r', glowRadius)
          .attr('fill', 'none')
          .attr('stroke', '#4af7a1')
          .attr('stroke-width', 3)
          .attr('class', 'valid-destination-glow')
          .attr('filter', 'url(#valid-destination-glow)');

        // Inner beacon ring (alternating opacity)
        markerGroup
          .append('circle')
          .attr('r', circleRadius + 6)
          .attr('fill', 'none')
          .attr('stroke', '#7cffbe')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '6,4')
          .attr('class', 'valid-destination-beacon');

        // Subtle inner fill glow
        markerGroup
          .append('circle')
          .attr('r', circleRadius + 4)
          .attr('fill', 'rgba(74, 247, 161, 0.08)')
          .attr('stroke', 'none')
          .attr('pointer-events', 'none');
      }

      const spriteImage = markerGroup
        .append('image')
        .attr('href', spriteResult.spritePath)
        .attr('x', -spriteSize / 2)
        .attr('y', -spriteSize / 2)
        .attr('width', spriteSize)
        .attr('height', spriteSize)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .attr('class', 'system-sprite-image')
        .attr('opacity', 0.95)
        .attr('pointer-events', 'none');

      const overlayImages = spriteResult.overlays.map((overlay) => {
        const multiplier = overlay.type === 'ring' ? 1.6 : 1.2;
        const size = spriteSize * multiplier;
        return {
          multiplier,
          node: markerGroup
            .append('image')
            .attr('href', overlay.spritePath)
            .attr('x', -size / 2)
            .attr('y', -size / 2)
            .attr('width', size)
            .attr('height', size)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .attr('opacity', overlay.type === 'blackhole' ? 0.85 : 1)
            .attr('pointer-events', 'none')
            .attr('class', `system-sprite-overlay system-sprite-overlay--${overlay.type}`),
        };
      });

      const updateSpriteSize = (radius: number) => {
        const size = computeSpriteSize(radius);
        spriteImage
          .attr('x', -size / 2)
          .attr('y', -size / 2)
          .attr('width', size)
          .attr('height', size);
        overlayImages.forEach(({ node, multiplier }) => {
          const overlaySize = size * multiplier;
          node
            .attr('x', -overlaySize / 2)
            .attr('y', -overlaySize / 2)
            .attr('width', overlaySize)
            .attr('height', overlaySize);
        });
      };

      // Draw faction ownership rings (outermost layer)
      // Each faction with assets gets a colored ring
      if (hasAssets) {
        systemAssets.forEach((factionAsset, index) => {
          const factionColor = getFactionColor(factionAsset.factionId);
          const ringRadius = circleRadius + 2 + index * 5; // Stack rings outward
          const ringWidth = 4;
          
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
        .attr('r', circleRadius)
        .attr('fill', 'transparent')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 0)
        .attr('class', 'system-marker-base')
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', `Select system ${systemDisplayName}`)
        .style('cursor', isValidDestination ? 'pointer' : 'default')
        .style('opacity', isValidDestination ? 1 : isCurrentLocation ? 0.7 : 1);

      // Draw homeworld badge if this is a homeworld
      if (isHomeworld) {
        markerGroup
          .append('circle')
          .attr('r', circleRadius * 0.9)
          .attr('fill', 'none')
          .attr('stroke', '#f5d547')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', 0.95)
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
            .attr('font-family', UI_FONT_FAMILY)
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
          const newRadius = (currentIsValid ? 14 : 10) * 2;
          markerGroup.select('.system-marker-base')
            .attr('r', newRadius)
            .attr('stroke-width', currentIsValid ? 4 : 3);
          updateSpriteSize(newRadius);
        })
        .on('mouseleave', function (this: SVGCircleElement) {
          setTooltipState({ system: null, position: null });
          markerGroup.select('.system-marker-base')
            .attr('r', circleRadius)
            .attr('stroke-width', isValidDestination ? 3 : 2);
          updateSpriteSize(baseRadius);
        })
        .on('click', function (event: MouseEvent) {
          event.stopPropagation();
          
          // Handle movement mode
          if (movementMode.active && movementMode.assetId && movementMode.factionId) {
            const faction = factions.find((f: Faction) => f.id === movementMode.factionId);
            if (!faction) {
              showNotification('Faction not found', 'error');
              dispatch(cancelMovementMode());
              return;
            }

            const asset = faction.assets.find((a: FactionAsset) => a.id === movementMode.assetId);
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

            // Ensure faction still has resources for movement
            if (faction.facCreds < 1) {
              showNotification('Insufficient FacCreds: Movement costs 1 FacCred', 'error');
              dispatch(cancelMovementMode());
              return;
            }

            const movementPayload = {
              assetId: movementMode.assetId,
              destination: system.id,
              factionId: movementMode.factionId,
            };

            dispatch(stageActionWithPayload({
              type: 'MOVE_ASSET',
              payload: movementPayload,
            }));

            // Deduct FacCreds and move the asset immediately
            dispatch(updateFaction({
              ...faction,
              facCreds: faction.facCreds - 1,
            }));
            dispatch(moveAsset({
              factionId: movementMode.factionId,
              assetId: movementMode.assetId,
              newLocation: system.id,
            }));

            const assetDef = getAssetById(asset.definitionId);
            const actorContext = createNarrativeContextFromFaction(
              faction,
              getSystemNameById,
              getSystemById
            );
            const systemContext = createNarrativeContextFromSystem(system);

            dispatchNarrativeEntry(dispatch, 'Move', {
              ...actorContext,
              ...systemContext,
              assetName: assetDef?.name,
              result: 'Success',
              relatedEntityIds: [movementMode.factionId, movementMode.assetId, system.id].filter(
                (id): id is string => Boolean(id)
              ),
            });

            dispatch(cancelMovementMode());
            // Mark that a Move action was used (allows more moves of same type)
            dispatch(markActionUsed('MOVE_ASSET'));
            dispatch(tutorialEventOccurred({ eventId: 'assetTutorial.assetMoveCompleted' }));
            showNotification(`${assetDef?.name || 'Asset'} moved to ${systemDisplayName}`, 'success');
            return;
          }

          // Normal system selection
          dispatch(selectSystem(system.id));
          dispatch(tutorialEventOccurred({ eventId: 'mapNavigation.systemSelected' }));
          dispatch(tutorialEventOccurred({ eventId: 'assetTutorial.assetSystemSelected' }));
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
      const nameLabel = systemsGroup
        .append('text')
        .attr('x', point.x)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', '10px')
        .attr('font-family', UI_FONT_FAMILY)
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .attr('stroke', '#000')
        .attr('stroke-width', '3px')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('paint-order', 'stroke fill')
        .attr('transform', `rotate(-15 ${point.x} ${labelY})`)
        .text(systemDisplayName);
      nameLabel.raise();
    });

    // Center the grid in the viewport
    const initialScale = Math.min(
      (dimensions.width * 0.9) / gridWidth,
      (dimensions.height * 0.9) / gridHeight
    );

    const initialX = dimensions.width / 2 - gridCenterX * initialScale;
    const initialY = dimensions.height / 2 - gridCenterY * initialScale;

    // Parallax factors for each layer (lower = slower movement = appears further away)
    const PARALLAX_DEEP = 0.3;
    const PARALLAX_MEDIUM = 0.6;
    const PARALLAX_CLOSE = 0.8;

    // Helper to create parallax transform
    const createParallaxTransform = (transform: d3.ZoomTransform, factor: number) => {
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      // Calculate offset from center and apply parallax factor
      const offsetX = (transform.x - centerX) * factor + centerX;
      const offsetY = (transform.y - centerY) * factor + centerY;
      // Scale factor is also reduced for distant layers
      const parallaxScale = 1 + (transform.k - 1) * factor;
      return `translate(${offsetX}, ${offsetY}) scale(${parallaxScale})`;
    };

    // Set up zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        // Apply main transform to content
        // Use transform string directly for performance optimization
        const transformStr = event.transform.toString();
        container.attr('transform', transformStr);
        
        // Apply parallax transforms to background layers
        requestAnimationFrame(() => {
          parallaxDeep.attr('transform', createParallaxTransform(event.transform, PARALLAX_DEEP));
          parallaxMedium.attr('transform', createParallaxTransform(event.transform, PARALLAX_MEDIUM));
          parallaxClose.attr('transform', createParallaxTransform(event.transform, PARALLAX_CLOSE));

          // Update system positions in screen space
          updateSystemPositions(event.transform);
        });
      });

    svg.call(zoom);

    // Set initial transform or restore previous transform if sector hasn't changed
    const initialTransform = d3.zoomIdentity
      .translate(initialX, initialY)
      .scale(initialScale);

    const sectorChanged = previousSectorIdRef.current !== sector.id;
    previousSectorIdRef.current = sector.id;

    const currentTransform = d3.zoomTransform(svgRef.current);
    const hasTransform = currentTransform.k !== 1 || currentTransform.x !== 0 || currentTransform.y !== 0;

    if (!sectorChanged && hasTransform) {
       // Restore existing view
       svg.call(zoom.transform, currentTransform);
    } else {
       // Reset view for new sector or first load
       svg.call(zoom.transform, initialTransform);
    }
    
    // Apply initial parallax transforms (using whatever transform we just set)
    // We need to get the effective transform after the .call() above
    const effectiveTransform = !sectorChanged && hasTransform ? currentTransform : initialTransform;
    
    parallaxDeep.attr('transform', createParallaxTransform(effectiveTransform, PARALLAX_DEEP));
    parallaxMedium.attr('transform', createParallaxTransform(effectiveTransform, PARALLAX_MEDIUM));
    parallaxClose.attr('transform', createParallaxTransform(effectiveTransform, PARALLAX_CLOSE));
    
    // Initial position update
    updateSystemPositions(effectiveTransform);
    
    function updateSystemPositions(transform: d3.ZoomTransform) {
      if (!svgRef.current || !containerRef.current || !sector) return;
      
      // Optimization: Only calculate positions if we have a selected faction (needed for DropZones)
      if (!selectedFactionId) {
        // Clear positions if they exist to free memory/state
        if (systemPositions.size > 0) {
           setSystemPositions(new Map());
        }
        return;
      }
      
      const positions = new Map<string, { x: number; y: number }>();
      
      sector.systems.forEach((system: StarSystem) => {
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
  }, [sector, dimensions, movementMode, factions, getSystemById, getSystemNameById, selectedFactionId]);

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
      className={`sector-map-container ${movementMode.active ? 'movement-mode-active' : ''}`}
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
      {selectedFactionId && sector.systems.map((system: StarSystem) => {
        const position = systemPositions.get(system.id);
        if (!position) return null;
        const systemDisplayName = getSystemDisplayName(system.name);
        
        return (
          <SystemDropZone
            key={system.id}
            systemId={system.id}
            systemName={systemDisplayName}
            x={position.x}
            y={position.y}
            onDrop={handleAssetDrop}
          />
        );
      })}
    </div>
  );
}
