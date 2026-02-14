/**
 * Factory functions for creating mock test data with all required fields.
 */

import type { Stock, CandleData, Sector, VirtualPlayer, VirtualPlayerSettings, TraderType } from '../../types';

/**
 * Creates a mock CandleData with default values.
 */
export const createMockCandle = (overrides: Partial<CandleData> = {}): CandleData => ({
  time: Date.now(),
  open: 100,
  high: 105,
  low: 95,
  close: 100,
  ...overrides,
});

/**
 * Creates a mock Stock with all required fields.
 */
export const createMockStock = (overrides: Partial<Stock> = {}): Stock => {
  const basePrice = overrides.currentPrice ?? 100;
  const marketCap = overrides.marketCapBillions ?? 100;
  // Calculate float: (marketCap * 1e9 / price) * 0.20 / 1000
  const floatShares = Math.floor((marketCap * 1e9 / basePrice) * 0.20 / 1000);

  return {
    symbol: 'TEST',
    name: 'Test Company',
    sector: 'tech' as Sector,
    currentPrice: basePrice,
    priceHistory: [],
    change: 0,
    changePercent: 0,
    marketCapBillions: marketCap,
    floatShares,
    fairValue: basePrice,
    ...overrides,
  };
};

/**
 * Creates a mock VirtualPlayerSettings with all required fields.
 */
export const createMockVPSettings = (overrides: Partial<VirtualPlayerSettings> = {}): VirtualPlayerSettings => ({
  riskTolerance: 0,
  traderType: 'balanced' as TraderType,
  ...overrides,
});

/**
 * Creates a mock VirtualPlayer with all required fields.
 */
export const createMockVirtualPlayer = (overrides: Partial<VirtualPlayer> = {}): VirtualPlayer => ({
  id: 'bot-1',
  name: 'Test Bot',
  portfolio: {
    cash: 10000,
    holdings: [],
  },
  transactions: [],
  settings: createMockVPSettings(overrides.settings),
  loans: [],
  cyclesSinceInterest: 0,
  initialCash: 10000,
  ...overrides,
  // Ensure settings is properly merged
  ...(overrides.settings && { settings: createMockVPSettings(overrides.settings) }),
});

/**
 * Creates multiple mock stocks with different symbols.
 */
export const createMockStocks = (count: number, overrides: Partial<Stock>[] = []): Stock[] => {
  const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM'];
  const names = ['Apple', 'Alphabet', 'Microsoft', 'Amazon', 'Meta', 'Tesla', 'NVIDIA', 'JPMorgan'];

  return Array.from({ length: count }, (_, i) => {
    const baseOverrides = overrides[i] ?? {};
    return createMockStock({
      symbol: symbols[i % symbols.length],
      name: names[i % names.length],
      ...baseOverrides,
    });
  });
};
