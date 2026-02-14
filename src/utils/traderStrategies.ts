import type {
  Stock,
  VirtualPlayer,
  TraderType,
  TraderStrategyParams,
  OrderBookEntry,
  OrderBook,
  BuyDecisionFactors,
  SellDecisionFactors,
} from '../types';
import { TRADER_TYPE_CONFIG, ORDER_BOOK_CONFIG } from '../config';
import { calculateVolatility, calculateTrend } from './virtualPlayers';

// ============================================================================
// TRADER DECISION TYPES
// ============================================================================

export interface TradeDecision {
  playerId: string;
  symbol: string;
  type: 'buy' | 'sell';
  shares: number;
  /** For limit orders */
  limitPrice?: number;
  /** Factors that led to the decision */
  decisionFactors: BuyDecisionFactors | SellDecisionFactors;
}

export interface OrderBookDecision {
  playerId: string;
  entries: OrderBookEntry[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates RSI (Relative Strength Index) for a stock.
 * RSI < 30 = oversold (buy signal for contrarians)
 * RSI > 70 = overbought (sell signal for contrarians)
 */
export const calculateRSI = (priceHistory: Stock['priceHistory'], period: number = 14): number => {
  if (priceHistory.length < period + 1) return 50; // Neutral if not enough data

  const changes: number[] = [];
  for (let i = priceHistory.length - period; i < priceHistory.length; i++) {
    const change = priceHistory[i].close - priceHistory[i - 1].close;
    changes.push(change);
  }

  const gains = changes.filter(c => c > 0);
  const losses = changes.filter(c => c < 0).map(c => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

/**
 * Gets the default strategy parameters for a trader type.
 */
export const getDefaultParams = (traderType: TraderType): TraderStrategyParams => {
  const defaults = TRADER_TYPE_CONFIG.defaultParams;

  switch (traderType) {
    case 'marketMaker':
      return defaults.marketMaker;
    case 'momentum':
      return defaults.momentum;
    case 'contrarian':
      return defaults.contrarian;
    case 'fundamentalist':
      return defaults.fundamentalist;
    case 'noise':
      return defaults.noise;
    default:
      return {};
  }
};

/**
 * Calculates position size based on available cash and risk.
 */
const calculatePositionSize = (
  availableCash: number,
  price: number,
  riskFactor: number // 0 to 1, higher = more shares
): number => {
  const maxShares = Math.floor(availableCash / price);
  const targetShares = Math.floor(maxShares * riskFactor);
  return Math.max(1, targetShares);
};

// ============================================================================
// MARKET MAKER STRATEGY
// ============================================================================

/**
 * Market Maker VP creates orders on both sides of the book.
 * Goal: Profit from the bid-ask spread while maintaining inventory.
 */
export const makeMarketMakerDecision = (
  player: VirtualPlayer,
  stocks: Stock[],
  _orderBooks: Record<string, OrderBook>,
  existingOrderCounts: Record<string, number>
): OrderBookDecision | null => {
  const params = player.settings.strategyParams ?? getDefaultParams('marketMaker');
  const targetSpread = params.targetSpread ?? 0.02;
  const entries: OrderBookEntry[] = [];

  for (const stock of stocks) {
    // Check if we already have max orders for this stock
    const existingOrders = existingOrderCounts[stock.symbol] ?? 0;
    if (existingOrders >= ORDER_BOOK_CONFIG.maxOrdersPerVP) continue;

    // 30% chance to place orders for each stock
    if (Math.random() > 0.30) continue;

    const midPrice = stock.currentPrice;
    const halfSpread = targetSpread / 2;
    const bidPrice = parseFloat((midPrice * (1 - halfSpread)).toFixed(2));
    const askPrice = parseFloat((midPrice * (1 + halfSpread)).toFixed(2));

    // Check inventory to decide which side to quote
    const holding = player.portfolio.holdings.find(h => h.symbol === stock.symbol);
    const hasShares = holding && holding.shares > 0;
    const hasCash = player.portfolio.cash >= bidPrice;

    // Place bid if we have cash
    if (hasCash && existingOrders < ORDER_BOOK_CONFIG.maxOrdersPerVP) {
      const bidShares = calculatePositionSize(
        player.portfolio.cash * 0.2, // Use 20% of cash per order
        bidPrice,
        0.5
      );

      if (bidShares > 0) {
        entries.push({
          id: `mm-bid-${player.id}-${stock.symbol}-${Date.now()}`,
          traderId: player.id,
          symbol: stock.symbol,
          type: 'buy',
          shares: bidShares,
          price: bidPrice,
          timestamp: Date.now(),
          remainingCycles: ORDER_BOOK_CONFIG.vpOrderLifetime,
        });
      }
    }

    // Place ask if we have shares
    if (hasShares && holding && existingOrders + entries.length < ORDER_BOOK_CONFIG.maxOrdersPerVP) {
      const askShares = Math.min(
        Math.ceil(holding.shares * 0.3), // Offer 30% of holdings
        holding.shares
      );

      if (askShares > 0) {
        entries.push({
          id: `mm-ask-${player.id}-${stock.symbol}-${Date.now()}`,
          traderId: player.id,
          symbol: stock.symbol,
          type: 'sell',
          shares: askShares,
          price: askPrice,
          timestamp: Date.now(),
          remainingCycles: ORDER_BOOK_CONFIG.vpOrderLifetime,
        });
      }
    }
  }

  return entries.length > 0 ? { playerId: player.id, entries } : null;
};

// ============================================================================
// MOMENTUM STRATEGY
// ============================================================================

/**
 * Momentum traders follow trends.
 * Buy when price is rising, sell when price is falling.
 */
export const makeMomentumDecision = (
  player: VirtualPlayer,
  stocks: Stock[]
): TradeDecision | null => {
  const params = player.settings.strategyParams ?? getDefaultParams('momentum');
  const trendThreshold = params.trendThreshold ?? 0.02;

  // 50% chance to trade
  if (Math.random() > 0.50) return null;

  // Find stocks with strong trends
  const trendingStocks = stocks
    .map(stock => ({
      stock,
      trend: calculateTrend(stock.priceHistory),
      volatility: calculateVolatility(stock.priceHistory),
    }))
    .filter(s => Math.abs(s.trend) >= trendThreshold);

  if (trendingStocks.length === 0) return null;

  // Sort by trend strength
  trendingStocks.sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));

  const best = trendingStocks[0];

  if (best.trend > 0) {
    // Uptrend: Buy
    if (player.portfolio.cash < best.stock.currentPrice) return null;

    const shares = calculatePositionSize(
      player.portfolio.cash * 0.4,
      best.stock.currentPrice,
      0.6
    );

    return {
      playerId: player.id,
      symbol: best.stock.symbol,
      type: 'buy',
      shares,
      decisionFactors: {
        kind: 'buy',
        volatility: best.volatility,
        trend: best.trend,
        score: best.trend * 100,
        riskTolerance: player.settings.riskTolerance,
      },
    };
  } else {
    // Downtrend: Sell
    const holding = player.portfolio.holdings.find(h => h.symbol === best.stock.symbol);
    if (!holding || holding.shares === 0) return null;

    const shares = Math.ceil(holding.shares * 0.5);

    return {
      playerId: player.id,
      symbol: best.stock.symbol,
      type: 'sell',
      shares,
      decisionFactors: {
        kind: 'sell',
        profitPercent: (best.stock.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice,
        trend: best.trend,
        score: Math.abs(best.trend) * 100,
        riskTolerance: player.settings.riskTolerance,
        avgBuyPrice: holding.avgBuyPrice,
      },
    };
  }
};

// ============================================================================
// CONTRARIAN STRATEGY
// ============================================================================

/**
 * Contrarian traders trade against the trend.
 * Buy oversold stocks, sell overbought stocks.
 */
export const makeContrarianDecision = (
  player: VirtualPlayer,
  stocks: Stock[]
): TradeDecision | null => {
  const params = player.settings.strategyParams ?? getDefaultParams('contrarian');
  const oversoldThreshold = params.oversoldThreshold ?? 30;
  const overboughtThreshold = params.overboughtThreshold ?? 70;

  // 40% chance to trade
  if (Math.random() > 0.40) return null;

  // Calculate RSI for all stocks
  const stocksWithRSI = stocks.map(stock => ({
    stock,
    rsi: calculateRSI(stock.priceHistory),
    volatility: calculateVolatility(stock.priceHistory),
    trend: calculateTrend(stock.priceHistory),
  }));

  // Find oversold stocks (buy opportunity)
  const oversold = stocksWithRSI.filter(s => s.rsi < oversoldThreshold);

  // Find overbought stocks we own (sell opportunity)
  const overbought = stocksWithRSI.filter(s => {
    if (s.rsi <= overboughtThreshold) return false;
    const holding = player.portfolio.holdings.find(h => h.symbol === s.stock.symbol);
    return holding && holding.shares > 0;
  });

  // Prefer selling overbought if we have positions, otherwise buy oversold
  if (overbought.length > 0 && Math.random() > 0.4) {
    const target = overbought[Math.floor(Math.random() * overbought.length)];
    const holding = player.portfolio.holdings.find(h => h.symbol === target.stock.symbol)!;
    const shares = Math.ceil(holding.shares * 0.4);

    return {
      playerId: player.id,
      symbol: target.stock.symbol,
      type: 'sell',
      shares,
      decisionFactors: {
        kind: 'sell',
        profitPercent: (target.stock.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice,
        trend: target.trend,
        score: target.rsi,
        riskTolerance: player.settings.riskTolerance,
        avgBuyPrice: holding.avgBuyPrice,
      },
    };
  }

  if (oversold.length > 0) {
    const target = oversold[Math.floor(Math.random() * oversold.length)];
    if (player.portfolio.cash < target.stock.currentPrice) return null;

    const shares = calculatePositionSize(
      player.portfolio.cash * 0.3,
      target.stock.currentPrice,
      0.5
    );

    return {
      playerId: player.id,
      symbol: target.stock.symbol,
      type: 'buy',
      shares,
      decisionFactors: {
        kind: 'buy',
        volatility: target.volatility,
        trend: target.trend,
        score: 100 - target.rsi,
        riskTolerance: player.settings.riskTolerance,
      },
    };
  }

  return null;
};

// ============================================================================
// FUNDAMENTALIST STRATEGY
// ============================================================================

/**
 * Fundamentalist traders trade based on fair value.
 * Buy undervalued stocks, sell overvalued stocks.
 */
export const makeFundamentalistDecision = (
  player: VirtualPlayer,
  stocks: Stock[]
): TradeDecision | null => {
  const params = player.settings.strategyParams ?? getDefaultParams('fundamentalist');
  const tolerance = params.valuationTolerance ?? 0.10;

  // 35% chance to trade
  if (Math.random() > 0.35) return null;

  // Analyze stocks with fair value
  const analyzed = stocks
    .filter(s => s.fairValue !== undefined)
    .map(stock => ({
      stock,
      deviation: (stock.currentPrice - stock.fairValue!) / stock.fairValue!,
      volatility: calculateVolatility(stock.priceHistory),
      trend: calculateTrend(stock.priceHistory),
    }));

  // Find undervalued stocks (buy)
  const undervalued = analyzed.filter(s => s.deviation < -tolerance);

  // Find overvalued stocks we own (sell)
  const overvalued = analyzed.filter(s => {
    if (s.deviation <= tolerance) return false;
    const holding = player.portfolio.holdings.find(h => h.symbol === s.stock.symbol);
    return holding && holding.shares > 0;
  });

  // Sell overvalued first
  if (overvalued.length > 0 && Math.random() > 0.5) {
    // Sort by most overvalued
    overvalued.sort((a, b) => b.deviation - a.deviation);
    const target = overvalued[0];
    const holding = player.portfolio.holdings.find(h => h.symbol === target.stock.symbol)!;
    const shares = Math.ceil(holding.shares * 0.5);

    return {
      playerId: player.id,
      symbol: target.stock.symbol,
      type: 'sell',
      shares,
      decisionFactors: {
        kind: 'sell',
        profitPercent: (target.stock.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice,
        trend: target.trend,
        score: target.deviation * 100,
        riskTolerance: player.settings.riskTolerance,
        avgBuyPrice: holding.avgBuyPrice,
      },
    };
  }

  // Buy undervalued
  if (undervalued.length > 0) {
    // Sort by most undervalued
    undervalued.sort((a, b) => a.deviation - b.deviation);
    const target = undervalued[0];

    if (player.portfolio.cash < target.stock.currentPrice) return null;

    const shares = calculatePositionSize(
      player.portfolio.cash * 0.35,
      target.stock.currentPrice,
      0.6
    );

    return {
      playerId: player.id,
      symbol: target.stock.symbol,
      type: 'buy',
      shares,
      decisionFactors: {
        kind: 'buy',
        volatility: target.volatility,
        trend: target.trend,
        score: Math.abs(target.deviation) * 100,
        riskTolerance: player.settings.riskTolerance,
      },
    };
  }

  return null;
};

// ============================================================================
// NOISE TRADER STRATEGY
// ============================================================================

/**
 * Noise traders make random trades.
 * Adds liquidity and unpredictability to the market.
 */
export const makeNoiseTraderDecision = (
  player: VirtualPlayer,
  stocks: Stock[]
): TradeDecision | null => {
  const params = player.settings.strategyParams ?? getDefaultParams('noise');
  const tradeFrequency = params.tradeFrequency ?? 0.30;

  // Random chance to trade
  if (Math.random() > tradeFrequency) return null;

  // Random buy or sell
  const shouldBuy = Math.random() > 0.5;

  if (shouldBuy) {
    // Random stock we can afford
    const affordableStocks = stocks.filter(s => s.currentPrice <= player.portfolio.cash);
    if (affordableStocks.length === 0) return null;

    const stock = affordableStocks[Math.floor(Math.random() * affordableStocks.length)];
    const maxShares = Math.floor(player.portfolio.cash / stock.currentPrice);
    const shares = Math.max(1, Math.floor(maxShares * (0.1 + Math.random() * 0.2)));

    return {
      playerId: player.id,
      symbol: stock.symbol,
      type: 'buy',
      shares,
      decisionFactors: {
        kind: 'buy',
        volatility: calculateVolatility(stock.priceHistory),
        trend: calculateTrend(stock.priceHistory),
        score: Math.random() * 100,
        riskTolerance: player.settings.riskTolerance,
      },
    };
  } else {
    // Random holding to sell
    const holdings = player.portfolio.holdings.filter(h => h.shares > 0);
    if (holdings.length === 0) return null;

    const holding = holdings[Math.floor(Math.random() * holdings.length)];
    const stock = stocks.find(s => s.symbol === holding.symbol);
    if (!stock) return null;

    const shares = Math.max(1, Math.floor(holding.shares * (0.1 + Math.random() * 0.3)));

    return {
      playerId: player.id,
      symbol: stock.symbol,
      type: 'sell',
      shares: Math.min(shares, holding.shares),
      decisionFactors: {
        kind: 'sell',
        profitPercent: (stock.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice,
        trend: calculateTrend(stock.priceHistory),
        score: Math.random() * 100,
        riskTolerance: player.settings.riskTolerance,
        avgBuyPrice: holding.avgBuyPrice,
      },
    };
  }
};

// ============================================================================
// STRATEGY ROUTER
// ============================================================================

/**
 * Routes a VP to their appropriate strategy based on trader type.
 * Returns either a direct trade decision or order book entries.
 */
export const makeStrategyDecision = (
  player: VirtualPlayer,
  stocks: Stock[],
  orderBooks: Record<string, OrderBook>,
  existingOrderCounts: Record<string, number>
): { trade?: TradeDecision; orderBookEntries?: OrderBookEntry[] } => {
  // Default to 'balanced' if traderType is not set
  const traderType = player.settings.traderType ?? 'balanced';

  switch (traderType) {
    case 'marketMaker': {
      const decision = makeMarketMakerDecision(player, stocks, orderBooks, existingOrderCounts);
      return { orderBookEntries: decision?.entries };
    }

    case 'momentum': {
      const trade = makeMomentumDecision(player, stocks);
      return { trade: trade ?? undefined };
    }

    case 'contrarian': {
      const trade = makeContrarianDecision(player, stocks);
      return { trade: trade ?? undefined };
    }

    case 'fundamentalist': {
      const trade = makeFundamentalistDecision(player, stocks);
      return { trade: trade ?? undefined };
    }

    case 'noise': {
      const trade = makeNoiseTraderDecision(player, stocks);
      return { trade: trade ?? undefined };
    }

    case 'balanced':
    default:
      // Balanced traders use the existing makeTradeDecision logic
      // This will be called from virtualPlayers.ts
      return {};
  }
};

/**
 * Assigns a trader type to a VP based on the configured distribution.
 */
export const assignTraderType = (index: number, totalPlayers: number): TraderType => {
  const distribution = TRADER_TYPE_CONFIG.distribution;
  const types: TraderType[] = ['marketMaker', 'momentum', 'contrarian', 'fundamentalist', 'noise', 'balanced'];

  // Calculate cumulative distribution
  let cumulative = 0;
  const thresholds: { type: TraderType; threshold: number }[] = [];

  for (const type of types) {
    cumulative += distribution[type];
    thresholds.push({ type, threshold: cumulative });
  }

  // Determine type based on player index position in distribution
  const position = index / totalPlayers;

  for (const { type, threshold } of thresholds) {
    if (position < threshold) {
      return type;
    }
  }

  return 'balanced'; // Fallback
};
