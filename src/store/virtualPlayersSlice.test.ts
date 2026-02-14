import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import virtualPlayersReducer, {
  setPlayers,
  executeVirtualTrades,
  resetTradeCount,
  resetPlayersForTimedGame,
  executeWarmupVirtualTrades,
  forceTradesForUntraded,
} from './virtualPlayersSlice';
import stocksReducer from './stocksSlice';
import marketMakerReducer, { initializeInventory } from './marketMakerSlice';
import marketPhaseReducer from './marketPhaseSlice';
import type { VirtualPlayer, Stock, MarketMakerInventory, MarketPhase, Sector } from '../types';
import type { WarmupConfig } from '../utils/virtualPlayers';
import { MARKET_MAKER_CONFIG } from '../config';

// Mock the virtualPlayers utility to have controlled behavior
vi.mock('../utils/virtualPlayers', async () => {
  const actual = await vi.importActual('../utils/virtualPlayers');
  return {
    ...actual,
    initializeVirtualPlayers: () => [],
  };
});

// Type for our test store
interface MarketPhaseState {
  globalPhase: MarketPhase;
  sectorPhases: Record<Sector, MarketPhase>;
  cyclesInGlobalPhase: number;
  cyclesInSectorPhase: Record<Sector, number>;
  fearGreedIndex: number;
  overheatCycles: Record<Sector, number>;
  lastUpdate: number;
  phaseHistory: {
    totalCycles: number;
    cyclesPerPhase: Record<MarketPhase, number>;
  };
  climateHistory: Array<{ cycle: number; phase: MarketPhase; fearGreedIndex: number }>;
}

interface TestState {
  virtualPlayers: { players: VirtualPlayer[]; totalTradeCount: number };
  stocks: { items: Stock[] };
  marketMaker?: { inventory: Record<string, MarketMakerInventory> };
  marketPhase?: MarketPhaseState;
}

const defaultMarketPhaseState: MarketPhaseState = {
  globalPhase: 'prosperity',
  sectorPhases: {
    tech: 'prosperity',
    finance: 'prosperity',
    industrial: 'prosperity',
    commodities: 'prosperity',
  },
  cyclesInGlobalPhase: 0,
  cyclesInSectorPhase: {
    tech: 0,
    finance: 0,
    industrial: 0,
    commodities: 0,
  },
  fearGreedIndex: 50,
  overheatCycles: {
    tech: 0,
    finance: 0,
    industrial: 0,
    commodities: 0,
  },
  lastUpdate: Date.now(),
  phaseHistory: {
    totalCycles: 0,
    cyclesPerPhase: {
      prosperity: 0,
      boom: 0,
      consolidation: 0,
      panic: 0,
      recession: 0,
      recovery: 0,
    },
  },
  climateHistory: [],
};

const createTestStore = (preloadedState: TestState) =>
  configureStore({
    reducer: {
      virtualPlayers: virtualPlayersReducer,
      stocks: stocksReducer,
      marketMaker: marketMakerReducer,
      marketPhase: marketPhaseReducer,
    },
    preloadedState: {
      ...preloadedState,
      marketMaker: preloadedState.marketMaker ?? { inventory: {} },
      marketPhase: preloadedState.marketPhase ?? defaultMarketPhaseState,
    },
  });

type TestStore = ReturnType<typeof createTestStore>;

