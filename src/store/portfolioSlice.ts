import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Portfolio } from '../types';
import { CONFIG } from '../config';

const initialState: Portfolio = {
  cash: CONFIG.initialCash,
  holdings: [],
};

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    buyStock: (state, action: PayloadAction<{ symbol: string; shares: number; price: number }>) => {
      const { symbol, shares, price } = action.payload;
      const totalCost = shares * price;

      if (totalCost > state.cash) return;

      state.cash -= totalCost;

      const existingHolding = state.holdings.find(h => h.symbol === symbol);
      if (existingHolding) {
        const newTotalShares = existingHolding.shares + shares;
        existingHolding.avgBuyPrice =
          (existingHolding.shares * existingHolding.avgBuyPrice + totalCost) / newTotalShares;
        existingHolding.shares = newTotalShares;
      } else {
        state.holdings.push({ symbol, shares, avgBuyPrice: price });
      }
    },
    sellStock: (state, action: PayloadAction<{ symbol: string; shares: number; price: number }>) => {
      const { symbol, shares, price } = action.payload;
      const holding = state.holdings.find(h => h.symbol === symbol);

      if (!holding || holding.shares < shares) return;

      state.cash += shares * price;
      holding.shares -= shares;

      if (holding.shares === 0) {
        state.holdings = state.holdings.filter(h => h.symbol !== symbol);
      }
    },
    resetPortfolio: (state, action: PayloadAction<number | undefined>) => {
      state.cash = action.payload ?? CONFIG.initialCash;
      state.holdings = [];
    },
    applyStockSplit: (state, action: PayloadAction<{ symbol: string; ratio: number }>) => {
      const { symbol, ratio } = action.payload;
      const holding = state.holdings.find(h => h.symbol === symbol);
      if (holding) {
        // Aktienanzahl multiplizieren, Durchschnittspreis teilen
        holding.shares = holding.shares * ratio;
        holding.avgBuyPrice = holding.avgBuyPrice / ratio;
      }
    },
  },
});

export const { buyStock, sellStock, resetPortfolio, applyStockSplit } = portfolioSlice.actions;
export default portfolioSlice.reducer;
