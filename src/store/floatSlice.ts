import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { StockFloat, Stock, ShareHolder, PortfolioItem, VirtualPlayer } from '../types';
import { FLOAT_CONFIG } from '../config';

interface FloatState {
  floats: Record<string, StockFloat>;
}

const initialState: FloatState = {
  floats: {},
};

/**
 * Calculates the float shares for a stock based on market cap and price.
 * Float = (marketCap / price) * floatPercentage / scaleFactor
 */
export const calculateFloatShares = (
  marketCapBillions: number,
  basePrice: number
): number => {
  const totalShares = (marketCapBillions * 1e9) / basePrice;
  const floatShares = totalShares * FLOAT_CONFIG.floatPercentage;
  return Math.floor(floatShares / FLOAT_CONFIG.scaleFactor);
};

const floatSlice = createSlice({
  name: 'float',
  initialState,
  reducers: {
    /**
     * Initialize floats for all stocks.
     * Called at game start to set up the initial share distribution.
     */
    initializeFloats: (
      state,
      action: PayloadAction<{
        stocks: Stock[];
        playerHoldings: PortfolioItem[];
        virtualPlayers: VirtualPlayer[];
      }>
    ) => {
      const { stocks, playerHoldings, virtualPlayers } = action.payload;

      // Calculate VP holdings per symbol
      const vpHoldingsPerSymbol: Record<string, number> = {};
      for (const vp of virtualPlayers) {
        for (const holding of vp.portfolio.holdings) {
          vpHoldingsPerSymbol[holding.symbol] =
            (vpHoldingsPerSymbol[holding.symbol] ?? 0) + holding.shares;
        }
      }

      // Calculate player holdings per symbol
      const playerHoldingsPerSymbol: Record<string, number> = {};
      for (const holding of playerHoldings) {
        playerHoldingsPerSymbol[holding.symbol] = holding.shares;
      }

      for (const stock of stocks) {
        // Use floatShares if available, otherwise calculate from market cap
        const totalFloat = stock.floatShares ?? calculateFloatShares(stock.marketCapBillions, stock.currentPrice);
        const playerHeldShares = playerHoldingsPerSymbol[stock.symbol] ?? 0;
        const vpHeldShares = vpHoldingsPerSymbol[stock.symbol] ?? 0;

        // MM holds the remainder (initial state: most shares with MM)
        const mmHeldShares = Math.max(0, totalFloat - playerHeldShares - vpHeldShares);

        state.floats[stock.symbol] = {
          symbol: stock.symbol,
          totalFloat,
          mmHeldShares,
          playerHeldShares,
          vpHeldShares,
          reservedShares: 0,
        };
      }
    },

    /**
     * Transfer shares between holders.
     * Used when trades are executed.
     */
    transferShares: (
      state,
      action: PayloadAction<{
        symbol: string;
        from: ShareHolder;
        to: ShareHolder;
        shares: number;
      }>
    ) => {
      const { symbol, from, to, shares } = action.payload;
      const floatState = state.floats[symbol];
      if (!floatState || shares <= 0) return;

      // Deduct from source
      switch (from) {
        case 'mm':
          floatState.mmHeldShares = Math.max(0, floatState.mmHeldShares - shares);
          break;
        case 'player':
          floatState.playerHeldShares = Math.max(0, floatState.playerHeldShares - shares);
          break;
        case 'vp':
          floatState.vpHeldShares = Math.max(0, floatState.vpHeldShares - shares);
          break;
      }

      // Add to destination
      switch (to) {
        case 'mm':
          floatState.mmHeldShares += shares;
          break;
        case 'player':
          floatState.playerHeldShares += shares;
          break;
        case 'vp':
          floatState.vpHeldShares += shares;
          break;
      }
    },

    /**
     * Reserve shares for pending orders.
     * Called when a sell order is placed.
     */
    reserveShares: (
      state,
      action: PayloadAction<{ symbol: string; shares: number }>
    ) => {
      const { symbol, shares } = action.payload;
      const floatState = state.floats[symbol];
      if (!floatState || shares <= 0) return;

      floatState.reservedShares += shares;
    },

    /**
     * Release reserved shares (order cancelled or executed).
     */
    releaseReservedShares: (
      state,
      action: PayloadAction<{ symbol: string; shares: number }>
    ) => {
      const { symbol, shares } = action.payload;
      const floatState = state.floats[symbol];
      if (!floatState || shares <= 0) return;

      floatState.reservedShares = Math.max(0, floatState.reservedShares - shares);
    },

    /**
     * Adjust float after a stock split.
     * Multiplies all share counts by the split ratio.
     */
    applyStockSplit: (
      state,
      action: PayloadAction<{ symbol: string; ratio: number }>
    ) => {
      const { symbol, ratio } = action.payload;
      const floatState = state.floats[symbol];
      if (!floatState) return;

      floatState.totalFloat *= ratio;
      floatState.mmHeldShares *= ratio;
      floatState.playerHeldShares *= ratio;
      floatState.vpHeldShares *= ratio;
      floatState.reservedShares *= ratio;
    },

    /**
     * Restore float state from saved game.
     */
    restoreFloats: (_state, action: PayloadAction<FloatState>) => {
      return action.payload;
    },

    /**
     * Reset floats (e.g., on game reset).
     */
    resetFloats: () => initialState,
  },
});

