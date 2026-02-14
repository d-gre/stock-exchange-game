import { createSlice, createSelector, type PayloadAction, type Dispatch } from '@reduxjs/toolkit';
import type { PendingOrder, Stock, GameMode, OrderType, Portfolio, CompletedTrade, MarketMakerInventory, OrderLoanRequest, Loan, ShortPosition } from '../types';
import { calculateTradeExecution } from '../utils/tradingMechanics';
import { TRADING_MECHANICS, LOAN_CONFIG, SHORT_SELLING_CONFIG } from '../config';
import { buyStock, sellStock, addCash } from './portfolioSlice';
import { applyTrade } from './stocksSlice';
import { addNotification, dismissNotificationsForMarginCall } from './notificationsSlice';
import { addCompletedTrade } from './tradeHistorySlice';
import { executeTrade as executeMMTrade } from './marketMakerSlice';
import { takeLoan, calculateCollateralValue } from './loansSlice';
import { openShortPosition, closeShortPosition } from './shortPositionsSlice';
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
  type: 'buy' | 'sell' | 'shortSell' | 'buyToCover';
  shares: number;
  orderType: OrderType;
  orderPrice: number;
  limitPrice?: number;
  stopPrice?: number;
  /** Validity in cycles (0 = immediate execution for Market Orders) */
  validityCycles: number;
  /** Is this an edit of an existing order? (won't be marked as new) */
  isEdit?: boolean;
  /** Optional loan request - loan will be created when order executes */
  loanRequest?: OrderLoanRequest;
  /** Collateral to lock when shortSell order executes */
  collateralToLock?: number;
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
        // New orders get isNew=true (creation cycle doesn't count)
        // EXCEPT market orders - they execute at the next cycle boundary (after VP trades)
        // Edited orders don't get isNew (they continue from where they were)
        isNew: action.payload.orderType === 'market' ? false : !action.payload.isEdit,
        // Include loan request if provided
        loanRequest: action.payload.loanRequest,
        // Include collateral to lock for short sell orders
        collateralToLock: action.payload.collateralToLock,
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
     * New orders skip the first decrement (creation cycle doesn't count)
     */
    tickOrderCycles: (state) => {
      state.orders = state.orders.filter(order => {
        // New orders: mark as not new, don't decrement (creation cycle doesn't count)
        if (order.isNew) {
          order.isNew = false;
          return true;
        }

        // Market Orders: decrement cycles but never expire (will execute when remainingCycles === 0)
        if (order.orderType === 'market') {
          if (order.remainingCycles > 0) {
            order.remainingCycles -= 1;
          }
          return true; // Market orders never expire automatically
        }

        // Decrement cycles for limit/stop orders
        order.remainingCycles -= 1;

        // Remove if expired (<= 0) - order is removed after showing "Next Cycle"
        return order.remainingCycles > 0;
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

    /**
     * Restore pending orders from saved game
     */
    restorePendingOrders: (_state, action: PayloadAction<PendingOrdersState>) => {
      return action.payload;
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
  applyStockSplit: applyStockSplitToOrders,
  restorePendingOrders,
} = pendingOrdersSlice.actions;

export default pendingOrdersSlice.reducer;

/**
 * Checks if an order can be executed based on the current price
 */
export const canExecuteOrder = (order: PendingOrder, currentPrice: number): boolean => {
  const { type, orderType, limitPrice, stopPrice, stopTriggered } = order;

  switch (orderType) {
    case 'market':
      // Market Orders execute after delay cycles have passed
      // Must not be new (creation cycle doesn't count) and remainingCycles must be <= 1
      // (will be decremented to 0 by tickOrderCycles after execution check)
      return !order.isNew && order.remainingCycles <= 1;

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
  settings: { gameMode: GameMode; initialCash: number };
  portfolio: Portfolio;
  notifications: { items: Array<{ failedOrderId?: string }> };
  marketMaker: { inventory: Record<string, MarketMakerInventory> };
  loans: { loans: Loan[] };
  shortPositions: { positions: ShortPosition[] };
  gameSession: { currentCycle: number };
}

/**
 * Calculates the available funds for a purchase.
 *
 * @param cash - Current cash
 * @returns Available funds for purchases
 */
export const getAvailableFunds = (cash: number): number => {
  return cash;
};

/**
 * Order execution result
 */
export interface OrderExecutionResult {
  executedOrderIds: string[];
  failedOrders: Array<{
    order: PendingOrder;
    reason: 'insufficient_funds' | 'insufficient_shares' | 'expired';
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
    const mmInventory = state.marketMaker.inventory;
    const currentCycle = state.gameSession.currentCycle;

    // Checks if a failure notification already exists for this order
    const hasExistingNotification = (orderId: string): boolean =>
      existingNotifications.some(n => n.failedOrderId === orderId);

    // Current cash - updated during execution
    let currentCash = state.portfolio.cash;

    // Track executed sell orders to adjust available shares for subsequent orders
    const executedSellShares: Record<string, number> = {};

    const executedOrderIds: string[] = [];
    const failedOrders: OrderExecutionResult['failedOrders'] = [];

    // --- Shared helpers to reduce duplication between buy and buyToCover ---

    const checkLoanEligibility = (order: PendingOrder) => {
      const hasLoanRequest = order.loanRequest !== undefined;
      const loanInterestRate = order.loanRequest?.interestRate ?? 0;
      const loanDurationCycles = order.loanRequest?.durationCycles ?? LOAN_CONFIG.defaultLoanDurationCycles;
      const currentLoanCount = state.loans.loans.length;
      const pendingLoanCount = state.pendingOrders.orders.filter(o => o.loanRequest && o.id !== order.id).length;
      const canTakeLoan = (currentLoanCount + pendingLoanCount) < LOAN_CONFIG.maxLoans;
      return { hasLoanRequest, loanInterestRate, loanDurationCycles, canTakeLoan };
    };

    const recordFailedTrade = (
      order: PendingOrder,
      totalAmount: number,
      failureReason: 'insufficient_funds' | 'insufficient_shares',
      failureDetails: string,
    ) => {
      dispatch(addCompletedTrade({
        id: `failed-${order.id}`,
        symbol: order.symbol,
        type: order.type,
        shares: order.shares,
        pricePerShare: order.orderPrice,
        totalAmount,
        timestamp: Date.now(),
        cycle: currentCycle,
        status: 'failed',
        failureReason,
        failureDetails,
      }));
    };

    const disburseLoan = (amount: number, interestRate: number, durationCycles: number) => {
      dispatch(takeLoan({ amount, interestRate, durationCycles }));
      const originationFee = amount * LOAN_CONFIG.originationFeePercent;
      const netDisbursement = amount - originationFee;
      dispatch(addCash(netDisbursement));
      currentCash += netDisbursement;
    };

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

      // Get Market Maker spread multiplier for this stock
      const spreadMultiplier = mmInventory[order.symbol]?.spreadMultiplier ?? 1.0;

      // Map order types to buy/sell for calculateTradeExecution
      // shortSell is like 'sell' (receiving money), buyToCover is like 'buy' (paying money)
      const tradeType: 'buy' | 'sell' = (order.type === 'buy' || order.type === 'buyToCover') ? 'buy' : 'sell';

      // Calculate effective price with MM spread
      const execution = calculateTradeExecution(currentPrice, order.shares, tradeType, mechanics, spreadMultiplier);
      const totalCost = execution.total;

      if (order.type === 'buy') {
        // Check if enough funds are available (including potential loan)
        const availableFunds = getAvailableFunds(currentCash);
        const { hasLoanRequest, loanInterestRate, loanDurationCycles, canTakeLoan } = checkLoanEligibility(order);
        const loanAmount = order.loanRequest?.amount ?? 0;

        // If order has loan request but can't take loan anymore, fail the order
        if (hasLoanRequest && !canTakeLoan) {
          if (!hasExistingNotification(order.id)) {
            failedOrders.push({ order, reason: 'insufficient_funds', requiredAmount: totalCost, availableAmount: availableFunds });
            recordFailedTrade(order, totalCost, 'insufficient_funds', i18n.t('tradeHistory.failureDetails.loanLimitReached'));
            dispatch(addNotification({
              type: 'warning',
              title: i18n.t('notification.buyOrderFailed.title'),
              message: i18n.t('notification.loanLimitReached'),
              autoDismissMs: 0,
              failedOrderId: order.id,
              failedOrderSymbol: order.symbol,
            }));
          }
          return;
        }

        // Calculate total available funds (cash + loan if applicable)
        const totalAvailableFunds = hasLoanRequest ? availableFunds + loanAmount : availableFunds;

        if (totalCost > totalAvailableFunds) {
          if (!hasExistingNotification(order.id)) {
            failedOrders.push({ order, reason: 'insufficient_funds', requiredAmount: totalCost, availableAmount: totalAvailableFunds });
            recordFailedTrade(order, totalCost, 'insufficient_funds', i18n.t('tradeHistory.failureDetails.insufficientFunds', {
              required: formatCurrency(totalCost),
              available: formatCurrency(totalAvailableFunds),
            }));
            dispatch(addNotification({
              type: 'warning',
              title: i18n.t('notification.buyOrderFailed.title'),
              message: i18n.t('notification.buyOrderFailed.message', {
                shares: order.shares,
                symbol: order.symbol,
                required: formatCurrency(totalCost),
                available: formatCurrency(totalAvailableFunds),
              }),
              autoDismissMs: 0,
              failedOrderId: order.id,
              failedOrderSymbol: order.symbol,
            }));
          }
          return;
        }

        // IMPORTANT: Remove order FIRST to avoid race condition
        // (prevents negative availableCash display)
        dispatch(removeOrder(order.id));

        if (hasLoanRequest && loanAmount > 0) {
          disburseLoan(loanAmount, loanInterestRate, loanDurationCycles);
        }

        // Execute purchase
        const totalPricePerShare = totalCost / order.shares;
        dispatch(buyStock({
          symbol: order.symbol,
          shares: order.shares,
          price: totalPricePerShare,
        }));

        // Add trade to history
        const completedTrade: CompletedTrade = {
          id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          symbol: order.symbol,
          type: 'buy',
          shares: order.shares,
          pricePerShare: totalPricePerShare,
          totalAmount: totalCost,
          timestamp: Date.now(),
          cycle: currentCycle,
        };
        dispatch(addCompletedTrade(completedTrade));

        // Update cash for following orders
        currentCash -= totalCost;
      } else if (order.type === 'sell') {
        // Check if enough shares are available
        const holding = state.portfolio.holdings.find(h => h.symbol === order.symbol);
        const alreadySoldShares = executedSellShares[order.symbol] ?? 0;
        const availableShares = (holding?.shares ?? 0) - alreadySoldShares;

        if (order.shares > availableShares) {
          // Not enough shares - add warning (only if one doesn't already exist)
          if (!hasExistingNotification(order.id)) {
            failedOrders.push({
              order,
              reason: 'insufficient_shares',
              requiredAmount: order.shares,
              availableAmount: availableShares,
            });

            const failureDetails = i18n.t('tradeHistory.failureDetails.insufficientShares', {
              required: order.shares,
              available: availableShares,
            });

            // Add failed trade to history
            const failedTrade: CompletedTrade = {
              id: `failed-${order.id}`,
              symbol: order.symbol,
              type: order.type,
              shares: order.shares,
              pricePerShare: order.orderPrice,
              totalAmount: order.shares * currentPrice,
              timestamp: Date.now(),
              cycle: currentCycle,
              status: 'failed',
              failureReason: 'insufficient_shares',
              failureDetails,
            };
            dispatch(addCompletedTrade(failedTrade));

            // Interactive warning with order details for editing/deleting
            dispatch(addNotification({
              type: 'warning',
              title: i18n.t('notification.sellOrderFailed.title'),
              message: i18n.t('notification.sellOrderFailed.message', {
                shares: order.shares,
                symbol: order.symbol,
                required: order.shares,
                available: availableShares,
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
        dispatch(removeOrder(order.id));

        // Track sold shares for subsequent orders
        executedSellShares[order.symbol] = alreadySoldShares + order.shares;

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
          id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          symbol: order.symbol,
          type: 'sell',
          shares: order.shares,
          pricePerShare: totalPricePerShare,
          totalAmount: execution.total,
          timestamp: Date.now(),
          cycle: currentCycle,
          realizedProfitLoss,
          avgBuyPrice,
        };
        dispatch(addCompletedTrade(completedTrade));

        // Update cash for following orders
        currentCash += execution.total;
      } else if (order.type === 'shortSell') {
        // Short sell: Borrow and sell shares
        // The collateral was already checked when the order was placed
        // Now we just need to verify it's still valid and execute

        // IMPORTANT: Remove order FIRST to avoid race condition
        dispatch(removeOrder(order.id));

        // Open the short position
        dispatch(openShortPosition({
          symbol: order.symbol,
          shares: order.shares,
          entryPrice: currentPrice,
          collateralLocked: order.collateralToLock ?? (currentPrice * order.shares * SHORT_SELLING_CONFIG.initialMarginPercent),
        }));

        // Add short sell to trade history
        const completedTrade: CompletedTrade = {
          id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          symbol: order.symbol,
          type: 'shortSell',
          shares: order.shares,
          pricePerShare: currentPrice,
          totalAmount: order.shares * currentPrice,
          timestamp: Date.now(),
          cycle: currentCycle,
        };
        dispatch(addCompletedTrade(completedTrade));

        // Short sell receives proceeds (minus spread/slippage)
        currentCash += execution.total;
      } else if (order.type === 'buyToCover') {
        // Buy to cover: Close a short position
        const shortPosition = state.shortPositions.positions.find(p => p.symbol === order.symbol);

        if (!shortPosition || shortPosition.shares < order.shares) {
          // Not enough shorted shares to cover
          if (!hasExistingNotification(order.id)) {
            const availableShortShares = shortPosition?.shares ?? 0;
            failedOrders.push({ order, reason: 'insufficient_shares', requiredAmount: order.shares, availableAmount: availableShortShares });
            recordFailedTrade(order, order.shares * currentPrice, 'insufficient_shares', i18n.t('tradeHistory.failureDetails.insufficientShortShares', {
              required: order.shares,
              available: availableShortShares,
            }));
            dispatch(addNotification({
              type: 'warning',
              title: i18n.t('notification.buyToCoverFailed.title'),
              message: i18n.t('notification.buyToCoverFailed.message', {
                shares: order.shares,
                symbol: order.symbol,
                available: availableShortShares,
              }),
              autoDismissMs: 0,
              failedOrderId: order.id,
              failedOrderSymbol: order.symbol,
            }));
          }
          return;
        }

        const availableFunds = getAvailableFunds(currentCash);
        const { hasLoanRequest, loanInterestRate, loanDurationCycles, canTakeLoan: canTakeLoanNow } = checkLoanEligibility(order);

        // If order has loan request but can't take loan anymore, fail the order
        if (hasLoanRequest && !canTakeLoanNow) {
          if (!hasExistingNotification(order.id)) {
            failedOrders.push({ order, reason: 'insufficient_funds', requiredAmount: totalCost, availableAmount: availableFunds });
            recordFailedTrade(order, totalCost, 'insufficient_funds', i18n.t('tradeHistory.failureDetails.loanLimitReached'));
            dispatch(addNotification({
              type: 'warning',
              title: i18n.t('notification.buyToCoverFailed.title'),
              message: i18n.t('notification.loanLimitReached'),
              autoDismissMs: 0,
              failedOrderId: order.id,
              failedOrderSymbol: order.symbol,
            }));
          }
          return;
        }

        // Dynamic loan recalculation: recalculate needed loan at actual execution price
        let availableCreditForOrder = 0;
        if (hasLoanRequest && canTakeLoanNow) {
          const baseCollateral = state.settings.initialCash * LOAN_CONFIG.baseCollateralPercent;
          const collateralBreakdown = calculateCollateralValue(
            state.portfolio.cash, state.portfolio.holdings, stocks, baseCollateral
          );
          const recommendedCreditLine = Math.floor(collateralBreakdown.total / 1000) * 1000;
          const maxCreditLine = recommendedCreditLine * LOAN_CONFIG.maxCreditLineMultiplier;
          const existingDebt = state.loans.loans.reduce((sum, loan) => sum + loan.balance, 0);
          const otherPendingLoanAmount = state.pendingOrders.orders
            .filter(o => o.loanRequest && o.id !== order.id)
            .reduce((sum, o) => sum + (o.loanRequest?.amount ?? 0), 0);
          availableCreditForOrder = Math.max(0, maxCreditLine - existingDebt - otherPendingLoanAmount);
        }

        let actualLoanAmount = 0;
        if (hasLoanRequest && canTakeLoanNow && totalCost > availableFunds) {
          const neededLoan = Math.ceil(totalCost - availableFunds);
          actualLoanAmount = Math.min(neededLoan, availableCreditForOrder);
        }

        const totalAvailableFunds = availableFunds + actualLoanAmount;

        // Helper: execute a cover for a given number of shares
        const executeCover = (sharesToCover: number, coverTotalCost: number, coverLoanAmount: number) => {
          dispatch(removeOrder(order.id));
          if (coverLoanAmount > 0) {
            disburseLoan(coverLoanAmount, loanInterestRate, loanDurationCycles);
          }

          dispatch(closeShortPosition({ symbol: order.symbol, shares: sharesToCover, exitPrice: currentPrice }));
          dispatch(dismissNotificationsForMarginCall(order.symbol));

          dispatch(addCompletedTrade({
            id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            symbol: order.symbol,
            type: 'buyToCover',
            shares: sharesToCover,
            pricePerShare: currentPrice,
            totalAmount: coverTotalCost,
            timestamp: Date.now(),
            cycle: currentCycle,
            realizedProfitLoss: (shortPosition.entryPrice - currentPrice) * sharesToCover,
            avgBuyPrice: shortPosition.entryPrice,
          }));

          currentCash -= coverTotalCost;
        };

        if (totalCost <= totalAvailableFunds) {
          // === FULL EXECUTION (with dynamically adjusted loan) ===
          const isFullPositionCover = shortPosition.shares === order.shares;
          executeCover(order.shares, totalCost, actualLoanAmount);

          // Show success toast when short position is fully closed
          if (isFullPositionCover) {
            dispatch(addNotification({
              type: 'success',
              title: i18n.t('notification.coverComplete.title'),
              message: i18n.t('notification.coverComplete.message', {
                shares: order.shares,
                symbol: order.symbol,
              }),
              autoDismissMs: 5000,
            }));
          }
        } else {
          // === PARTIAL EXECUTION ===
          // Binary search for max affordable shares at current price
          let low = 1;
          let high = order.shares - 1;
          let partialShares = 0;

          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const exec = calculateTradeExecution(currentPrice, mid, 'buy', mechanics, spreadMultiplier);
            if (exec.total <= totalAvailableFunds) {
              partialShares = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          if (partialShares === 0) {
            if (!hasExistingNotification(order.id)) {
              failedOrders.push({ order, reason: 'insufficient_funds', requiredAmount: totalCost, availableAmount: totalAvailableFunds });
              recordFailedTrade(order, totalCost, 'insufficient_funds', i18n.t('tradeHistory.failureDetails.insufficientFunds', {
                required: formatCurrency(totalCost),
                available: formatCurrency(totalAvailableFunds),
              }));
              dispatch(addNotification({
                type: 'warning',
                title: i18n.t('notification.buyToCoverFailed.title'),
                message: i18n.t('notification.buyToCoverFailed.insufficientFunds', {
                  required: formatCurrency(totalCost),
                  available: formatCurrency(totalAvailableFunds),
                }),
                autoDismissMs: 0,
                failedOrderId: order.id,
                failedOrderSymbol: order.symbol,
              }));
            }
            return;
          }

          const partialExecution = calculateTradeExecution(currentPrice, partialShares, 'buy', mechanics, spreadMultiplier);
          const partialCost = partialExecution.total;
          const remainingShares = order.shares - partialShares;

          let partialLoanAmount = 0;
          if (hasLoanRequest && partialCost > availableFunds) {
            partialLoanAmount = Math.min(Math.ceil(partialCost - availableFunds), availableCreditForOrder);
          }

          executeCover(partialShares, partialCost, partialLoanAmount);

          dispatch(addPendingOrder({
            symbol: order.symbol,
            type: 'buyToCover',
            shares: remainingShares,
            orderType: 'market',
            orderPrice: currentPrice,
            validityCycles: 0,
          }));

          dispatch(addNotification({
            type: 'info',
            title: i18n.t('notification.partialCover.title'),
            message: i18n.t('notification.partialCover.message', {
              executed: partialShares,
              total: order.shares,
              remaining: remainingShares,
              symbol: order.symbol,
            }),
            autoDismissMs: 0,
            autoDismissCycles: 5,
          }));

          dispatch(applyTrade({ symbol: order.symbol, type: 'buy', shares: partialShares }));
          dispatch(executeMMTrade({ symbol: order.symbol, type: 'buy', shares: partialShares }));
          executedOrderIds.push(order.id);
          return;
        }
      }

      // Apply trade impact to the market (map short types to buy/sell)
      const marketImpactType: 'buy' | 'sell' = (order.type === 'buy' || order.type === 'buyToCover') ? 'buy' : 'sell';
      dispatch(applyTrade({ symbol: order.symbol, type: marketImpactType, shares: order.shares }));

      // Update Market Maker inventory (also needs mapped type)
      dispatch(executeMMTrade({ symbol: order.symbol, type: marketImpactType, shares: order.shares }));

      executedOrderIds.push(order.id);
    });

    // Check for orders that will expire after this tick
    // (remainingCycles === 1 means they will be decremented to 0 and removed)
    const currentOrders = getState().pendingOrders.orders;
    currentOrders.forEach(order => {
      // Market orders are executed, not expired - skip them
      if (order.orderType === 'market') return;

      // New orders skip their first tick, so they won't expire yet
      if (order.isNew) return;

      // Orders with remainingCycles === 1 will expire after the tick (decremented to 0, then removed)
      if (order.remainingCycles === 1) {
        const stock = stocks.find(s => s.symbol === order.symbol);
        const currentPrice = stock?.currentPrice ?? order.orderPrice;

        // Determine the specific reason for expiration based on order type
        const getExpirationReason = (): string => {
          const { orderType, type, limitPrice, stopPrice, stopTriggered } = order;

          switch (orderType) {
            case 'limit':
              if (type === 'buy') {
                // Limit Buy: Price was never low enough
                return i18n.t('notification.orderExpired.reasons.limitBuyNotReached', {
                  limit: formatCurrency(limitPrice!),
                  current: formatCurrency(currentPrice),
                });
              } else {
                // Limit Sell: Price was never high enough
                return i18n.t('notification.orderExpired.reasons.limitSellNotReached', {
                  limit: formatCurrency(limitPrice!),
                  current: formatCurrency(currentPrice),
                });
              }

            case 'stopBuy':
              if (type === 'buy') {
                // Stop Buy: Price never reached the stop
                return i18n.t('notification.orderExpired.reasons.stopBuyNotTriggered', {
                  stop: formatCurrency(stopPrice!),
                  current: formatCurrency(currentPrice),
                });
              } else {
                // Stop Loss: Price never fell to the stop
                return i18n.t('notification.orderExpired.reasons.stopLossNotTriggered', {
                  stop: formatCurrency(stopPrice!),
                  current: formatCurrency(currentPrice),
                });
              }

            case 'stopBuyLimit':
              if (!stopTriggered) {
                // Stop was never triggered
                if (type === 'buy') {
                  return i18n.t('notification.orderExpired.reasons.stopBuyNotTriggered', {
                    stop: formatCurrency(stopPrice!),
                    current: formatCurrency(currentPrice),
                  });
                } else {
                  return i18n.t('notification.orderExpired.reasons.stopLossNotTriggered', {
                    stop: formatCurrency(stopPrice!),
                    current: formatCurrency(currentPrice),
                  });
                }
              } else {
                // Stop was triggered but limit was never reached
                if (type === 'buy') {
                  return i18n.t('notification.orderExpired.reasons.stopTriggeredLimitBuyNotReached', {
                    limit: formatCurrency(limitPrice!),
                    current: formatCurrency(currentPrice),
                  });
                } else {
                  return i18n.t('notification.orderExpired.reasons.stopTriggeredLimitSellNotReached', {
                    limit: formatCurrency(limitPrice!),
                    current: formatCurrency(currentPrice),
                  });
                }
              }

            default:
              return i18n.t('notification.orderExpired.reasons.generic');
          }
        };

        const reason = getExpirationReason();

        // Add expired trade to history with specific reason
        const expiredTrade: CompletedTrade = {
          id: `expired-${order.id}`,
          symbol: order.symbol,
          type: order.type,
          shares: order.shares,
          pricePerShare: order.orderPrice,
          totalAmount: order.shares * order.orderPrice,
          timestamp: Date.now(),
          cycle: currentCycle,
          status: 'failed',
          failureReason: 'expired',
          failureDetails: reason,
        };
        dispatch(addCompletedTrade(expiredTrade));

        // Show notification for expired order with specific reason
        // Include failedOrderId/Symbol so user can create a new order via Edit button
        dispatch(addNotification({
          type: 'warning',
          title: i18n.t('notification.orderExpired.title'),
          message: i18n.t('notification.orderExpired.message', {
            type: order.type === 'buy' ? i18n.t('portfolio.buy') : i18n.t('portfolio.sell'),
            shares: order.shares,
            symbol: order.symbol,
            reason,
          }),
          autoDismissMs: 0, // No auto-dismiss for interactive warnings
          failedOrderId: order.id,
          failedOrderSymbol: order.symbol,
        }));

        failedOrders.push({
          order,
          reason: 'expired' as const,
          requiredAmount: 0,
          availableAmount: 0,
        });
      }
    });

    // Decrement cycles and remove expired orders
    dispatch(tickOrderCycles());

    return { executedOrderIds, failedOrders };
  };
};