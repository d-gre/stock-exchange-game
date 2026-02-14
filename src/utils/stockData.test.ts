import { describe, it, expect } from 'vitest';
import { initializeStocks, generateNewCandle, applyTradeImpact, INITIAL_STOCKS } from './stockData';
import type { Stock } from '../types';
import { CONFIG } from '../config';

describe('stockData', () => {
  describe('initializeStocks', () => {
    it('should return default number of stocks per sector (3 × 4 = 12)', () => {
      const stocks = initializeStocks();
      expect(stocks).toHaveLength(CONFIG.stocksPerSector * 4);
    });

    it('should return all 16 stocks when stocksPerSector is 4', () => {
      const stocks = initializeStocks(4);
      expect(stocks).toHaveLength(16);
    });

    it('should randomly select stocks from valid symbols per sector', () => {
      const stocks = initializeStocks();
      const validTechSymbols = INITIAL_STOCKS.filter(s => s.sector === 'tech').map(s => s.symbol);
      const validFinanceSymbols = INITIAL_STOCKS.filter(s => s.sector === 'finance').map(s => s.symbol);
      const validIndustrialSymbols = INITIAL_STOCKS.filter(s => s.sector === 'industrial').map(s => s.symbol);
      const validCommoditiesSymbols = INITIAL_STOCKS.filter(s => s.sector === 'commodities').map(s => s.symbol);

      const techStocks = stocks.filter(s => s.sector === 'tech');
      const financeStocks = stocks.filter(s => s.sector === 'finance');
      const industrialStocks = stocks.filter(s => s.sector === 'industrial');
      const commoditiesStocks = stocks.filter(s => s.sector === 'commodities');

      // All selected stocks should be from valid symbols
      techStocks.forEach(s => expect(validTechSymbols).toContain(s.symbol));
      financeStocks.forEach(s => expect(validFinanceSymbols).toContain(s.symbol));
      industrialStocks.forEach(s => expect(validIndustrialSymbols).toContain(s.symbol));
      commoditiesStocks.forEach(s => expect(validCommoditiesSymbols).toContain(s.symbol));
    });

    it('should have correct number of stocks per sector based on config', () => {
      const stocks = initializeStocks();
      const sectorCounts = stocks.reduce((acc, s) => {
        acc[s.sector] = (acc[s.sector] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(sectorCounts.tech).toBe(CONFIG.stocksPerSector);
      expect(sectorCounts.finance).toBe(CONFIG.stocksPerSector);
      expect(sectorCounts.industrial).toBe(CONFIG.stocksPerSector);
      expect(sectorCounts.commodities).toBe(CONFIG.stocksPerSector);
    });

    it('should respect custom stocksPerSector parameter', () => {
      const stocks = initializeStocks(2);
      const sectorCounts = stocks.reduce((acc, s) => {
        acc[s.sector] = (acc[s.sector] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(sectorCounts.tech).toBe(2);
      expect(sectorCounts.finance).toBe(2);
      expect(sectorCounts.industrial).toBe(2);
      expect(sectorCounts.commodities).toBe(2);
      expect(stocks).toHaveLength(8);
    });

    it('should have valid price history for each stock', () => {
      const stocks = initializeStocks();
      for (const stock of stocks) {
        expect(stock.priceHistory.length).toBeGreaterThan(0);
        expect(stock.currentPrice).toBeGreaterThan(0);
      }
    });

    it('should have valid candle data structure', () => {
      const stocks = initializeStocks();
      const candle = stocks[0].priceHistory[0];
      expect(candle).toHaveProperty('time');
      expect(candle).toHaveProperty('open');
      expect(candle).toHaveProperty('high');
      expect(candle).toHaveProperty('low');
      expect(candle).toHaveProperty('close');
    });

    it('should have high >= open and close, low <= open and close', () => {
      const stocks = initializeStocks();
      for (const stock of stocks) {
        for (const candle of stock.priceHistory) {
          expect(candle.high).toBeGreaterThanOrEqual(candle.open);
          expect(candle.high).toBeGreaterThanOrEqual(candle.close);
          expect(candle.low).toBeLessThanOrEqual(candle.open);
          expect(candle.low).toBeLessThanOrEqual(candle.close);
        }
      }
    });
  });

  describe('generateNewCandle', () => {
    const createMockStock = (): Stock => ({
      symbol: 'TEST',
      name: 'Test Stock',
      sector: 'tech',
      currentPrice: 100,
      change: 0,
      changePercent: 0,
      priceHistory: [
        { time: 1000, open: 99, high: 101, low: 98, close: 100 },
      ],
      marketCapBillions: 100,
    });

    it('should add a new candle to price history', () => {
      const stock = createMockStock();
      const updated = generateNewCandle(stock);
      expect(updated.priceHistory.length).toBe(2);
    });

    it('should set new candle open to previous close', () => {
      const stock = createMockStock();
      const updated = generateNewCandle(stock);
      const newCandle = updated.priceHistory[updated.priceHistory.length - 1];
      expect(newCandle.open).toBe(100);
    });

    it('should update currentPrice to new close', () => {
      const stock = createMockStock();
      const updated = generateNewCandle(stock);
      const newCandle = updated.priceHistory[updated.priceHistory.length - 1];
      expect(updated.currentPrice).toBe(newCandle.close);
    });

    it('should calculate change and changePercent correctly', () => {
      const stock = createMockStock();
      const updated = generateNewCandle(stock);
      const newCandle = updated.priceHistory[updated.priceHistory.length - 1];
      const expectedChange = newCandle.close - newCandle.open;
      expect(updated.change).toBeCloseTo(expectedChange, 1);
    });

    it('should limit history to 100 candles', () => {
      let stock = createMockStock();
      // Add 110 candles
      for (let i = 0; i < 110; i++) {
        stock = generateNewCandle(stock);
      }
      expect(stock.priceHistory.length).toBeLessThanOrEqual(100);
    });

    it('should ensure price stays above minimum', () => {
      const stock: Stock = {
        symbol: 'TEST',
        name: 'Test Stock',
        sector: 'tech',
        currentPrice: 1,
        change: 0,
        changePercent: 0,
        priceHistory: [
          { time: 1000, open: 1, high: 1.5, low: 0.8, close: 1 },
        ],
        marketCapBillions: 100,
      };
      // Run multiple times to test edge cases
      for (let i = 0; i < 50; i++) {
        const updated = generateNewCandle(stock);
        expect(updated.currentPrice).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('applyTradeImpact', () => {
    const createMockStock = (): Stock => ({
      symbol: 'TEST',
      name: 'Test Stock',
      sector: 'tech',
      currentPrice: 100,
      change: 0,
      changePercent: 0,
      priceHistory: [
        { time: 1000, open: 99, high: 101, low: 98, close: 100 },
      ],
      marketCapBillions: 100,
    });

    it('should increase price on buy', () => {
      const stock = createMockStock();
      const updated = applyTradeImpact(stock, 'buy', 10);
      expect(updated.currentPrice).toBeGreaterThan(stock.currentPrice);
    });

    it('should decrease price on sell', () => {
      const stock = createMockStock();
      const updated = applyTradeImpact(stock, 'sell', 10);
      expect(updated.currentPrice).toBeLessThan(stock.currentPrice);
    });

    it('should have larger impact with more shares', () => {
      const stock = createMockStock();
      const smallTrade = applyTradeImpact(stock, 'buy', 1);
      const largeTrade = applyTradeImpact(stock, 'buy', 50);

      const smallImpact = smallTrade.currentPrice - stock.currentPrice;
      const largeImpact = largeTrade.currentPrice - stock.currentPrice;

      expect(largeImpact).toBeGreaterThan(smallImpact);
    });

    it('should update the last candle', () => {
      const stock = createMockStock();
      const updated = applyTradeImpact(stock, 'buy', 10);
      const lastCandle = updated.priceHistory[updated.priceHistory.length - 1];
      expect(lastCandle.close).toBe(updated.currentPrice);
    });

    it('should update high if new price is higher', () => {
      const stock = createMockStock();
      const updated = applyTradeImpact(stock, 'buy', 50);
      const lastCandle = updated.priceHistory[updated.priceHistory.length - 1];
      expect(lastCandle.high).toBeGreaterThanOrEqual(updated.currentPrice);
    });

    it('should ensure price stays above minimum', () => {
      const stock: Stock = {
        symbol: 'TEST',
        name: 'Test Stock',
        sector: 'tech',
        currentPrice: 1,
        change: 0,
        changePercent: 0,
        priceHistory: [
          { time: 1000, open: 1, high: 1.5, low: 0.8, close: 1 },
        ],
        marketCapBillions: 100,
      };
      const updated = applyTradeImpact(stock, 'sell', 100);
      expect(updated.currentPrice).toBeGreaterThanOrEqual(0.5);
    });

    it('should limit price change to max 2% (circuit breaker)', () => {
      const stock = createMockStock();
      // Even with a very large trade, price change should be capped at 2%
      const updated = applyTradeImpact(stock, 'buy', 10000);
      const priceChange = updated.currentPrice - stock.currentPrice;
      const maxAllowedChange = stock.currentPrice * 0.02;
      expect(priceChange).toBeLessThanOrEqual(maxAllowedChange);
    });

    it('should limit negative price change to max -2% (circuit breaker)', () => {
      const stock = createMockStock();
      const updated = applyTradeImpact(stock, 'sell', 10000);
      const priceChange = stock.currentPrice - updated.currentPrice;
      const maxAllowedChange = stock.currentPrice * 0.02;
      expect(priceChange).toBeLessThanOrEqual(maxAllowedChange);
    });
  });
});
