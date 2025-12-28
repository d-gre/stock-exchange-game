import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StockList } from './StockList';
import type { Stock } from '../types';

describe('StockList', () => {
  const mockStocks: Stock[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      currentPrice: 100,
      change: 2.5,
      changePercent: 2.56,
      priceHistory: [
        { time: 1, open: 95, high: 100, low: 94, close: 98 },  // up
        { time: 2, open: 98, high: 99, low: 96, close: 97 },   // down
        { time: 3, open: 97, high: 100, low: 97, close: 100 }, // up
        { time: 4, open: 100, high: 101, low: 99, close: 100 }, // neutral
        { time: 5, open: 100, high: 102, low: 99, close: 101 }, // up
      ],
      marketCapBillions: 3000,
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      currentPrice: 200,
      change: -5,
      changePercent: -2.44,
      priceHistory: [
        { time: 1, open: 200, high: 205, low: 198, close: 195 }, // down
        { time: 2, open: 195, high: 196, low: 190, close: 192 }, // down
        { time: 3, open: 192, high: 195, low: 191, close: 194 }, // up
        { time: 4, open: 194, high: 195, low: 190, close: 190 }, // down
        { time: 5, open: 190, high: 192, low: 188, close: 189 }, // down
      ],
      marketCapBillions: 2000,
    },
  ];

  const mockOnSelectStock = vi.fn();

  const defaultProps = {
    stocks: mockStocks,
    selectedStock: '',
    onSelectStock: mockOnSelectStock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all stocks', () => {
      render(<StockList {...defaultProps} />);

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });

    it('should display stock prices', () => {
      render(<StockList {...defaultProps} />);

      expect(screen.getByText('$100.00')).toBeInTheDocument();
      expect(screen.getByText('$200.00')).toBeInTheDocument();
    });

    it('should show stock name as tooltip on symbol', () => {
      render(<StockList {...defaultProps} />);

      const aaplSymbol = screen.getByText('AAPL');
      expect(aaplSymbol).toHaveAttribute('title', 'Apple Inc.');
    });

    it('should highlight selected stock', () => {
      render(<StockList {...defaultProps} selectedStock="AAPL" />);

      const aaplRow = screen.getByText('AAPL').closest('.stock-list__row');
      expect(aaplRow).toHaveClass('stock-list__row--selected');
    });

    it('should display positive change with green color class', () => {
      render(<StockList {...defaultProps} />);

      const aaplChange = screen.getByText(/\+2\.6%/);
      expect(aaplChange).toHaveClass('stock-list__change--positive');
    });

    it('should display negative change with red color class', () => {
      render(<StockList {...defaultProps} />);

      const googlChange = screen.getByText(/-2\.4%/);
      expect(googlChange).toHaveClass('stock-list__change--negative');
    });

    it('should render header with column labels', () => {
      render(<StockList {...defaultProps} />);

      expect(screen.getByText('Symbol')).toBeInTheDocument();
      expect(screen.getByText('Preis')).toBeInTheDocument();
      expect(screen.getByText('Änd.')).toBeInTheDocument();
      expect(screen.getByText('MCap')).toBeInTheDocument();
      expect(screen.getByText('Trend')).toBeInTheDocument();
    });

    it('should display market cap in trillions for large cap stocks', () => {
      render(<StockList {...defaultProps} />);

      // 3000B = 3.0T, 2000B = 2.0T
      expect(screen.getByText('$3.0T')).toBeInTheDocument();
      expect(screen.getByText('$2.0T')).toBeInTheDocument();
    });

    it('should display market cap in billions for smaller values', () => {
      const smallCapStocks: Stock[] = [
        { ...mockStocks[0], marketCapBillions: 500 },
        { ...mockStocks[1], marketCapBillions: 250 },
      ];
      render(<StockList {...defaultProps} stocks={smallCapStocks} />);

      expect(screen.getByText('$500B')).toBeInTheDocument();
      expect(screen.getByText('$250B')).toBeInTheDocument();
    });

    it('should render mini trend bars', () => {
      const { container } = render(<StockList {...defaultProps} />);

      const trendContainers = container.querySelectorAll('.stock-list__mini-trend');
      expect(trendContainers).toHaveLength(2);

      // Each stock should have 5 trend bars
      const aaplRow = screen.getByText('AAPL').closest('.stock-list__row');
      const aaplTrendBars = aaplRow?.querySelectorAll('.stock-list__trend-bar');
      expect(aaplTrendBars).toHaveLength(5);
    });

    it('should show correct trend bar classes based on candle direction', () => {
      render(<StockList {...defaultProps} />);

      // AAPL trend: up, down, up, neutral, up
      const aaplRow = screen.getByText('AAPL').closest('.stock-list__row');
      const aaplTrendBars = aaplRow?.querySelectorAll('.stock-list__trend-bar');

      expect(aaplTrendBars?.[0]).toHaveClass('stock-list__trend-bar--up');
      expect(aaplTrendBars?.[1]).toHaveClass('stock-list__trend-bar--down');
      expect(aaplTrendBars?.[2]).toHaveClass('stock-list__trend-bar--up');
      expect(aaplTrendBars?.[3]).toHaveClass('stock-list__trend-bar--neutral');
      expect(aaplTrendBars?.[4]).toHaveClass('stock-list__trend-bar--up');
    });
  });

  describe('interactions', () => {
    it('should call onSelectStock when clicking a stock row', () => {
      render(<StockList {...defaultProps} />);

      const aaplRow = screen.getByText('AAPL').closest('.stock-list__row')!;
      fireEvent.click(aaplRow);

      expect(mockOnSelectStock).toHaveBeenCalledWith('AAPL');
    });

    it('should call onSelectStock with correct symbol for different stocks', () => {
      render(<StockList {...defaultProps} />);

      const googlRow = screen.getByText('GOOGL').closest('.stock-list__row')!;
      fireEvent.click(googlRow);

      expect(mockOnSelectStock).toHaveBeenCalledWith('GOOGL');
    });
  });

  describe('sorting', () => {
    it('should sort stocks alphabetically by symbol', () => {
      const unsortedStocks: Stock[] = [
        { ...mockStocks[1] }, // GOOGL
        { ...mockStocks[0] }, // AAPL
      ];

      render(<StockList {...defaultProps} stocks={unsortedStocks} />);

      const rows = screen.getAllByText(/AAPL|GOOGL/);
      expect(rows[0]).toHaveTextContent('AAPL');
      expect(rows[1]).toHaveTextContent('GOOGL');
    });
  });
});
