import { describe, it, expect } from 'vitest';
import {
  calculateMarketIndex,
  calculateSectorIndex,
  calculateAllSectorIndices,
  INDEX_BASE_POINTS,
  SECTOR_INDEX_CONFIG,
} from './indexCalculation';
import type { Stock, Sector } from '../types';

describe('calculateMarketIndex', () => {
  const createStock = (
    symbol: string,
    priceHistory: { time: number; open: number; high: number; low: number; close: number }[],
    marketCapBillions: number = 100
  ): Stock => ({
    symbol,
    name: symbol,
    sector: 'tech',
    currentPrice: priceHistory[priceHistory.length - 1]?.close ?? 0,
    change: 0,
    changePercent: 0,
    priceHistory,
    marketCapBillions,
  });

  it('should return empty index for empty stocks array', () => {
    const result = calculateMarketIndex([]);

    expect(result.symbol).toBe('DGREX');
    expect(result.name).toBe('D-GREX Prime');
    expect(result.currentPrice).toBe(0);
    expect(result.priceHistory).toHaveLength(0);
  });

  it('should return base points when no price history', () => {
    const stocks: Stock[] = [
      createStock('AAPL', [], 100),
    ];

    const result = calculateMarketIndex(stocks);

    expect(result.currentPrice).toBe(INDEX_BASE_POINTS);
    expect(result.priceHistory).toHaveLength(0);
  });

  it('should start at base points (10000) for first candle', () => {
    const stocks: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
      ], 100),
    ];

    const result = calculateMarketIndex(stocks);

    // First candle close should be exactly base points
    expect(result.priceHistory[0].close).toBe(INDEX_BASE_POINTS);
    expect(result.currentPrice).toBe(INDEX_BASE_POINTS);
  });

  it('should weight stocks by market cap', () => {
    // AAPL: 100 close, 300B market cap (75% weight)
    // GOOGL: 200 close, 100B market cap (25% weight)
    // Weighted price = (100 * 300 + 200 * 100) / 400 = 50000 / 400 = 125
    const stocks: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
      ], 300),
      createStock('GOOGL', [
        { time: 1000, open: 200, high: 210, low: 190, close: 200 },
      ], 100),
    ];

    const result = calculateMarketIndex(stocks);

    // Both start at same time, so first candle = base points
    expect(result.priceHistory[0].close).toBe(INDEX_BASE_POINTS);
  });

  it('should calculate index change based on weighted prices', () => {
    // First candle: AAPL 100, GOOGL 200
    // Weighted base = (100*300 + 200*100) / 400 = 125
    // Second candle: AAPL 110, GOOGL 200
    // Weighted = (110*300 + 200*100) / 400 = 53000 / 400 = 132.5
    // Index = (132.5 / 125) * 10000 = 10600
    const stocks: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 115, low: 95, close: 110 },
      ], 300),
      createStock('GOOGL', [
        { time: 1000, open: 200, high: 210, low: 190, close: 200 },
        { time: 2000, open: 200, high: 210, low: 195, close: 200 },
      ], 100),
    ];

    const result = calculateMarketIndex(stocks);

    expect(result.priceHistory[0].close).toBe(INDEX_BASE_POINTS);
    expect(result.priceHistory[1].close).toBe(10600);
    expect(result.currentPrice).toBe(10600);
  });

  it('should calculate change and changePercent correctly', () => {
    const stocks: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 115, low: 95, close: 110 },
      ], 300),
      createStock('GOOGL', [
        { time: 1000, open: 200, high: 210, low: 190, close: 200 },
        { time: 2000, open: 200, high: 210, low: 195, close: 200 },
      ], 100),
    ];

    const result = calculateMarketIndex(stocks);

    // Change: 10600 - 10000 = 600
    expect(result.change).toBe(600);
    // Change %: (600 / 10000) * 100 = 6%
    expect(result.changePercent).toBe(6);
  });

  it('should use minimum candle count across stocks', () => {
    const stocks: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 115, low: 95, close: 105 },
        { time: 3000, open: 105, high: 120, low: 100, close: 110 },
      ], 100),
      createStock('GOOGL', [
        { time: 1000, open: 200, high: 210, low: 190, close: 200 },
        { time: 2000, open: 200, high: 215, low: 195, close: 205 },
      ], 100),
    ];

    const result = calculateMarketIndex(stocks);

    // Should only have 2 candles (minimum of 3 and 2)
    expect(result.priceHistory).toHaveLength(2);
  });

  it('should give more weight to higher market cap stocks', () => {
    // Test 1: AAPL has higher market cap
    const stocks1: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 120, low: 95, close: 120 }, // +20%
      ], 900), // 90% weight
      createStock('GOOGL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 105, low: 75, close: 80 }, // -20%
      ], 100), // 10% weight
    ];

    const result1 = calculateMarketIndex(stocks1);

    // Test 2: GOOGL has higher market cap
    const stocks2: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 120, low: 95, close: 120 }, // +20%
      ], 100), // 10% weight
      createStock('GOOGL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 105, low: 75, close: 80 }, // -20%
      ], 900), // 90% weight
    ];

    const result2 = calculateMarketIndex(stocks2);

    // When AAPL (rising) has more weight, index should be higher
    // When GOOGL (falling) has more weight, index should be lower
    expect(result1.currentPrice).toBeGreaterThan(INDEX_BASE_POINTS);
    expect(result2.currentPrice).toBeLessThan(INDEX_BASE_POINTS);
    expect(result1.currentPrice).toBeGreaterThan(result2.currentPrice);
  });

  it('should calculate correct OHLC for index candles', () => {
    const stocks: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 120, low: 80, close: 110 },
      ], 100),
      createStock('GOOGL', [
        { time: 1000, open: 200, high: 220, low: 180, close: 210 },
      ], 100),
    ];

    const result = calculateMarketIndex(stocks);

    // Equal weights (50% each)
    // Weighted open = (100 + 200) / 2 = 150, but first candle is base
    // Since this is the first (and only) candle, all values are relative to weighted close
    // Weighted close = (110 + 210) / 2 = 160
    // All points are calculated relative to this base

    const candle = result.priceHistory[0];
    // open: (100 + 200) / 2 = 150, relative to 160 base = 150/160 * 10000 = 9375
    expect(candle.open).toBe(9375);
    // high: (120 + 220) / 2 = 170, relative to 160 base = 170/160 * 10000 = 10625
    expect(candle.high).toBe(10625);
    // low: (80 + 180) / 2 = 130, relative to 160 base = 130/160 * 10000 = 8125
    expect(candle.low).toBe(8125);
    // close: (110 + 210) / 2 = 160, relative to 160 base = 10000
    expect(candle.close).toBe(INDEX_BASE_POINTS);
  });

  it('should handle single stock correctly', () => {
    const stocks: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 115, low: 95, close: 105 },
      ], 100),
    ];

    const result = calculateMarketIndex(stocks);

    expect(result.priceHistory[0].close).toBe(INDEX_BASE_POINTS);
    // 5% increase = 10500 points
    expect(result.priceHistory[1].close).toBe(10500);
  });

  it('should handle equal market caps like simple average', () => {
    const stocks: Stock[] = [
      createStock('AAPL', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
      ], 100),
      createStock('GOOGL', [
        { time: 1000, open: 200, high: 210, low: 190, close: 200 },
      ], 100),
    ];

    const result = calculateMarketIndex(stocks);

    // With equal market caps, it's a simple average
    // Base weighted price = (100 + 200) / 2 = 150
    // Current weighted price = (100 + 200) / 2 = 150
    // Index = 10000
    expect(result.currentPrice).toBe(INDEX_BASE_POINTS);
  });
});

