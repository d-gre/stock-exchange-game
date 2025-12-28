import { createSlice, type PayloadAction, type Dispatch } from '@reduxjs/toolkit';
import type { Stock, Portfolio } from '../types';
import { initializeStocks, generateNewCandle, applyTradeImpact } from '../utils/stockData';
import { CONFIG } from '../config';
import { applyStockSplit as applyStockSplitToPortfolio } from './portfolioSlice';
import { applyStockSplitToOrders } from './pendingOrdersSlice';
import { addNotification } from './notificationsSlice';
import i18n from '../i18n';

interface StocksState {
  items: Stock[];
}

const initialState: StocksState = {
  items: initializeStocks(),
};

const stocksSlice = createSlice({
  name: 'stocks',
  initialState,
  reducers: {
    updatePrices: (state) => {
      state.items = state.items.map(stock => generateNewCandle(stock));
    },
    setStocks: (state, action: PayloadAction<Stock[]>) => {
      state.items = action.payload;
    },
    applyTrade: (state, action: PayloadAction<{ symbol: string; type: 'buy' | 'sell'; shares: number }>) => {
      const { symbol, type, shares } = action.payload;
      state.items = state.items.map(stock =>
        stock.symbol === symbol ? applyTradeImpact(stock, type, shares) : stock
      );
    },
    resetStocks: (state) => {
      state.items = initializeStocks();
    },
    applyStockSplit: (state, action: PayloadAction<{ symbol: string; ratio: number }>) => {
      const { symbol, ratio } = action.payload;
      state.items = state.items.map(stock => {
        if (stock.symbol !== symbol) return stock;

        // Divide all prices by the split ratio
        const newPrice = stock.currentPrice / ratio;
        const newChange = stock.change / ratio;

        // Adjust price history (all OHLC values)
        const newPriceHistory = stock.priceHistory.map(candle => ({
          ...candle,
          open: candle.open / ratio,
          high: candle.high / ratio,
          low: candle.low / ratio,
          close: candle.close / ratio,
        }));

        return {
          ...stock,
          currentPrice: newPrice,
          change: newChange,
          priceHistory: newPriceHistory,
        };
      });
    },
  },
});

export const { updatePrices, setStocks, applyTrade, resetStocks, applyStockSplit } = stocksSlice.actions;
export default stocksSlice.reducer;

/** Formats currency values in German format */
const formatCurrency = (value: number): string =>
  value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PendingOrdersState {
  orders: { symbol: string }[];
}

interface RootStateForSplitThunk {
  stocks: StocksState;
  portfolio: Portfolio;
  pendingOrders: PendingOrdersState;
}

/**
 * Thunk: Checks all stocks for split condition and executes splits
 * Called after every price update
 */
export const checkAndApplyStockSplits = () => {
  return (dispatch: Dispatch, getState: () => RootStateForSplitThunk): string[] => {
    const state = getState();
    const stocks = state.stocks.items;
    const portfolio = state.portfolio;
    const pendingOrders = state.pendingOrders.orders;
    const { stockSplitThreshold, stockSplitRatio } = CONFIG;

    const splitSymbols: string[] = [];

    stocks.forEach(stock => {
      if (stock.currentPrice > stockSplitThreshold) {
        const oldPrice = stock.currentPrice;
        const newPrice = oldPrice / stockSplitRatio;

        // Apply split in all slices
        dispatch(applyStockSplit({ symbol: stock.symbol, ratio: stockSplitRatio }));
        dispatch(applyStockSplitToPortfolio({ symbol: stock.symbol, ratio: stockSplitRatio }));
        dispatch(applyStockSplitToOrders({ symbol: stock.symbol, ratio: stockSplitRatio }));

        // Only show notification if player owns the stock or has a pending order
        const ownsStock = portfolio.holdings.some(h => h.symbol === stock.symbol);
        const hasPendingOrder = pendingOrders.some(o => o.symbol === stock.symbol);

        if (ownsStock || hasPendingOrder) {
          dispatch(addNotification({
            type: 'info',
            title: i18n.t('notification.stockSplit.title', { symbol: stock.symbol }),
            message: i18n.t('notification.stockSplit.message', {
              name: stock.name,
              ratio: stockSplitRatio,
              newPrice: formatCurrency(newPrice),
              oldPrice: formatCurrency(oldPrice),
            }),
            autoDismissMs: 8000,
          }));
        }

        splitSymbols.push(stock.symbol);
      }
    });

    return splitSymbols;
  };
};

/**
 * Thunk: Executes silent splits (without notifications)
 * Called at the end of warmup to keep prices below the split threshold
 */
export const applySilentStockSplits = () => {
  return (dispatch: Dispatch, getState: () => RootStateForSplitThunk): string[] => {
    const state = getState();
    const stocks = state.stocks.items;
    const { stockSplitThreshold, stockSplitRatio } = CONFIG;

    const splitSymbols: string[] = [];

    stocks.forEach(stock => {
      if (stock.currentPrice > stockSplitThreshold) {
        // Apply split in all slices (without notification)
        dispatch(applyStockSplit({ symbol: stock.symbol, ratio: stockSplitRatio }));
        dispatch(applyStockSplitToPortfolio({ symbol: stock.symbol, ratio: stockSplitRatio }));
        dispatch(applyStockSplitToOrders({ symbol: stock.symbol, ratio: stockSplitRatio }));

        splitSymbols.push(stock.symbol);
      }
    });

    return splitSymbols;
  };
};
