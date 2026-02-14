import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { MarketMakerInventory } from '../types';
import { MARKET_MAKER_CONFIG } from '../config';

interface MarketMakerState {
  inventory: Record<string, MarketMakerInventory>;
}

const initialState: MarketMakerState = {
  inventory: {},
};

/**
 * Calculates the spread multiplier based on inventory level.
 * - Low inventory (< 100%) → higher spread (up to 3x)
 * - High inventory (> 100%) → lower spread (down to 0.5x)
 */
export const calculateSpreadMultiplier = (
  currentInventory: number,
  baseInventory: number
): number => {
  const ratio = currentInventory / baseInventory;
  const {
    minInventoryThreshold,
    maxInventoryThreshold,
    minSpreadMultiplier,
    maxSpreadMultiplier,
  } = MARKET_MAKER_CONFIG;

  // Clamp to thresholds
  if (ratio <= minInventoryThreshold) return maxSpreadMultiplier;
  if (ratio >= maxInventoryThreshold) return minSpreadMultiplier;

  // Linear interpolation
  if (ratio < 1.0) {
    // Below base: interpolate from maxSpread at minThreshold to 1.0 at ratio=1.0
    const t = (ratio - minInventoryThreshold) / (1.0 - minInventoryThreshold);
    return maxSpreadMultiplier - t * (maxSpreadMultiplier - 1.0);
  } else {
    // Above base: interpolate from 1.0 at ratio=1.0 to minSpread at maxThreshold
    const t = (ratio - 1.0) / (maxInventoryThreshold - 1.0);
    return 1.0 - t * (1.0 - minSpreadMultiplier);
  }
};

const marketMakerSlice = createSlice({
  name: 'marketMaker',
  initialState,
  reducers: {
    /**
     * Initialize inventory for all stocks
     */
    initializeInventory: (state, action: PayloadAction<string[]>) => {
      const symbols = action.payload;
      const baseInventory = MARKET_MAKER_CONFIG.baseInventoryPerStock;

      symbols.forEach(symbol => {
        state.inventory[symbol] = {
          symbol,
          inventory: baseInventory,
          baseInventory,
          spreadMultiplier: 1.0,
        };
      });
    },

    /**
     * Execute a trade and update inventory
     * - Buy: MM sells → inventory decreases
     * - Sell: MM buys → inventory increases
     */
    executeTrade: (
      state,
      action: PayloadAction<{ symbol: string; type: 'buy' | 'sell'; shares: number }>
    ) => {
      const { symbol, type, shares } = action.payload;
      const mmState = state.inventory[symbol];
      if (!mmState) return;

      // Update inventory
      if (type === 'buy') {
        // Player buys → MM sells → inventory decreases
        mmState.inventory = Math.max(0, mmState.inventory - shares);
      } else {
        // Player sells → MM buys → inventory increases
        mmState.inventory += shares;
      }

      // Recalculate spread multiplier
      mmState.spreadMultiplier = calculateSpreadMultiplier(
        mmState.inventory,
        mmState.baseInventory
      );
    },

    /**
     * Execute trade with reduced effect (for virtual players)
     * Virtual player trades have 50% of the inventory impact
     */
    executeVirtualTrade: (
      state,
      action: PayloadAction<{ symbol: string; type: 'buy' | 'sell'; shares: number }>
    ) => {
      const { symbol, type, shares } = action.payload;
      const mmState = state.inventory[symbol];
      if (!mmState) return;

      // Reduced effect (50%) for virtual players
      const effectiveShares = Math.floor(shares * 0.5);

      if (type === 'buy') {
        mmState.inventory = Math.max(0, mmState.inventory - effectiveShares);
      } else {
        mmState.inventory += effectiveShares;
      }

      mmState.spreadMultiplier = calculateSpreadMultiplier(
        mmState.inventory,
        mmState.baseInventory
      );
    },

    /**
     * Rebalance inventory towards base level (called each cycle)
     * Slowly moves inventory back to base level
     */
    rebalanceInventory: state => {
      const rebalanceRate = MARKET_MAKER_CONFIG.rebalanceRate;

      Object.values(state.inventory).forEach(mmState => {
        const diff = mmState.baseInventory - mmState.inventory;
        const adjustment = Math.round(diff * rebalanceRate);

        if (adjustment !== 0) {
          mmState.inventory += adjustment;
          mmState.spreadMultiplier = calculateSpreadMultiplier(
            mmState.inventory,
            mmState.baseInventory
          );
        }
      });
    },

    /**
     * Reset all inventory to base level (e.g., on game reset)
     */
    resetInventory: state => {
      Object.values(state.inventory).forEach(mmState => {
        mmState.inventory = mmState.baseInventory;
        mmState.spreadMultiplier = 1.0;
      });
    },

    /**
     * Restore market maker state from saved game
     */
    restoreMarketMaker: (_state, action: PayloadAction<MarketMakerState>) => {
      return action.payload;
    },
  },
});