describe('calculateSectorIndex', () => {
  const createStock = (
    symbol: string,
    sector: Sector,
    priceHistory: { time: number; open: number; high: number; low: number; close: number }[],
    marketCapBillions: number = 100
  ): Stock => ({
    symbol,
    name: symbol,
    sector,
    currentPrice: priceHistory[priceHistory.length - 1]?.close ?? 0,
    change: 0,
    changePercent: 0,
    priceHistory,
    marketCapBillions,
  });

  it('should return correct name and symbol for each sector', () => {
    const sectors: Sector[] = ['tech', 'finance', 'industrial', 'commodities'];

    for (const sector of sectors) {
      const result = calculateSectorIndex([], sector);
      expect(result.name).toBe(SECTOR_INDEX_CONFIG[sector].name);
      expect(result.symbol).toBe(SECTOR_INDEX_CONFIG[sector].symbol);
      expect(result.sector).toBe(sector);
    }
  });

  it('should only include stocks from the specified sector', () => {
    const stocks: Stock[] = [
      createStock('AAPL', 'tech', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 120, low: 95, close: 120 },
      ], 100),
      createStock('JPM', 'finance', [
        { time: 1000, open: 200, high: 210, low: 190, close: 200 },
        { time: 2000, open: 200, high: 205, low: 175, close: 180 },
      ], 100),
    ];

    const techIndex = calculateSectorIndex(stocks, 'tech');
    const financeIndex = calculateSectorIndex(stocks, 'finance');

    // Tech stock went up 20%
    expect(techIndex.currentPrice).toBe(12000);
    // Finance stock went down 10%
    expect(financeIndex.currentPrice).toBe(9000);
  });

  it('should return empty index for sector with no stocks', () => {
    const stocks: Stock[] = [
      createStock('AAPL', 'tech', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
      ], 100),
    ];

    const result = calculateSectorIndex(stocks, 'commodities');

    expect(result.currentPrice).toBe(0);
    expect(result.priceHistory).toHaveLength(0);
    expect(result.sector).toBe('commodities');
  });

  it('should weight stocks within sector by market cap', () => {
    const stocks: Stock[] = [
      createStock('AAPL', 'tech', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 120, low: 95, close: 120 },
      ], 900), // 90% weight, +20%
      createStock('MSFT', 'tech', [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
        { time: 2000, open: 100, high: 105, low: 75, close: 80 },
      ], 100), // 10% weight, -20%
    ];

    const result = calculateSectorIndex(stocks, 'tech');

    // Weighted: 0.9 * 20% + 0.1 * (-20%) = 18% - 2% = 16%
    expect(result.currentPrice).toBe(11600);
  });
});

