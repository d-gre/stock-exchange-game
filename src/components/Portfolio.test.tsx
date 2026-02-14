import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Portfolio } from './Portfolio';
import loansReducer from '../store/loansSlice';
import portfolioReducer from '../store/portfolioSlice';
import stocksReducer from '../store/stocksSlice';
import uiReducer from '../store/uiSlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import shortPositionsReducer from '../store/shortPositionsSlice';
import settingsReducer from '../store/settingsSlice';
import type { Portfolio as PortfolioType, Stock, PendingOrder } from '../types';

describe('Portfolio', () => {
  const mockStocks: Stock[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'tech',
      currentPrice: 150,
      change: 5,
      changePercent: 3.45,
      priceHistory: [],
      marketCapBillions: 3000,
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      sector: 'tech',
      currentPrice: 200,
      change: -3,
      changePercent: -1.48,
      priceHistory: [],
      marketCapBillions: 2000,
    },
  ];

  const mockPortfolio: PortfolioType = {
    cash: 5000,
    holdings: [
      { symbol: 'AAPL', shares: 10, avgBuyPrice: 100 },
      { symbol: 'GOOGL', shares: 5, avgBuyPrice: 180 },
    ],
  };

  // Create mock store for LoansList and PortfolioShorts components inside Portfolio
  const createMockStore = () =>
    configureStore({
      reducer: {
        loans: loansReducer,
        portfolio: portfolioReducer,
        stocks: stocksReducer,
        ui: uiReducer,
        pendingOrders: pendingOrdersReducer,
        shortPositions: shortPositionsReducer,
        settings: settingsReducer,
      },
      preloadedState: {
        loans: {
          loans: [],
          cyclesSinceLastInterestCharge: 0,
          totalInterestPaid: 0,
          totalOriginationFeesPaid: 0,
          totalRepaymentFeesPaid: 0,
          creditScore: 50,
          creditHistory: [],
          delinquencyHistory: [],
          nextLoanNumber: 1,
        },
        portfolio: {
          cash: 5000,
          holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
        },
        stocks: {
          items: mockStocks,
          lastUpdate: 0,
          isLoading: false,
        },
        ui: {
          selectedStock: '',
          tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
          settingsOpen: false,
          helpOpen: false,
          chartTab: 'stock' as const,
          loanModalOpen: false,
          highlightedLoanId: null as string | null,
          debugModalOpen: false,
          debugModalContent: '',
        },
        pendingOrders: {
          orders: [],
          tradedSymbolsThisCycle: [],
        },
        shortPositions: {
          positions: [],
          totalBorrowFeesPaid: 0,
          marginCallsReceived: 0,
          forcedCoversExecuted: 0,
          marginCallStatuses: [],
        },
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

  const renderWithProvider = (ui: React.ReactElement) => {
    const store = createMockStore();
    return render(<Provider store={store}>{ui}</Provider>);
  };

  const defaultProps = {
    portfolio: mockPortfolio,
    stocks: mockStocks,
    selectedStock: 'AAPL',
    pendingOrders: [] as PendingOrder[],
    failedOrderIds: [] as string[],
    reservedCash: 0,
    totalDebt: 0,
    onSelectStock: vi.fn(),
    onCancelOrder: vi.fn(),
    onEditOrder: vi.fn(),
    onCoverPosition: vi.fn(),
    onAddMargin: vi.fn(),
  };

  describe('composition', () => {
    it('should render portfolio title', () => {
      renderWithProvider(<Portfolio {...defaultProps} />);

      expect(screen.getByText('Portfolio')).toBeInTheDocument();
    });

    it('should render PortfolioSummary component', () => {
      renderWithProvider(<Portfolio {...defaultProps} />);

      // Check for summary elements
      expect(screen.getByText('Verfügbar:')).toBeInTheDocument();
      expect(screen.getByText('Gesamtwert:')).toBeInTheDocument();
    });

    it('should render PortfolioAssets component', () => {
      renderWithProvider(<Portfolio {...defaultProps} />);

      // Check for assets elements
      expect(screen.getByText('Assets')).toBeInTheDocument();
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('should render PortfolioOrders component', () => {
      renderWithProvider(<Portfolio {...defaultProps} />);

      // Check for orders elements
      expect(screen.getByText('Aufträge')).toBeInTheDocument();
    });

    it('should render LoansList component', () => {
      renderWithProvider(<Portfolio {...defaultProps} />);

      // Check for loans elements
      expect(screen.getByText('Kredite')).toBeInTheDocument();
    });
  });

  describe('calculations', () => {
    it('should calculate available cash correctly', () => {
      renderWithProvider(
        <Portfolio {...defaultProps} portfolio={{ cash: 5000, holdings: [] }} reservedCash={1500} />
      );

      // Available = 5000 - 1500 = 3500
      expect(screen.getByText('$3.500,00')).toBeInTheDocument();
    });

    it('should calculate total value with debt', () => {
      renderWithProvider(
        <Portfolio
          {...defaultProps}
          portfolio={{ cash: 10000, holdings: [] }}
          totalDebt={2000}
        />
      );

      // Total = 10000 - 2000 = 8000
      expect(screen.getByText('$8.000,00')).toBeInTheDocument();
    });

    it('should calculate profit/loss from holdings', () => {
      renderWithProvider(<Portfolio {...defaultProps} />);

      // AAPL: 10 shares × (150 - 100) = +500
      // GOOGL: 5 shares × (200 - 180) = +100
      // Total P/L = +600 (color indicates positive, no +/- prefix)
      expect(screen.getByText('$600,00')).toBeInTheDocument();
    });
  });

  describe('props forwarding', () => {
    it('should forward holdings to PortfolioAssets', () => {
      renderWithProvider(<Portfolio {...defaultProps} />);

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });

    it('should forward pendingOrders to PortfolioOrders', () => {
      const orders: PendingOrder[] = [
        {
          id: 'order-1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          orderType: 'market',
          orderPrice: 150,
          remainingCycles: 1,
          timestamp: Date.now(),
        },
      ];

      renderWithProvider(<Portfolio {...defaultProps} pendingOrders={orders} />);

      expect(screen.getByText('KAUF')).toBeInTheDocument();
    });

    it('should forward debt to PortfolioSummary', () => {
      renderWithProvider(<Portfolio {...defaultProps} totalDebt={5000} />);

      expect(screen.getByText('Verbindlichkeiten:')).toBeInTheDocument();
      expect(screen.getByText('$-5.000,00')).toBeInTheDocument();
    });
  });
});