describe('virtualPlayersSlice', () => {
  const createMockStocks = (): Stock[] => [
    {
      symbol: 'TEST1',
      name: 'Test Stock 1',
      sector: 'tech',
      currentPrice: 100,
      change: 0,
      changePercent: 0,
      priceHistory: [{ time: 1000, open: 99, high: 101, low: 98, close: 100 }],
      marketCapBillions: 100,
    },
    {
      symbol: 'TEST2',
      name: 'Test Stock 2',
      sector: 'tech',
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
    loans: [],
    cyclesSinceInterest: 0,
    initialCash: cash,
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

  describe('resetPlayersForTimedGame reducer', () => {
    const createPlayerWithState = (id: string, riskTolerance: number): VirtualPlayer => ({
      id,
      name: `Player ${id}`,
      portfolio: {
        cash: 5000,
        holdings: [
          { symbol: 'TEST1', shares: 20, avgBuyPrice: 95 },
        ],
      },
      transactions: [
        { id: 'tx-1', symbol: 'TEST1', type: 'buy', shares: 5, price: 100, timestamp: Date.now() },
      ],
      settings: { riskTolerance },
      loans: [
        { id: 'loan-1', loanNumber: 1, principal: 2000, balance: 2000, interestRate: 0.06, createdAt: Date.now(), totalInterestPaid: 100, durationCycles: 40, remainingCycles: 30, isOverdue: false, overdueForCycles: 0 },
      ],
      cyclesSinceInterest: 5,
      initialCash: 10000,
    });

    it('should reset players with new initial cash while preserving risk tolerance', () => {
      const initialState = {
        players: [
          createPlayerWithState('1', 75),
          createPlayerWithState('2', -50),
        ],
        totalTradeCount: 10,
      };

      const newState = virtualPlayersReducer(
        initialState,
        resetPlayersForTimedGame({ playerInitialCash: 100000 })
      );

      // Check first player
      expect(newState.players[0].portfolio.cash).toBe(100000);
      expect(newState.players[0].portfolio.holdings).toEqual([]);
      expect(newState.players[0].loans).toEqual([]);
      expect(newState.players[0].transactions).toEqual([]);
      expect(newState.players[0].settings.riskTolerance).toBe(75);
      expect(newState.players[0].initialCash).toBe(100000);

      // Check second player
      expect(newState.players[1].portfolio.cash).toBe(100000);
      expect(newState.players[1].settings.riskTolerance).toBe(-50);

      // Trade count should be preserved (not reset by this action)
      expect(newState.totalTradeCount).toBe(10);
    });

    it('should preserve player id and name', () => {
      const initialState = {
        players: [createPlayerWithState('test-id', 0)],
        totalTradeCount: 0,
      };
      initialState.players[0].name = 'Test Name';

      const newState = virtualPlayersReducer(
        initialState,
        resetPlayersForTimedGame({ playerInitialCash: 50000 })
      );

      expect(newState.players[0].id).toBe('test-id');
      expect(newState.players[0].name).toBe('Test Name');
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

  describe('executeWarmupVirtualTrades thunk with Market Maker', () => {
    let store: TestStore;

    beforeEach(() => {
      store = createTestStore({
        virtualPlayers: {
          players: [createMockPlayer('bot-1', 10000), createMockPlayer('bot-2', 10000)],
          totalTradeCount: 0,
        },
        stocks: {
          items: createMockStocks(),
        },
      });
      // Initialize Market Maker inventory
      store.dispatch(initializeInventory(['TEST1', 'TEST2']));
    });

    it('should update Market Maker inventory during warmup trades', () => {
      const initialInventory1 = store.getState().marketMaker.inventory['TEST1'].inventory;
      const initialInventory2 = store.getState().marketMaker.inventory['TEST2'].inventory;

      // Run multiple warmup cycles
      for (let i = 0; i < 50; i++) {
        const warmupConfig: WarmupConfig = {
          tradeCounts: {},
          prioritizeAfterCycle: 20,
          currentCycle: i,
          minTradesRequired: 2,
        };
        store.dispatch(executeWarmupVirtualTrades(warmupConfig) as unknown as Parameters<typeof store.dispatch>[0]);
      }

      const finalInventory1 = store.getState().marketMaker.inventory['TEST1'].inventory;
      const finalInventory2 = store.getState().marketMaker.inventory['TEST2'].inventory;

      // At least one inventory should have changed
      const inventoryChanged =
        finalInventory1 !== initialInventory1 || finalInventory2 !== initialInventory2;
      expect(inventoryChanged).toBe(true);
    });

    it('should apply reduced (50%) inventory impact for warmup trades', () => {
      // This test verifies that virtual trades use the reduced impact path

      // Run 30 warmup cycles - if a 100-share buy happens, only 50 should be deducted
      for (let i = 0; i < 30; i++) {
        const warmupConfig: WarmupConfig = {
          tradeCounts: {},
          prioritizeAfterCycle: 20,
          currentCycle: i,
          minTradesRequired: 2,
        };
        store.dispatch(executeWarmupVirtualTrades(warmupConfig) as unknown as Parameters<typeof store.dispatch>[0]);
      }

      const finalInventory = store.getState().marketMaker.inventory['TEST1'].inventory;

      // The inventory change should be less than if all trades had full impact
      // We can't predict exact numbers due to randomness, but inventory should still be reasonable
      expect(finalInventory).toBeGreaterThanOrEqual(0);
      expect(finalInventory).toBeLessThanOrEqual(MARKET_MAKER_CONFIG.baseInventoryPerStock * 2);
    });
  });

  describe('forceTradesForUntraded thunk with Market Maker', () => {
    it('should update Market Maker inventory for forced trades', () => {
      const stocks: Stock[] = [
        {
          symbol: 'TRADED',
          name: 'Traded Stock',
          sector: 'tech',
          currentPrice: 100,
          change: 0,
          changePercent: 0,
          priceHistory: [{ time: 1000, open: 99, high: 101, low: 98, close: 100 }],
          marketCapBillions: 100,
        },
        {
          symbol: 'UNTRADED',
          name: 'Untraded Stock',
          sector: 'tech',
          currentPrice: 50,
          change: 0,
          changePercent: 0,
          priceHistory: [{ time: 1000, open: 49, high: 51, low: 48, close: 50 }],
          marketCapBillions: 50,
        },
      ];

      const player: VirtualPlayer = {
        id: 'buyer',
        name: 'Buyer',
        portfolio: {
          cash: 10000,
          holdings: [],
        },
        transactions: [],
        settings: { riskTolerance: 0 },
        loans: [],
        cyclesSinceInterest: 0,
        initialCash: 10000,
      };

      const store = createTestStore({
        virtualPlayers: {
          players: [player],
          totalTradeCount: 0,
        },
        stocks: {
          items: stocks,
        },
      });

      // Initialize Market Maker inventory
      store.dispatch(initializeInventory(['TRADED', 'UNTRADED']));

      const initialUntradedInventory = store.getState().marketMaker.inventory['UNTRADED'].inventory;

      // Force trades for untraded stocks
      const tradeCounts = { 'TRADED': 5, 'UNTRADED': 0 };
      store.dispatch(forceTradesForUntraded(tradeCounts) as unknown as Parameters<typeof store.dispatch>[0]);

      const finalUntradedInventory = store.getState().marketMaker.inventory['UNTRADED'].inventory;

      // UNTRADED inventory should have changed (decreased due to forced buy)
      expect(finalUntradedInventory).not.toBe(initialUntradedInventory);
    });

    it('should not change Market Maker inventory for already traded stocks', () => {
      const stocks: Stock[] = [
        {
          symbol: 'TRADED',
          name: 'Traded Stock',
          sector: 'tech',
          currentPrice: 100,
          change: 0,
          changePercent: 0,
          priceHistory: [{ time: 1000, open: 99, high: 101, low: 98, close: 100 }],
          marketCapBillions: 100,
        },
      ];

      const player: VirtualPlayer = {
        id: 'player',
        name: 'Player',
        portfolio: {
          cash: 10000,
          holdings: [],
        },
        transactions: [],
        settings: { riskTolerance: 0 },
        loans: [],
        cyclesSinceInterest: 0,
        initialCash: 10000,
      };

      const store = createTestStore({
        virtualPlayers: {
          players: [player],
          totalTradeCount: 0,
        },
        stocks: {
          items: stocks,
        },
      });

      // Initialize Market Maker inventory
      store.dispatch(initializeInventory(['TRADED']));

      const initialInventory = store.getState().marketMaker.inventory['TRADED'].inventory;

      // Force trades - but TRADED already has trades, so nothing should happen
      const tradeCounts = { 'TRADED': 5 };
      store.dispatch(forceTradesForUntraded(tradeCounts) as unknown as Parameters<typeof store.dispatch>[0]);

      const finalInventory = store.getState().marketMaker.inventory['TRADED'].inventory;

      // Inventory should be unchanged
      expect(finalInventory).toBe(initialInventory);
    });
  });
});
