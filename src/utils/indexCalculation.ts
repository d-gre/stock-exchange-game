import type { Stock, CandleData } from '../types';

/** Initial value of the index in points */
export const INDEX_BASE_POINTS = 10000;

export interface IndexData {
  name: string;
  symbol: string;
  /** Current index value in points */
  currentPrice: number;
  /** Change in points */
  change: number;
  /** Change in percent */
  changePercent: number;
  priceHistory: CandleData[];
}

/**
 * Calculates the market-cap-weighted index value for a candle.
 * Formula: Sum(Price x MarketCap) / Sum(MarketCap) = weighted average price
 */
const calculateWeightedPrice = (
  prices: number[],
  marketCaps: number[]
): number => {
  const totalMarketCap = marketCaps.reduce((sum, cap) => sum + cap, 0);
  if (totalMarketCap === 0) return 0;

  const weightedSum = prices.reduce((sum, price, i) => sum + price * marketCaps[i], 0);
  return weightedSum / totalMarketCap;
};

/**
 * Calculates the market-cap-weighted market index.
 *
 * The index uses:
 * - Market capitalization weighting (like DAX/S&P 500)
 * - Point-based representation (start: 10,000 points)
 *
 * Formula: Index = (current weighted price / base weighted price) x 10,000
 */
export const calculateMarketIndex = (stocks: Stock[]): IndexData => {
  if (stocks.length === 0) {
    return {
      name: 'D-GREX Prime',
      symbol: 'DGREX',
      currentPrice: 0,
      change: 0,
      changePercent: 0,
      priceHistory: [],
    };
  }

  const marketCaps = stocks.map(s => s.marketCapBillions);

  // Find the minimum number of candles across all stocks
  const minCandleCount = Math.min(...stocks.map(s => s.priceHistory.length));

  if (minCandleCount === 0) {
    return {
      name: 'D-GREX Prime',
      symbol: 'DGREX',
      currentPrice: INDEX_BASE_POINTS,
      change: 0,
      changePercent: 0,
      priceHistory: [],
    };
  }

  // Calculate the weighted base price (first candle as reference)
  const firstCandles = stocks.map(s => s.priceHistory[0]);
  const baseWeightedPrice = calculateWeightedPrice(
    firstCandles.map(c => c.close),
    marketCaps
  );

  // Calculate the index for each candle
  const indexHistory: CandleData[] = [];

  for (let i = 0; i < minCandleCount; i++) {
    const candles = stocks.map(s => s.priceHistory[i]);

    const weightedOpen = calculateWeightedPrice(candles.map(c => c.open), marketCaps);
    const weightedHigh = calculateWeightedPrice(candles.map(c => c.high), marketCaps);
    const weightedLow = calculateWeightedPrice(candles.map(c => c.low), marketCaps);
    const weightedClose = calculateWeightedPrice(candles.map(c => c.close), marketCaps);

    // Convert to index points relative to base price
    const toPoints = (price: number) =>
      parseFloat(((price / baseWeightedPrice) * INDEX_BASE_POINTS).toFixed(2));

    indexHistory.push({
      time: candles[0].time,
      open: toPoints(weightedOpen),
      high: toPoints(weightedHigh),
      low: toPoints(weightedLow),
      close: toPoints(weightedClose),
    });
  }

  const lastCandle = indexHistory[indexHistory.length - 1];
  const prevCandle = indexHistory[indexHistory.length - 2];

  const currentPrice = lastCandle?.close ?? INDEX_BASE_POINTS;
  const change = lastCandle && prevCandle ? lastCandle.close - prevCandle.close : 0;
  const changePercent = prevCandle ? (change / prevCandle.close) * 100 : 0;

  return {
    name: 'D-GRE 8',
    symbol: 'DGRE',
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    priceHistory: indexHistory,
  };
};
