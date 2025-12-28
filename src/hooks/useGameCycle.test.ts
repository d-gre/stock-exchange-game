import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { useGameCycle } from './useGameCycle';
import stocksReducer from '../store/stocksSlice';
import portfolioReducer from '../store/portfolioSlice';
import virtualPlayersReducer from '../store/virtualPlayersSlice';
import settingsReducer from '../store/settingsSlice';
import uiReducer from '../store/uiSlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import notificationsReducer from '../store/notificationsSlice';
import tradeHistoryReducer from '../store/tradeHistorySlice';
import type { CandleData } from '../types';

const createMockPriceHistory = (): CandleData[] => [
  { time: 1000, open: 100, high: 105, low: 95, close: 102 },
  { time: 2000, open: 102, high: 108, low: 100, close: 105 },
];

const createTestStore = (overrides: {
  isPaused?: boolean;
  speedMultiplier?: 1 | 2 | 3;
  updateInterval?: number;
  countdown?: number;
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
        items: [{
          symbol: 'AAPL',
          name: 'Apple Inc.',
          currentPrice: 150,
          change: 0,
          changePercent: 0,
          priceHistory: createMockPriceHistory(),
          marketCapBillions: 3000,
        }],
      },
      portfolio: {
        cash: 10000,
        holdings: [],
      },
      virtualPlayers: {
        players: [],
        totalTradeCount: 0,
      },
      settings: {
        updateInterval: overrides.updateInterval ?? 5,
        countdown: overrides.countdown ?? 5,
        isPaused: overrides.isPaused ?? false,
        virtualPlayerCount: 5,
        gameMode: 'realLife' as const,
        speedMultiplier: overrides.speedMultiplier ?? 1,
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
        orders: [],
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

describe('useGameCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('return values', () => {
    it('should return effectiveInterval based on updateInterval and speedMultiplier', () => {
      const store = createTestStore({ updateInterval: 10, speedMultiplier: 2 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.effectiveInterval).toBe(5); // 10 / 2
    });

    it('should return countdown from store', () => {
      const store = createTestStore({ countdown: 3 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.countdown).toBe(3);
    });

    it('should return isPaused from store', () => {
      const store = createTestStore({ isPaused: true });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isPaused).toBe(true);
    });

    it('should return speedMultiplier from store', () => {
      const store = createTestStore({ speedMultiplier: 3 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.speedMultiplier).toBe(3);
    });
  });

  describe('isEffectivelyPaused', () => {
    it('should be true when game is not started', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: false, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });

    it('should be true when manually paused', () => {
      const store = createTestStore({ isPaused: true });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });

    it('should be true when trade panel allows trading', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: true, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });

    it('should be false when game is running and not paused', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(false);
    });
  });

  describe('countdown interval', () => {
    it('should decrement countdown every second when not paused', () => {
      const store = createTestStore({ countdown: 5 });
      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(store.getState().settings.countdown).toBe(4);
    });

    it('should not decrement countdown when paused', () => {
      const store = createTestStore({ countdown: 5, isPaused: true });
      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(store.getState().settings.countdown).toBe(5);
    });

    it('should not decrement countdown when game not started', () => {
      const store = createTestStore({ countdown: 5 });
      renderHook(
        () => useGameCycle({ isGameStarted: false, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(store.getState().settings.countdown).toBe(5);
    });
  });

  describe('effectiveInterval calculation', () => {
    it('should calculate correctly for speed 1x', () => {
      const store = createTestStore({ updateInterval: 5, speedMultiplier: 1 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.effectiveInterval).toBe(5);
    });

    it('should calculate correctly for speed 2x', () => {
      const store = createTestStore({ updateInterval: 5, speedMultiplier: 2 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.effectiveInterval).toBe(2.5);
    });

    it('should calculate correctly for speed 3x', () => {
      const store = createTestStore({ updateInterval: 6, speedMultiplier: 3 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.effectiveInterval).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should clear intervals on unmount', () => {
      const store = createTestStore();
      const { unmount } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      const initialCountdown = store.getState().settings.countdown;

      unmount();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Countdown should not have changed after unmount
      expect(store.getState().settings.countdown).toBe(initialCountdown);
    });
  });
});
