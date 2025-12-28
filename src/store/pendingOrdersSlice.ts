import { createSlice, createSelector, type PayloadAction, type Dispatch } from '@reduxjs/toolkit';
import type { PendingOrder, Stock, GameMode, OrderType, Portfolio, CompletedTrade } from '../types';
import { calculateTradeExecution } from '../utils/tradingMechanics';
import { TRADING_MECHANICS } from '../config';
import { buyStock, sellStock } from './portfolioSlice';
import { applyTrade } from './stocksSlice';
import { addNotification } from './notificationsSlice';
import { addCompletedTrade } from './tradeHistorySlice';
import i18n from '../i18n';

/** Formats currency values in German format */
const formatCurrency = (value: number): string =>
  value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PendingOrdersState {
  orders: PendingOrder[];
  /** Stocks that the human player has already traded in this cycle */
  tradedSymbolsThisCycle: string[];
}

const initialState: PendingOrdersState = {
  orders: [],
  tradedSymbolsThisCycle: [],
};

interface AddPendingOrderPayload {
  symbol: string;
  type: 'buy' | 'sell';
  shares: number;
  orderType: OrderType;
  orderPrice: number;
  limitPrice?: number;
  stopPrice?: number;
  /** Validity in cycles (0 = immediate execution for Market Orders) */
  validityCycles: number;
}

const pendingOrdersSlice = createSlice({
  name: 'pendingOrders',
  initialState,
  reducers: {
    /**
     * Adds a new pending order
     */
    addPendingOrder: (state, action: PayloadAction<AddPendingOrderPayload>) => {
      const newOrder: PendingOrder = {
        id: crypto.randomUUID(),
        symbol: action.payload.symbol,
        type: action.payload.type,
        shares: action.payload.shares,
        orderType: action.payload.orderType,
        orderPrice: action.payload.orderPrice,
        limitPrice: action.payload.limitPrice,
        stopPrice: action.payload.stopPrice,
        remainingCycles: action.payload.validityCycles,
        timestamp: Date.now(),
        stopTriggered: false,
      };
      state.orders.push(newOrder);
    },

    /**
     * Marks a stop as triggered
     */
    triggerStopOrder: (state, action: PayloadAction<string>) => {
      const order = state.orders.find(o => o.id === action.payload);
      if (order) {
        order.stopTriggered = true;
      }
    },

    /**
     * Removes an order (after execution or expiration)
     */
    removeOrder: (state, action: PayloadAction<string>) => {
      state.orders = state.orders.filter(order => order.id !== action.payload);
    },

    /**
     * Decrements validity cycles and removes expired orders
     */
    tickOrderCycles: (state) => {
      state.orders = state.orders.filter(order => {
        // Market Orders have remainingCycles = 0, are executed immediately
        if (order.orderType === 'market') return true;

        // Decrement cycles
        order.remainingCycles -= 1;

        // Remove if expired (< 0)
        return order.remainingCycles >= 0;
      });
    },

    /**
     * Cancels a specific order and makes the symbol tradeable again
     */
    cancelOrder: (state, action: PayloadAction<string>) => {
      const orderToCancel = state.orders.find(order => order.id === action.payload);
      if (!orderToCancel) return;

      const symbol = orderToCancel.symbol;

      // Remove order
      state.orders = state.orders.filter(order => order.id !== action.payload);

      // Check if other orders for this symbol still exist
      const hasOtherOrdersForSymbol = state.orders.some(order => order.symbol === symbol);

      // If no other orders exist for this symbol, remove symbol from tradedSymbolsThisCycle
      if (!hasOtherOrdersForSymbol) {
        state.tradedSymbolsThisCycle = state.tradedSymbolsThisCycle.filter(s => s !== symbol);
      }
    },

    /**
     * Clears all pending orders (e.g., when changing game mode)
     */
    clearAllOrders: (state) => {
      state.orders = [];
    },

    /**
     * Marks a stock as traded in this cycle
     */
    markSymbolAsTraded: (state, action: PayloadAction<string>) => {
      if (!state.tradedSymbolsThisCycle.includes(action.payload)) {
        state.tradedSymbolsThisCycle.push(action.payload);
      }
    },

    /**
     * Resets the list of traded stocks (called on each cycle)
     */
    resetTradedSymbols: (state) => {
      state.tradedSymbolsThisCycle = [];
    },

    /**
     * @deprecated Use tickOrderCycles instead
     */
    processPendingOrders: (state) => {
      state.orders = state.orders.filter(order => order.remainingCycles > 0);
      state.orders.forEach(order => {
        order.remainingCycles -= 1;
      });
    },

    /**
     * Adjusts all orders for a symbol after a stock split
     */
    applyStockSplit: (state, action: PayloadAction<{ symbol: string; ratio: number }>) => {
      const { symbol, ratio } = action.payload;
      state.orders = state.orders.map(order => {
        if (order.symbol !== symbol) return order;
        return {
          ...order,
          shares: order.shares * ratio,
          orderPrice: order.orderPrice / ratio,
          limitPrice: order.limitPrice !== undefined ? order.limitPrice / ratio : undefined,
          stopPrice: order.stopPrice !== undefined ? order.stopPrice / ratio : undefined,
        };
      });
    },
  },
});

