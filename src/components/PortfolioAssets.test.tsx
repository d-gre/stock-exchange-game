import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortfolioAssets } from './PortfolioAssets';
import type { PortfolioItem, Stock } from '../types';

describe('PortfolioAssets', () => {
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

  const mockHoldings: PortfolioItem[] = [
    { symbol: 'AAPL', shares: 10, avgBuyPrice: 100 },
    { symbol: 'GOOGL', shares: 5, avgBuyPrice: 180 },
  ];

  const mockOnSelectStock = vi.fn();

  const defaultProps = {
    holdings: mockHoldings,
    stocks: mockStocks,
    selectedStock: '',
    onSelectStock: mockOnSelectStock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should display holdings title', () => {
      render(<PortfolioAssets {...defaultProps} />);

      expect(screen.getByText('Assets')).toBeInTheDocument();
    });

    it('should display holdings', () => {
      render(<PortfolioAssets {...defaultProps} />);

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });

    it('should display "keine Aktien im Depot" when no holdings', () => {
      render(<PortfolioAssets {...defaultProps} holdings={[]} />);

      expect(screen.getByText('keine Aktien im Depot')).toBeInTheDocument();
    });

    it('should display table headers', () => {
      render(<PortfolioAssets {...defaultProps} />);

      expect(screen.getByText('Symbol')).toBeInTheDocument();
      expect(screen.getByText('Anz.')).toBeInTheDocument();
      expect(screen.getByText('Kauf')).toBeInTheDocument();
      expect(screen.getByText('Aktuell')).toBeInTheDocument();
      expect(screen.getByText('G/V')).toBeInTheDocument();
    });

    it('should show stock name as tooltip', () => {
      render(<PortfolioAssets {...defaultProps} />);

      const aaplSymbol = screen.getByText('AAPL');
      expect(aaplSymbol).toHaveAttribute('title', 'Apple Inc.');
    });
  });

  describe('selection', () => {
    it('should highlight selected stock', () => {
      render(<PortfolioAssets {...defaultProps} selectedStock="AAPL" />);

      const aaplRow = screen.getByText('AAPL').closest('.portfolio-assets__row');
      expect(aaplRow).toHaveClass('portfolio-assets__row--selected');

      const googlRow = screen.getByText('GOOGL').closest('.portfolio-assets__row');
      expect(googlRow).not.toHaveClass('portfolio-assets__row--selected');
    });

    it('should call onSelectStock when clicking a holding', () => {
      render(<PortfolioAssets {...defaultProps} />);

      const googlRow = screen.getByText('GOOGL').closest('.portfolio-assets__row')!;
      fireEvent.click(googlRow);

      expect(mockOnSelectStock).toHaveBeenCalledWith('GOOGL');
    });

    it('should call onSelectStock with correct symbol for each holding', () => {
      render(<PortfolioAssets {...defaultProps} />);

      const aaplRow = screen.getByText('AAPL').closest('.portfolio-assets__row')!;
      fireEvent.click(aaplRow);
      expect(mockOnSelectStock).toHaveBeenCalledWith('AAPL');

      mockOnSelectStock.mockClear();

      const googlRow = screen.getByText('GOOGL').closest('.portfolio-assets__row')!;
      fireEvent.click(googlRow);
      expect(mockOnSelectStock).toHaveBeenCalledWith('GOOGL');
    });
  });

  describe('profit/loss display', () => {
    it('should show positive profit/loss with correct class', () => {
      render(<PortfolioAssets {...defaultProps} />);

      // AAPL: bought at 100, now 150 = +50%
      const aaplRow = screen.getByText('AAPL').closest('.portfolio-assets__row')!;
      const profitLoss = aaplRow.querySelector('.portfolio-assets__pl');
      expect(profitLoss).toHaveClass('portfolio-assets__pl--positive');
      expect(profitLoss?.textContent).toContain('+');
    });

    it('should show negative profit/loss with correct class', () => {
      const holdingsWithLoss: PortfolioItem[] = [
        { symbol: 'GOOGL', shares: 5, avgBuyPrice: 250 },
      ];

      render(<PortfolioAssets {...defaultProps} holdings={holdingsWithLoss} />);

      // GOOGL: bought at 250, now 200 = -20%
      const googlRow = screen.getByText('GOOGL').closest('.portfolio-assets__row')!;
      const profitLoss = googlRow.querySelector('.portfolio-assets__pl');
      expect(profitLoss).toHaveClass('portfolio-assets__pl--negative');
    });
  });

  describe('sorting', () => {
    it('should sort holdings alphabetically', () => {
      const unsortedHoldings: PortfolioItem[] = [
        { symbol: 'GOOGL', shares: 5, avgBuyPrice: 180 },
        { symbol: 'AAPL', shares: 10, avgBuyPrice: 100 },
      ];

      render(<PortfolioAssets {...defaultProps} holdings={unsortedHoldings} />);

      const rows = screen.getAllByText(/^(AAPL|GOOGL)$/);
      expect(rows[0]).toHaveTextContent('AAPL');
      expect(rows[1]).toHaveTextContent('GOOGL');
    });
  });
});
