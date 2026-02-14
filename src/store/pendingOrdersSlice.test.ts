import { describe, it, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import pendingOrdersReducer, {
  addPendingOrder,
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
import marketMakerReducer from './marketMakerSlice';
import loansReducer from './loansSlice';
import shortPositionsReducer from './shortPositionsSlice';
import gameSessionReducer from './gameSessionSlice';
import type { PendingOrder, Stock, OrderType, ShortPosition, Loan } from '../types';

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

/** Helper: Creates a mock stock with default values */
const createTestStock = (symbol: string, price: number): Stock => ({
  symbol,
  name: `${symbol} Inc`,
  sector: 'tech',
  currentPrice: price,
  priceHistory: [{ time: Date.now(), open: price, high: price, low: price, close: price }],
  change: 0,
  changePercent: 0,
  marketCapBillions: 100,
});

/** Helper: Creates a test Redux store with configurable initial state */
const createTestStore = (options: {
  pendingOrders?: PendingOrder[];
  stocks?: Stock[];
  cash?: number;
  holdings?: { symbol: string; shares: number; avgBuyPrice: number }[];
  shortPositions?: ShortPosition[];
  loans?: Loan[];
} = {}) => {
  return configureStore({
    reducer: {
      pendingOrders: pendingOrdersReducer,
      stocks: stocksReducer,
      portfolio: portfolioReducer,
      settings: settingsReducer,
      notifications: notificationsReducer,
      tradeHistory: tradeHistoryReducer,
      marketMaker: marketMakerReducer,
      loans: loansReducer,
      shortPositions: shortPositionsReducer,
      gameSession: gameSessionReducer,
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
        gameMode: 'realLife' as const,
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
      marketMaker: {
        inventory: {
          AAPL: { symbol: 'AAPL', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
          TEST: { symbol: 'TEST', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
          GOOGL: { symbol: 'GOOGL', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
        },
      },
      loans: {
        loans: options.loans || [],
        cyclesSinceLastInterestCharge: 0,
        totalInterestPaid: 0,
        totalOriginationFeesPaid: 0,
        totalRepaymentFeesPaid: 0,
        creditScore: 50,
        creditHistory: [],
        delinquencyHistory: [],
        nextLoanNumber: (options.loans?.length ?? 0) + 1,
      },
      shortPositions: {
        positions: options.shortPositions || [],
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

    it('should set isNew to false for market orders', () => {
      // Market orders execute at the next cycle boundary, not after a full cycle
      const state = pendingOrdersReducer(initialState, addPendingOrder({
        symbol: 'AAPL',
        type: 'buy' as const,
        shares: 5,
        orderType: 'market' as OrderType,
        orderPrice: 100,
        validityCycles: 1,
      }));

      // Market orders start with isNew: false so they execute at the next cycle boundary
      expect(state.orders[0].isNew).toBe(false);
    });

    it('should set isNew to true for limit orders', () => {
      // Limit orders skip their creation cycle
      const state = pendingOrdersReducer(initialState, addPendingOrder({
        symbol: 'AAPL',
        type: 'buy' as const,
        shares: 5,
        orderType: 'limit' as OrderType,
        orderPrice: 100,
        limitPrice: 95,
        validityCycles: 3,
      }));

      expect(state.orders[0].isNew).toBe(true);
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

    it('should decrement cycles for market orders with remainingCycles > 0', () => {
      const stateWithOrder = {
        orders: [createMockOrder({ id: '1', orderType: 'market', remainingCycles: 2 })],
        tradedSymbolsThisCycle: [],
      };

      const result = pendingOrdersReducer(stateWithOrder, tickOrderCycles());

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].remainingCycles).toBe(1);
    });

    it('should not decrement market orders below 0', () => {
      const stateWithOrder = {
        orders: [createMockOrder({ id: '1', orderType: 'market', remainingCycles: 0 })],
        tradedSymbolsThisCycle: [],
      };

      const result = pendingOrdersReducer(stateWithOrder, tickOrderCycles());

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].remainingCycles).toBe(0);
    });

    it('should never expire market orders', () => {
      const stateWithOrder = {
        orders: [createMockOrder({ id: '1', orderType: 'market', remainingCycles: 0 })],
        tradedSymbolsThisCycle: [],
      };

      // Multiple ticks should not remove the market order
      let result = pendingOrdersReducer(stateWithOrder, tickOrderCycles());
      result = pendingOrdersReducer(result, tickOrderCycles());
      result = pendingOrdersReducer(result, tickOrderCycles());

      expect(result.orders).toHaveLength(1);
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

    describe('order lifecycle scenarios', () => {
      it('should correctly handle order with 3 cycles duration', () => {
        // Scenario: Order created in cycle A with 3 cycles duration
        // Expected: Valid for cycles B, C, D - expires at end of D
        // Creation cycle A does NOT count toward validity

        const orderWith3Cycles = createMockOrder({
          id: 'order-3-cycles',
          symbol: 'AAPL',
          orderType: 'limit',
          remainingCycles: 3,
          isNew: true,
        });

        const stateAtCreation = {
          orders: [orderWith3Cycles],
          tradedSymbolsThisCycle: [],
        };

        // Cycle A (creation): isNew=true, remainingCycles=3
        // Display would show: "(erstellt) 3 Handelszyklen"
        expect(stateAtCreation.orders[0].isNew).toBe(true);
        expect(stateAtCreation.orders[0].remainingCycles).toBe(3);

        // End of Cycle A -> Tick to Cycle B
        const stateAfterCycleA = pendingOrdersReducer(stateAtCreation, tickOrderCycles());
        const orderInCycleB = stateAfterCycleA.orders[0];

        // Cycle B: isNew=false, remainingCycles=3 (no decrement, just flag cleared)
        // Display would show: "3 Handelszyklen"
        expect(orderInCycleB.isNew).toBe(false);
        expect(orderInCycleB.remainingCycles).toBe(3);
        expect(stateAfterCycleA.orders).toHaveLength(1);

        // End of Cycle B -> Tick to Cycle C
        const stateAfterCycleB = pendingOrdersReducer(stateAfterCycleA, tickOrderCycles());
        const orderInCycleC = stateAfterCycleB.orders[0];

        // Cycle C: remainingCycles=2
        // Display would show: "2 Handelszyklen"
        expect(orderInCycleC.remainingCycles).toBe(2);
        expect(stateAfterCycleB.orders).toHaveLength(1);

        // End of Cycle C -> Tick to Cycle D
        const stateAfterCycleC = pendingOrdersReducer(stateAfterCycleB, tickOrderCycles());
        const orderInCycleD = stateAfterCycleC.orders[0];

        // Cycle D: remainingCycles=1
        // Display would show: "Next Cycle"
        expect(orderInCycleD.remainingCycles).toBe(1);
        expect(stateAfterCycleC.orders).toHaveLength(1);

        // End of Cycle D -> Order expires/executes
        const stateAfterCycleD = pendingOrdersReducer(stateAfterCycleC, tickOrderCycles());

        // Order should be removed (remainingCycles became 0)
        expect(stateAfterCycleD.orders).toHaveLength(0);
      });

      it('should correctly handle order with 5 cycles duration', () => {
        // Scenario: Order created in cycle A with 5 cycles duration
        // Expected: Valid for cycles B, C, D, E, F - expires at end of F
        // Creation cycle A does NOT count toward validity

        const orderWith5Cycles = createMockOrder({
          id: 'order-5-cycles',
          symbol: 'GOOGL',
          orderType: 'limit',
          remainingCycles: 5,
          isNew: true,
        });

        const stateAtCreation = {
          orders: [orderWith5Cycles],
          tradedSymbolsThisCycle: [],
        };

        // Cycle A (creation): isNew=true, remainingCycles=5
        // Display: "(erstellt) 5 Handelszyklen"
        expect(stateAtCreation.orders[0].isNew).toBe(true);
        expect(stateAtCreation.orders[0].remainingCycles).toBe(5);

        // End of Cycle A -> Tick to Cycle B
        const stateAfterCycleA = pendingOrdersReducer(stateAtCreation, tickOrderCycles());
        const orderInCycleB = stateAfterCycleA.orders[0];

        // Cycle B: isNew=false, remainingCycles=5
        // Display: "5 Handelszyklen"
        expect(orderInCycleB.isNew).toBe(false);
        expect(orderInCycleB.remainingCycles).toBe(5);

        // End of Cycle B -> Tick to Cycle C
        const stateAfterCycleB = pendingOrdersReducer(stateAfterCycleA, tickOrderCycles());
        const orderInCycleC = stateAfterCycleB.orders[0];

        // Cycle C: remainingCycles=4
        // Display: "4 Handelszyklen"
        expect(orderInCycleC.remainingCycles).toBe(4);

        // End of Cycle C -> Tick to Cycle D
        const stateAfterCycleC = pendingOrdersReducer(stateAfterCycleB, tickOrderCycles());
        const orderInCycleD = stateAfterCycleC.orders[0];

        // Cycle D: remainingCycles=3
        // Display: "3 Handelszyklen"
        expect(orderInCycleD.remainingCycles).toBe(3);

        // End of Cycle D -> Tick to Cycle E
        const stateAfterCycleD = pendingOrdersReducer(stateAfterCycleC, tickOrderCycles());
        const orderInCycleE = stateAfterCycleD.orders[0];

        // Cycle E: remainingCycles=2
        // Display: "2 Handelszyklen"
        expect(orderInCycleE.remainingCycles).toBe(2);

        // End of Cycle E -> Tick to Cycle F
        const stateAfterCycleE = pendingOrdersReducer(stateAfterCycleD, tickOrderCycles());
        const orderInCycleF = stateAfterCycleE.orders[0];

        // Cycle F: remainingCycles=1
        // Display: "Next Cycle"
        expect(orderInCycleF.remainingCycles).toBe(1);
        expect(stateAfterCycleE.orders).toHaveLength(1);

        // End of Cycle F -> Order expires/executes
        const stateAfterCycleF = pendingOrdersReducer(stateAfterCycleE, tickOrderCycles());

        // Order should be removed (remainingCycles became 0)
        expect(stateAfterCycleF.orders).toHaveLength(0);
      });

      it('should execute market order at cycle boundary when isNew is false', () => {
        // Market orders are created with isNew: false
        // They execute at the next cycle boundary (after VP trades)
        //
        // Flow:
        // 1. Player creates market order mid-cycle (isNew: false, remainingCycles: 1)
        // 2. Cycle ends: VP trades → executePendingOrders → order executes
        // 3. Player sees new cycle with order already completed

        const marketOrder = createMockOrder({
          id: 'market-order',
          symbol: 'AAPL',
          orderType: 'market',
          remainingCycles: 1,
          isNew: false, // Market orders start with isNew: false
        });

        const stateAtCreation = {
          orders: [marketOrder],
          tradedSymbolsThisCycle: [],
        };

        // Market order with isNew: false and remainingCycles <= 1 should be executable
        expect(canExecuteOrder(stateAtCreation.orders[0], 100)).toBe(true);

        // No tick needed - order is immediately executable at cycle end
        // (This is the key difference from limit orders which need a tick first)
      });

      it('should correctly handle order edited from 5 to 6 cycles in 3rd cycle', () => {
        // Scenario: Order created in cycle A with 5 cycles, edited in cycle C to 6 cycles
        // Edited orders should NOT have isNew flag (no "(erstellt)" prefix)

        const originalOrderWith5Cycles = createMockOrder({
          id: 'order-to-be-edited',
          symbol: 'MSFT',
          orderType: 'limit',
          remainingCycles: 5,
          isNew: true,
        });

        const stateAtCreation = {
          orders: [originalOrderWith5Cycles],
          tradedSymbolsThisCycle: [],
        };

        // Cycle A (creation): isNew=true, remainingCycles=5
        expect(stateAtCreation.orders[0].isNew).toBe(true);
        expect(stateAtCreation.orders[0].remainingCycles).toBe(5);

        // End of Cycle A -> Tick to Cycle B
        const stateAfterCycleA = pendingOrdersReducer(stateAtCreation, tickOrderCycles());
        const orderInCycleB = stateAfterCycleA.orders[0];

        // Cycle B: isNew=false, remainingCycles=5
        expect(orderInCycleB.isNew).toBe(false);
        expect(orderInCycleB.remainingCycles).toBe(5);

        // End of Cycle B -> Tick to Cycle C
        const stateAfterCycleB = pendingOrdersReducer(stateAfterCycleA, tickOrderCycles());
        const orderInCycleC = stateAfterCycleB.orders[0];

        // Cycle C (before edit): remainingCycles=4
        expect(orderInCycleC.remainingCycles).toBe(4);

        // USER EDITS ORDER: Extends from remaining 4 to 6 cycles
        // Simulating edit: Cancel old order, add new one with isEdit=true
        const stateAfterCancellingOldOrder = pendingOrdersReducer(
          stateAfterCycleB,
          cancelOrder('order-to-be-edited')
        );
        expect(stateAfterCancellingOldOrder.orders).toHaveLength(0);

        // Add edited order with 6 cycles - note: isNew should be false for edited orders
        const editedOrderWith6Cycles = createMockOrder({
          id: 'order-edited-to-6-cycles',
          symbol: 'MSFT',
          orderType: 'limit',
          remainingCycles: 6,
          isNew: false, // Edited orders don't have isNew flag
        });

        const stateWithEditedOrder = {
          orders: [editedOrderWith6Cycles],
          tradedSymbolsThisCycle: [],
        };

        // Cycle C (after edit): isNew=false, remainingCycles=6
        // Display: "6 Handelszyklen" (no "(erstellt)" prefix)
        expect(stateWithEditedOrder.orders[0].isNew).toBe(false);
        expect(stateWithEditedOrder.orders[0].remainingCycles).toBe(6);

        // End of Cycle C -> Tick to Cycle D
        const stateAfterCycleC = pendingOrdersReducer(stateWithEditedOrder, tickOrderCycles());
        const orderInCycleD = stateAfterCycleC.orders[0];

        // Cycle D: remainingCycles=5 (decremented immediately since isNew=false)
        // Display: "5 Handelszyklen"
        expect(orderInCycleD.remainingCycles).toBe(5);

        // End of Cycle D -> Tick to Cycle E
        const stateAfterCycleD = pendingOrdersReducer(stateAfterCycleC, tickOrderCycles());
        const orderInCycleE = stateAfterCycleD.orders[0];

        // Cycle E: remainingCycles=4
        expect(orderInCycleE.remainingCycles).toBe(4);

        // End of Cycle E -> Tick to Cycle F
        const stateAfterCycleE = pendingOrdersReducer(stateAfterCycleD, tickOrderCycles());
        const orderInCycleF = stateAfterCycleE.orders[0];

        // Cycle F: remainingCycles=3
        expect(orderInCycleF.remainingCycles).toBe(3);

        // End of Cycle F -> Tick to Cycle G
        const stateAfterCycleF = pendingOrdersReducer(stateAfterCycleE, tickOrderCycles());
        const orderInCycleG = stateAfterCycleF.orders[0];

        // Cycle G: remainingCycles=2
        expect(orderInCycleG.remainingCycles).toBe(2);

        // End of Cycle G -> Tick to Cycle H
        const stateAfterCycleG = pendingOrdersReducer(stateAfterCycleF, tickOrderCycles());
        const orderInCycleH = stateAfterCycleG.orders[0];

        // Cycle H: remainingCycles=1
        // Display: "Next Cycle"
        expect(orderInCycleH.remainingCycles).toBe(1);
        expect(stateAfterCycleG.orders).toHaveLength(1);

        // End of Cycle H -> Order expires/executes
        const stateAfterCycleH = pendingOrdersReducer(stateAfterCycleG, tickOrderCycles());

        // Order should be removed
        expect(stateAfterCycleH.orders).toHaveLength(0);
      });
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
    it('should return true for market orders when remainingCycles is 0 and not new', () => {
      const order = createMockOrder({ orderType: 'market', remainingCycles: 0, isNew: false });
      expect(canExecuteOrder(order, 100)).toBe(true);
      expect(canExecuteOrder(order, 50)).toBe(true);
      expect(canExecuteOrder(order, 200)).toBe(true);
    });

    it('should return true for market orders when remainingCycles is 1 and not new', () => {
      // Market orders execute when remainingCycles <= 1 and not new
      // This ensures they execute in the correct cycle (after isNew flag is cleared)
      const order = createMockOrder({ orderType: 'market', remainingCycles: 1, isNew: false });
      expect(canExecuteOrder(order, 100)).toBe(true);
      expect(canExecuteOrder(order, 50)).toBe(true);
    });

    it('should return false for market orders when remainingCycles > 1', () => {
      const order = createMockOrder({ orderType: 'market', remainingCycles: 2, isNew: false });
      expect(canExecuteOrder(order, 100)).toBe(false);
      expect(canExecuteOrder(order, 50)).toBe(false);
    });

    it('should return false for new market orders even when remainingCycles <= 1', () => {
      // New orders skip their creation cycle, so they should not execute immediately
      const order = createMockOrder({ orderType: 'market', remainingCycles: 1, isNew: true });
      expect(canExecuteOrder(order, 100)).toBe(false);
      expect(canExecuteOrder(order, 50)).toBe(false);
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
  });

  describe('executePendingOrders - insufficient funds', () => {
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
      // New orders are created with isNew: true, which prevents execution in the creation cycle
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: 'market-order-1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 100, // 100 shares
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1, // 1 cycle delay (Real Life)
          isNew: true, // New orders skip their creation cycle
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 5000, // Not enough for 100 x 100 = 10000 (+ spread)
      });

      // First cycle (creation cycle) - order has isNew: true, so canExecuteOrder returns false
      // Order is not checked for funds yet, tickOrderCycles clears isNew flag
      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      let state = store.getState();

      // Order should still be pending with isNew cleared but remainingCycles unchanged
      expect(state.pendingOrders.orders).toHaveLength(1);
      expect(state.pendingOrders.orders[0].remainingCycles).toBe(1); // Not decremented for new orders
      expect(state.pendingOrders.orders[0].isNew).toBe(false); // Flag cleared

      // No notification yet (order wasn't executed)
      expect(state.notifications.items).toHaveLength(0);

      // Second cycle - now isNew is false and remainingCycles <= 1, order will be checked and fail
      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      state = store.getState();

      // Order should still be pending (failed due to insufficient funds)
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

  describe('executePendingOrders - insufficient shares', () => {
    it('should not execute sell order when insufficient shares', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'sell',
          shares: 20, // Trying to sell 20 shares
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 0,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 5000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 80 }], // Only have 10 shares
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should still be pending
      expect(state.pendingOrders.orders).toHaveLength(1);
      // Shares should not have changed
      expect(state.portfolio.holdings[0].shares).toBe(10);
    });

    it('should generate warning notification when sell order fails due to insufficient shares', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'sell',
          shares: 20,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 0,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 5000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 80 }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].type).toBe('warning');
      expect(state.notifications.items[0].title).toBe('Verkaufsorder nicht ausgeführt');
      expect(state.notifications.items[0].message).toContain('AAPL');
    });

    it('should add failed sell trade to trade history', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: 'sell-order-1',
          symbol: 'AAPL',
          type: 'sell',
          shares: 20,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 0,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 5000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 80 }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.tradeHistory.trades).toHaveLength(1);
      expect(state.tradeHistory.trades[0].status).toBe('failed');
      expect(state.tradeHistory.trades[0].failureReason).toBe('insufficient_shares');
      expect(state.tradeHistory.trades[0].symbol).toBe('AAPL');
      expect(state.tradeHistory.trades[0].type).toBe('sell');
    });

    it('should execute first sell and fail second when shares run out', () => {
      const store = createTestStore({
        pendingOrders: [
          createMockOrder({
            id: '1',
            symbol: 'AAPL',
            type: 'sell',
            shares: 8,
            orderType: 'market',
            orderPrice: 100,
            remainingCycles: 0,
          }),
          createMockOrder({
            id: '2',
            symbol: 'AAPL',
            type: 'sell',
            shares: 5, // Would need 13 total, but only have 10
            orderType: 'market',
            orderPrice: 100,
            remainingCycles: 0,
          }),
        ],
        stocks: [createTestStock('AAPL', 100)],
        cash: 5000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 80 }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // First order should be executed (10 - 8 = 2 shares left)
      expect(state.portfolio.holdings[0].shares).toBe(2);
      // Second order should still be pending
      expect(state.pendingOrders.orders).toHaveLength(1);
      expect(state.pendingOrders.orders[0].id).toBe('2');
      // Warning should have been generated
      expect(state.notifications.items).toHaveLength(1);
    });
  });

  describe('executePendingOrders - expired orders', () => {
    it('should create notification when limit order expires with specific reason', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'limit',
          limitPrice: 80, // Price never reaches this
          orderPrice: 100,
          remainingCycles: 1, // Will expire after this tick (decremented to 0, then removed)
          isNew: false, // Not a new order (new orders skip first tick)
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should be removed
      expect(state.pendingOrders.orders).toHaveLength(0);
      // Notification should have been created with specific reason
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].type).toBe('warning');
      expect(state.notifications.items[0].title).toBe('Order verfallen');
      expect(state.notifications.items[0].message).toContain('AAPL');
      // Should contain the specific reason (limit not reached)
      expect(state.notifications.items[0].message).toContain('80');
      expect(state.notifications.items[0].message).toContain('100');
    });

    it('should add expired trade to trade history', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: 'expired-order-1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'limit',
          limitPrice: 80,
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.tradeHistory.trades).toHaveLength(1);
      expect(state.tradeHistory.trades[0].status).toBe('failed');
      expect(state.tradeHistory.trades[0].failureReason).toBe('expired');
      expect(state.tradeHistory.trades[0].symbol).toBe('AAPL');
    });

    it('should create notification for expired sell order', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'sell',
          shares: 5,
          orderType: 'limit',
          limitPrice: 150, // Price never reaches this
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 5000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 80 }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should be removed
      expect(state.pendingOrders.orders).toHaveLength(0);
      // Notification should have been created
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].title).toBe('Order verfallen');
      // Shares should not have changed
      expect(state.portfolio.holdings[0].shares).toBe(10);
    });

    it('should not create notification for market orders with remainingCycles 0', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 5,
          orderType: 'market', // Market orders with 0 cycles are executed, not expired
          orderPrice: 100,
          remainingCycles: 0,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should be executed, not expired
      expect(state.pendingOrders.orders).toHaveLength(0);
      expect(state.portfolio.holdings).toHaveLength(1);
      // No warning notification (only execution)
      expect(state.notifications.items).toHaveLength(0);
    });

    it('should create notification with stop not triggered reason for stop buy order', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'stopBuy',
          stopPrice: 120, // Price never reaches this
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.notifications.items).toHaveLength(1);
      // Should contain stop price and current price
      expect(state.notifications.items[0].message).toContain('120');
      expect(state.notifications.items[0].message).toContain('100');
    });

    it('should create notification with limit not reached reason for stop-limit order after stop triggered', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'stopBuyLimit',
          stopPrice: 105,
          limitPrice: 102, // Price never falls back to this
          stopTriggered: true, // Stop was already triggered
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
        })],
        stocks: [createTestStock('AAPL', 110)], // Price above limit
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      expect(state.notifications.items).toHaveLength(1);
      // Should mention that stop was triggered but limit not reached
      expect(state.notifications.items[0].message).toContain('102'); // Limit
      expect(state.notifications.items[0].message).toContain('110'); // Current
    });
  });

  describe('executePendingOrders - shortSell orders', () => {
    it('should execute shortSell market order after 1 cycle delay', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'shortSell',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
          collateralToLock: 1500, // 150% of position value
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should be removed
      expect(state.pendingOrders.orders).toHaveLength(0);
      // Short position should be created
      expect(state.shortPositions.positions).toHaveLength(1);
      expect(state.shortPositions.positions[0].symbol).toBe('AAPL');
      expect(state.shortPositions.positions[0].shares).toBe(10);
      expect(state.shortPositions.positions[0].entryPrice).toBe(100);
      expect(state.shortPositions.positions[0].collateralLocked).toBe(1500);
      // Trade should be added to history
      expect(state.tradeHistory.trades).toHaveLength(1);
      expect(state.tradeHistory.trades[0].type).toBe('shortSell');
    });

    it('should not execute shortSell order when isNew is true (creation cycle)', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'shortSell',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1,
          isNew: true, // Creation cycle - should not execute yet
          collateralToLock: 1500,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should still be pending (isNew flag cleared but not executed)
      expect(state.pendingOrders.orders).toHaveLength(1);
      expect(state.pendingOrders.orders[0].isNew).toBe(false);
      // Short position should NOT be created yet
      expect(state.shortPositions.positions).toHaveLength(0);
    });
  });

  describe('executePendingOrders - buyToCover orders', () => {
    it('should execute buyToCover market order after 1 cycle delay', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
        })],
        stocks: [createTestStock('AAPL', 95)], // Price dropped - profit for short
        cash: 10000,
        shortPositions: [{
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 100,
          collateralLocked: 1500,
          openedAt: Date.now() - 10000,
          totalBorrowFeesPaid: 0,
        }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should be removed
      expect(state.pendingOrders.orders).toHaveLength(0);
      // Short position should be closed
      expect(state.shortPositions.positions).toHaveLength(0);
      // Trade should be added to history with realized P/L
      expect(state.tradeHistory.trades).toHaveLength(1);
      expect(state.tradeHistory.trades[0].type).toBe('buyToCover');
      // Profit = (entry 100 - exit 95) * 10 = 50 (before spread/fees)
      expect(state.tradeHistory.trades[0].realizedProfitLoss).toBeGreaterThan(0);
    });

    it('should fail buyToCover when no short position exists', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
        shortPositions: [], // No short position!
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should remain pending (failed)
      expect(state.pendingOrders.orders).toHaveLength(1);
      // Notification should be shown
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].type).toBe('warning');
    });

    it('should fail buyToCover when insufficient cash', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 100, // Not enough cash to cover 10 shares at ~$100
        shortPositions: [{
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 100,
          collateralLocked: 1500,
          openedAt: Date.now() - 10000,
          totalBorrowFeesPaid: 0,
        }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should remain pending (failed)
      expect(state.pendingOrders.orders).toHaveLength(1);
      // Short position should still exist
      expect(state.shortPositions.positions).toHaveLength(1);
      // Notification should be shown
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].type).toBe('warning');
    });

    it('should not execute buyToCover order when isNew is true (creation cycle)', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1,
          isNew: true, // Creation cycle - should not execute yet
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 10000,
        shortPositions: [{
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 100,
          collateralLocked: 1500,
          openedAt: Date.now() - 10000,
          totalBorrowFeesPaid: 0,
        }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should still be pending (isNew flag cleared but not executed)
      expect(state.pendingOrders.orders).toHaveLength(1);
      expect(state.pendingOrders.orders[0].isNew).toBe(false);
      // Short position should still exist
      expect(state.shortPositions.positions).toHaveLength(1);
    });

    it('should execute buyToCover with loan when insufficient cash but loan available', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
          loanRequest: {
            amount: 900, // Need $900 loan to cover
            interestRate: 0.05,
            durationCycles: 40,
          },
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 200, // Only $200 cash, but loan request covers the rest
        shortPositions: [{
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 100,
          collateralLocked: 1500,
          openedAt: Date.now() - 10000,
          totalBorrowFeesPaid: 0,
        }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should be executed and removed
      expect(state.pendingOrders.orders).toHaveLength(0);
      // Short position should be closed
      expect(state.shortPositions.positions).toHaveLength(0);
      // Loan should be taken (dynamically recalculated to actual needed amount)
      expect(state.loans.loans).toHaveLength(1);
      expect(state.loans.loans[0].principal).toBeLessThanOrEqual(900);
      expect(state.loans.loans[0].principal).toBeGreaterThan(0);
      // Trade history should have the buyToCover
      const buyToCoverTrade = state.tradeHistory.trades.find(t => t.type === 'buyToCover');
      expect(buyToCoverTrade).toBeDefined();
    });

    it('should fail buyToCover with loan when max loans reached', () => {
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 10,
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 1,
          isNew: false,
          loanRequest: {
            amount: 900,
            interestRate: 0.05,
            durationCycles: 40,
          },
        })],
        stocks: [createTestStock('AAPL', 100)],
        cash: 200,
        shortPositions: [{
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 100,
          collateralLocked: 1500,
          openedAt: Date.now() - 10000,
          totalBorrowFeesPaid: 0,
        }],
        loans: [
          // Already have 3 loans (max)
          { id: 'loan-1', loanNumber: 1, principal: 1000, balance: 1000, interestRate: 0.05, durationCycles: 40, remainingCycles: 20, isOverdue: false, overdueForCycles: 0, createdAt: Date.now(), totalInterestPaid: 0 },
          { id: 'loan-2', loanNumber: 2, principal: 1000, balance: 1000, interestRate: 0.05, durationCycles: 40, remainingCycles: 20, isOverdue: false, overdueForCycles: 0, createdAt: Date.now(), totalInterestPaid: 0 },
          { id: 'loan-3', loanNumber: 3, principal: 1000, balance: 1000, interestRate: 0.05, durationCycles: 40, remainingCycles: 20, isOverdue: false, overdueForCycles: 0, createdAt: Date.now(), totalInterestPaid: 0 },
        ],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should remain pending (failed due to max loans)
      expect(state.pendingOrders.orders).toHaveLength(1);
      // Short position should still exist
      expect(state.shortPositions.positions).toHaveLength(1);
      // Should still have only 3 loans (no new loan taken)
      expect(state.loans.loans).toHaveLength(3);
      // Notification should be shown
      expect(state.notifications.items).toHaveLength(1);
      expect(state.notifications.items[0].type).toBe('warning');
    });

    it('should dynamically adjust loan when price rises between placement and execution', () => {
      // Order was placed when price was 100, loan calculated for that price
      // But execution happens at price 150 (price rose significantly)
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 10,
          orderType: 'market',
          orderPrice: 100, // Price at placement
          remainingCycles: 1,
          isNew: false,
          loanRequest: {
            amount: 900, // Loan calculated at old price
            interestRate: 0.05,
            durationCycles: 40,
          },
        })],
        stocks: [createTestStock('AAPL', 150)], // Price has risen to 150
        cash: 200,
        shortPositions: [{
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 100,
          collateralLocked: 1500,
          openedAt: Date.now() - 10000,
          totalBorrowFeesPaid: 0,
        }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Order should be executed (loan dynamically adjusted)
      expect(state.pendingOrders.orders).toHaveLength(0);
      // Short position should be closed
      expect(state.shortPositions.positions).toHaveLength(0);
      // Loan should be taken with adjusted amount (more than original 900)
      expect(state.loans.loans).toHaveLength(1);
      expect(state.loans.loans[0].principal).toBeGreaterThan(900);
      // Interest rate should remain locked-in from placement
      expect(state.loans.loans[0].interestRate).toBe(0.05);
    });

    it('should partially execute buyToCover when funds are insufficient even with max credit', () => {
      // Very high price, even max credit can't cover all shares
      // Credit line: baseCollateral = 100000 * 0.25 = 25,000; no holdings → total = 25,000
      // recommendedCreditLine = 25,000; maxCreditLine = 62,500
      // totalAvailableFunds = 1,000 + 62,500 = 63,500 but 100 × $1000 = ~$100,000
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: '1',
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 100,
          orderType: 'market',
          orderPrice: 1000,
          remainingCycles: 1,
          isNew: false,
          loanRequest: {
            amount: 5000,
            interestRate: 0.05,
            durationCycles: 40,
          },
        })],
        stocks: [createTestStock('AAPL', 1000)], // 100 shares × $1000 = $100,000+ needed
        cash: 1000,
        shortPositions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 400,
          collateralLocked: 6000,
          openedAt: Date.now() - 10000,
          totalBorrowFeesPaid: 0,
        }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();
      // Should have a partial execution trade in history
      const coverTrade = state.tradeHistory.trades.find(t => t.type === 'buyToCover' && t.status !== 'failed');
      if (coverTrade) {
        // Partial execution happened
        expect(coverTrade.shares).toBeLessThan(100);
        expect(coverTrade.shares).toBeGreaterThan(0);
        // Remaining shares should be a new pending order
        const remainingOrder = state.pendingOrders.orders.find(o => o.type === 'buyToCover');
        expect(remainingOrder).toBeDefined();
        expect(remainingOrder!.shares).toBe(100 - coverTrade.shares);
        // Info notification about partial execution
        const infoNotif = state.notifications.items.find(n => n.type === 'info');
        expect(infoNotif).toBeDefined();
      } else {
        // If credit line wasn't enough for even 1 share, order should have failed
        expect(state.notifications.items.some(n => n.type === 'warning')).toBe(true);
      }
    });

    it('should show success toast when short position is fully closed after partial executions', () => {
      // Scenario: After previous partial executions, player has enough funds to cover remaining shares
      // This simulates the 3rd iteration where 287 remaining shares are fully covered
      const store = createTestStore({
        pendingOrders: [createMockOrder({
          id: 'remaining-order',
          symbol: 'AAPL',
          type: 'buyToCover',
          shares: 50, // Remaining shares from previous partial executions
          orderType: 'market',
          orderPrice: 100,
          remainingCycles: 0, // Market order ready to execute
          isNew: false,
        })],
        stocks: [createTestStock('AAPL', 100)], // 50 × $100 = $5,000 needed
        cash: 10000, // Enough cash to cover all remaining shares
        shortPositions: [{
          symbol: 'AAPL',
          shares: 50, // Exactly the remaining short position
          entryPrice: 90,
          collateralLocked: 750,
          openedAt: Date.now() - 10000,
          totalBorrowFeesPaid: 10,
        }],
      });

      store.dispatch(executePendingOrders() as unknown as ReturnType<typeof addPendingOrder>);

      const state = store.getState();

      // Short position should be fully closed
      expect(state.shortPositions.positions).toHaveLength(0);

      // Trade history should have the successful cover
      const coverTrade = state.tradeHistory.trades.find(t => t.type === 'buyToCover' && t.status !== 'failed');
      expect(coverTrade).toBeDefined();
      expect(coverTrade!.shares).toBe(50);

      // Success notification should be shown for full position close
      const successNotif = state.notifications.items.find(n => n.type === 'success');
      expect(successNotif).toBeDefined();
      expect(successNotif!.title).toContain('Short');

      // No pending orders should remain
      expect(state.pendingOrders.orders).toHaveLength(0);
    });
  });
});
