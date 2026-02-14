import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioSummary } from './PortfolioSummary';

describe('PortfolioSummary', () => {
  const defaultProps = {
    availableCash: 5000,
    reservedCash: 0,
    totalHoldingsValue: 2500,
    totalDebt: 0,
    totalValue: 7500,
    totalProfitLoss: 500,
  };

  describe('rendering', () => {
    it('should display available cash', () => {
      render(<PortfolioSummary {...defaultProps} />);

      expect(screen.getByText('Verfügbar:')).toBeInTheDocument();
      expect(screen.getByText('$5.000,00')).toBeInTheDocument();
    });

    it('should display stock value', () => {
      render(<PortfolioSummary {...defaultProps} />);

      expect(screen.getByText('Aktienwert:')).toBeInTheDocument();
      expect(screen.getByText('$2.500,00')).toBeInTheDocument();
    });

    it('should display total value', () => {
      render(<PortfolioSummary {...defaultProps} />);

      expect(screen.getByText('Gesamtwert:')).toBeInTheDocument();
      expect(screen.getByText('$7.500,00')).toBeInTheDocument();
    });

    it('should display positive profit/loss with positive class', () => {
      render(<PortfolioSummary {...defaultProps} totalProfitLoss={500} />);

      expect(screen.getByText('Gewinn/Verlust:')).toBeInTheDocument();
      // Check the P/L value element has positive class (color indicates +/-)
      const plValue = document.querySelector('.portfolio-summary__value--positive');
      expect(plValue).toBeInTheDocument();
      expect(plValue?.textContent).toContain('500');
    });

    it('should display negative profit/loss with negative class', () => {
      render(<PortfolioSummary {...defaultProps} totalProfitLoss={-300} />);

      // Check the P/L value element has negative class
      const plValue = document.querySelector('.portfolio-summary__value--negative');
      expect(plValue).toBeInTheDocument();
      expect(plValue?.textContent).toContain('300');
    });
  });

  describe('reserved cash', () => {
    it('should display reserved cash when greater than zero', () => {
      render(<PortfolioSummary {...defaultProps} reservedCash={1500} />);

      expect(screen.getByText('Reserviert:')).toBeInTheDocument();
      expect(screen.getByText('$1.500,00')).toBeInTheDocument();
    });

    it('should not display reserved cash when zero', () => {
      render(<PortfolioSummary {...defaultProps} reservedCash={0} />);

      expect(screen.queryByText('Reserviert:')).not.toBeInTheDocument();
    });
  });

  describe('debt', () => {
    it('should display liabilities when totalDebt is greater than zero', () => {
      render(<PortfolioSummary {...defaultProps} totalDebt={2000} />);

      expect(screen.getByText('Verbindlichkeiten:')).toBeInTheDocument();
      expect(screen.getByText('$-2.000,00')).toBeInTheDocument();
    });

    it('should not display liabilities when totalDebt is zero', () => {
      render(<PortfolioSummary {...defaultProps} totalDebt={0} />);

      expect(screen.queryByText('Verbindlichkeiten:')).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should apply positive class for positive profit/loss', () => {
      render(<PortfolioSummary {...defaultProps} totalProfitLoss={500} />);

      const plValue = screen.getByText('$500,00');
      expect(plValue).toHaveClass('portfolio-summary__value--positive');
    });

    it('should apply negative class for negative profit/loss', () => {
      render(<PortfolioSummary {...defaultProps} totalProfitLoss={-300} />);

      const plValue = screen.getByText('$-300,00');
      expect(plValue).toHaveClass('portfolio-summary__value--negative');
    });

    it('should apply negative class for debt value', () => {
      render(<PortfolioSummary {...defaultProps} totalDebt={1000} />);

      const debtValue = screen.getByText('$-1.000,00');
      expect(debtValue).toHaveClass('portfolio-summary__value--negative');
    });
  });
});
