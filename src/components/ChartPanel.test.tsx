import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ChartPanel } from './ChartPanel';
import uiReducer from '../store/uiSlice';
import tradeHistoryReducer from '../store/tradeHistorySlice';
import loansReducer from '../store/loansSlice';
import portfolioReducer from '../store/portfolioSlice';
import stocksReducer from '../store/stocksSlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import shortPositionsReducer from '../store/shortPositionsSlice';
import floatReducer from '../store/floatSlice';
import settingsReducer from '../store/settingsSlice';
import { createMockStocks, createMockTrade } from '../test/testUtils';
import type { Portfolio, CompletedTrade, Stock } from '../types';
import { LOAN_CONFIG } from '../config';

// Mocks for lightweight-charts and ResizeObserver are defined in test/setup.ts

const createTestStore = (overrides: {
  chartTab?: 'stock' | 'index' | 'history';
  selectedStock?: string;
  trades?: CompletedTrade[];
  portfolio?: Portfolio;
  stocks?: Stock[];
} = {}) => {
  return configureStore({
    reducer: {
      ui: uiReducer,
      tradeHistory: tradeHistoryReducer,
      loans: loansReducer,
      portfolio: portfolioReducer,
      stocks: stocksReducer,
      pendingOrders: pendingOrdersReducer,
      shortPositions: shortPositionsReducer,
      float: floatReducer,
      settings: settingsReducer,
    },
    preloadedState: {
      ui: {
        selectedStock: overrides.selectedStock ?? '',
        tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
        settingsOpen: false,
        helpOpen: false,
        chartTab: overrides.chartTab ?? 'stock',
        loanModalOpen: false,
        highlightedLoanId: null as string | null,
        debugModalOpen: false,
        debugModalContent: '',
      },
      tradeHistory: {
        trades: overrides.trades ?? [],
        portfolioValueHistory: [],
      },
      loans: {
        loans: [],
        cyclesSinceLastInterestCharge: 0,
        totalInterestPaid: 0,
        totalOriginationFeesPaid: 0,
        totalRepaymentFeesPaid: 0,
        creditScore: LOAN_CONFIG.initialCreditScore,
        creditHistory: [],
        delinquencyHistory: [],
        nextLoanNumber: 1,
      },
      portfolio: overrides.portfolio ?? { cash: 10000, holdings: [] },
      stocks: { items: overrides.stocks ?? [] },
      pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
      shortPositions: {
        positions: [],
        totalBorrowFeesPaid: 0,
        marginCallsReceived: 0,
        forcedCoversExecuted: 0,
        marginCallStatuses: [],
      },
      float: { floats: {} },
      settings: {
        initialCash: 0,
        updateInterval: 5000,
        countdown: 5,
        isPaused: false,
        speedMultiplier: 1 as const,
        gameMode: 'realLife' as const,
        virtualPlayerCount: 50,
        language: 'en' as const,
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
    storeOverrides: Parameters<typeof createTestStore>[0] = {},
    props = defaultProps
  ) => {
    const store = createTestStore({
      portfolio: props.portfolio,
      stocks: props.stocks,
      ...storeOverrides,
    });
    const result = render(
      <Provider store={store}>
        <ChartPanel {...props} />
      </Provider>
    );
    return { ...result, store };
  };

  beforeEach(() => {
    mockOnSelectStock.mockClear();
    mockOnTrade.mockClear();
  });

  describe('tabs rendering', () => {
    it('should render market index tab', () => {
      renderWithStore();
      expect(screen.getByRole('button', { name: 'Märkte' })).toBeInTheDocument();
    });

    it('should not render assets tab when no holdings and no selected stock', () => {
      renderWithStore();
      expect(screen.queryByRole('button', { name: /Assets/ })).not.toBeInTheDocument();
    });

    it('should render assets tab when holdings exist', () => {
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
      renderWithStore({}, propsWithHoldings);
      expect(screen.getByRole('button', { name: 'Assets' })).toBeInTheDocument();
    });

    it('should render stock name tab when stock is selected but no holdings', () => {
      renderWithStore(
        { selectedStock: 'AAPL' },
        { ...defaultProps, selectedStock: 'AAPL' }
      );
      expect(screen.getByRole('button', { name: 'AAPL - Apple Inc.' })).toBeInTheDocument();
    });

    it('should not render history tab when no trades', () => {
      renderWithStore();
      expect(screen.queryByRole('button', { name: 'Order-Historie' })).not.toBeInTheDocument();
    });

    it('should render history tab when trades exist', () => {
      renderWithStore({ trades: [createMockTrade()] });
      expect(screen.getByRole('button', { name: 'Order-Historie' })).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('should switch to index tab when clicked', () => {
      const propsWithHoldings = {
        ...defaultProps,
        portfolio: { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 140 }] },
      };
      const { store } = renderWithStore({ chartTab: 'stock' }, propsWithHoldings);

      fireEvent.click(screen.getByRole('button', { name: 'Märkte' }));
      expect(store.getState().ui.chartTab).toBe('index');
    });

    it('should switch to history tab when clicked', () => {
      const { store } = renderWithStore({ trades: [createMockTrade()] });

      fireEvent.click(screen.getByRole('button', { name: 'Order-Historie' }));
      expect(store.getState().ui.chartTab).toBe('history');
    });

    it('should clear selected stock when clicking assets tab with holdings', () => {
      const propsWithHoldings = {
        ...defaultProps,
        selectedStock: 'AAPL',
        portfolio: { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 140 }] },
      };
      const { store } = renderWithStore({ chartTab: 'index', selectedStock: 'AAPL' }, propsWithHoldings);

      fireEvent.click(screen.getByRole('button', { name: 'Assets' }));
      expect(store.getState().ui.selectedStock).toBe('');
      expect(store.getState().ui.chartTab).toBe('stock');
    });
  });

  describe('market index display', () => {
    it('should show market index when no holdings and no selected stock', () => {
      renderWithStore({ chartTab: 'stock' });
      expect(screen.getByText('D-GREX Prime')).toBeInTheDocument();
    });

    it('should show market index on index tab', () => {
      renderWithStore({ chartTab: 'index' });
      expect(screen.getByText('D-GREX Prime')).toBeInTheDocument();
    });
  });

  describe('active tab styling', () => {
    it('should mark index tab as active when on index tab', () => {
      renderWithStore({ chartTab: 'index' });
      const indexTab = screen.getByRole('button', { name: 'Märkte' });
      expect(indexTab).toHaveClass('chart-panel__tab--active');
    });

    it('should mark history tab as active when on history tab', () => {
      renderWithStore({ chartTab: 'history', trades: [createMockTrade()] });
      const historyTab = screen.getByRole('button', { name: 'Order-Historie' });
      expect(historyTab).toHaveClass('chart-panel__tab--active');
    });
  });
});
