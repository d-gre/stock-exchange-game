import type { OrderBook, OrderBookEntry, OrderMatchResult, ExecutedMatchTrade } from '../types';

/**
 * Checks if a bid and ask can be matched.
 * For limit orders: bid price >= ask price
 */
export const canMatch = (bid: OrderBookEntry, ask: OrderBookEntry): boolean => {
  return bid.price >= ask.price;
};

/**
 * Calculates the execution price for a matched trade.
 * Uses price-time priority: the resting order's price is used.
 * (The order that was in the book first sets the price)
 */
export const calculateMatchPrice = (
  bid: OrderBookEntry,
  ask: OrderBookEntry
): number => {
  // The order that was placed first (lower timestamp) is the "maker"
  // The maker's price is used for execution
  if (bid.timestamp < ask.timestamp) {
    return bid.price;
  } else if (ask.timestamp < bid.timestamp) {
    return ask.price;
  } else {
    // Same timestamp (unlikely): use midpoint
    return (bid.price + ask.price) / 2;
  }
};

/**
 * Generates a unique trade ID.
 */
const generateTradeId = (): string =>
  `match-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

/**
 * Attempts to match an incoming order against the order book.
 *
 * This implements price-time priority matching:
 * 1. Best price first (highest bid, lowest ask)
 * 2. Earliest timestamp first (FIFO within same price)
 *
 * @param incomingOrder - The order to match
 * @param book - The current order book
 * @returns Match result with executed trades and unfilled shares
 */
export const matchOrder = (
  incomingOrder: OrderBookEntry,
  book: OrderBook
): OrderMatchResult => {
  const matchedOrderIds: string[] = [];
  const partialFills: Record<string, number> = {};
  const executedTrades: ExecutedMatchTrade[] = [];
  let remainingShares = incomingOrder.shares;

  // Get the opposite side of the book
  const oppositeSide = incomingOrder.type === 'buy' ? [...book.asks] : [...book.bids];

  for (const restingOrder of oppositeSide) {
    if (remainingShares <= 0) break;

    // Skip orders from the same trader (can't trade with yourself)
    if (restingOrder.traderId === incomingOrder.traderId) continue;

    // Check if orders can match
    if (incomingOrder.type === 'buy') {
      // Buy order: incoming price must be >= ask price
      if (incomingOrder.price < restingOrder.price) {
        break; // No more matches possible (asks are sorted ascending)
      }
    } else {
      // Sell order: incoming price must be <= bid price
      if (incomingOrder.price > restingOrder.price) {
        break; // No more matches possible (bids are sorted descending)
      }
    }

    // Calculate trade size
    const tradeShares = Math.min(remainingShares, restingOrder.shares);

    // Calculate execution price (maker's price)
    const executionPrice = restingOrder.price;

    // Create executed trade
    const trade: ExecutedMatchTrade = {
      id: generateTradeId(),
      symbol: incomingOrder.symbol,
      buyerId: incomingOrder.type === 'buy' ? incomingOrder.traderId : restingOrder.traderId,
      sellerId: incomingOrder.type === 'sell' ? incomingOrder.traderId : restingOrder.traderId,
      shares: tradeShares,
      price: executionPrice,
      timestamp: Date.now(),
    };
    executedTrades.push(trade);

    // Update remaining shares
    remainingShares -= tradeShares;
    const restingRemainingShares = restingOrder.shares - tradeShares;

    if (restingRemainingShares === 0) {
      // Fully filled
      matchedOrderIds.push(restingOrder.id);
    } else {
      // Partially filled
      partialFills[restingOrder.id] = restingRemainingShares;
    }
  }

  return {
    matchedOrderIds,
    partialFills,
    executedTrades,
    unfilledShares: remainingShares,
  };
};

/**
 * Checks if an order can potentially match with the order book.
 * Quick check before attempting full matching.
 */
export const canPotentiallyMatch = (
  order: OrderBookEntry,
  book: OrderBook
): boolean => {
  if (order.type === 'buy') {
    // Buy order can match if there's an ask at or below the bid price
    const bestAsk = book.asks[0];
    return bestAsk !== undefined && order.price >= bestAsk.price;
  } else {
    // Sell order can match if there's a bid at or above the ask price
    const bestBid = book.bids[0];
    return bestBid !== undefined && order.price <= bestBid.price;
  }
};

/**
 * Gets the best executable price from the order book.
 * For buying: best ask price
 * For selling: best bid price
 */
export const getBestPrice = (
  type: 'buy' | 'sell',
  book: OrderBook
): number | null => {
  if (type === 'buy') {
    return book.asks[0]?.price ?? null;
  } else {
    return book.bids[0]?.price ?? null;
  }
};

/**
 * Gets available volume at a price level.
 */
export const getVolumeAtPrice = (
  price: number,
  side: 'bid' | 'ask',
  book: OrderBook
): number => {
  const orders = side === 'bid' ? book.bids : book.asks;
  return orders
    .filter(o => o.price === price)
    .reduce((sum, o) => sum + o.shares, 0);
};

/**
 * Gets total available volume at or better than a price.
 * For bids: at or above the price
 * For asks: at or below the price
 */
export const getAvailableVolume = (
  price: number,
  side: 'bid' | 'ask',
  book: OrderBook
): number => {
  const orders = side === 'bid' ? book.bids : book.asks;

  if (side === 'bid') {
    // Bids at or above the price
    return orders
      .filter(o => o.price >= price)
      .reduce((sum, o) => sum + o.shares, 0);
  } else {
    // Asks at or below the price
    return orders
      .filter(o => o.price <= price)
      .reduce((sum, o) => sum + o.shares, 0);
  }
};

/**
 * Calculates the VWAP (Volume Weighted Average Price) for a potential trade.
 * Useful for estimating execution price for large orders.
 */
export const calculateVWAP = (
  shares: number,
  type: 'buy' | 'sell',
  book: OrderBook
): { vwap: number; fillableShares: number } => {
  const orders = type === 'buy' ? book.asks : book.bids;

  let totalValue = 0;
  let totalShares = 0;
  let remainingShares = shares;

  for (const order of orders) {
    if (remainingShares <= 0) break;

    const fillShares = Math.min(remainingShares, order.shares);
    totalValue += fillShares * order.price;
    totalShares += fillShares;
    remainingShares -= fillShares;
  }

  return {
    vwap: totalShares > 0 ? totalValue / totalShares : 0,
    fillableShares: totalShares,
  };
};

/**
 * Creates an order book entry from parameters.
 */
export const createOrderBookEntry = (
  traderId: string,
  symbol: string,
  type: 'buy' | 'sell',
  shares: number,
  price: number,
  originalOrderId?: string,
  remainingCycles?: number
): OrderBookEntry => ({
  id: `ob-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  traderId,
  symbol,
  type,
  shares,
  price,
  timestamp: Date.now(),
  originalOrderId,
  remainingCycles,
});