export const {
  initializeFloats,
  transferShares,
  reserveShares,
  releaseReservedShares,
  applyStockSplit: applyStockSplitToFloat,
  restoreFloats,
  resetFloats,
} = floatSlice.actions;

export default floatSlice.reducer;

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Select all floats.
 */
export const selectAllFloats = (state: { float: FloatState }) =>
  state.float.floats;

/**
 * Select float for a specific symbol.
 */
export const selectFloatBySymbol = (
  state: { float: FloatState },
  symbol: string
): StockFloat | undefined => state.float.floats[symbol];

/**
 * Select available shares for purchase (from MM or other sellers).
 * This is the number of shares that can be bought from the market.
 */
export const selectAvailableForPurchase = createSelector(
  [
    (state: { float: FloatState }) => state.float.floats,
    (_state: { float: FloatState }, symbol: string) => symbol,
  ],
  (floats, symbol): number => {
    const floatState = floats[symbol];
    if (!floatState) return 0;

    // Available = MM held shares (not reserved)
    // In the hybrid system, we also consider order book asks,
    // but this selector returns MM availability only
    return Math.max(0, floatState.mmHeldShares);
  }
);

/**
 * Select whether float is running low (warning threshold).
 */
export const selectIsLowFloat = createSelector(
  [
    (state: { float: FloatState }) => state.float.floats,
    (_state: { float: FloatState }, symbol: string) => symbol,
  ],
  (floats, symbol): boolean => {
    const floatState = floats[symbol];
    if (!floatState || floatState.totalFloat === 0) return false;

    const availablePercent = floatState.mmHeldShares / floatState.totalFloat;
    return availablePercent < FLOAT_CONFIG.lowFloatWarningPercent;
  }
);

/**
 * Select float utilization (how much of total float is held by players/VPs).
 */
export const selectFloatUtilization = createSelector(
  [
    (state: { float: FloatState }) => state.float.floats,
    (_state: { float: FloatState }, symbol: string) => symbol,
  ],
  (floats, symbol): number => {
    const floatState = floats[symbol];
    if (!floatState || floatState.totalFloat === 0) return 0;

    const heldByTraders = floatState.playerHeldShares + floatState.vpHeldShares;
    return heldByTraders / floatState.totalFloat;
  }
);

/**
 * Select summary of all floats (for UI display).
 */
export const selectFloatSummary = createSelector(
  [(state: { float: FloatState }) => state.float.floats],
  (floats): Record<string, { available: number; total: number; utilization: number }> => {
    const result: Record<string, { available: number; total: number; utilization: number }> = {};

    for (const [symbol, floatState] of Object.entries(floats)) {
      const utilization =
        floatState.totalFloat > 0
          ? (floatState.playerHeldShares + floatState.vpHeldShares) / floatState.totalFloat
          : 0;

      result[symbol] = {
        available: floatState.mmHeldShares,
        total: floatState.totalFloat,
        utilization,
      };
    }

    return result;
  }
);
