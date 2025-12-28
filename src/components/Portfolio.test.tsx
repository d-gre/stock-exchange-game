import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Portfolio } from './Portfolio';
import type { Portfolio as PortfolioType, Stock, PendingOrder } from '../types';

describe('Portfolio', () => {
  const mockStocks: Stock[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      currentPrice: 150,
      change: 5,
      changePercent: 3.45,
      priceHistory: [],
      marketCapBillions: 3000,
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
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

  const mockOnSelectStock = vi.fn();
  const mockOnCancelOrder = vi.fn();
  const mockOnEditOrder = vi.fn();

  const defaultProps = {
    portfolio: mockPortfolio,
    stocks: mockStocks,
    selectedStock: 'AAPL',
    pendingOrders: [] as PendingOrder[],
    reservedCash: 0,
    onSelectStock: mockOnSelectStock,
    onCancelOrder: mockOnCancelOrder,
    onEditOrder: mockOnEditOrder,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should display portfolio summary with available cash', () => {
      render(<Portfolio {...defaultProps} />);

      expect(screen.getByText('Verfügbar:')).toBeInTheDocument();
      expect(screen.getByText(/5\.000,00/)).toBeInTheDocument();
    });

    it('should display holdings', () => {
      render(<Portfolio {...defaultProps} />);

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });

    it('should display "keine Aktien im Depot" when no holdings', () => {
      render(
        <Portfolio
          {...defaultProps}
          portfolio={{ cash: 10000, holdings: [] }}
        />
      );

      expect(screen.getByText('keine Aktien im Depot')).toBeInTheDocument();
    });

    it('should highlight selected stock', () => {
      render(<Portfolio {...defaultProps} selectedStock="AAPL" />);

      const aaplRow = screen.getByText('AAPL').closest('.portfolio__holdings-row');
      expect(aaplRow).toHaveClass('portfolio__holdings-row--selected');

      const googlRow = screen.getByText('GOOGL').closest('.portfolio__holdings-row');
      expect(googlRow).not.toHaveClass('portfolio__holdings-row--selected');
    });
  });

  describe('reserved cash', () => {
    it('should show available cash minus reserved cash', () => {
      render(
        <Portfolio
          {...defaultProps}
          portfolio={{ cash: 5000, holdings: [] }}
          reservedCash={1500}
        />
      );

      // Available should show 5000 - 1500 = 3500
      expect(screen.getByText('Verfügbar:')).toBeInTheDocument();
      expect(screen.getByText('$3.500,00')).toBeInTheDocument();
    });

    it('should display reserved cash when greater than zero', () => {
      render(
        <Portfolio
          {...defaultProps}
          reservedCash={1500}
        />
      );

      expect(screen.getByText('Reserviert:')).toBeInTheDocument();
      expect(screen.getByText('$1.500,00')).toBeInTheDocument();
    });

    it('should not display reserved cash when zero', () => {
      render(
        <Portfolio
          {...defaultProps}
          reservedCash={0}
        />
      );

      expect(screen.queryByText('Reserviert:')).not.toBeInTheDocument();
    });
  });

  describe('pending orders', () => {
    const mockPendingOrders: PendingOrder[] = [
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
      {
        id: 'order-2',
        symbol: 'GOOGL',
        type: 'sell',
        shares: 5,
        orderType: 'limit',
        limitPrice: 200,
        orderPrice: 200,
        remainingCycles: 0,
        timestamp: Date.now(),
      },
    ];

    it('should display pending orders section when orders exist', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={mockPendingOrders}
        />
      );

      expect(screen.getByText('Orders')).toBeInTheDocument();
    });

    it('should display "keine offenen Vorgänge" when no orders', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={[]}
        />
      );

      expect(screen.getByText('keine offenen Vorgänge')).toBeInTheDocument();
    });

    it('should display buy order with KAUF label', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
        />
      );

      expect(screen.getByText('KAUF')).toBeInTheDocument();
    });

    it('should display sell order with VERKAUF label', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={[mockPendingOrders[1]]}
        />
      );

      expect(screen.getByText('VERKAUF')).toBeInTheDocument();
    });

    it('should display remaining cycles for pending orders', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
        />
      );

      expect(screen.getByText('1 Handelszyklen')).toBeInTheDocument();
    });

    it('should display "Nächster Zyklus" when remainingCycles is 0', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={[mockPendingOrders[1]]}
        />
      );

      expect(screen.getByText('Nächster Zyklus')).toBeInTheDocument();
    });

    it('should display order details with shares and price', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
        />
      );

      // 10 shares at $150
      expect(screen.getByText('10 × $150,00')).toBeInTheDocument();
      expect(screen.getByText('$1.500,00')).toBeInTheDocument();
    });

    it('should call onCancelOrder when cancel button is clicked', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
        />
      );

      const cancelButton = screen.getByTitle('Order stornieren');
      fireEvent.click(cancelButton);

      expect(mockOnCancelOrder).toHaveBeenCalledWith('order-1');
    });

    it('should call onEditOrder when edit button is clicked', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
        />
      );

      const editButton = screen.getByTitle('Order bearbeiten');
      fireEvent.click(editButton);

      expect(mockOnEditOrder).toHaveBeenCalledWith(mockPendingOrders[0]);
    });

    it('should display multiple pending orders', () => {
      render(
        <Portfolio
          {...defaultProps}
          pendingOrders={mockPendingOrders}
        />
      );

      expect(screen.getByText('KAUF')).toBeInTheDocument();
      expect(screen.getByText('VERKAUF')).toBeInTheDocument();
      expect(screen.getAllByTitle('Order stornieren')).toHaveLength(2);
      expect(screen.getAllByTitle('Order bearbeiten')).toHaveLength(2);
    });
  });

  describe('interactions', () => {
    it('should call onSelectStock when clicking a holding', () => {
      render(<Portfolio {...defaultProps} selectedStock="AAPL" />);

      const googlRow = screen.getByText('GOOGL').closest('.portfolio__holdings-row')!;
      fireEvent.click(googlRow);

      expect(mockOnSelectStock).toHaveBeenCalledWith('GOOGL');
    });

    it('should call onSelectStock with correct symbol for each holding', () => {
      render(<Portfolio {...defaultProps} selectedStock="" />);

      const aaplRow = screen.getByText('AAPL').closest('.portfolio__holdings-row')!;
      fireEvent.click(aaplRow);
      expect(mockOnSelectStock).toHaveBeenCalledWith('AAPL');

      mockOnSelectStock.mockClear();

      const googlRow = screen.getByText('GOOGL').closest('.portfolio__holdings-row')!;
      fireEvent.click(googlRow);
      expect(mockOnSelectStock).toHaveBeenCalledWith('GOOGL');
    });
  });

  describe('calculations', () => {
    it('should show stock name as tooltip', () => {
      render(<Portfolio {...defaultProps} />);

      const aaplSymbol = screen.getByText('AAPL');
      expect(aaplSymbol).toHaveAttribute('title', 'Apple Inc.');
    });

    it('should show positive profit/loss with correct class', () => {
      render(<Portfolio {...defaultProps} selectedStock="" />);

      // AAPL: bought at 100, now 150 = +50%
      const aaplRow = screen.getByText('AAPL').closest('.portfolio__holdings-row')!;
      const profitLoss = aaplRow.querySelector('.portfolio__holdings-pl');
      expect(profitLoss).toHaveClass('portfolio__holdings-pl--positive');
      expect(profitLoss?.textContent).toContain('+');
    });

    it('should show negative profit/loss with correct class', () => {
      const portfolioWithLoss: PortfolioType = {
        cash: 5000,
        holdings: [{ symbol: 'GOOGL', shares: 5, avgBuyPrice: 250 }],
      };

      render(
        <Portfolio
          {...defaultProps}
          portfolio={portfolioWithLoss}
          selectedStock=""
        />
      );

      // GOOGL: bought at 250, now 200 = -20%
      const googlRow = screen.getByText('GOOGL').closest('.portfolio__holdings-row')!;
      const profitLoss = googlRow.querySelector('.portfolio__holdings-pl');
      expect(profitLoss).toHaveClass('portfolio__holdings-pl--negative');
    });
  });
});
