import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { OrderBook, OrderBookEntry } from '../types';

interface OrderBookState {
  books: Record<string, OrderBook>;
}

const initialState: OrderBookState = {
  books: {},
};

/**
 * Inserts an order into a sorted array.
 * Bids: sorted by price DESC, then timestamp ASC
 * Asks: sorted by price ASC, then timestamp ASC
 */
const insertSorted = (
  orders: OrderBookEntry[],
  order: OrderBookEntry,
  isBid: boolean
): OrderBookEntry[] => {
  const newOrders = [...orders];

  // Find insertion index
  let insertIndex = 0;
  for (let i = 0; i < newOrders.length; i++) {
    const existing = newOrders[i];

    if (isBid) {
      // Bids: higher price first, then earlier timestamp
      if (order.price > existing.price) {
        break;
      }
      if (order.price === existing.price && order.timestamp < existing.timestamp) {
        break;
      }
    } else {
      // Asks: lower price first, then earlier timestamp
      if (order.price < existing.price) {
        break;
      }
      if (order.price === existing.price && order.timestamp < existing.timestamp) {
        break;
      }
    }
    insertIndex = i + 1;
  }

  newOrders.splice(insertIndex, 0, order);
  return newOrders;
};

const orderBookSlice = createSlice({
  name: 'orderBook',
  initialState,
  reducers: {
    /**
     * Initialize order books for all symbols.
     */
    initializeOrderBooks: (state, action: PayloadAction<string[]>) => {
      const symbols = action.payload;
      for (const symbol of symbols) {
        state.books[symbol] = {
          symbol,
          bids: [],
          asks: [],
        };
      }
    },

    /**
     * Add an order to the order book.
     * Order will be inserted in sorted position.
     */
    addOrder: (state, action: PayloadAction<OrderBookEntry>) => {
      const order = action.payload;
      const book = state.books[order.symbol];
      if (!book) return;

      if (order.type === 'buy') {
        book.bids = insertSorted(book.bids, order, true);
      } else {
        book.asks = insertSorted(book.asks, order, false);
      }
    },

    /**
     * Remove an order from the book (filled or cancelled).
     */
    removeOrder: (state, action: PayloadAction<{ symbol: string; orderId: string }>) => {
      const { symbol, orderId } = action.payload;
      const book = state.books[symbol];
      if (!book) return;

      book.bids = book.bids.filter(o => o.id !== orderId);
      book.asks = book.asks.filter(o => o.id !== orderId);
    },

    /**
     * Update order shares (partial fill).
     */
    updateOrderShares: (
      state,
      action: PayloadAction<{ symbol: string; orderId: string; newShares: number }>
    ) => {
      const { symbol, orderId, newShares } = action.payload;
      const book = state.books[symbol];
      if (!book) return;

      // Find in bids
      const bidIndex = book.bids.findIndex(o => o.id === orderId);
      if (bidIndex !== -1) {
        if (newShares <= 0) {
          book.bids.splice(bidIndex, 1);
        } else {
          book.bids[bidIndex].shares = newShares;
        }
        return;
      }

      // Find in asks
      const askIndex = book.asks.findIndex(o => o.id === orderId);
      if (askIndex !== -1) {
        if (newShares <= 0) {
          book.asks.splice(askIndex, 1);
        } else {
          book.asks[askIndex].shares = newShares;
        }
      }
    },

    /**
     * Decrement cycles for VP orders and remove expired ones.
     */
    tickOrderCycles: (state) => {
      for (const book of Object.values(state.books)) {
        // Process bids
        book.bids = book.bids.filter(order => {
          if (order.remainingCycles === undefined) return true; // Player orders don't expire this way
          order.remainingCycles -= 1;
          return order.remainingCycles > 0;
        });

        // Process asks
        book.asks = book.asks.filter(order => {
          if (order.remainingCycles === undefined) return true;
          order.remainingCycles -= 1;
          return order.remainingCycles > 0;
        });
      }
    },

    /**
     * Remove all orders for a specific trader (e.g., when VP sells all holdings).
     */
    removeTraderOrders: (
      state,
      action: PayloadAction<{ symbol: string; traderId: string }>
    ) => {
      const { symbol, traderId } = action.payload;
      const book = state.books[symbol];
      if (!book) return;

      book.bids = book.bids.filter(o => o.traderId !== traderId);
      book.asks = book.asks.filter(o => o.traderId !== traderId);
    },

    /**
     * Clear all orders for a symbol.
     */
    clearOrderBook: (state, action: PayloadAction<string>) => {
      const symbol = action.payload;
      if (state.books[symbol]) {
        state.books[symbol].bids = [];
        state.books[symbol].asks = [];
      }
    },

    /**
     * Adjust order prices after a stock split.
     */
    applyStockSplit: (
      state,
      action: PayloadAction<{ symbol: string; ratio: number }>
    ) => {
      const { symbol, ratio } = action.payload;
      const book = state.books[symbol];
      if (!book) return;

      book.bids = book.bids.map(order => ({
        ...order,
        shares: order.shares * ratio,
        price: order.price / ratio,
      }));

      book.asks = book.asks.map(order => ({
        ...order,
        shares: order.shares * ratio,
        price: order.price / ratio,
      }));
    },

    /**
     * Restore order book state from saved game.
     */
    restoreOrderBooks: (_state, action: PayloadAction<OrderBookState>) => {
      return action.payload;
    },

    /**
     * Reset all order books (e.g., on game reset).
     */
    resetOrderBooks: () => initialState,
  },
});

