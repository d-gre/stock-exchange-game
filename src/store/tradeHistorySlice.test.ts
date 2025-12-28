import { describe, it, expect } from 'vitest';
import tradeHistoryReducer, {
  addCompletedTrade,
  updatePortfolioValueHistory,
  resetTradeHistory,
  selectAllTrades,
  selectTotalRealizedProfitLoss,
  selectRiskProfile,
} from './tradeHistorySlice';
import type { CompletedTrade } from '../types';
import type { RootState } from './index';
import { CONFIG } from '../config';

/** Creates a partial RootState for selector tests */
const createTestState = (tradeHistory: RootState['tradeHistory']): RootState =>
  ({ tradeHistory }) as RootState;

describe('tradeHistorySlice', () => {
  const createMockTrade = (overrides: Partial<CompletedTrade> = {}): CompletedTrade => ({
    id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    symbol: 'AAPL',
    type: 'buy',
    shares: 10,
    pricePerShare: 150,
    totalAmount: 1500,
    timestamp: Date.now(),
    ...overrides,
  });

  describe('addCompletedTrade', () => {
    it('should add a trade to the history', () => {
      const trade = createMockTrade();
      const newState = tradeHistoryReducer(
        { trades: [] as CompletedTrade[], portfolioValueHistory: [{ timestamp: Date.now(), value: 10000, realizedProfitLoss: 0 }] },
        addCompletedTrade(trade)
      );

      expect(newState.trades).toHaveLength(1);
      expect(newState.trades[0]).toEqual(trade);
    });

    it('should prepend new trades (most recent first)', () => {
      const trade1 = createMockTrade({ id: 'trade-1', timestamp: 1000 });
      const initialState = {
        trades: [trade1],
        portfolioValueHistory: [{ timestamp: Date.now(), value: 10000, realizedProfitLoss: 0 }],
      };

      const trade2 = createMockTrade({ id: 'trade-2', timestamp: 2000 });
      const newState = tradeHistoryReducer(initialState, addCompletedTrade(trade2));

      expect(newState.trades).toHaveLength(2);
      expect(newState.trades[0].id).toBe('trade-2');
      expect(newState.trades[1].id).toBe('trade-1');
    });

    it('should limit trades to 100', () => {
      const initialTrades = Array.from({ length: 100 }, (_, i) =>
        createMockTrade({ id: `trade-${i}` })
      );
      const initialState = {
        trades: initialTrades,
        portfolioValueHistory: [{ timestamp: Date.now(), value: 10000, realizedProfitLoss: 0 }],
      };

      const newTrade = createMockTrade({ id: 'new-trade' });
      const newState = tradeHistoryReducer(initialState, addCompletedTrade(newTrade));

      expect(newState.trades).toHaveLength(100);
      expect(newState.trades[0].id).toBe('new-trade');
      expect(newState.trades[99].id).toBe('trade-98'); // Oldest kept (trade-99 was dropped)
    });
  });

  describe('updatePortfolioValueHistory', () => {
    it('should add a new portfolio value point', () => {
      const newState = tradeHistoryReducer(
        { trades: [] as CompletedTrade[], portfolioValueHistory: [{ timestamp: 1000, value: 10000, realizedProfitLoss: 0 }] },
        updatePortfolioValueHistory({ portfolioValue: 11000, realizedProfitLoss: 500 })
      );

      expect(newState.portfolioValueHistory).toHaveLength(2);
      expect(newState.portfolioValueHistory[1].value).toBe(11000);
      expect(newState.portfolioValueHistory[1].realizedProfitLoss).toBe(500);
    });

    it('should limit history to 100 points', () => {
      const initialHistory = Array.from({ length: 100 }, (_, i) => ({
        timestamp: i * 1000,
        value: 10000 + i * 100,
        realizedProfitLoss: i * 10,
      }));

      const newState = tradeHistoryReducer(
        { trades: [] as CompletedTrade[], portfolioValueHistory: initialHistory },
        updatePortfolioValueHistory({ portfolioValue: 20000, realizedProfitLoss: 1000 })
      );

      expect(newState.portfolioValueHistory).toHaveLength(100);
      expect(newState.portfolioValueHistory[99].value).toBe(20000);
    });

    it('should ensure strictly ascending timestamps even with rapid updates', () => {
      const baseTimestamp = Date.now();

      // Simulate rapid consecutive updates (same millisecond)
      let state: { trades: CompletedTrade[]; portfolioValueHistory: Array<{ timestamp: number; value: number; realizedProfitLoss: number }> } = {
        trades: [],
        portfolioValueHistory: [{ timestamp: baseTimestamp, value: 10000, realizedProfitLoss: 0 }],
      };
      for (let i = 0; i < 10; i++) {
        state = tradeHistoryReducer(
          state,
          updatePortfolioValueHistory({ portfolioValue: 10000 + i * 100, realizedProfitLoss: i * 10 })
        );
      }

      expect(state.portfolioValueHistory).toHaveLength(11);

      // Verify all timestamps are strictly ascending
      for (let i = 1; i < state.portfolioValueHistory.length; i++) {
        const prev = state.portfolioValueHistory[i - 1].timestamp;
        const curr = state.portfolioValueHistory[i].timestamp;
        expect(curr).toBeGreaterThan(prev);
      }
    });

    it('should handle timestamp collision by incrementing', () => {
      const fixedTimestamp = 1000000;

      // Even if Date.now() returns same value, timestamps must be unique
      const newState = tradeHistoryReducer(
        { trades: [] as CompletedTrade[], portfolioValueHistory: [{ timestamp: fixedTimestamp, value: 10000, realizedProfitLoss: 0 }] },
        updatePortfolioValueHistory({ portfolioValue: 11000, realizedProfitLoss: 100 })
      );

      expect(newState.portfolioValueHistory[1].timestamp).toBeGreaterThan(fixedTimestamp);
    });
  });

  describe('resetTradeHistory', () => {
    it('should reset trades and history', () => {
      const initialState = {
        trades: [createMockTrade()],
        portfolioValueHistory: [
          { timestamp: 1000, value: 10000, realizedProfitLoss: 0 },
          { timestamp: 2000, value: 11000, realizedProfitLoss: 500 },
        ],
      };

      const newState = tradeHistoryReducer(initialState, resetTradeHistory());

      expect(newState.trades).toHaveLength(0);
      expect(newState.portfolioValueHistory).toHaveLength(1);
      expect(newState.portfolioValueHistory[0].value).toBe(CONFIG.initialCash);
      expect(newState.portfolioValueHistory[0].realizedProfitLoss).toBe(0);
    });
  });

  describe('selectors', () => {
    describe('selectAllTrades', () => {
      it('should return all trades', () => {
        const trades = [createMockTrade(), createMockTrade()];
        const state = createTestState({
          trades,
          portfolioValueHistory: [],
        });

        expect(selectAllTrades(state)).toEqual(trades);
      });
    });

    describe('selectTotalRealizedProfitLoss', () => {
      it('should sum realized P/L from sell trades', () => {
        const trades = [
          createMockTrade({ type: 'buy' }),
          createMockTrade({ type: 'sell', realizedProfitLoss: 100 }),
          createMockTrade({ type: 'sell', realizedProfitLoss: -50 }),
          createMockTrade({ type: 'sell', realizedProfitLoss: 200 }),
        ];
        const state = createTestState({
          trades,
          portfolioValueHistory: [],
        });

        expect(selectTotalRealizedProfitLoss(state)).toBe(250);
      });

      it('should return 0 if no sell trades', () => {
        const trades = [createMockTrade({ type: 'buy' })];
        const state = createTestState({
          trades,
          portfolioValueHistory: [],
        });

        expect(selectTotalRealizedProfitLoss(state)).toBe(0);
      });
    });

    describe('selectRiskProfile', () => {
      it('should return null if fewer than 2 trades', () => {
        const state = createTestState({
          trades: [createMockTrade()],
          portfolioValueHistory: [],
        });

        expect(selectRiskProfile(state)).toBeNull();
      });

      it('should calculate risk profile for multiple trades', () => {
        const now = Date.now();
        const trades = [
          createMockTrade({
            type: 'buy',
            shares: 10,
            totalAmount: 1500,
            timestamp: now,
          }),
          createMockTrade({
            type: 'sell',
            shares: 10,
            totalAmount: 1600,
            realizedProfitLoss: 100,
            avgBuyPrice: 150,
            timestamp: now + 60000,
          }),
          createMockTrade({
            type: 'buy',
            shares: 5,
            totalAmount: 800,
            timestamp: now + 120000,
          }),
        ];
        const state = createTestState({
          trades,
          portfolioValueHistory: [],
        });

        const profile = selectRiskProfile(state);

        expect(profile).not.toBeNull();
        expect(profile!.totalTrades).toBe(3);
        expect(profile!.totalRealizedProfitLoss).toBe(100);
        expect(profile!.category).toMatch(/conservative|moderate|aggressive/);
        expect(profile!.riskScore).toBeGreaterThanOrEqual(-100);
        expect(profile!.riskScore).toBeLessThanOrEqual(100);
      });

      it('should classify conservative trader correctly', () => {
        const now = Date.now();
        // Small positions, quick stop-losses
        const trades = [
          createMockTrade({
            type: 'buy',
            shares: 1,
            totalAmount: 150,
            timestamp: now,
          }),
          createMockTrade({
            type: 'sell',
            shares: 1,
            totalAmount: 145,
            realizedProfitLoss: -5,
            avgBuyPrice: 150,
            timestamp: now + 30000, // Quick sell on loss
          }),
        ];
        const state = createTestState({
          trades,
          portfolioValueHistory: [],
        });

        const profile = selectRiskProfile(state);

        expect(profile).not.toBeNull();
        // Small position size should contribute to lower risk score
        expect(profile!.avgPositionSizePercent).toBeLessThan(10);
      });

      it('should calculate win/loss ratio correctly', () => {
        const now = Date.now();
        const trades = [
          createMockTrade({ type: 'buy', timestamp: now }),
          createMockTrade({
            type: 'sell',
            realizedProfitLoss: 100,
            timestamp: now + 1000,
          }),
          createMockTrade({ type: 'buy', timestamp: now + 2000 }),
          createMockTrade({
            type: 'sell',
            realizedProfitLoss: -50,
            timestamp: now + 3000,
          }),
          createMockTrade({ type: 'buy', timestamp: now + 4000 }),
          createMockTrade({
            type: 'sell',
            realizedProfitLoss: 75,
            timestamp: now + 5000,
          }),
        ];
        const state = createTestState({
          trades,
          portfolioValueHistory: [],
        });

        const profile = selectRiskProfile(state);

        expect(profile).not.toBeNull();
        expect(profile!.winLossRatio).toBe(2); // 2 wins / 1 loss
        expect(profile!.avgWin).toBe(87.5); // (100 + 75) / 2
        expect(profile!.avgLoss).toBe(50);
      });
    });
  });
});
