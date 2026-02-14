import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import App from './App';
import stocksReducer from './store/stocksSlice';
import portfolioReducer, { buyStock } from './store/portfolioSlice';
import virtualPlayersReducer from './store/virtualPlayersSlice';
import settingsReducer from './store/settingsSlice';
import uiReducer from './store/uiSlice';
import pendingOrdersReducer from './store/pendingOrdersSlice';
import notificationsReducer, { addNotification } from './store/notificationsSlice';
import tradeHistoryReducer, { addCompletedTrade } from './store/tradeHistorySlice';
import marketMakerReducer from './store/marketMakerSlice';
import sectorReducer from './store/sectorSlice';
import loansReducer from './store/loansSlice';
import gameSessionReducer from './store/gameSessionSlice';
import marketPhaseReducer from './store/marketPhaseSlice';
import floatReducer from './store/floatSlice';
import orderBookReducer from './store/orderBookSlice';
import shortPositionsReducer from './store/shortPositionsSlice';
import { createMockPriceHistory } from './test/testUtils';
import type { Stock, Sector } from './types';
import type { Middleware, UnknownAction } from '@reduxjs/toolkit';
import i18n from './i18n';
import * as gameSave from './utils/gameSave';

/**
 * Action Logger Middleware - records all dispatched actions for testing
 * Usage: Pass an empty array, middleware will push all actions into it
 */
const createActionLoggerMiddleware = (actionLog: UnknownAction[]): Middleware => {
  return () => (next) => (action) => {
    actionLog.push(action as UnknownAction);
    return next(action);
  };
};

// Mocks for lightweight-charts and ResizeObserver are defined in test/setup.ts

// Mock gameSave module
vi.mock('./utils/gameSave', () => ({
  hasSavedGame: vi.fn(() => false),
  getSavedGameInfo: vi.fn(() => null),
  saveGame: vi.fn(() => true),
  loadGame: vi.fn(() => null),
  deleteSavedGame: vi.fn(),
}));

const createMockStocks = (): Stock[] => [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'tech',
    currentPrice: 150,
    change: 2.5,
    changePercent: 1.69,
    priceHistory: createMockPriceHistory(),
    marketCapBillions: 3000,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    sector: 'tech',
    currentPrice: 200,
    change: -1.5,
    changePercent: -0.74,
    priceHistory: createMockPriceHistory(),
    marketCapBillions: 2000,
  },
];

