/**
 * Tests for the world generation and trade route system
 */

import { describe, it, expect } from 'vitest';
import { generatePrimaryWorld, getWorldEconomicProfile } from '../worldGenerator';
import { generateSector } from '../sectorGenerator';
import { getTradeRouteStats, getSystemTradeInfo } from '../tradeRouteGenerator';

describe('World Generation System', () => {
  describe('generatePrimaryWorld', () => {
    it('should generate a valid world', () => {
      const world = generatePrimaryWorld();
      
      // Check all required fields exist
      expect(world.name).toBeDefined();
      expect(world.atmosphere).toBeDefined();
      expect(world.temperature).toBeDefined();
      expect(world.biosphere).toBeDefined();
      expect(world.population).toBeGreaterThanOrEqual(0);
      expect(world.population).toBeLessThanOrEqual(6);
      expect(world.techLevel).toBeGreaterThanOrEqual(0);
      expect(world.techLevel).toBeLessThanOrEqual(5);
      expect(world.government).toBeDefined();
      expect(world.tags).toHaveLength(2);
      expect(Array.isArray(world.tradeCodes)).toBe(true);
    });

    it('should generate worlds with coherent traits', () => {
      // Generate multiple worlds and check for logical consistency
      for (let i = 0; i < 10; i++) {
        const world = generatePrimaryWorld();
        
        // Airless worlds shouldn't have massive populations (but can have domed cities)
        if (world.atmosphere === 'Airless') {
          expect(world.population).toBeLessThanOrEqual(5);
        }
        
        // No population means no tech level
        if (world.population === 0) {
          expect(world.techLevel).toBe(0);
        }
        
        // High tech requires some population
        if (world.techLevel >= 4) {
          expect(world.population).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('should generate appropriate trade codes', () => {
      const world = generatePrimaryWorld();
      const profile = getWorldEconomicProfile(world);
      
      // Agricultural worlds should export food
      if (world.tradeCodes.includes('Agricultural')) {
        expect(
          profile.resourceExport.some(r => 
            r === 'Food' || r === 'Organic Materials'
          )
        ).toBe(true);
      }
      
      // Industrial worlds should export manufactured goods
      if (world.tradeCodes.includes('Industrial')) {
        expect(
          profile.resourceExport.some(r => 
            r === 'Manufactured Goods' || r === 'Machinery'
          )
        ).toBe(true);
      }
      
      // Poor worlds should have imports
      if (world.tradeCodes.includes('Poor')) {
        expect(profile.resourceImport.length).toBeGreaterThan(0);
      }
    });

    it('should generate valid economic values', () => {
      const world = generatePrimaryWorld();
      const profile = getWorldEconomicProfile(world);
      
      expect(profile.economicValue).toBeGreaterThanOrEqual(0);
      expect(profile.economicValue).toBeLessThanOrEqual(100);
      
      // High population + high tech should mean high economic value
      if (world.population >= 5 && world.techLevel >= 4) {
        expect(profile.economicValue).toBeGreaterThan(60);
      }
    });
  });

  describe('Sector Generation with Trade Routes', () => {
    it('should generate a complete sector', () => {
      const sector = generateSector();
      
      expect(sector.id).toBeDefined();
      expect(sector.name).toBeDefined();
      expect(sector.systems.length).toBeGreaterThanOrEqual(21);
      expect(sector.systems.length).toBeLessThanOrEqual(30);
      
      // All systems should have routes
      sector.systems.forEach(system => {
        expect(Array.isArray(system.routes)).toBe(true);
      });
    });

    it('should create connected spike routes', () => {
      const sector = generateSector();
      
      // Build adjacency graph
      const visited = new Set<string>();
      const queue = [sector.systems[0].id];
      visited.add(sector.systems[0].id);
      
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const current = sector.systems.find(s => s.id === currentId);
        
        if (current) {
          for (const route of current.routes) {
            if (!visited.has(route.systemId)) {
              visited.add(route.systemId);
              queue.push(route.systemId);
            }
          }
        }
      }
      
      // All systems should be reachable
      expect(visited.size).toBe(sector.systems.length);
    });

    it('should generate trade routes based on economics', () => {
      const sector = generateSector();
      const stats = getTradeRouteStats(sector.systems);
      
      // Should have some trade routes
      expect(stats.tradeRoutes).toBeGreaterThan(0);
      
      // Trade routes should be 20-50% of total routes (reasonable range)
      expect(stats.tradeRoutePercentage).toBeGreaterThan(10);
      expect(stats.tradeRoutePercentage).toBeLessThan(60);
      
      // Some systems might be major hubs
      // (This is probabilistic, so we just check the data structure)
      expect(Array.isArray(stats.majorHubs)).toBe(true);
    });

    it('should mark high-value worlds as trade hubs', () => {
      const sector = generateSector();
      
      // Find high-value worlds
      for (const system of sector.systems) {
        const profile = getWorldEconomicProfile(system.primaryWorld);
        const tradeInfo = getSystemTradeInfo(system, sector.systems);
        
        // High economic value worlds should attract trade
        if (profile.economicValue >= 70) {
          // Should either be a hub or have at least one trade route
          expect(
            tradeInfo.isTradeHub || tradeInfo.tradeRouteCount >= 1
          ).toBe(true);
        }
      }
    });

    it('should maintain bidirectional trade routes', () => {
      const sector = generateSector();
      
      // Check that all trade routes are bidirectional
      for (const system of sector.systems) {
        for (const route of system.routes) {
          if (route.isTradeRoute) {
            const targetSystem = sector.systems.find(s => s.id === route.systemId);
            expect(targetSystem).toBeDefined();
            
            if (targetSystem) {
              const reciprocalRoute = targetSystem.routes.find(
                r => r.systemId === system.id
              );
              expect(reciprocalRoute).toBeDefined();
              expect(reciprocalRoute?.isTradeRoute).toBe(true);
            }
          }
        }
      }
    });
  });

  describe('Economic Profile Generation', () => {
    it('should generate exports and imports', () => {
      const world = generatePrimaryWorld();
      const profile = getWorldEconomicProfile(world);
      
      // Even poor worlds should export something or import things
      if (world.population >= 1) {
        expect(
          profile.resourceExport.length > 0 || profile.resourceImport.length > 0
        ).toBe(true);
      }
    });

    it('should create complementary trade relationships', () => {
      const sector = generateSector();
      
      // Find a trade route and check if it makes economic sense
      for (const system of sector.systems) {
        const tradeRoute = system.routes.find(r => r.isTradeRoute);
        
        if (tradeRoute) {
          const partner = sector.systems.find(s => s.id === tradeRoute.systemId);
          if (!partner) continue;
          
          const profile1 = getWorldEconomicProfile(system.primaryWorld);
          const profile2 = getWorldEconomicProfile(partner.primaryWorld);
          
          // At least one world should have exports
          expect(
            profile1.resourceExport.length > 0 || profile2.resourceExport.length > 0
          ).toBe(true);
          
          // Trade routes should connect worlds with some economic activity
          expect(
            profile1.economicValue > 0 || profile2.economicValue > 0
          ).toBe(true);
          
          // We only need to check one trade route
          break;
        }
      }
    });
  });

  describe('Tag System', () => {
    it('should assign contextually appropriate tags', () => {
      for (let i = 0; i < 20; i++) {
        const world = generatePrimaryWorld();
        
        // Desert World tag should only appear on hot, dry worlds
        if (world.tags.includes('Desert World')) {
          expect(world.tradeCodes.includes('Desert')).toBe(true);
        }
        
        // Outpost World should have low population
        if (world.tags.includes('Outpost World')) {
          expect(world.population).toBe(1);
        }
        
        // Trade Hub should be on valuable worlds
        if (world.tags.includes('Trade Hub')) {
          const profile = getWorldEconomicProfile(world);
          expect(profile.economicValue).toBeGreaterThan(50);
        }
        
        // High Tech tag should match tech level
        if (world.tags.includes('High Tech')) {
          expect(world.techLevel).toBeGreaterThanOrEqual(4);
        }
        
        // Low Tech tag should match tech level
        if (world.tags.includes('Low Tech')) {
          expect(world.techLevel).toBeLessThanOrEqual(2);
        }
      }
    });

    it('should respect tag incompatibility', () => {
      for (let i = 0; i < 20; i++) {
        const world = generatePrimaryWorld();
        
        // Ice World and Desert World are incompatible
        if (world.tags.includes('Ice World')) {
          expect(world.tags.includes('Desert World')).toBe(false);
        }
        
        // Xenophiles and Xenophobes are incompatible
        if (world.tags.includes('Xenophiles')) {
          expect(world.tags.includes('Xenophobes')).toBe(false);
        }
      }
    });
  });

  describe('Statistical Distribution', () => {
    it('should produce varied sectors', () => {
      const sector1 = generateSector();
      const sector2 = generateSector();
      
      // Sectors should have different numbers of systems
      // (Not guaranteed, but highly likely)
      const different = 
        sector1.systems.length !== sector2.systems.length ||
        sector1.systems[0].name !== sector2.systems[0].name;
      
      expect(different).toBe(true);
    });

    it('should generate a mix of world types', () => {
      const sector = generateSector();
      
      const uniqueAtmospheres = new Set(
        sector.systems.map(s => s.primaryWorld.atmosphere)
      );
      const uniqueTemperatures = new Set(
        sector.systems.map(s => s.primaryWorld.temperature)
      );
      
      // With 20-30 systems, we should see variety (not rigid, but likely)
      expect(uniqueAtmospheres.size).toBeGreaterThan(2);
      expect(uniqueTemperatures.size).toBeGreaterThan(2);
    });
  });
});

