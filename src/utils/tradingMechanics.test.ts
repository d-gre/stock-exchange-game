import { describe, it, expect } from 'vitest';
import {
  calculateEffectivePrice,
  calculateTradeExecution,
  calculateSpread,
  calculateSlippage,
  calculateFee,
  canPlayerTrade,
} from './tradingMechanics';
import type { TradingMechanics } from '../types';

// Test configurations
const sandboxMechanics: TradingMechanics = {
  spreadPercent: 0.01,        // 1%
  slippagePerShare: 0.0005,   // 0.05%
  maxSlippage: 0.05,          // 5%
  feePercent: 0,
  minFee: 0,
  orderDelayCycles: 0,
};

const realLifeMechanics: TradingMechanics = {
  spreadPercent: 0.02,        // 2%
  slippagePerShare: 0.001,    // 0.1%
  maxSlippage: 0.10,          // 10%
  feePercent: 0.005,          // 0.5%
  minFee: 1,
  orderDelayCycles: 1,
};

const hardLifeMechanics: TradingMechanics = {
  spreadPercent: 0.03,        // 3%
  slippagePerShare: 0.0015,   // 0.15%
  maxSlippage: 0.15,          // 15%
  feePercent: 0.01,           // 1%
  minFee: 2,
  orderDelayCycles: 1,
};

