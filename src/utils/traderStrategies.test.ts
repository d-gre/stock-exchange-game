import { describe, it, expect } from 'vitest';
import {
  calculateRSI,
  getDefaultParams,
  assignTraderType,
  makeMarketMakerDecision,
  makeMomentumDecision,
  makeContrarianDecision,
  makeFundamentalistDecision,
  makeNoiseTraderDecision,
  makeStrategyDecision,
} from './traderStrategies';
import { createMockStock, createMockVirtualPlayer, createMockCandle } from '../test/utils/mockFactories';
import type { CandleData, TraderType } from '../types';

describe('traderStrategies', () => {
  // Generate price history with a consistent trend (no randomness for test reliability)
  const generatePriceHistory = (basePrice: number, trend: 'up' | 'down' | 'flat', count: number = 20): CandleData[] => {
    const history: CandleData[] = [];
    let price = basePrice;

    for (let i = 0; i < count; i++) {
      // Use consistent change to ensure trend is detectable
      // 1% change per candle = 5% trend over 5 candles (above 2% threshold)
      const change = trend === 'up' ? 0.01 : trend === 'down' ? -0.01 : 0;
      price = price * (1 + change);
      history.push(createMockCandle({
        time: Date.now() - (count - i) * 60000,
        open: price * 0.995,
        high: price * 1.01,
        low: price * 0.99,
        close: price,
      }));
    }

    return history;
  };

  describe('calculateRSI', () => {
    it('should return 50 for insufficient data', () => {
      const history = generatePriceHistory(100, 'flat', 5);
      expect(calculateRSI(history)).toBe(50);
    });

    it('should return high RSI for consistent gains', () => {
      // Create history with consistent gains
      const history: CandleData[] = [];
      let price = 100;
      for (let i = 0; i < 20; i++) {
        price = price * 1.02; // 2% gain each period
        history.push(createMockCandle({ close: price, time: Date.now() - i * 60000 }));
      }

      const rsi = calculateRSI(history);
      expect(rsi).toBeGreaterThan(70);
    });

    it('should return low RSI for consistent losses', () => {
      // Create history with consistent losses
      const history: CandleData[] = [];
      let price = 100;
      for (let i = 0; i < 20; i++) {
        price = price * 0.98; // 2% loss each period
        history.push(createMockCandle({ close: price, time: Date.now() - i * 60000 }));
      }

      const rsi = calculateRSI(history);
      expect(rsi).toBeLessThan(30);
    });
  });

  describe('getDefaultParams', () => {
    it('should return correct params for marketMaker', () => {
      const params = getDefaultParams('marketMaker');
      expect(params.targetSpread).toBeDefined();
      expect(params.inventoryTarget).toBeDefined();
    });

    it('should return correct params for momentum', () => {
      const params = getDefaultParams('momentum');
      expect(params.trendLookback).toBeDefined();
      expect(params.trendThreshold).toBeDefined();
    });

    it('should return correct params for contrarian', () => {
      const params = getDefaultParams('contrarian');
      expect(params.oversoldThreshold).toBeDefined();
      expect(params.overboughtThreshold).toBeDefined();
    });

    it('should return correct params for fundamentalist', () => {
      const params = getDefaultParams('fundamentalist');
      expect(params.valuationTolerance).toBeDefined();
    });

    it('should return correct params for noise', () => {
      const params = getDefaultParams('noise');
      expect(params.tradeFrequency).toBeDefined();
    });

    it('should return empty object for balanced', () => {
      const params = getDefaultParams('balanced');
      expect(Object.keys(params).length).toBe(0);
    });
  });

  describe('assignTraderType', () => {
    it('should assign different types based on distribution', () => {
      const totalPlayers = 50;
      const types = new Set<string>();

      for (let i = 0; i < totalPlayers; i++) {
        types.add(assignTraderType(i, totalPlayers));
      }

      // Should have multiple different types
      expect(types.size).toBeGreaterThan(1);
    });

    it('should assign marketMaker to early players (first 10%)', () => {
      const type = assignTraderType(0, 50);
      expect(type).toBe('marketMaker');
    });

    it('should assign balanced to late players (last 20%)', () => {
      const type = assignTraderType(49, 50);
      expect(type).toBe('balanced');
    });
  });

  describe('makeMarketMakerDecision', () => {
    it('should create order book entries for available stocks', () => {
      const player = createMockVirtualPlayer({
        id: 'mm-1',
        portfolio: {
          cash: 10000,
          holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
        },
        settings: {
          riskTolerance: 0,
          traderType: 'marketMaker',
          strategyParams: { targetSpread: 0.02, inventoryTarget: 0.5 },
        },
      });

      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 150 })];
      const orderBooks = { AAPL: { symbol: 'AAPL', bids: [], asks: [] } };
      const existingOrderCounts = { AAPL: 0 };

      // Run multiple times since there's randomness
      let hasOrders = false;
      for (let i = 0; i < 20; i++) {
        const decision = makeMarketMakerDecision(player, stocks, orderBooks, existingOrderCounts);
        if (decision && decision.entries.length > 0) {
          hasOrders = true;
          // Check that entries have proper structure
          for (const entry of decision.entries) {
            expect(entry.traderId).toBe('mm-1');
            expect(entry.symbol).toBe('AAPL');
            expect(['buy', 'sell']).toContain(entry.type);
            expect(entry.remainingCycles).toBeDefined();
          }
          break;
        }
      }

      // Market maker should eventually place orders
      expect(hasOrders).toBe(true);
    });

    it('should respect maxOrdersPerVP limit', () => {
      const player = createMockVirtualPlayer({
        id: 'mm-1',
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'marketMaker' },
      });

      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 150 })];
      const orderBooks = { AAPL: { symbol: 'AAPL', bids: [], asks: [] } };
      const existingOrderCounts = { AAPL: 3 }; // Already at max

      const decision = makeMarketMakerDecision(player, stocks, orderBooks, existingOrderCounts);

      // Should not add orders when already at limit
      expect(decision?.entries?.length ?? 0).toBe(0);
    });
  });

  describe('makeMomentumDecision', () => {
    it('should buy when trend is positive', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 50, traderType: 'momentum' },
      });

      const upTrendHistory = generatePriceHistory(100, 'up', 20);
      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: upTrendHistory[upTrendHistory.length - 1].close,
        priceHistory: upTrendHistory,
      })];

      // Run multiple times since there's randomness (momentum has 50% base chance)
      // Increase iterations to reduce flakiness
      let buyDecision = null;
      for (let i = 0; i < 200; i++) {
        const decision = makeMomentumDecision(player, stocks);
        if (decision?.type === 'buy') {
          buyDecision = decision;
          break;
        }
      }

      // Momentum trader with cash in an uptrend should eventually buy
      expect(buyDecision).not.toBeNull();
      expect(buyDecision?.type).toBe('buy');
    });

    it('should sell holdings when trend is negative', () => {
      const downTrendHistory = generatePriceHistory(100, 'down', 20);
      const player = createMockVirtualPlayer({
        portfolio: {
          cash: 5000,
          holdings: [{ symbol: 'AAPL', shares: 50, avgBuyPrice: 110 }],
        },
        settings: { riskTolerance: 50, traderType: 'momentum' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: downTrendHistory[downTrendHistory.length - 1].close,
        priceHistory: downTrendHistory,
      })];

      // Run multiple times since there's randomness (momentum has 50% base chance)
      // Increase iterations to reduce flakiness
      let sellDecision = null;
      for (let i = 0; i < 200; i++) {
        const decision = makeMomentumDecision(player, stocks);
        if (decision?.type === 'sell') {
          sellDecision = decision;
          break;
        }
      }

      // Momentum trader with holdings in a downtrend should eventually sell
      expect(sellDecision).not.toBeNull();
      expect(sellDecision?.type).toBe('sell');
    });
  });

  describe('makeFundamentalistDecision', () => {
    it('should buy undervalued stocks', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'fundamentalist' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: 80,      // Current price
        fairValue: 100,        // Fair value is higher -> undervalued
        priceHistory: generatePriceHistory(80, 'flat', 20),
      })];

      // Run multiple times since there's randomness
      let buyDecision = null;
      for (let i = 0; i < 50; i++) {
        const decision = makeFundamentalistDecision(player, stocks);
        if (decision?.type === 'buy') {
          buyDecision = decision;
          break;
        }
      }

      expect(buyDecision).not.toBeNull();
      expect(buyDecision?.type).toBe('buy');
    });

    it('should sell overvalued stocks', () => {
      const player = createMockVirtualPlayer({
        portfolio: {
          cash: 5000,
          holdings: [{ symbol: 'AAPL', shares: 50, avgBuyPrice: 90 }],
        },
        settings: { riskTolerance: 0, traderType: 'fundamentalist' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: 120,     // Current price
        fairValue: 100,        // Fair value is lower -> overvalued
        priceHistory: generatePriceHistory(120, 'flat', 20),
      })];

      // Run multiple times since there's randomness
      let sellDecision = null;
      for (let i = 0; i < 50; i++) {
        const decision = makeFundamentalistDecision(player, stocks);
        if (decision?.type === 'sell') {
          sellDecision = decision;
          break;
        }
      }

      expect(sellDecision).not.toBeNull();
      expect(sellDecision?.type).toBe('sell');
    });
  });

  describe('makeNoiseTraderDecision', () => {
    it('should make random trades', () => {
      const player = createMockVirtualPlayer({
        portfolio: {
          cash: 5000,
          holdings: [{ symbol: 'AAPL', shares: 50, avgBuyPrice: 100 }],
        },
        settings: { riskTolerance: 0, traderType: 'noise' },
      });

      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 100 })];

      // Run multiple times and collect decisions
      const decisions = [];
      for (let i = 0; i < 100; i++) {
        const decision = makeNoiseTraderDecision(player, stocks);
        if (decision) {
          decisions.push(decision);
        }
      }

      // Should make some trades (noise trader has 30% chance)
      expect(decisions.length).toBeGreaterThan(10);

      // Should have both buys and sells
      const buys = decisions.filter(d => d.type === 'buy');
      const sells = decisions.filter(d => d.type === 'sell');
      expect(buys.length).toBeGreaterThan(0);
      expect(sells.length).toBeGreaterThan(0);
    });
  });

  describe('makeContrarianDecision', () => {
    it('should consider buying oversold stocks', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'contrarian' },
      });

      // Create history with consistent losses to generate low RSI
      const history: CandleData[] = [];
      let price = 100;
      for (let i = 0; i < 20; i++) {
        price = price * 0.97;
        history.push(createMockCandle({ close: price, time: Date.now() - (20 - i) * 60000 }));
      }

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: price,
        priceHistory: history,
      })];

      // Run multiple times since there's randomness
      let buyDecision = null;
      for (let i = 0; i < 100; i++) {
        const decision = makeContrarianDecision(player, stocks);
        if (decision?.type === 'buy') {
          buyDecision = decision;
          break;
        }
      }

      // Contrarian should eventually buy oversold stock
      expect(buyDecision).not.toBeNull();
    });

    it('should consider selling overbought stocks', () => {
      // Create history with consistent gains to generate high RSI
      const history: CandleData[] = [];
      let price = 100;
      for (let i = 0; i < 20; i++) {
        price = price * 1.03;
        history.push(createMockCandle({ close: price, time: Date.now() - (20 - i) * 60000 }));
      }

      const player = createMockVirtualPlayer({
        portfolio: {
          cash: 5000,
          holdings: [{ symbol: 'AAPL', shares: 50, avgBuyPrice: 90 }],
        },
        settings: { riskTolerance: 0, traderType: 'contrarian' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: price,
        priceHistory: history,
      })];

      // Run multiple times since there's randomness
      let sellDecision = null;
      for (let i = 0; i < 100; i++) {
        const decision = makeContrarianDecision(player, stocks);
        if (decision?.type === 'sell') {
          sellDecision = decision;
          break;
        }
      }

      // Contrarian should eventually sell overbought stock
      expect(sellDecision).not.toBeNull();
    });

    it('should return null when no cash to buy oversold', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 0, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'contrarian' },
      });

      // Create oversold history
      const history: CandleData[] = [];
      let price = 100;
      for (let i = 0; i < 20; i++) {
        price = price * 0.97;
        history.push(createMockCandle({ close: price, time: Date.now() - (20 - i) * 60000 }));
      }

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: price,
        priceHistory: history,
      })];

      // Run multiple times
      let hasNonNullDecision = false;
      for (let i = 0; i < 50; i++) {
        const decision = makeContrarianDecision(player, stocks);
        if (decision !== null) {
          hasNonNullDecision = true;
          break;
        }
      }

      // Should mostly return null when no cash
      expect(hasNonNullDecision).toBe(false);
    });
  });

  describe('makeStrategyDecision', () => {
    it('should route marketMaker to makeMarketMakerDecision', () => {
      const player = createMockVirtualPlayer({
        id: 'mm-1',
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'marketMaker' },
      });

      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 100 })];
      const orderBooks = { AAPL: { symbol: 'AAPL', bids: [], asks: [] } };
      const existingOrderCounts = { AAPL: 0 };

      // Run multiple times since there's randomness
      let hasOrderBookEntries = false;
      for (let i = 0; i < 50; i++) {
        const result = makeStrategyDecision(player, stocks, orderBooks, existingOrderCounts);
        if (result.orderBookEntries && result.orderBookEntries.length > 0) {
          hasOrderBookEntries = true;
          break;
        }
      }

      expect(hasOrderBookEntries).toBe(true);
    });

    it('should route momentum to makeMomentumDecision', () => {
      const upTrendHistory = generatePriceHistory(100, 'up', 20);
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 50, traderType: 'momentum' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: upTrendHistory[upTrendHistory.length - 1].close,
        priceHistory: upTrendHistory,
      })];

      // Run multiple times
      let hasTrade = false;
      for (let i = 0; i < 100; i++) {
        const result = makeStrategyDecision(player, stocks, {}, {});
        if (result.trade) {
          hasTrade = true;
          expect(result.trade.type).toBe('buy');
          break;
        }
      }

      expect(hasTrade).toBe(true);
    });

    it('should route contrarian to makeContrarianDecision', () => {
      // Create oversold history
      const history: CandleData[] = [];
      let price = 100;
      for (let i = 0; i < 20; i++) {
        price = price * 0.97;
        history.push(createMockCandle({ close: price, time: Date.now() - (20 - i) * 60000 }));
      }

      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'contrarian' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: price,
        priceHistory: history,
      })];

      // Run multiple times
      let hasTrade = false;
      for (let i = 0; i < 100; i++) {
        const result = makeStrategyDecision(player, stocks, {}, {});
        if (result.trade) {
          hasTrade = true;
          break;
        }
      }

      expect(hasTrade).toBe(true);
    });

    it('should route fundamentalist to makeFundamentalistDecision', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'fundamentalist' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: 80,
        fairValue: 100, // Undervalued
        priceHistory: generatePriceHistory(80, 'flat', 20),
      })];

      let hasTrade = false;
      for (let i = 0; i < 100; i++) {
        const result = makeStrategyDecision(player, stocks, {}, {});
        if (result.trade) {
          hasTrade = true;
          expect(result.trade.type).toBe('buy');
          break;
        }
      }

      expect(hasTrade).toBe(true);
    });

    it('should route noise to makeNoiseTraderDecision', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'noise' },
      });

      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 100 })];

      let hasTrade = false;
      for (let i = 0; i < 100; i++) {
        const result = makeStrategyDecision(player, stocks, {}, {});
        if (result.trade) {
          hasTrade = true;
          break;
        }
      }

      expect(hasTrade).toBe(true);
    });

    it('should return empty object for balanced type', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 50, traderType: 'balanced' },
      });

      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 100 })];
      const result = makeStrategyDecision(player, stocks, {}, {});

      expect(result).toEqual({});
    });

    it('should default to balanced when traderType is undefined', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 50, traderType: undefined as unknown as TraderType },
      });

      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 100 })];
      const result = makeStrategyDecision(player, stocks, {}, {});

      expect(result).toEqual({});
    });
  });

  describe('assignTraderType - additional cases', () => {
    it('should return balanced as fallback for edge position', () => {
      // Position exactly at 1.0 (100%)
      const type = assignTraderType(100, 100);
      expect(type).toBe('balanced');
    });

    it('should assign different types across distribution', () => {
      const types: Record<TraderType, number> = {
        marketMaker: 0,
        momentum: 0,
        contrarian: 0,
        fundamentalist: 0,
        noise: 0,
        balanced: 0,
      };

      // Check all positions from 0-99 out of 100
      for (let i = 0; i < 100; i++) {
        const type = assignTraderType(i, 100);
        types[type]++;
      }

      // Each type should have at least some players
      expect(types.marketMaker).toBeGreaterThan(0);
      expect(types.momentum).toBeGreaterThan(0);
      expect(types.contrarian).toBeGreaterThan(0);
      expect(types.fundamentalist).toBeGreaterThan(0);
      expect(types.noise).toBeGreaterThan(0);
      expect(types.balanced).toBeGreaterThan(0);
    });
  });

  describe('calculateRSI - additional cases', () => {
    it('should return 100 when there are only gains', () => {
      const history: CandleData[] = [];
      let price = 100;
      for (let i = 0; i < 20; i++) {
        price = price + 1;
        history.push(createMockCandle({ close: price, time: Date.now() - (20 - i) * 60000 }));
      }

      const rsi = calculateRSI(history);
      expect(rsi).toBe(100);
    });
  });

  describe('makeFundamentalistDecision - additional cases', () => {
    it('should consider selling overvalued stocks', () => {
      const player = createMockVirtualPlayer({
        portfolio: {
          cash: 5000,
          holdings: [{ symbol: 'AAPL', shares: 50, avgBuyPrice: 90 }],
        },
        settings: { riskTolerance: 0, traderType: 'fundamentalist' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: 130,    // Current price much higher than fair value
        fairValue: 100,       // Overvalued
        priceHistory: generatePriceHistory(130, 'flat', 20),
      })];

      // Run multiple times
      let sellDecision = null;
      for (let i = 0; i < 100; i++) {
        const decision = makeFundamentalistDecision(player, stocks);
        if (decision?.type === 'sell') {
          sellDecision = decision;
          break;
        }
      }

      expect(sellDecision).not.toBeNull();
    });

    it('should return null when no stocks have fairValue', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'fundamentalist' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: 100,
        fairValue: undefined,
        priceHistory: generatePriceHistory(100, 'flat', 20),
      })];

      // Run multiple times - should always return null
      let hasDecision = false;
      for (let i = 0; i < 50; i++) {
        const decision = makeFundamentalistDecision(player, stocks);
        if (decision !== null) {
          hasDecision = true;
          break;
        }
      }

      expect(hasDecision).toBe(false);
    });

    it('should return null when no cash and stock is undervalued', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 0, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'fundamentalist' },
      });

      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: 80,
        fairValue: 100, // Undervalued but no cash
        priceHistory: generatePriceHistory(80, 'flat', 20),
      })];

      // Run multiple times
      let hasDecision = false;
      for (let i = 0; i < 50; i++) {
        const decision = makeFundamentalistDecision(player, stocks);
        if (decision !== null) {
          hasDecision = true;
          break;
        }
      }

      expect(hasDecision).toBe(false);
    });
  });

  describe('makeNoiseTraderDecision - additional cases', () => {
    it('should return null when no affordable stocks for buy', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'noise', strategyParams: { tradeFrequency: 1.0 } },
      });

      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 100 })]; // Too expensive

      // Run multiple times - buy decisions should fail
      let hasBuyDecision = false;
      for (let i = 0; i < 50; i++) {
        const decision = makeNoiseTraderDecision(player, stocks);
        if (decision?.type === 'buy') {
          hasBuyDecision = true;
          break;
        }
      }

      expect(hasBuyDecision).toBe(false);
    });

    it('should return null when no holdings for sell and no cash for buy', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 0, holdings: [] },
        settings: { riskTolerance: 0, traderType: 'noise' },
      });

      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 100 })];

      // Run multiple times
      let hasDecision = false;
      for (let i = 0; i < 30; i++) {
        const decision = makeNoiseTraderDecision(player, stocks);
        if (decision !== null) {
          hasDecision = true;
          break;
        }
      }

      expect(hasDecision).toBe(false);
    });

    it('should handle case when stock not found for sell', () => {
      const player = createMockVirtualPlayer({
        portfolio: {
          cash: 0,
          holdings: [{ symbol: 'MSFT', shares: 50, avgBuyPrice: 100 }],
        },
        settings: { riskTolerance: 0, traderType: 'noise', strategyParams: { tradeFrequency: 1.0 } },
      });

      // Stock in holdings not in available stocks
      const stocks = [createMockStock({ symbol: 'AAPL', currentPrice: 100 })];

      // Run multiple times - sell should fail since stock not in list
      let hasSellDecision = false;
      for (let i = 0; i < 50; i++) {
        const decision = makeNoiseTraderDecision(player, stocks);
        if (decision?.type === 'sell') {
          hasSellDecision = true;
          break;
        }
      }

      expect(hasSellDecision).toBe(false);
    });
  });

  describe('makeMomentumDecision - additional cases', () => {
    it('should return null when no trending stocks', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 50, traderType: 'momentum' },
      });

      const flatHistory = generatePriceHistory(100, 'flat', 20);
      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: 100,
        priceHistory: flatHistory,
      })];

      // Run multiple times
      let hasDecision = false;
      for (let i = 0; i < 50; i++) {
        const decision = makeMomentumDecision(player, stocks);
        if (decision !== null) {
          hasDecision = true;
          break;
        }
      }

      expect(hasDecision).toBe(false);
    });

    it('should return null when downtrend but no holdings', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 10000, holdings: [] },
        settings: { riskTolerance: 50, traderType: 'momentum' },
      });

      const downTrendHistory = generatePriceHistory(100, 'down', 20);
      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: downTrendHistory[downTrendHistory.length - 1].close,
        priceHistory: downTrendHistory,
      })];

      // Run multiple times - downtrend would trigger sell but no holdings
      let hasDecision = false;
      for (let i = 0; i < 50; i++) {
        const decision = makeMomentumDecision(player, stocks);
        if (decision !== null) {
          hasDecision = true;
          break;
        }
      }

      expect(hasDecision).toBe(false);
    });

    it('should return null when uptrend but no cash', () => {
      const player = createMockVirtualPlayer({
        portfolio: { cash: 0, holdings: [] },
        settings: { riskTolerance: 50, traderType: 'momentum' },
      });

      const upTrendHistory = generatePriceHistory(100, 'up', 20);
      const stocks = [createMockStock({
        symbol: 'AAPL',
        currentPrice: upTrendHistory[upTrendHistory.length - 1].close,
        priceHistory: upTrendHistory,
      })];

      // Run multiple times - uptrend would trigger buy but no cash
      let hasDecision = false;
      for (let i = 0; i < 50; i++) {
        const decision = makeMomentumDecision(player, stocks);
        if (decision !== null) {
          hasDecision = true;
          break;
        }
      }

      expect(hasDecision).toBe(false);
    });
  });
});
