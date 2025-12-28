import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { useTrading } from './useTrading';
import stocksReducer from '../store/stocksSlice';
import portfolioReducer from '../store/portfolioSlice';
import virtualPlayersReducer from '../store/virtualPlayersSlice';
import settingsReducer from '../store/settingsSlice';
import uiReducer from '../store/uiSlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import notificationsReducer from '../store/notificationsSlice';
import tradeHistoryReducer from '../store/tradeHistorySlice';
import { createMockStocks, createMockPortfolio, createMockOrder } from '../test/testUtils';
import type { GameMode, PendingOrder } from '../types';

const createTestStore = (overrides: {
  pendingOrders?: PendingOrder[];
  holdings?: { symbol: string; shares: number; avgBuyPrice: number }[];
  gameMode?: GameMode;
} = {}) => {
  return configureStore({
    reducer: {
      stocks: stocksReducer,
      portfolio: portfolioReducer,
      virtualPlayers: virtualPlayersReducer,
      settings: settingsReducer,
      ui: uiReducer,
      pendingOrders: pendingOrdersReducer,
      notifications: notificationsReducer,
      tradeHistory: tradeHistoryReducer,
    },
    preloadedState: {
      stocks: {
        items: createMockStocks(),
      },
      portfolio: {
        cash: 10000,
        holdings: overrides.holdings ?? [],
      },
      virtualPlayers: {
        players: [],
        totalTradeCount: 0,
      },
      settings: {
        updateInterval: 5,
        countdown: 5,
        isPaused: false,
        virtualPlayerCount: 5,
        gameMode: overrides.gameMode ?? 'realLife' as const,
        speedMultiplier: 1 as const,
        language: 'de' as const,
        initialCash: 100000,
      },
      ui: {
        selectedStock: '',
        tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
        settingsOpen: false,
        helpOpen: false,
        chartTab: 'stock' as const,
      },
      pendingOrders: {
        orders: overrides.pendingOrders ?? [],
        tradedSymbolsThisCycle: [],
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

const createWrapper = (store: ReturnType<typeof createTestStore>) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store, children });
  };
};

describe('useTrading', () => {
  const mockStocks = createMockStocks();
  const mockPortfolio = createMockPortfolio();

  describe('initial state', () => {
    it('should return editingOrder as null initially', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.editingOrder).toBeNull();
    });

    it('should return all handler functions', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      expect(typeof result.current.handleTrade).toBe('function');
      expect(typeof result.current.handleCancelOrder).toBe('function');
      expect(typeof result.current.handleEditOrder).toBe('function');
      expect(typeof result.current.handleEditFailedOrder).toBe('function');
      expect(typeof result.current.handleDeleteFailedOrder).toBe('function');
      expect(typeof result.current.handleCloseTradePanel).toBe('function');
      expect(typeof result.current.executeTrade).toBe('function');
    });
  });

  describe('handleTrade', () => {
    it('should open trade modal with correct symbol and type', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.handleTrade('AAPL', 'buy');
      });

      const state = store.getState();
      expect(state.ui.tradeModal.isOpen).toBe(true);
      expect(state.ui.tradeModal.symbol).toBe('AAPL');
      expect(state.ui.tradeModal.type).toBe('buy');
      expect(state.ui.selectedStock).toBe('AAPL');
      expect(state.ui.chartTab).toBe('stock');
    });

    it('should handle sell type', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.handleTrade('GOOGL', 'sell');
      });

      const state = store.getState();
      expect(state.ui.tradeModal.type).toBe('sell');
      expect(state.ui.tradeModal.symbol).toBe('GOOGL');
    });
  });

  describe('handleCancelOrder', () => {
    it('should cancel an order by id', () => {
      const mockOrder = createMockOrder();
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      expect(store.getState().pendingOrders.orders).toHaveLength(1);

      act(() => {
        result.current.handleCancelOrder('order-123');
      });

      expect(store.getState().pendingOrders.orders).toHaveLength(0);
    });
  });

  describe('handleEditOrder', () => {
    it('should set editingOrder and open trade modal', () => {
      const mockOrder = createMockOrder();
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.handleEditOrder(mockOrder);
      });

      expect(result.current.editingOrder).toEqual(mockOrder);
      expect(store.getState().ui.tradeModal.isOpen).toBe(true);
      expect(store.getState().ui.tradeModal.symbol).toBe('AAPL');
      expect(store.getState().ui.tradeModal.type).toBe('buy');
    });
  });

  describe('handleEditFailedOrder', () => {
    it('should edit existing order if found', () => {
      const mockOrder = createMockOrder();
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.handleEditFailedOrder('order-123', 'AAPL');
      });

      expect(result.current.editingOrder).toEqual(mockOrder);
      expect(store.getState().ui.tradeModal.isOpen).toBe(true);
    });

    it('should open buy modal if order not found', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.handleEditFailedOrder('non-existent', 'AAPL');
      });

      expect(result.current.editingOrder).toBeNull();
      expect(store.getState().ui.tradeModal.isOpen).toBe(true);
      expect(store.getState().ui.tradeModal.type).toBe('buy');
      expect(store.getState().ui.tradeModal.symbol).toBe('AAPL');
    });
  });

  describe('handleDeleteFailedOrder', () => {
    it('should cancel an order', () => {
      const mockOrder = createMockOrder({
        id: 'order-456',
        symbol: 'GOOGL',
        type: 'sell',
        shares: 5,
        orderType: 'stopBuy',
        orderPrice: 200,
        stopPrice: 190,
        remainingCycles: 3,
      });
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.handleDeleteFailedOrder('order-456');
      });

      expect(store.getState().pendingOrders.orders).toHaveLength(0);
    });
  });

  describe('handleCloseTradePanel', () => {
    it('should close trade modal and clear editingOrder', () => {
      const mockOrder = createMockOrder();
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      // First open the trade panel with an order
      act(() => {
        result.current.handleEditOrder(mockOrder);
      });

      expect(result.current.editingOrder).not.toBeNull();
      expect(store.getState().ui.tradeModal.isOpen).toBe(true);

      // Then close it
      act(() => {
        result.current.handleCloseTradePanel();
      });

      expect(result.current.editingOrder).toBeNull();
      expect(store.getState().ui.tradeModal.isOpen).toBe(false);
    });
  });

  describe('executeTrade', () => {
    it('should create pending order for limit orders', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 5,
          orderType: 'limit',
          limitPrice: 145,
          validityCycles: 5,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].symbol).toBe('AAPL');
      expect(orders[0].type).toBe('buy');
      expect(orders[0].shares).toBe(5);
      expect(orders[0].orderType).toBe('limit');
      expect(orders[0].limitPrice).toBe(145);
    });

    it('should create pending order for stop orders', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'GOOGL',
          type: 'sell',
          shares: 3,
          orderType: 'stopBuy',
          stopPrice: 190,
          validityCycles: 3,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].orderType).toBe('stopBuy');
      expect(orders[0].stopPrice).toBe(190);
    });

    it('should execute market order immediately in sandbox mode', () => {
      const store = createTestStore({ gameMode: 'sandbox' });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'sandbox' }),
        { wrapper: createWrapper(store) }
      );

      const initialCash = store.getState().portfolio.cash;

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 1,
          orderType: 'market',
          validityCycles: 0,
        });
      });

      // In easy mode, market orders execute immediately
      expect(store.getState().portfolio.holdings).toHaveLength(1);
      expect(store.getState().portfolio.cash).toBeLessThan(initialCash);
    });

    it('should mark symbol as traded in this cycle', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 1,
          orderType: 'limit',
          limitPrice: 140,
          validityCycles: 5,
        });
      });

      expect(store.getState().pendingOrders.tradedSymbolsThisCycle).toContain('AAPL');
    });

    it('should cancel existing order when editing', () => {
      const mockOrder = createMockOrder();
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      // Set up editing state
      act(() => {
        result.current.handleEditOrder(mockOrder);
      });

      expect(store.getState().pendingOrders.orders).toHaveLength(1);

      // Execute new trade while editing
      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 15,
          orderType: 'limit',
          limitPrice: 140,
          validityCycles: 5,
        });
      });

      // Old order should be cancelled, new order created
      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].shares).toBe(15);
      expect(orders[0].limitPrice).toBe(140);
      expect(result.current.editingOrder).toBeNull();
    });

    it('should not execute trade if stock not found', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'NONEXISTENT',
          type: 'buy',
          shares: 5,
          orderType: 'market',
          validityCycles: 0,
        });
      });

      expect(store.getState().pendingOrders.orders).toHaveLength(0);
      expect(store.getState().portfolio.holdings).toHaveLength(0);
    });

    it('should add trade to history for immediate execution in sandbox mode', () => {
      const store = createTestStore({ gameMode: 'sandbox' });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'sandbox' }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 2,
          orderType: 'market',
          validityCycles: 0,
        });
      });

      expect(store.getState().tradeHistory.trades).toHaveLength(1);
      expect(store.getState().tradeHistory.trades[0].symbol).toBe('AAPL');
    });
  });

  describe('function stability', () => {
    it('should return stable handler references', () => {
      const store = createTestStore();
      const { result, rerender } = renderHook(
        () => useTrading({ stocks: mockStocks, portfolio: mockPortfolio, gameMode: 'realLife' }),
        { wrapper: createWrapper(store) }
      );

      const firstHandleTrade = result.current.handleTrade;
      const firstHandleCancelOrder = result.current.handleCancelOrder;
      const firstHandleCloseTradePanel = result.current.handleCloseTradePanel;

      rerender();

      expect(result.current.handleTrade).toBe(firstHandleTrade);
      expect(result.current.handleCancelOrder).toBe(firstHandleCancelOrder);
      expect(result.current.handleCloseTradePanel).toBe(firstHandleCloseTradePanel);
    });
  });
});
