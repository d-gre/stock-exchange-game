import type { Stock, CandleData } from '../types';

/**
 * Initial stocks with base price, market capitalization, and volatility.
 * - volatility: Typical fluctuation range (0.015 = stable, 0.04 = volatile)
 */
export const INITIAL_STOCKS = [
  // Technology
  { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 175, marketCapBillions: 3000, volatility: 0.018 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 140, marketCapBillions: 2000, volatility: 0.020 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', basePrice: 380, marketCapBillions: 3000, volatility: 0.015 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', basePrice: 185, marketCapBillions: 1900, volatility: 0.022 },
  { symbol: 'TSLA', name: 'Tesla Inc.', basePrice: 250, marketCapBillions: 800, volatility: 0.040 },
  { symbol: 'META', name: 'Meta Platforms', basePrice: 500, marketCapBillions: 1400, volatility: 0.025 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', basePrice: 480, marketCapBillions: 3000, volatility: 0.035 },
  // Finance
  { symbol: 'JPM', name: 'JPMorgan Chase', basePrice: 200, marketCapBillions: 600, volatility: 0.018 },
  { symbol: 'BAC', name: 'Bank of America', basePrice: 35, marketCapBillions: 280, volatility: 0.020 },
  { symbol: 'V', name: 'Visa Inc.', basePrice: 280, marketCapBillions: 580, volatility: 0.015 },
  { symbol: 'GS', name: 'Goldman Sachs', basePrice: 400, marketCapBillions: 130, volatility: 0.022 },
  // Industrial
  { symbol: 'CAT', name: 'Caterpillar Inc.', basePrice: 300, marketCapBillions: 150, volatility: 0.020 },
  { symbol: 'BA', name: 'Boeing Co.', basePrice: 250, marketCapBillions: 150, volatility: 0.032 },
  { symbol: 'HON', name: 'Honeywell Intl.', basePrice: 200, marketCapBillions: 130, volatility: 0.016 },
];

/**
 * Generates realistic price history with trends, momentum, and volatility.
 * @param basePrice - Starting price of the stock
 * @param volatility - Stock-specific volatility (e.g., 0.02 = 2%)
 * @param candleCount - Number of candles (default: 50)
 */
const generateInitialHistory = (
  basePrice: number,
  volatility: number = 0.02,
  candleCount: number = 50
): CandleData[] => {
  const history: CandleData[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Start at a slightly deviated price for more variation
  let currentPrice = basePrice * (0.92 + Math.random() * 0.16); // 92% - 108% of base price
  let momentum = 0; // Momentum for trend continuation
  let trendPhase = Math.random() * Math.PI * 2; // Starting phase for trend cycles

  for (let i = candleCount; i > 0; i--) {
    const time = now - (i * 30);

    // Trend component: sinusoidal cycles + random phase changes
    trendPhase += 0.1 + Math.random() * 0.1;
    const trendBias = Math.sin(trendPhase) * volatility * 0.5;

    // Momentum: Trends partially continue (mean reversion)
    momentum = momentum * 0.7 + (Math.random() - 0.5) * 0.3;

    // Combined price change
    const randomComponent = (Math.random() - 0.5) * volatility * currentPrice;
    const trendComponent = trendBias * currentPrice;
    const momentumComponent = momentum * volatility * currentPrice;
    const change = randomComponent + trendComponent + momentumComponent;

    const open = currentPrice;
    const close = Math.max(basePrice * 0.5, currentPrice + change); // At least 50% of base price

    // Realistic wicks: larger with higher volatility
    const wickSize = volatility * currentPrice * (0.3 + Math.random() * 0.7);
    const high = Math.max(open, close) + Math.random() * wickSize;
    const low = Math.max(basePrice * 0.4, Math.min(open, close) - Math.random() * wickSize);

    history.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });

    currentPrice = close;
  }

  return history;
};

export const initializeStocks = (): Stock[] => {
  return INITIAL_STOCKS.map(({ symbol, name, basePrice, marketCapBillions, volatility }) => {
    const history = generateInitialHistory(basePrice, volatility);
    const lastCandle = history[history.length - 1];
    const prevCandle = history[history.length - 2];
    const change = lastCandle.close - prevCandle.close;
    const changePercent = (change / prevCandle.close) * 100;

    return {
      symbol,
      name,
      currentPrice: lastCandle.close,
      priceHistory: history,
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      marketCapBillions,
    };
  });
};

export const applyTradeImpact = (stock: Stock, type: 'buy' | 'sell', shares: number): Stock => {
  // Simulate market impact: Buys push the price up, sells push it down
  const impactFactor = type === 'buy' ? 1 : -1;

  // Larger orders have more impact (0.1% - 0.5% per share, with upper limit)
  const baseImpact = 0.001 + Math.random() * 0.004;
  const volumeMultiplier = Math.min(shares, 50); // Maximum 50 shares for the effect
  const priceChange = stock.currentPrice * baseImpact * volumeMultiplier * impactFactor;

  const newPrice = Math.max(0.5, stock.currentPrice + priceChange);
  const lastCandle = stock.priceHistory[stock.priceHistory.length - 1];

  // Update the last candle with the new price
  const updatedCandle = {
    ...lastCandle,
    close: parseFloat(newPrice.toFixed(2)),
    high: parseFloat(Math.max(lastCandle.high, newPrice).toFixed(2)),
    low: parseFloat(Math.min(lastCandle.low, newPrice).toFixed(2)),
  };

  const newHistory = [...stock.priceHistory.slice(0, -1), updatedCandle];
  const change = updatedCandle.close - updatedCandle.open;
  const changePercent = (change / updatedCandle.open) * 100;

  return {
    ...stock,
    currentPrice: parseFloat(newPrice.toFixed(2)),
    priceHistory: newHistory,
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
  };
};

export const generateNewCandle = (stock: Stock): Stock => {
  const lastCandle = stock.priceHistory[stock.priceHistory.length - 1];
  const volatility = stock.currentPrice * 0.025;
  const trend = (Math.random() - 0.48) * volatility;

  const open = lastCandle.close;
  const close = Math.max(1, open + trend);
  const high = Math.max(open, close) + Math.random() * volatility * 0.3;
  const low = Math.max(0.5, Math.min(open, close) - Math.random() * volatility * 0.3);

  // Timestamp must be strictly ascending (at least 1 second after last candle)
  const now = Math.floor(Date.now() / 1000);
  const newTime = Math.max(now, (lastCandle.time as number) + 1);

  const newCandle: CandleData = {
    time: newTime,
    open: parseFloat(open.toFixed(2)),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    close: parseFloat(close.toFixed(2)),
  };

  const newHistory = [...stock.priceHistory.slice(-99), newCandle];
  const change = close - open;
  const changePercent = (change / open) * 100;

  return {
    ...stock,
    currentPrice: parseFloat(close.toFixed(2)),
    priceHistory: newHistory,
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
  };
};
