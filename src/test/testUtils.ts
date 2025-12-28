import type { Stock, CandleData, Portfolio, PendingOrder, CompletedTrade } from '../types';

/**
 * Gemeinsame Test-Utilities für Mock-Daten
 *
 * Hinweis: vi.mock() kann keine externen Variablen nutzen (wird gehoisted),
 * daher müssen Mocks für lightweight-charts und ResizeObserver inline
 * in jeder Testdatei definiert werden.
 */

// Mock-Daten Factories
export const createMockPriceHistory = (count = 5): CandleData[] => {
  const candles: CandleData[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const open = price;
    const change = (Math.random() - 0.5) * 10;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;
    candles.push({
      time: (i + 1) * 1000,
      open,
      high,
      low,
      close,
    });
    price = close;
  }
  return candles;
};

export const createMockStock = (overrides: Partial<Stock> = {}): Stock => ({
  symbol: 'AAPL',
  name: 'Apple Inc.',
  currentPrice: 150,
  change: 2.5,
  changePercent: 1.69,
  priceHistory: createMockPriceHistory(),
  marketCapBillions: 3000,
  ...overrides,
});

export const createMockStocks = (): Stock[] => [
  createMockStock(),
  createMockStock({
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    currentPrice: 200,
    change: -1.5,
    changePercent: -0.74,
    marketCapBillions: 2000,
  }),
];

export const createMockPortfolio = (overrides: Partial<Portfolio> = {}): Portfolio => ({
  cash: 10000,
  holdings: [],
  ...overrides,
});

export const createMockOrder = (overrides: Partial<PendingOrder> = {}): PendingOrder => ({
  id: 'order-123',
  symbol: 'AAPL',
  type: 'buy',
  shares: 10,
  orderType: 'limit',
  orderPrice: 150,
  limitPrice: 145,
  timestamp: Date.now(),
  remainingCycles: 5,
  ...overrides,
});

export const createMockTrade = (overrides: Partial<CompletedTrade> = {}): CompletedTrade => ({
  id: 'trade-1',
  symbol: 'AAPL',
  type: 'buy',
  shares: 10,
  pricePerShare: 145,
  totalAmount: 1450,
  timestamp: Date.now(),
  ...overrides,
});
