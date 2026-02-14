import { describe, it, expect } from 'vitest';
import {
  createInitialSectorMomentum,
  calculateSectorPerformance,
  updateSectorMomentum,
  getSectorInfluence,
  getAllSectorInfluences,
  INTER_SECTOR_CORRELATIONS,
  SECTOR_CONFIG,
  SECTOR_INFO,
  type SectorMomentumState,
} from './sectorCorrelation';
import type { Stock, Sector } from '../types';

describe('sectorCorrelation', () => {
  const createMockStocks = (sectorPerformances: Record<string, number>): Stock[] => {
    const stocks: Stock[] = [];
    const sectors = ['tech', 'finance', 'industrial', 'commodities'] as const;

    for (const sector of sectors) {
      const changePercent = sectorPerformances[sector] ?? 0;
      stocks.push({
        symbol: `${sector.toUpperCase()}1`,
        name: `${sector} Stock 1`,
        sector,
        currentPrice: 100,
        change: changePercent,
        changePercent,
        priceHistory: [{ time: 1, open: 100, high: 101, low: 99, close: 100 }],
        marketCapBillions: 100,
      });
    }
    return stocks;
  };

  describe('createInitialSectorMomentum', () => {
    it('should create neutral momentum for all sectors', () => {
      const momentum = createInitialSectorMomentum();

      expect(momentum.tech.momentum).toBe(0);
      expect(momentum.finance.momentum).toBe(0);
      expect(momentum.industrial.momentum).toBe(0);
      expect(momentum.commodities.momentum).toBe(0);
    });

    it('should have zero lastPerformance for all sectors', () => {
      const momentum = createInitialSectorMomentum();

      expect(momentum.tech.lastPerformance).toBe(0);
      expect(momentum.finance.lastPerformance).toBe(0);
      expect(momentum.industrial.lastPerformance).toBe(0);
      expect(momentum.commodities.lastPerformance).toBe(0);
    });
  });

  describe('calculateSectorPerformance', () => {
    it('should return 0 for empty sector', () => {
      const stocks: Stock[] = [];
      const performance = calculateSectorPerformance(stocks, 'tech');
      expect(performance).toBe(0);
    });

    it('should calculate average performance for sector', () => {
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple',
          sector: 'tech',
          currentPrice: 100,
          change: 2,
          changePercent: 2.0, // 2%
          priceHistory: [],
          marketCapBillions: 3000,
        },
        {
          symbol: 'MSFT',
          name: 'Microsoft',
          sector: 'tech',
          currentPrice: 200,
          change: 4,
          changePercent: 4.0, // 4%
          priceHistory: [],
          marketCapBillions: 3000,
        },
      ];

      const performance = calculateSectorPerformance(stocks, 'tech');
      // Average of 2% and 4% = 3% = 0.03
      expect(performance).toBeCloseTo(0.03, 4);
    });

    it('should only include stocks from the specified sector', () => {
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple',
          sector: 'tech',
          currentPrice: 100,
          change: 5,
          changePercent: 5.0,
          priceHistory: [],
          marketCapBillions: 3000,
        },
        {
          symbol: 'JPM',
          name: 'JPMorgan',
          sector: 'finance',
          currentPrice: 150,
          change: -3,
          changePercent: -3.0,
          priceHistory: [],
          marketCapBillions: 600,
        },
      ];

      const techPerformance = calculateSectorPerformance(stocks, 'tech');
      const financePerformance = calculateSectorPerformance(stocks, 'finance');

      expect(techPerformance).toBeCloseTo(0.05, 4);
      expect(financePerformance).toBeCloseTo(-0.03, 4);
    });
  });

  describe('updateSectorMomentum', () => {
    it('should update momentum based on performance', () => {
      const initialMomentum = createInitialSectorMomentum();
      const stocks = createMockStocks({ tech: 5.0, finance: 0, industrial: 0, commodities: 0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Tech had positive performance, momentum should increase
      expect(newMomentum.tech.momentum).not.toBe(0);
    });

    it('should decay momentum over time', () => {
      const initialMomentum = createInitialSectorMomentum();
      initialMomentum.tech.momentum = 0.5;

      const stocks = createMockStocks({ tech: 0, finance: 0, industrial: 0, commodities: 0 });
      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Momentum should decay towards 0
      expect(Math.abs(newMomentum.tech.momentum)).toBeLessThan(0.5);
    });

    it('should clamp momentum between -1 and 1', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Try to push momentum beyond bounds
      initialMomentum.tech.momentum = 0.99;

      const stocks = createMockStocks({ tech: 50.0, finance: 0, industrial: 0, commodities: 0 });
      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      expect(newMomentum.tech.momentum).toBeLessThanOrEqual(1);
      expect(newMomentum.tech.momentum).toBeGreaterThanOrEqual(-1);
    });

    it('should apply inter-sector correlations for strong performance', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Industrial with very strong performance should affect commodities
      const stocks = createMockStocks({ tech: 0, finance: 0, industrial: 10.0, commodities: 0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Commodities should be affected by industrial (correlation: 0.5)
      expect(newMomentum.commodities.lastPerformance).not.toBe(0);
    });
  });

  describe('getSectorInfluence', () => {
    it('should return 0 for neutral momentum', () => {
      const momentum = createInitialSectorMomentum();
      const influence = getSectorInfluence('tech', momentum);
      expect(influence).toBe(0);
    });

    it('should return positive influence for positive momentum', () => {
      const momentum = createInitialSectorMomentum();
      momentum.tech.momentum = 0.5;

      const influence = getSectorInfluence('tech', momentum);
      expect(influence).toBeGreaterThan(0);
    });

    it('should return negative influence for negative momentum', () => {
      const momentum = createInitialSectorMomentum();
      momentum.tech.momentum = -0.5;

      const influence = getSectorInfluence('tech', momentum);
      expect(influence).toBeLessThan(0);
    });

    it('should cap influence at maxSectorInfluence', () => {
      const momentum = createInitialSectorMomentum();
      momentum.tech.momentum = 1.0; // Maximum momentum

      const influence = getSectorInfluence('tech', momentum);
      expect(Math.abs(influence)).toBeLessThanOrEqual(SECTOR_CONFIG.maxSectorInfluence);
    });
  });

  describe('getAllSectorInfluences', () => {
    it('should return influences for all sectors', () => {
      const momentum = createInitialSectorMomentum();
      const influences = getAllSectorInfluences(momentum);

      expect(influences).toHaveProperty('tech');
      expect(influences).toHaveProperty('finance');
      expect(influences).toHaveProperty('industrial');
      expect(influences).toHaveProperty('commodities');
    });

    it('should return consistent values with getSectorInfluence', () => {
      const momentum = createInitialSectorMomentum();
      momentum.tech.momentum = 0.3;
      momentum.finance.momentum = -0.2;

      const influences = getAllSectorInfluences(momentum);

      expect(influences.tech).toBe(getSectorInfluence('tech', momentum));
      expect(influences.finance).toBe(getSectorInfluence('finance', momentum));
    });
  });

  describe('INTER_SECTOR_CORRELATIONS', () => {
    it('should define correlations for all sectors', () => {
      expect(INTER_SECTOR_CORRELATIONS).toHaveProperty('tech');
      expect(INTER_SECTOR_CORRELATIONS).toHaveProperty('finance');
      expect(INTER_SECTOR_CORRELATIONS).toHaveProperty('industrial');
      expect(INTER_SECTOR_CORRELATIONS).toHaveProperty('commodities');
    });

    it('should have correlation values between -1 and 1', () => {
      for (const sector of Object.keys(INTER_SECTOR_CORRELATIONS)) {
        const correlations = INTER_SECTOR_CORRELATIONS[sector as keyof typeof INTER_SECTOR_CORRELATIONS];
        for (const value of Object.values(correlations)) {
          expect(value).toBeGreaterThanOrEqual(-1);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('SECTOR_CONFIG', () => {
    it('should have valid configuration values', () => {
      expect(SECTOR_CONFIG.sectorInfluenceStrength).toBeGreaterThan(0);
      expect(SECTOR_CONFIG.sectorInfluenceStrength).toBeLessThanOrEqual(1);
      expect(SECTOR_CONFIG.momentumDecay).toBeGreaterThan(0);
      expect(SECTOR_CONFIG.momentumDecay).toBeLessThan(1);
      expect(SECTOR_CONFIG.maxSectorInfluence).toBeGreaterThan(0);
    });
  });

  describe('SECTOR_INFO', () => {
    it('should define info for all sectors', () => {
      expect(SECTOR_INFO).toHaveProperty('tech');
      expect(SECTOR_INFO).toHaveProperty('finance');
      expect(SECTOR_INFO).toHaveProperty('industrial');
      expect(SECTOR_INFO).toHaveProperty('commodities');
    });

    it('should have labels and colors for each sector', () => {
      for (const sector of Object.keys(SECTOR_INFO)) {
        const info = SECTOR_INFO[sector as keyof typeof SECTOR_INFO];
        expect(info).toHaveProperty('label');
        expect(info).toHaveProperty('shortLabel');
        expect(info).toHaveProperty('color');
        expect(info.shortLabel.length).toBeLessThanOrEqual(2);
      }
    });
  });
});

/**
 * Integration tests for inter-sector correlation mechanics.
 *
 * These tests verify the complete chain:
 * Sector Performance → Correlation Matrix → Adjusted Performance → Momentum → Price Influence
 *
 * Key formulas:
 * - Correlation effect = sourcePerf × correlation × 0.5 × interactionMultiplier
 * - Momentum update = decayedMomentum + (adjustedPerformance × momentumUpdateRate)
 * - Price influence = momentum × sectorInfluenceStrength (capped at ±maxSectorInfluence)
 */
describe('Sector Correlation Integration Tests', () => {
  /**
   * Creates mock stocks with specified sector performances.
   * Performance is given as percentage (e.g., 5.0 = 5%)
   */
  const createMockStocksWithSectors = (performances: Partial<Record<Sector, number>>): Stock[] => {
    const sectors: Sector[] = ['tech', 'finance', 'industrial', 'commodities'];
    return sectors.map(sector => ({
      symbol: `${sector.toUpperCase()}1`,
      name: `${sector} Stock`,
      sector,
      currentPrice: 100,
      change: performances[sector] ?? 0,
      changePercent: performances[sector] ?? 0,
      priceHistory: [{ time: 1, open: 100, high: 101, low: 99, close: 100 }],
      marketCapBillions: 100,
    }));
  };

  /**
   * Helper to run multiple cycles and track momentum evolution.
   */
  const runCycles = (
    initialMomentum: SectorMomentumState,
    stocks: Stock[],
    cycles: number
  ): SectorMomentumState => {
    let momentum = initialMomentum;
    for (let i = 0; i < cycles; i++) {
      momentum = updateSectorMomentum(momentum, stocks);
    }
    return momentum;
  };

  describe('Exact Correlation Value Tests', () => {
    it('should calculate exact correlation effect: Industrial → Commodities (+0.5)', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Industrial at +5% (above 2% threshold)
      const stocks = createMockStocksWithSectors({ industrial: 5.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Expected effect on commodities:
      // sourcePerf = 0.05 (5%)
      // correlation = 0.5 (industrial → commodities)
      // effect = 0.05 × 0.5 × 0.5 × 1.0 = 0.0125
      // Commodities adjusted performance = 0 + 0.0125 = 0.0125
      // Momentum contribution = 0.0125 × 0.15 = 0.001875
      const expectedEffect = 0.05 * 0.5 * 0.5 * 1.0;
      const expectedMomentumContribution = expectedEffect * SECTOR_CONFIG.momentumUpdateRate;

      expect(newMomentum.commodities.lastPerformance).toBeCloseTo(expectedEffect, 6);
      expect(newMomentum.commodities.momentum).toBeCloseTo(expectedMomentumContribution, 6);
    });

    it('should calculate exact correlation effect: Finance → Tech (+0.4)', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Finance at +4% (above 2% threshold)
      const stocks = createMockStocksWithSectors({ finance: 4.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Expected effect on tech:
      // sourcePerf = 0.04 (4%)
      // correlation = 0.4 (finance → tech)
      // effect = 0.04 × 0.4 × 0.5 × 1.0 = 0.008
      const expectedEffect = 0.04 * 0.4 * 0.5 * 1.0;

      expect(newMomentum.tech.lastPerformance).toBeCloseTo(expectedEffect, 6);
    });

    it('should calculate exact correlation effect: Finance → Industrial (+0.4)', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Finance at +6%
      const stocks = createMockStocksWithSectors({ finance: 6.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Expected effect on industrial:
      // sourcePerf = 0.06 (6%)
      // correlation = 0.4 (finance → industrial)
      // effect = 0.06 × 0.4 × 0.5 × 1.0 = 0.012
      const expectedEffect = 0.06 * 0.4 * 0.5 * 1.0;

      expect(newMomentum.industrial.lastPerformance).toBeCloseTo(expectedEffect, 6);
    });
  });

  describe('Negative Correlation Tests', () => {
    it('should apply negative correlation: Commodities → Industrial (-0.4)', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Commodities spike at +8% (above 2% threshold)
      const stocks = createMockStocksWithSectors({ commodities: 8.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Expected NEGATIVE effect on industrial:
      // sourcePerf = 0.08 (8%)
      // correlation = -0.4 (commodities → industrial)
      // effect = 0.08 × (-0.4) × 0.5 × 1.0 = -0.016
      const expectedEffect = 0.08 * (-0.4) * 0.5 * 1.0;

      expect(newMomentum.industrial.lastPerformance).toBeCloseTo(expectedEffect, 6);
      expect(newMomentum.industrial.lastPerformance).toBeLessThan(0);
      expect(newMomentum.industrial.momentum).toBeLessThan(0);
    });

    it('should apply negative correlation: Commodities → Tech (-0.1)', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Commodities at +10%
      const stocks = createMockStocksWithSectors({ commodities: 10.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Expected negative effect on tech:
      // sourcePerf = 0.10 (10%)
      // correlation = -0.1 (commodities → tech)
      // effect = 0.10 × (-0.1) × 0.5 × 1.0 = -0.005
      const expectedEffect = 0.10 * (-0.1) * 0.5 * 1.0;

      expect(newMomentum.tech.lastPerformance).toBeCloseTo(expectedEffect, 6);
      expect(newMomentum.tech.lastPerformance).toBeLessThan(0);
    });

    it('should hurt industrial when commodities rise sharply', () => {
      // Real-world scenario: oil price spike hurts manufacturing
      const initialMomentum = createInitialSectorMomentum();

      // Run 5 cycles with commodities consistently up
      const stocks = createMockStocksWithSectors({ commodities: 5.0 });
      const finalMomentum = runCycles(initialMomentum, stocks, 5);

      // Industrial should have negative momentum due to -0.4 correlation
      expect(finalMomentum.industrial.momentum).toBeLessThan(0);

      // Commodities itself should have positive momentum
      expect(finalMomentum.commodities.momentum).toBeGreaterThan(0);
    });
  });

  describe('Threshold Tests', () => {
    it('should NOT apply inter-sector effects below 2% threshold', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Industrial at +1.5% (BELOW 2% threshold)
      const stocks = createMockStocksWithSectors({ industrial: 1.5 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Commodities should NOT receive any correlation effect
      // Only its own performance (0) contributes
      expect(newMomentum.commodities.lastPerformance).toBe(0);
      expect(newMomentum.commodities.momentum).toBe(0);
    });

    it('should apply inter-sector effects at exactly 2% threshold', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Industrial at exactly +2.1% (just above 2% threshold)
      const stocks = createMockStocksWithSectors({ industrial: 2.1 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Commodities SHOULD receive correlation effect
      const expectedEffect = 0.021 * 0.5 * 0.5 * 1.0;
      expect(newMomentum.commodities.lastPerformance).toBeCloseTo(expectedEffect, 6);
    });

    it('should apply inter-sector effects for negative performance beyond threshold', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Industrial crashes at -5%
      const stocks = createMockStocksWithSectors({ industrial: -5.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Commodities should receive NEGATIVE effect (good sector dragging it down)
      // effect = -0.05 × 0.5 × 0.5 × 1.0 = -0.0125
      const expectedEffect = -0.05 * 0.5 * 0.5 * 1.0;
      expect(newMomentum.commodities.lastPerformance).toBeCloseTo(expectedEffect, 6);
    });
  });

  describe('Multi-Sector Cascade Tests', () => {
    it('should cascade effects: Finance boom affects Tech and Industrial', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Strong finance sector at +8%
      const stocks = createMockStocksWithSectors({ finance: 8.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Finance → Tech (+0.4): 0.08 × 0.4 × 0.5 = 0.016
      expect(newMomentum.tech.lastPerformance).toBeCloseTo(0.016, 6);

      // Finance → Industrial (+0.4): 0.08 × 0.4 × 0.5 = 0.016
      expect(newMomentum.industrial.lastPerformance).toBeCloseTo(0.016, 6);

      // Finance → Commodities (+0.2): 0.08 × 0.2 × 0.5 = 0.008
      expect(newMomentum.commodities.lastPerformance).toBeCloseTo(0.008, 6);
    });

    it('should handle multiple sectors moving simultaneously', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Both Finance (+6%) and Industrial (+4%) are strong
      const stocks = createMockStocksWithSectors({ finance: 6.0, industrial: 4.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Tech receives from:
      // - Finance: 0.06 × 0.4 × 0.5 = 0.012
      // - Industrial: 0.04 × 0.1 × 0.5 = 0.002
      // Total: 0.014
      expect(newMomentum.tech.lastPerformance).toBeCloseTo(0.014, 6);

      // Commodities receives from:
      // - Finance: 0.06 × 0.2 × 0.5 = 0.006
      // - Industrial: 0.04 × 0.5 × 0.5 = 0.01
      // Total: 0.016
      expect(newMomentum.commodities.lastPerformance).toBeCloseTo(0.016, 6);
    });

    it('should handle opposing forces: Finance up, Commodities up (hurts Industrial)', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Finance +5% (helps industrial) but Commodities +6% (hurts industrial)
      const stocks = createMockStocksWithSectors({ finance: 5.0, commodities: 6.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Industrial receives from:
      // - Finance: 0.05 × 0.4 × 0.5 = +0.01
      // - Commodities: 0.06 × (-0.4) × 0.5 = -0.012
      // Net: -0.002
      expect(newMomentum.industrial.lastPerformance).toBeCloseTo(-0.002, 6);
      expect(newMomentum.industrial.lastPerformance).toBeLessThan(0);
    });
  });

  describe('Multi-Cycle Momentum Evolution Tests', () => {
    it('should accumulate momentum over multiple positive cycles', () => {
      const initialMomentum = createInitialSectorMomentum();
      const stocks = createMockStocksWithSectors({ tech: 3.0 }); // Consistent tech growth

      // Run 10 cycles
      const finalMomentum = runCycles(initialMomentum, stocks, 10);

      // Tech momentum should be significantly positive
      expect(finalMomentum.tech.momentum).toBeGreaterThan(0.01);

      // Finance should also have positive momentum (tech → finance +0.3)
      expect(finalMomentum.finance.momentum).toBeGreaterThan(0);
    });

    it('should decay momentum when performance returns to neutral', () => {
      let momentum = createInitialSectorMomentum();

      // First: build up momentum with 5 strong cycles
      const strongStocks = createMockStocksWithSectors({ tech: 5.0 });
      momentum = runCycles(momentum, strongStocks, 5);
      const peakMomentum = momentum.tech.momentum;
      expect(peakMomentum).toBeGreaterThan(0);

      // Then: neutral performance for 10 cycles
      const neutralStocks = createMockStocksWithSectors({ tech: 0 });
      momentum = runCycles(momentum, neutralStocks, 10);

      // Momentum should decay toward zero
      expect(momentum.tech.momentum).toBeLessThan(peakMomentum);
      expect(momentum.tech.momentum).toBeGreaterThan(0); // Still positive but lower
    });

    it('should reverse momentum when trend reverses', () => {
      let momentum = createInitialSectorMomentum();

      // Build positive momentum
      const upStocks = createMockStocksWithSectors({ industrial: 4.0 });
      momentum = runCycles(momentum, upStocks, 5);
      expect(momentum.industrial.momentum).toBeGreaterThan(0);

      // Reverse with strong negative performance
      const downStocks = createMockStocksWithSectors({ industrial: -6.0 });
      momentum = runCycles(momentum, downStocks, 10);

      // Momentum should now be negative
      expect(momentum.industrial.momentum).toBeLessThan(0);
    });

    it('should propagate sustained commodity pressure to industrial over time', () => {
      let momentum = createInitialSectorMomentum();

      // Sustained commodity price increases (like oil crisis)
      const commoditySpike = createMockStocksWithSectors({ commodities: 4.0 });

      // Track industrial momentum over 20 cycles
      const industrialMomentumHistory: number[] = [];
      for (let i = 0; i < 20; i++) {
        momentum = updateSectorMomentum(momentum, commoditySpike);
        industrialMomentumHistory.push(momentum.industrial.momentum);
      }

      // Industrial momentum should become increasingly negative
      expect(industrialMomentumHistory[19]).toBeLessThan(industrialMomentumHistory[0]);
      expect(industrialMomentumHistory[19]).toBeLessThan(-0.005);
    });
  });

  describe('Price Influence Chain Tests', () => {
    it('should convert momentum to bounded price influence', () => {
      let momentum = createInitialSectorMomentum();
      const stocks = createMockStocksWithSectors({ tech: 5.0 });

      // Build momentum
      momentum = runCycles(momentum, stocks, 5);

      const influence = getSectorInfluence('tech', momentum);

      // Influence should be positive and within bounds
      expect(influence).toBeGreaterThan(0);
      expect(influence).toBeLessThanOrEqual(SECTOR_CONFIG.maxSectorInfluence);
    });

    it('should cap extreme momentum at maxSectorInfluence (±3%)', () => {
      const momentum = createInitialSectorMomentum();
      // Artificially set extreme momentum
      momentum.tech.momentum = 1.0; // Maximum possible

      const influence = getSectorInfluence('tech', momentum);

      // Should be capped at 3%
      expect(influence).toBe(SECTOR_CONFIG.maxSectorInfluence);
      expect(influence).toBe(0.03);
    });

    it('should produce negative influence from negative momentum', () => {
      let momentum = createInitialSectorMomentum();

      // Commodities up hurts industrial
      const stocks = createMockStocksWithSectors({ commodities: 6.0 });
      momentum = runCycles(momentum, stocks, 10);

      const industrialInfluence = getSectorInfluence('industrial', momentum);

      expect(industrialInfluence).toBeLessThan(0);
      expect(industrialInfluence).toBeGreaterThanOrEqual(-SECTOR_CONFIG.maxSectorInfluence);
    });
  });

  describe('Correlation Matrix Completeness Tests', () => {
    it('should have all expected correlations defined', () => {
      // Verify key correlations exist
      expect(INTER_SECTOR_CORRELATIONS.tech.finance).toBe(0.3);
      expect(INTER_SECTOR_CORRELATIONS.finance.tech).toBe(0.4);
      expect(INTER_SECTOR_CORRELATIONS.industrial.commodities).toBe(0.5);
      expect(INTER_SECTOR_CORRELATIONS.commodities.industrial).toBe(-0.4);
      expect(INTER_SECTOR_CORRELATIONS.commodities.tech).toBe(-0.1);
    });

    it('should have asymmetric correlations (A→B ≠ B→A)', () => {
      // Finance helps tech more than tech helps finance
      expect(INTER_SECTOR_CORRELATIONS.finance.tech).toBeGreaterThan(
        INTER_SECTOR_CORRELATIONS.tech.finance!
      );

      // Industrial needs commodities, but high commodity prices hurt industrial
      expect(INTER_SECTOR_CORRELATIONS.industrial.commodities).toBe(0.5);
      expect(INTER_SECTOR_CORRELATIONS.commodities.industrial).toBe(-0.4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle all sectors at zero performance', () => {
      const initialMomentum = createInitialSectorMomentum();
      const stocks = createMockStocksWithSectors({});

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // All should remain at zero
      expect(newMomentum.tech.momentum).toBe(0);
      expect(newMomentum.finance.momentum).toBe(0);
      expect(newMomentum.industrial.momentum).toBe(0);
      expect(newMomentum.commodities.momentum).toBe(0);
    });

    it('should handle extreme positive performance without overflow', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Extreme performance: +50%
      const stocks = createMockStocksWithSectors({ tech: 50.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Momentum should be clamped to 1
      expect(newMomentum.tech.momentum).toBeLessThanOrEqual(1);
    });

    it('should handle extreme negative performance without underflow', () => {
      const initialMomentum = createInitialSectorMomentum();
      // Extreme crash: -50%
      const stocks = createMockStocksWithSectors({ tech: -50.0 });

      const newMomentum = updateSectorMomentum(initialMomentum, stocks);

      // Momentum should be clamped to -1
      expect(newMomentum.tech.momentum).toBeGreaterThanOrEqual(-1);
    });

    it('should maintain momentum precision over many cycles', () => {
      let momentum = createInitialSectorMomentum();
      const stocks = createMockStocksWithSectors({ finance: 2.5 }); // Small consistent gain

      // Run 100 cycles
      momentum = runCycles(momentum, stocks, 100);

      // Values should still be valid numbers
      expect(Number.isFinite(momentum.tech.momentum)).toBe(true);
      expect(Number.isFinite(momentum.finance.momentum)).toBe(true);
      expect(Number.isFinite(momentum.industrial.momentum)).toBe(true);
      expect(Number.isFinite(momentum.commodities.momentum)).toBe(true);
    });
  });

  describe('Real-World Scenario Tests', () => {
    it('Scenario: Credit crunch - Finance crash ripples through economy', () => {
      let momentum = createInitialSectorMomentum();

      // Finance sector crashes (-8%)
      const crashStocks = createMockStocksWithSectors({ finance: -8.0 });
      momentum = runCycles(momentum, crashStocks, 5);

      // All correlated sectors should suffer
      expect(momentum.tech.momentum).toBeLessThan(0); // -0.4 correlation
      expect(momentum.industrial.momentum).toBeLessThan(0); // -0.4 correlation
      expect(momentum.commodities.momentum).toBeLessThan(0); // -0.2 correlation
    });

    it('Scenario: Tech boom drives investment', () => {
      let momentum = createInitialSectorMomentum();

      // Tech sector booms (+6%)
      const boomStocks = createMockStocksWithSectors({ tech: 6.0 });
      momentum = runCycles(momentum, boomStocks, 5);

      // Finance should benefit (investment activity)
      expect(momentum.finance.momentum).toBeGreaterThan(0);
    });

    it('Scenario: Oil crisis - Commodities spike hurts industry', () => {
      let momentum = createInitialSectorMomentum();

      // Commodity prices surge (+7%)
      const oilCrisis = createMockStocksWithSectors({ commodities: 7.0 });
      momentum = runCycles(momentum, oilCrisis, 10);

      // Industrial should be hurt significantly
      expect(momentum.industrial.momentum).toBeLessThan(-0.01);

      // Commodities itself thrives
      expect(momentum.commodities.momentum).toBeGreaterThan(0);
    });

    it('Scenario: Industrial expansion drives commodity demand', () => {
      let momentum = createInitialSectorMomentum();

      // Industrial sector expands (+5%)
      const expansion = createMockStocksWithSectors({ industrial: 5.0 });
      momentum = runCycles(momentum, expansion, 5);

      // Commodities should benefit from demand
      expect(momentum.commodities.momentum).toBeGreaterThan(0);
    });

    it('Scenario: Mixed signals - Tech up, Commodities up', () => {
      let momentum = createInitialSectorMomentum();

      // Tech booming (+5%) but commodities also rising (+4%)
      const mixedStocks = createMockStocksWithSectors({ tech: 5.0, commodities: 4.0 });
      momentum = runCycles(momentum, mixedStocks, 5);

      // Finance benefits from both (tech +0.3, commodities +0.1)
      expect(momentum.finance.momentum).toBeGreaterThan(0);

      // Industrial: tech helps (+0.1) but commodities hurt (-0.4)
      // Net should be negative
      expect(momentum.industrial.momentum).toBeLessThan(0);
    });
  });
});
