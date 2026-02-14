import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { PortfolioShorts } from './PortfolioShorts';
import shortPositionsReducer from '../store/shortPositionsSlice';
import stocksReducer from '../store/stocksSlice';
import floatReducer from '../store/floatSlice';
import portfolioReducer from '../store/portfolioSlice';
import loansReducer from '../store/loansSlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import tradeHistoryReducer from '../store/tradeHistorySlice';
import settingsReducer from '../store/settingsSlice';
import type { Stock, Portfolio } from '../types';

// Mock stocks for testing
const mockStocks: Stock[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'tech',
    currentPrice: 150,
    change: 5,
    changePercent: 3.45,
    priceHistory: [{ time: 1000, open: 145, high: 152, low: 144, close: 150 }],
    marketCapBillions: 3000,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    sector: 'tech',
    currentPrice: 100,
    change: -2,
    changePercent: -1.96,
    priceHistory: [{ time: 1000, open: 102, high: 103, low: 99, close: 100 }],
    marketCapBillions: 2000,
  },
];

const mockPortfolio: Portfolio = {
  cash: 50000,
  holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 140 }],
};

const createMockStore = (shortPositions: {
  positions: Array<{
    symbol: string;
    shares: number;
    entryPrice: number;
    openedAt: number;
    collateralLocked: number;
    totalBorrowFeesPaid: number;
  }>;
  marginCallStatuses?: Array<{ symbol: string; cyclesRemaining: number }>;
}) =>
  configureStore({
    reducer: {
      shortPositions: shortPositionsReducer,
      stocks: stocksReducer,
      float: floatReducer,
      portfolio: portfolioReducer,
      loans: loansReducer,
      pendingOrders: pendingOrdersReducer,
      tradeHistory: tradeHistoryReducer,
      settings: settingsReducer,
    },
    preloadedState: {
      shortPositions: {
        positions: shortPositions.positions,
        totalBorrowFeesPaid: 0,
        marginCallsReceived: 0,
        forcedCoversExecuted: 0,
        marginCallStatuses: shortPositions.marginCallStatuses ?? [],
      },
      stocks: {
        items: mockStocks,
        lastUpdate: 0,
        isLoading: false,
      },
      float: {
        floats: {},
      },
      portfolio: {
        cash: mockPortfolio.cash,
        holdings: mockPortfolio.holdings,
      },
      loans: {
        loans: [],
        cyclesSinceLastInterestCharge: 0,
        totalInterestPaid: 0,
        totalOriginationFeesPaid: 0,
        totalRepaymentFeesPaid: 0,
        creditScore: 700,
        creditHistory: [],
        delinquencyHistory: [],
        nextLoanNumber: 1,
      },
      pendingOrders: {
        orders: [],
        tradedSymbolsThisCycle: [],
      },
      tradeHistory: {
        trades: [],
        portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
      },
      settings: {
        updateInterval: 10,
        countdown: 10,
        isPaused: false,
        virtualPlayerCount: 5,
        gameMode: 'realLife' as const,
        speedMultiplier: 1 as const,
        language: 'de' as const,
        initialCash: 100000,
      },
    },
  });