describe('Trading Mechanics', () => {
  describe('calculateSpread', () => {
    it('should increase price for buy orders (half spread)', () => {
      const basePrice = 100;
      const spreadCost = calculateSpread(basePrice, 'buy', sandboxMechanics);

      // With 1% spread, buyer pays 0.5% more
      expect(spreadCost).toBeCloseTo(0.5, 2);
    });

    it('should decrease price for sell orders (half spread)', () => {
      const basePrice = 100;
      const spreadCost = calculateSpread(basePrice, 'sell', sandboxMechanics);

      // With 1% spread, seller receives 0.5% less
      expect(spreadCost).toBeCloseTo(-0.5, 2);
    });

    it('should scale with base price', () => {
      const spreadAt100 = calculateSpread(100, 'buy', sandboxMechanics);
      const spreadAt200 = calculateSpread(200, 'buy', sandboxMechanics);

      expect(spreadAt200).toBeCloseTo(spreadAt100 * 2, 2);
    });

    it('should apply higher spread in hard life mode', () => {
      const basePrice = 100;
      const sandboxSpread = calculateSpread(basePrice, 'buy', sandboxMechanics);
      const hardLifeSpread = calculateSpread(basePrice, 'buy', hardLifeMechanics);

      // Hard Life has 3% spread vs Sandbox 1%
      expect(hardLifeSpread).toBeCloseTo(sandboxSpread * 3, 2);
    });
  });

  describe('calculateSlippage', () => {
    it('should return 0 for single share', () => {
      const slippage = calculateSlippage(100, 1, 'buy', sandboxMechanics);
      expect(slippage).toBe(0);
    });

    it('should increase cost for buy orders with more shares', () => {
      const slippage10 = calculateSlippage(100, 10, 'buy', sandboxMechanics);
      const slippage20 = calculateSlippage(100, 20, 'buy', sandboxMechanics);

      expect(slippage10).toBeGreaterThan(0);
      expect(slippage20).toBeGreaterThan(slippage10);
    });

    it('should decrease proceeds for sell orders', () => {
      const slippage = calculateSlippage(100, 10, 'sell', sandboxMechanics);
      expect(slippage).toBeLessThan(0);
    });

    it('should cap slippage at maxSlippage', () => {
      // 1000 shares would cause enormous slippage without cap
      const basePrice = 100;
      const shares = 1000;
      const slippage = calculateSlippage(basePrice, shares, 'buy', sandboxMechanics);

      // maxSlippage bezieht sich auf den Gesamtwert: basePrice * maxSlippage * shares
      const maxPossible = basePrice * sandboxMechanics.maxSlippage * shares;

      expect(slippage).toBeLessThanOrEqual(maxPossible);
    });

    it('should calculate slippage progressively (average price impact)', () => {
      // With 10 shares and 0.05% per share:
      // Share 1: 0%, Share 2: 0.05%, ..., Share 10: 0.45%
      // Average: (0 + 0.05 + ... + 0.45) / 10 = 0.225%
      const basePrice = 100;
      const shares = 10;
      const slippage = calculateSlippage(basePrice, shares, 'buy', sandboxMechanics);

      // Expected average: sum(0..9) * 0.0005 * 100 / 10 = 45 * 0.05 / 10 = 0.225
      // Per share: 0.225 / 10 = 0.0225 per share on average
      // Total: approx. $2.25 for 10 shares
      expect(slippage).toBeGreaterThan(0);
      expect(slippage).toBeLessThan(basePrice * sandboxMechanics.maxSlippage);
    });
  });

  describe('calculateFee', () => {
    it('should return 0 in sandbox mode', () => {
      const fee = calculateFee(1000, sandboxMechanics);
      expect(fee).toBe(0);
    });

    it('should calculate percentage fee in real life mode', () => {
      const subtotal = 1000;
      const fee = calculateFee(subtotal, realLifeMechanics);

      // 0.5% von 1000 = 5
      expect(fee).toBeCloseTo(5, 2);
    });

    it('should apply minimum fee when percentage is lower', () => {
      const subtotal = 100; // 0.5% = 0.50, aber minFee = 1
      const fee = calculateFee(subtotal, realLifeMechanics);

      expect(fee).toBe(1);
    });

    it('should apply higher fees in hard life mode', () => {
      const subtotal = 1000;
      const realLifeFee = calculateFee(subtotal, realLifeMechanics);
      const hardLifeFee = calculateFee(subtotal, hardLifeMechanics);

      // Hard Life: 1% vs Real Life: 0.5%
      expect(hardLifeFee).toBeCloseTo(realLifeFee * 2, 2);
    });

    it('should apply higher minimum fee in hard life mode', () => {
      const subtotal = 100;
      const fee = calculateFee(subtotal, hardLifeMechanics);

      expect(fee).toBe(2); // minFee in Hard Life
    });
  });

  describe('calculateEffectivePrice', () => {
    it('should return higher price for buy orders', () => {
      const basePrice = 100;
      const effectivePrice = calculateEffectivePrice(basePrice, 10, 'buy', sandboxMechanics);

      expect(effectivePrice).toBeGreaterThan(basePrice);
    });

    it('should return lower price for sell orders', () => {
      const basePrice = 100;
      const effectivePrice = calculateEffectivePrice(basePrice, 10, 'sell', sandboxMechanics);

      expect(effectivePrice).toBeLessThan(basePrice);
    });

    it('should combine spread and slippage', () => {
      const basePrice = 100;
      const shares = 10;
      const effectivePrice = calculateEffectivePrice(basePrice, shares, 'buy', sandboxMechanics);

      const spread = calculateSpread(basePrice, 'buy', sandboxMechanics);
      const slippage = calculateSlippage(basePrice, shares, 'buy', sandboxMechanics);
      const expectedPrice = basePrice + (spread + slippage) / shares;

      expect(effectivePrice).toBeCloseTo(expectedPrice, 2);
    });
  });

  describe('calculateTradeExecution', () => {
    it('should calculate full trade execution for buy', () => {
      const execution = calculateTradeExecution(100, 10, 'buy', sandboxMechanics);

      expect(execution.effectivePrice).toBeGreaterThan(100);
      expect(execution.subtotal).toBe(execution.effectivePrice * 10);
      expect(execution.fee).toBe(0); // Sandbox hat keine Gebühren
      expect(execution.total).toBe(execution.subtotal);
      expect(execution.breakdown.basePrice).toBe(100);
      expect(execution.breakdown.spreadCost).toBeGreaterThan(0);
    });

    it('should calculate full trade execution for sell', () => {
      const execution = calculateTradeExecution(100, 10, 'sell', sandboxMechanics);

      expect(execution.effectivePrice).toBeLessThan(100);
      expect(execution.subtotal).toBe(execution.effectivePrice * 10);
      expect(execution.fee).toBe(0);
      expect(execution.total).toBe(execution.subtotal);
      expect(execution.breakdown.spreadCost).toBeLessThan(0);
    });

    it('should include fees in real life mode', () => {
      const execution = calculateTradeExecution(100, 10, 'buy', realLifeMechanics);

      expect(execution.fee).toBeGreaterThan(0);
      expect(execution.total).toBe(execution.subtotal + execution.fee);
    });

    it('should subtract fees from sell proceeds in real life mode', () => {
      const execution = calculateTradeExecution(100, 10, 'sell', realLifeMechanics);

      expect(execution.fee).toBeGreaterThan(0);
      expect(execution.total).toBe(execution.subtotal - execution.fee);
    });
  });

  describe('Pump and Dump Prevention', () => {
    it('should make immediate buy-sell unprofitable due to spread', () => {
      const basePrice = 100;
      const shares = 50;

      // Buy 50 shares
      const buyExecution = calculateTradeExecution(basePrice, shares, 'buy', sandboxMechanics);

      // Sell immediately at the same base price
      const sellExecution = calculateTradeExecution(basePrice, shares, 'sell', sandboxMechanics);

      // The spread alone should make the trade unprofitable
      const profit = sellExecution.total - buyExecution.total;
      expect(profit).toBeLessThan(0);
    });

    it('should have higher losses with larger orders due to slippage', () => {
      const basePrice = 100;

      // Small order
      const smallBuy = calculateTradeExecution(basePrice, 5, 'buy', sandboxMechanics);
      const smallSell = calculateTradeExecution(basePrice, 5, 'sell', sandboxMechanics);
      const smallLoss = smallSell.total - smallBuy.total;

      // Large order
      const largeBuy = calculateTradeExecution(basePrice, 50, 'buy', sandboxMechanics);
      const largeSell = calculateTradeExecution(basePrice, 50, 'sell', sandboxMechanics);
      const largeLoss = largeSell.total - largeBuy.total;

      // Larger orders should lose more percentage-wise
      const smallLossPercent = smallLoss / smallBuy.total;
      const largeLossPercent = largeLoss / largeBuy.total;

      expect(largeLossPercent).toBeLessThan(smallLossPercent);
    });

    it('should have significantly higher costs in hard life mode', () => {
      const basePrice = 100;
      const shares = 20;

      const sandboxBuy = calculateTradeExecution(basePrice, shares, 'buy', sandboxMechanics);
      const sandboxSell = calculateTradeExecution(basePrice, shares, 'sell', sandboxMechanics);
      const sandboxLoss = sandboxSell.total - sandboxBuy.total;

      const hardLifeBuy = calculateTradeExecution(basePrice, shares, 'buy', hardLifeMechanics);
      const hardLifeSell = calculateTradeExecution(basePrice, shares, 'sell', hardLifeMechanics);
      const hardLifeLoss = hardLifeSell.total - hardLifeBuy.total;

      // Hard Life should cause significantly more loss for the same trade
      expect(Math.abs(hardLifeLoss)).toBeGreaterThan(Math.abs(sandboxLoss) * 2);
    });
  });
});