export const {
  initializeInventory,
  executeTrade,
  executeVirtualTrade,
  rebalanceInventory,
  resetInventory,
  restoreMarketMaker,
} = marketMakerSlice.actions;

export default marketMakerSlice.reducer;

// Selectors
export const selectMarketMakerInventory = (state: { marketMaker: MarketMakerState }) =>
  state.marketMaker.inventory;

export const selectSpreadMultiplier = (
  state: { marketMaker: MarketMakerState },
  symbol: string
): number => {
  return state.marketMaker.inventory[symbol]?.spreadMultiplier ?? 1.0;
};

export const selectInventoryLevel = (
  state: { marketMaker: MarketMakerState },
  symbol: string
): number => {
  const mmState = state.marketMaker.inventory[symbol];
  if (!mmState) return 1.0;
  return mmState.inventory / mmState.baseInventory;
};

export const selectAllInventoryLevels = createSelector(
  [(state: { marketMaker: MarketMakerState }) => state.marketMaker.inventory],
  (inventory): Record<string, { level: number; spreadMultiplier: number }> => {
    const result: Record<string, { level: number; spreadMultiplier: number }> = {};
    Object.entries(inventory).forEach(([symbol, mmState]) => {
      result[symbol] = {
        level: mmState.inventory / mmState.baseInventory,
        spreadMultiplier: mmState.spreadMultiplier,
      };
    });
    return result;
  }
);

// ============================================================================
// HYBRID SYSTEM HELPERS
// ============================================================================

/**
 * Check if the Market Maker can fill a buy order.
 * In the hybrid system, MM only fills if it has sufficient inventory.
 *
 * @param state - Market maker state
 * @param symbol - Stock symbol
 * @param shares - Number of shares requested
 * @returns true if MM can fill the order
 */
export const canMMFillBuy = (
  state: { marketMaker: MarketMakerState },
  symbol: string,
  shares: number
): boolean => {
  const mmState = state.marketMaker.inventory[symbol];
  if (!mmState) return false;

  // MM can fill if it has enough inventory
  return mmState.inventory >= shares;
};

/**
 * Check if the Market Maker can accept a sell order.
 * MM can almost always accept sells (buying from players),
 * but may offer worse prices if inventory is already high.
 *
 * @param state - Market maker state
 * @param symbol - Stock symbol
 * @param _shares - Number of shares offered
 * @returns true if MM can accept the sell
 */
export const canMMAcceptSell = (
  state: { marketMaker: MarketMakerState },
  symbol: string,
  _shares: number
): boolean => {
  const mmState = state.marketMaker.inventory[symbol];
  if (!mmState) return false;

  // MM can generally always accept sells
  // The spread multiplier already penalizes this if inventory is high
  return true;
};

/**
 * Get the maximum shares MM can provide for a buy order.
 *
 * @param state - Market maker state
 * @param symbol - Stock symbol
 * @returns Maximum shares available from MM
 */
export const getMMAvailableShares = (
  state: { marketMaker: MarketMakerState },
  symbol: string
): number => {
  const mmState = state.marketMaker.inventory[symbol];
  if (!mmState) return 0;
  return Math.max(0, mmState.inventory);
};
