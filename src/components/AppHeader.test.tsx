import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppHeader } from './AppHeader';

// Import actual i18n from setup
import '../test/setup';

describe('AppHeader', () => {
  describe('rendering', () => {
    it('should render the header', () => {
      const { container } = render(<AppHeader />);
      expect(container.querySelector('.app-header')).toBeInTheDocument();
    });

    it('should render the title', () => {
      render(<AppHeader />);
      expect(screen.getByText('D-GRE Stock Exchange')).toBeInTheDocument();
    });

    it('should render the logo', () => {
      const { container } = render(<AppHeader />);
      const logo = container.querySelector('.app-header__logo');
      expect(logo).toBeInTheDocument();
      expect(logo?.tagName.toLowerCase()).toBe('svg');
    });
  });

  describe('buttons', () => {
    it('should render help button when onOpenHelp is provided', () => {
      const mockOnOpenHelp = vi.fn();
      render(<AppHeader onOpenHelp={mockOnOpenHelp} />);
      // German: "Wie funktioniert das Spiel?"
      expect(screen.getByTitle('Wie funktioniert das Spiel?')).toBeInTheDocument();
    });

    it('should not render help button when onOpenHelp is not provided', () => {
      render(<AppHeader />);
      expect(screen.queryByTitle('Wie funktioniert das Spiel?')).not.toBeInTheDocument();
    });

    it('should call onOpenHelp when clicking help button', () => {
      const mockOnOpenHelp = vi.fn();
      render(<AppHeader onOpenHelp={mockOnOpenHelp} />);
      fireEvent.click(screen.getByTitle('Wie funktioniert das Spiel?'));
      expect(mockOnOpenHelp).toHaveBeenCalledTimes(1);
    });

    it('should render settings button when onOpenSettings is provided', () => {
      const mockOnOpenSettings = vi.fn();
      render(<AppHeader onOpenSettings={mockOnOpenSettings} />);
      // German: "Einstellungen"
      expect(screen.getByTitle('Einstellungen')).toBeInTheDocument();
    });

    it('should not render settings button when onOpenSettings is not provided', () => {
      render(<AppHeader />);
      expect(screen.queryByTitle('Einstellungen')).not.toBeInTheDocument();
    });

    it('should call onOpenSettings when clicking settings button', () => {
      const mockOnOpenSettings = vi.fn();
      render(<AppHeader onOpenSettings={mockOnOpenSettings} />);
      fireEvent.click(screen.getByTitle('Einstellungen'));
      expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('should render both buttons when both callbacks are provided', () => {
      const mockOnOpenHelp = vi.fn();
      const mockOnOpenSettings = vi.fn();
      render(
        <AppHeader
          onOpenHelp={mockOnOpenHelp}
          onOpenSettings={mockOnOpenSettings}
        />
      );
      expect(screen.getByTitle('Wie funktioniert das Spiel?')).toBeInTheDocument();
      expect(screen.getByTitle('Einstellungen')).toBeInTheDocument();
    });

    it('should have buttons container', () => {
      const mockOnOpenHelp = vi.fn();
      const { container } = render(<AppHeader onOpenHelp={mockOnOpenHelp} />);
      expect(container.querySelector('.app-header__buttons')).toBeInTheDocument();
    });
  });

  describe('button styling', () => {
    it('should have correct button class', () => {
      const mockOnOpenHelp = vi.fn();
      const { container } = render(<AppHeader onOpenHelp={mockOnOpenHelp} />);
      const buttons = container.querySelectorAll('.app-header__btn');
      expect(buttons.length).toBe(1);
    });

    it('should have two buttons when both callbacks provided', () => {
      const mockOnOpenHelp = vi.fn();
      const mockOnOpenSettings = vi.fn();
      const { container } = render(
        <AppHeader
          onOpenHelp={mockOnOpenHelp}
          onOpenSettings={mockOnOpenSettings}
        />
      );
      const buttons = container.querySelectorAll('.app-header__btn');
      expect(buttons.length).toBe(2);
    });
  });
});