export const {
  initializeOrderBooks,
  addOrder,
  removeOrder,
  updateOrderShares,
  tickOrderCycles,
  removeTraderOrders,
  clearOrderBook,
  applyStockSplit: applyStockSplitToOrderBook,
  restoreOrderBooks,
  resetOrderBooks,
} = orderBookSlice.actions;

export default orderBookSlice.reducer;

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Select all order books.
 */
export const selectAllOrderBooks = (state: { orderBook: OrderBookState }) =>
  state.orderBook.books;

/**
 * Select order book for a specific symbol.
 */
export const selectOrderBook = (
  state: { orderBook: OrderBookState },
  symbol: string
): OrderBook | undefined => state.orderBook.books[symbol];

/**
 * Select best bid (highest buy price) for a symbol.
 */
export const selectBestBid = createSelector(
  [
    (state: { orderBook: OrderBookState }) => state.orderBook.books,
    (_state: { orderBook: OrderBookState }, symbol: string) => symbol,
  ],
  (books, symbol): OrderBookEntry | undefined => {
    const book = books[symbol];
    if (!book || book.bids.length === 0) return undefined;
    return book.bids[0]; // First bid is highest price
  }
);

/**
 * Select best ask (lowest sell price) for a symbol.
 */
export const selectBestAsk = createSelector(
  [
    (state: { orderBook: OrderBookState }) => state.orderBook.books,
    (_state: { orderBook: OrderBookState }, symbol: string) => symbol,
  ],
  (books, symbol): OrderBookEntry | undefined => {
    const book = books[symbol];
    if (!book || book.asks.length === 0) return undefined;
    return book.asks[0]; // First ask is lowest price
  }
);

/**
 * Select bid-ask spread for a symbol.
 * Returns null if either side is empty.
 */
export const selectSpread = createSelector(
  [
    (state: { orderBook: OrderBookState }) => state.orderBook.books,
    (_state: { orderBook: OrderBookState }, symbol: string) => symbol,
  ],
  (books, symbol): { absolute: number; percent: number } | null => {
    const book = books[symbol];
    if (!book || book.bids.length === 0 || book.asks.length === 0) {
      return null;
    }

    const bestBid = book.bids[0].price;
    const bestAsk = book.asks[0].price;
    const midPrice = (bestBid + bestAsk) / 2;

    return {
      absolute: bestAsk - bestBid,
      percent: midPrice > 0 ? (bestAsk - bestBid) / midPrice : 0,
    };
  }
);

/**
 * Select total volume on each side of the book.
 */
export const selectBookDepth = createSelector(
  [
    (state: { orderBook: OrderBookState }) => state.orderBook.books,
    (_state: { orderBook: OrderBookState }, symbol: string) => symbol,
  ],
  (books, symbol): { bidVolume: number; askVolume: number } => {
    const book = books[symbol];
    if (!book) return { bidVolume: 0, askVolume: 0 };

    const bidVolume = book.bids.reduce((sum, o) => sum + o.shares, 0);
    const askVolume = book.asks.reduce((sum, o) => sum + o.shares, 0);

    return { bidVolume, askVolume };
  }
);

/**
 * Select orders for a specific trader.
 */
export const selectTraderOrders = createSelector(
  [
    (state: { orderBook: OrderBookState }) => state.orderBook.books,
    (_state: { orderBook: OrderBookState }, traderId: string) => traderId,
  ],
  (books, traderId): OrderBookEntry[] => {
    const orders: OrderBookEntry[] = [];

    for (const book of Object.values(books)) {
      orders.push(...book.bids.filter(o => o.traderId === traderId));
      orders.push(...book.asks.filter(o => o.traderId === traderId));
    }

    return orders;
  }
);

/**
 * Count orders for a trader in a specific symbol.
 */
export const selectTraderOrderCount = (
  state: { orderBook: OrderBookState },
  traderId: string,
  symbol: string
): number => {
  const book = state.orderBook.books[symbol];
  if (!book) return 0;

  const bidCount = book.bids.filter(o => o.traderId === traderId).length;
  const askCount = book.asks.filter(o => o.traderId === traderId).length;

  return bidCount + askCount;
};
