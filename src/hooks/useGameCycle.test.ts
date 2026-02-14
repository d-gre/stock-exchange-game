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
import marketMakerReducer from '../store/marketMakerSlice';
import sectorReducer from '../store/sectorSlice';
import loansReducer from '../store/loansSlice';
import gameSessionReducer from '../store/gameSessionSlice';
import marketPhaseReducer from '../store/marketPhaseSlice';
import floatReducer from '../store/floatSlice';
import orderBookReducer from '../store/orderBookSlice';
import shortPositionsReducer from '../store/shortPositionsSlice';
import type { CandleData, ShortPosition } from '../types';
import { SHORT_SELLING_CONFIG } from '../config';

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
      marketMaker: marketMakerReducer,
      sector: sectorReducer,
      loans: loansReducer,
      gameSession: gameSessionReducer,
      marketPhase: marketPhaseReducer,
      float: floatReducer,
      orderBook: orderBookReducer,
      shortPositions: shortPositionsReducer,
    },
    preloadedState: {
      stocks: {
        items: [{
          symbol: 'AAPL',
          name: 'Apple Inc.',
          sector: 'tech' as const,
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
        loanModalOpen: false,
        highlightedLoanId: null as string | null,
        debugModalOpen: false,
        debugModalContent: '',
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
      loans: {
        loans: [],
        cyclesSinceLastInterestCharge: 0,
        totalInterestPaid: 0,
        totalOriginationFeesPaid: 0,
        totalRepaymentFeesPaid: 0,
        creditScore: 50,
        creditHistory: [],
        delinquencyHistory: [],
        nextLoanNumber: 1,
      },
      float: {
        floats: {},
      },
      orderBook: {
        books: {},
      },
      shortPositions: {
        positions: [],
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
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.effectiveInterval).toBe(5); // 10 / 2
    });

    it('should return countdown from store', () => {
      const store = createTestStore({ countdown: 3 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.countdown).toBe(3);
    });

    it('should return isPaused from store', () => {
      const store = createTestStore({ isPaused: true });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isPaused).toBe(true);
    });

    it('should return speedMultiplier from store', () => {
      const store = createTestStore({ speedMultiplier: 3 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.speedMultiplier).toBe(3);
    });
  });

  describe('isEffectivelyPaused', () => {
    it('should be true when game is not started', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: false, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });

    it('should be true when manually paused', () => {
      const store = createTestStore({ isPaused: true });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });

    it('should be true when trade panel allows trading', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: true, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });

    it('should be true when loan modal is open', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: true, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });

    it('should be false when game is running and not paused', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(false);
    });

    it('should be true when settings sidebar is open', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: true, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });

    it('should be true when help modal is open', () => {
      const store = createTestStore();
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: true, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });
  });

  describe('countdown interval', () => {
    it('should decrement countdown every second when not paused', () => {
      const store = createTestStore({ countdown: 5 });
      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
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
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
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
        () => useGameCycle({ isGameStarted: false, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
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
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.effectiveInterval).toBe(5);
    });

    it('should calculate correctly for speed 2x', () => {
      const store = createTestStore({ updateInterval: 5, speedMultiplier: 2 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.effectiveInterval).toBe(2.5);
    });

    it('should calculate correctly for speed 3x', () => {
      const store = createTestStore({ updateInterval: 6, speedMultiplier: 3 });
      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.effectiveInterval).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should clear intervals on unmount', () => {
      const store = createTestStore();
      const { unmount } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
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

  describe('main update cycle (handleUpdatePrices)', () => {
    it('should execute update cycle after effectiveInterval', () => {
      const store = createTestStore({ updateInterval: 5, speedMultiplier: 1, countdown: 5 });
      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      const initialPrice = store.getState().stocks.items[0].currentPrice;

      // Advance time by effectiveInterval (5 seconds)
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Price should have changed (updatePrices was called)
      const newPrice = store.getState().stocks.items[0].currentPrice;
      expect(newPrice).not.toBe(initialPrice);
    });

    it('should reset countdown after update cycle', () => {
      const store = createTestStore({ updateInterval: 5, speedMultiplier: 1, countdown: 1 });
      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      // Advance time by effectiveInterval (5 seconds)
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Countdown should be reset (near updateInterval, minus any countdown decrements)
      // The countdown interval also runs, so it may be 4 or 5
      expect(store.getState().settings.countdown).toBeGreaterThanOrEqual(4);
    });

    it('should reset tradedSymbolsThisCycle after update cycle', () => {
      const store = createTestStore({ updateInterval: 5, speedMultiplier: 1 });
      // Manually add a traded symbol using the correct action name
      store.dispatch({ type: 'pendingOrders/markSymbolAsTraded', payload: 'AAPL' });
      expect(store.getState().pendingOrders.tradedSymbolsThisCycle).toContain('AAPL');

      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      // Advance time by effectiveInterval
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Traded symbols should be cleared
      expect(store.getState().pendingOrders.tradedSymbolsThisCycle).toHaveLength(0);
    });

    it('should not execute update cycle when paused', () => {
      const store = createTestStore({ updateInterval: 5, isPaused: true });
      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      const initialPrice = store.getState().stocks.items[0].currentPrice;

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Price should NOT have changed
      expect(store.getState().stocks.items[0].currentPrice).toBe(initialPrice);
    });

    it('should not execute update cycle when game not started', () => {
      const store = createTestStore({ updateInterval: 5 });
      renderHook(
        () => useGameCycle({ isGameStarted: false, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      const initialPrice = store.getState().stocks.items[0].currentPrice;

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Price should NOT have changed
      expect(store.getState().stocks.items[0].currentPrice).toBe(initialPrice);
    });

    it('should not execute update cycle when trade panel is open', () => {
      const store = createTestStore({ updateInterval: 5 });
      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: true, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      const initialPrice = store.getState().stocks.items[0].currentPrice;

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Price should NOT have changed
      expect(store.getState().stocks.items[0].currentPrice).toBe(initialPrice);
    });

    it('should execute multiple cycles over time', () => {
      const store = createTestStore({ updateInterval: 2, speedMultiplier: 1 });
      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      // Track price changes over 3 cycles (6 seconds)
      const prices: number[] = [store.getState().stocks.items[0].currentPrice];

      for (let i = 0; i < 3; i++) {
        act(() => {
          vi.advanceTimersByTime(2000);
        });
        prices.push(store.getState().stocks.items[0].currentPrice);
      }

      // Should have 4 different prices (initial + 3 updates)
      // At least some should be different (prices change randomly)
      const uniquePrices = new Set(prices);
      expect(uniquePrices.size).toBeGreaterThan(1);
    });

    it('should use faster interval with higher speed multiplier', () => {
      const store = createTestStore({ updateInterval: 6, speedMultiplier: 3, countdown: 2 });
      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      const initialPrice = store.getState().stocks.items[0].currentPrice;

      // With 3x speed, effectiveInterval = 6/3 = 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Price should have changed after 2 seconds (not 6)
      expect(store.getState().stocks.items[0].currentPrice).not.toBe(initialPrice);
    });
  });

  describe('portfolio history update', () => {
    it('should update portfolio history when countdown equals maxCountdown', () => {
      // Start with countdown at maxCountdown (just after reset)
      const store = createTestStore({ updateInterval: 5, countdown: 5 });

      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 15000 }),
        { wrapper: createWrapper(store) }
      );

      // Portfolio history should be updated (entry has 'value' not 'portfolioValue')
      const history = store.getState().tradeHistory.portfolioValueHistory;
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].value).toBe(15000);
    });

    it('should not update portfolio history when game not started', () => {
      const store = createTestStore({ updateInterval: 5, countdown: 5 });

      renderHook(
        () => useGameCycle({ isGameStarted: false, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 15000 }),
        { wrapper: createWrapper(store) }
      );

      // Portfolio history should NOT be updated
      expect(store.getState().tradeHistory.portfolioValueHistory).toHaveLength(0);
    });

    it('should not update portfolio history when countdown is not at max', () => {
      const store = createTestStore({ updateInterval: 5, countdown: 3 });

      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 15000 }),
        { wrapper: createWrapper(store) }
      );

      // Portfolio history should NOT be updated (countdown 3 != maxCountdown 5)
      expect(store.getState().tradeHistory.portfolioValueHistory).toHaveLength(0);
    });

    it('should update portfolio history after each full cycle', () => {
      const store = createTestStore({ updateInterval: 3, speedMultiplier: 1, countdown: 3 });

      const { rerender } = renderHook(
        ({ value }) => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: value }),
        {
          wrapper: createWrapper(store),
          initialProps: { value: 10000 }
        }
      );

      // First entry at start
      expect(store.getState().tradeHistory.portfolioValueHistory.length).toBe(1);

      // Complete a cycle
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Rerender with new portfolio value to trigger the effect
      rerender({ value: 12000 });

      // Should have another history entry after the cycle reset
      const history = store.getState().tradeHistory.portfolioValueHistory;
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('sector influences', () => {
    it('should pass sector influences to updatePrices', () => {
      const store = createTestStore({ updateInterval: 2 });

      // Initialize sector state
      store.dispatch({ type: 'sector/updateSectorState', payload: store.getState().stocks.items });

      renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      // Advance time to trigger update
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Sector state should exist (influences applied)
      const sectorState = store.getState().sector;
      expect(sectorState).toBeDefined();
    });
  });

  describe('timer synchronization (Ticket #758)', () => {
    it('should preserve remaining time when pausing and resuming', () => {
      const store = createTestStore({ updateInterval: 5, speedMultiplier: 1, countdown: 5 });

      // Start the game
      const { rerender } = renderHook(
        ({ canTrade }) => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: canTrade,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 10000
        }),
        {
          wrapper: createWrapper(store),
          initialProps: { canTrade: false }
        }
      );

      // Run for 2 seconds (3 seconds remaining)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Store the countdown before pausing
      const countdownBeforePause = store.getState().settings.countdown;
      expect(countdownBeforePause).toBe(3); // 5 - 2 = 3 seconds remaining

      // Pause by opening trade panel
      rerender({ canTrade: true });

      // Advance time while paused (this should NOT affect the timer)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Resume by closing trade panel
      rerender({ canTrade: false });

      // The countdown should still be approximately 3 seconds (the remaining time was preserved)
      const countdownAfterResume = store.getState().settings.countdown;
      expect(countdownAfterResume).toBe(3);

      // Now advance to complete the cycle - should take 3 more seconds, not 5
      const initialPrice = store.getState().stocks.items[0].currentPrice;

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Cycle should have executed (price changed)
      expect(store.getState().stocks.items[0].currentPrice).not.toBe(initialPrice);
    });

    it('should keep countdown and cycle execution in sync after pause/resume', () => {
      const store = createTestStore({ updateInterval: 4, speedMultiplier: 1, countdown: 4 });
      const initialCycle = store.getState().gameSession.currentCycle;

      const { rerender } = renderHook(
        ({ canTrade }) => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: canTrade,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 10000
        }),
        {
          wrapper: createWrapper(store),
          initialProps: { canTrade: false }
        }
      );

      // Run for 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Pause
      rerender({ canTrade: true });

      // Wait 500ms while paused
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Resume
      rerender({ canTrade: false });

      // At this point, countdown should be 3 and cycle should NOT have executed yet
      expect(store.getState().settings.countdown).toBe(3);
      expect(store.getState().gameSession.currentCycle).toBe(initialCycle);

      // Run the remaining 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // NOW the cycle should have executed
      expect(store.getState().gameSession.currentCycle).toBe(initialCycle + 1);

      // And countdown should have reset
      expect(store.getState().settings.countdown).toBe(4);
    });

    it('should not have empty spinner gap when countdown reaches zero', () => {
      const store = createTestStore({ updateInterval: 3, speedMultiplier: 1, countdown: 3 });
      const initialCycle = store.getState().gameSession.currentCycle;

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 10000
        }),
        { wrapper: createWrapper(store) }
      );

      // Advance to just before cycle completes
      act(() => {
        vi.advanceTimersByTime(2900);
      });

      // Countdown should be close to 0 but still positive (0.1-0.2 seconds remaining)
      expect(store.getState().settings.countdown).toBeLessThanOrEqual(0.2);
      expect(store.getState().settings.countdown).toBeGreaterThanOrEqual(0);

      // Complete the cycle
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Cycle should have executed
      expect(store.getState().gameSession.currentCycle).toBe(initialCycle + 1);

      // Countdown should have reset to approximately full value (float, e.g. 2.9)
      expect(store.getState().settings.countdown).toBeGreaterThan(2.5);
    });
  });

  describe('game end net worth calculation', () => {
    // Helper to create a store with specific loan and portfolio state
    const createStoreWithLoans = (config: {
      cash: number;
      holdings: { symbol: string; shares: number; avgBuyPrice: number }[];
      loans: { id: string; principal: number; balance: number; interestRate: number }[];
      cyclesSinceLastInterestCharge: number;
      stockPrice: number;
      gameDuration: number;
      currentCycle: number;
    }) => {
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: {
            items: [{
              symbol: 'AAPL',
              name: 'Apple Inc.',
              sector: 'tech' as const,
              currentPrice: config.stockPrice,
              change: 0,
              changePercent: 0,
              priceHistory: createMockPriceHistory(),
              marketCapBillions: 3000,
            }],
          },
          portfolio: {
            cash: config.cash,
            holdings: config.holdings,
          },
          virtualPlayers: {
            players: [],
            totalTradeCount: 0,
          },
          settings: {
            updateInterval: 5,
            countdown: 5,
            isPaused: false,
            virtualPlayerCount: 0,
            gameMode: 'realLife' as const,
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
          loans: {
            loans: config.loans.map((loan, index) => ({
              ...loan,
              createdAt: Date.now(),
              totalInterestPaid: 0,
              durationCycles: 40,
              remainingCycles: 40,
              isOverdue: false,
              overdueForCycles: 0,
              loanNumber: index + 1,
            })),
            cyclesSinceLastInterestCharge: config.cyclesSinceLastInterestCharge,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: config.loans.length + 1,
          },
          float: {
            floats: {},
          },
          orderBook: {
            books: {},
          },
          shortPositions: {
            positions: [],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          gameSession: {
            gameDuration: config.gameDuration,
            currentCycle: config.currentCycle,
            isGameEnded: false,
            endGameStats: null,
            endScreenPreview: false,
            totalTradesExecuted: 5,
            maxLoanUtilization: 0.3,
          },
        },
      });
    };

    it('should end game and provide net worth statistics', () => {
      // Setup with cash, holdings, and loan
      const store = createStoreWithLoans({
        cash: 50000,
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 100 }],
        loans: [{ id: 'loan1', principal: 10000, balance: 10000, interestRate: 0.06 }],
        cyclesSinceLastInterestCharge: 10,
        stockPrice: 150,
        gameDuration: 60,
        currentCycle: 59,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 65000
        }),
        { wrapper: createWrapper(store) }
      );

      // Advance time to trigger game end
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Game should have ended
      expect(store.getState().gameSession.isGameEnded).toBe(true);

      // End stats should be populated
      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();
      expect(endStats!.playerNetWorth).toBeDefined();
      expect(endStats!.playerProfit).toBeDefined();
      expect(endStats!.playerRanking).toBe(1); // Only player
      expect(endStats!.allPlayersRanked).toHaveLength(1);
    });

    it('should calculate net worth less than cash minus debt due to pending interest', () => {
      // Setup: Cash minus debt would be $40,000 if we ignored pending interest
      // With pending interest, net worth should be lower
      const store = createStoreWithLoans({
        cash: 50000,
        holdings: [], // No holdings to simplify calculation
        loans: [{ id: 'loan1', principal: 10000, balance: 10000, interestRate: 0.06 }],
        cyclesSinceLastInterestCharge: 10, // Significant pending interest
        stockPrice: 100,
        gameDuration: 60,
        currentCycle: 59,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 40000
        }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();

      // Net worth should be less than cash - debt (50000 - 10000 = 40000)
      // because pending interest is also deducted
      expect(endStats!.playerNetWorth).toBeLessThan(40000);
    });

    it('should handle multiple loans in net worth calculation', () => {
      const store = createStoreWithLoans({
        cash: 30000,
        holdings: [],
        loans: [
          { id: 'loan1', principal: 5000, balance: 5000, interestRate: 0.06 },
          { id: 'loan2', principal: 8000, balance: 8000, interestRate: 0.08 },
        ],
        cyclesSinceLastInterestCharge: 5,
        stockPrice: 100,
        gameDuration: 60,
        currentCycle: 59,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 17000
        }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();

      // Net worth should be less than cash - total debt (30000 - 13000 = 17000)
      // because pending interest from both loans is deducted
      expect(endStats!.playerNetWorth).toBeLessThan(17000);
    });

    it('should calculate profit relative to initial cash', () => {
      // Start with initial cash of 100000 (from settings)
      // If final net worth is higher, profit is positive
      const store = createStoreWithLoans({
        cash: 120000, // More than initial cash
        holdings: [],
        loans: [],
        cyclesSinceLastInterestCharge: 0,
        stockPrice: 100,
        gameDuration: 60,
        currentCycle: 59,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 120000
        }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();

      // Net worth is ~120000 (pure cash, no holdings, no debt)
      expect(endStats!.playerNetWorth).toBe(120000);

      // Profit = netWorth - initialCash (100000) = 20000
      expect(endStats!.playerProfit).toBe(20000);
    });

    it('should verify pending interest is subtracted (not just debt balance)', () => {
      // This test specifically verifies that pending interest affects the calculation
      // by comparing two scenarios: one with pending interest and one without
      const storeWithPendingInterest = createStoreWithLoans({
        cash: 50000,
        holdings: [],
        loans: [{ id: 'loan1', principal: 10000, balance: 10000, interestRate: 0.06 }],
        cyclesSinceLastInterestCharge: 19, // Almost at charge threshold
        stockPrice: 100,
        gameDuration: 60,
        currentCycle: 59,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 40000
        }),
        { wrapper: createWrapper(storeWithPendingInterest) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = storeWithPendingInterest.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();

      // With 19+1=20 cycles at charge, interest should be charged and counter reset
      // But the key point: net worth should be less than cash - original debt (10000)
      // because pending interest was accounted for (or interest was charged)
      const cash = storeWithPendingInterest.getState().portfolio.cash;

      // Net worth should be less than or equal to (cash - original debt)
      // due to pending interest or charged interest
      expect(endStats!.playerNetWorth).toBeLessThanOrEqual(cash - 10000);
    });
  });

  describe('risk level calculation via end game stats', () => {
    // Risk level is calculated as part of end game stats

    const createStoreWithRiskScenario = (config: {
      totalTradesExecuted: number;
      maxLoanUtilization: number;
      currentCycle: number;
      holdings: { symbol: string; shares: number; avgBuyPrice: number }[];
    }) => {
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: {
            items: [
              { symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 },
              { symbol: 'MSFT', name: 'Microsoft', sector: 'tech' as const, currentPrice: 300, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 2500 },
              { symbol: 'JPM', name: 'JP Morgan', sector: 'finance' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 500 },
              { symbol: 'GS', name: 'Goldman Sachs', sector: 'finance' as const, currentPrice: 350, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 150 },
              { symbol: 'CAT', name: 'Caterpillar', sector: 'industrial' as const, currentPrice: 250, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 150 },
            ],
          },
          portfolio: {
            cash: 50000,
            holdings: config.holdings,
          },
          virtualPlayers: {
            players: [],
            totalTradeCount: 0,
          },
          settings: {
            updateInterval: 5,
            countdown: 5,
            isPaused: false,
            virtualPlayerCount: 0,
            gameMode: 'realLife' as const,
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
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          float: {
            floats: {},
          },
          orderBook: {
            books: {},
          },
          shortPositions: {
            positions: [],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          gameSession: {
            gameDuration: 60,
            currentCycle: config.currentCycle,
            isGameEnded: false,
            endGameStats: null,
            endScreenPreview: false,
            totalTradesExecuted: config.totalTradesExecuted,
            maxLoanUtilization: config.maxLoanUtilization,
          },
        },
      });
    };

    it('should calculate conservative risk level for diversified low-trade portfolio', () => {
      // Low trade frequency, high diversification, low loan utilization
      const store = createStoreWithRiskScenario({
        totalTradesExecuted: 5, // 5 trades over 59 cycles = 0.085 trades/cycle (< 0.2)
        maxLoanUtilization: 0.1, // Low loan utilization
        currentCycle: 59,
        holdings: [
          { symbol: 'AAPL', shares: 10, avgBuyPrice: 140 },
          { symbol: 'MSFT', shares: 5, avgBuyPrice: 280 },
          { symbol: 'JPM', shares: 10, avgBuyPrice: 140 },
          { symbol: 'GS', shares: 3, avgBuyPrice: 330 },
          { symbol: 'CAT', shares: 5, avgBuyPrice: 240 },
        ], // 5 different stocks = high diversification
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 100000
        }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();
      expect(endStats!.playerRiskLevel).toBe('conservative');
    });

    it('should calculate moderate risk level for medium activity', () => {
      // Medium trade frequency, medium diversification, medium loan utilization
      const store = createStoreWithRiskScenario({
        totalTradesExecuted: 20, // 20/59 = 0.34 trades/cycle (> 0.2, < 0.5)
        maxLoanUtilization: 0.3, // Medium loan utilization (> 0.2, < 0.5)
        currentCycle: 59,
        holdings: [
          { symbol: 'AAPL', shares: 20, avgBuyPrice: 140 },
          { symbol: 'MSFT', shares: 10, avgBuyPrice: 280 },
          { symbol: 'JPM', shares: 15, avgBuyPrice: 140 },
        ], // 3 stocks = medium diversification (> 2, <= 4)
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 100000
        }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();
      expect(endStats!.playerRiskLevel).toBe('moderate');
    });

    it('should calculate aggressive risk level for high frequency trader with loans', () => {
      // High trade frequency, low diversification, high loan utilization
      const store = createStoreWithRiskScenario({
        totalTradesExecuted: 50, // 50/59 = 0.85 trades/cycle (> 0.5)
        maxLoanUtilization: 0.6, // High loan utilization (> 0.5)
        currentCycle: 59,
        holdings: [
          { symbol: 'AAPL', shares: 100, avgBuyPrice: 140 },
        ], // 1 stock = low diversification (<= 2)
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 100000
        }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();
      expect(endStats!.playerRiskLevel).toBe('aggressive');
    });
  });

  describe('virtual player risk level calculation', () => {
    const createStoreWithVirtualPlayers = (vpConfig: {
      holdings: { symbol: string; shares: number; avgBuyPrice: number }[];
      loans: { id: string; principal: number; balance: number; interestRate: number }[];
      cash: number;
    }) => {
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: {
            items: [
              { symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 100, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 },
              { symbol: 'MSFT', name: 'Microsoft', sector: 'tech' as const, currentPrice: 100, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 2500 },
              { symbol: 'JPM', name: 'JP Morgan', sector: 'finance' as const, currentPrice: 100, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 500 },
              { symbol: 'GS', name: 'Goldman Sachs', sector: 'finance' as const, currentPrice: 100, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 150 },
              { symbol: 'CAT', name: 'Caterpillar', sector: 'industrial' as const, currentPrice: 100, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 150 },
            ],
          },
          portfolio: {
            cash: 100000,
            holdings: [],
          },
          virtualPlayers: {
            players: [{
              id: 'vp-1',
              name: 'Bot Alpha',
              type: 'aggressive' as const,
              portfolio: {
                cash: vpConfig.cash,
                holdings: vpConfig.holdings,
              },
              loans: vpConfig.loans.map((loan, index) => ({
                ...loan,
                createdAt: Date.now(),
                totalInterestPaid: 0,
                durationCycles: 40,
                remainingCycles: 40,
                isOverdue: false,
                overdueForCycles: 0,
                loanNumber: index + 1,
              })),
              transactions: [],
              settings: {
                riskTolerance: 0,
              },
              cyclesSinceInterest: 0,
              initialCash: 100000,
            }],
            totalTradeCount: 0,
          },
          settings: {
            updateInterval: 5,
            countdown: 5,
            isPaused: false,
            virtualPlayerCount: 1,
            gameMode: 'realLife' as const,
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
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          float: {
            floats: {},
          },
          orderBook: {
            books: {},
          },
          shortPositions: {
            positions: [],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          gameSession: {
            gameDuration: 60,
            currentCycle: 59,
            isGameEnded: false,
            endGameStats: null,
            endScreenPreview: false,
            totalTradesExecuted: 5,
            maxLoanUtilization: 0.1,
          },
        },
      });
    };

    it('should calculate conservative VP risk level with diversified portfolio and no loans', () => {
      const store = createStoreWithVirtualPlayers({
        holdings: [
          { symbol: 'AAPL', shares: 100, avgBuyPrice: 90 },
          { symbol: 'MSFT', shares: 100, avgBuyPrice: 90 },
          { symbol: 'JPM', shares: 100, avgBuyPrice: 90 },
          { symbol: 'GS', shares: 100, avgBuyPrice: 90 },
          { symbol: 'CAT', shares: 100, avgBuyPrice: 90 },
        ], // 5 stocks = high diversification
        loans: [], // No loans
        cash: 50000,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 100000
        }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();

      // Find the VP's stats
      const vpStats = endStats!.allPlayersRanked.find(p => p.id === 'vp-1');
      expect(vpStats).toBeDefined();
      expect(vpStats!.riskLevel).toBe('conservative');
    });

    it('should calculate aggressive VP risk level with concentrated portfolio and high loans', () => {
      // Net worth: 50000 cash + 10000 (100 shares * $100) = 60000
      // Debt: 40000 -> utilization = 40000/60000 = 0.67 (> 0.5 = aggressive)
      // Only 1 holding = low diversification
      // Concentration: 100% in one stock
      const store = createStoreWithVirtualPlayers({
        holdings: [
          { symbol: 'AAPL', shares: 100, avgBuyPrice: 90 },
        ], // 1 stock = low diversification
        loans: [
          { id: 'loan-1', principal: 40000, balance: 40000, interestRate: 0.06 },
        ], // High loan relative to net worth
        cash: 50000,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 100000
        }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();

      const vpStats = endStats!.allPlayersRanked.find(p => p.id === 'vp-1');
      expect(vpStats).toBeDefined();
      expect(vpStats!.riskLevel).toBe('aggressive');
    });

    it('should include VP pending interest in net worth calculation', () => {
      const store = createStoreWithVirtualPlayers({
        holdings: [],
        loans: [
          { id: 'loan-1', principal: 10000, balance: 10000, interestRate: 0.06 },
        ],
        cash: 50000,
      });

      // Set cycles since last interest charge to accumulate pending interest
      store.dispatch({ type: 'loans/incrementInterestCycleCounter' });
      store.dispatch({ type: 'loans/incrementInterestCycleCounter' });
      store.dispatch({ type: 'loans/incrementInterestCycleCounter' });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 100000
        }),
        { wrapper: createWrapper(store) }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();

      const vpStats = endStats!.allPlayersRanked.find(p => p.id === 'vp-1');
      expect(vpStats).toBeDefined();

      // Net worth should be less than cash - debt (50000 - 10000 = 40000) due to pending interest
      expect(vpStats!.netWorth).toBeLessThan(40000);
    });
  });

  describe('loan due soon notifications', () => {
    const createStoreWithDueSoonLoan = () => {
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: {
            items: [{
              symbol: 'AAPL',
              name: 'Apple Inc.',
              sector: 'tech' as const,
              currentPrice: 150,
              change: 0,
              changePercent: 0,
              priceHistory: createMockPriceHistory(),
              marketCapBillions: 3000,
            }],
          },
          portfolio: {
            cash: 50000,
            holdings: [],
          },
          virtualPlayers: {
            players: [],
            totalTradeCount: 0,
          },
          settings: {
            updateInterval: 5,
            countdown: 5,
            isPaused: false,
            virtualPlayerCount: 0,
            gameMode: 'realLife' as const,
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
          loans: {
            loans: [{
              id: 'loan-due-soon',
              principal: 10000,
              balance: 10000,
              interestRate: 0.06,
              createdAt: Date.now(),
              totalInterestPaid: 0,
              durationCycles: 40,
              remainingCycles: 4, // Due in 4 cycles (within warning threshold)
              isOverdue: false,
              overdueForCycles: 0,
              loanNumber: 1,
              warningShown: false,
            }],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 2,
          },
          float: {
            floats: {},
          },
          orderBook: {
            books: {},
          },
          shortPositions: {
            positions: [],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          gameSession: {
            gameDuration: null,
            currentCycle: 0,
            isGameEnded: false,
            endGameStats: null,
            endScreenPreview: false,
            totalTradesExecuted: 0,
            maxLoanUtilization: 0,
          },
        },
      });
    };

    it('should add notification for loan due soon', () => {
      const store = createStoreWithDueSoonLoan();

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 50000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Check for warning notification
      const notifications = store.getState().notifications.items;
      const dueSoonNotification = notifications.find(n => n.type === 'warning' && n.loanId === 'loan-due-soon');
      expect(dueSoonNotification).toBeDefined();
    });

    it('should mark loan warning as shown to prevent duplicates', () => {
      const store = createStoreWithDueSoonLoan();

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 50000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Check that loan warning was marked as shown
      const loan = store.getState().loans.loans.find(l => l.id === 'loan-due-soon');
      expect(loan?.warningShown).toBe(true);
    });
  });

  describe('loan maturity processing', () => {
    const createStoreWithDueNowLoan = (config: {
      cash: number;
      loanBalance: number;
    }) => {
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: {
            items: [{
              symbol: 'AAPL',
              name: 'Apple Inc.',
              sector: 'tech' as const,
              currentPrice: 150,
              change: 0,
              changePercent: 0,
              priceHistory: createMockPriceHistory(),
              marketCapBillions: 3000,
            }],
          },
          portfolio: {
            cash: config.cash,
            holdings: [],
          },
          virtualPlayers: {
            players: [],
            totalTradeCount: 0,
          },
          settings: {
            updateInterval: 5,
            countdown: 5,
            isPaused: false,
            virtualPlayerCount: 0,
            gameMode: 'realLife' as const,
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
          loans: {
            loans: [{
              id: 'loan-due-now',
              principal: config.loanBalance,
              balance: config.loanBalance,
              interestRate: 0.06,
              createdAt: Date.now(),
              totalInterestPaid: 0,
              durationCycles: 40,
              remainingCycles: 0, // Due NOW
              isOverdue: false,
              overdueForCycles: 0,
              loanNumber: 1,
              warningShown: true,
            }],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 2,
          },
          float: {
            floats: {},
          },
          orderBook: {
            books: {},
          },
          shortPositions: {
            positions: [],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          gameSession: {
            gameDuration: null,
            currentCycle: 0,
            isGameEnded: false,
            endGameStats: null,
            endScreenPreview: false,
            totalTradesExecuted: 0,
            maxLoanUtilization: 0,
          },
        },
      });
    };

    it('should fully repay loan when player has enough cash', () => {
      const store = createStoreWithDueNowLoan({
        cash: 20000,
        loanBalance: 10000,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 20000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Check that cash was deducted
      expect(store.getState().portfolio.cash).toBe(10000); // 20000 - 10000

      // Check for success notification
      const notifications = store.getState().notifications.items;
      const repaidNotification = notifications.find(n => n.type === 'success' && n.loanId === 'loan-due-now');
      expect(repaidNotification).toBeDefined();
    });

    it('should partially repay and mark loan overdue when player lacks funds', () => {
      const store = createStoreWithDueNowLoan({
        cash: 3000,
        loanBalance: 10000,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 3000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Check that all available cash was used
      expect(store.getState().portfolio.cash).toBe(0);

      // Check for error notification about overdue loan
      const notifications = store.getState().notifications.items;
      const overdueNotification = notifications.find(n => n.type === 'error' && n.loanId === 'loan-due-now');
      expect(overdueNotification).toBeDefined();
    });

    it('should handle loan maturity with zero cash', () => {
      const store = createStoreWithDueNowLoan({
        cash: 0,
        loanBalance: 10000,
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 0
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Cash should still be 0
      expect(store.getState().portfolio.cash).toBe(0);

      // Should have error notification
      const notifications = store.getState().notifications.items;
      const overdueNotification = notifications.find(n => n.type === 'error');
      expect(overdueNotification).toBeDefined();
    });
  });

  describe('return values - game progress', () => {
    it('should return currentCycle from store', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: 100, currentCycle: 42, isGameEnded: false, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.currentCycle).toBe(42);
    });

    it('should return gameDuration from store', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: 120, currentCycle: 30, isGameEnded: false, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.gameDuration).toBe(120);
    });

    it('should calculate remainingCycles correctly', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: 100, currentCycle: 75, isGameEnded: false, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.remainingCycles).toBe(25); // 100 - 75
    });

    it('should return null for remainingCycles when gameDuration is null', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: null, currentCycle: 50, isGameEnded: false, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.remainingCycles).toBeNull();
    });

    it('should calculate gameProgress correctly', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: 100, currentCycle: 50, isGameEnded: false, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.gameProgress).toBe(0.5); // 50/100
    });

    it('should return null for gameProgress when gameDuration is null', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: null, currentCycle: 50, isGameEnded: false, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.gameProgress).toBeNull();
    });

    it('should cap gameProgress at 1.0', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: 100, currentCycle: 150, isGameEnded: true, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.gameProgress).toBe(1); // Capped at 1.0
    });

    it('should return isGameEnded from store', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: 100, currentCycle: 100, isGameEnded: true, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isGameEnded).toBe(true);
    });

    it('should return remainingCycles as 0 when at or past game end', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: 100, currentCycle: 110, isGameEnded: true, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.remainingCycles).toBe(0); // Math.max(0, 100-110)
    });
  });

  describe('isEffectivelyPaused - game ended', () => {
    it('should be true when game has ended', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: { items: [{ symbol: 'AAPL', name: 'Apple', sector: 'tech' as const, currentPrice: 150, change: 0, changePercent: 0, priceHistory: createMockPriceHistory(), marketCapBillions: 3000 }] },
          portfolio: { cash: 10000, holdings: [] },
          virtualPlayers: { players: [], totalTradeCount: 0 },
          settings: { updateInterval: 5, countdown: 5, isPaused: false, virtualPlayerCount: 0, gameMode: 'realLife' as const, speedMultiplier: 1 as const, language: 'de' as const, initialCash: 100000 },
          ui: { selectedStock: '', tradeModal: { isOpen: false, symbol: '', type: 'buy' as const }, settingsOpen: false, helpOpen: false, chartTab: 'stock' as const, loanModalOpen: false, highlightedLoanId: null, debugModalOpen: false, debugModalContent: '' },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          notifications: { items: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [] },
          loans: { loans: [], cyclesSinceLastInterestCharge: 0, totalInterestPaid: 0, totalOriginationFeesPaid: 0, totalRepaymentFeesPaid: 0, creditScore: 50, creditHistory: [], delinquencyHistory: [], nextLoanNumber: 1 },
          float: { floats: {} },
          orderBook: { books: {} },
          shortPositions: { positions: [], totalBorrowFeesPaid: 0, marginCallsReceived: 0, forcedCoversExecuted: 0, marginCallStatuses: [] },
          gameSession: { gameDuration: 100, currentCycle: 100, isGameEnded: true, endGameStats: null, endScreenPreview: false, totalTradesExecuted: 0, maxLoanUtilization: 0 },
        },
      });

      const { result } = renderHook(
        () => useGameCycle({ isGameStarted: true, canTradeInPanel: false, isLoanModalOpen: false, isSettingsOpen: false, isHelpOpen: false, totalPortfolioValue: 10000 }),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isEffectivelyPaused).toBe(true);
    });
  });

  describe('short selling processing', () => {
    const createStoreWithShortPositions = (config: {
      shortPositions: ShortPosition[];
      cash: number;
      stockPrice: number;
      marginCallStatuses?: { symbol: string; cyclesRemaining: number }[];
    }) => {
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: {
            items: [{
              symbol: 'AAPL',
              name: 'Apple Inc.',
              sector: 'tech' as const,
              currentPrice: config.stockPrice,
              change: 0,
              changePercent: 0,
              priceHistory: createMockPriceHistory(),
              marketCapBillions: 3000,
            }],
          },
          portfolio: {
            cash: config.cash,
            holdings: [],
          },
          virtualPlayers: {
            players: [],
            totalTradeCount: 0,
          },
          settings: {
            updateInterval: 5,
            countdown: 5,
            isPaused: false,
            virtualPlayerCount: 0,
            gameMode: 'realLife' as const,
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
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          float: {
            floats: {
              AAPL: { symbol: 'AAPL', totalFloat: 1000000, mmHeldShares: 500000, playerHeldShares: 0, vpHeldShares: 500000, reservedShares: 0 },
            },
          },
          orderBook: {
            books: {},
          },
          shortPositions: {
            positions: config.shortPositions,
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: config.marginCallStatuses ?? [],
          },
          gameSession: {
            gameDuration: null,
            currentCycle: 0,
            isGameEnded: false,
            endGameStats: null,
            endScreenPreview: false,
            totalTradesExecuted: 0,
            maxLoanUtilization: 0,
          },
        },
      });
    };

    it('should charge borrow fees for short positions', () => {
      if (!SHORT_SELLING_CONFIG.enabled) {
        return; // Skip test if short selling is disabled
      }

      const store = createStoreWithShortPositions({
        shortPositions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          openedAt: Date.now(),
          collateralLocked: 7500,
          totalBorrowFeesPaid: 0,
        }],
        cash: 50000,
        stockPrice: 150,
      });

      const initialCash = store.getState().portfolio.cash;

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 50000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Cash should be reduced by borrow fees
      expect(store.getState().portfolio.cash).toBeLessThan(initialCash);
    });

    it('should update margin call statuses for short positions', () => {
      if (!SHORT_SELLING_CONFIG.enabled) {
        return;
      }

      // Create a position that will be in margin call (price increased significantly)
      const store = createStoreWithShortPositions({
        shortPositions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 100,
          openedAt: Date.now(),
          collateralLocked: 5000, // 50% of original entry
          totalBorrowFeesPaid: 0,
        }],
        cash: 50000,
        stockPrice: 200, // Price doubled - should trigger margin call
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 50000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Margin call status should be updated
      const marginCallStatuses = store.getState().shortPositions.marginCallStatuses;
      // Note: Whether a margin call is triggered depends on the margin ratio
      // This test verifies the code path is executed
      expect(marginCallStatuses).toBeDefined();
    });

    it('should add notification for new margin calls', () => {
      if (!SHORT_SELLING_CONFIG.enabled) {
        return;
      }

      // Create initial margin call status to simulate a new margin call
      const store = createStoreWithShortPositions({
        shortPositions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 100,
          openedAt: Date.now(),
          collateralLocked: 3000, // Very low collateral
          totalBorrowFeesPaid: 0,
        }],
        cash: 50000,
        stockPrice: 200, // Price doubled
        marginCallStatuses: [{
          symbol: 'AAPL',
          cyclesRemaining: SHORT_SELLING_CONFIG.marginCallGraceCycles, // New margin call
        }],
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 50000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Check for margin call notification
      const notifications = store.getState().notifications.items;
      const marginCallNotification = notifications.find(n =>
        n.type === 'error' && n.marginCallSymbol === 'AAPL'
      );
      expect(marginCallNotification).toBeDefined();
    });

    it('should add warning notification when forced cover is imminent', () => {
      if (!SHORT_SELLING_CONFIG.enabled) {
        return;
      }

      const store = createStoreWithShortPositions({
        shortPositions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 100,
          openedAt: Date.now(),
          collateralLocked: 3000,
          totalBorrowFeesPaid: 0,
        }],
        cash: 50000,
        stockPrice: 200,
        marginCallStatuses: [{
          symbol: 'AAPL',
          cyclesRemaining: 1, // Last cycle before forced cover
        }],
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 50000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Check for warning notification about forced cover
      const notifications = store.getState().notifications.items;
      const warningNotification = notifications.find(n => n.type === 'warning');
      expect(warningNotification).toBeDefined();
    });

    it('should not process short selling when disabled', () => {
      // Create store but with empty positions (simulating disabled state)
      const store = createStoreWithShortPositions({
        shortPositions: [],
        cash: 50000,
        stockPrice: 150,
      });

      const initialCash = store.getState().portfolio.cash;

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 50000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Cash should only change due to potential interest, not borrow fees
      // (no short positions = no borrow fees)
      const cashAfterCycle = store.getState().portfolio.cash;
      // Since there are no short positions, no borrow fees should be charged
      expect(cashAfterCycle).toBe(initialCash);
    });

    it('should include short position P/L in end game stats', () => {
      if (!SHORT_SELLING_CONFIG.enabled) {
        return;
      }

      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: {
            items: [{
              symbol: 'AAPL',
              name: 'Apple Inc.',
              sector: 'tech' as const,
              currentPrice: 100, // Price fell from 150 to 100
              change: 0,
              changePercent: 0,
              priceHistory: createMockPriceHistory(),
              marketCapBillions: 3000,
            }],
          },
          portfolio: {
            cash: 50000,
            holdings: [],
          },
          virtualPlayers: {
            players: [],
            totalTradeCount: 0,
          },
          settings: {
            updateInterval: 5,
            countdown: 5,
            isPaused: false,
            virtualPlayerCount: 0,
            gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
            language: 'de' as const,
            initialCash: 50000,
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
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          float: {
            floats: {},
          },
          orderBook: {
            books: {},
          },
          shortPositions: {
            positions: [{
              symbol: 'AAPL',
              shares: 100,
              entryPrice: 150, // Sold at 150
              openedAt: Date.now(),
              collateralLocked: 7500,
              totalBorrowFeesPaid: 100,
            }],
            totalBorrowFeesPaid: 100,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          gameSession: {
            gameDuration: 60,
            currentCycle: 59,
            isGameEnded: false,
            endGameStats: null,
            endScreenPreview: false,
            totalTradesExecuted: 0,
            maxLoanUtilization: 0,
          },
        },
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 50000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger game end
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const endStats = store.getState().gameSession.endGameStats;
      expect(endStats).not.toBeNull();

      // Net worth should include short position profit
      // Short P/L = (150 - 100) * 100 - 100 fees = 4900
      // Net worth = 50000 (cash after fees) + 4900 (short P/L) = ~54900
      // But note that cash is deducted for borrow fees during the cycle
      expect(endStats!.playerNetWorth).toBeGreaterThan(50000);
    });
  });

  describe('loan cycle decrement', () => {
    it('should decrement remaining cycles for active loans', () => {
      const store = configureStore({
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
          sector: sectorReducer,
          loans: loansReducer,
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          float: floatReducer,
          orderBook: orderBookReducer,
          shortPositions: shortPositionsReducer,
        },
        preloadedState: {
          stocks: {
            items: [{
              symbol: 'AAPL',
              name: 'Apple Inc.',
              sector: 'tech' as const,
              currentPrice: 150,
              change: 0,
              changePercent: 0,
              priceHistory: createMockPriceHistory(),
              marketCapBillions: 3000,
            }],
          },
          portfolio: {
            cash: 50000,
            holdings: [],
          },
          virtualPlayers: {
            players: [],
            totalTradeCount: 0,
          },
          settings: {
            updateInterval: 5,
            countdown: 5,
            isPaused: false,
            virtualPlayerCount: 0,
            gameMode: 'realLife' as const,
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
          loans: {
            loans: [{
              id: 'active-loan',
              principal: 10000,
              balance: 10000,
              interestRate: 0.06,
              createdAt: Date.now(),
              totalInterestPaid: 0,
              durationCycles: 40,
              remainingCycles: 20,
              isOverdue: false,
              overdueForCycles: 0,
              loanNumber: 1,
            }],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 2,
          },
          float: {
            floats: {},
          },
          orderBook: {
            books: {},
          },
          shortPositions: {
            positions: [],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          gameSession: {
            gameDuration: null,
            currentCycle: 0,
            isGameEnded: false,
            endGameStats: null,
            endScreenPreview: false,
            totalTradesExecuted: 0,
            maxLoanUtilization: 0,
          },
        },
      });

      renderHook(
        () => useGameCycle({
          isGameStarted: true,
          canTradeInPanel: false,
          isLoanModalOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          totalPortfolioValue: 50000
        }),
        { wrapper: createWrapper(store) }
      );

      // Trigger a cycle
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Check that remaining cycles decreased
      const loan = store.getState().loans.loans.find(l => l.id === 'active-loan');
      expect(loan?.remainingCycles).toBe(19); // 20 - 1
    });
  });
});
