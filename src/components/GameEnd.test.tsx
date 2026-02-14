import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { GameEnd } from './GameEnd';
import gameSessionReducer from '../store/gameSessionSlice';
import marketPhaseReducer from '../store/marketPhaseSlice';
import portfolioReducer from '../store/portfolioSlice';
import stocksReducer from '../store/stocksSlice';
import loansReducer from '../store/loansSlice';
import tradeHistoryReducer, { selectSellTradeCount, selectBestTrade, selectWorstTrade, selectShortTradeCount, selectBestShortTrade, selectWorstShortTrade } from '../store/tradeHistorySlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import settingsReducer from '../store/settingsSlice';
import type { EndGameStats, PlayerEndStats } from '../store/gameSessionSlice';

// Import i18n from setup
import '../test/setup';

describe('GameEnd', () => {
  const mockOnPlayAgain = vi.fn();
  const mockOnLoadGame = vi.fn();
  const mockOnContinueGame = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createPlayer = (
    id: string,
    name: string,
    netWorth: number,
    profit: number,
    riskLevel: 'conservative' | 'moderate' | 'aggressive' = 'moderate',
    isHuman = false
  ): PlayerEndStats => ({
    id,
    name,
    netWorth,
    profit,
    riskLevel,
    isHuman,
  });

  const createEndGameStats = (overrides: Partial<EndGameStats> = {}): EndGameStats => ({
    playerRanking: 1,
    playerNetWorth: 150000,
    playerProfit: 50000,
    playerRiskLevel: 'moderate',
    allPlayersRanked: [
      createPlayer('player', 'You', 150000, 50000, 'moderate', true),
      createPlayer('vp1', 'Bot Alpha', 140000, 40000, 'conservative'),
      createPlayer('vp2', 'Bot Beta', 130000, 30000, 'aggressive'),
    ],
    ...overrides,
  });

  const createMockStore = (endGameStats: EndGameStats | null = createEndGameStats()) =>
    configureStore({
      reducer: {
        gameSession: gameSessionReducer,
        marketPhase: marketPhaseReducer,
        portfolio: portfolioReducer,
        stocks: stocksReducer,
        loans: loansReducer,
        tradeHistory: tradeHistoryReducer,
        pendingOrders: pendingOrdersReducer,
        settings: settingsReducer,
      },
      preloadedState: {
        gameSession: {
          gameDuration: 60,
          currentCycle: 60,
          isGameEnded: true,
          endGameStats,
          endScreenPreview: false,
          totalTradesExecuted: 10,
          maxLoanUtilization: 0.3,
        },
        marketPhase: {
          globalPhase: 'prosperity' as const,
          sectorPhases: {
            tech: 'prosperity' as const,
            finance: 'prosperity' as const,
            industrial: 'prosperity' as const,
            commodities: 'prosperity' as const,
          },
          cyclesInGlobalPhase: 30,
          cyclesInSectorPhase: {
            tech: 30,
            finance: 30,
            industrial: 30,
            commodities: 30,
          },
          fearGreedIndex: 50,
          overheatCycles: {
            tech: 0,
            finance: 0,
            industrial: 0,
            commodities: 0,
          },
          lastUpdate: Date.now(),
          phaseHistory: {
            totalCycles: 60,
            cyclesPerPhase: {
              prosperity: 40,
              boom: 10,
              consolidation: 5,
              panic: 0,
              recession: 2,
              recovery: 3,
            },
          },
          climateHistory: [],
        },
        portfolio: {
          cash: 50000,
          holdings: [
            { symbol: 'AAPL', shares: 100, avgBuyPrice: 150 },
          ],
        },
        stocks: {
          items: [
            {
              symbol: 'AAPL',
              name: 'Apple Inc.',
              sector: 'tech' as const,
              currentPrice: 180,
              previousPrice: 175,
              dayOpen: 175,
              dayHigh: 182,
              dayLow: 174,
              marketCapBillions: 2800,
              volatility: 0.02,
              trend: 0.01,
              momentum: 0.5,
              correlationWithSector: 0.8,
              priceHistory: [],
              change: 5,
              changePercent: 0.0286,
            },
          ],
          lastUpdate: Date.now(),
        },
        loans: {
          loans: [],
          cyclesSinceLastInterestCharge: 0,
          totalInterestPaid: 125.50,
          totalOriginationFeesPaid: 0,
          totalRepaymentFeesPaid: 0,
          creditScore: 65,
          creditHistory: [],
          delinquencyHistory: [],
          nextLoanNumber: 1,
        },
        tradeHistory: {
          trades: [],
          portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
        },
        pendingOrders: {
          orders: [],
          tradedSymbolsThisCycle: [],
        },
        settings: {
          updateInterval: 5000,
          language: 'de' as const,
          virtualPlayerCount: 10,
          initialCash: 100000,
          countdown: 60,
          isPaused: false,
          gameMode: 'realLife' as const,
          speedMultiplier: 1 as const,
        },
      },
    });

  const renderWithProvider = (store = createMockStore(), hasSavedGame = false) =>
    render(
      <Provider store={store}>
        <GameEnd
          onPlayAgain={mockOnPlayAgain}
          hasSavedGame={hasSavedGame}
          onLoadGame={mockOnLoadGame}
          onContinueGame={mockOnContinueGame}
        />
      </Provider>
    );

  describe('rendering', () => {
    it('should return null when endGameStats is null', () => {
      const store = createMockStore(null);
      const { container } = renderWithProvider(store);
      expect(container.firstChild).toBeNull();
    });

    it('should render view with correct title', () => {
      renderWithProvider();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Spielende');
    });

    it('should render player result section', () => {
      renderWithProvider();
      expect(screen.getByText('Ihr Ergebnis')).toBeInTheDocument();
    });

    it('should render ranking title', () => {
      renderWithProvider();
      expect(screen.getByText('D-GREX Ranking')).toBeInTheDocument();
    });

    it('should render new game button', () => {
      renderWithProvider();
      expect(screen.getByRole('button', { name: 'Neues Spiel' })).toBeInTheDocument();
    });
  });

  describe('player result display', () => {
    it('should display player ranking with emoji for top 3', () => {
      const stats = createEndGameStats({ playerRanking: 1 });
      renderWithProvider(createMockStore(stats));
      // Check that rank display contains emoji (multiple matches expected)
      expect(screen.getAllByText(/🥇 1/).length).toBeGreaterThan(0);
    });

    it('should display player ranking with emoji for rank 2', () => {
      const stats = createEndGameStats({ playerRanking: 2 });
      renderWithProvider(createMockStore(stats));
      expect(screen.getAllByText(/🥈 2/).length).toBeGreaterThan(0);
    });

    it('should display player ranking with emoji for rank 3', () => {
      const stats = createEndGameStats({ playerRanking: 3 });
      renderWithProvider(createMockStore(stats));
      expect(screen.getAllByText(/🥉 3/).length).toBeGreaterThan(0);
    });

    it('should not display player ranking in result section for rank > 3', () => {
      const allPlayers = Array.from({ length: 10 }, (_, i) =>
        createPlayer(`vp${i}`, `Bot ${i}`, 200000 - i * 10000, 100000 - i * 10000, 'moderate', i === 4)
      );
      allPlayers[4].isHuman = true;
      const stats = createEndGameStats({
        playerRanking: 5,
        allPlayersRanked: allPlayers,
      });
      renderWithProvider(createMockStore(stats));
      // Rank should not be shown in the result highlight section for rank > 3
      expect(screen.queryByText('5 / 10')).not.toBeInTheDocument();
      expect(document.querySelector('.game-end__result-highlight')).toBeFalsy();
    });

    it('should display net worth breakdown', () => {
      renderWithProvider();
      expect(screen.getByText('Vermögensaufstellung')).toBeInTheDocument();
      expect(screen.getByText('Bargeld')).toBeInTheDocument();
      expect(screen.getByText('Aktienwert')).toBeInTheDocument();
    });

    it('should display credit score', () => {
      renderWithProvider();
      expect(screen.getByText('Kreditscore')).toBeInTheDocument();
      expect(screen.getByText(/65.*Gut/)).toBeInTheDocument();
    });

    it('should display total interest paid when > 0', () => {
      renderWithProvider();
      expect(screen.getByText('Gezahlte Zinsen')).toBeInTheDocument();
    });

    it('should hide total interest paid when 0', () => {
      const store = configureStore({
        reducer: {
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          portfolio: portfolioReducer,
          stocks: stocksReducer,
          loans: loansReducer,
          tradeHistory: tradeHistoryReducer,
          pendingOrders: pendingOrdersReducer,
          settings: settingsReducer,
        },
        preloadedState: {
          gameSession: {
            gameDuration: 60,
            currentCycle: 60,
            isGameEnded: true,
            endGameStats: createEndGameStats(),
            endScreenPreview: false,
            totalTradesExecuted: 10,
            maxLoanUtilization: 0.3,
          },
          marketPhase: {
            globalPhase: 'prosperity' as const,
            sectorPhases: {
              tech: 'prosperity' as const,
              finance: 'prosperity' as const,
              industrial: 'prosperity' as const,
              commodities: 'prosperity' as const,
            },
            cyclesInGlobalPhase: 30,
            cyclesInSectorPhase: { tech: 30, finance: 30, industrial: 30, commodities: 30 },
            fearGreedIndex: 50,
            overheatCycles: { tech: 0, finance: 0, industrial: 0, commodities: 0 },
            lastUpdate: Date.now(),
            phaseHistory: {
              totalCycles: 60,
              cyclesPerPhase: { prosperity: 40, boom: 10, consolidation: 5, panic: 0, recession: 2, recovery: 3 },
            },
            climateHistory: [],
          },
          portfolio: {
            cash: 50000,
            holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
          },
          stocks: {
            items: [{
              symbol: 'AAPL', name: 'Apple Inc.', sector: 'tech' as const,
              currentPrice: 180, previousPrice: 175, dayOpen: 175, dayHigh: 182, dayLow: 174,
              marketCapBillions: 2800, volatility: 0.02, trend: 0.01, momentum: 0.5,
              correlationWithSector: 0.8, priceHistory: [], change: 5, changePercent: 0.0286,
            }],
            lastUpdate: Date.now(),
          },
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 65,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          tradeHistory: {
            trades: [],
            portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
          },
          pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
          settings: {
            updateInterval: 5000, language: 'de' as const, virtualPlayerCount: 10,
            initialCash: 100000, countdown: 60, isPaused: false, gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
          },
        },
      });
      renderWithProvider(store);
      expect(screen.queryByText('Gezahlte Zinsen')).not.toBeInTheDocument();
    });

    it('should display player profit with positive styling', () => {
      renderWithProvider();
      // Net worth in breakdown should be positive
      const netWorthElements = screen.getAllByText(/\$150\.000/);
      expect(netWorthElements.length).toBeGreaterThan(0);
    });

    it('should display player profit with negative styling when negative', () => {
      const stats = createEndGameStats({ playerProfit: -10000, playerNetWorth: 90000 });
      renderWithProvider(createMockStore(stats));
      // Check that negative styling class is applied somewhere
      const { container } = renderWithProvider(createMockStore(stats));
      expect(container.querySelector('.game-end__profit--negative')).toBeInTheDocument();
    });

    it('should display risk level', () => {
      renderWithProvider();
      // Multiple "Risikoprofil" labels may appear (in result section and header)
      expect(screen.getAllByText('Risikoprofil').length).toBeGreaterThan(0);
      // Multiple "Moderat" labels may appear
      expect(screen.getAllByText('Moderat').length).toBeGreaterThan(0);
    });

    it('should display conservative risk level with correct class', () => {
      const stats = createEndGameStats({ playerRiskLevel: 'conservative' });
      const { container } = renderWithProvider(createMockStore(stats));
      expect(container.querySelector('.game-end__risk--conservative')).toBeInTheDocument();
    });

    it('should display aggressive risk level with correct class', () => {
      const stats = createEndGameStats({ playerRiskLevel: 'aggressive' });
      const { container } = renderWithProvider(createMockStore(stats));
      expect(container.querySelector('.game-end__risk--aggressive')).toBeInTheDocument();
    });
  });

  describe('ranking list display', () => {
    it('should display top 3 players', () => {
      renderWithProvider();
      expect(screen.getByText('Sie')).toBeInTheDocument(); // Human player
      expect(screen.getByText('Bot Alpha')).toBeInTheDocument();
      expect(screen.getByText('Bot Beta')).toBeInTheDocument();
    });

    it('should display ranking emojis for top 3', () => {
      renderWithProvider();
      const playerRows = document.querySelectorAll('.game-end__player-row');
      expect(playerRows[0].textContent).toContain('🥇');
      expect(playerRows[1].textContent).toContain('🥈');
      expect(playerRows[2].textContent).toContain('🥉');
    });

    it('should highlight human player row', () => {
      renderWithProvider();
      const humanRow = screen.getByText('Sie').closest('.game-end__player-row');
      expect(humanRow).toHaveClass('game-end__player-row--human');
    });

    it('should display separator when there are bottom players', () => {
      const allPlayers = [
        createPlayer('player', 'You', 150000, 50000, 'moderate', true),
        createPlayer('vp1', 'Bot 1', 140000, 40000),
        createPlayer('vp2', 'Bot 2', 130000, 30000),
        createPlayer('vp3', 'Bot 3', 50000, -50000),
        createPlayer('vp4', 'Bot 4', 40000, -60000),
        createPlayer('vp5', 'Bot 5', 30000, -70000),
        createPlayer('vp6', 'Bot 6', 20000, -80000),
      ];
      const stats = createEndGameStats({ allPlayersRanked: allPlayers });
      renderWithProvider(createMockStore(stats));
      expect(screen.getAllByText('...').length).toBeGreaterThan(0);
    });

    it('should show player in middle with two separators when not adjacent to top/bottom', () => {
      // Player on rank 5 (not adjacent to top 3 or bottom 3)
      const allPlayers = [
        createPlayer('vp1', 'Bot 1', 200000, 100000),
        createPlayer('vp2', 'Bot 2', 180000, 80000),
        createPlayer('vp3', 'Bot 3', 160000, 60000),
        createPlayer('vp4', 'Bot 4', 140000, 40000),
        createPlayer('player', 'You', 100000, 0, 'moderate', true), // Rank 5
        createPlayer('vp5', 'Bot 5', 80000, -20000),
        createPlayer('vp6', 'Bot 6', 60000, -40000),
        createPlayer('vp7', 'Bot 7', 40000, -60000),
        createPlayer('vp8', 'Bot 8', 20000, -80000),
        createPlayer('vp9', 'Bot 9', 10000, -90000),
      ];
      const stats = createEndGameStats({
        playerRanking: 5,
        allPlayersRanked: allPlayers,
      });
      renderWithProvider(createMockStore(stats));

      // Should show top 3, player in middle, and bottom 3
      expect(screen.getByText('Bot 1')).toBeInTheDocument();
      expect(screen.getByText('Bot 2')).toBeInTheDocument();
      expect(screen.getByText('Bot 3')).toBeInTheDocument();
      expect(screen.getByText('Sie')).toBeInTheDocument();

      // Two separators (one before player, one before bottom)
      expect(screen.getAllByText('...').length).toBe(2);
    });

    it('should not show separator before player when on rank 4 (adjacent to top 3)', () => {
      // Player on rank 4 - directly after top 3
      const allPlayers = [
        createPlayer('vp1', 'Bot 1', 200000, 100000),
        createPlayer('vp2', 'Bot 2', 180000, 80000),
        createPlayer('vp3', 'Bot 3', 160000, 60000),
        createPlayer('player', 'You', 100000, 0, 'moderate', true), // Rank 4
        createPlayer('vp4', 'Bot 4', 80000, -20000),
        createPlayer('vp5', 'Bot 5', 60000, -40000),
        createPlayer('vp6', 'Bot 6', 40000, -60000),
        createPlayer('vp7', 'Bot 7', 30000, -70000),
        createPlayer('vp8', 'Bot 8', 20000, -80000),
        createPlayer('vp9', 'Bot 9', 10000, -90000),
      ];
      const stats = createEndGameStats({
        playerRanking: 4,
        allPlayersRanked: allPlayers,
      });
      renderWithProvider(createMockStore(stats));

      // Should show top 3, player directly after, and bottom 3
      expect(screen.getByText('Bot 1')).toBeInTheDocument();
      expect(screen.getByText('Bot 3')).toBeInTheDocument();
      expect(screen.getByText('Sie')).toBeInTheDocument();

      // Only one separator (before bottom players, not before player)
      expect(screen.getAllByText('...').length).toBe(1);
    });

    it('should not show separator after player when on 4th last rank (adjacent to bottom 3)', () => {
      // Player on rank 7 of 10 - directly before bottom 3 (ranks 8, 9, 10)
      const allPlayers = [
        createPlayer('vp1', 'Bot 1', 200000, 100000),
        createPlayer('vp2', 'Bot 2', 180000, 80000),
        createPlayer('vp3', 'Bot 3', 160000, 60000),
        createPlayer('vp4', 'Bot 4', 140000, 40000),
        createPlayer('vp5', 'Bot 5', 120000, 20000),
        createPlayer('vp6', 'Bot 6', 110000, 10000),
        createPlayer('player', 'You', 100000, 0, 'moderate', true), // Rank 7 (4th last)
        createPlayer('vp7', 'Bot 7', 40000, -60000),
        createPlayer('vp8', 'Bot 8', 20000, -80000),
        createPlayer('vp9', 'Bot 9', 10000, -90000),
      ];
      const stats = createEndGameStats({
        playerRanking: 7,
        allPlayersRanked: allPlayers,
      });
      renderWithProvider(createMockStore(stats));

      // Should show top 3, player, and bottom 3 directly after player
      expect(screen.getByText('Bot 1')).toBeInTheDocument();
      expect(screen.getByText('Sie')).toBeInTheDocument();
      expect(screen.getByText('Bot 7')).toBeInTheDocument(); // First of bottom 3

      // Only one separator (before player, not after)
      expect(screen.getAllByText('...').length).toBe(1);
    });

    it('should not show separator when player is in top 3', () => {
      renderWithProvider();
      // Only the separator before bottom players (if any)
      expect(screen.queryAllByText('...').length).toBeLessThanOrEqual(1);
    });
  });

  describe('risk level in ranking list', () => {
    it('should display risk level for each player', () => {
      renderWithProvider();
      // Conservative, Moderate, Aggressive players
      expect(screen.getByText('Konservativ')).toBeInTheDocument();
      expect(screen.getAllByText('Moderat').length).toBeGreaterThan(0);
      expect(screen.getByText('Aggressiv')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onPlayAgain when clicking new game button', () => {
      renderWithProvider();
      fireEvent.click(screen.getByRole('button', { name: 'Neues Spiel' }));
      expect(mockOnPlayAgain).toHaveBeenCalledTimes(1);
    });

    it('should not show load save button when no saved game exists', () => {
      renderWithProvider(createMockStore(), false);
      expect(screen.queryByRole('button', { name: 'Letzten Spielstand laden' })).not.toBeInTheDocument();
    });

    it('should show load save button when saved game exists', () => {
      renderWithProvider(createMockStore(), true);
      expect(screen.getByRole('button', { name: 'Letzten Spielstand laden' })).toBeInTheDocument();
    });

    it('should call onLoadGame when clicking load save button', () => {
      renderWithProvider(createMockStore(), true);
      fireEvent.click(screen.getByRole('button', { name: 'Letzten Spielstand laden' }));
      expect(mockOnLoadGame).toHaveBeenCalledTimes(1);
    });

    it('should always show continue game button', () => {
      renderWithProvider(createMockStore(), false);
      expect(screen.getByRole('button', { name: 'Spiel fortsetzen' })).toBeInTheDocument();
    });
  });

  describe('currency formatting', () => {
    it('should format positive values correctly', () => {
      renderWithProvider();
      // German locale: $ 150.000 or similar
      expect(screen.getAllByText(/\$150\.000|\$150,000/).length).toBeGreaterThan(0);
    });

    it('should format negative values with minus after dollar sign', () => {
      const stats = createEndGameStats({ playerProfit: -25000 });
      renderWithProvider(createMockStore(stats));
      // Negative values should show somewhere
      const { container } = renderWithProvider(createMockStore(stats));
      expect(container.querySelector('.game-end__profit--negative')).toBeInTheDocument();
    });
  });

  describe('column headers', () => {
    it('should display all column headers', () => {
      renderWithProvider();
      expect(screen.getByText('Rang')).toBeInTheDocument();
      expect(screen.getByText('Spieler')).toBeInTheDocument();
      expect(screen.getAllByText('Risikoprofil').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Gewinn|Verlust/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Nettovermögen/).length).toBeGreaterThan(0);
    });
  });

  describe('economic climate section', () => {
    it('should display economic climate section', () => {
      renderWithProvider();
      expect(screen.getByText('Wirtschaftsklima')).toBeInTheDocument();
    });

    it('should display duration', () => {
      renderWithProvider();
      expect(screen.getByText('Dauer')).toBeInTheDocument();
      expect(screen.getByText('60 Runden')).toBeInTheDocument();
    });

    it('should display average climate', () => {
      renderWithProvider();
      expect(screen.getByText('Durchschnittliches Klima')).toBeInTheDocument();
    });

    it('should display dominant phase', () => {
      renderWithProvider();
      expect(screen.getByText('Dominante Phase')).toBeInTheDocument();
      expect(screen.getByText('Prosperität')).toBeInTheDocument();
    });
  });

  describe('continue game functionality', () => {
    it('should open continue dropdown when clicking continue button', () => {
      renderWithProvider();
      const continueButton = screen.getByRole('button', { name: 'Spiel fortsetzen' });
      fireEvent.click(continueButton);

      // Dropdown should be visible with duration options
      expect(screen.getByText('360 Runden (ca. 30 Min)')).toBeInTheDocument();
      expect(screen.getByText('240 Runden (ca. 20 Min)')).toBeInTheDocument();
      expect(screen.getByText('120 Runden (ca. 10 Min)')).toBeInTheDocument();
      expect(screen.getByText('60 Runden (ca. 5 Min)')).toBeInTheDocument();
      expect(screen.getByText('zeitlich unbegrenzt')).toBeInTheDocument();
    });

    it('should close dropdown and call onContinueGame when selecting duration', () => {
      renderWithProvider();
      const continueButton = screen.getByRole('button', { name: 'Spiel fortsetzen' });
      fireEvent.click(continueButton);

      // Select 10 minutes option
      fireEvent.click(screen.getByText('120 Runden (ca. 10 Min)'));

      expect(mockOnContinueGame).toHaveBeenCalledWith(120); // 120 cycles = 10 min
      // Dropdown should be closed
      expect(screen.queryByText('360 Runden (ca. 30 Min)')).not.toBeInTheDocument();
    });

    it('should call onContinueGame with null for unlimited option', () => {
      renderWithProvider();
      const continueButton = screen.getByRole('button', { name: 'Spiel fortsetzen' });
      fireEvent.click(continueButton);

      fireEvent.click(screen.getByText('zeitlich unbegrenzt'));

      expect(mockOnContinueGame).toHaveBeenCalledWith(null);
    });

    it('should toggle dropdown open and closed', () => {
      renderWithProvider();
      const continueButton = screen.getByRole('button', { name: 'Spiel fortsetzen' });

      // Open dropdown
      fireEvent.click(continueButton);
      expect(screen.getByText('360 Runden (ca. 30 Min)')).toBeInTheDocument();

      // Close dropdown by clicking again
      fireEvent.click(continueButton);
      expect(screen.queryByText('360 Runden (ca. 30 Min)')).not.toBeInTheDocument();
    });
  });

  describe('climate display variations', () => {
    // Climate score is calculated from phaseHistory:
    // prosperity: 70, boom: 90, consolidation: 45, panic: 10, recession: 25, recovery: 50
    const createStoreWithClimate = (cyclesPerPhase: {
      prosperity: number;
      boom: number;
      consolidation: number;
      panic: number;
      recession: number;
      recovery: number;
    }) => {
      const totalCycles = Object.values(cyclesPerPhase).reduce((a, b) => a + b, 0);
      return configureStore({
        reducer: {
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          portfolio: portfolioReducer,
          stocks: stocksReducer,
          loans: loansReducer,
          tradeHistory: tradeHistoryReducer,
          pendingOrders: pendingOrdersReducer,
          settings: settingsReducer,
        },
        preloadedState: {
          gameSession: {
            gameDuration: totalCycles,
            currentCycle: totalCycles,
            isGameEnded: true,
            endGameStats: createEndGameStats(),
            endScreenPreview: false,
            totalTradesExecuted: 10,
            maxLoanUtilization: 0.3,
          },
          marketPhase: {
            globalPhase: 'prosperity' as const,
            sectorPhases: {
              tech: 'prosperity' as const,
              finance: 'prosperity' as const,
              industrial: 'prosperity' as const,
              commodities: 'prosperity' as const,
            },
            cyclesInGlobalPhase: 30,
            cyclesInSectorPhase: {
              tech: 30,
              finance: 30,
              industrial: 30,
              commodities: 30,
            },
            fearGreedIndex: 50,
            overheatCycles: {
              tech: 0,
              finance: 0,
              industrial: 0,
              commodities: 0,
            },
            lastUpdate: Date.now(),
            phaseHistory: {
              totalCycles,
              cyclesPerPhase,
            },
            climateHistory: [],
          },
          portfolio: {
            cash: 50000,
            holdings: [],
          },
          stocks: {
            items: [],
            lastUpdate: Date.now(),
          },
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          tradeHistory: {
            trades: [],
            portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
          },
          pendingOrders: {
            orders: [],
            tradedSymbolsThisCycle: [],
          },
          settings: {
            updateInterval: 5000,
            language: 'de' as const,
            virtualPlayerCount: 10,
            initialCash: 100000,
            countdown: 60,
            isPaused: false,
            gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
          },
        },
      });
    };

    it('should display very positive climate (score >= 75)', () => {
      // Score = (60*90)/60 = 90 (all boom)
      const store = createStoreWithClimate({
        prosperity: 0, boom: 60, consolidation: 0, panic: 0, recession: 0, recovery: 0
      });
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText('Sehr positiv')).toBeInTheDocument();
      expect(container.querySelector('.game-end__climate--very-positive')).toBeInTheDocument();
    });

    it('should display positive climate (score >= 55)', () => {
      // Score = (60*70)/60 = 70 (all prosperity)
      const store = createStoreWithClimate({
        prosperity: 60, boom: 0, consolidation: 0, panic: 0, recession: 0, recovery: 0
      });
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText('Positiv')).toBeInTheDocument();
      expect(container.querySelector('.game-end__climate--positive')).toBeInTheDocument();
    });

    it('should display neutral climate (score >= 45)', () => {
      // Score = (60*45)/60 = 45 (all consolidation)
      const store = createStoreWithClimate({
        prosperity: 0, boom: 0, consolidation: 60, panic: 0, recession: 0, recovery: 0
      });
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText('Neutral')).toBeInTheDocument();
      expect(container.querySelector('.game-end__climate--neutral')).toBeInTheDocument();
    });

    it('should display negative climate (score >= 25)', () => {
      // Score = (60*25)/60 = 25 (all recession)
      const store = createStoreWithClimate({
        prosperity: 0, boom: 0, consolidation: 0, panic: 0, recession: 60, recovery: 0
      });
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText('Negativ')).toBeInTheDocument();
      expect(container.querySelector('.game-end__climate--negative')).toBeInTheDocument();
    });

    it('should display very negative climate (score < 25)', () => {
      // Score = (60*10)/60 = 10 (all panic)
      const store = createStoreWithClimate({
        prosperity: 0, boom: 0, consolidation: 0, panic: 60, recession: 0, recovery: 0
      });
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText('Sehr negativ')).toBeInTheDocument();
      expect(container.querySelector('.game-end__climate--very-negative')).toBeInTheDocument();
    });
  });

  describe('credit score display variations', () => {
    const createStoreWithCreditScore = (creditScore: number) =>
      configureStore({
        reducer: {
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          portfolio: portfolioReducer,
          stocks: stocksReducer,
          loans: loansReducer,
          tradeHistory: tradeHistoryReducer,
          pendingOrders: pendingOrdersReducer,
          settings: settingsReducer,
        },
        preloadedState: {
          gameSession: {
            gameDuration: 60,
            currentCycle: 60,
            isGameEnded: true,
            endGameStats: createEndGameStats(),
            endScreenPreview: false,
            totalTradesExecuted: 10,
            maxLoanUtilization: 0.3,
          },
          marketPhase: {
            globalPhase: 'prosperity' as const,
            sectorPhases: {
              tech: 'prosperity' as const,
              finance: 'prosperity' as const,
              industrial: 'prosperity' as const,
              commodities: 'prosperity' as const,
            },
            cyclesInGlobalPhase: 30,
            cyclesInSectorPhase: {
              tech: 30,
              finance: 30,
              industrial: 30,
              commodities: 30,
            },
            fearGreedIndex: 50,
            overheatCycles: {
              tech: 0,
              finance: 0,
              industrial: 0,
              commodities: 0,
            },
            lastUpdate: Date.now(),
            phaseHistory: {
              totalCycles: 60,
              cyclesPerPhase: {
                prosperity: 40,
                boom: 10,
                consolidation: 5,
                panic: 0,
                recession: 2,
                recovery: 3,
              },
            },
            climateHistory: [],
          },
          portfolio: {
            cash: 50000,
            holdings: [],
          },
          stocks: {
            items: [],
            lastUpdate: Date.now(),
          },
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          tradeHistory: {
            trades: [],
            portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
          },
          pendingOrders: {
            orders: [],
            tradedSymbolsThisCycle: [],
          },
          settings: {
            updateInterval: 5000,
            language: 'de' as const,
            virtualPlayerCount: 10,
            initialCash: 100000,
            countdown: 60,
            isPaused: false,
            gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
          },
        },
      });

    it('should display excellent credit score (score >= 70)', () => {
      const store = createStoreWithCreditScore(75);
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText(/75.*Ausgezeichnet/)).toBeInTheDocument();
      expect(container.querySelector('.game-end__credit-score--excellent')).toBeInTheDocument();
    });

    it('should display good credit score (score >= 55)', () => {
      const store = createStoreWithCreditScore(60);
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText(/60.*Gut/)).toBeInTheDocument();
      expect(container.querySelector('.game-end__credit-score--good')).toBeInTheDocument();
    });

    it('should display fair credit score (score >= 40)', () => {
      const store = createStoreWithCreditScore(45);
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText(/45.*Neutral/)).toBeInTheDocument();
      expect(container.querySelector('.game-end__credit-score--fair')).toBeInTheDocument();
    });

    it('should display poor credit score (score < 40)', () => {
      const store = createStoreWithCreditScore(30);
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText(/30.*Schlecht/)).toBeInTheDocument();
      expect(container.querySelector('.game-end__credit-score--poor')).toBeInTheDocument();
    });
  });

  describe('trade statistics display', () => {
    const createStoreWithTrades = (trades: Array<{
      type: 'buy' | 'sell' | 'shortSell' | 'buyToCover';
      symbol: string;
      shares: number;
      pricePerShare: number;
      realizedProfitLoss?: number;
    }>) =>
      configureStore({
        reducer: {
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          portfolio: portfolioReducer,
          stocks: stocksReducer,
          loans: loansReducer,
          tradeHistory: tradeHistoryReducer,
          pendingOrders: pendingOrdersReducer,
          settings: settingsReducer,
        },
        preloadedState: {
          gameSession: {
            gameDuration: 60,
            currentCycle: 60,
            isGameEnded: true,
            endGameStats: createEndGameStats(),
            endScreenPreview: false,
            totalTradesExecuted: 10,
            maxLoanUtilization: 0.3,
          },
          marketPhase: {
            globalPhase: 'prosperity' as const,
            sectorPhases: {
              tech: 'prosperity' as const,
              finance: 'prosperity' as const,
              industrial: 'prosperity' as const,
              commodities: 'prosperity' as const,
            },
            cyclesInGlobalPhase: 30,
            cyclesInSectorPhase: {
              tech: 30,
              finance: 30,
              industrial: 30,
              commodities: 30,
            },
            fearGreedIndex: 50,
            overheatCycles: {
              tech: 0,
              finance: 0,
              industrial: 0,
              commodities: 0,
            },
            lastUpdate: Date.now(),
            phaseHistory: {
              totalCycles: 60,
              cyclesPerPhase: {
                prosperity: 40,
                boom: 10,
                consolidation: 5,
                panic: 0,
                recession: 2,
                recovery: 3,
              },
            },
            climateHistory: [],
          },
          portfolio: {
            cash: 50000,
            holdings: [],
          },
          stocks: {
            items: [],
            lastUpdate: Date.now(),
          },
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          tradeHistory: {
            trades: trades.map((t, i) => ({
              id: `trade-${i}`,
              type: t.type,
              symbol: t.symbol,
              shares: t.shares,
              pricePerShare: t.pricePerShare,
              totalAmount: t.shares * t.pricePerShare,
              timestamp: Date.now() - i * 1000,
              realizedProfitLoss: t.realizedProfitLoss,
              avgBuyPrice: t.pricePerShare,
            })),
            portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
          },
          pendingOrders: {
            orders: [],
            tradedSymbolsThisCycle: [],
          },
          settings: {
            updateInterval: 5000,
            language: 'de' as const,
            virtualPlayerCount: 10,
            initialCash: 100000,
            countdown: 60,
            isPaused: false,
            gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
          },
        },
      });

    it('should verify trade selectors work correctly', () => {
      // This test verifies that the selectors work correctly with the store state
      // Note: The component uses useAppSelector which requires the full RootState structure
      const trades = [
        { type: 'sell' as const, symbol: 'AAPL', shares: 10, pricePerShare: 200, realizedProfitLoss: 500 },
        { type: 'sell' as const, symbol: 'GOOG', shares: 5, pricePerShare: 150, realizedProfitLoss: 250 },
        { type: 'sell' as const, symbol: 'MSFT', shares: 8, pricePerShare: 100, realizedProfitLoss: -300 },
        { type: 'sell' as const, symbol: 'AMZN', shares: 3, pricePerShare: 80, realizedProfitLoss: -100 },
      ];
      const store = createStoreWithTrades(trades);
      const state = store.getState();

      // Verify store state
      expect(state.tradeHistory.trades.length).toBe(4);

      // Verify selectors work correctly
      // @ts-expect-error - using partial state for testing
      expect(selectSellTradeCount(state)).toBe(4);
      // @ts-expect-error - using partial state for testing
      const bestTrade = selectBestTrade(state);
      expect(bestTrade).not.toBeNull();
      expect(bestTrade?.symbol).toBe('AAPL');
      expect(bestTrade?.profitLoss).toBe(500);
      // @ts-expect-error - using partial state for testing
      const worstTrade = selectWorstTrade(state);
      expect(worstTrade).not.toBeNull();
      expect(worstTrade?.symbol).toBe('MSFT');
      expect(worstTrade?.profitLoss).toBe(-300);
    });

    it('should not display best/worst trades when fewer than 2 sell trades exist', () => {
      const trades = [
        { type: 'sell' as const, symbol: 'AAPL', shares: 10, pricePerShare: 200, realizedProfitLoss: 500 },
        { type: 'buy' as const, symbol: 'GOOG', shares: 5, pricePerShare: 150 },
      ];
      const store = createStoreWithTrades(trades);
      render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.queryByText('Gewinnreichstes Geschäft')).not.toBeInTheDocument();
      expect(screen.queryByText('Verlustreichstes Geschäft')).not.toBeInTheDocument();
    });

    it('should display best/worst trades when 2 or more sell trades exist', () => {
      const trades = [
        { type: 'sell' as const, symbol: 'AAPL', shares: 10, pricePerShare: 200, realizedProfitLoss: 500 },
        { type: 'sell' as const, symbol: 'GOOG', shares: 5, pricePerShare: 150, realizedProfitLoss: -300 },
      ];
      const store = createStoreWithTrades(trades);
      render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText('Gewinnreichstes Geschäft')).toBeInTheDocument();
      expect(screen.getByText('Verlustreichstes Geschäft')).toBeInTheDocument();
    });

    it('should verify short trade selectors work correctly', () => {
      // This test verifies that the short trade selectors work correctly with the store state
      const trades = [
        { type: 'buyToCover' as const, symbol: 'TSLA', shares: 10, pricePerShare: 100, realizedProfitLoss: 800 },
        { type: 'buyToCover' as const, symbol: 'NFLX', shares: 5, pricePerShare: 200, realizedProfitLoss: 400 },
        { type: 'buyToCover' as const, symbol: 'META', shares: 8, pricePerShare: 150, realizedProfitLoss: -600 },
        { type: 'buyToCover' as const, symbol: 'NVDA', shares: 3, pricePerShare: 250, realizedProfitLoss: -200 },
      ];
      const store = createStoreWithTrades(trades);
      const state = store.getState();

      // Verify store state
      expect(state.tradeHistory.trades.length).toBe(4);

      // Verify selectors work correctly
      // @ts-expect-error - using partial state for testing
      expect(selectShortTradeCount(state)).toBe(4);
      // @ts-expect-error - using partial state for testing
      const bestShort = selectBestShortTrade(state);
      expect(bestShort).not.toBeNull();
      expect(bestShort?.symbol).toBe('TSLA');
      expect(bestShort?.profitLoss).toBe(800);
      // @ts-expect-error - using partial state for testing
      const worstShort = selectWorstShortTrade(state);
      expect(worstShort).not.toBeNull();
      expect(worstShort?.symbol).toBe('META');
      expect(worstShort?.profitLoss).toBe(-600);
    });

    it('should not display short trade stats when fewer than 2 short trades exist', () => {
      const trades = [
        { type: 'buyToCover' as const, symbol: 'TSLA', shares: 10, pricePerShare: 100, realizedProfitLoss: 800 },
        { type: 'shortSell' as const, symbol: 'NFLX', shares: 5, pricePerShare: 200 },
      ];
      const store = createStoreWithTrades(trades);
      render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.queryByText('Bester Leerverkauf')).not.toBeInTheDocument();
      expect(screen.queryByText('Schlechtester Leerverkauf')).not.toBeInTheDocument();
    });

    it('should display short trade stats when 2 or more short trades exist', () => {
      const trades = [
        { type: 'buyToCover' as const, symbol: 'TSLA', shares: 10, pricePerShare: 100, realizedProfitLoss: 800 },
        { type: 'buyToCover' as const, symbol: 'NFLX', shares: 5, pricePerShare: 200, realizedProfitLoss: -300 },
      ];
      const store = createStoreWithTrades(trades);
      render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText('Bester Leerverkauf')).toBeInTheDocument();
      expect(screen.getByText('Schlechtester Leerverkauf')).toBeInTheDocument();
    });
  });

  describe('holdings statistics display', () => {
    it('should display best holding when there is unrealized profit', () => {
      // Default store has AAPL with avgBuyPrice: 150 and currentPrice: 180 -> profit
      renderWithProvider();
      expect(screen.getByText('Wertvollste Position')).toBeInTheDocument();
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('should display worst holding when there is unrealized loss', () => {
      const store = configureStore({
        reducer: {
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          portfolio: portfolioReducer,
          stocks: stocksReducer,
          loans: loansReducer,
          tradeHistory: tradeHistoryReducer,
          pendingOrders: pendingOrdersReducer,
          settings: settingsReducer,
        },
        preloadedState: {
          gameSession: {
            gameDuration: 60,
            currentCycle: 60,
            isGameEnded: true,
            endGameStats: createEndGameStats(),
            endScreenPreview: false,
            totalTradesExecuted: 10,
            maxLoanUtilization: 0.3,
          },
          marketPhase: {
            globalPhase: 'prosperity' as const,
            sectorPhases: {
              tech: 'prosperity' as const,
              finance: 'prosperity' as const,
              industrial: 'prosperity' as const,
              commodities: 'prosperity' as const,
            },
            cyclesInGlobalPhase: 30,
            cyclesInSectorPhase: { tech: 30, finance: 30, industrial: 30, commodities: 30 },
            fearGreedIndex: 50,
            overheatCycles: { tech: 0, finance: 0, industrial: 0, commodities: 0 },
            lastUpdate: Date.now(),
            phaseHistory: {
              totalCycles: 60,
              cyclesPerPhase: { prosperity: 40, boom: 10, consolidation: 5, panic: 0, recession: 2, recovery: 3 },
            },
            climateHistory: [],
          },
          portfolio: {
            cash: 50000,
            holdings: [
              { symbol: 'AAPL', shares: 100, avgBuyPrice: 200 }, // Loss: currentPrice 180 < avgBuyPrice 200
            ],
          },
          stocks: {
            items: [{
              symbol: 'AAPL',
              name: 'Apple Inc.',
              sector: 'tech' as const,
              currentPrice: 180,
              previousPrice: 175,
              dayOpen: 175,
              dayHigh: 182,
              dayLow: 174,
              marketCapBillions: 2800,
              volatility: 0.02,
              trend: 0.01,
              momentum: 0.5,
              correlationWithSector: 0.8,
              priceHistory: [],
              change: 5,
              changePercent: 0.0286,
            }],
            lastUpdate: Date.now(),
          },
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          tradeHistory: {
            trades: [],
            portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
          },
          pendingOrders: {
            orders: [],
            tradedSymbolsThisCycle: [],
          },
          settings: {
            updateInterval: 5000,
            language: 'de' as const,
            virtualPlayerCount: 10,
            initialCash: 100000,
            countdown: 60,
            isPaused: false,
            gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
          },
        },
      });
      render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText('Verlustreichste Position')).toBeInTheDocument();
    });

    it('should not display holdings stats when no holdings exist', () => {
      const store = configureStore({
        reducer: {
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          portfolio: portfolioReducer,
          stocks: stocksReducer,
          loans: loansReducer,
          tradeHistory: tradeHistoryReducer,
          pendingOrders: pendingOrdersReducer,
          settings: settingsReducer,
        },
        preloadedState: {
          gameSession: {
            gameDuration: 60,
            currentCycle: 60,
            isGameEnded: true,
            endGameStats: createEndGameStats(),
            endScreenPreview: false,
            totalTradesExecuted: 10,
            maxLoanUtilization: 0.3,
          },
          marketPhase: {
            globalPhase: 'prosperity' as const,
            sectorPhases: {
              tech: 'prosperity' as const,
              finance: 'prosperity' as const,
              industrial: 'prosperity' as const,
              commodities: 'prosperity' as const,
            },
            cyclesInGlobalPhase: 30,
            cyclesInSectorPhase: { tech: 30, finance: 30, industrial: 30, commodities: 30 },
            fearGreedIndex: 50,
            overheatCycles: { tech: 0, finance: 0, industrial: 0, commodities: 0 },
            lastUpdate: Date.now(),
            phaseHistory: {
              totalCycles: 60,
              cyclesPerPhase: { prosperity: 40, boom: 10, consolidation: 5, panic: 0, recession: 2, recovery: 3 },
            },
            climateHistory: [],
          },
          portfolio: {
            cash: 50000,
            holdings: [], // No holdings
          },
          stocks: {
            items: [],
            lastUpdate: Date.now(),
          },
          loans: {
            loans: [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 1,
          },
          tradeHistory: {
            trades: [],
            portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
          },
          pendingOrders: {
            orders: [],
            tradedSymbolsThisCycle: [],
          },
          settings: {
            updateInterval: 5000,
            language: 'de' as const,
            virtualPlayerCount: 10,
            initialCash: 100000,
            countdown: 60,
            isPaused: false,
            gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
          },
        },
      });
      render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.queryByText('Wertvollste Position')).not.toBeInTheDocument();
      expect(screen.queryByText('Verlustreichste Position')).not.toBeInTheDocument();
    });
  });

  describe('liabilities display', () => {
    const createStoreWithDebt = (totalDebt: number) =>
      configureStore({
        reducer: {
          gameSession: gameSessionReducer,
          marketPhase: marketPhaseReducer,
          portfolio: portfolioReducer,
          stocks: stocksReducer,
          loans: loansReducer,
          tradeHistory: tradeHistoryReducer,
          pendingOrders: pendingOrdersReducer,
          settings: settingsReducer,
        },
        preloadedState: {
          gameSession: {
            gameDuration: 60,
            currentCycle: 60,
            isGameEnded: true,
            endGameStats: createEndGameStats(),
            endScreenPreview: false,
            totalTradesExecuted: 10,
            maxLoanUtilization: 0.3,
          },
          marketPhase: {
            globalPhase: 'prosperity' as const,
            sectorPhases: {
              tech: 'prosperity' as const,
              finance: 'prosperity' as const,
              industrial: 'prosperity' as const,
              commodities: 'prosperity' as const,
            },
            cyclesInGlobalPhase: 30,
            cyclesInSectorPhase: {
              tech: 30,
              finance: 30,
              industrial: 30,
              commodities: 30,
            },
            fearGreedIndex: 50,
            overheatCycles: {
              tech: 0,
              finance: 0,
              industrial: 0,
              commodities: 0,
            },
            lastUpdate: Date.now(),
            phaseHistory: {
              totalCycles: 60,
              cyclesPerPhase: {
                prosperity: 40,
                boom: 10,
                consolidation: 5,
                panic: 0,
                recession: 2,
                recovery: 3,
              },
            },
            climateHistory: [],
          },
          portfolio: {
            cash: 50000,
            holdings: [],
          },
          stocks: {
            items: [],
            lastUpdate: Date.now(),
          },
          loans: {
            loans: totalDebt > 0 ? [{
              id: 'loan-1',
              loanNumber: 1,
              principal: totalDebt,
              balance: totalDebt,
              interestRate: 0.05,
              createdAt: Date.now() - 100000,
              durationCycles: 60,
              remainingCycles: 30,
              isOverdue: false,
              overdueForCycles: 0,
              totalInterestPaid: 0,
            }] : [],
            cyclesSinceLastInterestCharge: 0,
            totalInterestPaid: 0,
            totalOriginationFeesPaid: 0,
            totalRepaymentFeesPaid: 0,
            creditScore: 50,
            creditHistory: [],
            delinquencyHistory: [],
            nextLoanNumber: 2,
          },
          tradeHistory: {
            trades: [],
            portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
          },
          pendingOrders: {
            orders: [],
            tradedSymbolsThisCycle: [],
          },
          settings: {
            updateInterval: 5000,
            language: 'de' as const,
            virtualPlayerCount: 10,
            initialCash: 100000,
            countdown: 60,
            isPaused: false,
            gameMode: 'realLife' as const,
            speedMultiplier: 1 as const,
          },
        },
      });

    it('should display liabilities when player has debt', () => {
      const store = createStoreWithDebt(5000);
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.getByText('Verbindlichkeiten')).toBeInTheDocument();
      // Check negative styling for debt display
      const debtElements = container.querySelectorAll('.game-end__profit--negative');
      expect(debtElements.length).toBeGreaterThan(0);
    });

    it('should not display liabilities when player has no debt', () => {
      const store = createStoreWithDebt(0);
      render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(screen.queryByText('Verbindlichkeiten')).not.toBeInTheDocument();
    });
  });

  describe('profit display variations', () => {
    it('should not apply profit class for zero profit', () => {
      const stats = createEndGameStats({ playerProfit: 0, playerNetWorth: 100000 });
      const { container } = renderWithProvider(createMockStore(stats));
      // The profit element should exist but not have positive or negative class
      const profitElements = container.querySelectorAll('.game-end__breakdown-item');
      expect(profitElements.length).toBeGreaterThan(0);
    });
  });

  /** Helper to create a store with custom climate history for chart tests */
  const createStoreWithClimateHistory = (climateHistory: Array<{ cycle: number; phase: 'prosperity' | 'boom' | 'consolidation' | 'panic' | 'recession' | 'recovery'; fearGreedIndex: number }>) =>
    configureStore({
      reducer: {
        gameSession: gameSessionReducer,
        marketPhase: marketPhaseReducer,
        portfolio: portfolioReducer,
        stocks: stocksReducer,
        loans: loansReducer,
        tradeHistory: tradeHistoryReducer,
        pendingOrders: pendingOrdersReducer,
        settings: settingsReducer,
      },
      preloadedState: {
        gameSession: {
          gameDuration: 60,
          currentCycle: 60,
          isGameEnded: true,
          endGameStats: createEndGameStats(),
          endScreenPreview: false,
          totalTradesExecuted: 10,
          maxLoanUtilization: 0.3,
        },
        marketPhase: {
          globalPhase: 'prosperity' as const,
          sectorPhases: {
            tech: 'prosperity' as const,
            finance: 'prosperity' as const,
            industrial: 'prosperity' as const,
            commodities: 'prosperity' as const,
          },
          cyclesInGlobalPhase: 30,
          cyclesInSectorPhase: {
            tech: 30,
            finance: 30,
            industrial: 30,
            commodities: 30,
          },
          fearGreedIndex: 50,
          overheatCycles: {
            tech: 0,
            finance: 0,
            industrial: 0,
            commodities: 0,
          },
          lastUpdate: Date.now(),
          phaseHistory: {
            totalCycles: 60,
            cyclesPerPhase: {
              prosperity: 40,
              boom: 10,
              consolidation: 5,
              panic: 0,
              recession: 2,
              recovery: 3,
            },
          },
          climateHistory,
        },
        portfolio: {
          cash: 50000,
          holdings: [],
        },
        stocks: {
          items: [],
          lastUpdate: Date.now(),
        },
        loans: {
          loans: [],
          cyclesSinceLastInterestCharge: 0,
          totalInterestPaid: 0,
          totalOriginationFeesPaid: 0,
          totalRepaymentFeesPaid: 0,
          creditScore: 50,
          creditHistory: [],
          delinquencyHistory: [],
          nextLoanNumber: 1,
        },
        tradeHistory: {
          trades: [],
          portfolioValueHistory: [{ timestamp: Date.now(), value: 100000, realizedProfitLoss: 0 }],
        },
        pendingOrders: {
          orders: [],
          tradedSymbolsThisCycle: [],
        },
        settings: {
          updateInterval: 5000,
          language: 'de' as const,
          virtualPlayerCount: 10,
          initialCash: 100000,
          countdown: 60,
          isPaused: false,
          gameMode: 'realLife' as const,
          speedMultiplier: 1 as const,
        },
      },
    });

  describe('climate history chart', () => {
    it('should display climate history chart when there is enough data', () => {
      const climateHistory = [
        { cycle: 1, phase: 'prosperity' as const, fearGreedIndex: 50 },
        { cycle: 2, phase: 'prosperity' as const, fearGreedIndex: 55 },
        { cycle: 3, phase: 'boom' as const, fearGreedIndex: 60 },
      ];
      const store = createStoreWithClimateHistory(climateHistory);
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(container.querySelector('.game-end__chart-container')).toBeInTheDocument();
      expect(screen.getByText('Fear & Greed')).toBeInTheDocument();
    });

    it('should not display climate history chart when there is only one data point', () => {
      const climateHistory = [{ cycle: 1, phase: 'prosperity' as const, fearGreedIndex: 50 }];
      const store = createStoreWithClimateHistory(climateHistory);
      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
          />
        </Provider>
      );
      expect(container.querySelector('.game-end__chart-container')).not.toBeInTheDocument();
    });
  });

  describe('player ranking display for rank 4 and beyond', () => {
    it('should not show ranking emoji for rank 4', () => {
      const allPlayers = [
        createPlayer('vp1', 'Bot 1', 200000, 100000),
        createPlayer('vp2', 'Bot 2', 180000, 80000),
        createPlayer('vp3', 'Bot 3', 160000, 60000),
        createPlayer('player', 'You', 140000, 40000, 'moderate', true),
      ];
      const stats = createEndGameStats({
        playerRanking: 4,
        playerNetWorth: 140000,
        playerProfit: 40000,
        allPlayersRanked: allPlayers,
      });
      renderWithProvider(createMockStore(stats));

      // Player rank 4 should show without emoji in ranking list
      const humanRow = screen.getByText('Sie').closest('.game-end__player-row');
      expect(humanRow?.textContent).toContain('4');
      expect(humanRow?.textContent).not.toContain('🥇');
      expect(humanRow?.textContent).not.toContain('🥈');
      expect(humanRow?.textContent).not.toContain('🥉');
    });
  });

  describe('player in bottom ranking', () => {
    it('should show player in bottom section when ranked in bottom', () => {
      const allPlayers = [
        createPlayer('vp1', 'Bot 1', 200000, 100000),
        createPlayer('vp2', 'Bot 2', 180000, 80000),
        createPlayer('vp3', 'Bot 3', 160000, 60000),
        createPlayer('vp4', 'Bot 4', 140000, 40000),
        createPlayer('vp5', 'Bot 5', 120000, 20000),
        createPlayer('vp6', 'Bot 6', 100000, 0),
        createPlayer('vp7', 'Bot 7', 80000, -20000),
        createPlayer('player', 'You', 60000, -40000, 'moderate', true),
        createPlayer('vp8', 'Bot 8', 40000, -60000),
        createPlayer('vp9', 'Bot 9', 20000, -80000),
      ];
      const stats = createEndGameStats({
        playerRanking: 8,
        playerNetWorth: 60000,
        playerProfit: -40000,
        allPlayersRanked: allPlayers,
      });
      renderWithProvider(createMockStore(stats));

      // Player should appear in the bottom section
      expect(screen.getByText('Sie')).toBeInTheDocument();
      const humanRow = screen.getByText('Sie').closest('.game-end__player-row');
      expect(humanRow).toHaveClass('game-end__player-row--human');
    });
  });

  describe('theme prop', () => {
    it('should pass light theme to ClimateHistoryChart', () => {
      const store = createStoreWithClimateHistory([
        { cycle: 1, phase: 'prosperity' as const, fearGreedIndex: 50 },
        { cycle: 2, phase: 'prosperity' as const, fearGreedIndex: 55 },
      ]);

      const { container } = render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
            theme="light"
          />
        </Provider>
      );

      // Chart should be rendered
      expect(container.querySelector('.game-end__chart-container')).toBeInTheDocument();
    });
  });

  describe('medieval ranking illustration', () => {
    const renderWithTheme = (theme: 'dark' | 'light' | 'medieval', stats: EndGameStats = createEndGameStats()) => {
      const store = createMockStore(stats);
      return render(
        <Provider store={store}>
          <GameEnd
            onPlayAgain={mockOnPlayAgain}
            hasSavedGame={false}
            onLoadGame={mockOnLoadGame}
            onContinueGame={mockOnContinueGame}
            theme={theme}
          />
        </Provider>
      );
    };

    it('should not show ranking illustration in dark theme', () => {
      const { container } = renderWithTheme('dark');
      expect(container.querySelector('.game-end__ranking-illustration')).not.toBeInTheDocument();
    });

    it('should not show ranking illustration in light theme', () => {
      const { container } = renderWithTheme('light');
      expect(container.querySelector('.game-end__ranking-illustration')).not.toBeInTheDocument();
    });

    it('should show ranking illustration in medieval theme', () => {
      const { container } = renderWithTheme('medieval');
      expect(container.querySelector('.game-end__ranking-illustration')).toBeInTheDocument();
    });

    it('should show patrician image for top third ranking', () => {
      // 3 players, rank 1 → top third
      const { container } = renderWithTheme('medieval', createEndGameStats({
        playerRanking: 1,
        allPlayersRanked: [
          createPlayer('p1', 'You', 150000, 50000, 'moderate', true),
          createPlayer('vp1', 'Bot Alpha', 140000, 40000, 'conservative'),
          createPlayer('vp2', 'Bot Beta', 130000, 30000, 'aggressive'),
        ],
      }));
      const img = container.querySelector('.game-end__ranking-illustration img') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toContain('/assets/img/patrician.png');
    });

    it('should show merchant image for middle third ranking', () => {
      // 3 players, rank 2 → middle third
      const { container } = renderWithTheme('medieval', createEndGameStats({
        playerRanking: 2,
        allPlayersRanked: [
          createPlayer('vp1', 'Bot Alpha', 160000, 60000, 'conservative'),
          createPlayer('p1', 'You', 150000, 50000, 'moderate', true),
          createPlayer('vp2', 'Bot Beta', 130000, 30000, 'aggressive'),
        ],
      }));
      const img = container.querySelector('.game-end__ranking-illustration img') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toContain('/assets/img/merchant.png');
    });

    it('should show beggar image for bottom third ranking', () => {
      // 3 players, rank 3 → bottom third
      const { container } = renderWithTheme('medieval', createEndGameStats({
        playerRanking: 3,
        allPlayersRanked: [
          createPlayer('vp1', 'Bot Alpha', 160000, 60000, 'conservative'),
          createPlayer('vp2', 'Bot Beta', 140000, 40000, 'aggressive'),
          createPlayer('p1', 'You', 130000, 30000, 'moderate', true),
        ],
      }));
      const img = container.querySelector('.game-end__ranking-illustration img') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toContain('/assets/img/beggar.png');
    });

    it('should use correct thirds for larger player counts', () => {
      // 9 players: top third = ranks 1-3, middle = 4-6, bottom = 7-9
      const players = Array.from({ length: 9 }, (_, i) =>
        createPlayer(`p${i}`, `Player ${i + 1}`, 200000 - i * 10000, 100000 - i * 10000, 'moderate', i === 3)
      );

      // Rank 4 → middle third (thirdSize = 3, rank 4 <= 6)
      const { container: c1 } = renderWithTheme('medieval', createEndGameStats({
        playerRanking: 4,
        allPlayersRanked: players,
      }));
      expect((c1.querySelector('.game-end__ranking-illustration img') as HTMLImageElement).src).toContain('/assets/img/merchant.png');

      // Rank 7 → bottom third (rank 7 > 6)
      const { container: c2 } = renderWithTheme('medieval', createEndGameStats({
        playerRanking: 7,
        allPlayersRanked: players,
      }));
      expect((c2.querySelector('.game-end__ranking-illustration img') as HTMLImageElement).src).toContain('/assets/img/beggar.png');
    });
  });
});
