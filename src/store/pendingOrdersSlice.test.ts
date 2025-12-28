import { describe, it, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import pendingOrdersReducer, {
  addPendingOrder,
  processPendingOrders,
  tickOrderCycles,
  cancelOrder,
  clearAllOrders,
  markSymbolAsTraded,
  resetTradedSymbols,
  executePendingOrders,
  selectReservedCash,
  selectReservedSharesBySymbol,
  canExecuteOrder,
  shouldTriggerStop,
  triggerStopOrder,
  getAvailableFunds,
  applyStockSplitToOrders,
} from './pendingOrdersSlice';
import stocksReducer from './stocksSlice';
import portfolioReducer from './portfolioSlice';
import settingsReducer from './settingsSlice';
import notificationsReducer from './notificationsSlice';
import tradeHistoryReducer from './tradeHistorySlice';
import type { PendingOrder, Stock, OrderType } from '../types';

// Mock for uuid
vi.mock('crypto', () => ({
  randomUUID: () => 'test-uuid-123',
}));

/** Helper: Creates a mock order with default values */
const createMockOrder = (overrides: Partial<PendingOrder> = {}): PendingOrder => ({
  id: 'test-id',
  symbol: 'AAPL',
  type: 'buy',
  shares: 10,
  orderType: 'market',
  orderPrice: 100,
  remainingCycles: 1,
  timestamp: Date.now(),
  stopTriggered: false,
  ...overrides,
});

describe('pendingOrdersSlice', () => {
  const initialState = {
    orders: [] as PendingOrder[],
    tradedSymbolsThisCycle: [] as string[],
  };

  describe('addPendingOrder', () => {
    it('should add a new market order', () => {
      const order = {
        symbol: 'AAPL',
        type: 'buy' as const,
        shares: 10,
        orderType: 'market' as OrderType,
        orderPrice: 100,
        validityCycles: 0,
      };

      const newState = pendingOrdersReducer(initialState, addPendingOrder(order));

      expect(newState.orders).toHaveLength(1);
      expect(newState.orders[0].symbol).toBe('AAPL');
      expect(newState.orders[0].type).toBe('buy');
      expect(newState.orders[0].shares).toBe(10);
      expect(newState.orders[0].orderType).toBe('market');
      expect(newState.orders[0].orderPrice).toBe(100);
      expect(newState.orders[0].remainingCycles).toBe(0);
      expect(newState.orders[0].id).toBeDefined();
      expect(newState.orders[0].timestamp).toBeDefined();
    });

    it('should add a limit order with limit price', () => {
      const order = {
        symbol: 'AAPL',
        type: 'buy' as const,
        shares: 10,
        orderType: 'limit' as OrderType,
        orderPrice: 100,
        limitPrice: 95,
        validityCycles: 5,
      };

      const newState = pendingOrdersReducer(initialState, addPendingOrder(order));

      expect(newState.orders[0].orderType).toBe('limit');
      expect(newState.orders[0].limitPrice).toBe(95);
      expect(newState.orders[0].remainingCycles).toBe(5);
    });

    it('should add a stop order with stop price', () => {
      const order = {
        symbol: 'AAPL',
        type: 'sell' as const,
        shares: 10,
        orderType: 'stopBuy' as OrderType,
        orderPrice: 100,
        stopPrice: 90,
        validityCycles: 10,
      };

      const newState = pendingOrdersReducer(initialState, addPendingOrder(order));

      expect(newState.orders[0].orderType).toBe('stopBuy');
      expect(newState.orders[0].stopPrice).toBe(90);
    });

    it('should add a stop-limit order with both prices', () => {
      const order = {
        symbol: 'AAPL',
        type: 'buy' as const,
        shares: 10,
        orderType: 'stopBuyLimit' as OrderType,
        orderPrice: 100,
        stopPrice: 105,
        limitPrice: 110,
        validityCycles: 5,
      };

      const newState = pendingOrdersReducer(initialState, addPendingOrder(order));

      expect(newState.orders[0].orderType).toBe('stopBuyLimit');
      expect(newState.orders[0].stopPrice).toBe(105);
      expect(newState.orders[0].limitPrice).toBe(110);
      expect(newState.orders[0].stopTriggered).toBe(false);
    });

    it('should add multiple orders', () => {
      let state = initialState;

      state = pendingOrdersReducer(state, addPendingOrder({
        symbol: 'AAPL',
        type: 'buy',
        shares: 10,
        orderType: 'market',
        orderPrice: 100,
        validityCycles: 0,
      }));

      state = pendingOrdersReducer(state, addPendingOrder({
        symbol: 'GOOGL',
        type: 'sell',
        shares: 5,
        orderType: 'limit',
        orderPrice: 150,
        limitPrice: 160,
        validityCycles: 5,
      }));

      expect(state.orders).toHaveLength(2);
    });
  });

  describe('triggerStopOrder', () => {
    it('should set stopTriggered to true', () => {
      const stateWithOrder = {
        orders: [createMockOrder({ id: '1', orderType: 'stopBuyLimit', stopTriggered: false })],
        tradedSymbolsThisCycle: [],
      };

      const result = pendingOrdersReducer(stateWithOrder, triggerStopOrder('1'));

      expect(result.orders[0].stopTriggered).toBe(true);
    });
  });

  describe('tickOrderCycles', () => {
    it('should decrement remaining cycles for non-market orders', () => {
      const stateWithOrder = {
        orders: [createMockOrder({ id: '1', orderType: 'limit', remainingCycles: 5 })],
        tradedSymbolsThisCycle: [],
      };

      const result = pendingOrdersReducer(stateWithOrder, tickOrderCycles());

      expect(result.orders[0].remainingCycles).toBe(4);
    });

    it('should not decrement cycles for market orders', () => {
      const stateWithOrder = {
        orders: [createMockOrder({ id: '1', orderType: 'market', remainingCycles: 0 })],
        tradedSymbolsThisCycle: [],
      };

      const result = pendingOrdersReducer(stateWithOrder, tickOrderCycles());

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].remainingCycles).toBe(0);
    });

    it('should remove expired orders (remainingCycles < 0)', () => {
      const stateWithOrders = {
        orders: [
          createMockOrder({ id: '1', orderType: 'limit', remainingCycles: 0 }),
          createMockOrder({ id: '2', orderType: 'limit', remainingCycles: 2 }),
        ],
        tradedSymbolsThisCycle: [],
      };

      const result = pendingOrdersReducer(stateWithOrders, tickOrderCycles());

      // Order 1 should be removed (became -1)
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].id).toBe('2');
      expect(result.orders[0].remainingCycles).toBe(1);
    });
  });

  describe('processPendingOrders (deprecated)', () => {
    it('should decrement remaining cycles', () => {
      const stateWithOrder = {
        orders: [createMockOrder({ id: '1', remainingCycles: 2 })],
        tradedSymbolsThisCycle: [],
      };

      const result = pendingOrdersReducer(stateWithOrder, processPendingOrders());

      expect(result.orders[0].remainingCycles).toBe(1);
    });
  });

  describe('cancelOrder', () => {
    it('should remove a specific order by id', () => {
      const stateWithOrders = {
        orders: [
          createMockOrder({ id: '1', symbol: 'AAPL' }),
          createMockOrder({ id: '2', symbol: 'GOOGL', type: 'sell' }),
        ],
        tradedSymbolsThisCycle: [],
      };

      const result = pendingOrdersReducer(stateWithOrders, cancelOrder('1'));

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].id).toBe('2');
    });

    it('should remove symbol from tradedSymbolsThisCycle when order is cancelled', () => {
      const stateWithOrders = {
        orders: [createMockOrder({ id: '1', symbol: 'AAPL' })],
        tradedSymbolsThisCycle: ['AAPL'],
      };

      const result = pendingOrdersReducer(stateWithOrders, cancelOrder('1'));

      expect(result.orders).toHaveLength(0);
      expect(result.tradedSymbolsThisCycle).not.toContain('AAPL');
    });

    it('should not remove symbol if other orders for same symbol exist', () => {
      const stateWithOrders = {
        orders: [
          createMockOrder({ id: '1', symbol: 'AAPL' }),
          createMockOrder({ id: '2', symbol: 'AAPL', type: 'sell' }),
        ],
        tradedSymbolsThisCycle: ['AAPL'],
      };

      const result = pendingOrdersReducer(stateWithOrders, cancelOrder('1'));

      expect(result.orders).toHaveLength(1);
      expect(result.tradedSymbolsThisCycle).toContain('AAPL');
    });
  });

  describe('clearAllOrders', () => {
    it('should remove all orders', () => {
      const stateWithOrders = {
        orders: [
          createMockOrder({ id: '1' }),
          createMockOrder({ id: '2' }),
        ],
        tradedSymbolsThisCycle: [],
      };

      const result = pendingOrdersReducer(stateWithOrders, clearAllOrders());

      expect(result.orders).toHaveLength(0);
    });
  });

  describe('markSymbolAsTraded', () => {
    it('should add a symbol to tradedSymbolsThisCycle', () => {
      const result = pendingOrdersReducer(initialState, markSymbolAsTraded('AAPL'));

      expect(result.tradedSymbolsThisCycle).toContain('AAPL');
    });

    it('should not add duplicate symbols', () => {
      let state = pendingOrdersReducer(initialState, markSymbolAsTraded('AAPL'));
      state = pendingOrdersReducer(state, markSymbolAsTraded('AAPL'));

      expect(state.tradedSymbolsThisCycle).toHaveLength(1);
    });
  });

  describe('resetTradedSymbols', () => {
    it('should clear all traded symbols', () => {
      let state = pendingOrdersReducer(initialState, markSymbolAsTraded('AAPL'));
      state = pendingOrdersReducer(state, markSymbolAsTraded('GOOGL'));
      state = pendingOrdersReducer(state, resetTradedSymbols());

      expect(state.tradedSymbolsThisCycle).toHaveLength(0);
    });
  });

  describe('canExecuteOrder', () => {
    it('should always return true for market orders', () => {
      const order = createMockOrder({ orderType: 'market' });
      expect(canExecuteOrder(order, 100)).toBe(true);
      expect(canExecuteOrder(order, 50)).toBe(true);
      expect(canExecuteOrder(order, 200)).toBe(true);
    });

    describe('limit orders', () => {
      it('should execute limit buy when price <= limit', () => {
        const order = createMockOrder({ type: 'buy', orderType: 'limit', limitPrice: 100 });
        expect(canExecuteOrder(order, 99)).toBe(true);
        expect(canExecuteOrder(order, 100)).toBe(true);
        expect(canExecuteOrder(order, 101)).toBe(false);
      });

      it('should execute limit sell when price >= limit', () => {
        const order = createMockOrder({ type: 'sell', orderType: 'limit', limitPrice: 100 });
        expect(canExecuteOrder(order, 101)).toBe(true);
        expect(canExecuteOrder(order, 100)).toBe(true);
        expect(canExecuteOrder(order, 99)).toBe(false);
      });
    });

    describe('stop orders', () => {
      it('should execute stop buy when price >= stop', () => {
        const order = createMockOrder({ type: 'buy', orderType: 'stopBuy', stopPrice: 100 });
        expect(canExecuteOrder(order, 101)).toBe(true);
        expect(canExecuteOrder(order, 100)).toBe(true);
        expect(canExecuteOrder(order, 99)).toBe(false);
      });

      it('should execute stop loss (sell) when price <= stop', () => {
        const order = createMockOrder({ type: 'sell', orderType: 'stopBuy', stopPrice: 100 });
        expect(canExecuteOrder(order, 99)).toBe(true);
        expect(canExecuteOrder(order, 100)).toBe(true);
        expect(canExecuteOrder(order, 101)).toBe(false);
      });
    });

    describe('stop-limit orders', () => {
      it('should not execute if stop not triggered', () => {
        const order = createMockOrder({
          type: 'buy',
          orderType: 'stopBuyLimit',
          stopPrice: 100,
          limitPrice: 105,
          stopTriggered: false,
        });
        expect(canExecuteOrder(order, 110)).toBe(false);
      });

      it('should check limit after stop is triggered (buy)', () => {
        const order = createMockOrder({
          type: 'buy',
          orderType: 'stopBuyLimit',
          stopPrice: 100,
          limitPrice: 105,
          stopTriggered: true,
        });
        expect(canExecuteOrder(order, 104)).toBe(true);
        expect(canExecuteOrder(order, 105)).toBe(true);
        expect(canExecuteOrder(order, 106)).toBe(false);
      });

      it('should check limit after stop is triggered (sell)', () => {
        const order = createMockOrder({
          type: 'sell',
          orderType: 'stopBuyLimit',
          stopPrice: 100,
          limitPrice: 95,
          stopTriggered: true,
        });
        expect(canExecuteOrder(order, 96)).toBe(true);
        expect(canExecuteOrder(order, 95)).toBe(true);
        expect(canExecuteOrder(order, 94)).toBe(false);
      });
    });
  });

  describe('shouldTriggerStop', () => {
    it('should return false for non stopBuyLimit orders', () => {
      const marketOrder = createMockOrder({ orderType: 'market' });
      const limitOrder = createMockOrder({ orderType: 'limit' });
      const stopOrder = createMockOrder({ orderType: 'stopBuy' });

      expect(shouldTriggerStop(marketOrder, 100)).toBe(false);
      expect(shouldTriggerStop(limitOrder, 100)).toBe(false);
      expect(shouldTriggerStop(stopOrder, 100)).toBe(false);
    });

    it('should return false if already triggered', () => {
      const order = createMockOrder({
        orderType: 'stopBuyLimit',
        stopPrice: 100,
        stopTriggered: true,
      });
      expect(shouldTriggerStop(order, 110)).toBe(false);
    });

    it('should trigger stop buy limit when price >= stop', () => {
      const order = createMockOrder({
        type: 'buy',
        orderType: 'stopBuyLimit',
        stopPrice: 100,
        stopTriggered: false,
      });
      expect(shouldTriggerStop(order, 99)).toBe(false);
      expect(shouldTriggerStop(order, 100)).toBe(true);
      expect(shouldTriggerStop(order, 101)).toBe(true);
    });

    it('should trigger stop loss limit when price <= stop', () => {
      const order = createMockOrder({
        type: 'sell',
        orderType: 'stopBuyLimit',
        stopPrice: 100,
        stopTriggered: false,
      });
      expect(shouldTriggerStop(order, 101)).toBe(false);
      expect(shouldTriggerStop(order, 100)).toBe(true);
      expect(shouldTriggerStop(order, 99)).toBe(true);
    });
  });

  describe('executePendingOrders thunk', () => {
    const createTestStock = (symbol: string, price: number): Stock => ({
      symbol,
      name: `${symbol} Inc`,
      currentPrice: price,
      priceHistory: [{ time: Date.now(), open: price, high: price, low: price, close: price }],
      change: 0,
      changePercent: 0,
      marketCapBillions: 100,
    });

    const createTestStore = (options: {
      pendingOrders?: PendingOrder[];
      stocks?: Stock[];
      cash?: number;
      holdings?: { symbol: string; shares: number; avgBuyPrice: number }[];
    } = {}) => {
      return configureStore({
        reducer: {
          pendingOrders: pendingOrdersReducer,
          stocks: stocksReducer,
          portfolio: portfolioReducer,
          settings: settingsReducer,
          notifications: notificationsReducer,
          tradeHistory: tradeHistoryReducer,
        },
        preloadedState: {
          pendingOrders: {
            orders: options.pendingOrders || [],
            tradedSymbolsThisCycle: [],
          },
          stocks: {
            items: options.stocks || [createTestStock('AAPL', 100)],
          },
          portfolio: {
            cash: options.cash ?? 10000,
            holdings: options.holdings || [],
          },
          settings: {
            updateInterval: 10,
            countdown: 10,
            isPaused: false,
            virtualPlayerCount: 5,
            gameMode: 'sandbox' as const,
            speedMultiplier: 1 as const,
            language: 'de' as const,
            initialCash: 100000,
          },
          notifications: {
            items: [],
          },
          tradeHistory: {
            trades: [],
            portfolioValueHistory: [],
          },
        },
      });
    };

    it('should execute market buy orders immediately', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 5,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 0,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.pendingOrders.orders).toHaveLength(0);
      expect(state.portfolio.holdings).toHaveLength(1);
      expect(state.portfolio.holdings[0].shares).toBe(5);
    });

    it('should execute limit buy when price is at or below limit', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 5,
          orderType: 'limit',
          limitPrice: 100,
          orderPrice: 100,
          remainingCycles: 5,
        })],
        stocks: [createTestStock('AAPL', 95)], // Price below limit
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.pendingOrders.orders).toHaveLength(0);
      expect(state.portfolio.holdings).toHaveLength(1);
    });

    it('should not execute limit buy when price is above limit', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 5,
          orderType: 'limit',
          limitPrice: 100,
          orderPrice: 100,
          remainingCycles: 5,
        })],
        stocks: [createTestStock('AAPL', 105)], // Price above limit
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.pendingOrders.orders).toHaveLength(1);
      expect(state.pendingOrders.orders[0].remainingCycles).toBe(4);
      expect(state.portfolio.holdings).toHaveLength(0);
    });

    it('should execute stop loss when price falls to stop', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'sell',
          shares: 5,
          orderType: 'stopBuy',
          stopPrice: 90,
          orderPrice: 100,
          remainingCycles: 10,
        })],
        stocks: [createTestStock('AAPL', 85)], // Price below stop
        cash: 5000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 100 }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.pendingOrders.orders).toHaveLength(0);
      expect(state.portfolio.holdings[0].shares).toBe(5);
    });

    it('should trigger stop-limit and wait for limit price', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 5,
          orderType: 'stopBuyLimit',
          stopPrice: 105,
          limitPrice: 110,
          orderPrice: 100,
          remainingCycles: 10,
          stopTriggered: false,
        })],
        stocks: [createTestStock('AAPL', 107)], // Above stop, but below limit for buy
        cash: 10000,
      });

      // First dispatch: should trigger the stop
      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      let state = store.getState();
      expect(state.pendingOrders.orders).toHaveLength(1);
      expect(state.pendingOrders.orders[0].stopTriggered).toBe(true);
      expect(state.portfolio.holdings).toHaveLength(0);

      // Second dispatch: should execute since price is at limit
      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      state = store.getState();
      expect(state.pendingOrders.orders).toHaveLength(0);
      expect(state.portfolio.holdings).toHaveLength(1);
    });

    it('should remove expired orders', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 5,
          orderType: 'limit',
          limitPrice: 50, // Price never reaches this
          orderPrice: 100,
          remainingCycles: 0, // Will expire after tick
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should be removed (expired)
      expect(state.pendingOrders.orders).toHaveLength(0);
      expect(state.portfolio.holdings).toHaveLength(0);
    });
  });

  describe('selectReservedCash', () => {
    it('should return 0 when there are no orders', () => {
      const state = { pendingOrders: { orders: [], tradedSymbolsThisCycle: [] } };
      expect(selectReservedCash(state)).toBe(0);
    });

    it('should use limitPrice for limit orders', () => {
      const state = {
        pendingOrders: {
          orders: [createMockOrder({
            type: 'buy',
            shares: 10,
            orderType: 'limit',
            orderPrice: 100,
            limitPrice: 95, // Should use this
          })],
          tradedSymbolsThisCycle: [],
        },
      };

      expect(selectReservedCash(state)).toBe(950); // 10 * 95
    });

    it('should use orderPrice for market orders', () => {
      const state = {
        pendingOrders: {
          orders: [createMockOrder({
            type: 'buy',
            shares: 10,
            orderType: 'market',
            orderPrice: 100,
          })],
          tradedSymbolsThisCycle: [],
        },
      };

      expect(selectReservedCash(state)).toBe(1000); // 10 * 100
    });

    it('should sum multiple buy orders', () => {
      const state = {
        pendingOrders: {
          orders: [
            createMockOrder({ id: '1', type: 'buy', shares: 10, orderPrice: 100 }),
            createMockOrder({ id: '2', type: 'buy', shares: 5, orderPrice: 200 }),
          ],
          tradedSymbolsThisCycle: [],
        },
      };

      expect(selectReservedCash(state)).toBe(2000); // 10*100 + 5*200
    });

    it('should ignore sell orders', () => {
      const state = {
        pendingOrders: {
          orders: [
            createMockOrder({ id: '1', type: 'buy', shares: 10, orderPrice: 100 }),
            createMockOrder({ id: '2', type: 'sell', shares: 20, orderPrice: 150 }),
          ],
          tradedSymbolsThisCycle: [],
        },
      };

      expect(selectReservedCash(state)).toBe(1000);
    });
  });

  describe('selectReservedSharesBySymbol', () => {
    it('should return 0 when there are no orders', () => {
      const state = { pendingOrders: { orders: [], tradedSymbolsThisCycle: [] } };
      expect(selectReservedSharesBySymbol(state, 'AAPL')).toBe(0);
    });

    it('should calculate reserved shares for sell orders', () => {
      const state = {
        pendingOrders: {
          orders: [createMockOrder({ type: 'sell', symbol: 'AAPL', shares: 10 })],
          tradedSymbolsThisCycle: [],
        },
      };

      expect(selectReservedSharesBySymbol(state, 'AAPL')).toBe(10);
    });

    it('should only count orders for the specified symbol', () => {
      const state = {
        pendingOrders: {
          orders: [
            createMockOrder({ id: '1', type: 'sell', symbol: 'AAPL', shares: 10 }),
            createMockOrder({ id: '2', type: 'sell', symbol: 'GOOGL', shares: 20 }),
          ],
          tradedSymbolsThisCycle: [],
        },
      };

      expect(selectReservedSharesBySymbol(state, 'AAPL')).toBe(10);
      expect(selectReservedSharesBySymbol(state, 'GOOGL')).toBe(20);
    });

    it('should ignore buy orders', () => {
      const state = {
        pendingOrders: {
          orders: [
            createMockOrder({ id: '1', type: 'sell', symbol: 'AAPL', shares: 10 }),
            createMockOrder({ id: '2', type: 'buy', symbol: 'AAPL', shares: 50 }),
          ],
          tradedSymbolsThisCycle: [],
        },
      };

      expect(selectReservedSharesBySymbol(state, 'AAPL')).toBe(10);
    });
  });

  describe('getAvailableFunds', () => {
    it('should return cash when no credit limit is provided', () => {
      expect(getAvailableFunds(1000)).toBe(1000);
    });

    it('should return cash when credit limit is 0', () => {
      expect(getAvailableFunds(1000, 0)).toBe(1000);
    });

    it('should currently ignore credit limit (future feature)', () => {
      // Credit is currently not yet supported
      expect(getAvailableFunds(1000, 500)).toBe(1000);
    });
  });

  describe('executePendingOrders - insufficient funds', () => {
    const createTestStock = (symbol: string, price: number): Stock => ({
      symbol,
      name: `${symbol} Inc`,
      currentPrice: price,
      priceHistory: [{ time: Date.now(), open: price, high: price, low: price, close: price }],
      change: 0,
      changePercent: 0,
      marketCapBillions: 100,
    });

    const createTestStore = (options: {
      pendingOrders?: PendingOrder[];
      stocks?: Stock[];
      cash?: number;
      holdings?: { symbol: string; shares: number; avgBuyPrice: number }[];
    } = {}) => {
      return configureStore({
        reducer: {
          pendingOrders: pendingOrdersReducer,
          stocks: stocksReducer,
          portfolio: portfolioReducer,
          settings: settingsReducer,
          notifications: notificationsReducer,
          tradeHistory: tradeHistoryReducer,
        },
        preloadedState: {
          pendingOrders: {
            orders: options.pendingOrders || [],
            tradedSymbolsThisCycle: [],
          },
          stocks: {
            items: options.stocks || [createTestStock('AAPL', 100)],
          },
          portfolio: {
            cash: options.cash ?? 10000,
            holdings: options.holdings || [],
          },
          settings: {
            updateInterval: 10,
            countdown: 10,
            isPaused: false,
            virtualPlayerCount: 5,
            gameMode: 'sandbox' as const,
            speedMultiplier: 1 as const,
            language: 'de' as const,
            initialCash: 100000,
          },
          notifications: {
            items: [],
          },
          tradeHistory: {
            trades: [],
            portfolioValueHistory: [],
          },
        },
      });
    };

    it('should not execute buy order when insufficient funds', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 0,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 500, // Not enough for 10 shares at $100
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should still be pending
      expect(state.pendingOrders.orders).toHaveLength(1);
      expect(state.portfolio.holdings).toHaveLength(0);
      expect(state.portfolio.cash).toBe(500);
    });

    it('should generate warning notification when order fails due to insufficient funds', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 0,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 500,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].type).toBe('warning');
      expect(state.notifications.items[0].title).toBe('Kauforder nicht ausgeführt');
      expect(state.notifications.items[0].message).toContain('AAPL');
    });

    it('should execute first order and fail second when funds run out', () => {
      const store = createTestStore({
        pendingOrders: [
          createMockOrder({
            id: '1',
            symbol: 'AAPL',
            type: 'buy',
            shares: 5,
            orderType: 'market',
            orderPrice: 100,
            remainingCycles: 0,
          }),
          createMockOrder({
            id: '2',
            symbol: 'GOOGL',
            type: 'buy',
            shares: 10,
            orderType: 'market',
            orderPrice: 100,
            remainingCycles: 0,
          }),
        ],
        stocks: [
          createTestStock('AAPL', 100),
          createTestStock('GOOGL', 100),
        ],
        cash: 600, // Enough for first order (~$500), not for second (~$1000)
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // First order should be executed
      expect(state.portfolio.holdings).toHaveLength(1);
      expect(state.portfolio.holdings[0].symbol).toBe('AAPL');
      // Second order should still be pending
      expect(state.pendingOrders.orders).toHaveLength(1);
      expect(state.pendingOrders.orders[0].symbol).toBe('GOOGL');
      // Warning should have been generated
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].message).toContain('GOOGL');
    });

    it('should keep failed order pending and decrement cycles', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'limit',
          limitPrice: 100,
          orderPrice: 100,
          remainingCycles: 5,
        })],
        stocks: [createTestStock('AAPL', 95)], // Price meets limit
        cash: 500, // But not enough money
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should still be pending with decremented cycle
      expect(state.pendingOrders.orders).toHaveLength(1);
      expect(state.pendingOrders.orders[0].remainingCycles).toBe(4);
    });

    it('should execute sell order and then allow subsequent buy with proceeds', () => {
      const store = createTestStore({
        pendingOrders: [
          createMockOrder({
            id: '1',
            symbol: 'AAPL',
            type: 'sell',
            shares: 5,
            orderType: 'market',
            orderPrice: 100,
            remainingCycles: 0,
          }),
          createMockOrder({
            id: '2',
            symbol: 'GOOGL',
            type: 'buy',
            shares: 4,
            orderType: 'market',
            orderPrice: 100,
            remainingCycles: 0,
          }),
        ],
        stocks: [
          createTestStock('AAPL', 100),
          createTestStock('GOOGL', 100),
        ],
        cash: 100, // Little cash
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 80 }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Both orders should be executed
      expect(state.pendingOrders.orders).toHaveLength(0);
      // AAPL sold (5 of 10), GOOGL bought (4)
      expect(state.portfolio.holdings).toHaveLength(2);
      // No warnings
      expect(state.notifications.items).toHaveLength(0);
    });

    it('should return execution result with failed orders', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 0,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 500,
      });

      const result = store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      // The thunk now returns a result
      expect(result).toBeDefined();
    });

    it('should add failed trade to trade history', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: 'order-1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 0,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 500, // Not enough for 10 x 100 = 1000
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Failed trade should appear in history
      expect(state.tradeHistory.trades).toHaveLength(1);
      expect(state.tradeHistory.trades[0].status).toBe('failed');
      expect(state.tradeHistory.trades[0].failureReason).toBe('insufficient_funds');
      expect(state.tradeHistory.trades[0].symbol).toBe('AAPL');
    });

    it('should not create duplicate notification on subsequent cycles', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: 'order-1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'limit',
          orderPrice: 100,
          limitPrice: 100,
          remainingCycles: 5,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 500,
      });

      // First cycle - should create notification and history entry
      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      let state = store.getState();
      expect(state.notifications.items).toHaveLength(1);
      expect(state.tradeHistory.trades).toHaveLength(1);

      // Second cycle - should NOT create new notification
      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      state = store.getState();
      // Still only one notification
      expect(state.notifications.items).toHaveLength(1);
      // Still only one history entry
      expect(state.tradeHistory.trades).toHaveLength(1);
    });

    it('should handle market order with delay (Real Life mode)', () => {
      // Simulate Real Life mode: Market order with remainingCycles: 1
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: 'market-order-1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 100, // 100 shares
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1, // 1 cycle delay (Real Life)
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 5000, // Not enough for 100 x 100 = 10000 (+ spread)
      });

      // First cycle - order should be checked and fail
      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();

      // Order should still be pending
      expect(state.pendingOrders.orders).toHaveLength(1);

      // Notification should have been created
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].type).toBe('warning');
      expect(state.notifications.items[0].title).toBe('Kauforder nicht ausgeführt');

      // Trade should appear in history
      expect(state.tradeHistory.trades).toHaveLength(1);
      expect(state.tradeHistory.trades[0].status).toBe('failed');
      expect(state.tradeHistory.trades[0].failureReason).toBe('insufficient_funds');
    });
  });

  describe('applyStockSplitToOrders', () => {
    it('should multiply shares by split ratio', () => {
      const state = {
        orders: [createMockOrder({ symbol: 'AAPL', shares: 10 })],
        tradedSymbolsThisCycle: [],
      };

      const newState = pendingOrdersReducer(
        state,
        applyStockSplitToOrders({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.orders[0].shares).toBe(30);
    });

    it('should divide orderPrice by split ratio', () => {
      const state = {
        orders: [createMockOrder({ symbol: 'AAPL', orderPrice: 300 })],
        tradedSymbolsThisCycle: [],
      };

      const newState = pendingOrdersReducer(
        state,
        applyStockSplitToOrders({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.orders[0].orderPrice).toBe(100);
    });

    it('should divide limitPrice by split ratio when present', () => {
      const state = {
        orders: [createMockOrder({
          symbol: 'AAPL',
          orderType: 'limit',
          limitPrice: 300,
        })],
        tradedSymbolsThisCycle: [],
      };

      const newState = pendingOrdersReducer(
        state,
        applyStockSplitToOrders({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.orders[0].limitPrice).toBe(100);
    });

    it('should divide stopPrice by split ratio when present', () => {
      const state = {
        orders: [createMockOrder({
          symbol: 'AAPL',
          orderType: 'stopBuy',
          stopPrice: 300,
        })],
        tradedSymbolsThisCycle: [],
      };

      const newState = pendingOrdersReducer(
        state,
        applyStockSplitToOrders({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.orders[0].stopPrice).toBe(100);
    });

    it('should not affect orders for other symbols', () => {
      const state = {
        orders: [
          createMockOrder({ id: '1', symbol: 'AAPL', shares: 10, orderPrice: 300 }),
          createMockOrder({ id: '2', symbol: 'GOOGL', shares: 5, orderPrice: 200 }),
        ],
        tradedSymbolsThisCycle: [],
      };

      const newState = pendingOrdersReducer(
        state,
        applyStockSplitToOrders({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.orders[0].shares).toBe(30);
      expect(newState.orders[0].orderPrice).toBe(100);
      expect(newState.orders[1].shares).toBe(5);
      expect(newState.orders[1].orderPrice).toBe(200);
    });

    it('should handle Stop Buy Limit orders with both stop and limit prices', () => {
      const state = {
        orders: [createMockOrder({
          symbol: 'AAPL',
          orderType: 'stopBuyLimit',
          shares: 10,
          orderPrice: 300,
          stopPrice: 280,
          limitPrice: 320,
        })],
        tradedSymbolsThisCycle: [],
      };

      const newState = pendingOrdersReducer(
        state,
        applyStockSplitToOrders({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.orders[0].shares).toBe(30);
      expect(newState.orders[0].orderPrice).toBe(100);
      expect(newState.orders[0].stopPrice).toBeCloseTo(93.33, 1);
      expect(newState.orders[0].limitPrice).toBeCloseTo(106.67, 1);
    });

    it('should preserve undefined limitPrice and stopPrice', () => {
      const state = {
        orders: [createMockOrder({
          symbol: 'AAPL',
          orderType: 'market',
          limitPrice: undefined,
          stopPrice: undefined,
        })],
        tradedSymbolsThisCycle: [],
      };

      const newState = pendingOrdersReducer(
        state,
        applyStockSplitToOrders({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.orders[0].limitPrice).toBeUndefined();
      expect(newState.orders[0].stopPrice).toBeUndefined();
    });
  });
});
