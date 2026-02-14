import { describe, it, expect } from 'vitest';
import {
  canMatch,
  calculateMatchPrice,
  matchOrder,
  canPotentiallyMatch,
  getBestPrice,
  calculateVWAP,
  createOrderBookEntry,
  getVolumeAtPrice,
  getAvailableVolume,
} from './orderMatching';
import type { OrderBookEntry, OrderBook } from '../types';

describe('orderMatching', () => {
  describe('canMatch', () => {
    it('should return true when bid price >= ask price', () => {
      const bid: OrderBookEntry = {
        id: '1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 10, price: 100, timestamp: 1000,
      };
      const ask: OrderBookEntry = {
        id: '2', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 10, price: 100, timestamp: 1001,
      };

      expect(canMatch(bid, ask)).toBe(true);
    });

    it('should return true when bid is higher than ask', () => {
      const bid: OrderBookEntry = {
        id: '1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 10, price: 105, timestamp: 1000,
      };
      const ask: OrderBookEntry = {
        id: '2', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 10, price: 100, timestamp: 1001,
      };

      expect(canMatch(bid, ask)).toBe(true);
    });

    it('should return false when bid price < ask price', () => {
      const bid: OrderBookEntry = {
        id: '1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 10, price: 95, timestamp: 1000,
      };
      const ask: OrderBookEntry = {
        id: '2', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 10, price: 100, timestamp: 1001,
      };

      expect(canMatch(bid, ask)).toBe(false);
    });
  });

  describe('calculateMatchPrice', () => {
    it('should use the makers price (earlier timestamp)', () => {
      const bid: OrderBookEntry = {
        id: '1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 10, price: 105, timestamp: 1000, // Earlier = maker
      };
      const ask: OrderBookEntry = {
        id: '2', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 10, price: 100, timestamp: 2000,
      };

      expect(calculateMatchPrice(bid, ask)).toBe(105); // Bid's price (maker)
    });

    it('should use ask price when ask is the maker', () => {
      const bid: OrderBookEntry = {
        id: '1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 10, price: 105, timestamp: 2000,
      };
      const ask: OrderBookEntry = {
        id: '2', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 10, price: 100, timestamp: 1000, // Earlier = maker
      };

      expect(calculateMatchPrice(bid, ask)).toBe(100); // Ask's price (maker)
    });
  });

  describe('matchOrder', () => {
    const createOrderBook = (bids: OrderBookEntry[], asks: OrderBookEntry[]): OrderBook => ({
      symbol: 'AAPL',
      bids,
      asks,
    });

    it('should match a buy order against asks', () => {
      const book = createOrderBook(
        [],
        [
          { id: 'a1', traderId: 'seller1', symbol: 'AAPL', type: 'sell', shares: 50, price: 100, timestamp: 1000 },
          { id: 'a2', traderId: 'seller2', symbol: 'AAPL', type: 'sell', shares: 30, price: 105, timestamp: 1001 },
        ]
      );

      const buyOrder: OrderBookEntry = {
        id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 70, price: 110, timestamp: 2000,
      };

      const result = matchOrder(buyOrder, book);

      expect(result.executedTrades.length).toBe(2);
      expect(result.executedTrades[0].shares).toBe(50);
      expect(result.executedTrades[0].price).toBe(100);
      expect(result.executedTrades[1].shares).toBe(20);
      expect(result.executedTrades[1].price).toBe(105);
      expect(result.matchedOrderIds).toContain('a1');
      expect(result.partialFills['a2']).toBe(10); // 30 - 20 = 10 remaining
      expect(result.unfilledShares).toBe(0);
    });

    it('should not match when no compatible orders exist', () => {
      const book = createOrderBook(
        [],
        [
          { id: 'a1', traderId: 'seller1', symbol: 'AAPL', type: 'sell', shares: 50, price: 120, timestamp: 1000 },
        ]
      );

      const buyOrder: OrderBookEntry = {
        id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 30, price: 100, timestamp: 2000, // Below ask price
      };

      const result = matchOrder(buyOrder, book);

      expect(result.executedTrades.length).toBe(0);
      expect(result.unfilledShares).toBe(30);
    });

    it('should not match with own orders', () => {
      const book = createOrderBook(
        [],
        [
          { id: 'a1', traderId: 'trader1', symbol: 'AAPL', type: 'sell', shares: 50, price: 100, timestamp: 1000 },
        ]
      );

      const buyOrder: OrderBookEntry = {
        id: 'b1', traderId: 'trader1', symbol: 'AAPL', type: 'buy', // Same trader
        shares: 30, price: 110, timestamp: 2000,
      };

      const result = matchOrder(buyOrder, book);

      expect(result.executedTrades.length).toBe(0);
      expect(result.unfilledShares).toBe(30);
    });

    it('should match a sell order against bids', () => {
      const book = createOrderBook(
        [
          { id: 'b1', traderId: 'buyer1', symbol: 'AAPL', type: 'buy', shares: 40, price: 105, timestamp: 1000 },
          { id: 'b2', traderId: 'buyer2', symbol: 'AAPL', type: 'buy', shares: 60, price: 100, timestamp: 1001 },
        ],
        []
      );

      const sellOrder: OrderBookEntry = {
        id: 's1', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 50, price: 95, timestamp: 2000,
      };

      const result = matchOrder(sellOrder, book);

      expect(result.executedTrades.length).toBe(2);
      expect(result.executedTrades[0].shares).toBe(40);
      expect(result.executedTrades[0].price).toBe(105);
      expect(result.executedTrades[1].shares).toBe(10);
      expect(result.executedTrades[1].price).toBe(100);
      expect(result.matchedOrderIds).toContain('b1');
      expect(result.partialFills['b2']).toBe(50); // 60 - 10 = 50 remaining
      expect(result.unfilledShares).toBe(0);
    });
  });

  describe('canPotentiallyMatch', () => {
    it('should return true for buy order when bid >= best ask', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [],
        asks: [
          { id: 'a1', traderId: 'seller', symbol: 'AAPL', type: 'sell', shares: 10, price: 100, timestamp: 1000 },
        ],
      };

      const buyOrder: OrderBookEntry = {
        id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 10, price: 100, timestamp: 2000,
      };

      expect(canPotentiallyMatch(buyOrder, book)).toBe(true);
    });

    it('should return false for buy order when bid < best ask', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [],
        asks: [
          { id: 'a1', traderId: 'seller', symbol: 'AAPL', type: 'sell', shares: 10, price: 100, timestamp: 1000 },
        ],
      };

      const buyOrder: OrderBookEntry = {
        id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 10, price: 95, timestamp: 2000,
      };

      expect(canPotentiallyMatch(buyOrder, book)).toBe(false);
    });
  });

  describe('getBestPrice', () => {
    it('should return best ask for buy orders', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [],
        asks: [
          { id: 'a1', traderId: 'seller', symbol: 'AAPL', type: 'sell', shares: 10, price: 100, timestamp: 1000 },
          { id: 'a2', traderId: 'seller2', symbol: 'AAPL', type: 'sell', shares: 10, price: 105, timestamp: 1001 },
        ],
      };

      expect(getBestPrice('buy', book)).toBe(100);
    });

    it('should return best bid for sell orders', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [
          { id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy', shares: 10, price: 105, timestamp: 1000 },
          { id: 'b2', traderId: 'buyer2', symbol: 'AAPL', type: 'buy', shares: 10, price: 100, timestamp: 1001 },
        ],
        asks: [],
      };

      expect(getBestPrice('sell', book)).toBe(105);
    });

    it('should return null when no orders on that side', () => {
      const book: OrderBook = { symbol: 'AAPL', bids: [], asks: [] };
      expect(getBestPrice('buy', book)).toBeNull();
      expect(getBestPrice('sell', book)).toBeNull();
    });
  });

  describe('calculateVWAP', () => {
    it('should calculate correct VWAP for buy orders', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [],
        asks: [
          { id: 'a1', traderId: 's1', symbol: 'AAPL', type: 'sell', shares: 50, price: 100, timestamp: 1000 },
          { id: 'a2', traderId: 's2', symbol: 'AAPL', type: 'sell', shares: 50, price: 110, timestamp: 1001 },
        ],
      };

      const result = calculateVWAP(80, 'buy', book);

      // 50 shares @ 100 + 30 shares @ 110 = 5000 + 3300 = 8300 / 80 = 103.75
      expect(result.vwap).toBe(103.75);
      expect(result.fillableShares).toBe(80);
    });

    it('should return fillable shares when not enough liquidity', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [],
        asks: [
          { id: 'a1', traderId: 's1', symbol: 'AAPL', type: 'sell', shares: 30, price: 100, timestamp: 1000 },
        ],
      };

      const result = calculateVWAP(100, 'buy', book);

      expect(result.fillableShares).toBe(30);
      expect(result.vwap).toBe(100);
    });
  });

  describe('createOrderBookEntry', () => {
    it('should create a valid order book entry', () => {
      const entry = createOrderBookEntry('player', 'AAPL', 'buy', 100, 150.50);

      expect(entry.traderId).toBe('player');
      expect(entry.symbol).toBe('AAPL');
      expect(entry.type).toBe('buy');
      expect(entry.shares).toBe(100);
      expect(entry.price).toBe(150.50);
      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });

    it('should include optional fields when provided', () => {
      const entry = createOrderBookEntry('bot-1', 'AAPL', 'sell', 50, 151, 'orig-123', 5);

      expect(entry.originalOrderId).toBe('orig-123');
      expect(entry.remainingCycles).toBe(5);
    });
  });

  describe('getVolumeAtPrice', () => {
    it('should return volume at a specific bid price', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [
          { id: 'b1', traderId: 'buyer1', symbol: 'AAPL', type: 'buy', shares: 50, price: 100, timestamp: 1000 },
          { id: 'b2', traderId: 'buyer2', symbol: 'AAPL', type: 'buy', shares: 30, price: 100, timestamp: 1001 },
          { id: 'b3', traderId: 'buyer3', symbol: 'AAPL', type: 'buy', shares: 20, price: 95, timestamp: 1002 },
        ],
        asks: [],
      };

      expect(getVolumeAtPrice(100, 'bid', book)).toBe(80); // 50 + 30
      expect(getVolumeAtPrice(95, 'bid', book)).toBe(20);
      expect(getVolumeAtPrice(90, 'bid', book)).toBe(0);
    });

    it('should return volume at a specific ask price', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [],
        asks: [
          { id: 'a1', traderId: 'seller1', symbol: 'AAPL', type: 'sell', shares: 40, price: 110, timestamp: 1000 },
          { id: 'a2', traderId: 'seller2', symbol: 'AAPL', type: 'sell', shares: 25, price: 110, timestamp: 1001 },
        ],
      };

      expect(getVolumeAtPrice(110, 'ask', book)).toBe(65);
      expect(getVolumeAtPrice(115, 'ask', book)).toBe(0);
    });
  });

  describe('getAvailableVolume', () => {
    it('should return total bid volume at or above a price', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [
          { id: 'b1', traderId: 'buyer1', symbol: 'AAPL', type: 'buy', shares: 50, price: 105, timestamp: 1000 },
          { id: 'b2', traderId: 'buyer2', symbol: 'AAPL', type: 'buy', shares: 30, price: 100, timestamp: 1001 },
          { id: 'b3', traderId: 'buyer3', symbol: 'AAPL', type: 'buy', shares: 20, price: 95, timestamp: 1002 },
        ],
        asks: [],
      };

      expect(getAvailableVolume(100, 'bid', book)).toBe(80); // 50 at 105 + 30 at 100
      expect(getAvailableVolume(95, 'bid', book)).toBe(100); // All
      expect(getAvailableVolume(110, 'bid', book)).toBe(0);
    });

    it('should return total ask volume at or below a price', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [],
        asks: [
          { id: 'a1', traderId: 'seller1', symbol: 'AAPL', type: 'sell', shares: 40, price: 100, timestamp: 1000 },
          { id: 'a2', traderId: 'seller2', symbol: 'AAPL', type: 'sell', shares: 30, price: 105, timestamp: 1001 },
          { id: 'a3', traderId: 'seller3', symbol: 'AAPL', type: 'sell', shares: 20, price: 110, timestamp: 1002 },
        ],
      };

      expect(getAvailableVolume(105, 'ask', book)).toBe(70); // 40 + 30
      expect(getAvailableVolume(110, 'ask', book)).toBe(90); // All
      expect(getAvailableVolume(95, 'ask', book)).toBe(0);
    });
  });

  describe('calculateMatchPrice - edge cases', () => {
    it('should use midpoint when timestamps are equal', () => {
      const bid: OrderBookEntry = {
        id: '1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 10, price: 105, timestamp: 1000,
      };
      const ask: OrderBookEntry = {
        id: '2', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 10, price: 100, timestamp: 1000, // Same timestamp
      };

      expect(calculateMatchPrice(bid, ask)).toBe(102.5); // Midpoint
    });
  });

  describe('matchOrder - additional cases', () => {
    const createOrderBook = (bids: OrderBookEntry[], asks: OrderBookEntry[]): OrderBook => ({
      symbol: 'AAPL',
      bids,
      asks,
    });

    it('should handle partial fill of incoming buy order', () => {
      const book = createOrderBook(
        [],
        [
          { id: 'a1', traderId: 'seller1', symbol: 'AAPL', type: 'sell', shares: 30, price: 100, timestamp: 1000 },
        ]
      );

      const buyOrder: OrderBookEntry = {
        id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 50, price: 110, timestamp: 2000,
      };

      const result = matchOrder(buyOrder, book);

      expect(result.executedTrades.length).toBe(1);
      expect(result.executedTrades[0].shares).toBe(30);
      expect(result.unfilledShares).toBe(20);
      expect(result.matchedOrderIds).toContain('a1');
    });

    it('should handle empty order book for buy order', () => {
      const book = createOrderBook([], []);

      const buyOrder: OrderBookEntry = {
        id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 50, price: 110, timestamp: 2000,
      };

      const result = matchOrder(buyOrder, book);

      expect(result.executedTrades.length).toBe(0);
      expect(result.unfilledShares).toBe(50);
    });

    it('should handle empty order book for sell order', () => {
      const book = createOrderBook([], []);

      const sellOrder: OrderBookEntry = {
        id: 's1', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 50, price: 90, timestamp: 2000,
      };

      const result = matchOrder(sellOrder, book);

      expect(result.executedTrades.length).toBe(0);
      expect(result.unfilledShares).toBe(50);
    });

    it('should stop matching when incoming shares are exhausted', () => {
      const book = createOrderBook(
        [],
        [
          { id: 'a1', traderId: 'seller1', symbol: 'AAPL', type: 'sell', shares: 30, price: 100, timestamp: 1000 },
          { id: 'a2', traderId: 'seller2', symbol: 'AAPL', type: 'sell', shares: 50, price: 100, timestamp: 1001 },
        ]
      );

      const buyOrder: OrderBookEntry = {
        id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 20, price: 110, timestamp: 2000,
      };

      const result = matchOrder(buyOrder, book);

      expect(result.executedTrades.length).toBe(1);
      expect(result.executedTrades[0].shares).toBe(20);
      expect(result.unfilledShares).toBe(0);
      expect(result.partialFills['a1']).toBe(10); // 30 - 20
    });
  });

  describe('canPotentiallyMatch - additional cases', () => {
    it('should return false for sell order when no matching bids', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [
          { id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy', shares: 10, price: 95, timestamp: 1000 },
        ],
        asks: [],
      };

      const sellOrder: OrderBookEntry = {
        id: 's1', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 10, price: 100, timestamp: 2000, // Wants more than best bid
      };

      expect(canPotentiallyMatch(sellOrder, book)).toBe(false);
    });

    it('should return true for sell order when bid price is acceptable', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [
          { id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy', shares: 10, price: 105, timestamp: 1000 },
        ],
        asks: [],
      };

      const sellOrder: OrderBookEntry = {
        id: 's1', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 10, price: 100, timestamp: 2000,
      };

      expect(canPotentiallyMatch(sellOrder, book)).toBe(true);
    });

    it('should return false for buy order with empty asks', () => {
      const book: OrderBook = { symbol: 'AAPL', bids: [], asks: [] };
      const buyOrder: OrderBookEntry = {
        id: 'b1', traderId: 'buyer', symbol: 'AAPL', type: 'buy',
        shares: 10, price: 100, timestamp: 2000,
      };

      expect(canPotentiallyMatch(buyOrder, book)).toBe(false);
    });

    it('should return false for sell order with empty bids', () => {
      const book: OrderBook = { symbol: 'AAPL', bids: [], asks: [] };
      const sellOrder: OrderBookEntry = {
        id: 's1', traderId: 'seller', symbol: 'AAPL', type: 'sell',
        shares: 10, price: 100, timestamp: 2000,
      };

      expect(canPotentiallyMatch(sellOrder, book)).toBe(false);
    });
  });

  describe('calculateVWAP - additional cases', () => {
    it('should calculate VWAP for sell orders', () => {
      const book: OrderBook = {
        symbol: 'AAPL',
        bids: [
          { id: 'b1', traderId: 'buyer1', symbol: 'AAPL', type: 'buy', shares: 50, price: 105, timestamp: 1000 },
          { id: 'b2', traderId: 'buyer2', symbol: 'AAPL', type: 'buy', shares: 50, price: 100, timestamp: 1001 },
        ],
        asks: [],
      };

      const result = calculateVWAP(80, 'sell', book);

      // 50 shares @ 105 + 30 shares @ 100 = 5250 + 3000 = 8250 / 80 = 103.125
      expect(result.vwap).toBe(103.125);
      expect(result.fillableShares).toBe(80);
    });

    it('should return 0 VWAP when no orders available', () => {
      const book: OrderBook = { symbol: 'AAPL', bids: [], asks: [] };
      const result = calculateVWAP(100, 'buy', book);

      expect(result.vwap).toBe(0);
      expect(result.fillableShares).toBe(0);
    });
  });
});
