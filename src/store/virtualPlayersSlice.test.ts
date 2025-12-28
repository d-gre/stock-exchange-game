import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import virtualPlayersReducer, { setPlayers, executeVirtualTrades, resetTradeCount } from './virtualPlayersSlice';
import stocksReducer from './stocksSlice';
import type { VirtualPlayer, Stock } from '../types';

// Mock the virtualPlayers utility to have controlled behavior
vi.mock('../utils/virtualPlayers', async () => {
  const actual = await vi.importActual('../utils/virtualPlayers');
  return {
    ...actual,
    initializeVirtualPlayers: () => [],
  };
});

// Type for our test store
interface TestState {
  virtualPlayers: { players: VirtualPlayer[]; totalTradeCount: number };
  stocks: { items: Stock[] };
}

const createTestStore = (preloadedState: TestState) =>
  configureStore({
    reducer: {
      virtualPlayers: virtualPlayersReducer,
      stocks: stocksReducer,
    },
    preloadedState,
  });

type TestStore = ReturnType<typeof createTestStore>;

describe('virtualPlayersSlice', () => {
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

  const createMockPlayer = (id: string, cash: number = 5000): VirtualPlayer => ({
    id,
    name: `Player ${id}`,
    portfolio: {
      cash,
      holdings: [
        { symbol: 'TEST1', shares: 20, avgBuyPrice: 95 },
        { symbol: 'TEST2', shares: 20, avgBuyPrice: 45 },
      ],
    },
    transactions: [],
    settings: {
      riskTolerance: 0,
    },
  });

  describe('setPlayers reducer', () => {
    it('should update players state', () => {
      const initialState = { players: [], totalTradeCount: 0 };
      const newPlayers = [createMockPlayer('1'), createMockPlayer('2')];

      const newState = virtualPlayersReducer(initialState, setPlayers(newPlayers));

      expect(newState.players).toHaveLength(2);
      expect(newState.players[0].id).toBe('1');
      expect(newState.players[1].id).toBe('2');
    });

    it('should replace existing players', () => {
      const initialState = { players: [createMockPlayer('old')], totalTradeCount: 5 };
      const newPlayers = [createMockPlayer('new')];

      const newState = virtualPlayersReducer(initialState, setPlayers(newPlayers));

      expect(newState.players).toHaveLength(1);
      expect(newState.players[0].id).toBe('new');
      expect(newState.totalTradeCount).toBe(5); // Should preserve trade count
    });
  });

  describe('resetTradeCount reducer', () => {
    it('should reset trade count to zero', () => {
      const initialState = { players: [createMockPlayer('1')], totalTradeCount: 42 };

      const newState = virtualPlayersReducer(initialState, resetTradeCount());

      expect(newState.totalTradeCount).toBe(0);
      expect(newState.players).toHaveLength(1); // Players should be preserved
    });

    it('should work when trade count is already zero', () => {
      const initialState = { players: [], totalTradeCount: 0 };

      const newState = virtualPlayersReducer(initialState, resetTradeCount());

      expect(newState.totalTradeCount).toBe(0);
    });
  });

  describe('executeVirtualTrades thunk', () => {
    let store: TestStore;

    beforeEach(() => {
      store = createTestStore({
        virtualPlayers: {
          players: [createMockPlayer('bot-1'), createMockPlayer('bot-2')],
          totalTradeCount: 0,
        },
        stocks: {
          items: createMockStocks(),
        },
      });
    });

    it('should update both players and stocks state when thunk executes', () => {
      // Store references to initial state
      const initialPlayersRef = store.getState().virtualPlayers.players;
      const initialStocksRef = store.getState().stocks.items;

      // Run thunk multiple times to ensure trades happen
      for (let i = 0; i < 30; i++) {
        store.dispatch(executeVirtualTrades() as unknown as Parameters<typeof store.dispatch>[0]);
      }

      // Verify that the state objects have been replaced (not mutated)
      // This proves that setPlayers and setStocks were dispatched
      const finalPlayers = store.getState().virtualPlayers.players;
      const finalStocks = store.getState().stocks.items;

      // The state arrays should be different object references (immutable updates)
      expect(finalPlayers).not.toBe(initialPlayersRef);
      expect(finalStocks).not.toBe(initialStocksRef);
    });

    it('should update state through the thunk', () => {
      const initialPlayers = store.getState().virtualPlayers.players;
      const initialStockPrices = store.getState().stocks.items.map(s => s.currentPrice);

      // Run multiple times to increase likelihood of trades happening
      for (let i = 0; i < 20; i++) {
        store.dispatch(executeVirtualTrades() as unknown as Parameters<typeof store.dispatch>[0]);
      }

      const finalPlayers = store.getState().virtualPlayers.players;
      const finalStocks = store.getState().stocks.items;

      // Players should still exist
      expect(finalPlayers).toHaveLength(2);

      // Stocks should still exist
      expect(finalStocks).toHaveLength(2);

      // After many trades, at least one player's portfolio should have changed
      const playerChanged = finalPlayers.some((player, index) => {
        const initial = initialPlayers[index];
        return (
          player.portfolio.cash !== initial.portfolio.cash ||
          player.portfolio.holdings.length !== initial.portfolio.holdings.length ||
          player.transactions.length > 0
        );
      });

      // Or stock prices should have changed
      const stocksChanged = finalStocks.some(
        (stock, index) => stock.currentPrice !== initialStockPrices[index]
      );

      expect(playerChanged || stocksChanged).toBe(true);
    });

    it('should apply market impact from virtual player trades to stocks', () => {
      // Track if stock prices change
      let priceChanged = false;
      const originalTest1Price = store.getState().stocks.items[0].currentPrice;
      const originalTest2Price = store.getState().stocks.items[1].currentPrice;

      // Run multiple iterations
      for (let i = 0; i < 50; i++) {
        store.dispatch(executeVirtualTrades() as unknown as Parameters<typeof store.dispatch>[0]);

        const currentStocks = store.getState().stocks.items;
        if (
          currentStocks[0].currentPrice !== originalTest1Price ||
          currentStocks[1].currentPrice !== originalTest2Price
        ) {
          priceChanged = true;
          break;
        }
      }

      // Prices should have changed at some point due to virtual player trades
      expect(priceChanged).toBe(true);
    });

    it('should read current state when executing trades', () => {
      // Dispatch some initial trades
      store.dispatch(executeVirtualTrades() as unknown as Parameters<typeof store.dispatch>[0]);

      const stateAfterFirst = store.getState();

      // Dispatch more trades - should use updated state
      store.dispatch(executeVirtualTrades() as unknown as Parameters<typeof store.dispatch>[0]);

      const stateAfterSecond = store.getState();

      // Both states should be valid
      expect(stateAfterFirst.virtualPlayers.players).toBeDefined();
      expect(stateAfterSecond.virtualPlayers.players).toBeDefined();
      expect(stateAfterFirst.stocks.items).toBeDefined();
      expect(stateAfterSecond.stocks.items).toBeDefined();
    });
  });

  describe('data flow integration', () => {
    it('should maintain data consistency after multiple trade cycles', () => {
      const store = createTestStore({
        virtualPlayers: {
          players: [createMockPlayer('bot-1', 10000)],
          totalTradeCount: 0,
        },
        stocks: {
          items: createMockStocks(),
        },
      });

      // Run many trade cycles
      for (let i = 0; i < 100; i++) {
        store.dispatch(executeVirtualTrades() as unknown as Parameters<typeof store.dispatch>[0]);
      }

      const finalState = store.getState();

      // Validate player data integrity
      const player = finalState.virtualPlayers.players[0];
      expect(player.portfolio.cash).toBeGreaterThanOrEqual(0);
      expect(player.portfolio.holdings.every(h => h.shares >= 0)).toBe(true);

      // Validate stock data integrity
      for (const stock of finalState.stocks.items) {
        expect(stock.currentPrice).toBeGreaterThan(0);
        expect(stock.priceHistory.length).toBeGreaterThan(0);

        const lastCandle = stock.priceHistory[stock.priceHistory.length - 1];
        expect(lastCandle.close).toBe(stock.currentPrice);
      }
    });

    it('should limit transactions to MAX_TRANSACTIONS_PER_PLAYER', () => {
      const store = createTestStore({
        virtualPlayers: {
          players: [createMockPlayer('bot-1', 50000)],
          totalTradeCount: 0,
        },
        stocks: {
          items: createMockStocks(),
        },
      });

      // Run many trade cycles to accumulate transactions
      for (let i = 0; i < 100; i++) {
        store.dispatch(executeVirtualTrades() as unknown as Parameters<typeof store.dispatch>[0]);
      }

      const player = store.getState().virtualPlayers.players[0];

      // Transactions should be limited to 10 (MAX_TRANSACTIONS_PER_PLAYER)
      expect(player.transactions.length).toBeLessThanOrEqual(10);
    });
  });
});
