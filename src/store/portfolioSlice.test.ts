import { describe, it, expect } from 'vitest';
import portfolioReducer, { buyStock, sellStock, applyStockSplit } from './portfolioSlice';

describe('portfolioSlice', () => {
  describe('buyStock', () => {
    it('should reduce cash and add holding for new stock', () => {
      const initialState = {
        cash: 1000,
        holdings: [],
      };

      const newState = portfolioReducer(
        initialState,
        buyStock({ symbol: 'AAPL', shares: 5, price: 100 })
      );

      expect(newState.cash).toBe(500);
      expect(newState.holdings).toHaveLength(1);
      expect(newState.holdings[0]).toEqual({
        symbol: 'AAPL',
        shares: 5,
        avgBuyPrice: 100,
      });
    });

    it('should update existing holding with new average price', () => {
      const initialState = {
        cash: 1000,
        holdings: [{ symbol: 'AAPL', shares: 5, avgBuyPrice: 100 }],
      };

      const newState = portfolioReducer(
        initialState,
        buyStock({ symbol: 'AAPL', shares: 5, price: 200 })
      );

      expect(newState.cash).toBe(0);
      expect(newState.holdings).toHaveLength(1);
      expect(newState.holdings[0].shares).toBe(10);
      expect(newState.holdings[0].avgBuyPrice).toBe(150); // (5*100 + 5*200) / 10
    });

    it('should execute buy even with insufficient cash (validation is in thunk)', () => {
      // Note: Cash validation is handled by executePendingOrders thunk,
      // which properly accounts for loans. The reducer always executes
      // to allow loan-funded purchases to work correctly.
      const initialState = {
        cash: 100,
        holdings: [],
      };

      const newState = portfolioReducer(
        initialState,
        buyStock({ symbol: 'AAPL', shares: 5, price: 100 })
      );

      // Cash can go negative - validation happens before dispatch
      expect(newState.cash).toBe(-400);
      expect(newState.holdings).toHaveLength(1);
      expect(newState.holdings[0].shares).toBe(5);
    });
  });

  describe('sellStock', () => {
    it('should increase cash and reduce holding shares', () => {
      const initialState = {
        cash: 0,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 100 }],
      };

      const newState = portfolioReducer(
        initialState,
        sellStock({ symbol: 'AAPL', shares: 5, price: 150 })
      );

      expect(newState.cash).toBe(750);
      expect(newState.holdings[0].shares).toBe(5);
    });

    it('should remove holding when all shares sold', () => {
      const initialState = {
        cash: 0,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 100 }],
      };

      const newState = portfolioReducer(
        initialState,
        sellStock({ symbol: 'AAPL', shares: 10, price: 150 })
      );

      expect(newState.cash).toBe(1500);
      expect(newState.holdings).toHaveLength(0);
    });

    it('should not sell if not enough shares', () => {
      const initialState = {
        cash: 0,
        holdings: [{ symbol: 'AAPL', shares: 5, avgBuyPrice: 100 }],
      };

      const newState = portfolioReducer(
        initialState,
        sellStock({ symbol: 'AAPL', shares: 10, price: 150 })
      );

      expect(newState.cash).toBe(0);
      expect(newState.holdings[0].shares).toBe(5);
    });

    it('should not sell if holding does not exist', () => {
      const initialState = {
        cash: 0,
        holdings: [],
      };

      const newState = portfolioReducer(
        initialState,
        sellStock({ symbol: 'AAPL', shares: 5, price: 150 })
      );

      expect(newState.cash).toBe(0);
      expect(newState.holdings).toHaveLength(0);
    });
  });

  describe('applyStockSplit', () => {
    it('should multiply shares by split ratio', () => {
      const initialState = {
        cash: 1000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 300 }],
      };

      const newState = portfolioReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.holdings[0].shares).toBe(30);
    });

    it('should divide avgBuyPrice by split ratio', () => {
      const initialState = {
        cash: 1000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 300 }],
      };

      const newState = portfolioReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.holdings[0].avgBuyPrice).toBe(100);
    });

    it('should not affect cash', () => {
      const initialState = {
        cash: 1000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 300 }],
      };

      const newState = portfolioReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.cash).toBe(1000);
    });

    it('should not affect other holdings', () => {
      const initialState = {
        cash: 1000,
        holdings: [
          { symbol: 'AAPL', shares: 10, avgBuyPrice: 300 },
          { symbol: 'GOOGL', shares: 5, avgBuyPrice: 200 },
        ],
      };

      const newState = portfolioReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.holdings[0].shares).toBe(30);
      expect(newState.holdings[1].shares).toBe(5);
      expect(newState.holdings[1].avgBuyPrice).toBe(200);
    });

    it('should do nothing if symbol is not in holdings', () => {
      const initialState = {
        cash: 1000,
        holdings: [{ symbol: 'GOOGL', shares: 5, avgBuyPrice: 200 }],
      };

      const newState = portfolioReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      expect(newState.holdings).toEqual(initialState.holdings);
    });

    it('should preserve total portfolio value (shares * avgBuyPrice)', () => {
      const initialState = {
        cash: 1000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 300 }],
      };
      const initialValue = initialState.holdings[0].shares * initialState.holdings[0].avgBuyPrice;

      const newState = portfolioReducer(
        initialState,
        applyStockSplit({ symbol: 'AAPL', ratio: 3 })
      );

      const newValue = newState.holdings[0].shares * newState.holdings[0].avgBuyPrice;
      expect(newValue).toBe(initialValue);
    });
  });
});
