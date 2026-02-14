import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortfolioOrders } from './PortfolioOrders';
import type { PendingOrder } from '../types';

describe('PortfolioOrders', () => {
  const mockPendingOrders: PendingOrder[] = [
    {
      id: 'order-1',
      symbol: 'AAPL',
      type: 'buy',
      shares: 10,
      orderType: 'market',
      orderPrice: 150,
      remainingCycles: 3,
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
      remainingCycles: 1,
      timestamp: Date.now(),
    },
  ];

  const mockOnCancelOrder = vi.fn();
  const mockOnEditOrder = vi.fn();

  const defaultProps = {
    pendingOrders: [] as PendingOrder[],
    failedOrderIds: [] as string[],
    onCancelOrder: mockOnCancelOrder,
    onEditOrder: mockOnEditOrder,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should display orders section title', () => {
      render(<PortfolioOrders {...defaultProps} />);

      expect(screen.getByText('Aufträge')).toBeInTheDocument();
    });

    it('should display "keine offenen Vorgänge" when no orders', () => {
      render(<PortfolioOrders {...defaultProps} pendingOrders={[]} />);

      expect(screen.getByText('keine offenen Vorgänge')).toBeInTheDocument();
    });

    it('should display pending orders when they exist', () => {
      render(<PortfolioOrders {...defaultProps} pendingOrders={mockPendingOrders} />);

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });
  });

  describe('order types', () => {
    it('should display buy order with KAUF label', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
        />
      );

      expect(screen.getByText('KAUF')).toBeInTheDocument();
    });

    it('should display sell order with VERKAUF label', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[1]]}
        />
      );

      expect(screen.getByText('VERKAUF')).toBeInTheDocument();
    });

    it('should display order type name', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
        />
      );

      // Market order for buy
      expect(screen.getByText('Billigst')).toBeInTheDocument();
    });
  });

  describe('order details', () => {
    it('should display order details with shares and price', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
        />
      );

      // 10 shares at $150
      expect(screen.getByText('10 × $150,00')).toBeInTheDocument();
      expect(screen.getByText('$1.500,00')).toBeInTheDocument();
    });

    it('should display remaining cycles for pending limit orders', () => {
      // Use limit order with remainingCycles > 1 to show "X Handelszyklen"
      const limitOrder = { ...mockPendingOrders[1], remainingCycles: 3 };
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[limitOrder]}
        />
      );

      expect(screen.getByText('3 Handelszyklen')).toBeInTheDocument();
    });

    it('should display "1 Handelszyklus" when remainingCycles is 1 (limit order)', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[1]]}
        />
      );

      expect(screen.getByText('1 Handelszyklus')).toBeInTheDocument();
    });

    it('should display "Nächster Zyklus" when remainingCycles is 0 (market orders)', () => {
      const marketOrder: PendingOrder = {
        id: 'order-market-0',
        symbol: 'GS',
        type: 'buyToCover',
        shares: 100,
        orderType: 'market',
        orderPrice: 542,
        remainingCycles: 0,
        timestamp: Date.now(),
        isNew: false,
      };
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[marketOrder]}
        />
      );

      expect(screen.getByText('Nächster Zyklus')).toBeInTheDocument();
      expect(screen.queryByText('0 Handelszyklen')).not.toBeInTheDocument();
    });

    it('should display "Nächster Zyklus" when remainingCycles is 1 for market orders (shortSell, buyToCover)', () => {
      const shortSellOrder: PendingOrder = {
        id: 'order-short-1',
        symbol: 'AAPL',
        type: 'shortSell',
        shares: 5565,
        orderType: 'market',
        orderPrice: 167.99,
        remainingCycles: 1,
        timestamp: Date.now(),
        isNew: false,
      };
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[shortSellOrder]}
        />
      );

      expect(screen.getByText('Nächster Zyklus')).toBeInTheDocument();
      expect(screen.queryByText('1 Handelszyklus')).not.toBeInTheDocument();
    });

    it('should display "(erstellt)" for new market orders', () => {
      const newMarketOrder = {
        ...mockPendingOrders[0], // market order
        isNew: true,
      };
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[newMarketOrder]}
        />
      );

      expect(screen.getByText('(erstellt)')).toBeInTheDocument();
    });

    it('should display "(erstellt) X Handelszyklen" for new limit orders', () => {
      const newLimitOrder = {
        ...mockPendingOrders[1], // limit order
        remainingCycles: 4,
        isNew: true,
      };
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[newLimitOrder]}
        />
      );

      expect(screen.getByText('(erstellt) 4 Handelszyklen')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onCancelOrder when cancel button is clicked', () => {
      // Use a new market order (can still be cancelled)
      const newMarketOrder = { ...mockPendingOrders[0], isNew: true };
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[newMarketOrder]}
        />
      );

      const cancelButton = screen.getByTitle('Order stornieren');
      fireEvent.click(cancelButton);

      expect(mockOnCancelOrder).toHaveBeenCalledWith('order-1');
    });

    it('should call onEditOrder when edit button is clicked', () => {
      // Use a new market order (can still be edited)
      const newMarketOrder = { ...mockPendingOrders[0], isNew: true };
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[newMarketOrder]}
        />
      );

      const editButton = screen.getByTitle('Order bearbeiten');
      fireEvent.click(editButton);

      expect(mockOnEditOrder).toHaveBeenCalledWith(newMarketOrder);
    });

    it('should display action buttons for limit orders', () => {
      // Limit orders can always be edited/cancelled
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[1]]}
        />
      );

      expect(screen.getByTitle('Order stornieren')).toBeInTheDocument();
      expect(screen.getByTitle('Order bearbeiten')).toBeInTheDocument();
    });

    it('should always show action buttons for market orders', () => {
      // Market orders can always be edited/cancelled while pending
      const marketOrder = { ...mockPendingOrders[0], isNew: false };
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[marketOrder]}
        />
      );

      // Action buttons should always be shown for pending orders
      expect(screen.getByTitle('Order stornieren')).toBeInTheDocument();
      expect(screen.getByTitle('Order bearbeiten')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should apply buy class to buy orders', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
        />
      );

      const orderRow = screen.getByText('AAPL').closest('.portfolio-orders__row');
      expect(orderRow).toHaveClass('portfolio__list-item--border-positive');
    });

    it('should apply sell class to sell orders', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[1]]}
        />
      );

      const orderRow = screen.getByText('GOOGL').closest('.portfolio-orders__row');
      expect(orderRow).toHaveClass('portfolio__list-item--border-negative');
    });

    it('should apply failed class to failed orders', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
          failedOrderIds={['order-1']}
        />
      );

      const orderRow = screen.getByText('AAPL').closest('.portfolio-orders__row');
      expect(orderRow).toHaveClass('portfolio-orders__row--failed');
    });

    it('should not apply failed class to non-failed orders', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
          failedOrderIds={['other-order']}
        />
      );

      const orderRow = screen.getByText('AAPL').closest('.portfolio-orders__row');
      expect(orderRow).not.toHaveClass('portfolio-orders__row--failed');
    });
  });

  describe('failed orders', () => {
    it('should display "nicht ausgeführt" for failed orders', () => {
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[mockPendingOrders[0]]}
          failedOrderIds={['order-1']}
        />
      );

      expect(screen.getByText('nicht ausgeführt')).toBeInTheDocument();
    });

    it('should display normal cycle text for non-failed orders', () => {
      const orderWithCycles = { ...mockPendingOrders[1], remainingCycles: 3 };
      render(
        <PortfolioOrders
          {...defaultProps}
          pendingOrders={[orderWithCycles]}
          failedOrderIds={[]}
        />
      );

      expect(screen.getByText('3 Handelszyklen')).toBeInTheDocument();
      expect(screen.queryByText('nicht ausgeführt')).not.toBeInTheDocument();
    });
  });
});