describe('canPlayerTrade', () => {
  const baseParams = {
    tradeType: 'buy' as const,
    symbol: 'AAPL',
    stockPrice: 100,
    cash: 1000,
    sharesOwned: 10,
    tradedSymbolsThisCycle: [],
  };

  describe('buy trades', () => {
    it('should return true when player has enough cash', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 100,
        stockPrice: 100,
      });
      expect(result).toBe(true);
    });

    it('should return true when player has more than enough cash', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 500,
        stockPrice: 100,
      });
      expect(result).toBe(true);
    });

    it('should return false when player has insufficient cash', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 99,
        stockPrice: 100,
      });
      expect(result).toBe(false);
    });

    it('should return false when player has no cash', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 0,
        stockPrice: 100,
      });
      expect(result).toBe(false);
    });
  });

  describe('sell trades', () => {
    it('should return true when player owns shares', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'sell',
        sharesOwned: 1,
      });
      expect(result).toBe(true);
    });

    it('should return true when player owns multiple shares', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'sell',
        sharesOwned: 100,
      });
      expect(result).toBe(true);
    });

    it('should return false when player owns no shares', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'sell',
        sharesOwned: 0,
      });
      expect(result).toBe(false);
    });
  });

  describe('already traded this cycle', () => {
    it('should return false for buy when symbol already traded', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        tradedSymbolsThisCycle: ['AAPL'],
      });
      expect(result).toBe(false);
    });

    it('should return false for sell when symbol already traded', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'sell',
        tradedSymbolsThisCycle: ['AAPL'],
      });
      expect(result).toBe(false);
    });

    it('should return true when different symbol was traded', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        tradedSymbolsThisCycle: ['GOOGL', 'MSFT'],
      });
      expect(result).toBe(true);
    });

    it('should return false even with sufficient funds if already traded', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 10000,
        stockPrice: 100,
        tradedSymbolsThisCycle: ['AAPL'],
      });
      expect(result).toBe(false);
    });
  });

  describe('with reserved amounts (order book)', () => {
    it('should return false for buy when reserved cash reduces available below stock price', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 200,
        stockPrice: 100,
        reservedCash: 150, // Only 50 available, not enough for 100
      });
      expect(result).toBe(false);
    });

    it('should return true for buy when available cash (after reservation) is sufficient', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 300,
        stockPrice: 100,
        reservedCash: 150, // 150 available, enough for 100
      });
      expect(result).toBe(true);
    });

    it('should return false for sell when reserved shares reduces available to zero', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'sell',
        sharesOwned: 10,
        reservedShares: 10, // All shares reserved
      });
      expect(result).toBe(false);
    });

    it('should return true for sell when available shares (after reservation) is positive', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'sell',
        sharesOwned: 10,
        reservedShares: 5, // 5 shares still available
      });
      expect(result).toBe(true);
    });

    it('should return false when all cash is reserved for pending orders', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 1000,
        stockPrice: 100,
        reservedCash: 1000, // All cash reserved
      });
      expect(result).toBe(false);
    });

    it('should handle zero reserved amounts correctly', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 100,
        stockPrice: 100,
        reservedCash: 0,
        reservedShares: 0,
      });
      expect(result).toBe(true);
    });

    it('should handle missing reserved amounts (defaults to 0)', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 100,
        stockPrice: 100,
        // reservedCash and reservedShares not provided
      });
      expect(result).toBe(true);
    });

    it('should return false when exact cash equals stock price but some is reserved', () => {
      const result = canPlayerTrade({
        ...baseParams,
        tradeType: 'buy',
        cash: 100,
        stockPrice: 100,
        reservedCash: 1, // Just 1 reserved makes it impossible
      });
      expect(result).toBe(false);
    });

    it('should correctly combine reserved shares check with traded symbols check', () => {
      // First check: has shares but already traded
      const result1 = canPlayerTrade({
        ...baseParams,
        tradeType: 'sell',
        sharesOwned: 10,
        reservedShares: 0,
        tradedSymbolsThisCycle: ['AAPL'],
      });
      expect(result1).toBe(false);

      // Second check: has shares, not traded but all reserved
      const result2 = canPlayerTrade({
        ...baseParams,
        tradeType: 'sell',
        sharesOwned: 10,
        reservedShares: 10,
        tradedSymbolsThisCycle: [],
      });
      expect(result2).toBe(false);

      // Third check: has shares, not traded, some available
      const result3 = canPlayerTrade({
        ...baseParams,
        tradeType: 'sell',
        sharesOwned: 10,
        reservedShares: 5,
        tradedSymbolsThisCycle: [],
      });
      expect(result3).toBe(true);
    });
  });
});