export const {
  addPendingOrder,
  triggerStopOrder,
  removeOrder,
  tickOrderCycles,
  cancelOrder,
  clearAllOrders,
  markSymbolAsTraded,
  resetTradedSymbols,
  processPendingOrders,
  applyStockSplit: applyStockSplitToOrders,
} = pendingOrdersSlice.actions;

export default pendingOrdersSlice.reducer;

/**
 * Checks if an order can be executed based on the current price
 */
export const canExecuteOrder = (order: PendingOrder, currentPrice: number): boolean => {
  const { type, orderType, limitPrice, stopPrice, stopTriggered } = order;

  switch (orderType) {
    case 'market':
      // Market Orders are always executed immediately
      return true;

    case 'limit':
      if (type === 'buy') {
        // Limit Buy: Buy when price <= limit
        return limitPrice !== undefined && currentPrice <= limitPrice;
      } else {
        // Limit Sell: Sell when price >= limit
        return limitPrice !== undefined && currentPrice >= limitPrice;
      }

    case 'stopBuy':
      if (type === 'buy') {
        // Stop Buy: Buy when price >= stop (breakout)
        return stopPrice !== undefined && currentPrice >= stopPrice;
      } else {
        // Stop Loss: Sell when price <= stop
        return stopPrice !== undefined && currentPrice <= stopPrice;
      }

    case 'stopBuyLimit':
      if (type === 'buy') {
        // Stop Buy Limit: First trigger stop, then check limit
        if (!stopTriggered) {
          // Stop not yet triggered - check if stop is reached
          return false; // Handled separately
        }
        // Stop was triggered - now check limit
        return limitPrice !== undefined && currentPrice <= limitPrice;
      } else {
        // Stop Loss Limit: First trigger stop, then check limit
        if (!stopTriggered) {
          return false;
        }
        return limitPrice !== undefined && currentPrice >= limitPrice;
      }

    default:
      return false;
  }
};

/**
 * Checks if a stop should be triggered
 */
export const shouldTriggerStop = (order: PendingOrder, currentPrice: number): boolean => {
  if (order.orderType !== 'stopBuyLimit' || order.stopTriggered) {
    return false;
  }

  const { type, stopPrice } = order;
  if (stopPrice === undefined) return false;

  if (type === 'buy') {
    // Stop Buy Limit: Trigger when price >= stop
    return currentPrice >= stopPrice;
  } else {
    // Stop Loss Limit: Trigger when price <= stop
    return currentPrice <= stopPrice;
  }
};

/**
 * Selector: Returns all pending orders
 */
export const selectAllPendingOrders = (state: { pendingOrders: PendingOrdersState }) =>
  state.pendingOrders.orders;

/**
 * Selector: Returns all stocks traded in this cycle
 */
export const selectTradedSymbolsThisCycle = (state: { pendingOrders: PendingOrdersState }) =>
  state.pendingOrders.tradedSymbolsThisCycle;

/**
 * Selector: Calculates the total reserved cash for pending buy orders
 * Uses limitPrice for limit orders, otherwise orderPrice
 */
export const selectReservedCash = (state: { pendingOrders: PendingOrdersState }) =>
  state.pendingOrders.orders
    .filter(order => order.type === 'buy')
    .reduce((total, order) => {
      // For limit orders use the limit price, otherwise use order price
      const priceToUse = order.limitPrice ?? order.orderPrice;
      return total + (priceToUse * order.shares);
    }, 0);

/**
 * Selector: Calculates the reserved shares for a specific symbol
 */
export const selectReservedSharesBySymbol = (state: { pendingOrders: PendingOrdersState }, symbol: string) =>
  state.pendingOrders.orders
    .filter(order => order.type === 'sell' && order.symbol === symbol)
    .reduce((total, order) => total + order.shares, 0);

/**
 * Selector: Returns all symbols with pending orders (memoized)
 */
export const selectSymbolsWithPendingOrders = createSelector(
  [(state: { pendingOrders: PendingOrdersState }) => state.pendingOrders.orders],
  (orders) => [...new Set(orders.map(order => order.symbol))]
);

interface RootStateForThunk {
  pendingOrders: PendingOrdersState;
  stocks: { items: Stock[] };
  settings: { gameMode: GameMode };
  portfolio: Portfolio;
  notifications: { items: Array<{ failedOrderId?: string }> };
}

/**
 * Calculates the available funds for a purchase.
 * Prepared for future credit functionality.
 *
 * @param cash - Current cash
 * @returns Available funds for purchases
 */
export const getAvailableFunds = (cash: number, _creditLimit?: number): number => {
  // Future: implement creditLimit
  return cash;
};

/**
 * Order execution result
 */
export interface OrderExecutionResult {
  executedOrderIds: string[];
  failedOrders: Array<{
    order: PendingOrder;
    reason: 'insufficient_funds' | 'insufficient_shares';
    requiredAmount: number;
    availableAmount: number;
  }>;
}

/**
 * Thunk: Executes all executable pending orders
 * Checks price conditions and available funds for each order type
 */
