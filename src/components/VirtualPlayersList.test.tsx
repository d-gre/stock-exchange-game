import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VirtualPlayersList } from './VirtualPlayersList';
import type { Stock, VirtualPlayer, VirtualPlayerTransaction, PortfolioItem } from '../types';

// Import actual i18n from setup
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
  {
    symbol: 'MSFT',
    name: 'Microsoft',
    sector: 'tech',
    currentPrice: 300,
    priceHistory: [],
    change: 5,
    changePercent: 1.69,
    marketCapBillions: 3000,
  },
];

const createMockPlayer = (
  id: string,
  name: string,
  cash: number,
  holdings: PortfolioItem[] = [],
  transactions: VirtualPlayerTransaction[] = [],
  riskTolerance = 0
): VirtualPlayer => ({
  id,
  name,
  portfolio: { cash, holdings },
  transactions,
  settings: { riskTolerance },
  loans: [],
  cyclesSinceInterest: 0,
  initialCash: cash,
});

// Helper to create a simple transaction
const createTransaction = (
  id: string,
  symbol: string,
  type: 'buy' | 'sell',
  shares: number,
  price: number,
  decisionFactors?: VirtualPlayerTransaction['decisionFactors']
): VirtualPlayerTransaction => ({
  id,
  symbol,
  type,
  shares,
  price,
  timestamp: Date.now(),
  decisionFactors,
});

// Reusable decision factors
const mockBuyDecisionFactors = {
  kind: 'buy' as const,
  volatility: 0.03,
  trend: 0.02,
  score: 75,
  riskTolerance: 20,
};

const mockSellDecisionFactors = {
  kind: 'sell' as const,
  avgBuyPrice: 140,
  profitPercent: 0.071,
  trend: -0.01,
  score: 55,
  riskTolerance: -40,
};

