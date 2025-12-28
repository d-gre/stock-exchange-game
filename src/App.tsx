import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { updatePrices, resetStocks, applySilentStockSplits } from './store/stocksSlice';
import { resetPortfolio } from './store/portfolioSlice';
import { executeWarmupVirtualTrades, forceTradesForUntraded, reinitializePlayers, resetTradeCount } from './store/virtualPlayersSlice';
import { setUpdateInterval, resetCountdown, togglePause, setGameMode, setSpeedMultiplier, setLanguage, setInitialCash, type SpeedMultiplier } from './store/settingsSlice';
import { selectStock, closeTradeModal, openSettings, closeSettings, openHelp, closeHelp } from './store/uiSlice';
import { clearAllOrders, selectTradedSymbolsThisCycle, selectReservedCash, selectReservedSharesBySymbol, selectAllPendingOrders, selectSymbolsWithPendingOrders } from './store/pendingOrdersSlice';
import { resetTradeHistory } from './store/tradeHistorySlice';
import { useGameCycle } from './hooks/useGameCycle';
import { useTrading } from './hooks/useTrading';
import { canPlayerTrade } from './utils/tradingMechanics';
import { CONFIG } from './config';
import { useTheme } from './hooks/useTheme';
import { useLatinEasterEgg } from './hooks/useLatinEasterEgg';
import { setStoredLanguage, type Language } from './i18n';
import type { GameMode } from './types';

import { StockList } from './components/StockList';
import { Portfolio } from './components/Portfolio';
import { TradePanel } from './components/TradePanel';
import { SettingsModal } from './components/SettingsModal';
import { AppControlPanel } from './components/AppControlPanel';
import { NotificationToast } from './components/NotificationToast';
import { ChartPanel } from './components/ChartPanel';
import { GameStart } from './components/GameStart';
import { HelpModal } from './components/HelpModal';
import './App.css';

