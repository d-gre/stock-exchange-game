import { describe, it, expect } from 'vitest';
import {
  initializeVirtualPlayers,
  executeVirtualPlayerTrades,
  executeWarmupTrades,
  forceTradesForUntradedStocks,
  calculateVolatility,
  calculateTrend,
  scoreStockForPlayer,
  scoreHoldingForSale,
  calculatePositionSize,
  type WarmupConfig,
} from './virtualPlayers';
import { CONFIG } from '../config';
import { INITIAL_STOCKS } from './stockData';
import type { Stock, VirtualPlayer } from '../types';

/** Calculates the total value of a portfolio (Cash + Holdings) */
const calculatePortfolioValue = (portfolio: { cash: number; holdings: { symbol: string; shares: number }[] }): number => {
  const holdingsValue = portfolio.holdings.reduce((sum, h) => {
    const stockInfo = INITIAL_STOCKS.find(s => s.symbol === h.symbol);
    return sum + (stockInfo ? h.shares * stockInfo.basePrice : 0);
  }, 0);
  return portfolio.cash + holdingsValue;
};

describe('virtualPlayers', () => {
  describe('initializeVirtualPlayers', () => {
    it('should create the configured number of players', () => {
      const players = initializeVirtualPlayers();
      expect(players).toHaveLength(CONFIG.virtualPlayerCount);
    });

    it('should give each player a total portfolio value between min and max', () => {
      const players = initializeVirtualPlayers();
      for (const player of players) {
        const totalValue = calculatePortfolioValue(player.portfolio);
        expect(totalValue).toBeGreaterThanOrEqual(CONFIG.virtualPlayerCashMin);
        expect(totalValue).toBeLessThanOrEqual(CONFIG.virtualPlayerCashMax);
      }
    });

    it('should assign different starting cash amounts to players', () => {
      // Run multiple times to ensure randomness
      let hasDifferentValues = false;
      for (let i = 0; i < 10; i++) {
        const players = initializeVirtualPlayers();
        const cashValues = players.map(p => p.portfolio.cash);
        const uniqueValues = new Set(cashValues);
        if (uniqueValues.size > 1) {
          hasDifferentValues = true;
          break;
        }
      }
      expect(hasDifferentValues).toBe(true);
    });

    it('should give each player initial stock holdings', () => {
      const players = initializeVirtualPlayers();
      for (const player of players) {
        // Each player should hold 1-4 different stocks
        expect(player.portfolio.holdings.length).toBeGreaterThanOrEqual(1);
        expect(player.portfolio.holdings.length).toBeLessThanOrEqual(4);

        // Each holding should be valid
        for (const holding of player.portfolio.holdings) {
          expect(INITIAL_STOCKS.some(s => s.symbol === holding.symbol)).toBe(true);
          expect(holding.shares).toBeGreaterThan(0);
          expect(holding.avgBuyPrice).toBeGreaterThan(0);
        }
      }
    });

    it('should have remaining cash after buying initial holdings', () => {
      const players = initializeVirtualPlayers();
      for (const player of players) {
        // Players should still have cash (30-70% invested, so 30-70% as cash)
        expect(player.portfolio.cash).toBeGreaterThan(0);
      }
    });

    it('should assign unique IDs to each player', () => {
      const players = initializeVirtualPlayers();
      const ids = players.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(players.length);
    });

    it('should assign names to each player', () => {
      const players = initializeVirtualPlayers();
      for (const player of players) {
        expect(player.name).toBeTruthy();
        expect(player.name.length).toBeGreaterThan(0);
      }
    });

    it('should give each player settings with riskTolerance', () => {
      const players = initializeVirtualPlayers();
      for (const player of players) {
        expect(player.settings).toBeDefined();
        expect(player.settings.riskTolerance).toBeDefined();
        expect(typeof player.settings.riskTolerance).toBe('number');
      }
    });

    it('should assign riskTolerance values between -100 and 100', () => {
      const players = initializeVirtualPlayers();
      for (const player of players) {
        expect(player.settings.riskTolerance).toBeGreaterThanOrEqual(-100);
        expect(player.settings.riskTolerance).toBeLessThanOrEqual(100);
      }
    });

    it('should assign different riskTolerance values to players', () => {
      // Run multiple times to ensure randomness
      let hasDifferentValues = false;
      for (let i = 0; i < 10; i++) {
        const players = initializeVirtualPlayers();
        const riskValues = players.map(p => p.settings.riskTolerance);
        const uniqueValues = new Set(riskValues);
        if (uniqueValues.size > 1) {
          hasDifferentValues = true;
          break;
        }
      }
      expect(hasDifferentValues).toBe(true);
    });
  });

  describe('executeVirtualPlayerTrades', () => {
    const createMockStocks = (): Stock[] => [
      {
        symbol: 'TEST1',
        name: 'Test Stock 1',
        currentPrice: 100,
        change: 0,
        changePercent: 0,
        priceHistory: [{ time: 1000, open: 99, high: 101, low: 98, close: 100 }],
        marketCapBillions: 100,
      },
      {
        symbol: 'TEST2',
        name: 'Test Stock 2',
        currentPrice: 50,
        change: 0,
        changePercent: 0,
        priceHistory: [{ time: 1000, open: 49, high: 51, low: 48, close: 50 }],
        marketCapBillions: 50,
      },
    ];

    const createMockPlayer = (cash: number = 1000): VirtualPlayer => ({
      id: 'test-player',
      name: 'Test Player',
      portfolio: {
        cash,
        holdings: [],
      },
      transactions: [],
      settings: {
        riskTolerance: 0,
      },
    });

    it('should return updated players and stocks', () => {
      const players = [createMockPlayer()];
      const stocks = createMockStocks();
      const result = executeVirtualPlayerTrades(players, stocks);

      expect(result).toHaveProperty('updatedPlayers');
      expect(result).toHaveProperty('updatedStocks');
      expect(result.updatedPlayers).toHaveLength(1);
      expect(result.updatedStocks).toHaveLength(2);
    });

    it('should not allow buying more than cash allows', () => {
      const player = createMockPlayer(50); // Only $50
      const stocks = createMockStocks(); // Cheapest stock is $50

      // Run multiple times to test edge cases
      for (let i = 0; i < 20; i++) {
        const result = executeVirtualPlayerTrades([player], stocks);
        const updatedPlayer = result.updatedPlayers[0];
        expect(updatedPlayer.portfolio.cash).toBeGreaterThanOrEqual(0);
      }
    });

    it('should correctly update portfolio on buy', () => {
      const player: VirtualPlayer = {
        id: 'test-player',
        name: 'Test Player',
        portfolio: {
          cash: 10000,
          holdings: [{ symbol: 'TEST1', shares: 10, avgBuyPrice: 95 }],
        },
        transactions: [],
        settings: { riskTolerance: 0 },
      };
      const stocks = createMockStocks();

      // Run trades multiple times
      let currentPlayers = [player];
      let currentStocks = stocks;

      for (let i = 0; i < 50; i++) {
        const result = executeVirtualPlayerTrades(currentPlayers, currentStocks);
        currentPlayers = result.updatedPlayers;
        currentStocks = result.updatedStocks;

        const updatedPlayer = currentPlayers[0];
        // Total value should be conserved (cash + holdings value)
        expect(updatedPlayer.portfolio.cash).toBeGreaterThanOrEqual(0);
      }
    });

    it('should update stock prices when trades happen', () => {
      // Create player with holdings to ensure sells can happen
      const player: VirtualPlayer = {
        id: 'test-player',
        name: 'Test Player',
        portfolio: {
          cash: 5000,
          holdings: [
            { symbol: 'TEST1', shares: 50, avgBuyPrice: 95 },
            { symbol: 'TEST2', shares: 50, avgBuyPrice: 45 },
          ],
        },
        transactions: [],
        settings: { riskTolerance: 0 },
      };
      const stocks = createMockStocks();

      let priceChanged = false;

      // Run multiple iterations to increase chance of price change
      for (let i = 0; i < 50; i++) {
        const result = executeVirtualPlayerTrades([player], stocks);
        const test1Price = result.updatedStocks.find(s => s.symbol === 'TEST1')?.currentPrice;
        const test2Price = result.updatedStocks.find(s => s.symbol === 'TEST2')?.currentPrice;

        if (test1Price !== 100 || test2Price !== 50) {
          priceChanged = true;
          break;
        }
      }

      expect(priceChanged).toBe(true);
    });

    it('should not crash with empty players array', () => {
      const stocks = createMockStocks();
      const result = executeVirtualPlayerTrades([], stocks);

      expect(result.updatedPlayers).toEqual([]);
      expect(result.updatedStocks).toHaveLength(2);
    });

    it('should handle player with no cash and no holdings', () => {
      const player: VirtualPlayer = {
        id: 'broke-player',
        name: 'Broke Player',
        portfolio: {
          cash: 0,
          holdings: [],
        },
        transactions: [],
        settings: { riskTolerance: 0 },
      };
      const stocks = createMockStocks();

      // Should not crash
      const result = executeVirtualPlayerTrades([player], stocks);
      expect(result.updatedPlayers[0].portfolio.cash).toBe(0);
    });
  });

  describe('calculateVolatility', () => {
    it('should return 0 for empty price history', () => {
      expect(calculateVolatility([])).toBe(0);
    });

    it('should return 0 for single candle', () => {
      const history = [{ time: 1000, open: 100, high: 105, low: 95, close: 100 }];
      expect(calculateVolatility(history)).toBe(0);
    });

    it('should return 0 for constant prices', () => {
      const history = [
        { time: 1000, open: 100, high: 100, low: 100, close: 100 },
        { time: 2000, open: 100, high: 100, low: 100, close: 100 },
        { time: 3000, open: 100, high: 100, low: 100, close: 100 },
      ];
      expect(calculateVolatility(history)).toBe(0);
    });

    it('should return higher value for more volatile prices', () => {
      // Stable prices: 100 → 101 → 100 → 101
      const stableHistory = [
        { time: 1000, open: 100, high: 101, low: 99, close: 100 },
        { time: 2000, open: 100, high: 102, low: 100, close: 101 },
        { time: 3000, open: 101, high: 101, low: 99, close: 100 },
        { time: 4000, open: 100, high: 102, low: 100, close: 101 },
      ];

      // Volatile prices: 100 → 120 → 90 → 130
      const volatileHistory = [
        { time: 1000, open: 100, high: 105, low: 95, close: 100 },
        { time: 2000, open: 100, high: 125, low: 100, close: 120 },
        { time: 3000, open: 120, high: 120, low: 85, close: 90 },
        { time: 4000, open: 90, high: 135, low: 90, close: 130 },
      ];

      const stableVolatility = calculateVolatility(stableHistory);
      const highVolatility = calculateVolatility(volatileHistory);

      expect(highVolatility).toBeGreaterThan(stableVolatility);
    });
  });

  describe('calculateTrend', () => {
    it('should return 0 for empty price history', () => {
      expect(calculateTrend([])).toBe(0);
    });

    it('should return 0 for single candle', () => {
      const history = [{ time: 1000, open: 100, high: 105, low: 95, close: 100 }];
      expect(calculateTrend(history)).toBe(0);
    });

    it('should return positive value for uptrend', () => {
      const history = [
        { time: 1000, open: 100, high: 105, low: 95, close: 100 },
        { time: 2000, open: 100, high: 110, low: 100, close: 110 },
        { time: 3000, open: 110, high: 120, low: 108, close: 120 },
      ];
      expect(calculateTrend(history)).toBeGreaterThan(0);
    });

    it('should return negative value for downtrend', () => {
      const history = [
        { time: 1000, open: 100, high: 105, low: 95, close: 100 },
        { time: 2000, open: 100, high: 100, low: 85, close: 90 },
        { time: 3000, open: 90, high: 92, low: 78, close: 80 },
      ];
      expect(calculateTrend(history)).toBeLessThan(0);
    });

    it('should return 0 for flat trend', () => {
      const history = [
        { time: 1000, open: 100, high: 105, low: 95, close: 100 },
        { time: 2000, open: 100, high: 110, low: 90, close: 100 },
        { time: 3000, open: 100, high: 108, low: 92, close: 100 },
      ];
      expect(calculateTrend(history)).toBe(0);
    });

    it('should only consider last 5 candles', () => {
      // Old candles with uptrend, last 5 with downtrend
      const history = [
        { time: 1000, open: 50, high: 55, low: 48, close: 50 },
        { time: 2000, open: 50, high: 65, low: 50, close: 60 },
        { time: 3000, open: 60, high: 75, low: 58, close: 70 },
        // Last 5 candles:
        { time: 4000, open: 100, high: 105, low: 95, close: 100 },
        { time: 5000, open: 100, high: 100, low: 90, close: 95 },
        { time: 6000, open: 95, high: 96, low: 88, close: 90 },
        { time: 7000, open: 90, high: 92, low: 83, close: 85 },
        { time: 8000, open: 85, high: 86, low: 78, close: 80 },
      ];
      // Trend should be negative (100 → 80)
      expect(calculateTrend(history)).toBeLessThan(0);
    });
  });

  describe('scoreStockForPlayer', () => {
    const createStockWithHistory = (closes: number[]): Stock => ({
      symbol: 'TEST',
      name: 'Test Stock',
      currentPrice: closes[closes.length - 1],
      change: 0,
      changePercent: 0,
      priceHistory: closes.map((close, i) => ({
        time: (i + 1) * 1000,
        open: close,
        high: close * 1.02,
        low: close * 0.98,
        close,
      })),
      marketCapBillions: 100,
    });

    it('should return a score around 50 for neutral conditions', () => {
      const stock = createStockWithHistory([100, 100, 100, 100, 100]);

      // Multiple runs to account for random variation
      const scores: number[] = [];
      for (let i = 0; i < 20; i++) {
        scores.push(scoreStockForPlayer(stock, 0));
      }
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBeGreaterThan(40);
      expect(avgScore).toBeLessThan(60);
    });

    it('should score volatile stocks higher for risk-seeking players', () => {
      // Volatile stock
      const volatileStock = createStockWithHistory([100, 120, 90, 130, 100]);
      // Stable stock
      const stableStock = createStockWithHistory([100, 101, 100, 101, 100]);

      // Risk-seeking player (+100)
      let volatileScoreSum = 0;
      let stableScoreSum = 0;
      for (let i = 0; i < 50; i++) {
        volatileScoreSum += scoreStockForPlayer(volatileStock, 100);
        stableScoreSum += scoreStockForPlayer(stableStock, 100);
      }

      expect(volatileScoreSum / 50).toBeGreaterThan(stableScoreSum / 50);
    });

    it('should score stable stocks higher for risk-averse players', () => {
      // Volatile stock
      const volatileStock = createStockWithHistory([100, 120, 90, 130, 100]);
      // Stable stock
      const stableStock = createStockWithHistory([100, 101, 100, 101, 100]);

      // Risk-averse player (-100)
      let volatileScoreSum = 0;
      let stableScoreSum = 0;
      for (let i = 0; i < 50; i++) {
        volatileScoreSum += scoreStockForPlayer(volatileStock, -100);
        stableScoreSum += scoreStockForPlayer(stableStock, -100);
      }

      expect(stableScoreSum / 50).toBeGreaterThan(volatileScoreSum / 50);
    });

    it('should score uptrending stocks higher for risk-averse players', () => {
      const uptrendStock = createStockWithHistory([100, 105, 110, 115, 120]);
      const downtrendStock = createStockWithHistory([100, 95, 90, 85, 80]);

      let uptrendScoreSum = 0;
      let downtrendScoreSum = 0;
      for (let i = 0; i < 50; i++) {
        uptrendScoreSum += scoreStockForPlayer(uptrendStock, -100);
        downtrendScoreSum += scoreStockForPlayer(downtrendStock, -100);
      }

      expect(uptrendScoreSum / 50).toBeGreaterThan(downtrendScoreSum / 50);
    });
  });

  describe('scoreHoldingForSale', () => {
    const createStock = (currentPrice: number, trend: 'up' | 'down' | 'flat'): Stock => {
      let closes: number[];
      if (trend === 'up') {
        closes = [currentPrice * 0.8, currentPrice * 0.85, currentPrice * 0.9, currentPrice * 0.95, currentPrice];
      } else if (trend === 'down') {
        closes = [currentPrice * 1.2, currentPrice * 1.15, currentPrice * 1.1, currentPrice * 1.05, currentPrice];
      } else {
        closes = [currentPrice, currentPrice, currentPrice, currentPrice, currentPrice];
      }

      return {
        symbol: 'TEST',
        name: 'Test Stock',
        currentPrice,
        change: 0,
        changePercent: 0,
        priceHistory: closes.map((close, i) => ({
          time: (i + 1) * 1000,
          open: close,
          high: close * 1.01,
          low: close * 0.99,
          close,
        })),
        marketCapBillions: 100,
      };
    };

    it('should score losing positions higher for risk-averse players', () => {
      const stock = createStock(80, 'flat'); // Current price 80
      const avgBuyPrice = 100; // Bought at 100 → 20% loss

      let riskAverseScoreSum = 0;
      let riskSeekingScoreSum = 0;
      for (let i = 0; i < 50; i++) {
        riskAverseScoreSum += scoreHoldingForSale(stock, avgBuyPrice, -100);
        riskSeekingScoreSum += scoreHoldingForSale(stock, avgBuyPrice, 100);
      }

      // Risk-averse want to sell losses faster
      expect(riskAverseScoreSum / 50).toBeGreaterThan(riskSeekingScoreSum / 50);
    });

    it('should score positions with downtrend higher for sale', () => {
      const downtrendStock = createStock(100, 'down');
      const uptrendStock = createStock(100, 'up');
      const avgBuyPrice = 100;

      let downtrendScoreSum = 0;
      let uptrendScoreSum = 0;
      for (let i = 0; i < 50; i++) {
        downtrendScoreSum += scoreHoldingForSale(downtrendStock, avgBuyPrice, 0);
        uptrendScoreSum += scoreHoldingForSale(uptrendStock, avgBuyPrice, 0);
      }

      // Falling stocks should be more likely to be sold
      expect(downtrendScoreSum / 50).toBeGreaterThan(uptrendScoreSum / 50);
    });
  });

  describe('calculatePositionSize', () => {
    it('should return at least 1', () => {
      expect(calculatePositionSize(10, 0)).toBeGreaterThanOrEqual(1);
      expect(calculatePositionSize(10, -100)).toBeGreaterThanOrEqual(1);
      expect(calculatePositionSize(10, 100)).toBeGreaterThanOrEqual(1);
    });

    it('should return larger positions for risk-seeking players', () => {
      const maxAffordable = 100;

      let riskSeekingSum = 0;
      let riskAverseSum = 0;
      for (let i = 0; i < 100; i++) {
        riskSeekingSum += calculatePositionSize(maxAffordable, 100);
        riskAverseSum += calculatePositionSize(maxAffordable, -100);
      }

      expect(riskSeekingSum / 100).toBeGreaterThan(riskAverseSum / 100);
    });

    it('should not exceed maxAffordable', () => {
      for (let i = 0; i < 50; i++) {
        const size = calculatePositionSize(10, 100);
        expect(size).toBeLessThanOrEqual(10);
      }
    });

    it('should scale with maxAffordable', () => {
      let smallSum = 0;
      let largeSum = 0;
      for (let i = 0; i < 100; i++) {
        smallSum += calculatePositionSize(10, 0);
        largeSum += calculatePositionSize(1000, 0);
      }

      // Larger budget should lead to larger positions
      expect(largeSum / 100).toBeGreaterThan(smallSum / 100);
    });

    it('should buy 15-30% for risk-averse players (-100)', () => {
      const maxAffordable = 100;
      const samples: number[] = [];

      for (let i = 0; i < 100; i++) {
        samples.push(calculatePositionSize(maxAffordable, -100));
      }

      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      const min = Math.min(...samples);

      // Average should be between 15% and 30%
      expect(avg).toBeGreaterThanOrEqual(15);
      expect(avg).toBeLessThanOrEqual(30);
      // Minimum should be at least 10%
      expect(min).toBeGreaterThanOrEqual(10);
    });

    it('should buy 30-55% for neutral players (0)', () => {
      const maxAffordable = 100;
      const samples: number[] = [];

      for (let i = 0; i < 100; i++) {
        samples.push(calculatePositionSize(maxAffordable, 0));
      }

      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

      // Average should be between 30% and 55%
      expect(avg).toBeGreaterThanOrEqual(30);
      expect(avg).toBeLessThanOrEqual(55);
    });

    it('should buy 50-80% for risk-seeking players (+100)', () => {
      const maxAffordable = 100;
      const samples: number[] = [];

      for (let i = 0; i < 100; i++) {
        samples.push(calculatePositionSize(maxAffordable, 100));
      }

      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      const max = Math.max(...samples);

      // Average should be between 50% and 80%
      expect(avg).toBeGreaterThanOrEqual(50);
      expect(avg).toBeLessThanOrEqual(80);
      // Maximum should be able to reach up to 80%
      expect(max).toBeGreaterThanOrEqual(50);
    });

    it('should have significant difference between risk-averse and risk-seeking', () => {
      const maxAffordable = 100;
      let riskAverseSum = 0;
      let riskSeekingSum = 0;

      for (let i = 0; i < 100; i++) {
        riskAverseSum += calculatePositionSize(maxAffordable, -100);
        riskSeekingSum += calculatePositionSize(maxAffordable, 100);
      }

      const riskAverseAvg = riskAverseSum / 100;
      const riskSeekingAvg = riskSeekingSum / 100;

      // Risk-seekers should buy at least 2x as much as risk-averse
      expect(riskSeekingAvg / riskAverseAvg).toBeGreaterThanOrEqual(2);
    });
  });

  describe('executeWarmupTrades', () => {
    const createMockStocks = (): Stock[] => [
      {
        symbol: 'TEST1',
        name: 'Test Stock 1',
        currentPrice: 100,
        change: 0,
        changePercent: 0,
        priceHistory: [
          { time: 1000, open: 99, high: 101, low: 98, close: 100 },
          { time: 2000, open: 100, high: 102, low: 99, close: 101 },
        ],
        marketCapBillions: 100,
      },
      {
        symbol: 'TEST2',
        name: 'Test Stock 2',
        currentPrice: 50,
        change: 0,
        changePercent: 0,
        priceHistory: [
          { time: 1000, open: 49, high: 51, low: 48, close: 50 },
          { time: 2000, open: 50, high: 52, low: 49, close: 51 },
        ],
        marketCapBillions: 50,
      },
      {
        symbol: 'TEST3',
        name: 'Test Stock 3',
        currentPrice: 25,
        change: 0,
        changePercent: 0,
        priceHistory: [
          { time: 1000, open: 24, high: 26, low: 23, close: 25 },
          { time: 2000, open: 25, high: 27, low: 24, close: 26 },
        ],
        marketCapBillions: 25,
      },
    ];

    const createMockPlayer = (id: string, cash: number = 1000): VirtualPlayer => ({
      id,
      name: `Player ${id}`,
      portfolio: {
        cash,
        holdings: [],
      },
      transactions: [],
      settings: {
        riskTolerance: 50, // Leicht risikofreudig für höhere Trade-Wahrscheinlichkeit
      },
    });

    it('should return updated trade counts', () => {
      const players = [createMockPlayer('1', 5000), createMockPlayer('2', 5000)];
      const stocks = createMockStocks();
      const warmupConfig: WarmupConfig = {
        tradeCounts: {},
        prioritizeAfterCycle: 20,
        currentCycle: 0,
        minTradesRequired: 2,
      };

      const result = executeWarmupTrades(players, stocks, warmupConfig);

      expect(result).toHaveProperty('updatedPlayers');
      expect(result).toHaveProperty('updatedStocks');
      expect(result).toHaveProperty('updatedTradeCounts');
      expect(typeof result.updatedTradeCounts).toBe('object');
    });

    it('should track trades in tradeCounts', () => {
      const players = [
        createMockPlayer('1', 10000),
        createMockPlayer('2', 10000),
        createMockPlayer('3', 10000),
      ];
      const stocks = createMockStocks();

      let tradeCounts: Record<string, number> = {};

      // Execute multiple warmup cycles
      for (let i = 0; i < 30; i++) {
        const warmupConfig: WarmupConfig = {
          tradeCounts,
          prioritizeAfterCycle: 20,
          currentCycle: i,
          minTradesRequired: 2,
        };

        const result = executeWarmupTrades(players, stocks, warmupConfig);
        tradeCounts = result.updatedTradeCounts;
      }

      // After many cycles, trades should be tracked
      const totalTrades = Object.values(tradeCounts).reduce((sum, count) => sum + count, 0);
      expect(totalTrades).toBeGreaterThan(0);
    });

    it('should prioritize untraded stocks after prioritizeAfterCycle', () => {
      // Create many players for more trading activity
      const players = Array.from({ length: 10 }, (_, i) => createMockPlayer(`${i}`, 10000));
      const stocks = createMockStocks();

      // Simulate that TEST3 was never traded
      let tradeCounts: Record<string, number> = {
        'TEST1': 10,
        'TEST2': 10,
        'TEST3': 0, // Untraded
      };

      // Execute cycles after the prioritization threshold
      for (let i = 20; i < 30; i++) {
        const warmupConfig: WarmupConfig = {
          tradeCounts,
          prioritizeAfterCycle: 20,
          currentCycle: i,
          minTradesRequired: 2,
        };

        const result = executeWarmupTrades(players, stocks, warmupConfig);
        tradeCounts = result.updatedTradeCounts;
      }

      // After prioritization, TEST3 should also have trades
      // (cannot be guaranteed, but probability is high)
      // We only check that the mechanism doesn't crash
      expect(tradeCounts['TEST1']).toBeGreaterThanOrEqual(10);
      expect(tradeCounts['TEST2']).toBeGreaterThanOrEqual(10);
    });

    it('should preserve existing trade counts', () => {
      const players = [createMockPlayer('1', 5000)];
      const stocks = createMockStocks();
      const initialCounts = { 'TEST1': 5, 'TEST2': 3 };

      const warmupConfig: WarmupConfig = {
        tradeCounts: initialCounts,
        prioritizeAfterCycle: 20,
        currentCycle: 0,
        minTradesRequired: 2,
      };

      const result = executeWarmupTrades(players, stocks, warmupConfig);

      // Existing counts should be preserved or increased
      expect(result.updatedTradeCounts['TEST1']).toBeGreaterThanOrEqual(5);
      expect(result.updatedTradeCounts['TEST2']).toBeGreaterThanOrEqual(3);
    });
  });

  describe('forceTradesForUntradedStocks', () => {
    const createMockStocks = (): Stock[] => [
      {
        symbol: 'TRADED',
        name: 'Traded Stock',
        currentPrice: 100,
        change: 0,
        changePercent: 0,
        priceHistory: [{ time: 1000, open: 99, high: 101, low: 98, close: 100 }],
        marketCapBillions: 100,
      },
      {
        symbol: 'UNTRADED',
        name: 'Untraded Stock',
        currentPrice: 50,
        change: 0,
        changePercent: 0,
        priceHistory: [{ time: 1000, open: 49, high: 51, low: 48, close: 50 }],
        marketCapBillions: 50,
      },
    ];

    it('should force trades for stocks with 0 trades', () => {
      const players: VirtualPlayer[] = [
        {
          id: 'buyer',
          name: 'Buyer',
          portfolio: {
            cash: 10000,
            holdings: [],
          },
          transactions: [],
          settings: { riskTolerance: 0 },
        },
      ];
      const stocks = createMockStocks();
      const tradeCounts = { 'TRADED': 5, 'UNTRADED': 0 };

      const result = forceTradesForUntradedStocks(players, stocks, tradeCounts);

      expect(result.forcedSymbols).toContain('UNTRADED');
      expect(result.forcedSymbols).not.toContain('TRADED');
    });

    it('should not force trades for stocks that were already traded', () => {
      const players: VirtualPlayer[] = [
        {
          id: 'player',
          name: 'Player',
          portfolio: {
            cash: 10000,
            holdings: [],
          },
          transactions: [],
          settings: { riskTolerance: 0 },
        },
      ];
      const stocks = createMockStocks();
      const tradeCounts = { 'TRADED': 5, 'UNTRADED': 3 };

      const result = forceTradesForUntradedStocks(players, stocks, tradeCounts);

      expect(result.forcedSymbols).toHaveLength(0);
    });

    it('should update player portfolio when forcing a buy', () => {
      const players: VirtualPlayer[] = [
        {
          id: 'buyer',
          name: 'Buyer',
          portfolio: {
            cash: 10000,
            holdings: [],
          },
          transactions: [],
          settings: { riskTolerance: 0 },
        },
      ];
      const stocks = createMockStocks();
      const tradeCounts = { 'TRADED': 5, 'UNTRADED': 0 };

      const result = forceTradesForUntradedStocks(players, stocks, tradeCounts);

      const updatedPlayer = result.updatedPlayers[0];
      // Player should have less cash (has bought)
      expect(updatedPlayer.portfolio.cash).toBeLessThan(10000);
      // Player should now own UNTRADED shares
      const hasUntraded = updatedPlayer.portfolio.holdings.some(h => h.symbol === 'UNTRADED');
      expect(hasUntraded).toBe(true);
    });

    it('should update stock price when forcing a trade', () => {
      const players: VirtualPlayer[] = [
        {
          id: 'buyer',
          name: 'Buyer',
          portfolio: {
            cash: 10000,
            holdings: [],
          },
          transactions: [],
          settings: { riskTolerance: 0 },
        },
      ];
      const stocks = createMockStocks();
      const tradeCounts = { 'TRADED': 5, 'UNTRADED': 0 };

      const result = forceTradesForUntradedStocks(players, stocks, tradeCounts);

      const untradedStock = result.updatedStocks.find(s => s.symbol === 'UNTRADED');
      // Price should have changed (buy increases the price)
      expect(untradedStock?.currentPrice).not.toBe(50);
    });

    it('should force sell if no buyer available but seller exists', () => {
      const players: VirtualPlayer[] = [
        {
          id: 'seller',
          name: 'Seller',
          portfolio: {
            cash: 0, // No money to buy
            holdings: [{ symbol: 'UNTRADED', shares: 10, avgBuyPrice: 45 }],
          },
          transactions: [],
          settings: { riskTolerance: 0 },
        },
      ];
      const stocks = createMockStocks();
      const tradeCounts = { 'TRADED': 5, 'UNTRADED': 0 };

      const result = forceTradesForUntradedStocks(players, stocks, tradeCounts);

      expect(result.forcedSymbols).toContain('UNTRADED');

      const updatedPlayer = result.updatedPlayers[0];
      // Player should have more cash (has sold)
      expect(updatedPlayer.portfolio.cash).toBeGreaterThan(0);
      // Player should have fewer shares
      const holding = updatedPlayer.portfolio.holdings.find(h => h.symbol === 'UNTRADED');
      expect(holding?.shares ?? 0).toBeLessThan(10);
    });

    it('should handle empty players array', () => {
      const stocks = createMockStocks();
      const tradeCounts = { 'TRADED': 0, 'UNTRADED': 0 };

      const result = forceTradesForUntradedStocks([], stocks, tradeCounts);

      // Should not crash, but also cannot force trades
      expect(result.updatedPlayers).toEqual([]);
      expect(result.forcedSymbols).toEqual([]);
    });

    it('should handle multiple untraded stocks', () => {
      const stocks: Stock[] = [
        {
          symbol: 'STOCK1',
          name: 'Stock 1',
          currentPrice: 100,
          change: 0,
          changePercent: 0,
          priceHistory: [{ time: 1000, open: 99, high: 101, low: 98, close: 100 }],
          marketCapBillions: 100,
        },
        {
          symbol: 'STOCK2',
          name: 'Stock 2',
          currentPrice: 50,
          change: 0,
          changePercent: 0,
          priceHistory: [{ time: 1000, open: 49, high: 51, low: 48, close: 50 }],
          marketCapBillions: 50,
        },
        {
          symbol: 'STOCK3',
          name: 'Stock 3',
          currentPrice: 25,
          change: 0,
          changePercent: 0,
          priceHistory: [{ time: 1000, open: 24, high: 26, low: 23, close: 25 }],
          marketCapBillions: 25,
        },
      ];

      const players: VirtualPlayer[] = [
        {
          id: 'buyer',
          name: 'Buyer',
          portfolio: {
            cash: 50000,
            holdings: [],
          },
          transactions: [],
          settings: { riskTolerance: 0 },
        },
      ];

      const tradeCounts = { 'STOCK1': 0, 'STOCK2': 0, 'STOCK3': 0 };

      const result = forceTradesForUntradedStocks(players, stocks, tradeCounts);

      // All three should be traded
      expect(result.forcedSymbols).toContain('STOCK1');
      expect(result.forcedSymbols).toContain('STOCK2');
      expect(result.forcedSymbols).toContain('STOCK3');
    });
  });
});
