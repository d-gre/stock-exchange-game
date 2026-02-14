import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Help } from './Help';

describe('Help', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render with correct title', () => {
      render(<Help onClose={mockOnClose} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Willkommen bei D-GRE Stock Exchange');
    });

    it('should render all 5 accordion section titles', () => {
      render(<Help onClose={mockOnClose} />);

      expect(screen.getByText('Spielmechanik')).toBeInTheDocument();
      expect(screen.getByText('Kreditsystem')).toBeInTheDocument();
      expect(screen.getByText('Handel')).toBeInTheDocument();
      expect(screen.getByText('Wirtschaft')).toBeInTheDocument();
      expect(screen.getByText('Tipps für Ihren Erfolg')).toBeInTheDocument();
    });

    it('should render close buttons', () => {
      render(<Help onClose={mockOnClose} />);

      const closeButtons = screen.getAllByRole('button', { name: 'Schließen' });
      expect(closeButtons.length).toBe(2);
    });

    it('should render main close button at bottom', () => {
      render(<Help onClose={mockOnClose} />);

      const mainButton = document.querySelector('.help__button');
      expect(mainButton).toHaveTextContent('Schließen');
    });
  });

  describe('accordion behavior', () => {
    it('should have gameMechanics open by default', () => {
      render(<Help onClose={mockOnClose} />);

      const headers = document.querySelectorAll('.help__accordion-header');
      expect(headers[0].getAttribute('aria-expanded')).toBe('true');
    });

    it('should have other sections closed by default', () => {
      render(<Help onClose={mockOnClose} />);

      const headers = document.querySelectorAll('.help__accordion-header');
      // Sections 2-5 should be closed
      for (let i = 1; i < headers.length; i++) {
        expect(headers[i].getAttribute('aria-expanded')).toBe('false');
      }
    });

    it('should toggle section open on click', () => {
      render(<Help onClose={mockOnClose} />);

      const loansHeader = screen.getByText('Kreditsystem').closest('button')!;
      expect(loansHeader.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(loansHeader);
      expect(loansHeader.getAttribute('aria-expanded')).toBe('true');
    });

    it('should toggle section closed on click', () => {
      render(<Help onClose={mockOnClose} />);

      const mechanicsHeader = screen.getByText('Spielmechanik').closest('button')!;
      expect(mechanicsHeader.getAttribute('aria-expanded')).toBe('true');

      fireEvent.click(mechanicsHeader);
      expect(mechanicsHeader.getAttribute('aria-expanded')).toBe('false');
    });

    it('should allow multiple sections open simultaneously', () => {
      render(<Help onClose={mockOnClose} />);

      const mechanicsHeader = screen.getByText('Spielmechanik').closest('button')!;
      const loansHeader = screen.getByText('Kreditsystem').closest('button')!;

      // gameMechanics is already open, open loans too
      fireEvent.click(loansHeader);

      expect(mechanicsHeader.getAttribute('aria-expanded')).toBe('true');
      expect(loansHeader.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('interactions', () => {
    it('should call onClose when clicking X close button', () => {
      render(<Help onClose={mockOnClose} />);

      const xButton = document.querySelector('.help__close') as HTMLButtonElement;
      fireEvent.click(xButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking main close button', () => {
      render(<Help onClose={mockOnClose} />);

      const mainButton = document.querySelector('.help__button') as HTMLButtonElement;
      fireEvent.click(mainButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking overlay', () => {
      render(<Help onClose={mockOnClose} />);

      const overlay = document.querySelector('.help');
      fireEvent.click(overlay!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when clicking dialog content', () => {
      render(<Help onClose={mockOnClose} />);

      const dialog = document.querySelector('.help__modal');
      fireEvent.click(dialog!);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<Help onClose={mockOnClose} />);

      const h1 = screen.getByRole('heading', { level: 1 });
      const h2s = screen.getAllByRole('heading', { level: 2 });

      expect(h1).toBeInTheDocument();
      expect(h2s.length).toBe(5); // 5 accordion section titles
    });

    it('should have aria-expanded on all accordion headers', () => {
      render(<Help onClose={mockOnClose} />);

      const headers = document.querySelectorAll('.help__accordion-header');
      expect(headers.length).toBe(5);

      headers.forEach(header => {
        expect(header.hasAttribute('aria-expanded')).toBe(true);
      });
    });
  });
});
