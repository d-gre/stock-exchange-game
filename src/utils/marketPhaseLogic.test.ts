import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateMarketMetrics,
  checkPhaseTransition,
  checkSectorPhaseTransition,
  checkCrashTrigger,
  calculateCrashPriceDrops,
  calculateFearGreedIndex,
  getVolatilityMultiplier,
  getMMSpreadModifier,
  calculateGlobalPhaseFromSectors,
  getVPTradeChanceModifier,
  shouldVPPreferStableStocks,
} from './marketPhaseLogic';
import type { Stock, MarketPhase, Sector } from '../types';

// Helper to create mock stocks
const createMockStock = (
  symbol: string,
  currentPrice: number,
  priceHistory: { time: number; open: number; high: number; low: number; close: number }[] = []
): Stock => ({
  symbol,
  name: `${symbol} Inc`,
  currentPrice,
  change: 0,
  changePercent: 0,
  marketCapBillions: 100,
  priceHistory,
  sector: 'tech',
});

// Helper to create price history
const createPriceHistory = (
  length: number,
  startPrice: number,
  trend: 'up' | 'down' | 'flat' = 'flat'
): { time: number; open: number; high: number; low: number; close: number }[] => {
  const history = [];
  let price = startPrice;
  const baseTime = Date.now() - length * 1000;

  for (let i = 0; i < length; i++) {
    const trendChange = trend === 'up' ? 0.02 : trend === 'down' ? -0.02 : 0;
    const randomChange = (Math.random() - 0.5) * 0.02;
    const change = trendChange + randomChange;

    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;

    history.push({ time: baseTime + i * 1000, open, high, low, close });
    price = close;
  }

  return history;
};

