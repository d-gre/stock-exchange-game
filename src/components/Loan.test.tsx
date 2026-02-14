import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Loan } from './Loan';
import loansReducer from '../store/loansSlice';
import portfolioReducer from '../store/portfolioSlice';
import stocksReducer from '../store/stocksSlice';
import uiReducer from '../store/uiSlice';
import tradeHistoryReducer from '../store/tradeHistorySlice';
import pendingOrdersReducer from '../store/pendingOrdersSlice';
import settingsReducer from '../store/settingsSlice';
import type { Stock } from '../types';

// Mock dispatch to track actions
const mockDispatch = vi.fn();
vi.mock('../store/hooks', async () => {
  const actual = await vi.importActual('../store/hooks');
  return {
    ...actual,
    useAppDispatch: () => mockDispatch,
  };
});

describe('Loan', () => {
  const mockStocks: Stock[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'tech',
      currentPrice: 200,
      change: 5,
      changePercent: 2.56,
      priceHistory: [],
      marketCapBillions: 3000, // Large cap
    },
    {
      symbol: 'BAYN',
      name: 'Bayer AG',
      sector: 'industrial',
      currentPrice: 50,
      change: -1,
      changePercent: -1.96,
      priceHistory: [],
      marketCapBillions: 50, // Small cap
    },
  ];

  const createMockStore = (overrides: {
    cash?: number;
    holdings?: { symbol: string; shares: number; avgBuyPrice: number }[];
    loans?: { id: string; principal: number; balance: number; interestRate: number; totalInterestPaid: number; originationFeePaid: number; createdAt: number; durationCycles: number; remainingCycles: number; isOverdue: boolean; overdueForCycles: number; loanNumber: number }[];
  } = {}) =>
    configureStore({
      reducer: {
        loans: loansReducer,
        portfolio: portfolioReducer,
        stocks: stocksReducer,
        ui: uiReducer,
        tradeHistory: tradeHistoryReducer,
        pendingOrders: pendingOrdersReducer,
        settings: settingsReducer,
      },
      preloadedState: {
        loans: {
          loans: overrides.loans ?? [],
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
          cash: overrides.cash ?? 10000,
          holdings: overrides.holdings ?? [],
        },
        stocks: {
          items: mockStocks,
          loading: false,
          error: null,
        },
        ui: {
          selectedStock: '',
          tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
          settingsOpen: false,
          helpOpen: false,
          chartTab: 'stock' as const,
          loanModalOpen: true,
          highlightedLoanId: null as string | null,
          debugModalOpen: false,
          debugModalContent: '',
        },
        tradeHistory: {
          trades: [],
          portfolioValueHistory: [],
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

  const renderWithProvider = (
    store = createMockStore()
  ) => {
    return render(
      <Provider store={store}>
        <Loan />
      </Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('header', () => {
    it('should display modal title with remaining loans count', () => {
      renderWithProvider();

      expect(screen.getByText(/Kredit aufnehmen/)).toBeInTheDocument();
      expect(screen.getByText(/3 verbleibend/)).toBeInTheDocument();
    });

    it('should display close button', () => {
      renderWithProvider();

      expect(screen.getByText('×')).toBeInTheDocument();
    });

    it('should dispatch closeLoanModal when close button is clicked', () => {
      renderWithProvider();

      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'ui/closeLoanModal' });
    });

    it('should NOT close when overlay is clicked (only buttons close modal)', () => {
      const { container } = renderWithProvider();

      const overlay = container.querySelector('.modal-overlay');
      fireEvent.click(overlay!);

      // Should NOT dispatch close - modal only closes via buttons
      expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'ui/closeLoanModal' });
    });
  });

  describe('credit line info', () => {
    it('should display recommended credit label', () => {
      renderWithProvider();

      // Label now has a hint instead of colon
      expect(screen.getByText('Empfohlener Kredit')).toBeInTheDocument();
    });

    it('should display available credit label', () => {
      renderWithProvider();

      expect(screen.getByText('Verfügbarer Kredit:')).toBeInTheDocument();
    });

    it('should show zero credit line when no stock holdings', () => {
      // Cash is NOT counted as collateral - only stock holdings
      const store = createMockStore({ cash: 10000, holdings: [] });

      renderWithProvider(store);

      // No stock holdings = $0 available credit shown in max available hint
      // Using getAllByText since $0,00 may appear multiple times
      expect(screen.getAllByText(/\$0,00/).length).toBeGreaterThan(0);
    });

    it('should calculate recommended credit line rounded to $1000', () => {
      const store = createMockStore({
        cash: 10000,
        holdings: [
          { symbol: 'AAPL', shares: 10, avgBuyPrice: 150 }, // 10 × $200 × 70% = $1,400
          { symbol: 'BAYN', shares: 20, avgBuyPrice: 40 }, // 20 × $50 × 50% = $500
        ],
      });

      renderWithProvider(store);

      // Collateral: $1,400 + $500 = $1,900
      // Recommended = floor(1900 / 1000) * 1000 = $1,000
      // Input should be pre-filled with recommended amount
      const input = screen.getByPlaceholderText('0');
      expect(input).toHaveValue('1000');
    });
  });

  describe('expandable conditions info', () => {
    it('should display conditions as clickable toggle', () => {
      renderWithProvider();

      // LoanInfoDetails uses a single "Conditions" toggle
      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      expect(toggle).toBeInTheDocument();
    });

    it('should not show conditions expanded by default', () => {
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 150 }],
      });
      const { container } = renderWithProvider(store);

      // Expandable content should exist but not be expanded (using LoanInfoDetails)
      const expandable = container.querySelector('.loan-info__expandable');
      expect(expandable).not.toHaveClass('loan-info__expandable--open');
    });

    it('should expand conditions when toggle is clicked', () => {
      // Need holdings to show collateral rows
      const store = createMockStore({
        holdings: [
          { symbol: 'AAPL', shares: 10, avgBuyPrice: 150 }, // Large cap
          { symbol: 'BAYN', shares: 20, avgBuyPrice: 40 },  // Small cap
        ],
      });

      renderWithProvider(store);

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Should show interest rate breakdown and credit line info
      expect(screen.getByText('Basiszins:')).toBeInTheDocument();
      expect(screen.getByText('Maximaler Kredit')).toBeInTheDocument();
      expect(screen.getByText(/Large Cap Aktien/)).toBeInTheDocument();
      expect(screen.getByText(/Small\/Mid Cap Aktien/)).toBeInTheDocument();
    });

    it('should collapse conditions when toggle is clicked again', () => {
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 150 }],
      });
      const { container } = renderWithProvider(store);

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle); // expand
      fireEvent.click(toggle); // collapse

      // Expandable should not have open class after collapsing (using LoanInfoDetails)
      const expandable = container.querySelector('.loan-info__expandable');
      expect(expandable).not.toHaveClass('loan-info__expandable--open');
    });
  });

  describe('remaining loans count in header', () => {
    it('should show 1 remaining when 2 loans exist', () => {
      const store = createMockStore({
        loans: [
          { id: '1', principal: 1000, balance: 1000, interestRate: 0.06, totalInterestPaid: 0, originationFeePaid: 15, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 1 },
          { id: '2', principal: 1000, balance: 1000, interestRate: 0.07, totalInterestPaid: 0, originationFeePaid: 15, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 2 },
        ],
      });

      renderWithProvider(store);

      expect(screen.getByText(/1 verbleibend/)).toBeInTheDocument();
    });

    it('should show 0 remaining when max loans reached', () => {
      const store = createMockStore({
        loans: [
          { id: '1', principal: 1000, balance: 1000, interestRate: 0.06, totalInterestPaid: 0, originationFeePaid: 15, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 1 },
          { id: '2', principal: 1000, balance: 1000, interestRate: 0.07, totalInterestPaid: 0, originationFeePaid: 15, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 2 },
          { id: '3', principal: 1000, balance: 1000, interestRate: 0.08, totalInterestPaid: 0, originationFeePaid: 15, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 3 },
        ],
      });

      renderWithProvider(store);

      expect(screen.getByText(/0 verbleibend/)).toBeInTheDocument();
    });

    it('should disable confirm button when max loans reached', () => {
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
        loans: [
          { id: '1', principal: 1000, balance: 1000, interestRate: 0.06, totalInterestPaid: 0, originationFeePaid: 15, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 1 },
          { id: '2', principal: 1000, balance: 1000, interestRate: 0.07, totalInterestPaid: 0, originationFeePaid: 15, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 2 },
          { id: '3', principal: 1000, balance: 1000, interestRate: 0.08, totalInterestPaid: 0, originationFeePaid: 15, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 3 },
        ],
      });

      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '1000' } });

      const confirmButton = screen.getByText('Kredit bestätigen');
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('amount input', () => {
    it('should display amount label', () => {
      renderWithProvider();

      expect(screen.getByText('Kreditbetrag:')).toBeInTheDocument();
    });

    it('should display currency symbol', () => {
      const { container } = renderWithProvider();

      expect(container.querySelector('.loan__currency-symbol')).toHaveTextContent('$');
    });

    it('should allow entering numbers', () => {
      // Need holdings for available credit
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
      });
      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '5000' } });

      expect(input).toHaveValue('5000');
    });

    it('should not allow non-numeric input', () => {
      renderWithProvider();

      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: 'abc' } });

      expect(input).toHaveValue('');
    });

    it('should set default value to recommended credit line', () => {
      // Need stock holdings for collateral (cash is not counted)
      // 100 shares × $200 × 70% = $14,000 collateral
      // Recommended = floor(14000 / 1000) * 1000 = $14,000
      const store = createMockStore({
        cash: 10000,
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
      });

      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      expect(input).toHaveValue('14000');
    });
  });

  describe('interest rate display', () => {
    it('should display effective rate label in the modal', () => {
      renderWithProvider();

      // Effective rate label appears in the modal (may appear multiple times with LoanInfoDetails)
      expect(screen.getAllByText('Effektiver Zinssatz:').length).toBeGreaterThan(0);
    });

    it('should show cycles info when conditions are expanded', () => {
      renderWithProvider();

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.getByText(/alle 20 Handelszyklen/)).toBeInTheDocument();
    });

    it('should show base rate when conditions are expanded', () => {
      renderWithProvider();

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.getByText('Basiszins:')).toBeInTheDocument();
      // Base rate and effective rate may both be 6.00%, use getAllByText
      expect(screen.getAllByText('6,00%').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('cost summary', () => {
    it('should not display cost summary when amount is 0', () => {
      renderWithProvider();

      expect(screen.queryByText('Bereitstellungsgebühr')).not.toBeInTheDocument();
    });

    it('should display cost summary when amount is entered', () => {
      // Need holdings for available credit
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
      });
      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '1000' } });

      expect(screen.getByText(/Bereitstellungsgebühr/)).toBeInTheDocument();
      expect(screen.getByText('Netto-Auszahlung:')).toBeInTheDocument();
    });

    it('should calculate origination fee correctly', () => {
      // Need holdings for available credit
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
      });
      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '1000' } });

      // 1.5% of 1000 = $15
      expect(screen.getByText('$15,00')).toBeInTheDocument();
    });

    it('should calculate net disbursement correctly', () => {
      // Need holdings for available credit
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
      });
      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '1000' } });

      // 1000 - 15 = $985
      expect(screen.getByText('$985,00')).toBeInTheDocument();
    });
  });

  describe('confirm button', () => {
    it('should display confirm button', () => {
      renderWithProvider();

      expect(screen.getByText('Kredit bestätigen')).toBeInTheDocument();
    });

    it('should disable confirm button when amount is 0', () => {
      renderWithProvider();

      const confirmButton = screen.getByText('Kredit bestätigen');
      expect(confirmButton).toBeDisabled();
    });

    it('should disable confirm button when amount exceeds available credit', () => {
      const store = createMockStore({ cash: 1000, holdings: [] });

      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '2000' } });

      const confirmButton = screen.getByText('Kredit bestätigen');
      expect(confirmButton).toBeDisabled();
    });

    it('should enable confirm button when valid amount is entered', () => {
      // Need stock holdings for collateral (100 × $200 × 70% = $14,000)
      const store = createMockStore({
        cash: 10000,
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
      });

      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '5000' } });

      const confirmButton = screen.getByText('Kredit bestätigen');
      expect(confirmButton).not.toBeDisabled();
    });

    it('should dispatch takeLoan and addCash when confirmed', () => {
      // Need stock holdings for collateral (100 × $200 × 70% = $14,000)
      const store = createMockStore({
        cash: 10000,
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
      });

      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '1000' } });

      const confirmButton = screen.getByText('Kredit bestätigen');
      fireEvent.click(confirmButton);

      // Should take loan
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loans/takeLoan',
          payload: expect.objectContaining({
            amount: 1000,
          }),
        })
      );

      // Should add net amount to cash (1000 - 15 = 985)
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'portfolio/addCash',
          payload: 985,
        })
      );

      // Should close modal
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'ui/closeLoanModal' });
    });
  });

  describe('amount input limit', () => {
    it('should limit input to available credit', () => {
      // 100 shares × $200 × 70% = $14,000 collateral
      // Recommended = $14,000, Max = $35,000
      const store = createMockStore({
        cash: 10000,
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
      });

      renderWithProvider(store);

      const input = screen.getByPlaceholderText('0');
      // Try to enter more than available credit
      fireEvent.change(input, { target: { value: '99999' } });

      // Should be capped at available credit ($35,000)
      expect(input).toHaveValue('35000');
    });
  });

  describe('styling', () => {
    it('should apply correct modal class', () => {
      const { container } = renderWithProvider();

      expect(container.querySelector('.loan')).toBeInTheDocument();
    });

    it('should apply correct overlay class', () => {
      const { container } = renderWithProvider();

      expect(container.querySelector('.modal-overlay')).toBeInTheDocument();
    });

    it('should prevent click propagation on modal content', () => {
      const { container } = renderWithProvider();

      const modal = container.querySelector('.loan');
      fireEvent.click(modal!);

      // Should NOT dispatch close (only overlay click should close)
      expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'ui/closeLoanModal' });
    });
  });

  describe('utilization surcharge calculation (same as TradePanel)', () => {
    it('should show utilization surcharge when utilization >= 50%', () => {
      // Setup: 100 AAPL shares × $200 × 70% = $14,000 collateral
      // Recommended = $14,000, Max = $35,000
      // Existing debt of $17,500 = 50% utilization
      // New loan of $1,000 would make utilization = ($17,500 + $1,000) / $35,000 = 52.86%
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
        loans: [
          { id: '1', principal: 17500, balance: 17500, interestRate: 0.06, totalInterestPaid: 0, originationFeePaid: 262.5, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 1 },
        ],
      });

      renderWithProvider(store);

      // Enter a loan amount
      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '1000' } });

      // Expand conditions to see surcharge
      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Should show utilization surcharge (Auslastungszuschlag)
      expect(screen.getByText(/Auslastungszuschlag/)).toBeInTheDocument();
    });

    it('should NOT show utilization surcharge when utilization < 50%', () => {
      // Setup: 100 AAPL shares × $200 × 70% = $14,000 collateral
      // Recommended = $14,000, Max = $35,000
      // No existing debt, loan of $10,000 = 28.6% utilization (< 50%)
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
        loans: [],
      });

      renderWithProvider(store);

      // Enter a loan amount that keeps utilization under 50%
      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '10000' } });

      // Expand conditions
      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Should NOT show utilization surcharge
      expect(screen.queryByText(/Auslastungszuschlag/)).not.toBeInTheDocument();
    });

    it('should calculate utilization based on (currentDebt + loanAmount) / maxCredit', () => {
      // Setup: 100 AAPL shares × $200 × 70% = $14,000 collateral
      // Max credit = $35,000
      // Existing debt = $10,000
      // New loan = $20,000 would make utilization = $30,000 / $35,000 = 85.7% (>= 75% tier)
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
        loans: [
          { id: '1', principal: 10000, balance: 10000, interestRate: 0.06, totalInterestPaid: 0, originationFeePaid: 150, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 1 },
        ],
      });

      renderWithProvider(store);

      // Enter loan amount that pushes into high utilization
      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '20000' } });

      // Expand conditions
      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Should show utilization surcharge for >= 75% tier
      expect(screen.getByText(/Auslastungszuschlag/)).toBeInTheDocument();
      // The surcharge for 75-99% tier is 3% (config: utilizationTier75Surcharge = 0.03)
      expect(screen.getByText('+3,00%')).toBeInTheDocument();
    });

    it('should update utilization surcharge when loan amount changes', () => {
      // Setup: Max credit = $35,000, existing debt = $17,000
      const store = createMockStore({
        holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }],
        loans: [
          { id: '1', principal: 17000, balance: 17000, interestRate: 0.06, totalInterestPaid: 0, originationFeePaid: 255, createdAt: Date.now(), durationCycles: 40, remainingCycles: 40, isOverdue: false, overdueForCycles: 0, loanNumber: 1 },
        ],
      });

      renderWithProvider(store);

      // Expand conditions first
      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Enter small amount: ($17,000 + $500) / $35,000 = 50% - at threshold
      const input = screen.getByPlaceholderText('0');
      fireEvent.change(input, { target: { value: '500' } });

      // Should show 1% surcharge for 50-74% tier (config: utilizationTier50Surcharge = 0.01)
      expect(screen.getByText(/Auslastungszuschlag/)).toBeInTheDocument();
      expect(screen.getByText('+1,00%')).toBeInTheDocument();

      // Now increase to push into higher tier: ($17,000 + $10,000) / $35,000 = 77.1%
      fireEvent.change(input, { target: { value: '10000' } });

      // Should now show 3% surcharge for 75-99% tier (config: utilizationTier75Surcharge = 0.03)
      expect(screen.getByText('+3,00%')).toBeInTheDocument();
    });
  });
});
