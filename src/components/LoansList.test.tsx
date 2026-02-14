import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { LoansList } from './LoansList';
import loansReducer from '../store/loansSlice';
import portfolioReducer from '../store/portfolioSlice';
import stocksReducer from '../store/stocksSlice';
import uiReducer from '../store/uiSlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import settingsReducer from '../store/settingsSlice';
import type { Loan, PortfolioItem, Stock } from '../types';

// Mock dispatch to track actions
const mockDispatch = vi.fn();
vi.mock('../store/hooks', async () => {
  const actual = await vi.importActual('../store/hooks');
  return {
    ...actual,
    useAppDispatch: () => mockDispatch,
  };
});

describe('LoansList', () => {
  const createMockLoan = (overrides: Partial<Loan> & { loanNumber: number }): Loan => ({
    id: `loan-${Date.now()}-${Math.random()}`,
    principal: 5000,
    balance: 5000,
    interestRate: 0.06,
    createdAt: Date.now(),
    totalInterestPaid: 0,
    durationCycles: 50,
    remainingCycles: 40, // Early repayment by default (fee applies)
    isOverdue: false,
    overdueForCycles: 0,
    ...overrides,
  });

  // Default stock for collateral (large cap - 70% collateral ratio)
  const defaultStock: Stock = {
    symbol: 'AAPL',
    name: 'Apple',
    sector: 'tech',
    currentPrice: 200,
    marketCapBillions: 3000,
    change: 0,
    changePercent: 0,
    priceHistory: [],
  };

  // Default holdings providing $14,000 collateral (100 shares × $200 × 70%)
  const defaultHoldings: PortfolioItem[] = [
    { symbol: 'AAPL', shares: 100, avgBuyPrice: 150 },
  ];

  const createMockStore = (
    loans: Loan[] = [],
    cash: number = 10000,
    holdings: PortfolioItem[] = defaultHoldings,
    stocks: Stock[] = [defaultStock]
  ) =>
    configureStore({
      reducer: {
        loans: loansReducer,
        portfolio: portfolioReducer,
        stocks: stocksReducer,
        ui: uiReducer,
        pendingOrders: pendingOrdersReducer,
        settings: settingsReducer,
      },
      preloadedState: {
        loans: {
          loans,
          cyclesSinceLastInterestCharge: 0,
          totalInterestPaid: 0,
          totalOriginationFeesPaid: 0,
          totalRepaymentFeesPaid: 0,
          creditScore: 50,
          creditHistory: [],
          delinquencyHistory: [],
          nextLoanNumber: 1,
        },
        portfolio: {
          cash,
          holdings,
        },
        stocks: {
          items: stocks,
          lastUpdate: 0,
          isLoading: false,
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
        pendingOrders: {
          orders: [],
          tradedSymbolsThisCycle: [],
        },
        settings: {
          initialCash: 0,
          updateInterval: 5000,
          countdown: 5,
          isPaused: false,
          speedMultiplier: 1 as const,
          gameMode: 'realLife' as const,
          virtualPlayerCount: 50,
          language: 'en' as const,
        },
      },
    });

  const renderWithProvider = (store = createMockStore()) => {
    return render(
      <Provider store={store}>
        <LoansList />
      </Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should display loans section title', () => {
      renderWithProvider();

      expect(screen.getByText('Kredite')).toBeInTheDocument();
    });

    it('should display "keine laufenden Kredite" when no loans', () => {
      renderWithProvider();

      expect(screen.getByText('keine laufenden Kredite')).toBeInTheDocument();
    });

    it('should display add button with plus icon', () => {
      renderWithProvider();

      const addButton = screen.getByTitle('Neuer Kredit');
      expect(addButton).toBeInTheDocument();
      expect(addButton.querySelector('svg')).toBeInTheDocument();
    });

    it('should display loans when they exist', () => {
      const loans = [
        createMockLoan({ id: 'loan-1', balance: 5000, loanNumber: 1 }),
        createMockLoan({ id: 'loan-2', balance: 3000, loanNumber: 2 }),
      ];
      const store = createMockStore(loans);

      renderWithProvider(store);

      expect(screen.getByText('$5.000,00')).toBeInTheDocument();
      expect(screen.getByText('$3.000,00')).toBeInTheDocument();
    });
  });

  describe('loan details', () => {
    it('should display interest rate', () => {
      const loans = [createMockLoan({ interestRate: 0.08, loanNumber: 1 })];
      const store = createMockStore(loans);

      renderWithProvider(store);

      expect(screen.getByText('8,0%')).toBeInTheDocument();
    });

    it('should display paid interest when greater than zero', () => {
      const loans = [createMockLoan({ totalInterestPaid: 250.50, loanNumber: 1 })];
      const store = createMockStore(loans);

      renderWithProvider(store);

      expect(screen.getByText(/Zinsen: \$250,50/)).toBeInTheDocument();
    });

    it('should not display paid interest when zero', () => {
      const loans = [createMockLoan({ totalInterestPaid: 0, loanNumber: 1 })];
      const store = createMockStore(loans);

      renderWithProvider(store);

      expect(screen.queryByText(/gezahlte zinsen/i)).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should dispatch openLoanModal when add button is clicked', () => {
      renderWithProvider();

      const addButton = screen.getByTitle('Neuer Kredit');
      fireEvent.click(addButton);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'ui/openLoanModal' });
    });

    it('should display repay button for each loan', () => {
      const loans = [
        createMockLoan({ id: 'loan-1', loanNumber: 1 }),
        createMockLoan({ id: 'loan-2', loanNumber: 2 }),
      ];
      const store = createMockStore(loans);

      renderWithProvider(store);

      // Title now includes fee info
      const repayButtons = screen.getAllByTitle(/Tilgen \(0,5% Gebühr\)/);
      expect(repayButtons).toHaveLength(2);
    });

    it('should dispatch repayLoan and deductCash with fee when repay button is clicked (early repayment)', () => {
      const loans = [createMockLoan({ id: 'loan-1', balance: 5000, remainingCycles: 40, loanNumber: 1 })];
      const store = createMockStore(loans, 10000);

      renderWithProvider(store);

      const repayButton = screen.getByTitle(/Tilgen \(0,5% Gebühr\)/);
      fireEvent.click(repayButton);

      // Should deduct cash including fee (5000 + 25 = 5025)
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'portfolio/deductCash', payload: 5025 })
      );
      // Should repay loan with fee tracked and isEarlyRepayment: true
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loans/repayLoan',
          payload: { loanId: 'loan-1', amount: 5000, feeDeducted: 25, isEarlyRepayment: true },
        })
      );
    });

    it('should show disabled repay button when cash is insufficient for full repayment (including fee)', () => {
      // Loan balance $15,000 + 0.5% fee = $15,075 required
      // Only $5,000 cash available - button should be shown but disabled
      const loans = [createMockLoan({ id: 'loan-1', balance: 15000, remainingCycles: 40, loanNumber: 1 })];
      const store = createMockStore(loans, 5000);

      renderWithProvider(store);

      // Repay button should be rendered but disabled when insufficient cash
      const repayButton = screen.getByTitle('Nicht genug Guthaben zur Rückzahlung');
      expect(repayButton).toBeInTheDocument();
      expect(repayButton).toBeDisabled();
      expect(repayButton).toHaveClass('loans-list__repay-btn--disabled');
    });

    it('should show repay button when cash is exactly enough for full repayment (including fee)', () => {
      // Loan balance $5,000 + 0.5% fee = $5,025 required
      const loans = [createMockLoan({ id: 'loan-1', balance: 5000, remainingCycles: 40, loanNumber: 1 })];
      const store = createMockStore(loans, 5025); // Exact amount needed

      renderWithProvider(store);

      const repayButton = screen.getByTitle(/Tilgen \(0,5% Gebühr\)/);
      expect(repayButton).toBeInTheDocument();
    });

    it('should repay without fee when loan is due (remainingCycles = 0)', () => {
      const loans = [createMockLoan({ id: 'loan-1', balance: 5000, remainingCycles: 0, loanNumber: 1 })];
      const store = createMockStore(loans, 10000);

      renderWithProvider(store);

      const repayButton = screen.getByTitle(/Tilgen \(ohne Gebühr\)/);
      fireEvent.click(repayButton);

      // No fee when due
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'portfolio/deductCash', payload: 5000 })
      );
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loans/repayLoan',
          payload: { loanId: 'loan-1', amount: 5000, feeDeducted: 0, isEarlyRepayment: false },
        })
      );
    });

    it('should repay without fee when loan is overdue', () => {
      const loans = [createMockLoan({ id: 'loan-1', balance: 5000, remainingCycles: 0, isOverdue: true, overdueForCycles: 2, loanNumber: 1 })];
      const store = createMockStore(loans, 10000);

      renderWithProvider(store);

      const repayButton = screen.getByTitle(/Tilgen \(ohne Gebühr\)/);
      fireEvent.click(repayButton);

      // No fee when overdue
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'portfolio/deductCash', payload: 5000 })
      );
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loans/repayLoan',
          payload: { loanId: 'loan-1', amount: 5000, feeDeducted: 0, isEarlyRepayment: false },
        })
      );
    });

    it('should show disabled repay button when no cash available', () => {
      const loans = [createMockLoan({ id: 'loan-1', loanNumber: 1 })];
      const store = createMockStore(loans, 0);

      renderWithProvider(store);

      // Repay button should be rendered but disabled when no cash available
      const repayButton = screen.getByTitle('Nicht genug Guthaben zur Rückzahlung');
      expect(repayButton).toBeInTheDocument();
      expect(repayButton).toBeDisabled();
      expect(repayButton).toHaveClass('loans-list__repay-btn--disabled');
    });
  });

  describe('component visibility', () => {
    it('should hide entire component when no loans and insufficient collateral (< $1000)', () => {
      // Small cap stock with low collateral: 5 shares × $50 × 50% = $125 < $1000
      const smallCapStock: Stock = {
        symbol: 'TINY',
        name: 'Tiny Corp',
        sector: 'tech',
        currentPrice: 50,
        marketCapBillions: 10,
        change: 0,
        changePercent: 0,
        priceHistory: [],
      };
      const tinyHoldings: PortfolioItem[] = [{ symbol: 'TINY', shares: 5, avgBuyPrice: 40 }];
      const store = createMockStore([], 10000, tinyHoldings, [smallCapStock]);

      const { container } = renderWithProvider(store);

      expect(container.querySelector('.loans-list')).not.toBeInTheDocument();
      expect(screen.queryByText('Kredite')).not.toBeInTheDocument();
    });

    it('should hide entire component when no loans and no stock collateral at all', () => {
      // No loans + no holdings = no collateral = entire component hidden
      const store = createMockStore([], 10000, [], []);

      const { container } = renderWithProvider(store);

      expect(container.querySelector('.loans-list')).not.toBeInTheDocument();
      expect(screen.queryByText('Kredite')).not.toBeInTheDocument();
    });

    it('should show component when loans exist even without sufficient collateral', () => {
      // Has loans but insufficient collateral = show component (need to repay)
      const loans = [createMockLoan({ id: 'loan-1', balance: 5000, loanNumber: 1 })];
      const store = createMockStore(loans, 10000, [], []);

      renderWithProvider(store);

      expect(screen.getByText('Kredite')).toBeInTheDocument();
      expect(screen.getByText('$5.000,00')).toBeInTheDocument();
    });

    it('should not show add button when collateral is below $1000', () => {
      // Small cap stock with low collateral: 5 shares × $50 × 50% = $125 < $1000
      const smallCapStock: Stock = {
        symbol: 'TINY',
        name: 'Tiny Corp',
        sector: 'tech',
        currentPrice: 50,
        marketCapBillions: 10,
        change: 0,
        changePercent: 0,
        priceHistory: [],
      };
      const tinyHoldings: PortfolioItem[] = [{ symbol: 'TINY', shares: 5, avgBuyPrice: 40 }];
      const loans = [createMockLoan({ id: 'loan-1', balance: 1000, loanNumber: 1 })];
      const store = createMockStore(loans, 10000, tinyHoldings, [smallCapStock]);

      renderWithProvider(store);

      // Component should show (has loans) but no add button
      expect(screen.getByText('Kredite')).toBeInTheDocument();
      expect(screen.queryByTitle('Neuer Kredit')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Maximum an Krediten erreicht')).not.toBeInTheDocument();
    });

    it('should show disabled button with lock icon when max loans reached', () => {
      // Has collateral but max 3 loans already taken
      const loans = [
        createMockLoan({ id: 'loan-1', balance: 1000, loanNumber: 1 }),
        createMockLoan({ id: 'loan-2', balance: 1000, loanNumber: 2 }),
        createMockLoan({ id: 'loan-3', balance: 1000, loanNumber: 3 }),
      ];
      const store = createMockStore(loans);

      renderWithProvider(store);

      const lockedButton = screen.getByTitle('Maximum an Krediten erreicht');
      expect(lockedButton).toBeInTheDocument();
      expect(lockedButton).toBeDisabled();
      expect(lockedButton).toHaveClass('loans-list__add-btn--disabled');
    });

    it('should show active add button when stock collateral and available credit', () => {
      const store = createMockStore();

      renderWithProvider(store);

      const addButton = screen.getByTitle('Neuer Kredit');
      expect(addButton).toBeInTheDocument();
      expect(addButton).not.toBeDisabled();
    });
  });

  describe('styling', () => {
    it('should apply correct container class', () => {
      const { container } = renderWithProvider();

      expect(container.querySelector('.loans-list')).toBeInTheDocument();
    });

    it('should apply correct header class', () => {
      const { container } = renderWithProvider();

      expect(container.querySelector('.loans-list__header')).toBeInTheDocument();
    });

    it('should apply correct item classes when loans exist', () => {
      const loans = [createMockLoan({ loanNumber: 1 })];
      const store = createMockStore(loans);

      const { container } = renderWithProvider(store);

      expect(container.querySelector('.loans-list__items')).toBeInTheDocument();
      expect(container.querySelector('.loans-list__item')).toBeInTheDocument();
    });
  });

  describe('repayment validation (Ticket #784)', () => {
    it('should show enabled repay button only for loans that can be fully repaid with available cash', () => {
      // Scenario from ticket: 2 loans, only one can be repaid
      // Cash: $43,060.23
      // Loan 1: $31,799.18 (can be repaid: $31,799.18 + 0.5% fee = $31,958.17)
      // Loan 2: $181,107.71 overdue (cannot be repaid, no fee but exceeds cash)
      const loans = [
        createMockLoan({ id: 'loan-1', balance: 31799.18, remainingCycles: 4, isOverdue: false, loanNumber: 1 }),
        createMockLoan({ id: 'loan-2', balance: 181107.71, remainingCycles: 0, isOverdue: true, overdueForCycles: 2, loanNumber: 2 }),
      ];
      const store = createMockStore(loans, 43060.23);

      renderWithProvider(store);

      // Both loans should be displayed
      expect(screen.getByText('$31.799,18')).toBeInTheDocument();
      expect(screen.getByText('$181.107,71')).toBeInTheDocument();

      // Both repay buttons should be shown, but only one enabled
      const allRepayButtons = screen.getAllByRole('button', { name: /Tilgen|Nicht genug Guthaben/ });
      expect(allRepayButtons).toHaveLength(2);

      // One should be enabled (affordable loan)
      const enabledButtons = allRepayButtons.filter(btn => !btn.hasAttribute('disabled'));
      expect(enabledButtons).toHaveLength(1);

      // One should be disabled (unaffordable loan)
      const disabledButtons = allRepayButtons.filter(btn => btn.hasAttribute('disabled'));
      expect(disabledButtons).toHaveLength(1);
    });

    it('should show disabled repay button if cash is just below required amount (with fee)', () => {
      // Loan: $10,000 + 0.5% fee = $10,050 required
      // Cash: $10,049 (just below)
      const loans = [createMockLoan({ id: 'loan-1', balance: 10000, remainingCycles: 40, loanNumber: 1 })];
      const store = createMockStore(loans, 10049);

      renderWithProvider(store);

      const repayButton = screen.getByTitle('Nicht genug Guthaben zur Rückzahlung');
      expect(repayButton).toBeInTheDocument();
      expect(repayButton).toBeDisabled();
    });

    it('should allow repayment of overdue loan without fee when cash equals balance', () => {
      // Overdue loans have no fee, so cash = balance should work
      const loans = [createMockLoan({ id: 'loan-1', balance: 5000, remainingCycles: 0, isOverdue: true, overdueForCycles: 1, loanNumber: 1 })];
      const store = createMockStore(loans, 5000);

      renderWithProvider(store);

      const repayButton = screen.getByTitle(/Tilgen \(ohne Gebühr\)/);
      expect(repayButton).toBeInTheDocument();
    });

    it('should correctly handle multiple loans with mixed repayability', () => {
      // 3 loans with different repayability:
      // Cash: $20,000
      // Loan 1: $5,000 + fee = $5,025 (can repay)
      // Loan 2: $15,000 + fee = $15,075 (can repay)
      // Loan 3: $25,000 + fee = $25,125 (cannot repay)
      const loans = [
        createMockLoan({ id: 'loan-1', balance: 5000, remainingCycles: 30, loanNumber: 1 }),
        createMockLoan({ id: 'loan-2', balance: 15000, remainingCycles: 20, loanNumber: 2 }),
        createMockLoan({ id: 'loan-3', balance: 25000, remainingCycles: 10, loanNumber: 3 }),
      ];
      const store = createMockStore(loans, 20000);

      renderWithProvider(store);

      // All loans should be displayed
      expect(screen.getByText('$5.000,00')).toBeInTheDocument();
      expect(screen.getByText('$15.000,00')).toBeInTheDocument();
      expect(screen.getByText('$25.000,00')).toBeInTheDocument();

      // All 3 repay buttons should be shown
      const allRepayButtons = screen.getAllByRole('button', { name: /Tilgen|Nicht genug Guthaben/ });
      expect(allRepayButtons).toHaveLength(3);

      // 2 should be enabled (affordable loans)
      const enabledButtons = allRepayButtons.filter(btn => !btn.hasAttribute('disabled'));
      expect(enabledButtons).toHaveLength(2);

      // 1 should be disabled (unaffordable loan)
      const disabledButtons = allRepayButtons.filter(btn => btn.hasAttribute('disabled'));
      expect(disabledButtons).toHaveLength(1);
    });

    it('should dispatch full repayment actions when repay button is clicked', () => {
      const loans = [createMockLoan({ id: 'loan-1', balance: 5000, remainingCycles: 40, loanNumber: 1 })];
      const store = createMockStore(loans, 10000);

      renderWithProvider(store);

      const repayButton = screen.getByTitle(/Tilgen \(0,5% Gebühr\)/);
      fireEvent.click(repayButton);

      // Should deduct full balance + fee
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'portfolio/deductCash', payload: 5025 })
      );
      // Should repay full loan balance
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loans/repayLoan',
          payload: { loanId: 'loan-1', amount: 5000, feeDeducted: 25, isEarlyRepayment: true },
        })
      );
    });

    it('should dismiss notifications for loan when repaid (Ticket #796)', () => {
      const loans = [createMockLoan({ id: 'loan-1', balance: 5000, remainingCycles: 0, isOverdue: true, overdueForCycles: 2, loanNumber: 1 })];
      const store = createMockStore(loans, 10000);

      renderWithProvider(store);

      const repayButton = screen.getByTitle(/Tilgen \(ohne Gebühr\)/);
      fireEvent.click(repayButton);

      // Should dismiss notifications for this loan
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notifications/dismissNotificationsForLoan',
          payload: 'loan-1',
        })
      );
    });
  });
});