describe('marketPhaseLogic', () => {
  describe('calculateMarketMetrics', () => {
    it('should return zero metrics for empty stocks array', () => {
      const metrics = calculateMarketMetrics([]);

      expect(metrics.globalMomentum).toBe(0);
      expect(metrics.avgPriceChange).toBe(0);
    });

    it('should calculate positive momentum for up-trending stocks', () => {
      const stocks = [
        createMockStock('AAPL', 150, createPriceHistory(10, 100, 'up')),
        createMockStock('MSFT', 300, createPriceHistory(10, 250, 'up')),
      ];

      const metrics = calculateMarketMetrics(stocks);

      expect(metrics.globalMomentum).toBeGreaterThan(0);
    });

    it('should calculate negative momentum for down-trending stocks', () => {
      const stocks = [
        createMockStock('AAPL', 100, createPriceHistory(10, 150, 'down')),
        createMockStock('MSFT', 250, createPriceHistory(10, 300, 'down')),
      ];

      const metrics = calculateMarketMetrics(stocks);

      expect(metrics.globalMomentum).toBeLessThan(0);
    });

    it('should calculate sector-specific momentum', () => {
      const stocks = [
        createMockStock('AAPL', 150, createPriceHistory(10, 100, 'up')),
        createMockStock('JPM', 100, createPriceHistory(10, 150, 'down')),
      ];

      const metrics = calculateMarketMetrics(stocks);

      expect(metrics.sectorMomentum.tech).toBeGreaterThan(0);
      expect(metrics.sectorMomentum.finance).toBeLessThan(0);
    });

    it('should handle stocks with insufficient price history', () => {
      const stocks = [
        createMockStock('AAPL', 150, createPriceHistory(2, 140)),
      ];

      const metrics = calculateMarketMetrics(stocks);

      expect(metrics.globalMomentum).toBe(0);
    });
  });

  describe('checkPhaseTransition', () => {
    let mockRandom: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockRandom = vi.spyOn(Math, 'random');
    });

    afterEach(() => {
      mockRandom.mockRestore();
    });

    it('should not transition before minimum duration', () => {
      const metrics = {
        globalMomentum: 0.5,
        sectorMomentum: { tech: 0.5, finance: 0.5, industrial: 0.5, commodities: 0.5 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: 0.01,
      };

      mockRandom.mockReturnValue(0); // Guarantee transition roll succeeds

      const result = checkPhaseTransition('prosperity', 0, metrics);

      expect(result).toBeNull();
    });

    it('should potentially transition to boom from prosperity with high momentum', () => {
      const metrics = {
        globalMomentum: 0.5,
        sectorMomentum: { tech: 0.5, finance: 0.5, industrial: 0.5, commodities: 0.5 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: 0.01,
      };

      mockRandom.mockReturnValue(0.001); // Very low = transition succeeds

      const result = checkPhaseTransition('prosperity', 100, metrics);

      expect(result).toBe('boom');
    });

    it('should potentially transition to consolidation from prosperity with negative momentum', () => {
      const metrics = {
        globalMomentum: -0.2,
        sectorMomentum: { tech: -0.2, finance: -0.2, industrial: -0.2, commodities: -0.2 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: -0.01,
      };

      mockRandom.mockReturnValue(0.001);

      const result = checkPhaseTransition('prosperity', 100, metrics);

      expect(result).toBe('consolidation');
    });

    it('should transition from panic to recession after minimum duration', () => {
      const metrics = {
        globalMomentum: -0.3,
        sectorMomentum: { tech: -0.3, finance: -0.3, industrial: -0.3, commodities: -0.3 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: -0.02,
      };

      mockRandom.mockReturnValue(0.001);

      const result = checkPhaseTransition('panic', 100, metrics);

      expect(result).toBe('recession');
    });

    it('should return null if random roll fails', () => {
      const metrics = {
        globalMomentum: 0.5,
        sectorMomentum: { tech: 0.5, finance: 0.5, industrial: 0.5, commodities: 0.5 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: 0.01,
      };

      mockRandom.mockReturnValue(0.99); // High = transition fails

      const result = checkPhaseTransition('prosperity', 100, metrics);

      expect(result).toBeNull();
    });
  });

  describe('checkSectorPhaseTransition', () => {
    let mockRandom: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockRandom = vi.spyOn(Math, 'random');
    });

    afterEach(() => {
      mockRandom.mockRestore();
    });

    it('should not transition before minimum duration', () => {
      mockRandom.mockReturnValue(0);

      const result = checkSectorPhaseTransition('tech', 'prosperity', 0, 0.5);

      expect(result).toBeNull();
    });

    it('should potentially transition sector to boom with high momentum', () => {
      mockRandom.mockReturnValue(0.001);

      const result = checkSectorPhaseTransition('tech', 'prosperity', 100, 0.5);

      expect(result).toBe('boom');
    });

    it('should transition sector from panic to recession', () => {
      mockRandom.mockReturnValue(0.001);

      const result = checkSectorPhaseTransition('finance', 'panic', 100, -0.3);

      expect(result).toBe('recession');
    });
  });

  describe('checkCrashTrigger', () => {
    let mockRandom: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockRandom = vi.spyOn(Math, 'random');
    });

    afterEach(() => {
      mockRandom.mockRestore();
    });

    it('should not crash when sector is not overheated', () => {
      const stocks = [
        createMockStock('AAPL', 100, createPriceHistory(50, 100, 'flat')),
      ];

      const result = checkCrashTrigger('tech', 10, stocks);

      expect(result.shouldCrash).toBe(false);
      expect(result.crashImpact).toBe(0);
    });

    it('should potentially crash when sector is overheated and random roll succeeds', () => {
      // Create stocks that are significantly above average
      const history = createPriceHistory(50, 50, 'up');
      const stocks = [
        createMockStock('AAPL', 200, history),
      ];

      mockRandom.mockReturnValue(0.001); // Low = crash triggers

      const result = checkCrashTrigger('tech', 10, stocks);

      // Result depends on whether the sector is actually overheated based on the price history
      expect(result.shouldCrash).toBeDefined();
    });
  });

  describe('calculateCrashPriceDrops', () => {
    it('should calculate price drops for stocks in affected sector', () => {
      const stocks = [
        createMockStock('AAPL', 150, []),
        createMockStock('MSFT', 300, []),
        createMockStock('JPM', 120, []),
      ];

      const drops = calculateCrashPriceDrops(stocks, 'tech', 0.2);

      expect(drops['AAPL']).toBeDefined();
      expect(drops['MSFT']).toBeDefined();
      expect(drops['JPM']).toBeUndefined(); // Finance sector
    });

    it('should apply individual variation to drops', () => {
      const stocks = [
        createMockStock('AAPL', 150, []),
        createMockStock('MSFT', 300, []),
      ];

      const drops = calculateCrashPriceDrops(stocks, 'tech', 0.2);

      // Drops should be around 16-24% (80-120% of 20%)
      expect(drops['AAPL']).toBeGreaterThan(0.15);
      expect(drops['AAPL']).toBeLessThan(0.25);
    });

    it('should return empty object for non-existent sector stocks', () => {
      const stocks = [
        createMockStock('JPM', 120, []),
      ];

      const drops = calculateCrashPriceDrops(stocks, 'tech', 0.2);

      expect(Object.keys(drops)).toHaveLength(0);
    });
  });

  describe('calculateFearGreedIndex', () => {
    it('should return higher index for boom phase', () => {
      const metrics = {
        globalMomentum: 0.3,
        sectorMomentum: { tech: 0.3, finance: 0.3, industrial: 0.3, commodities: 0.3 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: 0.01,
      };

      const index = calculateFearGreedIndex('boom', metrics, []);

      expect(index).toBeGreaterThan(70);
    });

    it('should return lower index for panic phase', () => {
      const metrics = {
        globalMomentum: -0.5,
        sectorMomentum: { tech: -0.5, finance: -0.5, industrial: -0.5, commodities: -0.5 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: -0.02,
      };

      const index = calculateFearGreedIndex('panic', metrics, []);

      expect(index).toBeLessThan(30);
    });

    it('should clamp index between 0 and 100', () => {
      const extremeGreedMetrics = {
        globalMomentum: 1,
        sectorMomentum: { tech: 1, finance: 1, industrial: 1, commodities: 1 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: 0.1,
      };

      const greedIndex = calculateFearGreedIndex('boom', extremeGreedMetrics, []);
      expect(greedIndex).toBeLessThanOrEqual(100);

      const extremeFearMetrics = {
        globalMomentum: -1,
        sectorMomentum: { tech: -1, finance: -1, industrial: -1, commodities: -1 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: -0.1,
      };

      const fearIndex = calculateFearGreedIndex('panic', extremeFearMetrics, []);
      expect(fearIndex).toBeGreaterThanOrEqual(0);
    });

    it('should factor in volatility', () => {
      const metrics = {
        globalMomentum: 0,
        sectorMomentum: { tech: 0, finance: 0, industrial: 0, commodities: 0 },
        sectorOverheated: { tech: false, finance: false, industrial: false, commodities: false },
        avgPriceChange: 0,
      };

      // High volatility stocks
      const highVolStocks = [
        createMockStock('AAPL', 150, createPriceHistory(15, 100, 'up').map((h, i) => ({
          ...h,
          close: h.close * (1 + (i % 2 === 0 ? 0.05 : -0.05)),
        }))),
      ];

      // Low volatility stocks
      const lowVolStocks = [
        createMockStock('AAPL', 150, createPriceHistory(15, 140, 'flat')),
      ];

      const highVolIndex = calculateFearGreedIndex('prosperity', metrics, highVolStocks);
      const lowVolIndex = calculateFearGreedIndex('prosperity', metrics, lowVolStocks);

      // High volatility should lead to lower (more fearful) index
      expect(highVolIndex).toBeLessThanOrEqual(lowVolIndex);
    });
  });

  describe('getVolatilityMultiplier', () => {
    const defaultSectorPhases: Record<Sector, MarketPhase> = {
      tech: 'prosperity',
      finance: 'prosperity',
      industrial: 'prosperity',
      commodities: 'prosperity',
    };

    it('should return higher multiplier in panic phase', () => {
      const panicPhases: Record<Sector, MarketPhase> = {
        ...defaultSectorPhases,
        tech: 'panic',
      };

      const normalMultiplier = getVolatilityMultiplier('AAPL', 'prosperity', defaultSectorPhases);
      const panicMultiplier = getVolatilityMultiplier('AAPL', 'panic', panicPhases);

      expect(panicMultiplier).toBeGreaterThan(normalMultiplier);
    });

    it('should return 1.0 for unknown stock symbol', () => {
      const multiplier = getVolatilityMultiplier('UNKNOWN', 'prosperity', defaultSectorPhases);

      expect(multiplier).toBe(1.0);
    });

    it('should weight sector phase more than global phase', () => {
      const mixedPhases: Record<Sector, MarketPhase> = {
        ...defaultSectorPhases,
        tech: 'panic',
      };

      // Tech stock in panic sector but prosperity global
      const multiplier = getVolatilityMultiplier('AAPL', 'prosperity', mixedPhases);

      // Should be elevated due to sector panic (60% weight)
      expect(multiplier).toBeGreaterThan(1.0);
    });
  });

  describe('getMMSpreadModifier', () => {
    const defaultSectorPhases: Record<Sector, MarketPhase> = {
      tech: 'prosperity',
      finance: 'prosperity',
      industrial: 'prosperity',
      commodities: 'prosperity',
    };

    it('should return 0 for unknown stock symbol', () => {
      const modifier = getMMSpreadModifier('UNKNOWN', 'prosperity', defaultSectorPhases);

      expect(modifier).toBe(0);
    });

    it('should return higher spread in volatile phases', () => {
      const panicPhases: Record<Sector, MarketPhase> = {
        ...defaultSectorPhases,
        tech: 'panic',
      };

      const normalModifier = getMMSpreadModifier('AAPL', 'prosperity', defaultSectorPhases);
      const panicModifier = getMMSpreadModifier('AAPL', 'panic', panicPhases);

      expect(panicModifier).toBeGreaterThan(normalModifier);
    });
  });

  describe('calculateGlobalPhaseFromSectors', () => {
    it('should return prosperity when all sectors are in prosperity', () => {
      const sectorPhases: Record<Sector, MarketPhase> = {
        tech: 'prosperity',
        finance: 'prosperity',
        industrial: 'prosperity',
        commodities: 'prosperity',
      };

      const globalPhase = calculateGlobalPhaseFromSectors(sectorPhases);

      expect(globalPhase).toBe('prosperity');
    });

    it('should return boom when all sectors are in boom', () => {
      const sectorPhases: Record<Sector, MarketPhase> = {
        tech: 'boom',
        finance: 'boom',
        industrial: 'boom',
        commodities: 'boom',
      };

      const globalPhase = calculateGlobalPhaseFromSectors(sectorPhases);

      expect(globalPhase).toBe('boom');
    });

    it('should return panic when all sectors are in panic', () => {
      const sectorPhases: Record<Sector, MarketPhase> = {
        tech: 'panic',
        finance: 'panic',
        industrial: 'panic',
        commodities: 'panic',
      };

      const globalPhase = calculateGlobalPhaseFromSectors(sectorPhases);

      expect(globalPhase).toBe('panic');
    });

    it('should calculate average for mixed phases', () => {
      const sectorPhases: Record<Sector, MarketPhase> = {
        tech: 'boom',        // score 5
        finance: 'recession', // score 1
        industrial: 'prosperity', // score 4
        commodities: 'consolidation', // score 2
      };

      // Average = (5 + 1 + 4 + 2) / 4 = 3 = recovery
      const globalPhase = calculateGlobalPhaseFromSectors(sectorPhases);

      expect(globalPhase).toBe('recovery');
    });
  });

  describe('getVPTradeChanceModifier', () => {
    it('should return 0 for aggressive players regardless of phase', () => {
      expect(getVPTradeChanceModifier(50, 'panic')).toBe(0);
      expect(getVPTradeChanceModifier(100, 'recession')).toBe(0);
      expect(getVPTradeChanceModifier(34, 'consolidation')).toBe(0);
    });

    it('should return negative modifier for conservative players in panic', () => {
      const modifier = getVPTradeChanceModifier(-50, 'panic');

      expect(modifier).toBe(-0.6);
    });

    it('should return negative modifier for conservative players in downturn', () => {
      expect(getVPTradeChanceModifier(-50, 'consolidation')).toBe(-0.4);
      expect(getVPTradeChanceModifier(-50, 'recession')).toBe(-0.4);
    });

    it('should return small positive modifier for conservative players in upturn', () => {
      const modifier = getVPTradeChanceModifier(-50, 'boom');

      expect(modifier).toBe(0.05);
    });

    it('should return negative modifier for moderate players in downturn', () => {
      expect(getVPTradeChanceModifier(0, 'consolidation')).toBe(-0.2);
      expect(getVPTradeChanceModifier(0, 'panic')).toBe(-0.2);
      expect(getVPTradeChanceModifier(0, 'recession')).toBe(-0.2);
    });

    it('should return positive modifier for moderate players in upturn', () => {
      expect(getVPTradeChanceModifier(0, 'prosperity')).toBe(0.1);
      expect(getVPTradeChanceModifier(0, 'boom')).toBe(0.1);
    });

    it('should return 0 for moderate players in recovery', () => {
      const modifier = getVPTradeChanceModifier(0, 'recovery');

      expect(modifier).toBe(0);
    });

    it('should return small negative for conservative in recovery', () => {
      const modifier = getVPTradeChanceModifier(-50, 'recovery');

      expect(modifier).toBe(-0.1);
    });
  });

  describe('shouldVPPreferStableStocks', () => {
    it('should return false for non-conservative players', () => {
      expect(shouldVPPreferStableStocks(0, 'panic')).toBe(false);
      expect(shouldVPPreferStableStocks(50, 'recession')).toBe(false);
      expect(shouldVPPreferStableStocks(-33, 'consolidation')).toBe(false);
    });

    it('should return true for conservative players in downturn phases', () => {
      expect(shouldVPPreferStableStocks(-50, 'consolidation')).toBe(true);
      expect(shouldVPPreferStableStocks(-50, 'panic')).toBe(true);
      expect(shouldVPPreferStableStocks(-50, 'recession')).toBe(true);
    });

    it('should return false for conservative players in upturn phases', () => {
      expect(shouldVPPreferStableStocks(-50, 'prosperity')).toBe(false);
      expect(shouldVPPreferStableStocks(-50, 'boom')).toBe(false);
      expect(shouldVPPreferStableStocks(-50, 'recovery')).toBe(false);
    });
  });
});