describe('calculateAllSectorIndices', () => {
  const createStock = (
    symbol: string,
    sector: Sector,
    priceHistory: { time: number; open: number; high: number; low: number; close: number }[],
    marketCapBillions: number = 100
  ): Stock => ({
    symbol,
    name: symbol,
    sector,
    currentPrice: priceHistory[priceHistory.length - 1]?.close ?? 0,
    change: 0,
    changePercent: 0,
    priceHistory,
    marketCapBillions,
  });

  it('should return indices for all four sectors', () => {
    const stocks: Stock[] = [
      createStock('AAPL', 'tech', [{ time: 1000, open: 100, high: 110, low: 90, close: 100 }], 100),
      createStock('JPM', 'finance', [{ time: 1000, open: 100, high: 110, low: 90, close: 100 }], 100),
      createStock('BA', 'industrial', [{ time: 1000, open: 100, high: 110, low: 90, close: 100 }], 100),
      createStock('XOM', 'commodities', [{ time: 1000, open: 100, high: 110, low: 90, close: 100 }], 100),
    ];

    const result = calculateAllSectorIndices(stocks);

    expect(result.tech).toBeDefined();
    expect(result.finance).toBeDefined();
    expect(result.industrial).toBeDefined();
    expect(result.commodities).toBeDefined();

    expect(result.tech.name).toBe('D-GREX Tek');
    expect(result.finance.name).toBe('D-GREX Fin');
    expect(result.industrial.name).toBe('D-GREX Ind');
    expect(result.commodities.name).toBe('D-GREX Raw');
  });

  it('should handle missing sectors gracefully', () => {
    const stocks: Stock[] = [
      createStock('AAPL', 'tech', [{ time: 1000, open: 100, high: 110, low: 90, close: 100 }], 100),
    ];

    const result = calculateAllSectorIndices(stocks);

    expect(result.tech.currentPrice).toBe(INDEX_BASE_POINTS);
    expect(result.finance.currentPrice).toBe(0);
    expect(result.industrial.currentPrice).toBe(0);
    expect(result.commodities.currentPrice).toBe(0);
  });
});

describe('SECTOR_INDEX_CONFIG', () => {
  it('should have correct configuration for all sectors', () => {
    expect(SECTOR_INDEX_CONFIG.tech).toEqual({ name: 'D-GREX Tek', symbol: 'DGREX-T' });
    expect(SECTOR_INDEX_CONFIG.finance).toEqual({ name: 'D-GREX Fin', symbol: 'DGREX-F' });
    expect(SECTOR_INDEX_CONFIG.industrial).toEqual({ name: 'D-GREX Ind', symbol: 'DGREX-I' });
    expect(SECTOR_INDEX_CONFIG.commodities).toEqual({ name: 'D-GREX Raw', symbol: 'DGREX-R' });
  });
});
