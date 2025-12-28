import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { AppControlPanel } from './AppControlPanel';
import type { VirtualPlayer, Stock, BuyDecisionFactors, SellDecisionFactors } from '../types';

describe('AppControlPanel', () => {
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

  const createMockPlayer = (
    id: string,
    name: string,
    cash: number = 5000,
    holdings: VirtualPlayer['portfolio']['holdings'] = [],
    transactions: VirtualPlayer['transactions'] = [],
    riskTolerance: number = 0
  ): VirtualPlayer => ({
    id,
    name,
    portfolio: { cash, holdings },
    transactions,
    settings: {
      riskTolerance,
    },
  });

  const mockPlayers: VirtualPlayer[] = [
    createMockPlayer('bot-1', 'Bot Alpha', 5000, [
      { symbol: 'AAPL', shares: 10, avgBuyPrice: 100 },
    ], [
      { id: 'tx-1', symbol: 'AAPL', type: 'buy', shares: 10, price: 100, timestamp: 1700000000000 },
    ], -50),
    createMockPlayer('bot-2', 'Bot Beta', 8000, [
      { symbol: 'GOOGL', shares: 5, avgBuyPrice: 180 },
    ], [], 0),
    createMockPlayer('bot-3', 'Bot Gamma', 10000, [], [], 75),
  ];

  /** Renders panel and optionally expands it */
  const renderPanel = (
    players: VirtualPlayer[] = mockPlayers,
    options: { expand?: boolean; totalTradeCount?: number } = {}
  ): RenderResult => {
    const { expand = false, totalTradeCount = 1 } = options;
    const result = render(
      <AppControlPanel players={players} stocks={mockStocks} totalTradeCount={totalTradeCount} />
    );
    if (expand) {
      // Click on the transaction badge to expand
      const badge = screen.getByRole('button', { name: /Trades|Spieler/ });
      fireEvent.click(badge);
    }
    return result;
  };

  /** Expands a specific player card by name */
  const expandPlayer = (playerName: string): void => {
    fireEvent.click(screen.getByText(playerName));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collapsed state', () => {
    it('should render badge with trade count or player count', () => {
      renderPanel(mockPlayers, { totalTradeCount: 5 });
      expect(screen.getByRole('button', { name: /5 Trades/ })).toBeInTheDocument();
    });

    it('should show player count in badge when no transactions', () => {
      renderPanel(mockPlayers, { totalTradeCount: 0 });
      expect(screen.getByRole('button', { name: /3 Spieler/ })).toBeInTheDocument();
    });

    it('should not show badge when no players', () => {
      renderPanel([], { totalTradeCount: 0 });
      expect(screen.queryByRole('button', { name: /Trades|Spieler/ })).not.toBeInTheDocument();
    });

    it('should not show player list when collapsed', () => {
      renderPanel();
      expect(screen.queryByText('Bot Alpha')).not.toBeInTheDocument();
    });

    it('should show expand arrow when collapsed', () => {
      renderPanel();
      expect(screen.getByText('▼')).toBeInTheDocument();
    });
  });

  describe('expanded state', () => {
    it('should show player list when expanded', () => {
      renderPanel(mockPlayers, { expand: true });
      expect(screen.getByText('Bot Alpha')).toBeInTheDocument();
      expect(screen.getByText('Bot Beta')).toBeInTheDocument();
      expect(screen.getByText('Bot Gamma')).toBeInTheDocument();
    });

    it('should show collapse arrow when expanded', () => {
      renderPanel(mockPlayers, { expand: true });
      // Multiple ▲ arrows (one for badge, one for each player card)
      expect(screen.getAllByText('▲').length).toBeGreaterThanOrEqual(1);
    });

    it('should toggle back to collapsed when clicking again', () => {
      renderPanel();
      const badge = screen.getByRole('button', { name: /Trades|Spieler/ });
      fireEvent.click(badge);
      expect(screen.getByText('Bot Alpha')).toBeInTheDocument();

      fireEvent.click(badge);
      expect(screen.queryByText('Bot Alpha')).not.toBeInTheDocument();
    });
  });

  describe('player cards', () => {
    it('should display player cash', () => {
      renderPanel(mockPlayers, { expand: true });
      expect(screen.getByText(/Cash:.*5\.000,00/)).toBeInTheDocument();
    });

    it('should display player holdings', () => {
      renderPanel(mockPlayers, { expand: true });
      expect(screen.getByText('AAPL: 10')).toBeInTheDocument();
      expect(screen.getByText('GOOGL: 5')).toBeInTheDocument();
    });

    it('should calculate and display correct portfolio value', () => {
      renderPanel(mockPlayers, { expand: true });
      // Bot Alpha: 5000 cash + (10 shares * 150 price) = 6500
      expect(screen.getByText(/6\.500,00.*€/)).toBeInTheDocument();
      // Bot Beta: 8000 cash + (5 shares * 200 price) = 9000
      expect(screen.getByText(/9\.000,00.*€/)).toBeInTheDocument();
      // Bot Gamma: 10000 cash + 0 holdings = 10000
      expect(screen.getAllByText(/10\.000,00.*€/).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('risk tolerance display', () => {
    it('should display risk tolerance value', () => {
      renderPanel(mockPlayers, { expand: true });
      // Bot Alpha has -50 (Vorsichtig)
      expect(screen.getByText(/Vorsichtig.*\(-50\)/)).toBeInTheDocument();
      // Bot Beta has 0 (Neutral)
      expect(screen.getByText(/Neutral.*\(0\)/)).toBeInTheDocument();
      // Bot Gamma has 75 (Risikofreudig)
      expect(screen.getByText(/Risikofreudig.*\(75\)/)).toBeInTheDocument();
    });

    it('should show "Vorsichtig" for risk tolerance <= -34', () => {
      const player = createMockPlayer('p1', 'Player 1', 5000, [], [], -50);
      renderPanel([player], { expand: true });
      expect(screen.getByText(/Vorsichtig/)).toBeInTheDocument();
    });

    it('should show "Neutral" for risk tolerance between -33 and 33', () => {
      const player = createMockPlayer('p1', 'Player 1', 5000, [], [], 0);
      renderPanel([player], { expand: true });
      expect(screen.getByText(/Neutral/)).toBeInTheDocument();
    });

    it('should show "Risikofreudig" for risk tolerance >= 34', () => {
      const player = createMockPlayer('p1', 'Player 1', 5000, [], [], 80);
      renderPanel([player], { expand: true });
      expect(screen.getByText(/Risikofreudig/)).toBeInTheDocument();
    });
  });

  describe('expandable player cards with transactions', () => {
    it('should show transactions when player card is expanded', () => {
      renderPanel(mockPlayers, { expand: true });
      expandPlayer('Bot Alpha');
      expect(screen.getByText('Transaktionen')).toBeInTheDocument();
    });

    it('should display transaction details when expanded', () => {
      renderPanel(mockPlayers, { expand: true });
      expandPlayer('Bot Alpha');
      expect(screen.getByText('KAUF')).toBeInTheDocument();
      // AAPL appears in holdings and transactions
      expect(screen.getAllByText('AAPL').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('10x')).toBeInTheDocument();
    });

    it('should show "no transactions" message for player without trades', () => {
      renderPanel(mockPlayers, { expand: true });
      expandPlayer('Bot Beta');
      expect(screen.getByText('Noch keine Transaktionen')).toBeInTheDocument();
    });

    it('should collapse player card when clicking again', () => {
      renderPanel(mockPlayers, { expand: true });
      expandPlayer('Bot Alpha');
      expect(screen.getByText('Transaktionen')).toBeInTheDocument();

      expandPlayer('Bot Alpha');
      expect(screen.queryByText('Transaktionen')).not.toBeInTheDocument();
    });

    it('should allow multiple players to be expanded simultaneously', () => {
      renderPanel(mockPlayers, { expand: true });
      expandPlayer('Bot Alpha');
      expandPlayer('Bot Beta');
      // Both should show transaction sections
      expect(screen.getAllByText('Transaktionen').length).toBe(2);
    });
  });

  describe('transaction types', () => {
    it('should display KAUF for buy transactions', () => {
      const playerWithBuy = createMockPlayer('p1', 'Player 1', 5000, [], [
        { id: 'tx-1', symbol: 'AAPL', type: 'buy', shares: 5, price: 100, timestamp: Date.now() },
      ]);
      renderPanel([playerWithBuy], { expand: true });
      expandPlayer('Player 1');
      expect(screen.getByText('KAUF')).toBeInTheDocument();
    });

    it('should display VERK for sell transactions', () => {
      const playerWithSell = createMockPlayer('p1', 'Player 1', 5000, [], [
        { id: 'tx-1', symbol: 'GOOGL', type: 'sell', shares: 3, price: 200, timestamp: Date.now() },
      ]);
      renderPanel([playerWithSell], { expand: true });
      expandPlayer('Player 1');
      expect(screen.getByText('VERK')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty players array', () => {
      renderPanel([], { totalTradeCount: 0 });
      // No badge shown when no players
      expect(screen.queryByRole('button', { name: /Trades|Spieler/ })).not.toBeInTheDocument();
    });

    it('should handle player with holdings for non-existent stock', () => {
      const playerWithUnknownStock = createMockPlayer('p1', 'Player 1', 5000, [
        { symbol: 'UNKNOWN', shares: 10, avgBuyPrice: 50 },
      ]);
      renderPanel([playerWithUnknownStock], { expand: true, totalTradeCount: 0 });
      // Should not crash and should show cash value (holdings value = 0)
      expect(screen.getAllByText(/5\.000,00.*€/).length).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple transactions', () => {
      const playerWithManyTx = createMockPlayer('p1', 'Player 1', 5000, [], [
        { id: 'tx-1', symbol: 'AAPL', type: 'buy', shares: 10, price: 100, timestamp: 1700000000000 },
        { id: 'tx-2', symbol: 'GOOGL', type: 'buy', shares: 5, price: 180, timestamp: 1700000001000 },
        { id: 'tx-3', symbol: 'AAPL', type: 'sell', shares: 3, price: 150, timestamp: 1700000002000 },
      ]);
      renderPanel([playerWithManyTx], { expand: true, totalTradeCount: 5 });
      expandPlayer('Player 1');
      // Should show all transactions
      expect(screen.getByText('VERK')).toBeInTheDocument();
      expect(screen.getAllByText('KAUF')).toHaveLength(2);
    });
  });

  describe('transaction decision factors', () => {
    const buyFactors: BuyDecisionFactors = {
      kind: 'buy',
      volatility: 0.03,
      trend: 0.05,
      score: 72,
      riskTolerance: -50,
    };

    const sellFactors: SellDecisionFactors = {
      kind: 'sell',
      profitPercent: -0.15,
      trend: -0.08,
      score: 65,
      riskTolerance: -50,
      avgBuyPrice: 120,
    };

    /** Sets up a player with a transaction, renders expanded, and optionally clicks the transaction */
    const setupTransactionTest = (
      options: {
        type?: 'buy' | 'sell';
        factors?: BuyDecisionFactors | SellDecisionFactors;
        riskTolerance?: number;
        clickTransaction?: boolean;
      } = {}
    ): void => {
      const { type = 'buy', factors = buyFactors, riskTolerance = 0, clickTransaction = true } = options;
      const player = createMockPlayer('p1', 'Player 1', 5000, [], [
        { id: 'tx-1', symbol: 'AAPL', type, shares: 5, price: 100, timestamp: Date.now(), decisionFactors: factors },
      ], riskTolerance);
      renderPanel([player], { expand: true });
      expandPlayer('Player 1');
      if (clickTransaction) {
        fireEvent.click(screen.getByText(type === 'buy' ? 'KAUF' : 'VERK'));
      }
    };

    it('should show expand icon for transactions with decision factors', () => {
      setupTransactionTest({ clickTransaction: false });
      // Should show expand icon (▼) for transaction (player card has ▼ when collapsed)
      expect(screen.getAllByText('▼').length).toBeGreaterThanOrEqual(1);
    });

    it('should show buy decision details when clicking on transaction', () => {
      setupTransactionTest();
      // Should show decision factors
      expect(screen.getByText('Entscheidungsfaktoren')).toBeInTheDocument();
      expect(screen.getByText('Volatilität:')).toBeInTheDocument();
      expect(screen.getByText('Trend:')).toBeInTheDocument();
      expect(screen.getByText('Score:')).toBeInTheDocument();
      expect(screen.getByText('Spielertyp:')).toBeInTheDocument();
    });

    it('should show volatility classification', () => {
      setupTransactionTest();
      // Volatility 0.03 = 3% → "Mittel"
      expect(screen.getByText(/Mittel.*3\.0%/)).toBeInTheDocument();
    });

    it('should show sell decision details with profit/loss', () => {
      setupTransactionTest({ type: 'sell', factors: sellFactors });
      // Should show sell-specific fields
      expect(screen.getByText('Kaufpreis:')).toBeInTheDocument();
      expect(screen.getByText('Gewinn/Verlust:')).toBeInTheDocument();
      expect(screen.getByText(/-15\.0%/)).toBeInTheDocument();
    });

    it('should show reasoning based on risk tolerance', () => {
      setupTransactionTest({ riskTolerance: -50 });
      // Risk-averse player (-50) should show appropriate reasoning
      expect(screen.getByText(/Bevorzugt stabile, steigende Aktien/)).toBeInTheDocument();
    });

    it('should collapse transaction details when clicking again', () => {
      setupTransactionTest();
      expect(screen.getByText('Entscheidungsfaktoren')).toBeInTheDocument();

      fireEvent.click(screen.getByText('KAUF'));
      expect(screen.queryByText('Entscheidungsfaktoren')).not.toBeInTheDocument();
    });

    it('should not be clickable if no decision factors', () => {
      const player = createMockPlayer('p1', 'Player 1', 5000, [], [
        { id: 'tx-1', symbol: 'AAPL', type: 'buy', shares: 5, price: 100, timestamp: Date.now() },
      ]);
      renderPanel([player], { expand: true });
      expandPlayer('Player 1');
      fireEvent.click(screen.getByText('KAUF'));
      expect(screen.queryByText('Entscheidungsfaktoren')).not.toBeInTheDocument();
    });

    it('should show multiple transactions with different expand states', () => {
      const buyFactors2: BuyDecisionFactors = { ...buyFactors, score: 85, riskTolerance: 50 };
      const player = createMockPlayer('p1', 'Player 1', 5000, [], [
        { id: 'tx-1', symbol: 'AAPL', type: 'buy', shares: 5, price: 100, timestamp: Date.now(), decisionFactors: buyFactors },
        { id: 'tx-2', symbol: 'GOOGL', type: 'buy', shares: 3, price: 200, timestamp: Date.now() - 1000, decisionFactors: buyFactors2 },
      ]);
      renderPanel([player], { expand: true });
      expandPlayer('Player 1');

      const kaufButtons = screen.getAllByText('KAUF');
      fireEvent.click(kaufButtons[0]);
      expect(screen.getByText('Entscheidungsfaktoren')).toBeInTheDocument();

      fireEvent.click(kaufButtons[1]);
      expect(screen.getAllByText('Entscheidungsfaktoren')).toHaveLength(2);
    });
  });

  describe('speed controls (combined play/speed button)', () => {
    const mockOnSetSpeed = vi.fn();
    const mockOnTogglePause = vi.fn();

    beforeEach(() => {
      mockOnSetSpeed.mockClear();
      mockOnTogglePause.mockClear();
    });

    it('should render play button when onSetSpeed is provided', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          onSetSpeed={mockOnSetSpeed}
        />
      );
      expect(screen.getByTitle(/Geschwindigkeit: 1x/)).toBeInTheDocument();
    });

    it('should not render play button when onSetSpeed is not provided', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      expect(screen.queryByTitle(/Geschwindigkeit/)).not.toBeInTheDocument();
    });

    it('should show play button with speed-2x class when speedMultiplier is 2', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          speedMultiplier={2}
          onSetSpeed={mockOnSetSpeed}
        />
      );
      const playButton = screen.getByTitle(/Geschwindigkeit: 2x/);
      expect(playButton).toHaveClass('app-control-panel__btn--speed-2x');
    });

    it('should show play button with speed-3x class when speedMultiplier is 3', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          speedMultiplier={3}
          onSetSpeed={mockOnSetSpeed}
        />
      );
      const playButton = screen.getByTitle(/Geschwindigkeit: 3x/);
      expect(playButton).toHaveClass('app-control-panel__btn--speed-3x');
    });

    it('should cycle speed 1x → 2x when clicking play button', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          isPaused={false}
          speedMultiplier={1}
          onSetSpeed={mockOnSetSpeed}
          onTogglePause={mockOnTogglePause}
        />
      );
      fireEvent.click(screen.getByTitle(/Geschwindigkeit: 1x/));
      expect(mockOnSetSpeed).toHaveBeenCalledWith(2);
      expect(mockOnTogglePause).not.toHaveBeenCalled();
    });

    it('should cycle speed 2x → 3x when clicking play button', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          isPaused={false}
          speedMultiplier={2}
          onSetSpeed={mockOnSetSpeed}
          onTogglePause={mockOnTogglePause}
        />
      );
      fireEvent.click(screen.getByTitle(/Geschwindigkeit: 2x/));
      expect(mockOnSetSpeed).toHaveBeenCalledWith(3);
    });

    it('should cycle speed 3x → 1x when clicking play button', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          isPaused={false}
          speedMultiplier={3}
          onSetSpeed={mockOnSetSpeed}
          onTogglePause={mockOnTogglePause}
        />
      );
      fireEvent.click(screen.getByTitle(/Geschwindigkeit: 3x/));
      expect(mockOnSetSpeed).toHaveBeenCalledWith(1);
    });

    it('should resume (toggle pause) when clicking play button while paused', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          isPaused={true}
          speedMultiplier={1}
          onSetSpeed={mockOnSetSpeed}
          onTogglePause={mockOnTogglePause}
        />
      );
      // Select the play button specifically (has app-control-panel__btn--speed class)
      const playButton = document.querySelector('.app-control-panel__btn--speed') as HTMLElement;
      fireEvent.click(playButton);
      expect(mockOnTogglePause).toHaveBeenCalled();
      expect(mockOnSetSpeed).not.toHaveBeenCalled();
    });

    it('should show "Fortsetzen" title on play button when paused', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          isPaused={true}
          speedMultiplier={2}
          onSetSpeed={mockOnSetSpeed}
          onTogglePause={mockOnTogglePause}
        />
      );
      const playButton = document.querySelector('.app-control-panel__btn--speed') as HTMLElement;
      expect(playButton).toHaveAttribute('title', 'Fortsetzen');
    });

    it('should render separate pause button', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          isPaused={false}
          onTogglePause={mockOnTogglePause}
        />
      );
      expect(screen.getByTitle('Pausieren')).toBeInTheDocument();
    });

    it('should call onTogglePause when clicking pause button', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          isPaused={false}
          onSetSpeed={mockOnSetSpeed}
          onTogglePause={mockOnTogglePause}
        />
      );
      fireEvent.click(screen.getByTitle('Pausieren'));
      expect(mockOnTogglePause).toHaveBeenCalled();
    });
  });

  describe('player card flash animation', () => {
    it('should add flash class to player card when player has recent transaction', () => {
      const recentTimestamp = Date.now() + 1000; // Future timestamp to ensure it's "recent"
      const playerWithRecentTx = createMockPlayer('bot-1', 'Bot Alpha', 5000, [], [
        { id: 'tx-1', symbol: 'AAPL', type: 'buy', shares: 10, price: 100, timestamp: recentTimestamp },
      ]);

      const { rerender } = render(
        <AppControlPanel
          players={[playerWithRecentTx]}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );

      // Expand panel to see player cards
      fireEvent.click(screen.getByRole('button', { name: /Spieler/i }));

      const playerCard = screen.getByText('Bot Alpha').closest('.app-control-panel__player');
      expect(playerCard).not.toHaveClass('app-control-panel__player--flash');

      // Re-render with increased trade count (simulating a new trade)
      rerender(
        <AppControlPanel
          players={[playerWithRecentTx]}
          stocks={mockStocks}
          totalTradeCount={1}
        />
      );

      expect(playerCard).toHaveClass('app-control-panel__player--flash');
    });

    it('should not add flash class to player without recent transaction', () => {
      const oldTimestamp = Date.now() - 100000; // Old timestamp
      const playerWithOldTx = createMockPlayer('bot-1', 'Bot Alpha', 5000, [], [
        { id: 'tx-1', symbol: 'AAPL', type: 'buy', shares: 10, price: 100, timestamp: oldTimestamp },
      ]);

      const { rerender } = render(
        <AppControlPanel
          players={[playerWithOldTx]}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );

      // Expand panel to see player cards
      fireEvent.click(screen.getByRole('button', { name: /Spieler/i }));

      const playerCard = screen.getByText('Bot Alpha').closest('.app-control-panel__player');

      // Re-render with increased trade count but no recent tx for this player
      rerender(
        <AppControlPanel
          players={[playerWithOldTx]}
          stocks={mockStocks}
          totalTradeCount={1}
        />
      );

      expect(playerCard).not.toHaveClass('app-control-panel__player--flash');
    });
  });
});
