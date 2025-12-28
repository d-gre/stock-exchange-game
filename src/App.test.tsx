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
import notificationsReducer from './store/notificationsSlice';
import tradeHistoryReducer, { addCompletedTrade } from './store/tradeHistorySlice';
import { createMockPriceHistory } from './test/testUtils';
import type { Stock } from './types';
import i18n from './i18n';

// Mocks for lightweight-charts and ResizeObserver are defined in test/setup.ts

const createMockStocks = (): Stock[] => [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currentPrice: 150,
    change: 2.5,
    changePercent: 1.69,
    priceHistory: createMockPriceHistory(),
    marketCapBillions: 3000,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
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
  gameMode?: 'sandbox' | 'realLife' | 'hardLife';
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

/** Closes the start modal by clicking "Start Game" and waits for warmup to finish */
const closeStartModal = async () => {
  fireEvent.click(screen.getByText('Spiel starten'));
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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      // Only Markt Index tab should be visible when no holdings and no trades
      const tabs = getChartTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0]).toHaveTextContent('Markt Index');
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
      expect(tabs[1]).toHaveTextContent('Markt Index');
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
      expect(tabs[1]).toHaveTextContent('Markt Index');
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

      const indexTab = screen.getByRole('button', { name: 'Markt Index' });
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
      const store = createTestStore({
        selectedStock: '',
        chartTab: 'stock',
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

      // Index tab is now at position 2 (after history)
      fireEvent.click(getChartTabs()[2]);

      expect(getChartTabs()[2]).toHaveClass('chart-panel__tab--active');
    });

    it('should have tabs in correct order: stock, history, index', async () => {
      const store = createTestStore({
        selectedStock: '',
        chartTab: 'stock',
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

      const tabs = getChartTabs();

      expect(tabs).toHaveLength(3);
      expect(tabs[0]).toHaveTextContent(/Assets/);
      expect(tabs[1]).toHaveTextContent('Order-Historie');
      expect(tabs[2]).toHaveTextContent('Markt Index');
    });

    it('should switch to history tab when clicking on it', async () => {
      const store = createTestStore({
        selectedStock: '',
        chartTab: 'stock',
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
      expect(screen.getByText('Spiel starten')).toBeInTheDocument();
    });

    it('should close start modal when clicking start button', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      expect(screen.queryByText('Spiel starten')).not.toBeInTheDocument();
    });
  });

  describe('app controls', () => {
    it('should display pause button', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Pause button exists in controls bar
      const buttons = screen.getAllByTitle('Fortsetzen');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should display settings button', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Settings button exists in controls bar
      const buttons = screen.getAllByTitle('Einstellungen');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should open settings modal when clicking settings button', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Click settings button in controls bar
      const buttons = screen.getAllByTitle('Einstellungen');
      fireEvent.click(buttons[0]);

      expect(screen.getByText('Einstellungen')).toBeInTheDocument();
    });

    it('should display theme selector in settings modal', async () => {
      renderApp(createTestStore());
      await closeStartModal();

      // Open settings modal
      const buttons = screen.getAllByTitle('Einstellungen');
      fireEvent.click(buttons[0]);

      // Theme selector should be visible in modal
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
      expect(darkOption).toHaveClass('settings-modal__theme-option--active');
      expect(lightOption).not.toHaveClass('settings-modal__theme-option--active');

      // Click light mode option
      fireEvent.click(lightOption!);

      // Now light mode - light option should be active
      expect(lightOption).toHaveClass('settings-modal__theme-option--active');
      expect(darkOption).not.toHaveClass('settings-modal__theme-option--active');
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
      expect(lightOption).toHaveClass('settings-modal__theme-option--active');

      fireEvent.click(darkOption!);
      expect(darkOption).toHaveClass('settings-modal__theme-option--active');
    });

    it('should close settings modal when clicking close button', async () => {
      const store = createTestStore({ settingsOpen: true });
      renderApp(store);
      await closeStartModal();

      expect(screen.getByText('Einstellungen')).toBeInTheDocument();

      fireEvent.click(screen.getByText('×'));

      expect(screen.queryByText('Einstellungen')).not.toBeInTheDocument();
      expect(store.getState().ui.settingsOpen).toBe(false);
    });

    it('should save new interval when clicking save', async () => {
      const store = createTestStore({ settingsOpen: true });
      renderApp(store);
      await closeStartModal();

      const intervalInput = screen.getByLabelText('Update-Intervall (Sekunden)');
      fireEvent.change(intervalInput, { target: { value: '60' } });

      fireEvent.click(screen.getByText('Speichern'));

      expect(store.getState().settings.updateInterval).toBe(60);
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
      fireEvent.click(screen.getByText('Spiel starten'));

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
      renderApp(store);
      await closeStartModal();

      // Find AAPL in stock list and click it
      const stockItems = screen.getAllByText('AAPL');
      // The last one should be in the StockList (right panel)
      fireEvent.click(stockItems[stockItems.length - 1]);

      expect(store.getState().ui.selectedStock).toBe('AAPL');
    });

    it('should scroll to chart on mobile when selecting stock from StockList', async () => {
      // Mock mobile viewport
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });

      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Click on stock in StockList
      const stockItems = screen.getAllByText('AAPL');
      fireEvent.click(stockItems[stockItems.length - 1]);

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

      // Click help button in controls bar
      const helpButton = screen.getByTitle('Wie funktioniert das Spiel?');
      fireEvent.click(helpButton);

      expect(store.getState().ui.helpOpen).toBe(true);
      expect(screen.getByText('Willkommen bei D-GRE Stock Exchange')).toBeInTheDocument();
    });

    it('should close help modal when clicking close button', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Open help modal
      const helpButton = screen.getByTitle('Wie funktioniert das Spiel?');
      fireEvent.click(helpButton);

      expect(screen.getByText('Willkommen bei D-GRE Stock Exchange')).toBeInTheDocument();

      // Close help modal
      const closeButton = screen.getByRole('button', { name: 'Schließen' });
      fireEvent.click(closeButton);

      expect(store.getState().ui.helpOpen).toBe(false);
      expect(screen.queryByText('Willkommen bei D-GRE Stock Exchange')).not.toBeInTheDocument();
    });

    it('should close help modal when clicking understood button', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // Open help modal
      const helpButton = screen.getByTitle('Wie funktioniert das Spiel?');
      fireEvent.click(helpButton);

      // Close via understood button
      const understoodButton = screen.getByText("Alles klar, los geht's!");
      fireEvent.click(understoodButton);

      expect(store.getState().ui.helpOpen).toBe(false);
    });
  });

  describe('speed controls', () => {
    it('should toggle pause when clicking pause button', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      expect(store.getState().settings.isPaused).toBe(true);

      // Click play button (since game starts paused)
      const playButton = screen.getAllByTitle('Fortsetzen')[0];
      fireEvent.click(playButton);

      expect(store.getState().settings.isPaused).toBe(false);
    });

    it('should cycle through speeds when clicking speed button', async () => {
      const store = createTestStore();
      renderApp(store);
      await closeStartModal();

      // First unpause
      const playButton = screen.getAllByTitle('Fortsetzen')[0];
      fireEvent.click(playButton);

      expect(store.getState().settings.speedMultiplier).toBe(1);

      // Click speed button to go to 2x (button has class app-control-panel__btn--speed-1x initially)
      const speedButton = document.querySelector('.app-control-panel__btn--speed-1x');
      fireEvent.click(speedButton!);

      expect(store.getState().settings.speedMultiplier).toBe(2);

      // Click again to go to 3x
      const speedButton2x = document.querySelector('.app-control-panel__btn--speed-2x');
      fireEvent.click(speedButton2x!);

      expect(store.getState().settings.speedMultiplier).toBe(3);

      // Click again to cycle back to 1x
      const speedButton3x = document.querySelector('.app-control-panel__btn--speed-3x');
      fireEvent.click(speedButton3x!);

      expect(store.getState().settings.speedMultiplier).toBe(1);
    });
  });
});
