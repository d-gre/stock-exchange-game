import { describe, it, expect } from 'vitest';
import { calculateMarketIndex, INDEX_BASE_POINTS } from './indexCalculation';
import type { Stock } from '../types';

describe('calculateMarketIndex', () => {
  const createStock = (
    symbol: string,
    priceHistory: { time: number; open: number; high: number; low: number; close: number }[],
    marketCapBillions: number = 100
  ): Stock => ({
    symbol,
    name: symbol,
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
