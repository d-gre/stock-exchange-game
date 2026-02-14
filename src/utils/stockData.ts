import type { Stock, CandleData, Sector } from '../types';
import { CONFIG, FLOAT_CONFIG } from '../config';

/**
 * Initial stock definition with sector assignment.
 */
interface InitialStockDef {
  symbol: string;
  name: string;
  sector: Sector;
  basePrice: number;
  marketCapBillions: number;
  volatility: number;
}

/**
 * Initial stocks with base price, market capitalization, sector, and volatility.
 * - volatility: Typical fluctuation range (0.015 = stable, 0.04 = volatile)
 * - 16 stocks: 4 per sector (Tech, Finance, Industrial, Commodities)
 */
export const INITIAL_STOCKS: InitialStockDef[] = [
  // Technology (4) - all Large Cap
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'tech', basePrice: 175, marketCapBillions: 3700, volatility: 0.018 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'tech', basePrice: 380, marketCapBillions: 3100, volatility: 0.015 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'tech', basePrice: 480, marketCapBillions: 3300, volatility: 0.035 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'tech', basePrice: 140, marketCapBillions: 2100, volatility: 0.020 },
  // Finance (4) - 2 Large Cap, 2 Small/Mid Cap
  { symbol: 'V', name: 'Visa Inc.', sector: 'finance', basePrice: 280, marketCapBillions: 600, volatility: 0.015 },
  { symbol: 'BAC', name: 'Bank of America', sector: 'finance', basePrice: 35, marketCapBillions: 180, volatility: 0.020 },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'finance', basePrice: 200, marketCapBillions: 700, volatility: 0.018 },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'finance', basePrice: 400, marketCapBillions: 185, volatility: 0.022 },
  // Industrial (4) - 1 Large Cap, 3 Small/Mid Cap
  { symbol: 'BAY', name: 'Bayer AG', sector: 'industrial', basePrice: 20, marketCapBillions: 25, volatility: 0.030 },
  { symbol: 'EADSY', name: 'Airbus SE', sector: 'industrial', basePrice: 160, marketCapBillions: 135, volatility: 0.028 },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'industrial', basePrice: 250, marketCapBillions: 1300, volatility: 0.040 },
  { symbol: 'HON', name: 'Honeywell Intl.', sector: 'industrial', basePrice: 200, marketCapBillions: 145, volatility: 0.016 },
  // Commodities (4) - 1 Large Cap, 3 Small/Mid Cap
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'commodities', basePrice: 110, marketCapBillions: 475, volatility: 0.022 },
  { symbol: 'BHP', name: 'BHP Group', sector: 'commodities', basePrice: 60, marketCapBillions: 130, volatility: 0.025 },
  { symbol: 'RIO', name: 'Rio Tinto', sector: 'commodities', basePrice: 65, marketCapBillions: 100, volatility: 0.024 },
  { symbol: 'NEM', name: 'Newmont Corp.', sector: 'commodities', basePrice: 45, marketCapBillions: 50, volatility: 0.030 },
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

/**
 * Randomly selects stocks from each sector.
 * @param stocksPerSector - Number of stocks to select per sector (default from config)
 * @returns Array of selected stock definitions
 */
const selectRandomStocksPerSector = (stocksPerSector: number = CONFIG.stocksPerSector): InitialStockDef[] => {
  const sectors: Sector[] = ['tech', 'finance', 'industrial', 'commodities'];
  const selectedStocks: InitialStockDef[] = [];

  for (const sector of sectors) {
    // Get all stocks for this sector
    const sectorStocks = INITIAL_STOCKS.filter(s => s.sector === sector);

    // Shuffle using Fisher-Yates algorithm
    const shuffled = [...sectorStocks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Take the first n stocks (up to available)
    const count = Math.min(stocksPerSector, shuffled.length);
    selectedStocks.push(...shuffled.slice(0, count));
  }

  return selectedStocks;
};

/**
 * Initializes stocks with random selection per sector.
 * @param stocksPerSector - Optional override for stocks per sector (uses config default)
 */
/**
 * Calculates the float shares for a stock.
 * Float = (marketCap / price) * floatPercentage / scaleFactor
 */
export const calculateFloatShares = (
  marketCapBillions: number,
  currentPrice: number
): number => {
  const totalShares = (marketCapBillions * 1e9) / currentPrice;
  const floatShares = totalShares * FLOAT_CONFIG.floatPercentage;
  return Math.floor(floatShares / FLOAT_CONFIG.scaleFactor);
};

export const initializeStocks = (stocksPerSector?: number): Stock[] => {
  const selectedStockDefs = selectRandomStocksPerSector(stocksPerSector);

  return selectedStockDefs.map(({ symbol, name, sector, basePrice, marketCapBillions, volatility }) => {
    const history = generateInitialHistory(basePrice, volatility);
    const lastCandle = history[history.length - 1];
    const prevCandle = history[history.length - 2];
    const change = lastCandle.close - prevCandle.close;
    const changePercent = (change / prevCandle.close) * 100;

    // Calculate float shares based on market cap and current price
    const floatShares = calculateFloatShares(marketCapBillions, lastCandle.close);

    // Fair value starts at current price (fundamentalists will use this)
    const fairValue = lastCandle.close;

    return {
      symbol,
      name,
      sector,
      currentPrice: lastCandle.close,
      priceHistory: history,
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      marketCapBillions,
      floatShares,
      fairValue,
    };
  });
};

export const applyTradeImpact = (stock: Stock, type: 'buy' | 'sell', shares: number): Stock => {
  // Simulate market impact: Buys push the price up, sells push it down
  const impactFactor = type === 'buy' ? 1 : -1;

  // Reduced impact: 0.01% - 0.05% per share (was 0.1% - 0.5%)
  const baseImpact = 0.0001 + Math.random() * 0.0004;
  // Reduced volume multiplier cap (was 50)
  const volumeMultiplier = Math.min(shares, 20);
  const rawPriceChange = stock.currentPrice * baseImpact * volumeMultiplier * impactFactor;

  // Circuit breaker: max ±2% price change per trade
  const maxChange = stock.currentPrice * 0.02;
  const priceChange = Math.max(-maxChange, Math.min(maxChange, rawPriceChange));

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

/**
 * Generates a new candle for a stock with optional sector influence.
 * @param stock - The stock to generate a new candle for
 * @param sectorInfluence - Optional sector influence (-0.03 to +0.03, default 0)
 * @param volatilityMultiplier - Market phase volatility multiplier (default 1.0)
 */
export const generateNewCandle = (
  stock: Stock,
  sectorInfluence: number = 0,
  volatilityMultiplier: number = 1.0
): Stock => {
  const lastCandle = stock.priceHistory[stock.priceHistory.length - 1];
  const baseVolatility = stock.currentPrice * 0.025;
  const volatility = baseVolatility * volatilityMultiplier;

  // Base trend with sector influence (0.50 = neutral, no up/down bias)
  const baseTrend = (Math.random() - 0.50) * volatility;
  const sectorBias = sectorInfluence * stock.currentPrice;
  const trend = baseTrend + sectorBias;

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
