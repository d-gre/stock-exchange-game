import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import stocksReducer, { updatePrices, applyTrade, applyStockSplit, applySilentStockSplits, checkAndApplyStockSplits } from './stocksSlice';
import portfolioReducer from './portfolioSlice';
import pendingOrdersReducer from './pendingOrdersSlice';
import notificationsReducer from './notificationsSlice';
import type { Stock } from '../types';

describe('stocksSlice', () => {
  describe('updatePrices', () => {
    it('should generate new candles for all stocks', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 100,
            change: 0,
            changePercent: 0,
            priceHistory: [
              { time: 1000, open: 98, high: 101, low: 97, close: 100 },
            ],
            marketCapBillions: 3000,
          },
        ],
      };

      const newState = stocksReducer(initialState, updatePrices());

      expect(newState.items[0].priceHistory.length).toBe(2);
      expect(newState.items[0].priceHistory[1].open).toBe(100);
    });

    it('should update currentPrice to the new candle close', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 100,
            change: 0,
            changePercent: 0,
            priceHistory: [
              { time: 1000, open: 98, high: 101, low: 97, close: 100 },
            ],
            marketCapBillions: 3000,
          },
        ],
      };

      const newState = stocksReducer(initialState, updatePrices());

      expect(newState.items[0].currentPrice).toBe(newState.items[0].priceHistory[1].close);
    });
  });

  describe('applyTrade', () => {
    it('should increase price on buy', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 100,
            change: 0,
            changePercent: 0,
            priceHistory: [
              { time: 1000, open: 98, high: 101, low: 97, close: 100 },
            ],
            marketCapBillions: 3000,
          },
        ],
      };

      const newState = stocksReducer(
        initialState,
        applyTrade({ symbol: 'AAPL', type: 'buy', shares: 10 })
      );

      expect(newState.items[0].currentPrice).toBeGreaterThan(100);
    });

    it('should decrease price on sell', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 100,
            change: 0,
            changePercent: 0,
            priceHistory: [
              { time: 1000, open: 98, high: 101, low: 97, close: 100 },
            ],
            marketCapBillions: 3000,
          },
        ],
      };

      const newState = stocksReducer(
        initialState,
        applyTrade({ symbol: 'AAPL', type: 'sell', shares: 10 })
      );

      expect(newState.items[0].currentPrice).toBeLessThan(100);
    });

    it('should not affect other stocks', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 100,
            change: 0,
            changePercent: 0,
            priceHistory: [
              { time: 1000, open: 98, high: 101, low: 97, close: 100 },
            ],
            marketCapBillions: 3000,
          },
          {
            symbol: 'GOOGL',
            name: 'Alphabet Inc.',
            currentPrice: 200,
            change: 0,
            changePercent: 0,
            priceHistory: [
              { time: 1000, open: 198, high: 201, low: 197, close: 200 },
            ],
            marketCapBillions: 2000,
          },
        ],
      };

      const newState = stocksReducer(
        initialState,
        applyTrade({ symbol: 'AAPL', type: 'buy', shares: 10 })
      );

      expect(newState.items[1].currentPrice).toBe(200);
    });
  });

  describe('applyStockSplit', () => {
    it('should divide currentPrice by split ratio', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 900,
            change: 30,
            changePercent: 3.45,
            priceHistory: [
              { time: 1000, open: 870, high: 910, low: 860, close: 900 },
            ],
            marketCapBillions: 3000,
          },
        ],
      };

      const newState = stocksReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.items[0].currentPrice).toBe(300);
    });

    it('should divide change by split ratio', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 900,
            change: 30,
            changePercent: 3.45,
            priceHistory: [
              { time: 1000, open: 870, high: 910, low: 860, close: 900 },
            ],
            marketCapBillions: 3000,
          },
        ],
      };

      const newState = stocksReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.items[0].change).toBe(10);
    });

    it('should divide all priceHistory OHLC values by split ratio', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 900,
            change: 30,
            changePercent: 3.45,
            priceHistory: [
              { time: 1000, open: 870, high: 910, low: 860, close: 900 },
              { time: 2000, open: 900, high: 920, low: 890, close: 910 },
            ],
            marketCapBillions: 3000,
          },
        ],
      };

      const newState = stocksReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.items[0].priceHistory[0].open).toBe(290);
      expect(newState.items[0].priceHistory[0].high).toBeCloseTo(303.33, 1);
      expect(newState.items[0].priceHistory[0].low).toBeCloseTo(286.67, 1);
      expect(newState.items[0].priceHistory[0].close).toBe(300);
      expect(newState.items[0].priceHistory[1].open).toBe(300);
    });

    it('should not affect other stocks', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 900,
            change: 30,
            changePercent: 3.45,
            priceHistory: [
              { time: 1000, open: 870, high: 910, low: 860, close: 900 },
            ],
            marketCapBillions: 3000,
          },
          {
            symbol: 'GOOGL',
            name: 'Alphabet Inc.',
            currentPrice: 800,
            change: 20,
            changePercent: 2.56,
            priceHistory: [
              { time: 1000, open: 780, high: 810, low: 775, close: 800 },
            ],
            marketCapBillions: 2000,
          },
        ],
      };

      const newState = stocksReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.items[0].currentPrice).toBe(300);
      expect(newState.items[1].currentPrice).toBe(800);
      expect(newState.items[1].priceHistory[0].close).toBe(800);
    });

    it('should preserve changePercent', () => {
      const initialState = {
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            currentPrice: 900,
            change: 30,
            changePercent: 3.45,
            priceHistory: [
              { time: 1000, open: 870, high: 910, low: 860, close: 900 },
            ],
            marketCapBillions: 3000,
          },
        ],
      };

      const newState = stocksReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.items[0].changePercent).toBe(3.45);
    });
  });

  describe('applySilentStockSplits', () => {
    const createMockStock = (symbol: string, price: number): Stock => ({
      symbol,
      name: `${symbol} Inc.`,
      currentPrice: price,
      change: 0,
      changePercent: 0,
      priceHistory: [{ time: 1000, open: price * 0.99, high: price * 1.01, low: price * 0.98, close: price }],
      marketCapBillions: 100,
    });

    const createTestStore = (stocks: Stock[]) =>
      configureStore({
        reducer: {
          stocks: stocksReducer,
          portfolio: portfolioReducer,
          pendingOrders: pendingOrdersReducer,
          notifications: notificationsReducer,
        },
        preloadedState: {
          stocks: { items: stocks },
        },
      });

    it('should split stocks above threshold without notifications', () => {
      const stocks = [
        createMockStock('HIGH', 800), // Above 750 threshold
        createMockStock('LOW', 100),  // Below threshold
      ];
      const store = createTestStore(stocks);

      const splitSymbols = store.dispatch(applySilentStockSplits() as unknown as Parameters<typeof store.dispatch>[0]) as unknown as string[];

      expect(splitSymbols).toContain('HIGH');
      expect(splitSymbols).not.toContain('LOW');

      const state = store.getState();
      // HIGH should be split (800 / 3 ≈ 266.67)
      expect(state.stocks.items.find(s => s.symbol === 'HIGH')?.currentPrice).toBeLessThan(300);
      // LOW should be unchanged
      expect(state.stocks.items.find(s => s.symbol === 'LOW')?.currentPrice).toBe(100);
      // No notifications should be added
      expect(state.notifications.items).toHaveLength(0);
    });

    it('should not create notifications (silent split)', () => {
      const stocks = [createMockStock('EXPENSIVE', 1000)];
      const store = createTestStore(stocks);

      store.dispatch(applySilentStockSplits() as unknown as Parameters<typeof store.dispatch>[0]);

      const state = store.getState();
      expect(state.notifications.items).toHaveLength(0);
    });

    it('should split multiple stocks above threshold', () => {
      const stocks = [
        createMockStock('HIGH1', 800),
        createMockStock('HIGH2', 900),
        createMockStock('LOW', 100),
      ];
      const store = createTestStore(stocks);

      const splitSymbols = store.dispatch(applySilentStockSplits() as unknown as Parameters<typeof store.dispatch>[0]) as unknown as string[];

      expect(splitSymbols).toHaveLength(2);
      expect(splitSymbols).toContain('HIGH1');
      expect(splitSymbols).toContain('HIGH2');
    });

    it('should return empty array when no stocks need splitting', () => {
      const stocks = [
        createMockStock('LOW1', 100),
        createMockStock('LOW2', 200),
      ];
      const store = createTestStore(stocks);

      const splitSymbols = store.dispatch(applySilentStockSplits() as unknown as Parameters<typeof store.dispatch>[0]) as unknown as string[];

      expect(splitSymbols).toHaveLength(0);
    });
  });

  describe('checkAndApplyStockSplits', () => {
    const createMockStock = (symbol: string, price: number): Stock => ({
      symbol,
      name: `${symbol} Inc.`,
      currentPrice: price,
      change: 0,
      changePercent: 0,
      priceHistory: [{ time: 1000, open: price * 0.99, high: price * 1.01, low: price * 0.98, close: price }],
      marketCapBillions: 100,
    });

    interface TestStoreOptions {
      stocks: Stock[];
      holdings?: { symbol: string; shares: number; avgBuyPrice: number }[];
      pendingOrders?: { id: string; symbol: string; type: 'buy' | 'sell'; shares: number; orderType: 'market'; orderPrice: number; remainingCycles: number; timestamp: number }[];
    }

    const createTestStore = ({ stocks, holdings = [], pendingOrders = [] }: TestStoreOptions) =>
      configureStore({
        reducer: {
          stocks: stocksReducer,
          portfolio: portfolioReducer,
          pendingOrders: pendingOrdersReducer,
          notifications: notificationsReducer,
        },
        preloadedState: {
          stocks: { items: stocks },
          portfolio: { cash: 10000, holdings },
          pendingOrders: { orders: pendingOrders, tradedSymbolsThisCycle: [] },
        },
      });

    it('should NOT create notification when player does not own stock and has no pending orders', () => {
      const stocks = [createMockStock('EXPENSIVE', 800)];
      const store = createTestStore({ stocks });

      store.dispatch(checkAndApplyStockSplits() as unknown as Parameters<typeof store.dispatch>[0]);

      const state = store.getState();
      // Stock should still be split
      expect(state.stocks.items[0].currentPrice).toBeLessThan(300);
      // But no notification
      expect(state.notifications.items).toHaveLength(0);
    });

    it('should create notification when player owns the stock', () => {
      const stocks = [createMockStock('EXPENSIVE', 800)];
      const holdings = [{ symbol: 'EXPENSIVE', shares: 10, avgBuyPrice: 500 }];
      const store = createTestStore({ stocks, holdings });

      store.dispatch(checkAndApplyStockSplits() as unknown as Parameters<typeof store.dispatch>[0]);

      const state = store.getState();
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].title).toContain('EXPENSIVE');
    });

    it('should create notification when player has pending order for the stock', () => {
      const stocks = [createMockStock('EXPENSIVE', 800)];
      const pendingOrders = [{
        id: 'order-1',
        symbol: 'EXPENSIVE',
        type: 'buy' as const,
        shares: 5,
        orderType: 'market' as const,
        orderPrice: 800,
        remainingCycles: 1,
        timestamp: Date.now(),
      }];
      const store = createTestStore({ stocks, pendingOrders });

      store.dispatch(checkAndApplyStockSplits() as unknown as Parameters<typeof store.dispatch>[0]);

      const state = store.getState();
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].title).toContain('EXPENSIVE');
    });

    it('should split stock and return symbol even without notification', () => {
      const stocks = [createMockStock('HIGH', 900)];
      const store = createTestStore({ stocks });

      const splitSymbols = store.dispatch(checkAndApplyStockSplits() as unknown as Parameters<typeof store.dispatch>[0]) as unknown as string[];

      expect(splitSymbols).toContain('HIGH');

      const state = store.getState();
      expect(state.stocks.items[0].currentPrice).toBe(300); // 900 / 3
      // No notification since player doesn't own the stock
      expect(state.notifications.items).toHaveLength(0);
    });

    it('should only notify for owned stocks when multiple stocks are split', () => {
      const stocks = [
        createMockStock('OWNED', 800),
        createMockStock('NOT_OWNED', 900),
      ];
      const holdings = [{ symbol: 'OWNED', shares: 5, avgBuyPrice: 400 }];
      const store = createTestStore({ stocks, holdings });

      const splitSymbols = store.dispatch(checkAndApplyStockSplits() as unknown as Parameters<typeof store.dispatch>[0]) as unknown as string[];

      // Both should be split
      expect(splitSymbols).toHaveLength(2);
      expect(splitSymbols).toContain('OWNED');
      expect(splitSymbols).toContain('NOT_OWNED');

      const state = store.getState();
      // Only one notification for the owned stock
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].title).toContain('OWNED');
    });
  });
});