describe('VirtualPlayersList', () => {
  describe('rendering', () => {
    it('should render empty list when no players', () => {
      const { container } = render(
        <VirtualPlayersList
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      expect(container.querySelector('.virtual-players-list')).toBeInTheDocument();
      expect(container.querySelectorAll('.virtual-players-list__player')).toHaveLength(0);
    });

    it('should render player cards', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 10000),
        createMockPlayer('2', 'Bot Beta', 15000),
      ];
      render(
        <VirtualPlayersList
          players={players}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      expect(screen.getByText('Bot Alpha')).toBeInTheDocument();
      expect(screen.getByText('Bot Beta')).toBeInTheDocument();
    });

    it('should display player cash', () => {
      const players = [createMockPlayer('1', 'Bot Alpha', 5000)];
      render(
        <VirtualPlayersList
          players={players}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      // German format: "Cash: 5.000,00 €"
      expect(screen.getByText(/Cash:.*5\.000,00/)).toBeInTheDocument();
    });

    it('should display player holdings', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [
          { symbol: 'AAPL', shares: 10, avgBuyPrice: 140 },
        ]),
      ];
      render(
        <VirtualPlayersList
          players={players}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      expect(screen.getByText('AAPL: 10')).toBeInTheDocument();
    });

    it('should calculate and display correct portfolio value', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [
          { symbol: 'AAPL', shares: 10, avgBuyPrice: 140 }, // 10 * 150 = 1500
        ]),
      ];
      render(
        <VirtualPlayersList
          players={players}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      // Total value: 5000 + (10 * 150) = 6500
      expect(screen.getByText(/6\.500,00.*€/)).toBeInTheDocument();
    });
  });

  describe('risk tolerance', () => {
    it('should show risk-averse badge for riskTolerance <= -34', () => {
      const players = [createMockPlayer('1', 'Bot Alpha', 5000, [], [], -50)];
      const { container } = render(
        <VirtualPlayersList
          players={players}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      const badge = container.querySelector('.virtual-players-list__risk-badge--averse');
      expect(badge).toBeInTheDocument();
    });

    it('should show neutral badge for riskTolerance between -33 and 33', () => {
      const players = [createMockPlayer('1', 'Bot Alpha', 5000, [], [], 0)];
      const { container } = render(
        <VirtualPlayersList
          players={players}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      const badge = container.querySelector('.virtual-players-list__risk-badge--neutral');
      expect(badge).toBeInTheDocument();
    });

    it('should show risk-seeking badge for riskTolerance >= 34', () => {
      const players = [createMockPlayer('1', 'Bot Alpha', 5000, [], [], 50)];
      const { container } = render(
        <VirtualPlayersList
          players={players}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      const badge = container.querySelector('.virtual-players-list__risk-badge--seeking');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('expand/collapse player card', () => {
    it('should not show transactions when collapsed', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [], [createTransaction('tx1', 'AAPL', 'buy', 5, 150)]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);
      expect(screen.queryByText('Transaktionen')).not.toBeInTheDocument();
    });

    it('should show transactions when player card is expanded', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [], [createTransaction('tx1', 'AAPL', 'buy', 5, 150)]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);
      fireEvent.click(screen.getByText('Bot Alpha'));
      expect(screen.getByText('Transaktionen')).toBeInTheDocument();
    });

    it('should collapse when clicking again', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [], [createTransaction('tx1', 'AAPL', 'buy', 5, 150)]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);

      fireEvent.click(screen.getByText('Bot Alpha'));
      expect(screen.getByText('Transaktionen')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Bot Alpha'));
      expect(screen.queryByText('Transaktionen')).not.toBeInTheDocument();
    });

    it('should allow multiple players to be expanded', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [], [createTransaction('tx1', 'AAPL', 'buy', 5, 150)]),
        createMockPlayer('2', 'Bot Beta', 6000, [], [createTransaction('tx2', 'MSFT', 'sell', 3, 300)]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);

      fireEvent.click(screen.getByText('Bot Alpha'));
      fireEvent.click(screen.getByText('Bot Beta'));

      expect(screen.getAllByText('Transaktionen')).toHaveLength(2);
    });
  });

  describe('transactions', () => {
    it('should show no transactions message when player has no trades', () => {
      const players = [createMockPlayer('1', 'Bot Alpha', 5000)];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);
      fireEvent.click(screen.getByText('Bot Alpha'));
      expect(screen.getByText('Noch keine Transaktionen')).toBeInTheDocument();
    });

    it('should display buy transaction type', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [], [createTransaction('tx1', 'AAPL', 'buy', 5, 150)]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);
      fireEvent.click(screen.getByText('Bot Alpha'));
      expect(screen.getByText('KAUF')).toBeInTheDocument();
    });

    it('should display sell transaction type', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [], [createTransaction('tx1', 'AAPL', 'sell', 5, 150)]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);
      fireEvent.click(screen.getByText('Bot Alpha'));
      expect(screen.getByText('VERK')).toBeInTheDocument();
    });

    it('should display transaction details', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [], [createTransaction('tx1', 'AAPL', 'buy', 5, 150)]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);
      fireEvent.click(screen.getByText('Bot Alpha'));
      expect(screen.getByText('5x')).toBeInTheDocument();
    });
  });

  describe('transaction decision factors', () => {
    const renderPlayerWithDecisionFactors = (
      type: 'buy' | 'sell',
      factors: VirtualPlayerTransaction['decisionFactors']
    ) => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [], [
          createTransaction('tx1', 'AAPL', type, 5, 150, factors),
        ]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);
      fireEvent.click(screen.getByText('Bot Alpha'));
    };

    it('should show expand icon for transactions with decision factors', () => {
      renderPlayerWithDecisionFactors('buy', mockBuyDecisionFactors);
      expect(document.querySelectorAll('.virtual-players-list__tx-expand-icon').length).toBeGreaterThan(0);
    });

    it('should show buy decision details when clicking on transaction', () => {
      renderPlayerWithDecisionFactors('buy', mockBuyDecisionFactors);

      const tx = document.querySelector('.virtual-players-list__tx--clickable');
      expect(tx).toBeInTheDocument();
      fireEvent.click(tx!);

      expect(screen.getByText('Entscheidungsfaktoren')).toBeInTheDocument();
      expect(screen.getByText('Volatilität:')).toBeInTheDocument();
      expect(screen.getByText('Trend:')).toBeInTheDocument();
      expect(screen.getByText('Score:')).toBeInTheDocument();
    });

    it('should show sell decision details with profit/loss', () => {
      renderPlayerWithDecisionFactors('sell', mockSellDecisionFactors);

      const tx = document.querySelector('.virtual-players-list__tx--clickable');
      fireEvent.click(tx!);

      expect(screen.getByText('Kaufpreis:')).toBeInTheDocument();
      expect(screen.getByText('Gewinn/Verlust:')).toBeInTheDocument();
    });

    it('should collapse transaction details when clicking again', () => {
      renderPlayerWithDecisionFactors('buy', mockBuyDecisionFactors);

      const tx = document.querySelector('.virtual-players-list__tx--clickable');
      fireEvent.click(tx!);
      expect(screen.getByText('Entscheidungsfaktoren')).toBeInTheDocument();

      fireEvent.click(tx!);
      expect(screen.queryByText('Entscheidungsfaktoren')).not.toBeInTheDocument();
    });
  });

  describe('flash animation', () => {
    const createPlayerWithTimestamp = (timestamp: number) => [
      createMockPlayer('1', 'Bot Alpha', 5000, [], [{
        id: 'tx1', symbol: 'AAPL', type: 'buy' as const, shares: 5, price: 150, timestamp,
      }]),
    ];

    it('should add flash class when player has recent transaction', () => {
      const players = createPlayerWithTimestamp(Date.now() + 1000);
      const { rerender } = render(
        <VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />
      );

      const playerCard = screen.getByText('Bot Alpha').closest('.virtual-players-list__player');
      expect(playerCard).not.toHaveClass('virtual-players-list__player--flash');

      rerender(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={1} />);
      expect(playerCard).toHaveClass('virtual-players-list__player--flash');
    });

    it('should not add flash class for player without recent transaction', () => {
      const players = createPlayerWithTimestamp(Date.now() - 100000);
      const { rerender } = render(
        <VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />
      );

      const playerCard = screen.getByText('Bot Alpha').closest('.virtual-players-list__player');
      rerender(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={1} />);
      expect(playerCard).not.toHaveClass('virtual-players-list__player--flash');
    });
  });

  describe('edge cases', () => {
    it('should handle player with holdings for non-existent stock', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [{ symbol: 'UNKNOWN', shares: 10, avgBuyPrice: 100 }]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);

      expect(screen.getByText('Bot Alpha')).toBeInTheDocument();
      expect(screen.getByText('UNKNOWN: 10')).toBeInTheDocument();
      expect(screen.getAllByText(/5\.000,00.*€/).length).toBeGreaterThan(0);
    });

    it('should handle transaction without decision factors', () => {
      const players = [
        createMockPlayer('1', 'Bot Alpha', 5000, [], [createTransaction('tx1', 'AAPL', 'buy', 5, 150)]),
      ];
      render(<VirtualPlayersList players={players} stocks={mockStocks} totalTradeCount={0} />);
      fireEvent.click(screen.getByText('Bot Alpha'));

      expect(document.querySelectorAll('.virtual-players-list__tx-expand-icon').length).toBe(0);
    });
  });
});
