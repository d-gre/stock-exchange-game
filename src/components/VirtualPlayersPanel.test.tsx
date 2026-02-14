import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VirtualPlayersPanel } from './VirtualPlayersPanel';
import type { VirtualPlayer, Stock } from '../types';

// Mock i18next - imports actual i18n from setup
import '../test/setup';

const mockStocks: Stock[] = [
  {
    symbol: 'AAPL',
    name: 'Apple',
    sector: 'tech',
    currentPrice: 150,
    priceHistory: [],
    change: 5,
    changePercent: 3.45,
    marketCapBillions: 3000,
  },
];

const mockPlayers: VirtualPlayer[] = [
  {
    id: 'vp1',
    name: 'Warren Buffer',
    portfolio: {
      cash: 10000,
      holdings: [],
    },
    transactions: [],
    settings: {
      riskTolerance: -50,
    },
    loans: [],
    cyclesSinceInterest: 0,
    initialCash: 10000,
  },
  {
    id: 'vp2',
    name: 'Risk Taker',
    portfolio: {
      cash: 8000,
      holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 140 }],
    },
    transactions: [],
    settings: {
      riskTolerance: 80,
    },
    loans: [],
    cyclesSinceInterest: 0,
    initialCash: 10000,
  },
];

describe('VirtualPlayersPanel', () => {
  describe('rendering', () => {
    it('should render nothing when players array is empty', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render the panel with title when players exist', () => {
      render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );
      // German translation
      expect(screen.getByText('Virtuelle Spieler')).toBeInTheDocument();
    });

    it('should display trade count in title', () => {
      render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );
      expect(screen.getByText('– 20 Trades')).toBeInTheDocument();
    });

    it('should render VirtualPlayersList content when expanded', () => {
      render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );
      // VirtualPlayersList should render player names
      expect(screen.getByText('Warren Buffer')).toBeInTheDocument();
      expect(screen.getByText('Risk Taker')).toBeInTheDocument();
    });
  });

  describe('expand/collapse', () => {
    it('should be expanded by default', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );
      // Content should be visible (expanded class)
      expect(container.querySelector('.virtual-players-panel--expanded')).toBeInTheDocument();
      // Toggle icon is always ▼ (rotates via CSS when expanded)
      expect(container.querySelector('.virtual-players-panel__toggle')).toHaveTextContent('▼');
    });

    it('should collapse when header is clicked', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      fireEvent.click(screen.getByText('Virtuelle Spieler'));

      // Panel should not have expanded class
      expect(container.querySelector('.virtual-players-panel--expanded')).not.toBeInTheDocument();
    });

    it('should expand again when header is clicked twice', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      // Collapse
      fireEvent.click(screen.getByText('Virtuelle Spieler'));
      expect(container.querySelector('.virtual-players-panel--expanded')).not.toBeInTheDocument();

      // Expand
      fireEvent.click(screen.getByText('Virtuelle Spieler'));
      expect(container.querySelector('.virtual-players-panel--expanded')).toBeInTheDocument();
    });

    it('should respect defaultExpanded prop when true', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
          defaultExpanded={true}
        />
      );

      expect(container.querySelector('.virtual-players-panel--expanded')).toBeInTheDocument();
    });

    it('should respect defaultExpanded prop when false', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
          defaultExpanded={false}
        />
      );

      // Panel should not have expanded class
      expect(container.querySelector('.virtual-players-panel--expanded')).not.toBeInTheDocument();
    });
  });

  describe('toggle click area', () => {
    it('should toggle when clicking on title', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      fireEvent.click(screen.getByText('Virtuelle Spieler'));
      expect(container.querySelector('.virtual-players-panel--expanded')).not.toBeInTheDocument();
    });

    it('should toggle when clicking on trade count', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      fireEvent.click(screen.getByText('– 20 Trades'));
      expect(container.querySelector('.virtual-players-panel--expanded')).not.toBeInTheDocument();
    });

    it('should toggle when clicking on toggle icon', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      const toggle = container.querySelector('.virtual-players-panel__toggle');
      fireEvent.click(toggle!);
      expect(container.querySelector('.virtual-players-panel--expanded')).not.toBeInTheDocument();
    });
  });

  describe('props passing to VirtualPlayersList', () => {
    it('should pass players to VirtualPlayersList', () => {
      render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      // Both player names should be visible
      expect(screen.getByText('Warren Buffer')).toBeInTheDocument();
      expect(screen.getByText('Risk Taker')).toBeInTheDocument();
    });

    it('should update when players prop changes', () => {
      const { rerender } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      expect(screen.getByText('– 20 Trades')).toBeInTheDocument();

      // Update with single player and different trade count
      rerender(
        <VirtualPlayersPanel
          players={[mockPlayers[0]]}
          stocks={mockStocks}
          totalTradeCount={5}
        />
      );

      expect(screen.getByText('– 5 Trades')).toBeInTheDocument();
      expect(screen.getByText('Warren Buffer')).toBeInTheDocument();
      expect(screen.queryByText('Risk Taker')).not.toBeInTheDocument();
    });
  });

  describe('CSS class names', () => {
    it('should have correct class on container', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      expect(container.querySelector('.virtual-players-panel')).toBeInTheDocument();
    });

    it('should have correct class on header', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      expect(container.querySelector('.virtual-players-panel__header')).toBeInTheDocument();
    });

    it('should have correct class on title', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      expect(container.querySelector('.virtual-players-panel__title')).toBeInTheDocument();
    });

    it('should have content wrapper class always present', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      expect(container.querySelector('.virtual-players-panel__content-wrapper')).toBeInTheDocument();
    });

    it('should have expanded class when expanded', () => {
      const { container } = render(
        <VirtualPlayersPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={20}
        />
      );

      expect(container.querySelector('.virtual-players-panel--expanded')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Virtuelle Spieler'));

      expect(container.querySelector('.virtual-players-panel--expanded')).not.toBeInTheDocument();
    });
  });
});