const App = () => {
  const dispatch = useAppDispatch();
  const { i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [showStartModal, setShowStartModal] = useState(true);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [warmupProgress, setWarmupProgress] = useState(0);

  // Selectors
  const stocks = useAppSelector(state => state.stocks.items);
  const portfolio = useAppSelector(state => state.portfolio);
  const virtualPlayers = useAppSelector(state => state.virtualPlayers.players);
  const totalTradeCount = useAppSelector(state => state.virtualPlayers.totalTradeCount);
  const { updateInterval, virtualPlayerCount, gameMode, language, initialCash } = useAppSelector(state => state.settings);
  const { selectedStock, tradeModal, settingsOpen, helpOpen } = useAppSelector(state => state.ui);

  // Sync i18n language with Redux state
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const handleLanguageChange = (newLanguage: Language): void => {
    dispatch(setLanguage(newLanguage));
    setStoredLanguage(newLanguage);
  };

  // Easter Egg: Ctrl+L toggles Latin
  useLatinEasterEgg(language, handleLanguageChange);
  const tradedSymbolsThisCycle = useAppSelector(selectTradedSymbolsThisCycle);
  const reservedCash = useAppSelector(selectReservedCash);
  const pendingOrders = useAppSelector(selectAllPendingOrders);
  const symbolsWithPendingOrders = useAppSelector(selectSymbolsWithPendingOrders);
  const reservedSharesForSymbol = useAppSelector(state =>
    tradeModal.symbol ? selectReservedSharesBySymbol(state, tradeModal.symbol) : 0
  );

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
  } = useTrading({ stocks, portfolio, gameMode });

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

    const stock = stocks.find(s => s.symbol === tradeModal.symbol);
    if (!stock) return false;

    const holding = portfolio.holdings.find(h => h.symbol === tradeModal.symbol);

    return canPlayerTrade({
      tradeType: tradeModal.type,
      symbol: tradeModal.symbol,
      stockPrice: stock.currentPrice,
      cash: portfolio.cash,
      sharesOwned: holding?.shares ?? 0,
      tradedSymbolsThisCycle,
      reservedCash,
      reservedShares: reservedSharesForSymbol,
    });
  }, [tradeModal, tradedSymbolsThisCycle, stocks, portfolio, reservedCash, reservedSharesForSymbol, editingOrder]);

  // Game Cycle Hook - verwaltet Timer, Countdown und Update-Zyklen
  const { effectiveInterval, isEffectivelyPaused, countdown, isPaused, speedMultiplier } = useGameCycle({
    isGameStarted: !showStartModal,
    canTradeInPanel,
    totalPortfolioValue,
  });

  const handleGameModeChange = (newMode: GameMode): void => {
    dispatch(setGameMode(newMode));
    dispatch(resetStocks());
    dispatch(resetPortfolio());
    dispatch(clearAllOrders());
    dispatch(resetTradeHistory());
    dispatch(reinitializePlayers({ count: virtualPlayerCount, playerInitialCash: initialCash }));
    dispatch(resetCountdown());
    dispatch(closeTradeModal());
    dispatch(selectStock(''));  // Reset to no selection
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

  const handleStartGame = async (selectedMode: GameMode, startingCash: number): Promise<void> => {
    if (selectedMode !== gameMode) {
      handleGameModeChange(selectedMode);
    }

    // Set initial cash for the player and save to settings
    dispatch(setInitialCash(startingCash));
    dispatch(resetPortfolio(startingCash));

    // Reinitialize virtual players with the new starting cash
    dispatch(reinitializePlayers({ count: virtualPlayerCount, playerInitialCash: startingCash }));

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
      dispatch(updatePrices());

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
    setIsWarmingUp(false);
    setShowStartModal(false);
  };

  const tradeStock = stocks.find(s => s.symbol === tradeModal.symbol);

  return (
    <div className="app">
      <header className="header">
        <h1><img src={`${import.meta.env.BASE_URL}assets/logo.svg`} alt="Logo" className="header-logo" />D-GRE Stock Exchange</h1>
      </header>

      <main className="main">
        <div className="left-panel">
          <Portfolio
            portfolio={portfolio}
            stocks={stocks}
            selectedStock={selectedStock}
            pendingOrders={pendingOrders}
            reservedCash={reservedCash}
            onSelectStock={handlePortfolioSelectStock}
            onCancelOrder={handleCancelOrder}
            onEditOrder={handleEditOrder}
          />
        </div>

        <div className="center-panel">
          {tradeModal.isOpen ? (
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
          ) : (
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
          )}
        </div>

        <div className="right-panel">
          <StockList
            stocks={stocks}
            selectedStock={selectedStock}
            onSelectStock={handleStockListSelectStock}
          />
        </div>
      </main>

      {settingsOpen && (
        <SettingsModal
          currentInterval={updateInterval}
          currentTheme={theme}
          currentLanguage={language}
          onClose={() => dispatch(closeSettings())}
          onSave={(newInterval) => {
            dispatch(setUpdateInterval(newInterval));
          }}
          onThemeChange={setTheme}
          onLanguageChange={handleLanguageChange}
        />
      )}

      {helpOpen && <HelpModal onClose={() => dispatch(closeHelp())} />}

      <AppControlPanel
        players={virtualPlayers}
        stocks={stocks}
        totalTradeCount={totalTradeCount}
        isPaused={isPaused}
        isEffectivelyPaused={isEffectivelyPaused}
        countdown={countdown}
        updateInterval={Math.ceil(effectiveInterval)}
        speedMultiplier={speedMultiplier}
        onTogglePause={() => dispatch(togglePause())}
        onSetSpeed={(speed: SpeedMultiplier) => dispatch(setSpeedMultiplier(speed))}
        onOpenHelp={() => dispatch(openHelp())}
        onOpenSettings={() => dispatch(openSettings())}
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
          onStart={handleStartGame}
        />
      )}
    </div>
  );
}

export default App;