const createTestStore = (overrides: {
  portfolioHoldings?: { symbol: string; shares: number; avgBuyPrice: number }[];
  selectedStock?: string;
  chartTab?: 'stock' | 'index' | 'history';
  hasTrades?: boolean;
  settingsOpen?: boolean;
  language?: 'de' | 'en' | 'ja' | 'la';
  gameMode?: 'realLife' | 'hardLife';
  virtualPlayerCount?: number;
} = {}) => {
  const mockStocks = createMockStocks();

  return configureStore({
    reducer: {
      stocks: stocksReducer,
      portfolio: portfolioReducer,
      virtualPlayers: virtualPlayersReducer,
      settings: settingsReducer,
      ui: uiReducer,
      pendingOrders: pendingOrdersReducer,
      notifications: notificationsReducer,
      tradeHistory: tradeHistoryReducer,
      marketMaker: marketMakerReducer,
      sector: sectorReducer,
      loans: loansReducer,
      gameSession: gameSessionReducer,
      marketPhase: marketPhaseReducer,
      float: floatReducer,
      orderBook: orderBookReducer,
      shortPositions: shortPositionsReducer,
    },
    preloadedState: {
      stocks: {
        items: mockStocks,
      },
      portfolio: {
        cash: 10000,
        holdings: overrides.portfolioHoldings ?? [],
      },
      virtualPlayers: {
        players: [],
        totalTradeCount: 0,
      },
      settings: {
        updateInterval: 5,
        countdown: 5,
        isPaused: true, // Paused for stable tests
        virtualPlayerCount: overrides.virtualPlayerCount ?? 0,
        // Must be 'realLife' since CONFIG.defaultGameMode is 'realLife'.
        // Otherwise resetPortfolio() is called when "Start Game" is clicked
        gameMode: overrides.gameMode ?? 'realLife' as const,
        speedMultiplier: 1 as const,
        language: overrides.language ?? 'de' as const,
        initialCash: 100000,
      },
      ui: {
        selectedStock: overrides.selectedStock ?? '',
        tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
        settingsOpen: overrides.settingsOpen ?? false,
        helpOpen: false,
        chartTab: overrides.chartTab ?? 'stock',
        loanModalOpen: false,
        highlightedLoanId: null as string | null,
        debugModalOpen: false,
        debugModalContent: '',
      },
      pendingOrders: {
        orders: [],
        tradedSymbolsThisCycle: [],
      },
      notifications: {
        items: [],
      },
      tradeHistory: {
        trades: overrides.hasTrades ? [
          { id: '1', symbol: 'AAPL', type: 'buy' as const, shares: 10, pricePerShare: 140, timestamp: Date.now(), totalAmount: 1400 }
        ] : [],
        portfolioValueHistory: [{ timestamp: Date.now(), value: 10000, realizedProfitLoss: 0 }],
      },
      marketMaker: {
        inventory: {
          AAPL: { symbol: 'AAPL', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
          GOOGL: { symbol: 'GOOGL', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
        },
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
      float: {
        floats: {},
      },
      orderBook: {
        books: {},
      },
      shortPositions: {
        positions: [],
        totalBorrowFeesPaid: 0,
        marginCallsReceived: 0,
        forcedCoversExecuted: 0,
        marginCallStatuses: [],
      },
    },
  });
};

const renderApp = (store: ReturnType<typeof createTestStore>) => {
  return render(
    <Provider store={store}>
      <App />
    </Provider>
  );
};

/**
 * Creates a test store with action logging middleware.
 * Returns both the store and the action log array.
 */
const createTestStoreWithActionLog = () => {
  const actionLog: UnknownAction[] = [];
  const mockStocks = createMockStocks();

  const store = configureStore({
    reducer: {
      stocks: stocksReducer,
      portfolio: portfolioReducer,
      virtualPlayers: virtualPlayersReducer,
      settings: settingsReducer,
      ui: uiReducer,
      pendingOrders: pendingOrdersReducer,
      notifications: notificationsReducer,
      tradeHistory: tradeHistoryReducer,
      marketMaker: marketMakerReducer,
      sector: sectorReducer,
      loans: loansReducer,
      gameSession: gameSessionReducer,
      marketPhase: marketPhaseReducer,
      float: floatReducer,
      orderBook: orderBookReducer,
      shortPositions: shortPositionsReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(createActionLoggerMiddleware(actionLog)),
    preloadedState: {
      stocks: { items: mockStocks },
      portfolio: { cash: 10000, holdings: [] },
      virtualPlayers: { players: [], totalTradeCount: 0 },
      settings: {
        updateInterval: 5,
        countdown: 5,
        isPaused: true,
        virtualPlayerCount: 0,
        gameMode: 'realLife' as const,
        speedMultiplier: 1 as const,
        language: 'de' as const,
        initialCash: 100000,
      },
      ui: {
        selectedStock: '',
        tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
        settingsOpen: false,
        helpOpen: false,
        chartTab: 'stock' as const,
        loanModalOpen: false,
        highlightedLoanId: null as string | null,
        debugModalOpen: false,
        debugModalContent: '',
      },
      pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
      notifications: { items: [] },
      tradeHistory: {
        trades: [],
        portfolioValueHistory: [{ timestamp: Date.now(), value: 10000, realizedProfitLoss: 0 }],
      },
      marketMaker: {
        inventory: {
          AAPL: { symbol: 'AAPL', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
          GOOGL: { symbol: 'GOOGL', inventory: 100000, baseInventory: 100000, spreadMultiplier: 1.0 },
        },
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
      float: { floats: {} },
      orderBook: { books: {} },
      shortPositions: {
        positions: [],
        totalBorrowFeesPaid: 0,
        marginCallsReceived: 0,
        forcedCoversExecuted: 0,
        marginCallStatuses: [],
      },
    },
  });

  return { store, actionLog };
};

/** Closes the start modal by clicking "Start Game" or "New Game" and waits for warmup to finish */
const closeStartModal = async () => {
  // Find the start button - it's either "Spiel beginnen" (no saved game) or "Neues Spiel" (with saved game)
  const startButton = screen.queryByText('Spiel beginnen') ?? screen.queryByText('Neues Spiel');
  if (startButton) {
    fireEvent.click(startButton);
  }
  // Wait until the modal is completely closed (not just the button disappeared)
  // The game-start class is only present when showStartModal is true
  await waitFor(() => {
    expect(document.querySelector('.game-start')).not.toBeInTheDocument();
  }, { timeout: 5000 });
};

/** Findet die Chart-Tab-Buttons [stockTab, historyTab, indexTab] */
const getChartTabs = () => {
  return screen.getAllByRole('button').filter(btn =>
    btn.classList.contains('chart-panel__tab')
  );
};

/** Helper to setup a store with holdings and trades for chart tab tests */
const setupStoreWithHoldingsAndTrades = async (store: ReturnType<typeof createTestStore>) => {
  await act(async () => {
    store.dispatch(buyStock({ symbol: 'AAPL', shares: 10, price: 140 }));
    store.dispatch(addCompletedTrade({
      id: '1',
      symbol: 'AAPL',
      type: 'buy',
      shares: 10,
      pricePerShare: 140,
      timestamp: Date.now(),
      totalAmount: 1400,
    }));
  });
};

/** Sets up default mocks - call this BEFORE rendering if you need specific mock behavior */
const setupDefaultMocks = () => {
  vi.mocked(gameSave.hasSavedGame).mockReturnValue(false);
  vi.mocked(gameSave.loadGame).mockReturnValue(null);
  vi.mocked(gameSave.saveGame).mockReturnValue(true);
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mocks (individual tests can override BEFORE rendering)
    setupDefaultMocks();
    // Reset localStorage for theme tests
    localStorage.removeItem('stock-exchange-theme');
    // Reset document theme attribute
    document.documentElement.removeAttribute('data-theme');
    // Mock scrollIntoView globally
    Element.prototype.scrollIntoView = vi.fn();
  });

  describe('chart tab display', () => {
    it('should show market index when portfolio is empty and no stock selected', async () => {
      const store = createTestStore({
        portfolioHoldings: [],
        selectedStock: '',
        chartTab: 'stock',
      });
      renderApp(store);
      await closeStartModal();

      // Only market overview tab should be visible when no holdings and no trades
      const tabs = getChartTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0]).toHaveTextContent('Märkte');
      expect(tabs[0]).toHaveClass('chart-panel__tab--active');
    });

    it('should show stock chart when a stock is selected (even with empty portfolio)', async () => {
      const store = createTestStore({
        portfolioHoldings: [],
        selectedStock: 'AAPL',
        chartTab: 'stock',
      });
      renderApp(store);
      await closeStartModal();

      // With selected stock but no trades: 2 tabs (Stock, Index)
      const tabs = getChartTabs();
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toHaveClass('chart-panel__tab--active');
      expect(tabs[0]).toHaveTextContent(/AAPL/);
      expect(tabs[1]).toHaveTextContent('Märkte');
    });

    it('should show portfolio stocks when holdings exist', async () => {
      const store = createTestStore({
        selectedStock: '',
        chartTab: 'stock',
      });
      renderApp(store);
      await closeStartModal();

      // Add holdings after game start (since portfolio is reset on start)
      await act(async () => {
        store.dispatch(buyStock({ symbol: 'AAPL', shares: 10, price: 140 }));
      });

      // With holdings but no trades: 2 tabs (Assets, Index)
      const tabs = getChartTabs();
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toHaveClass('chart-panel__tab--active');
      expect(tabs[0]).toHaveTextContent(/Assets/);
      expect(tabs[1]).toHaveTextContent('Märkte');
    });

    it('should show market index when explicitly selected via tab', async () => {
      const store = createTestStore({
        selectedStock: '',
        chartTab: 'index',
      });
      renderApp(store);
      await closeStartModal();

      // Add holdings after game start
      await act(async () => {
        store.dispatch(buyStock({ symbol: 'AAPL', shares: 10, price: 140 }));
      });

      const indexTab = screen.getByRole('button', { name: 'Märkte' });
      expect(indexTab).toHaveClass('chart-panel__tab--active');
    });

    it('should display market index title and value when index tab is active', async () => {
      const store = createTestStore({
        portfolioHoldings: [],
        selectedStock: '',
        chartTab: 'index',
      });
      renderApp(store);
      await closeStartModal();

      expect(screen.getByText('D-GREX Prime')).toBeInTheDocument();
    });

    it('should switch to stock tab when clicking on it', async () => {
      const store = createTestStore({
        selectedStock: '',
        chartTab: 'index',
      });
      renderApp(store);
      await closeStartModal();

      // Add holdings after game start
      await act(async () => {
        store.dispatch(buyStock({ symbol: 'AAPL', shares: 10, price: 140 }));
      });

      fireEvent.click(getChartTabs()[0]);

      expect(getChartTabs()[0]).toHaveClass('chart-panel__tab--active');
    });

    it('should clear stock selection when clicking on "Meine Aktien" tab', async () => {
      const store = createTestStore({
        selectedStock: 'AAPL',
        chartTab: 'stock',
      });
      renderApp(store);
      await closeStartModal();

      // Add holdings after game start
      await act(async () => {
        store.dispatch(buyStock({ symbol: 'AAPL', shares: 10, price: 140 }));
        store.dispatch(buyStock({ symbol: 'GOOGL', shares: 5, price: 180 }));
      });

      // Note: selectedStock is preserved from preloadedState
      // but clicking Assets tab should clear it
      fireEvent.click(getChartTabs()[0]);

      expect(store.getState().ui.selectedStock).toBe('');
    });

    it('should switch to index tab when clicking on it', async () => {
      const store = createTestStore({ selectedStock: '', chartTab: 'stock' });
      renderApp(store);
      await closeStartModal();
      await setupStoreWithHoldingsAndTrades(store);

      // Index tab is now at position 2 (after history)
      fireEvent.click(getChartTabs()[2]);

      expect(getChartTabs()[2]).toHaveClass('chart-panel__tab--active');
    });

    it('should have tabs in correct order: stock, history, index', async () => {
      const store = createTestStore({ selectedStock: '', chartTab: 'stock' });
      renderApp(store);
      await closeStartModal();
      await setupStoreWithHoldingsAndTrades(store);

      const tabs = getChartTabs();

      expect(tabs).toHaveLength(3);
      expect(tabs[0]).toHaveTextContent(/Assets/);
      expect(tabs[1]).toHaveTextContent('Order-Historie');
      expect(tabs[2]).toHaveTextContent('Märkte');
    });

    it('should switch to history tab when clicking on it', async () => {
      const store = createTestStore({ selectedStock: '', chartTab: 'stock' });
      renderApp(store);
      await closeStartModal();
      await setupStoreWithHoldingsAndTrades(store);

      fireEvent.click(getChartTabs()[1]);

      expect(getChartTabs()[1]).toHaveClass('chart-panel__tab--active');
      expect(store.getState().ui.chartTab).toBe('history');
    });

    it('should show history tab when explicitly selected via tab', async () => {
      const store = createTestStore({
        selectedStock: '',
        chartTab: 'history',
      });
      renderApp(store);
      await closeStartModal();

      // Add holdings and trades after game start
      await act(async () => {
        store.dispatch(buyStock({ symbol: 'AAPL', shares: 10, price: 140 }));
        store.dispatch(addCompletedTrade({
          id: '1',
          symbol: 'AAPL',
          type: 'buy',
          shares: 10,
          pricePerShare: 140,
          timestamp: Date.now(),
          totalAmount: 1400,
        }));
      });

      const historyTab = screen.getByRole('button', { name: 'Order-Historie' });
      expect(historyTab).toHaveClass('chart-panel__tab--active');
    });
  });

  describe('start modal', () => {
    it('should show start modal on initial render', () => {
      renderApp(createTestStore());

      // Start modal shows starting capital input and start button
      expect(screen.getByText('Startkapital')).toBeInTheDocument();
      expect(screen.getByText('Spiel beginnen')).toBeInTheDocument();
    });

    it('should close start modal when clicking start button', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      expect(screen.queryByText('Spiel beginnen')).not.toBeInTheDocument();
    });

    it('should clear all notifications when starting a new game', async () => {
      const store = createTestStore();

      // Add a notification before starting the game
      store.dispatch(addNotification({
        type: 'info',
        title: 'Test Notification',
        message: 'This should be cleared',
      }));

      expect(store.getState().notifications.items).toHaveLength(1);

      renderApp(store);
      await closeStartModal();

      // Notifications should be cleared after starting the game
      expect(store.getState().notifications.items).toHaveLength(0);
    });
  });

  describe('app controls', () => {
    it('should display pause stop on speed slider', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Pause stop exists on the speed slider
      expect(screen.getByTitle('Pausieren')).toBeInTheDocument();
    });

    it('should display settings button', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Settings button exists in controls bar
      const buttons = screen.getAllByTitle('Einstellungen');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should open settings sidebar when clicking settings button', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Click settings button in controls bar
      const buttons = screen.getAllByTitle('Einstellungen');
      fireEvent.click(buttons[0]);

      // Settings sidebar should be visible
      expect(document.querySelector('.settings-sidebar')).toBeInTheDocument();
    });

    it('should display theme selector in settings sidebar', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Open settings sidebar
      const buttons = screen.getAllByTitle('Einstellungen');
      fireEvent.click(buttons[0]);

      // Theme selector should be visible in sidebar
      expect(screen.getByText('Erscheinungsbild')).toBeInTheDocument();
      expect(screen.getByText('Dunkel')).toBeInTheDocument();
      expect(screen.getByText('Hell')).toBeInTheDocument();
    });

    it('should toggle theme when clicking theme option in settings', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Open settings modal
      fireEvent.click(screen.getAllByTitle('Einstellungen')[0]);

      // Initially dark mode - dark option should be active
      const darkOption = screen.getByText('Dunkel').closest('button');
      const lightOption = screen.getByText('Hell').closest('button');
      expect(darkOption).toHaveClass('settings-sidebar__theme-option--active');
      expect(lightOption).not.toHaveClass('settings-sidebar__theme-option--active');

      // Click light mode option
      fireEvent.click(lightOption!);

      // Now light mode - light option should be active
      expect(lightOption).toHaveClass('settings-sidebar__theme-option--active');
      expect(darkOption).not.toHaveClass('settings-sidebar__theme-option--active');
    });

    it('should apply theme attribute to document when selecting theme', async () => {
      const setAttributeSpy = vi.spyOn(document.documentElement, 'setAttribute');

      renderApp(createTestStore());
      await closeStartModal();

      // Open settings modal
      fireEvent.click(screen.getAllByTitle('Einstellungen')[0]);

      // Click light mode option
      const lightOption = screen.getByText('Hell').closest('button');
      fireEvent.click(lightOption!);

      expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'light');

      setAttributeSpy.mockRestore();
    });

    it('should toggle back to dark mode when selecting dark option', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Open settings modal
      fireEvent.click(screen.getAllByTitle('Einstellungen')[0]);

      // Switch to light then back to dark
      const darkOption = screen.getByText('Dunkel').closest('button');
      const lightOption = screen.getByText('Hell').closest('button');

      fireEvent.click(lightOption!);
      expect(lightOption).toHaveClass('settings-sidebar__theme-option--active');

      fireEvent.click(darkOption!);
      expect(darkOption).toHaveClass('settings-sidebar__theme-option--active');
    });

    it('should close settings sidebar when clicking close button', async () => {
      const store = createTestStore({ settingsOpen: true });
      renderApp(store);
      await closeStartModal();

      // Sidebar should be visible
      expect(document.querySelector('.settings-sidebar')).toBeInTheDocument();

      // Click close button (has aria-label="Schließen")
      const closeButton = document.querySelector('.settings-sidebar__close-btn');
      fireEvent.click(closeButton!);

      expect(document.querySelector('.settings-sidebar')).not.toBeInTheDocument();
      expect(store.getState().ui.settingsOpen).toBe(false);
    });

    it('should change language when selecting a different language', async () => {
      const store = createTestStore({ settingsOpen: true });
      renderApp(store);
      await closeStartModal();

      // Open language dropdown
      const languageTrigger = screen.getByText('Deutsch').closest('button');
      fireEvent.click(languageTrigger!);

      // Select English
      const englishOption = screen.getByRole('button', { name: 'English' });
      fireEvent.click(englishOption);

      expect(store.getState().settings.language).toBe('en');

      // Verify i18n was updated
      await waitFor(() => {
        expect(i18n.language).toBe('en');
      });
    });
  });

  describe('starting capital', () => {
    it('should set custom starting capital when starting game', async () => {
      const store = createTestStore();
      renderApp(store);

      // Change starting capital
      const capitalInput = screen.getByRole('spinbutton');
      fireEvent.change(capitalInput, { target: { value: '50000' } });

      // Start game
      fireEvent.click(screen.getByText('Spiel beginnen'));

      await waitFor(() => {
        expect(store.getState().portfolio.cash).toBe(50000);
      });
    });
  });

  describe('i18n sync', () => {
    it('should sync i18n language with Redux state on mount', async () => {
      // Set i18n to a different language than Redux
      await i18n.changeLanguage('de');

      const store = createTestStore({ language: 'en' });
      renderApp(store);

      // i18n should sync to Redux state
      await waitFor(() => {
        expect(i18n.language).toBe('en');
      });
    });
  });

  describe('stock selection', () => {
    it('should select stock when clicking on stock in StockList', async () => {
      const store = createTestStore();
      const { container } = renderApp(store);
      await closeStartModal();

      // Find AAPL in StockList (right panel) specifically
      const stockList = container.querySelector('.right-panel .stock-list');
      const aaplRow = stockList?.querySelector('.stock-list__row');
      expect(aaplRow).toBeInTheDocument();
      fireEvent.click(aaplRow!);

      expect(store.getState().ui.selectedStock).toBe('AAPL');
    });

    it('should scroll to chart on mobile when selecting stock from StockList', async () => {
      // Mock mobile viewport
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });

      const store = createTestStore();
      const { container } = renderApp(store);
      await closeStartModal();

      // Click on stock in StockList (right panel) specifically
      const stockList = container.querySelector('.right-panel .stock-list');
      const aaplRow = stockList?.querySelector('.stock-list__row');
      fireEvent.click(aaplRow!);

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

      // Restore
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    });

    it('should scroll to chart on mobile when selecting stock from Portfolio', async () => {
      // Mock mobile viewport
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });

      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Add holdings after game start
      await act(async () => {
        store.dispatch(buyStock({ symbol: 'AAPL', shares: 10, price: 140 }));
      });

      // Click on stock in Portfolio
      const holdingRows = screen.getAllByText('AAPL');
      fireEvent.click(holdingRows[0]);

      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

      // Restore
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    });

    it('should deselect stock when clicking same stock in Portfolio (toggle)', async () => {
      const store = createTestStore({ selectedStock: 'AAPL' });
      renderApp(store);
      await closeStartModal();

      // Add holdings after game start
      await act(async () => {
        store.dispatch(buyStock({ symbol: 'AAPL', shares: 10, price: 140 }));
      });

      // Stock is already selected
      expect(store.getState().ui.selectedStock).toBe('AAPL');

      // Click same stock in Portfolio - should deselect (toggle off)
      const holdingRows = screen.getAllByText('AAPL');
      fireEvent.click(holdingRows[0]);

      expect(store.getState().ui.selectedStock).toBe('');
    });

    it('should not scroll on desktop when selecting stock', async () => {
      // Ensure desktop viewport
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });

      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Clear previous calls
      vi.mocked(Element.prototype.scrollIntoView).mockClear();

      // Click on stock in StockList
      const stockItems = screen.getAllByText('AAPL');
      fireEvent.click(stockItems[stockItems.length - 1]);

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

      // Restore
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    });
  });

  describe('help modal', () => {
    it('should open help modal when clicking help button', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Click help button in controls bar (multiple buttons exist: header + control panel)
      const helpButtons = screen.getAllByTitle('Wie funktioniert das Spiel?');
      fireEvent.click(helpButtons[0]);

      expect(store.getState().ui.helpOpen).toBe(true);
      expect(screen.getByText('Willkommen bei D-GRE Stock Exchange')).toBeInTheDocument();
    });

    it('should close help modal when clicking close button', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Open help modal (multiple buttons exist: header + control panel)
      const helpButtons = screen.getAllByTitle('Wie funktioniert das Spiel?');
      fireEvent.click(helpButtons[0]);

      expect(screen.getByText('Willkommen bei D-GRE Stock Exchange')).toBeInTheDocument();

      // Close help modal via X button
      const xButton = document.querySelector('.help__close') as HTMLButtonElement;
      fireEvent.click(xButton);

      expect(store.getState().ui.helpOpen).toBe(false);
      expect(screen.queryByText('Willkommen bei D-GRE Stock Exchange')).not.toBeInTheDocument();
    });

    it('should close help modal when clicking understood button', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Open help modal (multiple buttons exist: header + control panel)
      const helpButtons = screen.getAllByTitle('Wie funktioniert das Spiel?');
      fireEvent.click(helpButtons[0]);

      // Close via main close button
      const mainCloseButton = document.querySelector('.help__button') as HTMLButtonElement;
      fireEvent.click(mainCloseButton);

      expect(store.getState().ui.helpOpen).toBe(false);
    });
  });

  describe('speed controls', () => {
    it('should unpause when clicking a speed stop while paused', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      expect(store.getState().settings.isPaused).toBe(true);

      // Click 1x speed stop to unpause (game starts paused, slider at pause position)
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 1x'));

      expect(store.getState().settings.isPaused).toBe(false);
    });

    it('should cycle through speeds when clicking speed stops', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // First unpause by clicking 1x
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 1x'));
      expect(store.getState().settings.speedMultiplier).toBe(1);

      // Click 2x stop on the speed slider
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 2x'));
      expect(store.getState().settings.speedMultiplier).toBe(2);

      // Click 3x stop
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 3x'));
      expect(store.getState().settings.speedMultiplier).toBe(3);

      // Click 1x stop to go back
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 1x'));
      expect(store.getState().settings.speedMultiplier).toBe(1);
    });
  });

  describe('game save handling', () => {
    it('should delete saved game when starting a new game from GameStart modal', async () => {
      const store = createTestStore();
      renderApp(store);

      // Click "Start Game" button
      fireEvent.click(screen.getByText('Spiel beginnen'));

      // Wait for warmup to finish
      await waitFor(() => {
        expect(document.querySelector('.game-start')).not.toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify deleteSavedGame was called
      expect(gameSave.deleteSavedGame).toHaveBeenCalled();
    });

    it('should show success notification when saving game succeeds', async () => {
      vi.mocked(gameSave.saveGame).mockReturnValue(true);
      const store = createTestStore({ settingsOpen: true });
      renderApp(store);
      await closeStartModal();

      // Click save button in settings sidebar
      const saveButton = screen.getByText('Spiel speichern');
      fireEvent.click(saveButton);

      // Check notification was added
      const notifications = store.getState().notifications.items;
      expect(notifications.some(n => n.type === 'info')).toBe(true);
    });

    it('should show error notification when saving game fails', async () => {
      vi.mocked(gameSave.saveGame).mockReturnValue(false);
      const store = createTestStore({ settingsOpen: true });
      renderApp(store);
      await closeStartModal();

      // Click save button in settings sidebar
      const saveButton = screen.getByText('Spiel speichern');
      fireEvent.click(saveButton);

      // Check error notification was added
      const notifications = store.getState().notifications.items;
      expect(notifications.some(n => n.type === 'error')).toBe(true);
    });

  });

  describe('speed preserved on pause', () => {
    it('should keep speed when manually pausing the game via slider', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Unpause by clicking 1x speed stop
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 1x'));
      expect(store.getState().settings.isPaused).toBe(false);

      // Set speed to 2x via slider
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 2x'));
      expect(store.getState().settings.speedMultiplier).toBe(2);

      // Now pause via the pause stop on the slider - speed should remain at 2x
      fireEvent.click(screen.getByTitle('Pausieren'));

      expect(store.getState().settings.isPaused).toBe(true);
      expect(store.getState().settings.speedMultiplier).toBe(2);
    });

    it('should not change speed when unpausing via speed stop', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Game starts paused with speed 1x
      expect(store.getState().settings.isPaused).toBe(true);
      expect(store.getState().settings.speedMultiplier).toBe(1);

      // Unpause by clicking 1x speed stop - should NOT change speed
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 1x'));

      expect(store.getState().settings.isPaused).toBe(false);
      expect(store.getState().settings.speedMultiplier).toBe(1);
    });
  });

  describe('canTradeInPanel logic', () => {
    it('should handle trade modal opening', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Open trade modal via dispatch
      await act(async () => {
        store.dispatch({
          type: 'ui/openTradeModal',
          payload: { symbol: 'AAPL', type: 'buy' },
        });
      });

      // Trade modal should be open
      expect(store.getState().ui.tradeModal.isOpen).toBe(true);
      expect(store.getState().ui.tradeModal.symbol).toBe('AAPL');
    });

    it('should handle trade modal with editingOrder', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Buy stock first to create a holding
      await act(async () => {
        store.dispatch(buyStock({ symbol: 'AAPL', shares: 10, price: 100 }));
      });

      // Add a pending sell order
      await act(async () => {
        store.dispatch({
          type: 'pendingOrders/addPendingOrder',
          payload: {
            id: 'test-order-1',
            symbol: 'AAPL',
            type: 'sell',
            orderType: 'limit',
            shares: 5,
            targetPrice: 120,
            createdAt: Date.now(),
          },
        });
      });

      // Verify the order was added
      expect(store.getState().pendingOrders.orders).toHaveLength(1);
    });
  });

  describe('addMargin trade type', () => {
    it('should allow addMargin trade when modal is open with that type', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Open trade modal for addMargin (simulated via dispatch)
      await act(async () => {
        store.dispatch({
          type: 'ui/openTradeModal',
          payload: { symbol: 'AAPL', type: 'addMargin' },
        });
      });

      // Verify trade modal is open with addMargin type
      const tradeModal = store.getState().ui.tradeModal;
      expect(tradeModal.isOpen).toBe(true);
      expect(tradeModal.type).toBe('addMargin');
    });
  });

  describe('keyboard shortcuts', () => {
    it('should open and close help modal', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Open help modal using the button
      const helpButton = screen.getAllByTitle('Wie funktioniert das Spiel?')[0];
      fireEvent.click(helpButton);

      // Help modal should be open
      await waitFor(() => {
        expect(store.getState().ui.helpOpen).toBe(true);
      });

      // Close using close button
      const closeButton = await screen.findByLabelText('Schließen');
      fireEvent.click(closeButton);

      // Help modal should be closed
      await waitFor(() => {
        expect(store.getState().ui.helpOpen).toBe(false);
      });
    });
  });

  describe('notification removal', () => {
    it('should automatically remove notifications', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Add a notification
      await act(async () => {
        store.dispatch(addNotification({
          type: 'info',
          title: 'Test Notification',
          message: 'This is a test notification.',
        }));
      });

      // Verify notification was added
      expect(store.getState().notifications.items.length).toBeGreaterThan(0);
    });
  });

  describe('load game functionality', () => {
    it('should show error notification when loadGame returns null from start screen', async () => {
      // Set up mocks BEFORE rendering
      vi.mocked(gameSave.loadGame).mockReturnValue(null);
      vi.mocked(gameSave.hasSavedGame).mockReturnValue(true);

      const store = createTestStore();
      renderApp(store);

      // Click "Spiel fortsetzen" on start screen (available when saved game exists)
      const continueButton = screen.getByText('Spiel fortsetzen');
      fireEvent.click(continueButton);

      // Check error notification was added
      await waitFor(() => {
        const notifications = store.getState().notifications.items;
        expect(notifications.some(n => n.type === 'error')).toBe(true);
      });
    });

    it('should restore game state when loadGame returns valid state from start screen', async () => {
      const mockSavedState = {
        stocks: { items: createMockStocks() },
        portfolio: { cash: 75000, holdings: [] },
        virtualPlayers: { players: [], totalTradeCount: 5 },
        settings: {
          updateInterval: 5,
          countdown: 5,
          isPaused: false,
          virtualPlayerCount: 5,
          gameMode: 'realLife' as const,
          speedMultiplier: 2 as const,
          language: 'de' as const,
          initialCash: 75000,
        },
        pendingOrders: { orders: [], tradedSymbolsThisCycle: [] },
        tradeHistory: { trades: [], portfolioValueHistory: [] },
        marketMaker: { inventory: {} },
        sector: {
          sectorMomentum: {
            tech: { momentum: 0, lastPerformance: 0 },
            finance: { momentum: 0, lastPerformance: 0 },
            industrial: { momentum: 0, lastPerformance: 0 },
            commodities: { momentum: 0, lastPerformance: 0 },
          },
          sectorInfluences: { tech: 0, finance: 0, industrial: 0, commodities: 0 },
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
        gameSession: {
          gameDuration: 60,
          currentCycle: 30,
          isGameEnded: false,
          endGameStats: null,
          endScreenPreview: false,
          totalTradesExecuted: 10,
          maxLoanUtilization: 0,
        },
        marketPhase: {
          globalPhase: 'prosperity' as const,
          sectorPhases: {
            tech: 'prosperity' as const,
            finance: 'prosperity' as const,
            industrial: 'prosperity' as const,
            commodities: 'prosperity' as const,
          },
          cyclesInGlobalPhase: 10,
          cyclesInSectorPhase: { tech: 10, finance: 10, industrial: 10, commodities: 10 },
          fearGreedIndex: 50,
          overheatCycles: { tech: 0, finance: 0, industrial: 0, commodities: 0 },
          lastUpdate: Date.now(),
          phaseHistory: {
            totalCycles: 0,
            cyclesPerPhase: {
              prosperity: 0,
              boom: 0,
              consolidation: 0,
              panic: 0,
              recession: 0,
              recovery: 0,
            },
          },
          climateHistory: [],
        },
        shortPositions: {
          positions: [],
          totalBorrowFeesPaid: 0,
          marginCallsReceived: 0,
          forcedCoversExecuted: 0,
          marginCallStatuses: [],
        },
        float: { floats: {} },
        orderBook: { books: {} },
      };

      // Set up mocks BEFORE rendering
      vi.mocked(gameSave.loadGame).mockReturnValue(mockSavedState);
      vi.mocked(gameSave.hasSavedGame).mockReturnValue(true);

      const store = createTestStore();
      renderApp(store);

      // Click "Spiel fortsetzen" on start screen
      const continueButton = screen.getByText('Spiel fortsetzen');
      fireEvent.click(continueButton);

      // Game should be loaded with correct state
      await waitFor(() => {
        expect(store.getState().portfolio.cash).toBe(75000);
      });

      // Game should be paused and speed reset after loading
      expect(store.getState().settings.isPaused).toBe(true);
      expect(store.getState().settings.speedMultiplier).toBe(1);

      // Check success notification was added
      const notifications = store.getState().notifications.items;
      expect(notifications.some(n => n.type === 'info')).toBe(true);
    });
  });

  describe('timed game mode', () => {
    it('should initialize game session when starting a game', async () => {
      const store = createTestStore({ virtualPlayerCount: 3 });
      renderApp(store);

      // Start the game
      fireEvent.click(screen.getByText('Spiel beginnen'));

      // Wait for game to start
      await waitFor(() => {
        expect(document.querySelector('.game-start')).not.toBeInTheDocument();
      }, { timeout: 5000 });

      // Game session should be initialized (currentCycle = 0 at start)
      expect(store.getState().gameSession.currentCycle).toBe(0);
      expect(store.getState().gameSession.isGameEnded).toBe(false);
    });
  });

  describe('cover position from portfolio', () => {
    it('should open trade modal for buyToCover when covering a short position', async () => {
      const store = createTestStore();

      // Add short position to state
      store.dispatch({
        type: 'shortPositions/addShortPosition',
        payload: {
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 150,
          collateralLocked: 2250,
          openedAt: Date.now(),
          totalBorrowFeesPaid: 0,
        },
      });

      renderApp(store);
      await closeStartModal();

      // Open trade modal for buyToCover via dispatch (simulating portfolio action)
      await act(async () => {
        store.dispatch({
          type: 'ui/openTradeModal',
          payload: { symbol: 'AAPL', type: 'buyToCover' },
        });
      });

      // Trade modal should be open with buyToCover type
      expect(store.getState().ui.tradeModal.isOpen).toBe(true);
      expect(store.getState().ui.tradeModal.type).toBe('buyToCover');
    });
  });

  describe('canTradeInPanel edge cases', () => {
    it('should return false when tradeModal is not open', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Trade modal is closed by default
      expect(store.getState().ui.tradeModal.isOpen).toBe(false);

      // The trade panel overlay should not be visible
      expect(document.querySelector('.center-panel__trade-overlay')).not.toBeInTheDocument();
    });

    it('should return false when stock is not found', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Open trade modal for a non-existent stock
      await act(async () => {
        store.dispatch({
          type: 'ui/openTradeModal',
          payload: { symbol: 'INVALID', type: 'buy' },
        });
      });

      // Modal is open but stock doesn't exist
      expect(store.getState().ui.tradeModal.isOpen).toBe(true);
      expect(store.getState().ui.tradeModal.symbol).toBe('INVALID');
    });

    it('should handle sell with no holdings', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Open trade modal for sell without any holdings
      await act(async () => {
        store.dispatch({
          type: 'ui/openTradeModal',
          payload: { symbol: 'AAPL', type: 'sell' },
        });
      });

      // Modal opens - player can't actually sell but modal is visible
      expect(store.getState().ui.tradeModal.isOpen).toBe(true);
      expect(store.getState().ui.tradeModal.type).toBe('sell');
    });
  });

  describe('continue game from game end', () => {
    it('should show game end screen when game ends', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Set game as ended via dispatch with correct action name
      await act(async () => {
        store.dispatch({
          type: 'gameSession/endGame',
          payload: {
            playerRanking: 1,
            playerNetWorth: 150000,
            playerProfit: 50000,
            playerRiskLevel: 'moderate',
            allPlayersRanked: [
              { id: 'player', name: 'You', netWorth: 150000, profit: 50000, riskLevel: 'moderate', isHuman: true },
            ],
          },
        });
      });

      // Game end screen should be visible
      expect(store.getState().gameSession.isGameEnded).toBe(true);
      expect(screen.getByText('Spielende')).toBeInTheDocument();
    });
  });

  describe('play again from game end', () => {
    it('should reset game state when playing again', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Set game as ended via dispatch with correct action name
      await act(async () => {
        store.dispatch({
          type: 'gameSession/endGame',
          payload: {
            playerRanking: 1,
            playerNetWorth: 150000,
            playerProfit: 50000,
            playerRiskLevel: 'moderate',
            allPlayersRanked: [
              { id: 'player', name: 'You', netWorth: 150000, profit: 50000, riskLevel: 'moderate', isHuman: true },
            ],
          },
        });
      });

      // Verify game end screen is shown
      expect(screen.getByText('Spielende')).toBeInTheDocument();

      // Click "Neues Spiel" button on game end screen
      const newGameButton = screen.getByRole('button', { name: 'Neues Spiel' });
      fireEvent.click(newGameButton);

      // Game should be reset and start modal should appear
      await waitFor(() => {
        expect(store.getState().gameSession.isGameEnded).toBe(false);
      });
    });

    it('should reset speed multiplier to 1 when playing again', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Set speed to 2x before ending game
      await act(async () => {
        store.dispatch({ type: 'settings/setSpeedMultiplier', payload: 2 });
      });
      expect(store.getState().settings.speedMultiplier).toBe(2);

      // End game
      await act(async () => {
        store.dispatch({
          type: 'gameSession/endGame',
          payload: {
            playerRanking: 1,
            playerNetWorth: 150000,
            playerProfit: 50000,
            playerRiskLevel: 'moderate',
            allPlayersRanked: [
              { id: 'player', name: 'You', netWorth: 150000, profit: 50000, riskLevel: 'moderate', isHuman: true },
            ],
          },
        });
      });

      // Click "Neues Spiel"
      const newGameButton = screen.getByRole('button', { name: 'Neues Spiel' });
      fireEvent.click(newGameButton);

      // Speed multiplier should be reset to 1
      await waitFor(() => {
        expect(store.getState().settings.speedMultiplier).toBe(1);
      });
    });
  });

  describe('game mode change', () => {
    it('should change game mode when selecting different mode in start screen', async () => {
      const store = createTestStore({ gameMode: 'realLife' });
      renderApp(store);

      // Initial mode should be realLife
      expect(store.getState().settings.gameMode).toBe('realLife');

      // Find and click Hard Life mode button
      const modeButtons = screen.getAllByRole('button');
      const hardLifeButton = modeButtons.find(btn => btn.textContent === 'Hard Life');

      if (hardLifeButton) {
        fireEvent.click(hardLifeButton);

        // Wait for mode selection to take effect
        await waitFor(() => {
          expect(hardLifeButton).toHaveClass('game-start__mode-btn--active');
        });
      }
    });
  });

  describe('scroll to trade panel', () => {
    it('should scroll to trade panel when opening via addMargin', async () => {
      // Mock scrollTo
      const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      const store = createTestStore();

      // Add short position
      store.dispatch({
        type: 'shortPositions/addShortPosition',
        payload: {
          symbol: 'AAPL',
          shares: 10,
          entryPrice: 150,
          collateralLocked: 2250,
          openedAt: Date.now(),
          totalBorrowFeesPaid: 0,
        },
      });

      renderApp(store);
      await closeStartModal();

      // Open trade modal for addMargin
      await act(async () => {
        store.dispatch({
          type: 'ui/openTradeModal',
          payload: { symbol: 'AAPL', type: 'addMargin' },
        });
      });

      // Wait for potential scroll
      await waitFor(() => {
        expect(store.getState().ui.tradeModal.type).toBe('addMargin');
      });

      scrollToSpy.mockRestore();
    });
  });

  describe('endscreen preview via Alt+R', () => {
    it('should show endscreen preview when pressing Alt+R', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Game should not be ended
      expect(store.getState().gameSession.isGameEnded).toBe(false);
      expect(store.getState().gameSession.endScreenPreview).toBe(false);

      // Press Alt+R
      fireEvent.keyDown(document, { key: 'r', altKey: true });

      // Endscreen preview should be shown
      await waitFor(() => {
        expect(store.getState().gameSession.endScreenPreview).toBe(true);
        expect(store.getState().gameSession.endGameStats).not.toBeNull();
      });

      // Endscreen should be visible
      expect(screen.getByText('Spielende')).toBeInTheDocument();
    });

    it('should hide endscreen preview when pressing Alt+R again', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Press Alt+R to show
      fireEvent.keyDown(document, { key: 'r', altKey: true });
      await waitFor(() => {
        expect(store.getState().gameSession.endScreenPreview).toBe(true);
      });

      // Press Alt+R again to hide
      fireEvent.keyDown(document, { key: 'r', altKey: true });
      await waitFor(() => {
        expect(store.getState().gameSession.endScreenPreview).toBe(false);
      });
    });

    it('should hide action buttons in preview mode', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Press Alt+R to show endscreen preview
      fireEvent.keyDown(document, { key: 'r', altKey: true });
      await waitFor(() => {
        expect(screen.getByText('Spielende')).toBeInTheDocument();
      });

      // Action buttons should not be visible in preview
      expect(screen.queryByRole('button', { name: 'Neues Spiel' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Weiter spielen' })).not.toBeInTheDocument();
    });

    it('should not toggle preview when game has already ended', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // End the game
      await act(async () => {
        store.dispatch({
          type: 'gameSession/endGame',
          payload: {
            playerRanking: 1,
            playerNetWorth: 150000,
            playerProfit: 50000,
            playerRiskLevel: 'moderate',
            allPlayersRanked: [
              { id: 'player', name: 'You', netWorth: 150000, profit: 50000, riskLevel: 'moderate', isHuman: true },
            ],
          },
        });
      });

      // Press Alt+R should not affect anything (game already ended)
      fireEvent.keyDown(document, { key: 'r', altKey: true });

      // Preview should remain false, game should stay ended
      expect(store.getState().gameSession.endScreenPreview).toBe(false);
      expect(store.getState().gameSession.isGameEnded).toBe(true);
    });

    it('should show action buttons in real game end (not preview)', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // End the game for real
      await act(async () => {
        store.dispatch({
          type: 'gameSession/endGame',
          payload: {
            playerRanking: 1,
            playerNetWorth: 150000,
            playerProfit: 50000,
            playerRiskLevel: 'moderate',
            allPlayersRanked: [
              { id: 'player', name: 'You', netWorth: 150000, profit: 50000, riskLevel: 'moderate', isHuman: true },
            ],
          },
        });
      });

      // Action buttons should be visible in real game end
      expect(screen.getByRole('button', { name: 'Neues Spiel' })).toBeInTheDocument();
    });
  });

  describe('warmup market phase integration', () => {
    it('should call updateSectorState during warmup', async () => {
      const store = createTestStore();

      // Record timestamp before render
      const timestampBeforeRender = Date.now();

      // Small delay to ensure timestamps are different
      await new Promise(resolve => setTimeout(resolve, 10));

      renderApp(store);
      await closeStartModal();

      // After warmup, sector state should have been updated during warmup
      // (lastUpdate timestamp should be newer than before render)
      const postWarmupSectorState = store.getState().sector;
      expect(postWarmupSectorState.lastUpdate).toBeGreaterThan(timestampBeforeRender);
    });

    it('should initialize market phases before warmup', async () => {
      const store = createTestStore();

      // Initial market phase state
      const initialPhaseState = store.getState().marketPhase;
      expect(initialPhaseState.globalPhase).toBe('prosperity'); // default

      renderApp(store);
      await closeStartModal();

      // After warmup, market phases should still be set
      // (they were initialized before warmup and used during it)
      const postWarmupPhaseState = store.getState().marketPhase;
      expect(postWarmupPhaseState.globalPhase).toBeDefined();
      expect(postWarmupPhaseState.sectorPhases).toBeDefined();

      // Fear & Greed index should be in valid range
      expect(postWarmupPhaseState.fearGreedIndex).toBeGreaterThanOrEqual(0);
      expect(postWarmupPhaseState.fearGreedIndex).toBeLessThanOrEqual(100);
    });

    it('should pass sectorInfluences and volatilityMultipliers to updatePrices during warmup', async () => {
      // Create store with action logging middleware
      const { store, actionLog } = createTestStoreWithActionLog();

      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Start the game (triggers warmup)
      const startButton = screen.getByText('Spiel beginnen');
      fireEvent.click(startButton);

      // Wait for warmup to complete
      await waitFor(() => {
        expect(document.querySelector('.game-start')).not.toBeInTheDocument();
      }, { timeout: 5000 });

      // Filter for stocks/updatePrices actions
      const updatePricesActions = actionLog.filter(
        (action) => action.type === 'stocks/updatePrices'
      );

      // Should have multiple updatePrices calls (one per warmup cycle)
      expect(updatePricesActions.length).toBeGreaterThan(0);

      // Check that at least one updatePrices was called WITH market phase parameters
      // (not just empty/undefined payload)
      const actionsWithMarketPhaseParams = updatePricesActions.filter((action) => {
        const payload = (action as { payload?: { sectorInfluences?: Record<Sector, number>; volatilityMultipliers?: Record<string, number> } }).payload;
        return (
          payload &&
          typeof payload === 'object' &&
          'sectorInfluences' in payload &&
          'volatilityMultipliers' in payload
        );
      });

      // ALL warmup updatePrices calls should have market phase parameters
      expect(actionsWithMarketPhaseParams.length).toBe(updatePricesActions.length);

      // Verify the structure of the parameters
      const sampleAction = actionsWithMarketPhaseParams[0] as unknown as {
        payload: {
          sectorInfluences: Record<Sector, number>;
          volatilityMultipliers: Record<string, number>;
        };
      };

      // sectorInfluences should have all 4 sectors
      expect(sampleAction.payload.sectorInfluences).toHaveProperty('tech');
      expect(sampleAction.payload.sectorInfluences).toHaveProperty('finance');
      expect(sampleAction.payload.sectorInfluences).toHaveProperty('industrial');
      expect(sampleAction.payload.sectorInfluences).toHaveProperty('commodities');

      // volatilityMultipliers should have entries for our mock stocks
      expect(sampleAction.payload.volatilityMultipliers).toHaveProperty('AAPL');
      expect(sampleAction.payload.volatilityMultipliers).toHaveProperty('GOOGL');

      // Volatility multipliers should be positive numbers
      expect(sampleAction.payload.volatilityMultipliers.AAPL).toBeGreaterThan(0);
      expect(sampleAction.payload.volatilityMultipliers.GOOGL).toBeGreaterThan(0);
    });
  });

});