describe('PortfolioShorts', () => {
  const defaultProps = {
    stocks: mockStocks,
    portfolio: mockPortfolio,
    selectedStock: '',
    onSelectStock: vi.fn(),
    onCoverPosition: vi.fn(),
    onAddMargin: vi.fn(),
  };

  describe('rendering', () => {
    it('should render nothing when no short positions exist', () => {
      const store = createMockStore({ positions: [] });

      const { container } = render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render title when positions exist', () => {
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // German translation: "Short-Positionen"
      expect(screen.getByText('Short-Positionen')).toBeInTheDocument();
    });

    it('should display summary with total exposure, collateral, and P/L', () => {
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // German translations - check for the label texts (partial match due to ":")
      expect(screen.getByText(/Gesamtexposure/)).toBeInTheDocument();
      expect(screen.getByText(/Gesperrte Sicherheit/)).toBeInTheDocument();
      // P/L appears in summary
      expect(document.querySelector('.portfolio-shorts__summary')).toBeInTheDocument();
    });

    it('should display position details', () => {
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // Symbol and name
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();

      // German translations for details labels
      expect(screen.getByText(/Aktien/)).toBeInTheDocument();
      expect(screen.getByText(/Einstieg:/)).toBeInTheDocument();
      expect(screen.getByText(/Akt\. Kurs/)).toBeInTheDocument();
      // Use exact match for Sicherheit to avoid matching "Gesperrte Sicherheit"
      expect(screen.getByText('Sicherheit:')).toBeInTheDocument();
    });

    it('should display multiple positions', () => {
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
          {
            symbol: 'GOOGL',
            shares: 5,
            entryPrice: 110,
            openedAt: Date.now(),
            collateralLocked: 825,
            totalBorrowFeesPaid: 2,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });

    it('should show buy to cover button for each position', () => {
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // Button is now an icon button with title "Eindecken"
      expect(screen.getByTitle('Eindecken')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onSelectStock when clicking on a position', () => {
      const onSelectStock = vi.fn();
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} onSelectStock={onSelectStock} />
        </Provider>
      );

      fireEvent.click(screen.getByText('AAPL'));
      expect(onSelectStock).toHaveBeenCalledWith('AAPL');
    });

    it('should call onCoverPosition when clicking buy to cover button', () => {
      const onCoverPosition = vi.fn();
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} onCoverPosition={onCoverPosition} />
        </Provider>
      );

      // Button is now an icon button with title "Eindecken"
      fireEvent.click(screen.getByTitle('Eindecken'));
      expect(onCoverPosition).toHaveBeenCalledWith('AAPL');
    });

    it('should call onAddMargin when clicking add margin button', () => {
      const onAddMargin = vi.fn();
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} onAddMargin={onAddMargin} />
        </Provider>
      );

      fireEvent.click(screen.getByTitle('Margin erhöhen'));
      expect(onAddMargin).toHaveBeenCalledWith('AAPL');
    });

    it('should not trigger onSelectStock when clicking buy to cover button', () => {
      const onSelectStock = vi.fn();
      const onCoverPosition = vi.fn();
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts
            {...defaultProps}
            onSelectStock={onSelectStock}
            onCoverPosition={onCoverPosition}
          />
        </Provider>
      );

      // Button is now an icon button with title "Eindecken"
      fireEvent.click(screen.getByTitle('Eindecken'));
      expect(onCoverPosition).toHaveBeenCalled();
      expect(onSelectStock).not.toHaveBeenCalled();
    });

    it('should not trigger onSelectStock when clicking add margin button', () => {
      const onSelectStock = vi.fn();
      const onAddMargin = vi.fn();
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts
            {...defaultProps}
            onSelectStock={onSelectStock}
            onAddMargin={onAddMargin}
          />
        </Provider>
      );

      fireEvent.click(screen.getByTitle('Margin erhöhen'));
      expect(onAddMargin).toHaveBeenCalled();
      expect(onSelectStock).not.toHaveBeenCalled();
    });
  });

  describe('styling', () => {
    it('should apply selected class when position is selected', () => {
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} selectedStock="AAPL" />
        </Provider>
      );

      const item = screen.getByText('AAPL').closest('.portfolio-shorts__item');
      expect(item).toHaveClass('portfolio__list-item--selected');
    });

    it('should apply positive class for profitable positions', () => {
      // Entry at 160, current at 150 = profit for short (price went down)
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // Check that P/L value has positive class
      const plValues = document.querySelectorAll('.portfolio-shorts__detail-value--positive');
      expect(plValues.length).toBeGreaterThan(0);
    });

    it('should apply negative class for losing positions', () => {
      // Entry at 140, current at 150 = loss for short (price went up)
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 140,
            openedAt: Date.now(),
            collateralLocked: 2100,
            totalBorrowFeesPaid: 5,
          },
        ],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // Check that P/L value has negative class
      const plValues = document.querySelectorAll('.portfolio-shorts__detail-value--negative');
      expect(plValues.length).toBeGreaterThan(0);
    });
  });

  describe('margin calls', () => {
    it('should show margin call warning when position is in margin call', () => {
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 140,
            openedAt: Date.now(),
            collateralLocked: 100, // Very low collateral
            totalBorrowFeesPaid: 5,
          },
        ],
        marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 2 }],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // German translations: "Margin Call" and "Runden verbleibend"
      expect(screen.getByText(/Margin Call/)).toBeInTheDocument();
      expect(screen.getByText(/Runden verbleibend/)).toBeInTheDocument();
    });

    it('should apply margin call class to item in margin call', () => {
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 140,
            openedAt: Date.now(),
            collateralLocked: 100,
            totalBorrowFeesPaid: 5,
          },
        ],
        marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 2 }],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      const item = screen.getByText('AAPL').closest('.portfolio-shorts__item');
      expect(item).toHaveClass('portfolio-shorts__item--margin-call');
    });

    it('should not show margin call warning for healthy positions', () => {
      const store = createMockStore({
        positions: [
          {
            symbol: 'AAPL',
            shares: 10,
            entryPrice: 160,
            openedAt: Date.now(),
            collateralLocked: 2400,
            totalBorrowFeesPaid: 5,
          },
        ],
        marginCallStatuses: [], // No margin calls
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // No margin call warning should be displayed
      expect(screen.queryByText(/Runden verbleibend/)).not.toBeInTheDocument();
    });
  });

  describe('cover button disabled state', () => {
    it('should disable cover button when insufficient funds and max loans reached', () => {
      // Position costs 150 * 10 = 1500 to cover, but we only have 100 cash and no credit
      const storeWithNoFunds = configureStore({
        reducer: {
          shortPositions: shortPositionsReducer,
          stocks: stocksReducer,
          float: floatReducer,
          portfolio: portfolioReducer,
          loans: loansReducer,
          pendingOrders: pendingOrdersReducer,
          tradeHistory: tradeHistoryReducer,
          settings: settingsReducer,
        },
        preloadedState: {
          shortPositions: {
            positions: [{
              symbol: 'AAPL',
              shares: 10,
              entryPrice: 160,
              openedAt: Date.now(),
              collateralLocked: 2400,
              totalBorrowFeesPaid: 5,
            }],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          stocks: {
            items: mockStocks,
            lastUpdate: 0,
            isLoading: false,
          },
          float: { floats: {} },
          portfolio: {
            cash: 100, // Not enough to cover 10 shares at 150
            holdings: [], // No collateral for loan
          },
          loans: {
            loans: [
              { id: 'l1', principal: 10000, balance: 10000, interestRate: 0.05, createdAt: Date.now(), totalInterestPaid: 0, durationCycles: 40, remainingCycles: 30, isOverdue: false, overdueForCycles: 0, loanNumber: 1 },
              { id: 'l2', principal: 10000, balance: 10000, interestRate: 0.05, createdAt: Date.now(), totalInterestPaid: 0, durationCycles: 40, remainingCycles: 30, isOverdue: false, overdueForCycles: 0, loanNumber: 2 },
              { id: 'l3', principal: 10000, balance: 10000, interestRate: 0.05, createdAt: Date.now(), totalInterestPaid: 0, durationCycles: 40, remainingCycles: 30, isOverdue: false, overdueForCycles: 0, loanNumber: 3 },
            ],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 700,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 4,
          },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }] },
          settings: {
            updateInterval: 10,
            countdown: 10,
            isPaused: false,
            virtualPlayerCount: 5,
            gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
            language: 'de' as const,
            initialCash: 100000,
          },
        },
      });

      render(
        <Provider store={storeWithNoFunds}>
          <PortfolioShorts {...defaultProps} portfolio={{ cash: 100, holdings: [] }} />
        </Provider>
      );

      // Cover button should be disabled and show lock icon
      const coverBtn = screen.getByTitle(/Kreditlimit erreicht/i);
      expect(coverBtn).toBeDisabled();
      expect(coverBtn).toHaveClass('portfolio-shorts__cover-btn--disabled');
    });

    it('should enable cover button when sufficient funds available', () => {
      const store = createMockStore({
        positions: [{
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 160,
          openedAt: Date.now(),
          collateralLocked: 2400,
          totalBorrowFeesPaid: 5,
        }],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // Cover button should be enabled
      const coverBtn = screen.getByTitle('Eindecken');
      expect(coverBtn).not.toBeDisabled();
      expect(coverBtn).not.toHaveClass('portfolio-shorts__cover-btn--disabled');
    });

    it('should disable add margin button when no cash available', () => {
      const storeWithNoCash = configureStore({
        reducer: {
          shortPositions: shortPositionsReducer,
          stocks: stocksReducer,
          float: floatReducer,
          portfolio: portfolioReducer,
          loans: loansReducer,
          pendingOrders: pendingOrdersReducer,
          tradeHistory: tradeHistoryReducer,
          settings: settingsReducer,
        },
        preloadedState: {
          shortPositions: {
            positions: [{
              symbol: 'AAPL',
              shares: 10,
              entryPrice: 160,
              openedAt: Date.now(),
              collateralLocked: 2400,
              totalBorrowFeesPaid: 5,
            }],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          stocks: {
            items: mockStocks,
            lastUpdate: 0,
            isLoading: false,
          },
          float: { floats: {} },
          portfolio: {
            cash: 0, // No cash
            holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 140 }],
          },
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 700,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          tradeHistory: { trades: [], portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }] },
          settings: {
            updateInterval: 10,
            countdown: 10,
            isPaused: false,
            virtualPlayerCount: 5,
            gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
            language: 'de' as const,
            initialCash: 100000,
          },
        },
      });

      render(
        <Provider store={storeWithNoCash}>
          <PortfolioShorts {...defaultProps} portfolio={{ cash: 0, holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 140 }] }} />
        </Provider>
      );

      // Add margin button should be disabled
      const addMarginBtn = screen.getByTitle(/Kein Bargeld/i);
      expect(addMarginBtn).toBeDisabled();
      expect(addMarginBtn).toHaveClass('portfolio-shorts__add-margin-btn--disabled');
    });

    it('should enable add margin button when cash is available', () => {
      const store = createMockStore({
        positions: [{
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 160,
          openedAt: Date.now(),
          collateralLocked: 2400,
          totalBorrowFeesPaid: 5,
        }],
      });

      render(
        <Provider store={store}>
          <PortfolioShorts {...defaultProps} />
        </Provider>
      );

      // Add margin button should be enabled
      const addMarginBtn = screen.getByTitle('Margin erhöhen');
      expect(addMarginBtn).not.toBeDisabled();
      expect(addMarginBtn).not.toHaveClass('portfolio-shorts__add-margin-btn--disabled');
    });
  });
});
