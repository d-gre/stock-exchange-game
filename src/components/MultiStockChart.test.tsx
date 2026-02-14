import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MultiStockChart from './MultiStockChart';
import loansReducer from '../store/loansSlice';
import portfolioReducer from '../store/portfolioSlice';
import stocksReducer from '../store/stocksSlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import shortPositionsReducer from '../store/shortPositionsSlice';
import floatReducer from '../store/floatSlice';
import settingsReducer from '../store/settingsSlice';
import type { Stock, PortfolioItem, StockFloat } from '../types';
import { LOAN_CONFIG } from '../config';

/** Helper to create a complete StockFloat object */
const createMockFloat = (symbol: string, totalFloat: number): StockFloat => ({
  symbol,
  totalFloat,
  mmHeldShares: Math.floor(totalFloat * 0.5),
  playerHeldShares: 0,
  vpHeldShares: Math.floor(totalFloat * 0.5),
  reservedShares: 0,
});

/** Helper to create a store for short selling tests with customizable overrides */
const createShortSellingStore = (overrides: {
  stocks?: Stock[];
  holdings?: PortfolioItem[];
  floats?: Record<string, StockFloat>;
  shortPositions?: Array<{
    id: string;
    symbol: string;
    shares: number;
    entryPrice: number;
    openedAt: number;
    totalBorrowFeesPaid: number;
    lastBorrowFeeAt: number;
    collateralLocked: number;
  }>;
} = {}) => {
  const collateralStock: Stock = {
    symbol: 'COLLATERAL',
    name: 'Collateral Stock',
    sector: 'tech' as const,
    currentPrice: 100,
    change: 0,
    changePercent: 0,
    marketCapBillions: 100,
    priceHistory: [],
  };

  return configureStore({
    reducer: {
      loans: loansReducer,
      portfolio: portfolioReducer,
      stocks: stocksReducer,
      pendingOrders: pendingOrdersReducer,
      shortPositions: shortPositionsReducer,
      float: floatReducer,
      settings: settingsReducer,
    },
    preloadedState: {
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
      portfolio: {
        cash: 10000,
        holdings: overrides.holdings ?? [{ symbol: 'COLLATERAL', shares: 1000, avgBuyPrice: 100 }],
      },
      stocks: {
        items: overrides.stocks ?? [collateralStock],
      },
      pendingOrders: {
        orders: [],
        tradedSymbolsThisCycle: [],
      },
      shortPositions: {
        positions: overrides.shortPositions ?? [],
        totalBorrowFeesPaid: 0,
        marginCallsReceived: 0,
        forcedCoversExecuted: 0,
        marginCallStatuses: [],
      },
      float: {
        floats: overrides.floats ?? {},
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
};

// Mock CandlestickChart
vi.mock('./CandlestickChart', () => ({
  default: vi.fn(({ data, height, compact, autoHeight }) => (
    <div data-testid="candlestick-chart" data-height={height} data-compact={compact} data-autoheight={autoHeight}>
      Chart with {data.length} data points
    </div>
  )),
}));

const createTestStore = (overrides: {
  cash?: number;
  holdings?: PortfolioItem[];
  stocks?: Stock[];
  loanCount?: number;
} = {}) => {
  return configureStore({
    reducer: {
      loans: loansReducer,
      portfolio: portfolioReducer,
      stocks: stocksReducer,
      pendingOrders: pendingOrdersReducer,
      shortPositions: shortPositionsReducer,
      float: floatReducer,
      settings: settingsReducer,
    },
    preloadedState: {
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
      portfolio: {
        cash: overrides.cash ?? 10000,
        holdings: overrides.holdings ?? [],
      },
      stocks: {
        items: overrides.stocks ?? [],
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
      float: {
        floats: {},
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
};

describe('MultiStockChart', () => {
  const createMockStock = (symbol: string, overrides: Partial<Stock> = {}): Stock => ({
    symbol,
    name: `${symbol} Inc.`,
    sector: 'tech',
    currentPrice: 100,
    change: 5,
    changePercent: 5.26,
    marketCapBillions: 100,
    priceHistory: [
      { time: 1000, open: 95, high: 100, low: 90, close: 100 },
    ],
    ...overrides,
  });

  const createMockHolding = (symbol: string, overrides: Partial<PortfolioItem> = {}): PortfolioItem => ({
    symbol,
    shares: 10,
    avgBuyPrice: 90,
    ...overrides,
  });

  const defaultProps = {
    stocks: [] as Stock[],
    holdings: [] as PortfolioItem[],
    selectedStock: '',
    cash: 10000,
    symbolsWithPendingOrders: [] as string[],
    onSelectStock: vi.fn(),
    onTrade: vi.fn(),
  };

  const renderWithStore = (
    props: typeof defaultProps,
    storeOverrides: Parameters<typeof createTestStore>[0] = {}
  ) => {
    const store = createTestStore({
      cash: props.cash,
      holdings: props.holdings,
      stocks: props.stocks,
      ...storeOverrides,
    });
    return render(
      <Provider store={store}>
        <MultiStockChart {...props} />
      </Provider>
    );
  };

  describe('empty state', () => {
    it('should show empty message when no holdings', () => {
      const stocks = [createMockStock('AAPL')];
      renderWithStore({ ...defaultProps, stocks });

      expect(screen.getByText('Keine Aktien im Portfolio')).toBeInTheDocument();
      expect(screen.getByText(/Klicken Sie auf eine Aktie/)).toBeInTheDocument();
    });

    it('should show not found message when selected stock does not exist', () => {
      renderWithStore({ ...defaultProps, selectedStock: 'INVALID' });

      expect(screen.getByText('Aktie nicht gefunden')).toBeInTheDocument();
    });
  });

  describe('selected stock view', () => {
    it('should show single stock chart when stock is selected', () => {
      const stock = createMockStock('AAPL');
      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        selectedStock: 'AAPL',
      });

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('AAPL Inc.')).toBeInTheDocument();
      expect(screen.getByTestId('candlestick-chart')).toBeInTheDocument();
    });

    it('should show holding info when user owns the selected stock', () => {
      const stock = createMockStock('AAPL');
      const holding = createMockHolding('AAPL', { shares: 25, avgBuyPrice: 85 });

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        holdings: [holding],
        selectedStock: 'AAPL',
      });

      // Format: "$ X,XX" with German locale
      expect(screen.getByText(/25 Stk. @ \$85,00/)).toBeInTheDocument();
    });

    it('should show positive price change with correct styling', () => {
      const stock = createMockStock('AAPL', { change: 5, changePercent: 5.26 });

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        selectedStock: 'AAPL',
      });

      // Format: "$ X,XX" with German locale
      const priceElement = screen.getByText(/\$100,00/).closest('.multi-stock-chart__card-price');
      expect(priceElement).toHaveClass('positive');
    });

    it('should show negative price change with correct styling', () => {
      const stock = createMockStock('AAPL', { change: -5, changePercent: -5.0 });

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        selectedStock: 'AAPL',
      });

      // Format: "$ X,XX" with German locale
      const priceElement = screen.getByText(/\$100,00/).closest('.multi-stock-chart__card-price');
      expect(priceElement).toHaveClass('negative');
    });

    it('should call onSelectStock when clicking selected stock card (multiple holdings)', () => {
      const onSelectStock = vi.fn();
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL'), createMockHolding('MSFT')];

      renderWithStore({
        ...defaultProps,
        stocks,
        holdings,
        selectedStock: 'AAPL',
        onSelectStock,
      });

      fireEvent.click(screen.getByText('AAPL').closest('.multi-stock-chart__card')!);
      expect(onSelectStock).toHaveBeenCalledWith('AAPL');
    });

    it('should NOT call onSelectStock when clicking selected stock card (single holding)', () => {
      const onSelectStock = vi.fn();
      const stock = createMockStock('AAPL');
      const holdings = [createMockHolding('AAPL')];

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        holdings,
        selectedStock: 'AAPL',
        onSelectStock,
      });

      fireEvent.click(screen.getByText('AAPL').closest('.multi-stock-chart__card')!);
      expect(onSelectStock).not.toHaveBeenCalled();
    });

    it('should use autoHeight for selected stock chart', () => {
      const stock = createMockStock('AAPL');

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        selectedStock: 'AAPL',
      });

      const chart = screen.getByTestId('candlestick-chart');
      expect(chart).toHaveAttribute('data-autoheight', 'true');
    });
  });

  describe('portfolio view (no selection)', () => {
    it('should show all owned stocks sorted alphabetically', () => {
      const stocks = [
        createMockStock('MSFT'),
        createMockStock('AAPL'),
        createMockStock('GOOGL'),
      ];
      const holdings = [
        createMockHolding('MSFT'),
        createMockHolding('AAPL'),
        createMockHolding('GOOGL'),
      ];

      renderWithStore({ ...defaultProps, stocks, holdings });

      const cards = screen.getAllByTestId('candlestick-chart');
      expect(cards).toHaveLength(3);

      // Check alphabetical order
      const symbols = screen.getAllByText(/^(AAPL|GOOGL|MSFT)$/);
      expect(symbols[0]).toHaveTextContent('AAPL');
      expect(symbols[1]).toHaveTextContent('GOOGL');
      expect(symbols[2]).toHaveTextContent('MSFT');
    });

    it('should show share count and buy price for each holding', () => {
      const stocks = [createMockStock('AAPL')];
      const holdings = [createMockHolding('AAPL', { shares: 42, avgBuyPrice: 85 })];

      renderWithStore({ ...defaultProps, stocks, holdings });

      // Format: "$ X,XX" with German locale
      expect(screen.getByText(/42 Stk. @ \$85,00/)).toBeInTheDocument();
    });

    it('should show profit/loss for each holding', () => {
      const stocks = [createMockStock('AAPL', { currentPrice: 100 })];
      const holdings = [createMockHolding('AAPL', { shares: 10, avgBuyPrice: 90 })];
      // P/L = (100 - 90) * 10 = $100

      renderWithStore({ ...defaultProps, stocks, holdings });

      // Format: "$ X,XX" with German locale
      // Find the P/L element specifically by its class (price also shows $ 100,00)
      const pnlElement = document.querySelector('.multi-stock-chart__card-pnl');
      expect(pnlElement).toBeInTheDocument();
      expect(pnlElement).toHaveTextContent('$100,00');
    });

    it('should show negative profit/loss with correct styling', () => {
      const stocks = [createMockStock('AAPL', { currentPrice: 80 })];
      const holdings = [createMockHolding('AAPL', { shares: 10, avgBuyPrice: 100 })];
      // P/L = (80 - 100) * 10 = -$200

      renderWithStore({ ...defaultProps, stocks, holdings });

      // Format: "$ -X,XX" with German locale (dollar sign, space, minus, number)
      const pnlElement = screen.getByText(/\$-200,00/).closest('.multi-stock-chart__card-pnl');
      expect(pnlElement).toHaveClass('multi-stock-chart__card-pnl--negative');
    });

    it('should call onSelectStock when clicking a stock card (multiple holdings)', () => {
      const onSelectStock = vi.fn();
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL'), createMockHolding('MSFT')];

      renderWithStore({ ...defaultProps, stocks, holdings, onSelectStock });

      fireEvent.click(screen.getByText('AAPL').closest('.multi-stock-chart__card')!);
      expect(onSelectStock).toHaveBeenCalledWith('AAPL');
    });

    it('should NOT call onSelectStock when clicking a stock card (single holding)', () => {
      const onSelectStock = vi.fn();
      const stocks = [createMockStock('AAPL')];
      const holdings = [createMockHolding('AAPL')];

      renderWithStore({ ...defaultProps, stocks, holdings, onSelectStock });

      fireEvent.click(screen.getByText('AAPL').closest('.multi-stock-chart__card')!);
      expect(onSelectStock).not.toHaveBeenCalled();
    });

    it('should use autoHeight when only one stock in portfolio', () => {
      const stocks = [createMockStock('AAPL')];
      const holdings = [createMockHolding('AAPL')];

      renderWithStore({ ...defaultProps, stocks, holdings });

      const chart = screen.getByTestId('candlestick-chart');
      expect(chart).toHaveAttribute('data-autoheight', 'true');
    });

    it('should use compact mode when multiple stocks in portfolio', () => {
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL'), createMockHolding('MSFT')];

      renderWithStore({ ...defaultProps, stocks, holdings });

      const charts = screen.getAllByTestId('candlestick-chart');
      charts.forEach(chart => {
        expect(chart).toHaveAttribute('data-compact', 'true');
      });
    });

    it('should apply correct grid class based on stock count', () => {
      const stocks = [
        createMockStock('AAPL'),
        createMockStock('MSFT'),
        createMockStock('GOOGL'),
      ];
      const holdings = [
        createMockHolding('AAPL'),
        createMockHolding('MSFT'),
        createMockHolding('GOOGL'),
      ];

      const { container } = renderWithStore({ ...defaultProps, stocks, holdings });

      expect(container.querySelector('.multi-stock-chart__grid.multi-stock-chart__grid--count-3')).toBeInTheDocument();
    });

    it('should only show stocks that user owns', () => {
      const stocks = [
        createMockStock('AAPL'),
        createMockStock('MSFT'),
        createMockStock('GOOGL'),
      ];
      const holdings = [createMockHolding('AAPL')]; // Only owns AAPL

      renderWithStore({ ...defaultProps, stocks, holdings });

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
      expect(screen.queryByText('GOOGL')).not.toBeInTheDocument();
    });
  });

  describe('buy button with credit', () => {
    it('should enable buy button when cash is insufficient but credit is available', () => {
      // Stock costs $100, user has $50 cash but has collateral for credit
      const stock = createMockStock('AAPL', { currentPrice: 100, marketCapBillions: 100 });
      // Large cap stock as collateral provides credit line
      const collateralStock = createMockStock('MSFT', { currentPrice: 500, marketCapBillions: 100 });
      const collateralHolding = createMockHolding('MSFT', { shares: 100, avgBuyPrice: 400 }); // $50,000 worth

      renderWithStore({
        ...defaultProps,
        stocks: [stock, collateralStock],
        holdings: [collateralHolding],
        selectedStock: 'AAPL',
        cash: 50, // Not enough to buy $100 stock
      });

      const buyButton = screen.getByRole('button', { name: /Kaufen/ });
      // Button should be enabled because credit is available
      expect(buyButton).not.toBeDisabled();
    });

    it('should disable buy button when neither cash nor credit is sufficient', () => {
      // Stock costs $100, user has $50 cash and no collateral for credit
      const stock = createMockStock('AAPL', { currentPrice: 100, marketCapBillions: 100 });

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        holdings: [], // No collateral
        selectedStock: 'AAPL',
        cash: 50, // Not enough to buy $100 stock
      });

      const buyButton = screen.getByRole('button', { name: /Kaufen/ });
      // Button should be disabled because no credit available
      expect(buyButton).toBeDisabled();
    });
  });

  describe('trade button interactions in selected stock view', () => {
    it('should call onTrade with buy when clicking buy button', () => {
      const onTrade = vi.fn();
      const stock = createMockStock('AAPL');

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        selectedStock: 'AAPL',
        onTrade,
        cash: 10000,
      });

      const buyButton = screen.getByRole('button', { name: /Kaufen/ });
      fireEvent.click(buyButton);

      expect(onTrade).toHaveBeenCalledWith('AAPL', 'buy');
    });

    it('should call onTrade with sell when clicking sell button', () => {
      const onTrade = vi.fn();
      const stock = createMockStock('AAPL');
      const holding = createMockHolding('AAPL', { shares: 10 });

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        holdings: [holding],
        selectedStock: 'AAPL',
        onTrade,
      });

      const sellButton = screen.getByRole('button', { name: /Verkaufen/ });
      fireEvent.click(sellButton);

      expect(onTrade).toHaveBeenCalledWith('AAPL', 'sell');
    });

    it('should disable sell button when user has no shares', () => {
      const onTrade = vi.fn();
      const stock = createMockStock('AAPL');

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        holdings: [], // No holdings
        selectedStock: 'AAPL',
        onTrade,
      });

      const sellButton = screen.getByRole('button', { name: /Verkaufen/ });
      expect(sellButton).toBeDisabled();

      fireEvent.click(sellButton);
      expect(onTrade).not.toHaveBeenCalled();
    });

    it('should disable buttons when stock has pending order', () => {
      const onTrade = vi.fn();
      const stock = createMockStock('AAPL');
      const holding = createMockHolding('AAPL', { shares: 10 });

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        holdings: [holding],
        selectedStock: 'AAPL',
        symbolsWithPendingOrders: ['AAPL'],
        onTrade,
        cash: 10000,
      });

      const buyButton = screen.getByRole('button', { name: /Kaufen/ });
      const sellButton = screen.getByRole('button', { name: /Verkaufen/ });

      expect(buyButton).toBeDisabled();
      expect(sellButton).toBeDisabled();
    });

    it('should show short sell button when short selling is enabled', () => {
      const stock = createMockStock('AAPL');

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        selectedStock: 'AAPL',
      });

      // Short selling button should be present (SHORT_SELLING_CONFIG.enabled = true)
      // Button text is "Leerverkauf" in German
      const shortButton = screen.getByRole('button', { name: /Leerverkauf/ });
      expect(shortButton).toBeInTheDocument();
    });

    it('should stop propagation when clicking trade buttons', () => {
      const onTrade = vi.fn();
      const onSelectStock = vi.fn();
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL'), createMockHolding('MSFT')];

      renderWithStore({
        ...defaultProps,
        stocks,
        holdings,
        selectedStock: 'AAPL',
        onTrade,
        onSelectStock,
        cash: 10000,
      });

      const buyButton = screen.getByRole('button', { name: /Kaufen/ });
      fireEvent.click(buyButton);

      // onTrade should be called but onSelectStock should not
      expect(onTrade).toHaveBeenCalledWith('AAPL', 'buy');
      expect(onSelectStock).not.toHaveBeenCalled();
    });
  });

  describe('trade button interactions in portfolio grid view', () => {
    it('should call onTrade with buy when clicking buy button in grid', () => {
      const onTrade = vi.fn();
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL'), createMockHolding('MSFT')];

      const { container } = renderWithStore({
        ...defaultProps,
        stocks,
        holdings,
        onTrade,
        cash: 10000,
      });

      // Get all buy buttons by class (icon-only buttons in grid view)
      const buyButtons = container.querySelectorAll('.multi-stock-chart__action-btn--buy');
      expect(buyButtons).toHaveLength(2);

      fireEvent.click(buyButtons[0]); // Click first buy button (AAPL - alphabetically first)
      expect(onTrade).toHaveBeenCalledWith('AAPL', 'buy');
    });

    it('should call onTrade with sell when clicking sell button in grid', () => {
      const onTrade = vi.fn();
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL', { shares: 10 }), createMockHolding('MSFT', { shares: 5 })];

      const { container } = renderWithStore({
        ...defaultProps,
        stocks,
        holdings,
        onTrade,
      });

      // Get all sell buttons by class
      const sellButtons = container.querySelectorAll('.multi-stock-chart__action-btn--sell');
      expect(sellButtons).toHaveLength(2);

      fireEvent.click(sellButtons[1]); // Click second sell button (MSFT)
      expect(onTrade).toHaveBeenCalledWith('MSFT', 'sell');
    });

    it('should stop propagation when clicking trade buttons in grid', () => {
      const onTrade = vi.fn();
      const onSelectStock = vi.fn();
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL'), createMockHolding('MSFT')];

      const { container } = renderWithStore({
        ...defaultProps,
        stocks,
        holdings,
        onTrade,
        onSelectStock,
        cash: 10000,
      });

      const buyButtons = container.querySelectorAll('.multi-stock-chart__action-btn--buy');

      fireEvent.click(buyButtons[0]);

      // onTrade should be called but onSelectStock should not
      expect(onTrade).toHaveBeenCalledWith('AAPL', 'buy');
      expect(onSelectStock).not.toHaveBeenCalled();
    });

    it('should disable buy button when stock has pending order in grid', () => {
      const onTrade = vi.fn();
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL'), createMockHolding('MSFT')];

      const { container } = renderWithStore({
        ...defaultProps,
        stocks,
        holdings,
        symbolsWithPendingOrders: ['AAPL'],
        onTrade,
        cash: 10000,
      });

      const buyButtons = container.querySelectorAll('.multi-stock-chart__action-btn--buy');

      // First button (AAPL) should be disabled
      expect(buyButtons[0]).toBeDisabled();
      // Second button (MSFT) should be enabled
      expect(buyButtons[1]).not.toBeDisabled();
    });

    it('should show short sell buttons in grid when short selling is enabled', () => {
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL'), createMockHolding('MSFT')];

      const { container } = renderWithStore({
        ...defaultProps,
        stocks,
        holdings,
      });

      const shortButtons = container.querySelectorAll('.multi-stock-chart__action-btn--short');

      // Should have short buttons for each stock
      expect(shortButtons).toHaveLength(2);
    });
  });

  describe('short selling functionality', () => {
    it('should disable short button when no float data available', () => {
      const stock = createMockStock('AAPL', { currentPrice: 100 });
      const store = createShortSellingStore({ stocks: [stock] });

      render(
        <Provider store={store}>
          <MultiStockChart
            {...defaultProps}
            stocks={[stock]}
            selectedStock="AAPL"
          />
        </Provider>
      );

      const shortButton = screen.getByRole('button', { name: /Leerverkauf/ });
      expect(shortButton).toBeDisabled();
    });

    it('should disable short button when float is zero', () => {
      const stock = createMockStock('AAPL', { currentPrice: 100 });
      const store = createShortSellingStore({
        stocks: [stock],
        floats: { AAPL: createMockFloat('AAPL', 0) },
      });

      render(
        <Provider store={store}>
          <MultiStockChart
            {...defaultProps}
            stocks={[stock]}
            selectedStock="AAPL"
          />
        </Provider>
      );

      const shortButton = screen.getByRole('button', { name: /Leerverkauf/ });
      expect(shortButton).toBeDisabled();
    });

    it('should enable short button when float is available and margin is sufficient', () => {
      const stock = createMockStock('AAPL', { currentPrice: 100 });
      const collateralStock = createMockStock('COLLATERAL', { currentPrice: 100, marketCapBillions: 100 });

      const store = createShortSellingStore({
        stocks: [stock, collateralStock],
        floats: { AAPL: createMockFloat('AAPL', 1000000) },
      });

      render(
        <Provider store={store}>
          <MultiStockChart
            {...defaultProps}
            stocks={[stock, collateralStock]}
            selectedStock="AAPL"
          />
        </Provider>
      );

      const shortButton = screen.getByRole('button', { name: /Leerverkauf/ });
      expect(shortButton).not.toBeDisabled();
    });

    it('should call onTrade with shortSell when clicking short button', () => {
      const onTrade = vi.fn();
      const stock = createMockStock('AAPL', { currentPrice: 100 });
      const collateralStock = createMockStock('COLLATERAL', { currentPrice: 100, marketCapBillions: 100 });

      const store = createShortSellingStore({
        stocks: [stock, collateralStock],
        floats: { AAPL: createMockFloat('AAPL', 1000000) },
      });

      render(
        <Provider store={store}>
          <MultiStockChart
            {...defaultProps}
            stocks={[stock, collateralStock]}
            selectedStock="AAPL"
            onTrade={onTrade}
          />
        </Provider>
      );

      const shortButton = screen.getByRole('button', { name: /Leerverkauf/ });
      fireEvent.click(shortButton);

      expect(onTrade).toHaveBeenCalledWith('AAPL', 'shortSell');
    });

    it('should disable short button when all shares are already shorted', () => {
      const stock = createMockStock('AAPL', { currentPrice: 100 });
      const collateralStock = createMockStock('COLLATERAL', { currentPrice: 100, marketCapBillions: 100 });

      // All available shares are already shorted (totalFloat * maxShortPercentOfFloat = 1000 * 0.5 = 500)
      const store = createShortSellingStore({
        stocks: [stock, collateralStock],
        floats: { AAPL: createMockFloat('AAPL', 1000) }, // Only 1000 shares, max shortable = 500
        shortPositions: [
          { id: 'sp1', symbol: 'AAPL', shares: 500, entryPrice: 100, openedAt: Date.now(), totalBorrowFeesPaid: 0, lastBorrowFeeAt: Date.now(), collateralLocked: 7500 },
        ],
      });

      render(
        <Provider store={store}>
          <MultiStockChart
            {...defaultProps}
            stocks={[stock, collateralStock]}
            selectedStock="AAPL"
          />
        </Provider>
      );

      const shortButton = screen.getByRole('button', { name: /Leerverkauf/ });
      // Button should be disabled because all shortable shares are taken
      expect(shortButton).toBeDisabled();
    });
  });

  describe('short button in portfolio grid view', () => {
    it('should call onTrade with shortSell when clicking short button in grid', () => {
      const onTrade = vi.fn();
      const stock = createMockStock('AAPL', { currentPrice: 100 });
      const collateralStock = createMockStock('COLLATERAL', { currentPrice: 100, marketCapBillions: 100 });

      const store = createShortSellingStore({
        stocks: [stock, collateralStock],
        holdings: [
          { symbol: 'AAPL', shares: 10, avgBuyPrice: 90 },
          { symbol: 'COLLATERAL', shares: 1000, avgBuyPrice: 100 },
        ],
        floats: { AAPL: createMockFloat('AAPL', 1000000) },
      });

      const { container } = render(
        <Provider store={store}>
          <MultiStockChart
            {...defaultProps}
            stocks={[stock, collateralStock]}
            holdings={[
              { symbol: 'AAPL', shares: 10, avgBuyPrice: 90 },
              { symbol: 'COLLATERAL', shares: 1000, avgBuyPrice: 100 },
            ]}
            onTrade={onTrade}
          />
        </Provider>
      );

      // Get short buttons in grid view (icon only)
      const shortButtons = container.querySelectorAll('.multi-stock-chart__action-btn--short');
      expect(shortButtons.length).toBeGreaterThan(0);

      fireEvent.click(shortButtons[0]); // Click first short button (AAPL)
      expect(onTrade).toHaveBeenCalledWith('AAPL', 'shortSell');
    });
  });

  describe('chart height behavior', () => {
    it('should use taller charts (220px) when 4 or fewer stocks in portfolio', () => {
      const stocks = [
        createMockStock('AAPL'),
        createMockStock('MSFT'),
        createMockStock('GOOGL'),
        createMockStock('AMZN'),
      ];
      const holdings = stocks.map(s => createMockHolding(s.symbol));

      renderWithStore({ ...defaultProps, stocks, holdings });

      const charts = screen.getAllByTestId('candlestick-chart');
      charts.forEach(chart => {
        expect(chart).toHaveAttribute('data-height', '220');
      });
    });

    it('should use shorter charts (180px) when more than 4 stocks in portfolio', () => {
      const stocks = [
        createMockStock('AAPL'),
        createMockStock('MSFT'),
        createMockStock('GOOGL'),
        createMockStock('AMZN'),
        createMockStock('META'),
      ];
      const holdings = stocks.map(s => createMockHolding(s.symbol));

      renderWithStore({ ...defaultProps, stocks, holdings });

      const charts = screen.getAllByTestId('candlestick-chart');
      charts.forEach(chart => {
        expect(chart).toHaveAttribute('data-height', '180');
      });
    });

    it('should cap grid count class at 6', () => {
      const stocks = [
        createMockStock('AAPL'),
        createMockStock('MSFT'),
        createMockStock('GOOGL'),
        createMockStock('AMZN'),
        createMockStock('META'),
        createMockStock('NFLX'),
        createMockStock('TSLA'),
        createMockStock('NVDA'),
      ];
      const holdings = stocks.map(s => createMockHolding(s.symbol));

      const { container } = renderWithStore({ ...defaultProps, stocks, holdings });

      // Grid class should be capped at 6, not 8
      expect(container.querySelector('.multi-stock-chart__grid.multi-stock-chart__grid--count-6')).toBeInTheDocument();
    });
  });

  describe('theme prop', () => {
    it('should pass light theme to candlestick chart', () => {
      const stock = createMockStock('AAPL');

      renderWithStore({
        ...defaultProps,
        stocks: [stock],
        selectedStock: 'AAPL',
        theme: 'light',
      } as typeof defaultProps & { theme: 'light' });

      const chart = screen.getByTestId('candlestick-chart');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('sector display', () => {
    it('should display sector badge with correct class', () => {
      const stock = createMockStock('AAPL', { sector: 'finance' });

      const { container } = renderWithStore({
        ...defaultProps,
        stocks: [stock],
        selectedStock: 'AAPL',
      });

      const sectorBadge = container.querySelector('.multi-stock-chart__card-sector--finance');
      expect(sectorBadge).toBeInTheDocument();
    });
  });
});
