import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector, useAppStore } from './store/hooks';
import { updatePrices, resetStocks, applySilentStockSplits } from './store/stocksSlice';
import { resetSectorState, updateSectorState, selectSectorInfluences } from './store/sectorSlice';
import { resetPortfolio } from './store/portfolioSlice';
import { executeWarmupVirtualTrades, forceTradesForUntraded, reinitializePlayers, resetPlayersForTimedGame, resetTradeCount } from './store/virtualPlayersSlice';
import { resetCountdown, togglePause, setPaused, setGameMode, setSpeedMultiplier, setLanguage, setInitialCash, type SpeedMultiplier } from './store/settingsSlice';
import { selectStock, closeTradeModal, openSettings, closeSettings, openHelp, closeHelp } from './store/uiSlice';
import { clearAllOrders, selectTradedSymbolsThisCycle, selectReservedCash, selectReservedSharesBySymbol, selectAllPendingOrders, selectSymbolsWithPendingOrders } from './store/pendingOrdersSlice';
import { resetTradeHistory } from './store/tradeHistorySlice';
import { initializeInventory, selectAllInventoryLevels } from './store/marketMakerSlice';
import { selectGlobalPhase, selectSectorPhases, selectFearGreedIndex, initializeRandomPhases, resetMarketPhase, restoreMarketPhase } from './store/marketPhaseSlice';
import { resetLoans, selectTotalDebt, selectCreditLineInfo, selectCanTakeLoanEffective } from './store/loansSlice';
import { selectFailedOrderIds } from './store/notificationsSlice';
import { setGameDuration, resetGameSession, continueGame, selectEndScreenPreview } from './store/gameSessionSlice';
import { LOAN_CONFIG } from './config';
import { useGameCycle } from './hooks/useGameCycle';
import { useTrading } from './hooks/useTrading';
import { canPlayerTrade } from './utils/tradingMechanics';
import { getVolatilityMultiplier } from './utils/marketPhaseLogic';
import { CONFIG } from './config';
import { useTheme } from './hooks/useTheme';
import { useLatinEasterEgg } from './hooks/useLatinEasterEgg';
import { useDebugOutput } from './hooks/useDebugOutput';
import { useDebugMarketOverview } from './hooks/useDebugMarketOverview';
import { useEndScreenPreview } from './hooks/useEndScreenPreview';
import { setStoredLanguage, type Language } from './i18n';
import type { GameMode } from './types';

import { StockList } from './components/StockList';
import { Portfolio } from './components/Portfolio';
import { TradePanel } from './components/TradePanel';
import { SettingsSidebar } from './components/SettingsSidebar';
import { AppControlPanel } from './components/AppControlPanel';
import { NotificationToast } from './components/NotificationToast';
import { ChartPanel } from './components/ChartPanel';
import { GameStart } from './components/GameStart';
import { Help } from './components/Help';
import { AppHeader } from './components/AppHeader';
import { Loan } from './components/Loan';
import { GameEnd } from './components/GameEnd';
import { DebugModal } from './components/DebugModal';
import { hasSavedGame, saveGame, loadGame, deleteSavedGame } from './utils/gameSave';
import { restoreState as restoreStocks } from './store/stocksSlice';
import { restorePortfolio } from './store/portfolioSlice';
import { restoreVirtualPlayers } from './store/virtualPlayersSlice';
import { restoreSettings } from './store/settingsSlice';
import { restorePendingOrders } from './store/pendingOrdersSlice';
import { restoreTradeHistory } from './store/tradeHistorySlice';
import { restoreMarketMaker } from './store/marketMakerSlice';
import { restoreSector } from './store/sectorSlice';
import { restoreLoans } from './store/loansSlice';
import { restoreGameSession } from './store/gameSessionSlice';
import { addNotification, clearAllNotifications } from './store/notificationsSlice';
import { restoreShortPositions, resetShortPositions } from './store/shortPositionsSlice';
import { restoreFloats, resetFloats, initializeFloats } from './store/floatSlice';
import { restoreOrderBooks, resetOrderBooks } from './store/orderBookSlice';
import './App.css';

