import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StockList } from './StockList';
import type { Stock } from '../types';

describe('StockList', () => {
  const mockStocks: Stock[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'tech',
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
      sector: 'tech',
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
    {
      symbol: 'JPM',
      name: 'JPMorgan Chase',
      sector: 'finance',
      currentPrice: 150,
      change: 1.0,
      changePercent: 0.67,
      priceHistory: [
        { time: 1, open: 148, high: 150, low: 147, close: 149 },
        { time: 2, open: 149, high: 151, low: 148, close: 150 },
        { time: 3, open: 150, high: 152, low: 149, close: 151 },
        { time: 4, open: 151, high: 152, low: 150, close: 150 },
        { time: 5, open: 150, high: 151, low: 149, close: 150 },
      ],
      marketCapBillions: 600,
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
      expect(screen.getByText('JPM')).toBeInTheDocument();
    });

    it('should display stock prices', () => {
      render(<StockList {...defaultProps} />);

      // Format: "$X,XX" with German locale (de-DE uses comma as decimal separator)
      expect(screen.getByText('$100,00')).toBeInTheDocument();
      expect(screen.getByText('$200,00')).toBeInTheDocument();
      expect(screen.getByText('$150,00')).toBeInTheDocument();
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

      // Format: "+X,X%" with German locale (comma as decimal separator)
      const aaplChange = screen.getByText(/\+2,6%/);
      expect(aaplChange).toHaveClass('stock-list__change--positive');
    });

    it('should display negative change with red color class', () => {
      render(<StockList {...defaultProps} />);

      // Format: "-X,X%" with German locale (comma as decimal separator)
      const googlChange = screen.getByText(/-2,4%/);
      expect(googlChange).toHaveClass('stock-list__change--negative');
    });

    it('should render header with column labels', () => {
      const { container } = render(<StockList {...defaultProps} />);

      // Check header cells specifically (not sort bar buttons)
      const header = container.querySelector('.stock-list__header');
      expect(header).toHaveTextContent('Symbol');
      expect(header).toHaveTextContent('Preis');
      expect(header).toHaveTextContent('Änd.');
      expect(header).toHaveTextContent('Trend');
      expect(header).toHaveTextContent('Grp.');
    });

    it('should display sector tags with correct labels', () => {
      render(<StockList {...defaultProps} />);

      // Tech stocks should show 'T', Finance should show 'F'
      const sectorTags = screen.getAllByText('T');
      expect(sectorTags.length).toBe(2); // AAPL and GOOGL
      expect(screen.getByText('F')).toBeInTheDocument(); // JPM
    });

    it('should render mini trend bars', () => {
      const { container } = render(<StockList {...defaultProps} />);

      const trendContainers = container.querySelectorAll('.stock-list__mini-trend');
      expect(trendContainers).toHaveLength(3);

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
    it('should sort stocks alphabetically by symbol by default', () => {
      const unsortedStocks: Stock[] = [
        { ...mockStocks[1] }, // GOOGL
        { ...mockStocks[0] }, // AAPL
        { ...mockStocks[2] }, // JPM
      ];

      render(<StockList {...defaultProps} stocks={unsortedStocks} />);

      const rows = screen.getAllByText(/AAPL|GOOGL|JPM/);
      expect(rows[0]).toHaveTextContent('AAPL');
      expect(rows[1]).toHaveTextContent('GOOGL');
      expect(rows[2]).toHaveTextContent('JPM');
    });

    it('should toggle sort direction when clicking same column header', () => {
      const { container } = render(<StockList {...defaultProps} />);

      // Click symbol header cell to toggle to descending
      const symbolHeader = container.querySelector('.stock-list__header-cell');
      fireEvent.click(symbolHeader!);

      // Should now be descending (JPM first)
      const rows = screen.getAllByText(/AAPL|GOOGL|JPM/);
      expect(rows[0]).toHaveTextContent('JPM');
    });

    it('should show sort indicator on active column', () => {
      const { container } = render(<StockList {...defaultProps} />);

      // By default, symbol column should show ascending indicator
      const sortIndicator = container.querySelector('.stock-list__sort-indicator');
      expect(sortIndicator).toBeInTheDocument();
      expect(sortIndicator?.textContent).toBe('↑');
    });

    it('should sort by price when clicking price header', () => {
      const { container } = render(<StockList {...defaultProps} />);

      // Click the price header cell (2nd header cell)
      const headerCells = container.querySelectorAll('.stock-list__header-cell');
      fireEvent.click(headerCells[1]); // Price is 2nd column

      // Should be ascending by price (100, 150, 200)
      const rows = screen.getAllByText(/AAPL|GOOGL|JPM/);
      expect(rows[0]).toHaveTextContent('AAPL'); // $100
      expect(rows[1]).toHaveTextContent('JPM');  // $150
      expect(rows[2]).toHaveTextContent('GOOGL'); // $200
    });

    it('should sort by sector when clicking sector header', () => {
      const { container } = render(<StockList {...defaultProps} />);

      // Click the sector header cell (5th header cell)
      const headerCells = container.querySelectorAll('.stock-list__header-cell');
      fireEvent.click(headerCells[4]); // Sector is 5th column

      // Tech (T) comes before Finance (F) in sort order
      const rows = screen.getAllByText(/AAPL|GOOGL|JPM/);
      // First tech stocks, then finance
      expect(rows[0]).toHaveTextContent('AAPL');
      expect(rows[1]).toHaveTextContent('GOOGL');
      expect(rows[2]).toHaveTextContent('JPM');
    });

    it('should render sort bar with all sort buttons', () => {
      const { container } = render(<StockList {...defaultProps} />);

      const sortBar = container.querySelector('.stock-list__sort-bar');
      expect(sortBar).toBeInTheDocument();

      const sortButtons = container.querySelectorAll('.stock-list__sort-btn');
      expect(sortButtons).toHaveLength(5); // Symbol, Price, Change, Trend, Sector
    });

    it('should sort via sort bar buttons', () => {
      const { container } = render(<StockList {...defaultProps} />);

      // Click price sort button (2nd button)
      const sortButtons = container.querySelectorAll('.stock-list__sort-btn');
      fireEvent.click(sortButtons[1]); // Price button

      // Should be ascending by price (100, 150, 200)
      const rows = screen.getAllByText(/AAPL|GOOGL|JPM/);
      expect(rows[0]).toHaveTextContent('AAPL'); // $100
      expect(rows[1]).toHaveTextContent('JPM');  // $150
      expect(rows[2]).toHaveTextContent('GOOGL'); // $200
    });

    it('should mark active sort button', () => {
      const { container } = render(<StockList {...defaultProps} />);

      // By default, symbol button should be active
      const symbolButton = container.querySelector('.stock-list__sort-btn--active');
      expect(symbolButton).toHaveTextContent('Symbol');

      // Click price button
      const sortButtons = container.querySelectorAll('.stock-list__sort-btn');
      fireEvent.click(sortButtons[1]); // Price button

      // Now price button should be active
      const activeButton = container.querySelector('.stock-list__sort-btn--active');
      expect(activeButton).toHaveTextContent('Preis');
    });
  });
});
