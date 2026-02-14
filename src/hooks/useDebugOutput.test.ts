import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { useDebugOutput } from './useDebugOutput';
import stocksReducer from '../store/stocksSlice';
import portfolioReducer from '../store/portfolioSlice';
import loansReducer from '../store/loansSlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import shortPositionsReducer from '../store/shortPositionsSlice';
import uiReducer from '../store/uiSlice';
import gameSessionReducer from '../store/gameSessionSlice';
import tradeHistoryReducer from '../store/tradeHistorySlice';
import { createMockStock } from '../test/testUtils';
import type { ShortPosition, PendingOrder } from '../types';

const createTestStore = (overrides: {
  cash?: number;
  holdings?: { symbol: string; shares: number; avgBuyPrice: number }[];
  loans?: Array<{
    id: string;
    loanNumber: number;
    principal: number;
    balance: number;
    interestRate: number;
    durationCycles: number;
    remainingCycles: number;
    isOverdue: boolean;
    overdueForCycles: number;
    createdAt: number;
    totalInterestPaid: number;
  }>;
  shorts?: ShortPosition[];
  orders?: PendingOrder[];
  currentCycle?: number;
} = {}) => {
  return configureStore({
    reducer: {
      stocks: stocksReducer,
      portfolio: portfolioReducer,
      loans: loansReducer,
      pendingOrders: pendingOrdersReducer,
      shortPositions: shortPositionsReducer,
      ui: uiReducer,
      gameSession: gameSessionReducer,
      tradeHistory: tradeHistoryReducer,
    },
    preloadedState: {
      stocks: {
        items: [
          createMockStock({ symbol: 'AAPL', currentPrice: 150 }),
          createMockStock({ symbol: 'GOOGL', currentPrice: 200 }),
          createMockStock({ symbol: 'TSLA', currentPrice: 250 }),
        ],
      },
      portfolio: {
        cash: overrides.cash ?? 10000,
        holdings: overrides.holdings ?? [],
      },
      loans: {
        loans: overrides.loans ?? [],
        cyclesSinceLastInterestCharge: 0,
        totalInterestPaid: 0,
        totalOriginationFeesPaid: 0,
        totalRepaymentFeesPaid: 0,
        creditScore: 50,
        creditHistory: [],
        delinquencyHistory: [],
        nextLoanNumber: 1,
      },
      pendingOrders: {
        orders: overrides.orders ?? [],
        tradedSymbolsThisCycle: [],
      },
      shortPositions: {
        positions: overrides.shorts ?? [],
        totalBorrowFeesPaid: 0,
        marginCallsReceived: 0,
        forcedCoversExecuted: 0,
        marginCallStatuses: [],
      },
      ui: {
        selectedStock: '',
        tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
        settingsOpen: false,
        helpOpen: false,
        chartTab: 'stock' as const,
        loanModalOpen: false,
        highlightedLoanId: null,
        debugModalOpen: false,
        debugModalContent: '',
      },
      gameSession: {
        gameDuration: null,
        currentCycle: overrides.currentCycle ?? 0,
        isGameEnded: false,
        endGameStats: null,
        endScreenPreview: false,
        totalTradesExecuted: 0,
        maxLoanUtilization: 0,
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

describe('useDebugOutput', () => {
  it('should open debug modal with portfolio JSON on Alt+D', () => {
    const store = createTestStore({
      cash: 5000,
      holdings: [
        { symbol: 'AAPL', shares: 10, avgBuyPrice: 140 },
      ],
    });

    renderHook(() => useDebugOutput(), { wrapper: createWrapper(store) });

    const event = new KeyboardEvent('keydown', {
      key: 'd',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    const state = store.getState();
    expect(state.ui.debugModalOpen).toBe(true);

    const output = JSON.parse(state.ui.debugModalContent);
    expect(output.cash).toBe(5000);
    expect(output.stockValue).toBe(1500); // 10 shares * $150
    expect(output.totalDebt).toBe(0);
    expect(output.netWorth).toBe(6500); // 5000 + 1500
    expect(output.holdings).toHaveLength(1);
    expect(output.holdings[0].symbol).toBe('AAPL');
    expect(output.holdings[0].shares).toBe(10);
    expect(output.holdings[0].totalValue).toBe(1500);
    expect(output.loans).toHaveLength(0);
    expect(output.shorts).toHaveLength(0);
    expect(output.pendingOrders).toHaveLength(0);
  });

  it('should include loan data in output', () => {
    const store = createTestStore({
      cash: 8000,
      loans: [
        {
          id: 'loan-1',
          loanNumber: 1,
          principal: 5000,
          balance: 5100,
          interestRate: 0.08,
          durationCycles: 40,
          remainingCycles: 35,
          isOverdue: false,
          overdueForCycles: 0,
          createdAt: Date.now(),
          totalInterestPaid: 100,
        },
      ],
    });

    renderHook(() => useDebugOutput(), { wrapper: createWrapper(store) });

    const event = new KeyboardEvent('keydown', {
      key: 'd',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    const output = JSON.parse(store.getState().ui.debugModalContent);
    expect(output.totalDebt).toBe(5100);
    expect(output.netWorth).toBe(2900); // 8000 - 5100
    expect(output.loans).toHaveLength(1);
    expect(output.loans[0].loanNumber).toBe(1);
    expect(output.loans[0].balance).toBe(5100);
    expect(output.loans[0].remainingCycles).toBe(35);
  });

  it('should work with uppercase D', () => {
    const store = createTestStore();

    renderHook(() => useDebugOutput(), { wrapper: createWrapper(store) });

    const event = new KeyboardEvent('keydown', {
      key: 'D',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    expect(store.getState().ui.debugModalOpen).toBe(true);
  });

  it('should not trigger on regular D key press', () => {
    const store = createTestStore();

    renderHook(() => useDebugOutput(), { wrapper: createWrapper(store) });

    const event = new KeyboardEvent('keydown', {
      key: 'd',
      ctrlKey: false,
      bubbles: true,
    });
    document.dispatchEvent(event);

    expect(store.getState().ui.debugModalOpen).toBe(false);
  });

  it('should not trigger on Alt+other keys', () => {
    const store = createTestStore();

    renderHook(() => useDebugOutput(), { wrapper: createWrapper(store) });

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    expect(store.getState().ui.debugModalOpen).toBe(false);
  });

  it('should output valid JSON', () => {
    const store = createTestStore({
      cash: 10000,
      holdings: [
        { symbol: 'AAPL', shares: 5, avgBuyPrice: 145 },
        { symbol: 'GOOGL', shares: 3, avgBuyPrice: 190 },
      ],
    });

    renderHook(() => useDebugOutput(), { wrapper: createWrapper(store) });

    const event = new KeyboardEvent('keydown', {
      key: 'd',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    const content = store.getState().ui.debugModalContent;
    // Should not throw when parsing
    expect(() => JSON.parse(content)).not.toThrow();

    const output = JSON.parse(content);
    expect(output).toHaveProperty('cash');
    expect(output).toHaveProperty('stockValue');
    expect(output).toHaveProperty('totalDebt');
    expect(output).toHaveProperty('netWorth');
    expect(output).toHaveProperty('holdings');
    expect(output).toHaveProperty('loans');
    expect(output).toHaveProperty('shorts');
    expect(output).toHaveProperty('currentCycle');
    expect(output).toHaveProperty('tradeHistory');
  });

  it('should include short position data in output', () => {
    const store = createTestStore({
      cash: 15000,
      shorts: [
        {
          symbol: 'TSLA',
          shares: 10,
          entryPrice: 280,
          collateralLocked: 1400,
          openedAt: Date.now(),
          totalBorrowFeesPaid: 5.6,
        },
      ],
    });

    renderHook(() => useDebugOutput(), { wrapper: createWrapper(store) });

    const event = new KeyboardEvent('keydown', {
      key: 'd',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    const output = JSON.parse(store.getState().ui.debugModalContent);
    expect(output.totalLockedCollateral).toBe(1400);
    expect(output.shorts).toHaveLength(1);
    expect(output.shorts[0].symbol).toBe('TSLA');
    expect(output.shorts[0].shares).toBe(10);
    expect(output.shorts[0].entryPrice).toBe(280);
    expect(output.shorts[0].currentPrice).toBe(250); // From mock stock
    expect(output.shorts[0].collateralLocked).toBe(1400);
    expect(output.shorts[0].totalBorrowFeesPaid).toBe(5.6);
    // Unrealized P/L: (280 - 250) * 10 - 5.6 = 300 - 5.6 = 294.4
    expect(output.shorts[0].unrealizedPL).toBeCloseTo(294.4, 1);
  });

  it('should include pending orders data in output', () => {
    const store = createTestStore({
      cash: 10000,
      orders: [
        {
          id: 'order-1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'limit',
          orderPrice: 145,
          limitPrice: 145,
          remainingCycles: 5,
          timestamp: Date.now(),
        },
        {
          id: 'order-2',
          symbol: 'GOOGL',
          type: 'sell',
          shares: 5,
          orderType: 'market',
          orderPrice: 200,
          remainingCycles: 1,
          timestamp: Date.now(),
        },
      ],
    });

    renderHook(() => useDebugOutput(), { wrapper: createWrapper(store) });

    const event = new KeyboardEvent('keydown', {
      key: 'd',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    const output = JSON.parse(store.getState().ui.debugModalContent);
    expect(output.pendingOrders).toHaveLength(2);
    expect(output.pendingOrders[0].symbol).toBe('AAPL');
    expect(output.pendingOrders[0].type).toBe('buy');
    expect(output.pendingOrders[0].orderType).toBe('limit');
    expect(output.pendingOrders[0].shares).toBe(10);
    expect(output.pendingOrders[0].limitPrice).toBe(145);
    expect(output.pendingOrders[0].remainingCycles).toBe(5);
    expect(output.pendingOrders[1].symbol).toBe('GOOGL');
    expect(output.pendingOrders[1].type).toBe('sell');
    expect(output.pendingOrders[1].orderType).toBe('market');
  });

  it('should include currentCycle in output', () => {
    const store = createTestStore({
      cash: 10000,
      currentCycle: 42,
    });

    renderHook(() => useDebugOutput(), { wrapper: createWrapper(store) });

    const event = new KeyboardEvent('keydown', {
      key: 'd',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    const output = JSON.parse(store.getState().ui.debugModalContent);
    expect(output.currentCycle).toBe(42);
  });
});
