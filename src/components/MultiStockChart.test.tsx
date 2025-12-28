import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiStockChart } from './MultiStockChart';
import type { Stock, PortfolioItem } from '../types';

// Mock CandlestickChart
vi.mock('./CandlestickChart', () => ({
  default: vi.fn(({ data, height, compact, autoHeight }) => (
    <div data-testid="candlestick-chart" data-height={height} data-compact={compact} data-autoheight={autoHeight}>
      Chart with {data.length} data points
    </div>
  )),
}));

describe('MultiStockChart', () => {
  const createMockStock = (symbol: string, overrides: Partial<Stock> = {}): Stock => ({
    symbol,
    name: `${symbol} Inc.`,
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

  describe('empty state', () => {
    it('should show empty message when no holdings', () => {
      render(<MultiStockChart {...defaultProps} stocks={[createMockStock('AAPL')]} />);

      expect(screen.getByText('Keine Aktien im Portfolio')).toBeInTheDocument();
      expect(screen.getByText(/Klicken Sie auf eine Aktie/)).toBeInTheDocument();
    });

    it('should show not found message when selected stock does not exist', () => {
      render(<MultiStockChart {...defaultProps} selectedStock="INVALID" />);

      expect(screen.getByText('Aktie nicht gefunden')).toBeInTheDocument();
    });
  });

  describe('selected stock view', () => {
    it('should show single stock chart when stock is selected', () => {
      const stock = createMockStock('AAPL');
      render(
        <MultiStockChart
          {...defaultProps}
          stocks={[stock]}
          selectedStock="AAPL"
        />
      );

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('AAPL Inc.')).toBeInTheDocument();
      expect(screen.getByTestId('candlestick-chart')).toBeInTheDocument();
    });

    it('should show holding info when user owns the selected stock', () => {
      const stock = createMockStock('AAPL');
      const holding = createMockHolding('AAPL', { shares: 25, avgBuyPrice: 85 });

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={[stock]}
          holdings={[holding]}
          selectedStock="AAPL"
        />
      );

      expect(screen.getByText(/25 Stk. @ \$85,00/)).toBeInTheDocument();
    });

    it('should show positive price change with correct styling', () => {
      const stock = createMockStock('AAPL', { change: 5, changePercent: 5.26 });

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={[stock]}
          selectedStock="AAPL"
        />
      );

      const priceElement = screen.getByText(/\$100,00/).closest('.multi-stock-chart__card-price');
      expect(priceElement).toHaveClass('positive');
    });

    it('should show negative price change with correct styling', () => {
      const stock = createMockStock('AAPL', { change: -5, changePercent: -5.0 });

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={[stock]}
          selectedStock="AAPL"
        />
      );

      const priceElement = screen.getByText(/\$100,00/).closest('.multi-stock-chart__card-price');
      expect(priceElement).toHaveClass('negative');
    });

    it('should call onSelectStock when clicking selected stock card', () => {
      const onSelectStock = vi.fn();
      const stock = createMockStock('AAPL');

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={[stock]}
          selectedStock="AAPL"
          onSelectStock={onSelectStock}
        />
      );

      fireEvent.click(screen.getByText('AAPL').closest('.multi-stock-chart__card')!);
      expect(onSelectStock).toHaveBeenCalledWith('AAPL');
    });

    it('should use autoHeight for selected stock chart', () => {
      const stock = createMockStock('AAPL');

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={[stock]}
          selectedStock="AAPL"
        />
      );

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

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={stocks}
          holdings={holdings}
        />
      );

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

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={stocks}
          holdings={holdings}
        />
      );

      expect(screen.getByText(/42 Stk. @ \$85,00/)).toBeInTheDocument();
    });

    it('should show profit/loss for each holding', () => {
      const stocks = [createMockStock('AAPL', { currentPrice: 100 })];
      const holdings = [createMockHolding('AAPL', { shares: 10, avgBuyPrice: 90 })];
      // P/L = (100 - 90) * 10 = $100

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={stocks}
          holdings={holdings}
        />
      );

      expect(screen.getByText(/\+\$100,00/)).toBeInTheDocument();
    });

    it('should show negative profit/loss with correct styling', () => {
      const stocks = [createMockStock('AAPL', { currentPrice: 80 })];
      const holdings = [createMockHolding('AAPL', { shares: 10, avgBuyPrice: 100 })];
      // P/L = (80 - 100) * 10 = -$200

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={stocks}
          holdings={holdings}
        />
      );

      // The format is "$-200,00" (dollar sign before minus)
      const pnlElement = screen.getByText(/\$-200,00/).closest('.multi-stock-chart__card-pnl');
      expect(pnlElement).toHaveClass('multi-stock-chart__card-pnl--negative');
    });

    it('should call onSelectStock when clicking a stock card', () => {
      const onSelectStock = vi.fn();
      const stocks = [createMockStock('AAPL')];
      const holdings = [createMockHolding('AAPL')];

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={stocks}
          holdings={holdings}
          onSelectStock={onSelectStock}
        />
      );

      fireEvent.click(screen.getByText('AAPL').closest('.multi-stock-chart__card')!);
      expect(onSelectStock).toHaveBeenCalledWith('AAPL');
    });

    it('should use autoHeight when only one stock in portfolio', () => {
      const stocks = [createMockStock('AAPL')];
      const holdings = [createMockHolding('AAPL')];

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={stocks}
          holdings={holdings}
        />
      );

      const chart = screen.getByTestId('candlestick-chart');
      expect(chart).toHaveAttribute('data-autoheight', 'true');
    });

    it('should use compact mode when multiple stocks in portfolio', () => {
      const stocks = [createMockStock('AAPL'), createMockStock('MSFT')];
      const holdings = [createMockHolding('AAPL'), createMockHolding('MSFT')];

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={stocks}
          holdings={holdings}
        />
      );

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

      const { container } = render(
        <MultiStockChart
          {...defaultProps}
          stocks={stocks}
          holdings={holdings}
        />
      );

      expect(container.querySelector('.multi-stock-chart__grid.multi-stock-chart__grid--count-3')).toBeInTheDocument();
    });

    it('should only show stocks that user owns', () => {
      const stocks = [
        createMockStock('AAPL'),
        createMockStock('MSFT'),
        createMockStock('GOOGL'),
      ];
      const holdings = [createMockHolding('AAPL')]; // Only owns AAPL

      render(
        <MultiStockChart
          {...defaultProps}
          stocks={stocks}
          holdings={holdings}
        />
      );

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
      expect(screen.queryByText('GOOGL')).not.toBeInTheDocument();
    });
  });
});
