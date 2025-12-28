import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ChartPanel } from './ChartPanel';
import uiReducer from '../store/uiSlice';
import tradeHistoryReducer from '../store/tradeHistorySlice';
import { createMockStocks, createMockTrade } from '../test/testUtils';
import type { Portfolio, CompletedTrade } from '../types';

// Mocks for lightweight-charts and ResizeObserver are defined in test/setup.ts

const createTestStore = (overrides: {
  chartTab?: 'stock' | 'index' | 'history';
  selectedStock?: string;
  trades?: CompletedTrade[];
} = {}) => {
  return configureStore({
    reducer: {
      ui: uiReducer,
      tradeHistory: tradeHistoryReducer,
    },
    preloadedState: {
      ui: {
        selectedStock: overrides.selectedStock ?? '',
        tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
        settingsOpen: false,
        helpOpen: false,
        chartTab: overrides.chartTab ?? 'stock',
      },
      tradeHistory: {
        trades: overrides.trades ?? [],
        portfolioValueHistory: [],
      },
    },
  });
};

describe('ChartPanel', () => {
  const mockStocks = createMockStocks();
  const mockOnSelectStock = vi.fn();
  const mockOnTrade = vi.fn();

  const defaultProps = {
    stocks: mockStocks,
    portfolio: { cash: 10000, holdings: [] } as Portfolio,
    selectedStock: '',
    symbolsWithPendingOrders: [],
    theme: 'dark' as const,
    onSelectStock: mockOnSelectStock,
    onTrade: mockOnTrade,
  };

  const renderWithStore = (
    store: ReturnType<typeof createTestStore>,
    props = defaultProps
  ) => {
    return render(
      <Provider store={store}>
        <ChartPanel {...props} />
      </Provider>
    );
  };

  beforeEach(() => {
    mockOnSelectStock.mockClear();
    mockOnTrade.mockClear();
  });

  describe('tabs rendering', () => {
    it('should render market index tab', () => {
      renderWithStore(createTestStore());
      expect(screen.getByRole('button', { name: 'Markt Index' })).toBeInTheDocument();
    });

    it('should not render assets tab when no holdings and no selected stock', () => {
      renderWithStore(createTestStore());
      expect(screen.queryByRole('button', { name: /Assets/ })).not.toBeInTheDocument();
    });

    it('should render assets tab with count when holdings exist', () => {
      const propsWithHoldings = {
        ...defaultProps,
        portfolio: {
          cash: 10000,
          holdings: [
            { symbol: 'AAPL', shares: 10, avgBuyPrice: 140 },
            { symbol: 'GOOGL', shares: 5, avgBuyPrice: 190 },
          ],
        },
      };
      renderWithStore(createTestStore(), propsWithHoldings);
      expect(screen.getByRole('button', { name: 'Assets (2)' })).toBeInTheDocument();
    });

    it('should render stock name tab when stock is selected but no holdings', () => {
      renderWithStore(
        createTestStore({ selectedStock: 'AAPL' }),
        { ...defaultProps, selectedStock: 'AAPL' }
      );
      expect(screen.getByRole('button', { name: 'AAPL - Apple Inc.' })).toBeInTheDocument();
    });

    it('should not render history tab when no trades', () => {
      renderWithStore(createTestStore());
      expect(screen.queryByRole('button', { name: 'Order-Historie' })).not.toBeInTheDocument();
    });

    it('should render history tab when trades exist', () => {
      renderWithStore(createTestStore({ trades: [createMockTrade()] }));
      expect(screen.getByRole('button', { name: 'Order-Historie' })).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('should switch to index tab when clicked', () => {
      const store = createTestStore({ chartTab: 'stock' });
      const propsWithHoldings = {
        ...defaultProps,
        portfolio: { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 140 }] },
      };
      renderWithStore(store, propsWithHoldings);

      fireEvent.click(screen.getByRole('button', { name: 'Markt Index' }));
      expect(store.getState().ui.chartTab).toBe('index');
    });

    it('should switch to history tab when clicked', () => {
      const store = createTestStore({ trades: [createMockTrade()] });
      renderWithStore(store);

      fireEvent.click(screen.getByRole('button', { name: 'Order-Historie' }));
      expect(store.getState().ui.chartTab).toBe('history');
    });

    it('should clear selected stock when clicking assets tab with holdings', () => {
      const store = createTestStore({ chartTab: 'index', selectedStock: 'AAPL' });
      const propsWithHoldings = {
        ...defaultProps,
        selectedStock: 'AAPL',
        portfolio: { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 140 }] },
      };
      renderWithStore(store, propsWithHoldings);

      fireEvent.click(screen.getByRole('button', { name: 'Assets (1)' }));
      expect(store.getState().ui.selectedStock).toBe('');
      expect(store.getState().ui.chartTab).toBe('stock');
    });
  });

  describe('market index display', () => {
    it('should show market index when no holdings and no selected stock', () => {
      renderWithStore(createTestStore({ chartTab: 'stock' }));
      expect(screen.getByText('D-GREX Prime')).toBeInTheDocument();
    });

    it('should show market index on index tab', () => {
      renderWithStore(createTestStore({ chartTab: 'index' }));
      expect(screen.getByText('D-GREX Prime')).toBeInTheDocument();
    });
  });

  describe('active tab styling', () => {
    it('should mark index tab as active when on index tab', () => {
      renderWithStore(createTestStore({ chartTab: 'index' }));
      const indexTab = screen.getByRole('button', { name: 'Markt Index' });
      expect(indexTab).toHaveClass('chart-panel__tab--active');
    });

    it('should mark history tab as active when on history tab', () => {
      renderWithStore(createTestStore({ chartTab: 'history', trades: [createMockTrade()] }));
      const historyTab = screen.getByRole('button', { name: 'Order-Historie' });
      expect(historyTab).toHaveClass('chart-panel__tab--active');
    });
  });
});
