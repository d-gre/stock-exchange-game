import { describe, it, expect } from 'vitest';
import { initializeStocks, generateNewCandle, applyTradeImpact } from './stockData';
import type { Stock } from '../types';

describe('stockData', () => {
  describe('initializeStocks', () => {
    it('should return 14 stocks', () => {
      const stocks = initializeStocks();
      expect(stocks).toHaveLength(14);
    });

    it('should include all expected symbols', () => {
      const stocks = initializeStocks();
      const symbols = stocks.map(s => s.symbol);
      // Tech
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('GOOGL');
      expect(symbols).toContain('MSFT');
      expect(symbols).toContain('AMZN');
      expect(symbols).toContain('TSLA');
      expect(symbols).toContain('META');
      expect(symbols).toContain('NVDA');
      // Finanz
      expect(symbols).toContain('JPM');
      expect(symbols).toContain('BAC');
      expect(symbols).toContain('V');
      expect(symbols).toContain('GS');
      // Industrie
      expect(symbols).toContain('CAT');
      expect(symbols).toContain('BA');
      expect(symbols).toContain('HON');
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
  });
});
