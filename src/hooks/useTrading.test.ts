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
import notificationsReducer, { type Notification } from '../store/notificationsSlice';
import tradeHistoryReducer from '../store/tradeHistorySlice';
import marketMakerReducer from '../store/marketMakerSlice';
import shortPositionsReducer from '../store/shortPositionsSlice';
import { createMockStocks, createMockOrder } from '../test/testUtils';
import type { GameMode, PendingOrder, ShortPosition } from '../types';

type MarketMakerInventory = Record<string, { symbol: string; inventory: number; baseInventory: number; spreadMultiplier: number }>;

const defaultMarketMakerInventory: MarketMakerInventory = {
  AAPL: { symbol: 'AAPL', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
  GOOGL: { symbol: 'GOOGL', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
  MSFT: { symbol: 'MSFT', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
};

const createTestStore = (overrides: {
  pendingOrders?: PendingOrder[];
  holdings?: { symbol: string; shares: number; avgBuyPrice: number }[];
  gameMode?: GameMode;
  marketMakerInventory?: MarketMakerInventory;
  notifications?: Notification[];
  shortPositions?: ShortPosition[];
  cash?: number;
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
      marketMaker: marketMakerReducer,
      shortPositions: shortPositionsReducer,
    },
    preloadedState: {
      stocks: {
        items: createMockStocks(),
      },
      portfolio: {
        cash: overrides.cash ?? 10000,
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
        loanModalOpen: false,
        highlightedLoanId: null as string | null,
        debugModalOpen: false,
        debugModalContent: '',
      },
      pendingOrders: {
        orders: overrides.pendingOrders ?? [],
        tradedSymbolsThisCycle: [],
      },
      notifications: {
        items: overrides.notifications ?? [],
      },
      tradeHistory: {
        trades: [],
        portfolioValueHistory: [],
      },
      marketMaker: {
        inventory: overrides.marketMakerInventory ?? defaultMarketMakerInventory,
      },
      shortPositions: {
        positions: overrides.shortPositions ?? [],
        totalBorrowFeesPaid: 0,
        marginCallsReceived: 0,
        forcedCoversExecuted: 0,
        marginCallStatuses: [],
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

  describe('initial state', () => {
    it('should return editingOrder as null initially', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.editingOrder).toBeNull();
    });

    it('should return all handler functions', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
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
        () => useTrading({ stocks: mockStocks }),
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
        () => useTrading({ stocks: mockStocks }),
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
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      expect(store.getState().pendingOrders.orders).toHaveLength(1);

      act(() => {
        result.current.handleCancelOrder('order-123');
      });

      expect(store.getState().pendingOrders.orders).toHaveLength(0);
    });

    it('should dismiss notifications for the cancelled order', () => {
      const mockOrder = createMockOrder();
      const mockNotification: Notification = {
        id: 'notif-1',
        type: 'warning',
        title: 'Order Failed',
        message: 'Order could not be executed',
        timestamp: Date.now(),
        autoDismissMs: 0,
        failedOrderId: 'order-123',
        failedOrderSymbol: 'AAPL',
      };
      const store = createTestStore({
        pendingOrders: [mockOrder],
        notifications: [mockNotification],
      });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      expect(store.getState().notifications.items).toHaveLength(1);

      act(() => {
        result.current.handleCancelOrder('order-123');
      });

      expect(store.getState().notifications.items).toHaveLength(0);
    });
  });

  describe('handleEditOrder', () => {
    it('should set editingOrder and open trade modal', () => {
      const mockOrder = createMockOrder();
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
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

    it('should dismiss notifications for the edited order', () => {
      const mockOrder = createMockOrder();
      const mockNotification: Notification = {
        id: 'notif-1',
        type: 'warning',
        title: 'Order Failed',
        message: 'Order could not be executed',
        timestamp: Date.now(),
        autoDismissMs: 0,
        failedOrderId: 'order-123',
        failedOrderSymbol: 'AAPL',
      };
      const store = createTestStore({
        pendingOrders: [mockOrder],
        notifications: [mockNotification],
      });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      expect(store.getState().notifications.items).toHaveLength(1);

      act(() => {
        result.current.handleEditOrder(mockOrder);
      });

      expect(store.getState().notifications.items).toHaveLength(0);
    });
  });

  describe('handleEditFailedOrder', () => {
    it('should edit existing order if found', () => {
      const mockOrder = createMockOrder();
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
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
        () => useTrading({ stocks: mockStocks }),
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
        () => useTrading({ stocks: mockStocks }),
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
        () => useTrading({ stocks: mockStocks }),
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
        () => useTrading({ stocks: mockStocks }),
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
        () => useTrading({ stocks: mockStocks }),
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

    it('should create pending order for market orders with remainingCycles=1', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      const initialCash = store.getState().portfolio.cash;

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 1,
          orderType: 'market',
          validityCycles: 0, // This value is ignored for market orders
        });
      });

      // Market orders are always created as pending orders
      expect(store.getState().pendingOrders.orders).toHaveLength(1);
      expect(store.getState().pendingOrders.orders[0].remainingCycles).toBe(1);
      expect(store.getState().portfolio.cash).toBe(initialCash); // Cash not yet deducted
    });

    it('should mark symbol as traded in this cycle', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
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
        () => useTrading({ stocks: mockStocks }),
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

      // Old order should be canceled, new order created
      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].shares).toBe(15);
      expect(orders[0].limitPrice).toBe(140);
      expect(result.current.editingOrder).toBeNull();
    });

    it('should not execute trade if stock not found', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
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

    it('should not add trade to history immediately for market orders', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
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

      // Trade is not added to history until order is executed in next cycle
      expect(store.getState().tradeHistory.trades).toHaveLength(0);
      expect(store.getState().pendingOrders.orders).toHaveLength(1);
    });

    it('should pass loanRequest to pending order when provided', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      const loanRequest = {
        amount: 5000,
        interestRate: 0.08,
        durationCycles: 40,
      };

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 50,
          orderType: 'market',
          validityCycles: 0,
          loanRequest,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].loanRequest).toBeDefined();
      expect(orders[0].loanRequest?.amount).toBe(5000);
      expect(orders[0].loanRequest?.interestRate).toBe(0.08);
    });

    it('should pass loanRequest to limit order when provided', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      const loanRequest = {
        amount: 3000,
        interestRate: 0.065,
        durationCycles: 40,
      };

      act(() => {
        result.current.executeTrade({
          symbol: 'GOOGL',
          type: 'buy',
          shares: 20,
          orderType: 'limit',
          limitPrice: 180,
          validityCycles: 5,
          loanRequest,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].loanRequest).toBeDefined();
      expect(orders[0].loanRequest?.amount).toBe(3000);
      expect(orders[0].loanRequest?.interestRate).toBe(0.065);
    });

    it('should not include loanRequest when not provided', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
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
      expect(orders[0].loanRequest).toBeUndefined();
    });
  });

  describe('function stability', () => {
    it('should return stable handler references', () => {
      const store = createTestStore();
      const { result, rerender } = renderHook(
        () => useTrading({ stocks: mockStocks }),
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

  describe('executeTrade - stopBuyLimit order type', () => {
    it('should create pending order for stopBuyLimit orders with both prices', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'stopBuyLimit',
          stopPrice: 160,
          limitPrice: 165,
          validityCycles: 5,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].orderType).toBe('stopBuyLimit');
      expect(orders[0].stopPrice).toBe(160);
      expect(orders[0].limitPrice).toBe(165);
    });
  });

  describe('executeTrade - addMargin', () => {
    it('should execute addMargin immediately without pending order', () => {
      const mockShortPosition: ShortPosition = {
        symbol: 'AAPL',
        shares: 10,
        entryPrice: 150,
        openedAt: Date.now(),
        collateralLocked: 750,
        totalBorrowFeesPaid: 0,
      };
      const store = createTestStore({
        shortPositions: [mockShortPosition],
        cash: 5000,
      });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'addMargin',
          shares: 0,
          orderType: 'market',
          validityCycles: 0,
          marginAmount: 500,
        });
      });

      // No pending order should be created
      expect(store.getState().pendingOrders.orders).toHaveLength(0);
      // Cash should be deducted
      expect(store.getState().portfolio.cash).toBe(4500);
      // Collateral should be added
      expect(store.getState().shortPositions.positions[0].collateralLocked).toBe(1250);
      // Success notification should be shown
      expect(store.getState().notifications.items).toHaveLength(1);
      expect(store.getState().notifications.items[0].type).toBe('success');
    });

    it('should not execute addMargin when marginAmount is 0', () => {
      const mockShortPosition: ShortPosition = {
        symbol: 'AAPL',
        shares: 10,
        entryPrice: 150,
        openedAt: Date.now(),
        collateralLocked: 750,
        totalBorrowFeesPaid: 0,
      };
      const store = createTestStore({
        shortPositions: [mockShortPosition],
        cash: 5000,
      });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'addMargin',
          shares: 0,
          orderType: 'market',
          validityCycles: 0,
          marginAmount: 0,
        });
      });

      // Nothing should happen
      expect(store.getState().portfolio.cash).toBe(5000);
      expect(store.getState().shortPositions.positions[0].collateralLocked).toBe(750);
      expect(store.getState().notifications.items).toHaveLength(0);
    });

    it('should not execute addMargin when marginAmount is undefined', () => {
      const mockShortPosition: ShortPosition = {
        symbol: 'AAPL',
        shares: 10,
        entryPrice: 150,
        openedAt: Date.now(),
        collateralLocked: 750,
        totalBorrowFeesPaid: 0,
      };
      const store = createTestStore({
        shortPositions: [mockShortPosition],
        cash: 5000,
      });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'addMargin',
          shares: 0,
          orderType: 'market',
          validityCycles: 0,
        });
      });

      // Nothing should happen - goes to regular order flow but stock is found
      // The regular order flow would create a pending order, but addMargin with no amount returns early
      expect(store.getState().portfolio.cash).toBe(5000);
    });
  });

  describe('executeTrade - shortSell', () => {
    it('should create pending order for short sell', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'shortSell',
          shares: 10,
          orderType: 'market',
          validityCycles: 1,
          collateralToLock: 750,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].type).toBe('shortSell');
      expect(orders[0].shares).toBe(10);
      expect(orders[0].collateralToLock).toBe(750);
      // Market orders always have isNew=false (execute at next cycle boundary)
      expect(orders[0].isNew).toBe(false);
    });

    it('should set remainingCycles to 1 for market short sell orders even if validityCycles is 0', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      // TradePanel sends validityCycles: 0 for market orders
      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'shortSell',
          shares: 10,
          orderType: 'market',
          validityCycles: 0, // This is what TradePanel sends for market orders
          collateralToLock: 750,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      // Should be 1, not 0 - market orders execute in the next cycle
      expect(orders[0].remainingCycles).toBe(1);
    });

    it('should mark symbol as traded for short sell', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'shortSell',
          shares: 10,
          orderType: 'market',
          validityCycles: 1,
          collateralToLock: 750,
        });
      });

      expect(store.getState().pendingOrders.tradedSymbolsThisCycle).toContain('AAPL');
    });

    it('should cancel old order when editing short sell', () => {
      const mockOrder = createMockOrder({ type: 'shortSell', collateralToLock: 500 });
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.handleEditOrder(mockOrder);
      });

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'shortSell',
          shares: 15,
          orderType: 'market',
          validityCycles: 1,
          collateralToLock: 900,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].shares).toBe(15);
      expect(orders[0].collateralToLock).toBe(900);
      // Edited order should have isNew=false
      expect(orders[0].isNew).toBe(false);
      expect(result.current.editingOrder).toBeNull();
    });

    it('should create short sell with limit order', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'shortSell',
          shares: 5,
          orderType: 'limit',
          limitPrice: 155,
          validityCycles: 5,
          collateralToLock: 400,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].orderType).toBe('limit');
      expect(orders[0].limitPrice).toBe(155);
    });
  });

  describe('executeTrade - buyToCover', () => {
    it('should create pending order for buy to cover', () => {
      const mockShortPosition: ShortPosition = {
        symbol: 'AAPL',
        shares: 10,
        entryPrice: 150,
        openedAt: Date.now(),
        collateralLocked: 750,
        totalBorrowFeesPaid: 0,
      };
      const store = createTestStore({ shortPositions: [mockShortPosition] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 5,
          orderType: 'market',
          validityCycles: 1,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].type).toBe('buyToCover');
      expect(orders[0].shares).toBe(5);
      // Market orders always have isNew=false (execute at next cycle boundary)
      expect(orders[0].isNew).toBe(false);
    });

    it('should set remainingCycles to 1 for market buy to cover orders even if validityCycles is 0', () => {
      const mockShortPosition: ShortPosition = {
        symbol: 'AAPL',
        shares: 10,
        entryPrice: 150,
        openedAt: Date.now(),
        collateralLocked: 750,
        totalBorrowFeesPaid: 0,
      };
      const store = createTestStore({ shortPositions: [mockShortPosition] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      // TradePanel sends validityCycles: 0 for market orders
      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 5,
          orderType: 'market',
          validityCycles: 0, // This is what TradePanel sends for market orders
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      // Should be 1, not 0 - market orders execute in the next cycle
      expect(orders[0].remainingCycles).toBe(1);
    });

    it('should not create order if short position does not exist', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 5,
          orderType: 'market',
          validityCycles: 1,
        });
      });

      expect(store.getState().pendingOrders.orders).toHaveLength(0);
    });

    it('should mark symbol as traded for buy to cover', () => {
      const mockShortPosition: ShortPosition = {
        symbol: 'AAPL',
        shares: 10,
        entryPrice: 150,
        openedAt: Date.now(),
        collateralLocked: 750,
        totalBorrowFeesPaid: 0,
      };
      const store = createTestStore({ shortPositions: [mockShortPosition] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 5,
          orderType: 'market',
          validityCycles: 1,
        });
      });

      expect(store.getState().pendingOrders.tradedSymbolsThisCycle).toContain('AAPL');
    });

    it('should cancel old order when editing buy to cover', () => {
      const mockShortPosition: ShortPosition = {
        symbol: 'AAPL',
        shares: 10,
        entryPrice: 150,
        openedAt: Date.now(),
        collateralLocked: 750,
        totalBorrowFeesPaid: 0,
      };
      const mockOrder = createMockOrder({ type: 'buyToCover' });
      const store = createTestStore({
        shortPositions: [mockShortPosition],
        pendingOrders: [mockOrder],
      });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.handleEditOrder(mockOrder);
      });

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 8,
          orderType: 'market',
          validityCycles: 1,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].shares).toBe(8);
      // Edited order should have isNew=false
      expect(orders[0].isNew).toBe(false);
      expect(result.current.editingOrder).toBeNull();
    });

    it('should create buy to cover with limit order', () => {
      const mockShortPosition: ShortPosition = {
        symbol: 'AAPL',
        shares: 10,
        entryPrice: 150,
        openedAt: Date.now(),
        collateralLocked: 750,
        totalBorrowFeesPaid: 0,
      };
      const store = createTestStore({ shortPositions: [mockShortPosition] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 5,
          orderType: 'limit',
          limitPrice: 145,
          validityCycles: 5,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].orderType).toBe('limit');
      expect(orders[0].limitPrice).toBe(145);
    });
  });

  describe('executeTrade - market orders execute in next cycle', () => {
    it('should create market order with remainingCycles=1 for next cycle execution', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 5,
          orderType: 'market',
          validityCycles: 0, // Ignored for market orders
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].orderType).toBe('market');
      // Market orders always have remainingCycles=1 to execute at next cycle boundary
      expect(orders[0].remainingCycles).toBe(1);
      // Market orders have isNew=false so they execute at the next cycle boundary (after VP trades)
      expect(orders[0].isNew).toBe(false);
    });

    it('should mark symbol as traded when creating market order', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 1,
          orderType: 'market',
          validityCycles: 0,
        });
      });

      expect(store.getState().pendingOrders.tradedSymbolsThisCycle).toContain('AAPL');
    });

    it('should replace order with new ID when editing with market order', () => {
      const mockOrder = createMockOrder();
      const originalOrderId = mockOrder.id;
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        result.current.handleEditOrder(mockOrder);
      });

      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 3,
          orderType: 'market',
          validityCycles: 0,
        });
      });

      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      // New order should have a different ID
      expect(orders[0].id).not.toBe(originalOrderId);
      expect(orders[0].shares).toBe(3);
    });

    it('should cancel old order and create new pending order when editing with market order', () => {
      const mockOrder = createMockOrder();
      const store = createTestStore({ pendingOrders: [mockOrder] });
      const { result } = renderHook(
        () => useTrading({ stocks: mockStocks }),
        { wrapper: createWrapper(store) }
      );

      // Start editing
      act(() => {
        result.current.handleEditOrder(mockOrder);
      });

      expect(store.getState().pendingOrders.orders).toHaveLength(1);

      // Execute market order while editing
      act(() => {
        result.current.executeTrade({
          symbol: 'AAPL',
          type: 'buy',
          shares: 3,
          orderType: 'market',
          validityCycles: 0,
        });
      });

      // Old order should be canceled, new market order created as pending
      const orders = store.getState().pendingOrders.orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].orderType).toBe('market');
      expect(orders[0].shares).toBe(3);
      // Portfolio should NOT have holdings yet (order is pending)
      expect(store.getState().portfolio.holdings).toHaveLength(0);
      // Editing state should be cleared
      expect(result.current.editingOrder).toBeNull();
    });
  });
});