export const executePendingOrders = () => {
  return (dispatch: Dispatch, getState: () => RootStateForThunk): OrderExecutionResult => {
    const state = getState();
    const orders = state.pendingOrders.orders;
    const stocks = state.stocks.items;
    const mechanics = TRADING_MECHANICS[state.settings.gameMode];
    const existingNotifications = state.notifications.items;

    // Checks if a failure notification already exists for this order
    const hasExistingNotification = (orderId: string): boolean =>
      existingNotifications.some(n => n.failedOrderId === orderId);

    // Current cash - updated during execution
    let currentCash = state.portfolio.cash;

    const executedOrderIds: string[] = [];
    const failedOrders: OrderExecutionResult['failedOrders'] = [];

    orders.forEach(order => {
      const stock = stocks.find(s => s.symbol === order.symbol);
      if (!stock) return;

      const currentPrice = stock.currentPrice;

      // Check if stop should be triggered (for stopBuyLimit)
      if (shouldTriggerStop(order, currentPrice)) {
        dispatch(triggerStopOrder(order.id));
        // Don't execute after trigger - limit will be checked in the next cycle
        return;
      }

      // Check if order can be executed (price conditions)
      if (!canExecuteOrder(order, currentPrice)) {
        return;
      }

      // Calculate effective price
      const execution = calculateTradeExecution(currentPrice, order.shares, order.type, mechanics);
      const totalCost = execution.total;

      if (order.type === 'buy') {
        // Check if enough funds are available
        const availableFunds = getAvailableFunds(currentCash);

        if (totalCost > availableFunds) {
          // Not enough funds - add warning (only if one doesn't already exist)
          if (!hasExistingNotification(order.id)) {
            failedOrders.push({
              order,
              reason: 'insufficient_funds',
              requiredAmount: totalCost,
              availableAmount: availableFunds,
            });

            // Add failed trade to history
            const failedTrade: CompletedTrade = {
              id: `failed-${order.id}`,
              symbol: order.symbol,
              type: order.type,
              shares: order.shares,
              pricePerShare: order.orderPrice,
              totalAmount: totalCost,
              timestamp: Date.now(),
              status: 'failed',
              failureReason: 'insufficient_funds',
            };
            dispatch(addCompletedTrade(failedTrade));

            // Interactive warning with order details for editing/deleting
            dispatch(addNotification({
              type: 'warning',
              title: i18n.t('notification.buyOrderFailed.title'),
              message: i18n.t('notification.buyOrderFailed.message', {
                shares: order.shares,
                symbol: order.symbol,
                required: formatCurrency(totalCost),
                available: formatCurrency(availableFunds),
              }),
              autoDismissMs: 0, // No auto-dismiss for interactive warnings
              failedOrderId: order.id,
              failedOrderSymbol: order.symbol,
            }));
          }
          // Order remains pending - don't execute, don't remove
          return;
        }

        // IMPORTANT: Remove order FIRST to avoid race condition
        // (prevents negative availableCash display)
        dispatch(removeOrder(order.id));

        // Execute purchase
        const totalPricePerShare = totalCost / order.shares;
        dispatch(buyStock({
          symbol: order.symbol,
          shares: order.shares,
          price: totalPricePerShare,
        }));

        // Add trade to history
        const completedTrade: CompletedTrade = {
          id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          symbol: order.symbol,
          type: 'buy',
          shares: order.shares,
          pricePerShare: totalPricePerShare,
          totalAmount: totalCost,
          timestamp: Date.now(),
        };
        dispatch(addCompletedTrade(completedTrade));

        // Update cash for following orders
        currentCash -= totalCost;
      } else {
        // IMPORTANT: Remove order FIRST to avoid race condition
        dispatch(removeOrder(order.id));

        // For sales: Calculate average purchase price (from current portfolio)
        const holding = state.portfolio.holdings.find(h => h.symbol === order.symbol);
        const avgBuyPrice = holding?.avgBuyPrice;

        // Execute sale
        const totalPricePerShare = execution.total / order.shares;
        dispatch(sellStock({
          symbol: order.symbol,
          shares: order.shares,
          price: totalPricePerShare,
        }));

        // Calculate realized profit/loss
        const realizedProfitLoss = avgBuyPrice !== undefined
          ? (totalPricePerShare - avgBuyPrice) * order.shares
          : undefined;

        // Add trade to history
        const completedTrade: CompletedTrade = {
          id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          symbol: order.symbol,
          type: 'sell',
          shares: order.shares,
          pricePerShare: totalPricePerShare,
          totalAmount: execution.total,
          timestamp: Date.now(),
          realizedProfitLoss,
          avgBuyPrice,
        };
        dispatch(addCompletedTrade(completedTrade));

        // Update cash for following orders
        currentCash += execution.total;
      }

      // Apply trade impact to the market
      dispatch(applyTrade({ symbol: order.symbol, type: order.type, shares: order.shares }));

      executedOrderIds.push(order.id);
    });

    // Decrement cycles and remove expired orders
    dispatch(tickOrderCycles());

    return { executedOrderIds, failedOrders };
  };
};