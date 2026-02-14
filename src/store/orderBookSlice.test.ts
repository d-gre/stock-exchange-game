import { describe, it, expect } from 'vitest';
import reducer, {
  initializeOrderBooks,
  addOrder,
  removeOrder,
  updateOrderShares,
  tickOrderCycles,
  removeTraderOrders,
  clearOrderBook,
  applyStockSplitToOrderBook,
  restoreOrderBooks,
  resetOrderBooks,
  selectAllOrderBooks,
  selectOrderBook,
  selectBestBid,
  selectBestAsk,
  selectSpread,
  selectBookDepth,
  selectTraderOrders,
  selectTraderOrderCount,
} from './orderBookSlice';
import type { OrderBookEntry } from '../types';

describe('orderBookSlice', () => {
  const initialState = { books: {} };

  describe('initializeOrderBooks', () => {
    it('should initialize empty order books for all symbols', () => {
      const state = reducer(initialState, initializeOrderBooks(['AAPL', 'GOOGL']));

      expect(state.books['AAPL']).toEqual({ symbol: 'AAPL', bids: [], asks: [] });
      expect(state.books['GOOGL']).toEqual({ symbol: 'GOOGL', bids: [], asks: [] });
    });
  });

  describe('addOrder', () => {
    it('should add a buy order sorted by price DESC', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      const order1: OrderBookEntry = {
        id: '1',
        traderId: 'player',
        symbol: 'AAPL',
        type: 'buy',
        shares: 10,
        price: 100,
        timestamp: 1000,
      };
      const order2: OrderBookEntry = {
        id: '2',
        traderId: 'bot-1',
        symbol: 'AAPL',
        type: 'buy',
        shares: 20,
        price: 105, // Higher price, should be first
        timestamp: 2000,
      };

      state = reducer(state, addOrder(order1));
      state = reducer(state, addOrder(order2));

      expect(state.books['AAPL'].bids[0].id).toBe('2'); // Higher price first
      expect(state.books['AAPL'].bids[1].id).toBe('1');
    });

    it('should add a sell order sorted by price ASC', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      const order1: OrderBookEntry = {
        id: '1',
        traderId: 'player',
        symbol: 'AAPL',
        type: 'sell',
        shares: 10,
        price: 105,
        timestamp: 1000,
      };
      const order2: OrderBookEntry = {
        id: '2',
        traderId: 'bot-1',
        symbol: 'AAPL',
        type: 'sell',
        shares: 20,
        price: 100, // Lower price, should be first
        timestamp: 2000,
      };

      state = reducer(state, addOrder(order1));
      state = reducer(state, addOrder(order2));

      expect(state.books['AAPL'].asks[0].id).toBe('2'); // Lower price first
      expect(state.books['AAPL'].asks[1].id).toBe('1');
    });

    it('should sort by timestamp when prices are equal', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      const order1: OrderBookEntry = {
        id: '1',
        traderId: 'player',
        symbol: 'AAPL',
        type: 'buy',
        shares: 10,
        price: 100,
        timestamp: 2000, // Later timestamp
      };
      const order2: OrderBookEntry = {
        id: '2',
        traderId: 'bot-1',
        symbol: 'AAPL',
        type: 'buy',
        shares: 20,
        price: 100, // Same price
        timestamp: 1000, // Earlier timestamp, should be first
      };

      state = reducer(state, addOrder(order1));
      state = reducer(state, addOrder(order2));

      expect(state.books['AAPL'].bids[0].id).toBe('2'); // Earlier timestamp first
      expect(state.books['AAPL'].bids[1].id).toBe('1');
    });
  });

  describe('removeOrder', () => {
    it('should remove an order by ID', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      const order: OrderBookEntry = {
        id: '1',
        traderId: 'player',
        symbol: 'AAPL',
        type: 'buy',
        shares: 10,
        price: 100,
        timestamp: 1000,
      };

      state = reducer(state, addOrder(order));
      expect(state.books['AAPL'].bids.length).toBe(1);

      state = reducer(state, removeOrder({ symbol: 'AAPL', orderId: '1' }));
      expect(state.books['AAPL'].bids.length).toBe(0);
    });
  });

  describe('updateOrderShares', () => {
    it('should update shares for partial fill', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      const order: OrderBookEntry = {
        id: '1',
        traderId: 'player',
        symbol: 'AAPL',
        type: 'buy',
        shares: 100,
        price: 100,
        timestamp: 1000,
      };

      state = reducer(state, addOrder(order));
      state = reducer(state, updateOrderShares({ symbol: 'AAPL', orderId: '1', newShares: 50 }));

      expect(state.books['AAPL'].bids[0].shares).toBe(50);
    });

    it('should remove order if newShares is 0 or less', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      const order: OrderBookEntry = {
        id: '1',
        traderId: 'player',
        symbol: 'AAPL',
        type: 'buy',
        shares: 100,
        price: 100,
        timestamp: 1000,
      };

      state = reducer(state, addOrder(order));
      state = reducer(state, updateOrderShares({ symbol: 'AAPL', orderId: '1', newShares: 0 }));

      expect(state.books['AAPL'].bids.length).toBe(0);
    });
  });

  describe('tickOrderCycles', () => {
    it('should decrement remaining cycles and remove expired orders', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      const vpOrder: OrderBookEntry = {
        id: '1',
        traderId: 'bot-1',
        symbol: 'AAPL',
        type: 'buy',
        shares: 10,
        price: 100,
        timestamp: 1000,
        remainingCycles: 2,
      };
      const playerOrder: OrderBookEntry = {
        id: '2',
        traderId: 'player',
        symbol: 'AAPL',
        type: 'buy',
        shares: 10,
        price: 95,
        timestamp: 1000,
        // No remainingCycles - player orders don't expire this way
      };

      state = reducer(state, addOrder(vpOrder));
      state = reducer(state, addOrder(playerOrder));

      // First tick
      state = reducer(state, tickOrderCycles());
      expect(state.books['AAPL'].bids.length).toBe(2);
      expect(state.books['AAPL'].bids.find(o => o.id === '1')?.remainingCycles).toBe(1);

      // Second tick - VP order expires
      state = reducer(state, tickOrderCycles());
      expect(state.books['AAPL'].bids.length).toBe(1);
      expect(state.books['AAPL'].bids[0].id).toBe('2'); // Player order remains
    });
  });

  describe('selectors', () => {
    const createState = () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      // Add bids: 105, 100
      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'buy',
        shares: 50, price: 105, timestamp: 1000,
      }));
      state = reducer(state, addOrder({
        id: '2', traderId: 'bot-2', symbol: 'AAPL', type: 'buy',
        shares: 30, price: 100, timestamp: 1001,
      }));

      // Add asks: 110, 115
      state = reducer(state, addOrder({
        id: '3', traderId: 'bot-3', symbol: 'AAPL', type: 'sell',
        shares: 40, price: 110, timestamp: 1002,
      }));
      state = reducer(state, addOrder({
        id: '4', traderId: 'bot-4', symbol: 'AAPL', type: 'sell',
        shares: 60, price: 115, timestamp: 1003,
      }));

      return { orderBook: state };
    };

    it('selectBestBid should return highest bid', () => {
      const state = createState();
      const bestBid = selectBestBid(state, 'AAPL');
      expect(bestBid?.price).toBe(105);
      expect(bestBid?.shares).toBe(50);
    });

    it('selectBestAsk should return lowest ask', () => {
      const state = createState();
      const bestAsk = selectBestAsk(state, 'AAPL');
      expect(bestAsk?.price).toBe(110);
      expect(bestAsk?.shares).toBe(40);
    });

    it('selectSpread should return correct spread', () => {
      const state = createState();
      const spread = selectSpread(state, 'AAPL');
      expect(spread?.absolute).toBe(5); // 110 - 105
      expect(spread?.percent).toBeCloseTo(5 / 107.5, 5); // 5 / midpoint
    });

    it('selectBookDepth should return total volumes', () => {
      const state = createState();
      const depth = selectBookDepth(state, 'AAPL');
      expect(depth.bidVolume).toBe(80); // 50 + 30
      expect(depth.askVolume).toBe(100); // 40 + 60
    });

    it('selectBestBid should return undefined for empty book', () => {
      const state = { orderBook: reducer(initialState, initializeOrderBooks(['AAPL'])) };
      expect(selectBestBid(state, 'AAPL')).toBeUndefined();
    });

    it('selectBestAsk should return undefined for empty book', () => {
      const state = { orderBook: reducer(initialState, initializeOrderBooks(['AAPL'])) };
      expect(selectBestAsk(state, 'AAPL')).toBeUndefined();
    });

    it('selectSpread should return null for empty book', () => {
      const state = { orderBook: reducer(initialState, initializeOrderBooks(['AAPL'])) };
      expect(selectSpread(state, 'AAPL')).toBeNull();
    });

    it('selectSpread should return null when only bids exist', () => {
      let innerState = reducer(initialState, initializeOrderBooks(['AAPL']));
      innerState = reducer(innerState, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'buy',
        shares: 50, price: 100, timestamp: 1000,
      }));
      expect(selectSpread({ orderBook: innerState }, 'AAPL')).toBeNull();
    });

    it('selectBookDepth should return zeros for unknown symbol', () => {
      const state = { orderBook: reducer(initialState, initializeOrderBooks(['AAPL'])) };
      expect(selectBookDepth(state, 'UNKNOWN')).toEqual({ bidVolume: 0, askVolume: 0 });
    });

    it('selectAllOrderBooks should return all books', () => {
      const state = { orderBook: reducer(initialState, initializeOrderBooks(['AAPL', 'GOOGL'])) };
      const books = selectAllOrderBooks(state);
      expect(Object.keys(books)).toEqual(['AAPL', 'GOOGL']);
    });

    it('selectOrderBook should return book for symbol', () => {
      const state = { orderBook: reducer(initialState, initializeOrderBooks(['AAPL'])) };
      const book = selectOrderBook(state, 'AAPL');
      expect(book?.symbol).toBe('AAPL');
    });

    it('selectOrderBook should return undefined for unknown symbol', () => {
      const state = { orderBook: reducer(initialState, initializeOrderBooks(['AAPL'])) };
      expect(selectOrderBook(state, 'UNKNOWN')).toBeUndefined();
    });

    it('selectTraderOrders should return all orders for a trader', () => {
      const state = createState();
      const orders = selectTraderOrders(state, 'bot-1');
      expect(orders.length).toBe(1);
      expect(orders[0].traderId).toBe('bot-1');
    });

    it('selectTraderOrders should return empty array for unknown trader', () => {
      const state = createState();
      const orders = selectTraderOrders(state, 'unknown');
      expect(orders).toEqual([]);
    });

    it('selectTraderOrderCount should return count for symbol', () => {
      const state = createState();
      expect(selectTraderOrderCount(state, 'bot-1', 'AAPL')).toBe(1);
      expect(selectTraderOrderCount(state, 'bot-2', 'AAPL')).toBe(1);
    });

    it('selectTraderOrderCount should return 0 for unknown trader', () => {
      const state = createState();
      expect(selectTraderOrderCount(state, 'unknown', 'AAPL')).toBe(0);
    });

    it('selectTraderOrderCount should return 0 for unknown symbol', () => {
      const state = createState();
      expect(selectTraderOrderCount(state, 'bot-1', 'UNKNOWN')).toBe(0);
    });
  });

  describe('removeTraderOrders', () => {
    it('should remove all orders for a trader', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'buy',
        shares: 50, price: 100, timestamp: 1000,
      }));
      state = reducer(state, addOrder({
        id: '2', traderId: 'bot-1', symbol: 'AAPL', type: 'sell',
        shares: 30, price: 110, timestamp: 1001,
      }));
      state = reducer(state, addOrder({
        id: '3', traderId: 'bot-2', symbol: 'AAPL', type: 'buy',
        shares: 20, price: 95, timestamp: 1002,
      }));

      expect(state.books['AAPL'].bids.length).toBe(2);
      expect(state.books['AAPL'].asks.length).toBe(1);

      state = reducer(state, removeTraderOrders({ symbol: 'AAPL', traderId: 'bot-1' }));

      expect(state.books['AAPL'].bids.length).toBe(1);
      expect(state.books['AAPL'].bids[0].traderId).toBe('bot-2');
      expect(state.books['AAPL'].asks.length).toBe(0);
    });

    it('should not affect orders for unknown symbol', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));
      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'buy',
        shares: 50, price: 100, timestamp: 1000,
      }));

      state = reducer(state, removeTraderOrders({ symbol: 'UNKNOWN', traderId: 'bot-1' }));
      expect(state.books['AAPL'].bids.length).toBe(1);
    });
  });

  describe('clearOrderBook', () => {
    it('should clear all orders for a symbol', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'buy',
        shares: 50, price: 100, timestamp: 1000,
      }));
      state = reducer(state, addOrder({
        id: '2', traderId: 'bot-2', symbol: 'AAPL', type: 'sell',
        shares: 30, price: 110, timestamp: 1001,
      }));

      state = reducer(state, clearOrderBook('AAPL'));

      expect(state.books['AAPL'].bids).toEqual([]);
      expect(state.books['AAPL'].asks).toEqual([]);
    });

    it('should not affect unknown symbol', () => {
      const state = reducer(initialState, initializeOrderBooks(['AAPL']));
      const newState = reducer(state, clearOrderBook('UNKNOWN'));
      expect(newState).toEqual(state);
    });
  });

  describe('applyStockSplitToOrderBook', () => {
    it('should adjust shares and prices for stock split', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'buy',
        shares: 50, price: 100, timestamp: 1000,
      }));
      state = reducer(state, addOrder({
        id: '2', traderId: 'bot-2', symbol: 'AAPL', type: 'sell',
        shares: 30, price: 110, timestamp: 1001,
      }));

      state = reducer(state, applyStockSplitToOrderBook({ symbol: 'AAPL', ratio: 2 }));

      // Shares doubled, prices halved
      expect(state.books['AAPL'].bids[0].shares).toBe(100);
      expect(state.books['AAPL'].bids[0].price).toBe(50);
      expect(state.books['AAPL'].asks[0].shares).toBe(60);
      expect(state.books['AAPL'].asks[0].price).toBe(55);
    });

    it('should not affect unknown symbol', () => {
      const state = reducer(initialState, initializeOrderBooks(['AAPL']));
      const newState = reducer(state, applyStockSplitToOrderBook({ symbol: 'UNKNOWN', ratio: 2 }));
      expect(newState).toEqual(state);
    });
  });

  describe('restoreOrderBooks', () => {
    it('should restore order books from saved state', () => {
      const savedState = {
        books: {
          AAPL: {
            symbol: 'AAPL',
            bids: [{ id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'buy' as const, shares: 50, price: 100, timestamp: 1000 }],
            asks: [],
          },
        },
      };

      const newState = reducer(initialState, restoreOrderBooks(savedState));
      expect(newState).toEqual(savedState);
    });
  });

  describe('resetOrderBooks', () => {
    it('should reset to initial state', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));
      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'buy',
        shares: 50, price: 100, timestamp: 1000,
      }));

      state = reducer(state, resetOrderBooks());
      expect(state).toEqual({ books: {} });
    });
  });

  describe('addOrder - edge cases', () => {
    it('should not add order to unknown symbol', () => {
      const state = reducer(initialState, initializeOrderBooks(['AAPL']));

      const newState = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'UNKNOWN', type: 'buy',
        shares: 50, price: 100, timestamp: 1000,
      }));

      expect(newState).toEqual(state);
    });

    it('should sort asks by timestamp when prices are equal', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'sell',
        shares: 50, price: 100, timestamp: 2000, // Later
      }));
      state = reducer(state, addOrder({
        id: '2', traderId: 'bot-2', symbol: 'AAPL', type: 'sell',
        shares: 30, price: 100, timestamp: 1000, // Earlier
      }));

      expect(state.books['AAPL'].asks[0].id).toBe('2'); // Earlier timestamp first
      expect(state.books['AAPL'].asks[1].id).toBe('1');
    });
  });

  describe('removeOrder - edge cases', () => {
    it('should not fail for unknown symbol', () => {
      const state = reducer(initialState, initializeOrderBooks(['AAPL']));
      const newState = reducer(state, removeOrder({ symbol: 'UNKNOWN', orderId: '1' }));
      expect(newState).toEqual(state);
    });

    it('should remove order from asks', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));
      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'sell',
        shares: 50, price: 100, timestamp: 1000,
      }));

      state = reducer(state, removeOrder({ symbol: 'AAPL', orderId: '1' }));
      expect(state.books['AAPL'].asks.length).toBe(0);
    });
  });

  describe('updateOrderShares - edge cases', () => {
    it('should not fail for unknown symbol', () => {
      const state = reducer(initialState, initializeOrderBooks(['AAPL']));
      const newState = reducer(state, updateOrderShares({ symbol: 'UNKNOWN', orderId: '1', newShares: 50 }));
      expect(newState).toEqual(state);
    });

    it('should update shares for sell orders', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));
      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'sell',
        shares: 100, price: 100, timestamp: 1000,
      }));

      state = reducer(state, updateOrderShares({ symbol: 'AAPL', orderId: '1', newShares: 50 }));
      expect(state.books['AAPL'].asks[0].shares).toBe(50);
    });

    it('should remove sell order if newShares is 0', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));
      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'sell',
        shares: 100, price: 100, timestamp: 1000,
      }));

      state = reducer(state, updateOrderShares({ symbol: 'AAPL', orderId: '1', newShares: 0 }));
      expect(state.books['AAPL'].asks.length).toBe(0);
    });
  });

  describe('tickOrderCycles - additional cases', () => {
    it('should handle asks with remaining cycles', () => {
      let state = reducer(initialState, initializeOrderBooks(['AAPL']));

      state = reducer(state, addOrder({
        id: '1', traderId: 'bot-1', symbol: 'AAPL', type: 'sell',
        shares: 50, price: 110, timestamp: 1000,
        remainingCycles: 1,
      }));

      state = reducer(state, tickOrderCycles());
      expect(state.books['AAPL'].asks.length).toBe(0); // Expired
    });
  });
});