const App = () => {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { t, i18n } = useTranslation();
  const { theme, setTheme, getUserTheme } = useTheme();
  const [showStartModal, setShowStartModal] = useState(true);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [warmupProgress, setWarmupProgress] = useState(0);
  const [savedGameExists, setSavedGameExists] = useState(() => hasSavedGame());

  // Selectors
  const stocks = useAppSelector(state => state.stocks.items);
  const portfolio = useAppSelector(state => state.portfolio);
  const virtualPlayers = useAppSelector(state => state.virtualPlayers.players);
  const totalTradeCount = useAppSelector(state => state.virtualPlayers.totalTradeCount);
  const { virtualPlayerCount, gameMode, language, initialCash } = useAppSelector(state => state.settings);
  const { selectedStock, tradeModal, settingsOpen, helpOpen, loanModalOpen } = useAppSelector(state => state.ui);
  const totalDebt = useAppSelector(selectTotalDebt);
  const creditLineInfo = useAppSelector(selectCreditLineInfo);
  const canTakeLoanEffective = useAppSelector(selectCanTakeLoanEffective);

  // Sync i18n language with Redux state
  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const handleLanguageChange = (newLanguage: Language): void => {
    dispatch(setLanguage(newLanguage));
    setStoredLanguage(newLanguage);
  };

  // Easter Egg: Ctrl+L toggles Latin and medieval theme
  useLatinEasterEgg(language, handleLanguageChange, setTheme, getUserTheme);

  // Debug: Alt+D outputs portfolio JSON to console
  useDebugOutput();

  // Debug: Alt+M toggles market overview visibility in Hard Life mode
  const isDebugMarketVisible = useDebugMarketOverview();

  const tradedSymbolsThisCycle = useAppSelector(selectTradedSymbolsThisCycle);
  const reservedCash = useAppSelector(selectReservedCash);
  const pendingOrders = useAppSelector(selectAllPendingOrders);
  const symbolsWithPendingOrders = useAppSelector(selectSymbolsWithPendingOrders);
  const failedOrderIds = useAppSelector(selectFailedOrderIds);
  const reservedSharesForSymbol = useAppSelector(state =>
    tradeModal.symbol ? selectReservedSharesBySymbol(state, tradeModal.symbol) : 0
  );
  const marketMakerLevels = useAppSelector(selectAllInventoryLevels);

  // Market Phase selectors
  const globalPhase = useAppSelector(selectGlobalPhase);
  const sectorPhases = useAppSelector(selectSectorPhases);
  const fearGreedIndex = useAppSelector(selectFearGreedIndex);

  // Trading Hook - manages trade panel, order editing and trade execution
  const {
    editingOrder,
    handleTrade,
    handleCancelOrder,
    handleEditOrder,
    handleEditFailedOrder,
    handleDeleteFailedOrder,
    handleCloseTradePanel,
    executeTrade,
  } = useTrading({ stocks });

  // Berechne aktuellen Portfolio-Wert (Cash + Aktien)
  const totalPortfolioValue = useMemo(() => {
    const holdingsValue = portfolio.holdings.reduce((sum, holding) => {
      const stock = stocks.find(s => s.symbol === holding.symbol);
      return sum + (stock ? stock.currentPrice * holding.shares : 0);
    }, 0);
    return portfolio.cash + holdingsValue;
  }, [portfolio, stocks]);

  // Check if the player can actually trade in the trade panel
  const canTradeInPanel = useMemo(() => {
    if (!tradeModal.isOpen || !tradeModal.symbol) return false;

    // Always pause when editing
    if (editingOrder) return true;

    // addMargin is always allowed (cash check happens in TradePanel)
    if (tradeModal.type === 'addMargin') return true;

    const stock = stocks.find(s => s.symbol === tradeModal.symbol);
    if (!stock) return false;

    const holding = portfolio.holdings.find(h => h.symbol === tradeModal.symbol);

    // Calculate available credit for buy orders
    // Credit is available if: player can take more loans AND has sufficient collateral
    const hasCollateral = creditLineInfo.collateralBreakdown.total >= LOAN_CONFIG.minCollateralForLoan;
    const effectiveAvailableCredit = (canTakeLoanEffective && hasCollateral)
      ? creditLineInfo.availableCredit
      : 0;

    return canPlayerTrade({
      tradeType: tradeModal.type,
      symbol: tradeModal.symbol,
      stockPrice: stock.currentPrice,
      cash: portfolio.cash,
      sharesOwned: holding?.shares ?? 0,
      tradedSymbolsThisCycle,
      reservedCash,
      reservedShares: reservedSharesForSymbol,
      availableCredit: tradeModal.type === 'buy' ? effectiveAvailableCredit : 0,
    });
  }, [tradeModal, tradedSymbolsThisCycle, stocks, portfolio, reservedCash, reservedSharesForSymbol, editingOrder, creditLineInfo, canTakeLoanEffective]);

  // Game Cycle Hook - verwaltet Timer, Countdown und Update-Zyklen
  const {
    effectiveInterval,
    isEffectivelyPaused,
    countdown,
    isPaused,
    speedMultiplier,
    remainingCycles,
    gameProgress,
    gameDuration,
    isGameEnded,
    calculateEndGameStats,
  } = useGameCycle({
    isGameStarted: !showStartModal,
    canTradeInPanel,
    isLoanModalOpen: loanModalOpen,
    isSettingsOpen: settingsOpen,
    isHelpOpen: helpOpen,
    totalPortfolioValue,
  });

  // End Screen Preview: Alt+R toggles endscreen preview
  const endScreenPreview = useAppSelector(selectEndScreenPreview);
  useEndScreenPreview(calculateEndGameStats);

  // Warn user before leaving the page (if game is in progress)
  // TODO: Re-enable after development
  // useEffect(() => {
  //   const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  //     // Only show warning if game is in progress (not on start screen, not ended)
  //     if (!showStartModal && !isGameEnded) {
  //       e.preventDefault();
  //       // Modern browsers ignore custom messages, but this is required
  //       e.returnValue = '';
  //     }
  //   };
  //
  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // }, [showStartModal, isGameEnded]);

  // Common reset logic for game state
  const resetGameState = (): void => {
    dispatch(resetStocks());
    dispatch(resetSectorState());
    dispatch(resetPortfolio());
    dispatch(clearAllOrders());
    dispatch(resetTradeHistory());
    dispatch(resetLoans());
    dispatch(resetShortPositions());
    dispatch(resetFloats());
    dispatch(resetOrderBooks());
    dispatch(reinitializePlayers({ count: virtualPlayerCount, playerInitialCash: initialCash }));
    dispatch(setSpeedMultiplier(1));
    dispatch(resetCountdown());
    dispatch(closeTradeModal());
    dispatch(selectStock(''));
  };

  const handleGameModeChange = (newMode: GameMode): void => {
    dispatch(setGameMode(newMode));
    resetGameState();
  };

  // Handle "Play Again" from Game End Modal
  const handlePlayAgain = (): void => {
    dispatch(resetGameSession());
    dispatch(clearAllNotifications());
    resetGameState();
    dispatch(resetMarketPhase());
    deleteSavedGame();
    setSavedGameExists(false);
    setShowStartModal(true);
  };

  // Handle "Continue Game" from Game End Modal - keeps market dynamics, sets new duration
  const handleContinueGame = (gameDuration: number | null): void => {
    dispatch(continueGame(gameDuration));
  };

  // Save game to localStorage
  const handleSaveGame = (): void => {
    const state = store.getState();
    const success = saveGame(state);
    if (success) {
      setSavedGameExists(true);
      dispatch(addNotification({
        type: 'info',
        title: t('settings.saveGameSuccess'),
        message: '',
      }));
    } else {
      dispatch(addNotification({
        type: 'error',
        title: t('settings.saveGameError'),
        message: '',
      }));
    }
  };

  // Load game from localStorage
  const handleLoadGame = (): void => {
    const savedState = loadGame();
    if (!savedState) {
      dispatch(addNotification({
        type: 'error',
        title: t('settings.loadGameError'),
        message: '',
      }));
      return;
    }

    // Clear any existing notifications before loading
    dispatch(clearAllNotifications());

    // Restore all slices
    dispatch(restoreStocks(savedState.stocks));
    dispatch(restorePortfolio(savedState.portfolio));
    dispatch(restoreVirtualPlayers(savedState.virtualPlayers));
    dispatch(restoreSettings(savedState.settings));
    dispatch(restorePendingOrders(savedState.pendingOrders));
    dispatch(restoreTradeHistory(savedState.tradeHistory));
    dispatch(restoreMarketMaker(savedState.marketMaker));
    dispatch(restoreSector(savedState.sector));
    dispatch(restoreLoans(savedState.loans));
    dispatch(restoreGameSession(savedState.gameSession));
    if (savedState.marketPhase) {
      dispatch(restoreMarketPhase(savedState.marketPhase));
    }
    // Restore short selling related slices (v3+)
    if (savedState.shortPositions) {
      dispatch(restoreShortPositions(savedState.shortPositions));
    }
    if (savedState.float) {
      dispatch(restoreFloats(savedState.float));
    }
    if (savedState.orderBook) {
      dispatch(restoreOrderBooks(savedState.orderBook));
    }

    // Pause game and reset speed after loading
    dispatch(setPaused(true));
    dispatch(setSpeedMultiplier(1));

    // Hide start modal to resume game
    setShowStartModal(false);

    dispatch(addNotification({
      type: 'info',
      title: t('settings.loadGameSuccess'),
      message: '',
    }));
  };

  // Scroll to chart panel on tablet/mobile
  const scrollToChartOnMobile = (): void => {
    if (window.innerWidth <= 1200) {
      const chartPanel = document.querySelector('.center-panel');
      if (chartPanel) {
        chartPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Scroll to trade panel (used when opening trade panel from portfolio shorts)
  const scrollToTradePanel = (): void => {
    // Small delay to ensure trade panel is rendered
    setTimeout(() => {
      const tradePanel = document.querySelector('.trade-panel');
      if (tradePanel) {
        const rect = tradePanel.getBoundingClientRect();
        const scrollTop = window.scrollY + rect.top - 40; // 40px offset from top
        window.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    }, 50);
  };

  // Portfolio: Toggle behavior - clicking already selected stock deselects it
  const handlePortfolioSelectStock = (symbol: string): void => {
    if (symbol === selectedStock) {
      dispatch(selectStock('')); // Deselect -> show all charts
    } else {
      dispatch(selectStock(symbol));
      scrollToChartOnMobile();
    }
  };

  // StockList: Selection only, no toggle - second click changes nothing
  const handleStockListSelectStock = (symbol: string): void => {
    dispatch(selectStock(symbol));
    scrollToChartOnMobile();
  };

  // Add margin to a short position - opens the trade panel
  const handleAddMargin = (symbol: string): void => {
    handleTrade(symbol, 'addMargin');
    scrollToTradePanel();
  };

  const handleStartGame = async (selectedMode: GameMode, startingCash: number, gameDurationCycles: number | null): Promise<void> => {
    if (selectedMode !== gameMode) {
      handleGameModeChange(selectedMode);
    }

    // Delete saved game when starting new game
    deleteSavedGame();
    setSavedGameExists(false);

    // Set game duration (null = unlimited)
    dispatch(resetGameSession());
    dispatch(clearAllNotifications());
    dispatch(setGameDuration(gameDurationCycles));

    // Initialize random market phases at game start
    dispatch(initializeRandomPhases());

    // Set initial cash for the player and save to settings
    dispatch(setInitialCash(startingCash));
    dispatch(resetPortfolio(startingCash));

    // Reinitialize virtual players with the new starting cash
    // In timed game mode, all VPs get the same starting cash as the player
    const isTimedGame = gameDurationCycles !== null;
    dispatch(reinitializePlayers({ count: virtualPlayerCount, playerInitialCash: startingCash, isTimedGame }));

    setIsWarmingUp(true);
    setWarmupProgress(0);

    const warmupCycles = CONFIG.warmupCycles;
    // Prioritization starts after 2/3 of cycles
    const prioritizeAfterCycle = Math.floor(warmupCycles * 0.66);
    // Minimum 2 trades per stock to count as "traded"
    const minTradesRequired = 2;

    // Initialize trade tracking for warmup
    let tradeCounts: Record<string, number> = {};

    // Execute warmup cycles (with trade tracking and prioritization)
    for (let i = 0; i < warmupCycles; i++) {
      // Get current state for market phase calculations
      const currentState = store.getState();
      const currentStocks = currentState.stocks.items;

      // Update sector momentum based on current stock performance
      dispatch(updateSectorState(currentStocks));

      // Get sector influences from updated state
      const stateAfterSectorUpdate = store.getState();
      const sectorInfluences = selectSectorInfluences(stateAfterSectorUpdate);

      // Get market phases for volatility calculation
      const globalPhase = selectGlobalPhase(stateAfterSectorUpdate);
      const sectorPhases = selectSectorPhases(stateAfterSectorUpdate);

      // Calculate volatility multipliers based on current phases
      const volatilityMultipliers: Record<string, number> = {};
      for (const stock of currentStocks) {
        volatilityMultipliers[stock.symbol] = getVolatilityMultiplier(
          stock.symbol,
          globalPhase,
          sectorPhases
        );
      }

      // Update prices with market phase effects
      dispatch(updatePrices({
        sectorInfluences,
        volatilityMultipliers,
      }));

      // Warmup trades with prioritization for untraded stocks
      tradeCounts = dispatch(executeWarmupVirtualTrades({
        tradeCounts,
        prioritizeAfterCycle,
        currentCycle: i,
        minTradesRequired,
      }) as unknown as Parameters<typeof dispatch>[0]) as unknown as Record<string, number>;

      // Update progress (every 5 cycles for performance)
      if ((i + 1) % 5 === 0 || i === warmupCycles - 1) {
        setWarmupProgress(Math.round(((i + 1) / warmupCycles) * 100));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // At the end: Force trades for stocks that were never traded
    dispatch(forceTradesForUntraded(tradeCounts) as unknown as Parameters<typeof dispatch>[0]);

    // Perform silent splits (without notifications) for stocks over $750
    dispatch(applySilentStockSplits() as unknown as Parameters<typeof dispatch>[0]);

    // Reset trade counter (warmup trades don't count)
    dispatch(resetTradeCount());

    // Initialize Market Maker inventory for all stocks
    const stockSymbols = stocks.map(s => s.symbol);
    dispatch(initializeInventory(stockSymbols));

    // In timed games, reset VPs after warmup to ensure fair competition
    // VPs keep their risk tolerance but start with same cash as player (no holdings/loans)
    if (isTimedGame) {
      dispatch(resetPlayersForTimedGame({ playerInitialCash: startingCash }));
    }

    // Initialize float tracking for all stocks
    // Must be after VP reset so holdings are accurate
    const currentState = store.getState();
    dispatch(initializeFloats({
      stocks: currentState.stocks.items,
      playerHoldings: currentState.portfolio.holdings,
      virtualPlayers: currentState.virtualPlayers.players,
    }));

    setIsWarmingUp(false);
    setShowStartModal(false);
  };

  const tradeStock = stocks.find(s => s.symbol === tradeModal.symbol);

  return (
    <div className={`app ${isGameEnded || endScreenPreview ? 'app--overlay-active' : ''}`}>
      <AppHeader
        onOpenHelp={() => dispatch(openHelp())}
        onOpenSettings={() => dispatch(openSettings())}
      />

      <main className={`main ${tradeModal.isOpen ? 'main--trading' : ''}`}>
        <div className="left-panel">
          {theme === 'medieval' && (
            <img src={`${import.meta.env.BASE_URL}assets/img/portfolio_bg.jpg`} alt="" className="panel-bg" aria-hidden="true" />
          )}
          <Portfolio
            portfolio={portfolio}
            stocks={stocks}
            selectedStock={selectedStock}
            pendingOrders={pendingOrders}
            failedOrderIds={failedOrderIds}
            reservedCash={reservedCash}
            totalDebt={totalDebt}
            onSelectStock={handlePortfolioSelectStock}
            onCancelOrder={handleCancelOrder}
            onEditOrder={handleEditOrder}
            onCoverPosition={(symbol) => {
              handleTrade(symbol, 'buyToCover');
              scrollToTradePanel();
            }}
            onAddMargin={handleAddMargin}
          />
        </div>

        <div className="center-panel">
          {theme === 'medieval' && (
            <img src={`${import.meta.env.BASE_URL}assets/img/chart_bg.jpg`} alt="" className="panel-bg" aria-hidden="true" />
          )}
          <div className={`center-panel__chart ${tradeModal.isOpen ? 'center-panel__chart--blurred' : ''}`}>
            <ChartPanel
              stocks={stocks}
              portfolio={portfolio}
              selectedStock={selectedStock}
              symbolsWithPendingOrders={symbolsWithPendingOrders}
              theme={theme}
              isWarmingUp={isWarmingUp}
              warmupProgress={warmupProgress}
              onSelectStock={handlePortfolioSelectStock}
              onTrade={handleTrade}
            />
          </div>
          {tradeModal.isOpen && (
            <div className="center-panel__trade-overlay">
              <div className="trade-panel-container">
                <TradePanel
                  key={`${tradeModal.symbol}-${tradeModal.type}-${editingOrder?.id ?? 'new'}`}
                  stock={tradeStock ?? null}
                  tradeType={tradeModal.type}
                  portfolio={portfolio}
                  gameMode={gameMode}
                  isSymbolTradedThisCycle={tradeModal.symbol ? tradedSymbolsThisCycle.includes(tradeModal.symbol) : false}
                  reservedCash={reservedCash}
                  reservedSharesForSymbol={reservedSharesForSymbol}
                  editingOrder={editingOrder ?? undefined}
                  onClose={handleCloseTradePanel}
                  onTrade={executeTrade}
                />
              </div>
            </div>
          )}
        </div>

        <div className="right-panel">
          {theme === 'medieval' && (
            <img src={`${import.meta.env.BASE_URL}assets/img/stocklist_bg.jpg`} alt="" className="panel-bg" aria-hidden="true" />
          )}
          <StockList
            stocks={stocks}
            selectedStock={selectedStock}
            onSelectStock={handleStockListSelectStock}
          />
        </div>
      </main>

      {settingsOpen && (
        <SettingsSidebar
          currentTheme={theme}
          currentLanguage={language}
          hasSavedGame={savedGameExists}
          onClose={() => dispatch(closeSettings())}
          onThemeChange={setTheme}
          onLanguageChange={handleLanguageChange}
          onResetGame={handlePlayAgain}
          onSaveGame={handleSaveGame}
          onLoadGame={handleLoadGame}
        />
      )}

      {helpOpen && <Help onClose={() => dispatch(closeHelp())} />}

      {loanModalOpen && <Loan />}

      {(isGameEnded || endScreenPreview) && (
        <GameEnd
          onPlayAgain={handlePlayAgain}
          hasSavedGame={hasSavedGame()}
          onLoadGame={handleLoadGame}
          onContinueGame={handleContinueGame}
          theme={theme}
          isPreview={endScreenPreview}
        />
      )}

      <AppControlPanel
        players={virtualPlayers}
        stocks={stocks}
        totalTradeCount={totalTradeCount}
        gameMode={gameMode}
        debugMarketVisible={isDebugMarketVisible}
        marketMakerLevels={marketMakerLevels}
        globalPhase={globalPhase}
        sectorPhases={sectorPhases}
        fearGreedIndex={fearGreedIndex}
        isPaused={isPaused}
        isEffectivelyPaused={isEffectivelyPaused}
        countdown={countdown}
        updateInterval={Math.ceil(effectiveInterval)}
        speedMultiplier={speedMultiplier}
        onTogglePause={() => dispatch(togglePause())}
        onSetSpeed={(speed: SpeedMultiplier) => dispatch(setSpeedMultiplier(speed))}
        remainingCycles={remainingCycles}
        gameProgress={gameProgress}
        gameDuration={gameDuration}
      />

      <NotificationToast
        onEditFailedOrder={handleEditFailedOrder}
        onDeleteFailedOrder={handleDeleteFailedOrder}
      />

      {showStartModal && (
        <GameStart
          defaultGameMode={gameMode}
          isWarmingUp={isWarmingUp}
          warmupProgress={warmupProgress}
          currentTheme={theme}
          hasSavedGame={savedGameExists}
          onStart={handleStartGame}
          onThemeChange={setTheme}
          onContinueGame={handleLoadGame}
        />
      )}

      <DebugModal />
    </div>
  );
}

export default App;
