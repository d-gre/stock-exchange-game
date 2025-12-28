import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpModal } from './HelpModal';

describe('HelpModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render with correct title', () => {
      render(<HelpModal onClose={mockOnClose} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Willkommen bei D-GRE Stock Exchange');
    });

    it('should render all section titles', () => {
      render(<HelpModal onClose={mockOnClose} />);

      expect(screen.getByText('Was ist das?')).toBeInTheDocument();
      expect(screen.getByText('So spielen Sie')).toBeInTheDocument();
      expect(screen.getByText('Spielregeln')).toBeInTheDocument();
      expect(screen.getByText('Order-Typen erklärt')).toBeInTheDocument();
      expect(screen.getByText('Spread & Slippage')).toBeInTheDocument();
      expect(screen.getByText('Tipps für Einsteiger')).toBeInTheDocument();
      expect(screen.getByText('Virtuelle Spieler')).toBeInTheDocument();
    });

    it('should render market mechanics section', () => {
      render(<HelpModal onClose={mockOnClose} />);

      expect(screen.getByText('Spread')).toBeInTheDocument();
      expect(screen.getByText('Slippage')).toBeInTheDocument();
    });

    it('should render the 4 steps', () => {
      render(<HelpModal onClose={mockOnClose} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should render order types', () => {
      render(<HelpModal onClose={mockOnClose} />);

      expect(screen.getByText('Billigst/Bestens')).toBeInTheDocument();
      expect(screen.getByText('Limit')).toBeInTheDocument();
      expect(screen.getByText('Stop Buy / Stop Loss')).toBeInTheDocument();
    });

    it('should render close button with correct aria-label', () => {
      render(<HelpModal onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: 'Schließen' });
      expect(closeButton).toBeInTheDocument();
    });

    it('should render understood button', () => {
      render(<HelpModal onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: "Alles klar, los geht's!" })).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onClose when clicking close button', () => {
      render(<HelpModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking understood button', () => {
      render(<HelpModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: "Alles klar, los geht's!" }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking overlay', () => {
      render(<HelpModal onClose={mockOnClose} />);

      // Click on the overlay (the outermost div with class help-modal)
      const overlay = document.querySelector('.help-modal');
      fireEvent.click(overlay!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when clicking dialog content', () => {
      render(<HelpModal onClose={mockOnClose} />);

      // Click on the dialog content (should stop propagation)
      const dialog = document.querySelector('.help-modal__dialog');
      fireEvent.click(dialog!);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should not call onClose when clicking inside content', () => {
      render(<HelpModal onClose={mockOnClose} />);

      // Click on some content inside the dialog
      fireEvent.click(screen.getByText('Was ist das?'));
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<HelpModal onClose={mockOnClose} />);

      const h1 = screen.getByRole('heading', { level: 1 });
      const h2s = screen.getAllByRole('heading', { level: 2 });
      const h3s = screen.getAllByRole('heading', { level: 3 });

      expect(h1).toBeInTheDocument();
      expect(h2s.length).toBe(7); // 7 sections
      expect(h3s.length).toBe(4); // 4 steps
    });

    it('should have correct structure with sections', () => {
      render(<HelpModal onClose={mockOnClose} />);

      const sections = document.querySelectorAll('.help-modal__section');
      expect(sections.length).toBe(7);
    });
  });
});
