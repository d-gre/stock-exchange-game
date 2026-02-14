import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import loansReducer, {
  takeLoan,
  repayLoan,
  repayAllLoans,
  chargeInterest,
  incrementInterestCycleCounter,
  resetLoans,
  restoreLoans,
  markLoanWarningShown,
  processLoanMaturity,
  decrementLoanCycles,
  calculateCollateralValue,
  calculateInterestRate,
  calculateProgressiveOverduePenalty,
  calculateCreditScoreAdjustment,
  calculateDurationDiscount,
  selectTotalDebt,
  selectShouldChargeInterest,
  selectCreditLineInfo,
  selectLoanStatistics,
  selectCanTakeLoan,
  selectActiveLoanCount,
  selectDelinquencyStats,
  selectLoansDueSoon,
  selectLoansDueNow,
  selectOverdueLoans,
  selectHasOverdueLoans,
  selectCreditScore,
  selectCreditHistory,
  selectPendingInterest,
  selectCyclesSinceLastInterestCharge,
  selectAllLoans,
  selectPendingLoanCount,
  selectEffectiveLoanCount,
  selectCanTakeLoanEffective,
  selectRemainingLoanSlots,
} from './loansSlice';
import { LOAN_CONFIG } from '../config';
import type { Stock, PortfolioItem } from '../types';

// ============================================================================
// TEST UTILITIES
// ============================================================================

const createTestStore = (initialLoansState?: Partial<ReturnType<typeof loansReducer>>) => {
  return configureStore({
    reducer: {
      loans: loansReducer,
      portfolio: () => ({ cash: 10000, holdings: [] }),
      stocks: () => ({ items: [] }),
      pendingOrders: () => ({ orders: [] }),
      settings: () => ({ initialCash: 0 }),
    },
    preloadedState: initialLoansState ? {
      loans: { ...loansReducer(undefined, { type: 'init' }), ...initialLoansState },
    } : undefined,
  });
};

const createFullTestStore = (
  portfolioState: { cash: number; holdings: PortfolioItem[] },
  stocksState: Stock[],
  pendingOrdersState: { orders: Array<{ loanRequest?: { amount: number; interestRate: number; durationCycles: number } }> } = { orders: [] },
  initialCash: number = 100000
) => {
  return configureStore({
    reducer: {
      loans: loansReducer,
      portfolio: () => portfolioState,
      stocks: () => ({ items: stocksState }),
      pendingOrders: () => pendingOrdersState,
      settings: () => ({ initialCash }),
    },
  });
};

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('calculateCollateralValue', () => {
  it('should not count cash as collateral', () => {
    // Cash is NOT counted as collateral - only stock holdings
    const result = calculateCollateralValue(10000, [], []);

    expect(result.cash).toBe(0);
    expect(result.largeCapStocks).toBe(0);
    expect(result.smallCapStocks).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should calculate large cap stocks at 70%', () => {
    const holdings: PortfolioItem[] = [
      { symbol: 'AAPL', shares: 10, avgBuyPrice: 150 },
    ];
    const stocks: Stock[] = [
      {
        symbol: 'AAPL',
        name: 'Apple',
        sector: 'tech',
        currentPrice: 200,
        marketCapBillions: 3000, // > 200B = large cap
        change: 0,
        changePercent: 0,
        priceHistory: [],
      },
    ];

    const result = calculateCollateralValue(0, holdings, stocks);

    // 10 shares × $200 = $2,000 × 70% = $1,400
    expect(result.largeCapStocks).toBe(1400);
    expect(result.smallCapStocks).toBe(0);
    expect(result.total).toBe(1400);
  });

  it('should calculate small cap stocks at 50%', () => {
    const holdings: PortfolioItem[] = [
      { symbol: 'SMALL', shares: 20, avgBuyPrice: 40 },
    ];
    const stocks: Stock[] = [
      {
        symbol: 'SMALL',
        name: 'Small Corp',
        sector: 'tech',
        currentPrice: 50,
        marketCapBillions: 50, // ≤ 200B = small cap
        change: 0,
        changePercent: 0,
        priceHistory: [],
      },
    ];

    const result = calculateCollateralValue(0, holdings, stocks);

    // 20 shares × $50 = $1,000 × 50% = $500
    expect(result.smallCapStocks).toBe(500);
    expect(result.largeCapStocks).toBe(0);
    expect(result.total).toBe(500);
  });

  it('should calculate mixed portfolio correctly', () => {
    const holdings: PortfolioItem[] = [
      { symbol: 'AAPL', shares: 10, avgBuyPrice: 150 },
      { symbol: 'SMALL', shares: 20, avgBuyPrice: 40 },
    ];
    const stocks: Stock[] = [
      {
        symbol: 'AAPL',
        name: 'Apple',
        sector: 'tech',
        currentPrice: 200,
        marketCapBillions: 3000,
        change: 0,
        changePercent: 0,
        priceHistory: [],
      },
      {
        symbol: 'SMALL',
        name: 'Small Corp',
        sector: 'tech',
        currentPrice: 50,
        marketCapBillions: 50,
        change: 0,
        changePercent: 0,
        priceHistory: [],
      },
    ];

    const result = calculateCollateralValue(5000, holdings, stocks);

    // Cash is NOT counted as collateral (only stock holdings)
    // AAPL: 10 × $200 × 70% = $1,400
    // SMALL: 20 × $50 × 50% = $500
    // Total: $1,900
    expect(result.cash).toBe(0);
    expect(result.largeCapStocks).toBe(1400);
    expect(result.smallCapStocks).toBe(500);
    expect(result.total).toBe(1900);
  });

  it('should handle holdings without matching stock data', () => {
    const holdings: PortfolioItem[] = [
      { symbol: 'UNKNOWN', shares: 100, avgBuyPrice: 100 },
    ];

    const result = calculateCollateralValue(1000, holdings, []);

    // Cash is NOT counted as collateral
    expect(result.cash).toBe(0);
    expect(result.largeCapStocks).toBe(0);
    expect(result.smallCapStocks).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe('calculateInterestRate', () => {
  // Use minimum duration to avoid duration discount in base tests
  const minDuration = LOAN_CONFIG.minLoanDurationCycles;

  it('should return base rate with no modifiers', () => {
    // Use minDuration to avoid duration discount
    const result = calculateInterestRate(0, 0, 0, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);

    expect(result.baseRate).toBe(LOAN_CONFIG.baseInterestRate);
    expect(result.riskProfileAdjustment).toBe(0);
    expect(result.profitHistoryAdjustment).toBe(0);
    expect(result.utilizationSurcharge).toBe(0);
    expect(result.loanCountPenalty).toBe(0);
    expect(result.durationDiscount).toBe(0);
    expect(result.effectiveRate).toBe(LOAN_CONFIG.baseInterestRate);
  });

  describe('risk profile adjustment with trade dampening', () => {
    it('should apply full conservative bonus with enough trades', () => {
      const totalTrades = LOAN_CONFIG.minTradesForFullRiskImpact;
      const result = calculateInterestRate(-50, 0, 0, 0, totalTrades, LOAN_CONFIG.initialCreditScore, minDuration);

      expect(result.riskProfileAdjustment).toBe(LOAN_CONFIG.conservativeInterestBonus);
      expect(result.effectiveRate).toBe(
        LOAN_CONFIG.baseInterestRate + LOAN_CONFIG.conservativeInterestBonus
      );
    });

    it('should apply full aggressive penalty with enough trades', () => {
      const totalTrades = LOAN_CONFIG.minTradesForFullRiskImpact;
      const result = calculateInterestRate(50, 0, 0, 0, totalTrades, LOAN_CONFIG.initialCreditScore, minDuration);

      expect(result.riskProfileAdjustment).toBe(LOAN_CONFIG.aggressiveInterestPenalty);
    });

    it('should dampen risk adjustment with fewer trades', () => {
      // 5 trades with minTradesForFullRiskImpact=10 should give 50% dampening
      const halfTrades = LOAN_CONFIG.minTradesForFullRiskImpact / 2;
      const result = calculateInterestRate(50, 0, 0, 0, halfTrades, LOAN_CONFIG.initialCreditScore, minDuration);

      expect(result.riskProfileAdjustment).toBe(LOAN_CONFIG.aggressiveInterestPenalty * 0.5);
    });

    it('should have zero risk adjustment with no trades', () => {
      const result = calculateInterestRate(50, 0, 0, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.riskProfileAdjustment).toBe(0);
    });

    it('should apply no risk adjustment for moderate scores', () => {
      const totalTrades = LOAN_CONFIG.minTradesForFullRiskImpact;
      const result = calculateInterestRate(0, 0, 0, 0, totalTrades, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.riskProfileAdjustment).toBe(0);

      const result2 = calculateInterestRate(33, 0, 0, 0, totalTrades, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result2.riskProfileAdjustment).toBe(0);

      const result3 = calculateInterestRate(-33, 0, 0, 0, totalTrades, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result3.riskProfileAdjustment).toBe(0);
    });

    it('should handle null risk score', () => {
      const result = calculateInterestRate(null, 0, 0, 0, 10, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.riskProfileAdjustment).toBe(0);
    });
  });

  describe('duration discount', () => {
    it('should have no discount at minimum duration', () => {
      const result = calculateInterestRate(0, 0, 0, 0, 0, LOAN_CONFIG.initialCreditScore, LOAN_CONFIG.minLoanDurationCycles);
      expect(result.durationDiscount).toBe(0);
    });

    it('should apply discount for each step above minimum', () => {
      const oneStepAbove = LOAN_CONFIG.minLoanDurationCycles + LOAN_CONFIG.loanDurationStepCycles;
      const result = calculateInterestRate(0, 0, 0, 0, 0, LOAN_CONFIG.initialCreditScore, oneStepAbove);
      expect(result.durationDiscount).toBe(-LOAN_CONFIG.durationDiscountPerStep);
    });

    it('should cap discount at maximum', () => {
      const result = calculateInterestRate(0, 0, 0, 0, 0, LOAN_CONFIG.initialCreditScore, LOAN_CONFIG.maxLoanDurationCycles);
      expect(result.durationDiscount).toBe(-LOAN_CONFIG.maxDurationDiscount);
    });

    it('should include duration discount in effective rate', () => {
      const twoStepsAbove = LOAN_CONFIG.minLoanDurationCycles + 2 * LOAN_CONFIG.loanDurationStepCycles;
      const result = calculateInterestRate(0, 0, 0, 0, 0, LOAN_CONFIG.initialCreditScore, twoStepsAbove);
      const expectedDiscount = -2 * LOAN_CONFIG.durationDiscountPerStep;
      expect(result.effectiveRate).toBe(LOAN_CONFIG.baseInterestRate + expectedDiscount);
    });
  });

  describe('utilization surcharges', () => {
    it('should apply utilization surcharge at 50%', () => {
      const result = calculateInterestRate(0, 0, 0.5, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.utilizationSurcharge).toBe(LOAN_CONFIG.utilizationTier50Surcharge);
    });

    it('should apply utilization surcharge at 75%', () => {
      const result = calculateInterestRate(0, 0, 0.75, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.utilizationSurcharge).toBe(LOAN_CONFIG.utilizationTier75Surcharge);
    });

    it('should apply utilization surcharge at 100%', () => {
      const result = calculateInterestRate(0, 0, 1.0, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.utilizationSurcharge).toBe(LOAN_CONFIG.utilizationTier100Surcharge);
    });
  });

  describe('loan count penalty', () => {
    it('should have no penalty for first loan', () => {
      const result = calculateInterestRate(0, 0, 0, 1, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.loanCountPenalty).toBe(0);
    });

    it('should apply penalty for each additional loan', () => {
      const result = calculateInterestRate(0, 0, 0, 2, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.loanCountPenalty).toBe(LOAN_CONFIG.additionalLoanInterestPenalty);
    });

    it('should apply penalty for 3 loans', () => {
      const result = calculateInterestRate(0, 0, 0, 3, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.loanCountPenalty).toBe(2 * LOAN_CONFIG.additionalLoanInterestPenalty);
    });

    it('should have no penalty with zero loans', () => {
      const result = calculateInterestRate(0, 0, 0, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.loanCountPenalty).toBe(0);
    });
  });

  describe('profit/loss history adjustment', () => {
    it('should not adjust rate for profitable traders', () => {
      // Profits have no effect on interest rate
      const result = calculateInterestRate(0, 10000, 0, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.profitHistoryAdjustment).toBe(0);
    });

    it('should not adjust rate for small losses below threshold', () => {
      // Loss below threshold ($5000) has no effect
      const smallLoss = -(LOAN_CONFIG.lossThresholdForHistoryImpact - 100);
      const result = calculateInterestRate(0, smallLoss, 0, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.profitHistoryAdjustment).toBe(0);
    });

    it('should increase rate for losses exceeding threshold', () => {
      // Loss exceeds threshold ($5000)
      const bigLoss = -(LOAN_CONFIG.lossThresholdForHistoryImpact + 1000);
      const result = calculateInterestRate(0, bigLoss, 0, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.profitHistoryAdjustment).toBeGreaterThan(0);
    });

    it('should calculate penalty only for excess loss amount', () => {
      // $6000 loss with $5000 threshold = $1000 excess
      const loss = -(LOAN_CONFIG.lossThresholdForHistoryImpact + 1000);
      const result = calculateInterestRate(0, loss, 0, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      const excessLoss = Math.abs(loss) - LOAN_CONFIG.lossThresholdForHistoryImpact;
      const expectedPenalty = (excessLoss / 1000) * LOAN_CONFIG.profitHistoryModifierRate;
      expect(result.profitHistoryAdjustment).toBeCloseTo(expectedPenalty);
    });

    it('should cap loss history modifier', () => {
      const result = calculateInterestRate(0, -1000000, 0, 0, 0, LOAN_CONFIG.initialCreditScore, minDuration);
      expect(result.profitHistoryAdjustment).toBeLessThanOrEqual(
        LOAN_CONFIG.maxProfitHistoryModifier
      );
    });
  });

  it('should enforce minimum 1% effective rate', () => {
    // Create conditions that would result in very low rate
    const result = calculateInterestRate(-100, 0, 0, 0, 100, LOAN_CONFIG.initialCreditScore, minDuration);
    expect(result.effectiveRate).toBeGreaterThanOrEqual(0.01);
  });
});

// ============================================================================
// REDUCER TESTS
// ============================================================================

describe('loansSlice reducers', () => {
  describe('takeLoan', () => {
    it('should add a loan with correct properties', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.08, durationCycles: 50 }));

      const state = store.getState().loans;
      expect(state.loans).toHaveLength(1);
      expect(state.loans[0].principal).toBe(10000);
      expect(state.loans[0].balance).toBe(10000);
      expect(state.loans[0].interestRate).toBe(0.08);
      expect(state.loans[0].totalInterestPaid).toBe(0);
      expect(state.loans[0].id).toMatch(/^loan_/);
      expect(state.loans[0].durationCycles).toBe(50);
      expect(state.loans[0].remainingCycles).toBe(50);
    });

    it('should track origination fee', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));

      const state = store.getState().loans;
      expect(state.totalOriginationFeesPaid).toBe(10000 * LOAN_CONFIG.originationFeePercent);
    });

    it('should allow multiple loans', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 5000, interestRate: 0.06, durationCycles: 50 }));
      store.dispatch(takeLoan({ amount: 3000, interestRate: 0.07, durationCycles: 50 }));

      expect(store.getState().loans.loans).toHaveLength(2);
    });
  });

  describe('repayLoan', () => {
    it('should reduce loan balance', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
      const loanId = store.getState().loans.loans[0].id;

      store.dispatch(repayLoan({ loanId, amount: 4000, feeDeducted: 20, isEarlyRepayment: true }));

      expect(store.getState().loans.loans[0].balance).toBe(6000);
    });

    it('should remove loan when fully repaid', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
      const loanId = store.getState().loans.loans[0].id;

      store.dispatch(repayLoan({ loanId, amount: 10000, feeDeducted: 50, isEarlyRepayment: true }));

      expect(store.getState().loans.loans).toHaveLength(0);
    });

    it('should handle overpayment gracefully', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 5000, interestRate: 0.06, durationCycles: 50 }));
      const loanId = store.getState().loans.loans[0].id;

      store.dispatch(repayLoan({ loanId, amount: 10000, feeDeducted: 25, isEarlyRepayment: true }));

      expect(store.getState().loans.loans).toHaveLength(0);
    });

    it('should ignore invalid loan ID', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));

      store.dispatch(repayLoan({ loanId: 'invalid', amount: 5000, feeDeducted: 25, isEarlyRepayment: true }));

      expect(store.getState().loans.loans[0].balance).toBe(10000);
    });

    it('should track repayment fees only for early repayment', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
      const loanId = store.getState().loans.loans[0].id;

      const repayAmount = 4000;
      const feeDeducted = repayAmount * LOAN_CONFIG.repaymentFeePercent;
      store.dispatch(repayLoan({ loanId, amount: repayAmount, feeDeducted, isEarlyRepayment: true }));

      expect(store.getState().loans.totalRepaymentFeesPaid).toBe(feeDeducted);
    });

    it('should not track fees when not early repayment', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
      const loanId = store.getState().loans.loans[0].id;

      const repayAmount = 4000;
      const feeDeducted = repayAmount * LOAN_CONFIG.repaymentFeePercent;
      store.dispatch(repayLoan({ loanId, amount: repayAmount, feeDeducted, isEarlyRepayment: false }));

      expect(store.getState().loans.totalRepaymentFeesPaid).toBe(0);
    });
  });

  describe('repayAllLoans', () => {
    it('should repay loans oldest first', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 3000, interestRate: 0.06, durationCycles: 50 }));
      store.dispatch(takeLoan({ amount: 5000, interestRate: 0.07, durationCycles: 50 }));

      // Repay $4000 - should pay off first loan ($3000) and partial second ($1000)
      store.dispatch(repayAllLoans(4000));

      const loans = store.getState().loans.loans;
      expect(loans).toHaveLength(1);
      expect(loans[0].balance).toBe(4000); // 5000 - 1000
    });

    it('should remove all loans when fully repaid', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 3000, interestRate: 0.06, durationCycles: 50 }));
      store.dispatch(takeLoan({ amount: 5000, interestRate: 0.07, durationCycles: 50 }));

      store.dispatch(repayAllLoans(10000));

      expect(store.getState().loans.loans).toHaveLength(0);
    });
  });

  describe('chargeInterest', () => {
    it('should increase loan balance by interest amount', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));

      store.dispatch(chargeInterest());

      const loan = store.getState().loans.loans[0];
      // Interest per charge = 10000 × 0.06 / 20 = 30
      const expectedInterest = 10000 * (0.06 / LOAN_CONFIG.interestChargeCycles);
      expect(loan.balance).toBe(10000 + expectedInterest);
      expect(loan.totalInterestPaid).toBe(expectedInterest);
    });

    it('should reset cycle counter after charging', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));

      // Increment counter
      for (let i = 0; i < 5; i++) {
        store.dispatch(incrementInterestCycleCounter());
      }
      expect(store.getState().loans.cyclesSinceLastInterestCharge).toBe(5);

      store.dispatch(chargeInterest());
      expect(store.getState().loans.cyclesSinceLastInterestCharge).toBe(0);
    });

    it('should track total interest paid', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));

      store.dispatch(chargeInterest());
      store.dispatch(chargeInterest());

      const state = store.getState().loans;
      const expectedInterestPerCharge = 10000 * (0.06 / LOAN_CONFIG.interestChargeCycles);
      // Second charge is on slightly higher balance
      expect(state.totalInterestPaid).toBeGreaterThan(expectedInterestPerCharge * 2 - 1);
    });
  });

  describe('incrementInterestCycleCounter', () => {
    it('should increment the cycle counter', () => {
      const store = createTestStore();

      store.dispatch(incrementInterestCycleCounter());
      expect(store.getState().loans.cyclesSinceLastInterestCharge).toBe(1);

      store.dispatch(incrementInterestCycleCounter());
      expect(store.getState().loans.cyclesSinceLastInterestCharge).toBe(2);
    });
  });

  describe('resetLoans', () => {
    it('should reset all loan state', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
      store.dispatch(incrementInterestCycleCounter());

      store.dispatch(resetLoans());

      const state = store.getState().loans;
      expect(state.loans).toHaveLength(0);
      expect(state.cyclesSinceLastInterestCharge).toBe(0);
      expect(state.totalInterestPaid).toBe(0);
      expect(state.totalOriginationFeesPaid).toBe(0);
      expect(state.totalRepaymentFeesPaid).toBe(0);
    });
  });
});

// ============================================================================
// SELECTOR TESTS
// ============================================================================

describe('loansSlice selectors', () => {
  describe('selectTotalDebt', () => {
    it('should return 0 when no loans', () => {
      const store = createTestStore();
      expect(selectTotalDebt(store.getState())).toBe(0);
    });

    it('should sum all loan balances', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 5000, interestRate: 0.06, durationCycles: 50 }));
      store.dispatch(takeLoan({ amount: 3000, interestRate: 0.07, durationCycles: 50 }));

      expect(selectTotalDebt(store.getState())).toBe(8000);
    });
  });

  describe('selectShouldChargeInterest', () => {
    it('should return false when cycles < threshold', () => {
      const store = createTestStore();
      for (let i = 0; i < LOAN_CONFIG.interestChargeCycles - 1; i++) {
        store.dispatch(incrementInterestCycleCounter());
      }
      expect(selectShouldChargeInterest(store.getState())).toBe(false);
    });

    it('should return true when cycles >= threshold', () => {
      const store = createTestStore();
      for (let i = 0; i < LOAN_CONFIG.interestChargeCycles; i++) {
        store.dispatch(incrementInterestCycleCounter());
      }
      expect(selectShouldChargeInterest(store.getState())).toBe(true);
    });
  });

  describe('selectCreditLineInfo', () => {
    it('should calculate credit line from stock holdings only (not cash)', () => {
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple',
          sector: 'tech',
          currentPrice: 200,
          marketCapBillions: 3000,
          change: 0,
          changePercent: 0,
          priceHistory: [],
        },
      ];
      const portfolio = {
        cash: 10000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 150 }],
      };

      // Use initialCash = 0 to test stock collateral without base collateral
      const store = createFullTestStore(portfolio, stocks, { orders: [] }, 0);
      const creditInfo = selectCreditLineInfo(store.getState());

      // Cash is NOT counted as collateral
      // AAPL: 10 × $200 × 70% = $1,400 → rounded to $1,000
      expect(creditInfo.recommendedCreditLine).toBe(1000);
      // Max: $1,000 × 2.5 = $2,500
      expect(creditInfo.maxCreditLine).toBe(2500);
      expect(creditInfo.currentDebt).toBe(0);
      expect(creditInfo.availableCredit).toBe(2500);
      expect(creditInfo.utilizationRatio).toBe(0);
      expect(creditInfo.collateralBreakdown.baseCollateral).toBe(0);
    });

    it('should include base collateral from starting capital', () => {
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple',
          sector: 'tech',
          currentPrice: 200,
          marketCapBillions: 3000,
          change: 0,
          changePercent: 0,
          priceHistory: [],
        },
      ];
      const portfolio = {
        cash: 10000,
        holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 150 }],
      };

      // Use initialCash = 100000 to get base collateral of $25,000
      const store = createFullTestStore(portfolio, stocks, { orders: [] }, 100000);
      const creditInfo = selectCreditLineInfo(store.getState());

      // Base collateral: $100,000 × 25% = $25,000
      // AAPL: 10 × $200 × 70% = $1,400
      // Total: $25,000 + $1,400 = $26,400 → rounded to $26,000
      expect(creditInfo.collateralBreakdown.baseCollateral).toBe(25000);
      expect(creditInfo.collateralBreakdown.largeCapStocks).toBe(1400);
      expect(creditInfo.collateralBreakdown.total).toBe(26400);
      expect(creditInfo.recommendedCreditLine).toBe(26000);
      // Max: $26,000 × 2.5 = $65,000
      expect(creditInfo.maxCreditLine).toBe(65000);
    });

    it('should round recommended credit line to nearest $1000', () => {
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple',
          sector: 'tech',
          currentPrice: 200,
          marketCapBillions: 3000,
          change: 0,
          changePercent: 0,
          priceHistory: [],
        },
      ];
      // 50 shares × $200 × 70% = $7,000 (already rounded)
      const store = createFullTestStore(
        { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 50, avgBuyPrice: 150 }] },
        stocks,
        { orders: [] },
        0  // No base collateral for this test
      );

      const creditInfo = selectCreditLineInfo(store.getState());
      expect(creditInfo.recommendedCreditLine).toBe(7000);
      expect(creditInfo.maxCreditLine).toBe(7000 * LOAN_CONFIG.maxCreditLineMultiplier);
    });

    it('should calculate utilization correctly', () => {
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple',
          sector: 'tech',
          currentPrice: 200,
          marketCapBillions: 3000,
          change: 0,
          changePercent: 0,
          priceHistory: [],
        },
      ];
      // 72 × $200 × 70% = $10,080 → rounded to $10,000 recommended
      // Max = $10,000 × 2.5 = $25,000
      const store = createFullTestStore(
        { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 72, avgBuyPrice: 150 }] },
        stocks,
        { orders: [] },
        0  // No base collateral for this test
      );
      store.dispatch(takeLoan({ amount: 12500, interestRate: 0.06, durationCycles: 50 }));

      const creditInfo = selectCreditLineInfo(store.getState());
      // $12,500 debt / $25,000 max = 0.5 utilization
      expect(creditInfo.currentDebt).toBe(12500);
      expect(creditInfo.utilizationRatio).toBe(0.5);
      // $12,500 debt / $10,000 recommended = 1.25 utilization vs recommended
      expect(creditInfo.utilizationVsRecommended).toBe(1.25);
    });

    it('should track active loans count', () => {
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple',
          sector: 'tech',
          currentPrice: 200,
          marketCapBillions: 3000,
          change: 0,
          changePercent: 0,
          priceHistory: [],
        },
      ];
      const store = createFullTestStore(
        { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }] },
        stocks,
        { orders: [] },
        0  // No base collateral for this test
      );
      store.dispatch(takeLoan({ amount: 5000, interestRate: 0.06, durationCycles: 50 }));
      store.dispatch(takeLoan({ amount: 3000, interestRate: 0.07, durationCycles: 50 }));

      const creditInfo = selectCreditLineInfo(store.getState());
      expect(creditInfo.activeLoansCount).toBe(2);
    });

    it('should reduce available credit by pending loan requests from orders', () => {
      // Setup: 100 shares of AAPL at $150 = $15,000 market value
      // Large cap collateral = $15,000 * 0.70 = $10,500
      // Recommended credit = floor($10,500 / 1000) * 1000 = $10,000
      // Max credit = $10,000 * 2.5 = $25,000
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          sector: 'tech',
          currentPrice: 150,
          change: 0,
          changePercent: 0,
          priceHistory: [],
          marketCapBillions: 3000, // Large cap
        },
      ];

      // Create store with pending orders that have loan requests
      const pendingOrders = {
        orders: [
          { loanRequest: { amount: 5000, interestRate: 0.06, durationCycles: 40 } },
          { loanRequest: { amount: 3000, interestRate: 0.06, durationCycles: 40 } },
        ],
      };

      const store = createFullTestStore(
        { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }] },
        stocks,
        pendingOrders,
        0  // No base collateral for this test
      );

      const creditInfo = selectCreditLineInfo(store.getState());

      // Max credit is $25,000, pending loan requests total $8,000
      // Available credit should be $25,000 - $8,000 = $17,000
      expect(creditInfo.maxCreditLine).toBe(25000);
      expect(creditInfo.currentDebt).toBe(0); // No actual loans yet
      expect(creditInfo.availableCredit).toBe(17000);
      expect(creditInfo.utilizationRatio).toBeCloseTo(0.32); // $8,000 / $25,000
    });

    it('should combine existing debt and pending loan requests', () => {
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          sector: 'tech',
          currentPrice: 150,
          change: 0,
          changePercent: 0,
          priceHistory: [],
          marketCapBillions: 3000,
        },
      ];

      const pendingOrders = {
        orders: [
          { loanRequest: { amount: 5000, interestRate: 0.06, durationCycles: 40 } },
        ],
      };

      const store = createFullTestStore(
        { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }] },
        stocks,
        pendingOrders,
        0  // No base collateral for this test
      );

      // Take an actual loan
      store.dispatch(takeLoan({ amount: 3000, interestRate: 0.06, durationCycles: 50 }));

      const creditInfo = selectCreditLineInfo(store.getState());

      // Max credit is $25,000
      // Existing debt: $3,000, pending loan: $5,000 = total $8,000 committed
      // Available credit should be $25,000 - $8,000 = $17,000
      expect(creditInfo.currentDebt).toBe(3000);
      expect(creditInfo.availableCredit).toBe(17000);
      expect(creditInfo.utilizationRatio).toBeCloseTo(0.32); // $8,000 / $25,000
    });

    it('should ignore orders without loan requests', () => {
      const stocks: Stock[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          sector: 'tech',
          currentPrice: 150,
          change: 0,
          changePercent: 0,
          priceHistory: [],
          marketCapBillions: 3000,
        },
      ];

      const pendingOrders = {
        orders: [
          { loanRequest: { amount: 5000, interestRate: 0.06, durationCycles: 40 } },
          {}, // Order without loan request
          { loanRequest: undefined },
        ],
      };

      const store = createFullTestStore(
        { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 150 }] },
        stocks,
        pendingOrders,
        0  // No base collateral for this test
      );

      const creditInfo = selectCreditLineInfo(store.getState());

      // Only the $5,000 loan request should count
      // Max credit is $25,000, so available should be $25,000 - $5,000 = $20,000
      expect(creditInfo.availableCredit).toBe(20000);
    });
  });

  describe('selectCanTakeLoan', () => {
    it('should return true when no loans', () => {
      const store = createTestStore();
      expect(selectCanTakeLoan(store.getState())).toBe(true);
    });

    it('should return true when under max loans', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 1000, interestRate: 0.06, durationCycles: 50 }));
      store.dispatch(takeLoan({ amount: 1000, interestRate: 0.06, durationCycles: 50 }));
      expect(selectCanTakeLoan(store.getState())).toBe(true);
    });

    it('should return false when at max loans', () => {
      const store = createTestStore();
      for (let i = 0; i < LOAN_CONFIG.maxLoans; i++) {
        store.dispatch(takeLoan({ amount: 1000, interestRate: 0.06, durationCycles: 50 }));
      }
      expect(selectCanTakeLoan(store.getState())).toBe(false);
    });
  });

  describe('selectActiveLoanCount', () => {
    it('should return the number of active loans', () => {
      const store = createTestStore();
      expect(selectActiveLoanCount(store.getState())).toBe(0);

      store.dispatch(takeLoan({ amount: 1000, interestRate: 0.06, durationCycles: 50 }));
      expect(selectActiveLoanCount(store.getState())).toBe(1);

      store.dispatch(takeLoan({ amount: 1000, interestRate: 0.06, durationCycles: 50 }));
      expect(selectActiveLoanCount(store.getState())).toBe(2);
    });
  });

  describe('selectLoanStatistics', () => {
    it('should return loan statistics', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
      store.dispatch(chargeInterest());

      const stats = selectLoanStatistics(store.getState());
      expect(stats.activeLoansCount).toBe(1);
      expect(stats.totalOriginationFeesPaid).toBe(150); // 1.5%
      expect(stats.totalInterestPaid).toBeGreaterThan(0);
      expect(stats.totalRepaymentFeesPaid).toBe(0);
    });

    it('should include repayment fees in statistics for early repayment', () => {
      const store = createTestStore();
      store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
      const loanId = store.getState().loans.loans[0].id;

      const repayAmount = 5000;
      const feeDeducted = repayAmount * LOAN_CONFIG.repaymentFeePercent;
      store.dispatch(repayLoan({ loanId, amount: repayAmount, feeDeducted, isEarlyRepayment: true }));

      const stats = selectLoanStatistics(store.getState());
      expect(stats.totalRepaymentFeesPaid).toBe(feeDeducted);
    });
  });

  describe('selectDelinquencyStats', () => {
    it('should return zero stats when no delinquencies', () => {
      const store = createTestStore();
      const stats = selectDelinquencyStats(store.getState());

      expect(stats.totalDelinquentLoans).toBe(0);
      expect(stats.activeDelinquencies).toBe(0);
      expect(stats.totalOverdueCycles).toBe(0);
      expect(stats.maxSingleOverdue).toBe(0);
      expect(stats.avgOverdueCycles).toBe(0);
    });
  });
});

// ============================================================================
// PROGRESSIVE OVERDUE PENALTY TESTS
// ============================================================================

describe('calculateProgressiveOverduePenalty', () => {
  it('should return base penalty for first cycle', () => {
    const penalty = calculateProgressiveOverduePenalty(1);
    expect(penalty).toBe(LOAN_CONFIG.creditScoreOverduePenaltyPerCycle);
  });

  it('should increase penalty after threshold cycles', () => {
    const threshold = LOAN_CONFIG.creditScoreProgressiveThreshold;
    const basePenalty = LOAN_CONFIG.creditScoreOverduePenaltyPerCycle;

    // Just before threshold: 1x multiplier (cycles 1 to threshold-1)
    const penaltyBefore = calculateProgressiveOverduePenalty(threshold - 1);
    expect(penaltyBefore).toBe(basePenalty);

    // At threshold: 2x multiplier (multiplier = 1 + floor(threshold/threshold) = 2)
    const penaltyAt = calculateProgressiveOverduePenalty(threshold);
    expect(penaltyAt).toBe(basePenalty * 2);

    // After threshold: still 2x until 2*threshold
    const penaltyAfter = calculateProgressiveOverduePenalty(threshold + 1);
    expect(penaltyAfter).toBe(basePenalty * 2);
  });

  it('should cap penalty at maximum', () => {
    // Very large number of cycles
    const penalty = calculateProgressiveOverduePenalty(1000);
    expect(penalty).toBe(LOAN_CONFIG.creditScoreMaxPenaltyPerCycle);
  });

  it('should ensure longer overdue is penalized more than multiple short ones', () => {
    // This is the key requirement from the ticket:
    // 1 loan overdue 40 cycles should be worse than 3 loans each 2 cycles overdue

    // Calculate cumulative penalty for 1 loan with 40 cycles
    let singleLoanPenalty = 0;
    for (let i = 1; i <= 40; i++) {
      singleLoanPenalty += calculateProgressiveOverduePenalty(i);
    }

    // Calculate cumulative penalty for 3 loans with 2 cycles each
    let multiLoanPenalty = 0;
    for (let loan = 0; loan < 3; loan++) {
      for (let i = 1; i <= 2; i++) {
        multiLoanPenalty += calculateProgressiveOverduePenalty(i);
      }
    }

    // 40 cycles on 1 loan should be significantly worse
    expect(singleLoanPenalty).toBeGreaterThan(multiLoanPenalty);
  });

  it('should calculate progressive multiplier correctly', () => {
    const threshold = LOAN_CONFIG.creditScoreProgressiveThreshold;
    const basePenalty = LOAN_CONFIG.creditScoreOverduePenaltyPerCycle;

    // Test each tier
    expect(calculateProgressiveOverduePenalty(1)).toBe(basePenalty); // 1x
    expect(calculateProgressiveOverduePenalty(threshold + 1)).toBe(basePenalty * 2); // 2x
    expect(calculateProgressiveOverduePenalty(2 * threshold + 1)).toBe(basePenalty * 3); // 3x
    expect(calculateProgressiveOverduePenalty(3 * threshold + 1)).toBe(basePenalty * 4); // 4x
  });
});

// ============================================================================
// LOAN WARNING TESTS
// ============================================================================

describe('markLoanWarningShown', () => {
  it('should mark a loan as warned', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 5000, interestRate: 0.06, durationCycles: 40 }));

    const loanBefore = store.getState().loans.loans[0];
    expect(loanBefore.warningShown).toBeUndefined();

    store.dispatch(markLoanWarningShown(loanBefore.id));

    const loanAfter = store.getState().loans.loans[0];
    expect(loanAfter.warningShown).toBe(true);
  });

  it('should not affect other loans', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 5000, interestRate: 0.06, durationCycles: 40 }));
    store.dispatch(takeLoan({ amount: 3000, interestRate: 0.06, durationCycles: 30 }));

    const loan1 = store.getState().loans.loans[0];

    store.dispatch(markLoanWarningShown(loan1.id));

    const updatedState = store.getState().loans.loans;
    expect(updatedState[0].warningShown).toBe(true);
    expect(updatedState[1].warningShown).toBeUndefined();
  });

  it('should handle non-existent loan ID gracefully', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 5000, interestRate: 0.06, durationCycles: 40 }));

    // Should not throw
    store.dispatch(markLoanWarningShown('non-existent-id'));

    // Existing loan should be unchanged
    const loan = store.getState().loans.loans[0];
    expect(loan.warningShown).toBeUndefined();
  });
});

describe('selectLoansDueSoon', () => {
  it('should return loans within warning threshold', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-1',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: LOAN_CONFIG.loanDueWarningCycles, // Exactly at threshold
          isOverdue: false,
          overdueForCycles: 0,
        },
        {
          id: 'loan-2',
          loanNumber: 2,
          principal: 3000,
          balance: 3000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 30,
          remainingCycles: LOAN_CONFIG.loanDueWarningCycles + 1, // Just outside threshold
          isOverdue: false,
          overdueForCycles: 0,
        },
      ],
    });

    const dueSoon = selectLoansDueSoon(store.getState());
    expect(dueSoon).toHaveLength(1);
    expect(dueSoon[0].id).toBe('loan-1');
  });

  it('should exclude loans with warningShown=true', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-warned',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: LOAN_CONFIG.loanDueWarningCycles,
          isOverdue: false,
          overdueForCycles: 0,
          warningShown: true, // Already warned
        },
        {
          id: 'loan-not-warned',
          loanNumber: 2,
          principal: 3000,
          balance: 3000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 30,
          remainingCycles: LOAN_CONFIG.loanDueWarningCycles - 1, // Within threshold
          isOverdue: false,
          overdueForCycles: 0,
        },
      ],
    });

    const dueSoon = selectLoansDueSoon(store.getState());
    expect(dueSoon).toHaveLength(1);
    expect(dueSoon[0].id).toBe('loan-not-warned');
  });

  it('should exclude overdue loans', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-overdue',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 2,
          isOverdue: true, // Already overdue
          overdueForCycles: 3,
        },
      ],
    });

    const dueSoon = selectLoansDueSoon(store.getState());
    expect(dueSoon).toHaveLength(0);
  });

  it('should exclude loans with remainingCycles=0', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-due-now',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0, // Due NOW, not "due soon"
          isOverdue: false,
          overdueForCycles: 0,
        },
      ],
    });

    const dueSoon = selectLoansDueSoon(store.getState());
    expect(dueSoon).toHaveLength(0);
  });
});

// ============================================================================
// PROCESS LOAN MATURITY TESTS
// ============================================================================

describe('processLoanMaturity', () => {
  it('should mark loan as overdue when not fully repaid', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
    const loanId = store.getState().loans.loans[0].id;

    store.dispatch(processLoanMaturity({ loanId, amountRepaid: 5000, wasFullyRepaid: false }));

    const loan = store.getState().loans.loans[0];
    expect(loan.isOverdue).toBe(true);
    expect(loan.balance).toBe(5000);
  });

  it('should remove loan and increase credit score when fully repaid', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
    const loanId = store.getState().loans.loans[0].id;
    const initialScore = store.getState().loans.creditScore;

    store.dispatch(processLoanMaturity({ loanId, amountRepaid: 10000, wasFullyRepaid: true }));

    expect(store.getState().loans.loans).toHaveLength(0);
    expect(store.getState().loans.creditScore).toBe(initialScore + LOAN_CONFIG.creditScoreOnTimeBonus);
  });

  it('should add auto_repaid credit event when fully repaid', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
    const loanId = store.getState().loans.loans[0].id;

    store.dispatch(processLoanMaturity({ loanId, amountRepaid: 10000, wasFullyRepaid: true }));

    const history = store.getState().loans.creditHistory;
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('auto_repaid');
  });

  it('should create delinquency record when loan becomes overdue', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
    const loanId = store.getState().loans.loans[0].id;

    store.dispatch(processLoanMaturity({ loanId, amountRepaid: 5000, wasFullyRepaid: false }));

    const delinquencyHistory = store.getState().loans.delinquencyHistory;
    expect(delinquencyHistory).toHaveLength(1);
    expect(delinquencyHistory[0].loanId).toBe(loanId);
  });

  it('should ignore non-existent loan', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));

    store.dispatch(processLoanMaturity({ loanId: 'non-existent', amountRepaid: 5000, wasFullyRepaid: false }));

    expect(store.getState().loans.loans).toHaveLength(1);
    expect(store.getState().loans.loans[0].balance).toBe(10000);
  });
});

// ============================================================================
// DECREMENT LOAN CYCLES TESTS
// ============================================================================

describe('decrementLoanCycles', () => {
  it('should decrement remaining cycles for non-overdue loans', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));

    store.dispatch(decrementLoanCycles());

    expect(store.getState().loans.loans[0].remainingCycles).toBe(49);
  });

  it('should not decrement below 0', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-1',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: false,
          overdueForCycles: 0,
        },
      ],
    });

    store.dispatch(decrementLoanCycles());

    expect(store.getState().loans.loans[0].remainingCycles).toBe(0);
  });

  it('should increment overdueForCycles for overdue loans', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-overdue',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: true,
          overdueForCycles: 2,
        },
      ],
    });

    store.dispatch(decrementLoanCycles());

    expect(store.getState().loans.loans[0].overdueForCycles).toBe(3);
  });

  it('should apply progressive penalty for overdue loans', () => {
    const store = createTestStore({
      creditScore: LOAN_CONFIG.initialCreditScore,
      loans: [
        {
          id: 'loan-overdue',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: true,
          overdueForCycles: 0,
        },
      ],
    });

    const initialScore = store.getState().loans.creditScore;
    store.dispatch(decrementLoanCycles());

    const expectedPenalty = calculateProgressiveOverduePenalty(1);
    expect(store.getState().loans.creditScore).toBe(initialScore - expectedPenalty);
  });

  it('should add overdue credit event', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-overdue',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: true,
          overdueForCycles: 0,
        },
      ],
      delinquencyHistory: [
        {
          loanId: 'loan-overdue',
          maxOverdueCycles: 0,
          startedAt: Date.now(),
        },
      ],
    });

    store.dispatch(decrementLoanCycles());

    const history = store.getState().loans.creditHistory;
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('overdue');
  });

  it('should update delinquency record with max overdue cycles', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-overdue',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: true,
          overdueForCycles: 5,
        },
      ],
      delinquencyHistory: [
        {
          loanId: 'loan-overdue',
          maxOverdueCycles: 5,
          startedAt: Date.now(),
        },
      ],
    });

    store.dispatch(decrementLoanCycles());

    const delinquencyHistory = store.getState().loans.delinquencyHistory;
    expect(delinquencyHistory[0].maxOverdueCycles).toBe(6);
  });
});

// ============================================================================
// RESTORE LOANS TESTS
// ============================================================================

describe('restoreLoans', () => {
  it('should restore full state', () => {
    const store = createTestStore();
    const savedState = {
      loans: [
        {
          id: 'saved-loan',
          loanNumber: 1,
          principal: 10000,
          balance: 8000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 100,
          durationCycles: 50,
          remainingCycles: 30,
          isOverdue: false,
          overdueForCycles: 0,
        },
      ],
      cyclesSinceLastInterestCharge: 5,
      totalInterestPaid: 100,
      totalOriginationFeesPaid: 150,
      totalRepaymentFeesPaid: 25,
      creditScore: 60,
      creditHistory: [],
      delinquencyHistory: [],
      nextLoanNumber: 2,
    };

    store.dispatch(restoreLoans(savedState));

    const state = store.getState().loans;
    expect(state.loans).toHaveLength(1);
    expect(state.loans[0].id).toBe('saved-loan');
    expect(state.creditScore).toBe(60);
    expect(state.cyclesSinceLastInterestCharge).toBe(5);
  });

  it('should migrate loans without loanNumber', () => {
    const store = createTestStore();
    const savedState = {
      loans: [
        {
          id: 'old-loan-1',
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now() - 1000,
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 30,
          isOverdue: false,
          overdueForCycles: 0,
          // No loanNumber property - old save file
        },
        {
          id: 'old-loan-2',
          principal: 3000,
          balance: 3000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 30,
          remainingCycles: 20,
          isOverdue: false,
          overdueForCycles: 0,
          // No loanNumber property
        },
      ],
      cyclesSinceLastInterestCharge: 0,
      totalInterestPaid: 0,
      totalOriginationFeesPaid: 0,
      totalRepaymentFeesPaid: 0,
      creditScore: 50,
      creditHistory: [],
      delinquencyHistory: [],
      // No nextLoanNumber property
    };

    store.dispatch(restoreLoans(savedState as unknown as ReturnType<typeof loansReducer>));

    const state = store.getState().loans;
    expect(state.loans[0].loanNumber).toBe(1);
    expect(state.loans[1].loanNumber).toBe(2);
    expect(state.nextLoanNumber).toBe(3);
  });
});

// ============================================================================
// ADDITIONAL SELECTOR TESTS
// ============================================================================

describe('selectLoansDueNow', () => {
  it('should return loans with remainingCycles=0 that are not overdue', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-due-now',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: false,
          overdueForCycles: 0,
        },
        {
          id: 'loan-not-due',
          loanNumber: 2,
          principal: 3000,
          balance: 3000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 30,
          remainingCycles: 5,
          isOverdue: false,
          overdueForCycles: 0,
        },
      ],
    });

    const dueNow = selectLoansDueNow(store.getState());
    expect(dueNow).toHaveLength(1);
    expect(dueNow[0].id).toBe('loan-due-now');
  });

  it('should exclude overdue loans', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-overdue',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: true,
          overdueForCycles: 3,
        },
      ],
    });

    const dueNow = selectLoansDueNow(store.getState());
    expect(dueNow).toHaveLength(0);
  });
});

describe('selectOverdueLoans', () => {
  it('should return only overdue loans', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-overdue',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: true,
          overdueForCycles: 3,
        },
        {
          id: 'loan-normal',
          loanNumber: 2,
          principal: 3000,
          balance: 3000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 30,
          remainingCycles: 10,
          isOverdue: false,
          overdueForCycles: 0,
        },
      ],
    });

    const overdueLoans = selectOverdueLoans(store.getState());
    expect(overdueLoans).toHaveLength(1);
    expect(overdueLoans[0].id).toBe('loan-overdue');
  });
});

describe('selectHasOverdueLoans', () => {
  it('should return false when no overdue loans', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 5000, interestRate: 0.06, durationCycles: 40 }));

    expect(selectHasOverdueLoans(store.getState())).toBe(false);
  });

  it('should return true when there are overdue loans', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'loan-overdue',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: true,
          overdueForCycles: 1,
        },
      ],
    });

    expect(selectHasOverdueLoans(store.getState())).toBe(true);
  });
});

describe('selectCreditScore', () => {
  it('should return current credit score', () => {
    const store = createTestStore({ creditScore: 75 });
    expect(selectCreditScore(store.getState())).toBe(75);
  });
});

describe('selectCreditHistory', () => {
  it('should return credit history', () => {
    const store = createTestStore({
      creditHistory: [
        { type: 'repaid_early', change: 5, timestamp: Date.now() },
      ],
    });

    const history = selectCreditHistory(store.getState());
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('repaid_early');
  });
});

describe('selectPendingInterest', () => {
  it('should return 0 when no cycles since last charge', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));

    expect(selectPendingInterest(store.getState())).toBe(0);
  });

  it('should calculate pending interest correctly', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
    store.dispatch(incrementInterestCycleCounter());
    store.dispatch(incrementInterestCycleCounter());

    const pendingInterest = selectPendingInterest(store.getState());
    // Interest per cycle = 10000 * (0.06 / 20) = 30 per cycle
    // After 2 cycles = 60
    expect(pendingInterest).toBeCloseTo(60);
  });
});

describe('selectCyclesSinceLastInterestCharge', () => {
  it('should return cycles since last charge', () => {
    const store = createTestStore();
    store.dispatch(incrementInterestCycleCounter());
    store.dispatch(incrementInterestCycleCounter());
    store.dispatch(incrementInterestCycleCounter());

    expect(selectCyclesSinceLastInterestCharge(store.getState())).toBe(3);
  });
});

describe('selectAllLoans', () => {
  it('should return all loans', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 5000, interestRate: 0.06, durationCycles: 40 }));
    store.dispatch(takeLoan({ amount: 3000, interestRate: 0.06, durationCycles: 30 }));

    const loans = selectAllLoans(store.getState());
    expect(loans).toHaveLength(2);
  });
});

describe('selectPendingLoanCount', () => {
  it('should count pending orders with loan requests', () => {
    const stocks: Stock[] = [];
    const pendingOrders = {
      orders: [
        { loanRequest: { amount: 5000, interestRate: 0.06, durationCycles: 40 } },
        { loanRequest: { amount: 3000, interestRate: 0.06, durationCycles: 30 } },
        {}, // No loan request
      ],
    };

    const store = createFullTestStore({ cash: 10000, holdings: [] }, stocks, pendingOrders);

    expect(selectPendingLoanCount(store.getState())).toBe(2);
  });
});

describe('selectEffectiveLoanCount', () => {
  it('should sum active loans and pending loan requests', () => {
    const stocks: Stock[] = [];
    const pendingOrders = {
      orders: [
        { loanRequest: { amount: 5000, interestRate: 0.06, durationCycles: 40 } },
      ],
    };

    const store = createFullTestStore({ cash: 10000, holdings: [] }, stocks, pendingOrders);
    store.dispatch(takeLoan({ amount: 3000, interestRate: 0.06, durationCycles: 30 }));

    expect(selectEffectiveLoanCount(store.getState())).toBe(2);
  });
});

describe('selectCanTakeLoanEffective', () => {
  it('should return true when under max considering pending', () => {
    const stocks: Stock[] = [];
    const pendingOrders = {
      orders: [
        { loanRequest: { amount: 5000, interestRate: 0.06, durationCycles: 40 } },
      ],
    };

    const store = createFullTestStore({ cash: 10000, holdings: [] }, stocks, pendingOrders);
    store.dispatch(takeLoan({ amount: 3000, interestRate: 0.06, durationCycles: 30 }));

    // 1 active + 1 pending = 2, max is 3
    expect(selectCanTakeLoanEffective(store.getState())).toBe(true);
  });

  it('should return false when at max considering pending', () => {
    const stocks: Stock[] = [];
    const pendingOrders = {
      orders: [
        { loanRequest: { amount: 5000, interestRate: 0.06, durationCycles: 40 } },
        { loanRequest: { amount: 2000, interestRate: 0.06, durationCycles: 30 } },
      ],
    };

    const store = createFullTestStore({ cash: 10000, holdings: [] }, stocks, pendingOrders);
    store.dispatch(takeLoan({ amount: 3000, interestRate: 0.06, durationCycles: 30 }));

    // 1 active + 2 pending = 3 = max
    expect(selectCanTakeLoanEffective(store.getState())).toBe(false);
  });
});

describe('selectRemainingLoanSlots', () => {
  it('should return remaining slots considering active and pending', () => {
    const stocks: Stock[] = [];
    const pendingOrders = {
      orders: [
        { loanRequest: { amount: 5000, interestRate: 0.06, durationCycles: 40 } },
      ],
    };

    const store = createFullTestStore({ cash: 10000, holdings: [] }, stocks, pendingOrders);

    // 0 active + 1 pending = 1, max is 3, remaining = 2
    expect(selectRemainingLoanSlots(store.getState())).toBe(2);
  });

  it('should return 0 when at max', () => {
    const stocks: Stock[] = [];
    const pendingOrders = {
      orders: [
        { loanRequest: { amount: 5000, interestRate: 0.06, durationCycles: 40 } },
        { loanRequest: { amount: 2000, interestRate: 0.06, durationCycles: 30 } },
        { loanRequest: { amount: 1000, interestRate: 0.06, durationCycles: 20 } },
      ],
    };

    const store = createFullTestStore({ cash: 10000, holdings: [] }, stocks, pendingOrders);

    expect(selectRemainingLoanSlots(store.getState())).toBe(0);
  });
});

// ============================================================================
// HELPER FUNCTION TESTS (ADDITIONAL)
// ============================================================================

describe('calculateCreditScoreAdjustment', () => {
  it('should return 0 for neutral score', () => {
    expect(calculateCreditScoreAdjustment(LOAN_CONFIG.initialCreditScore)).toBe(0);
  });

  it('should return positive (penalty) for bad credit', () => {
    const adjustment = calculateCreditScoreAdjustment(30); // Below 50
    expect(adjustment).toBeGreaterThan(0);
  });

  it('should return negative (bonus) for good credit', () => {
    const adjustment = calculateCreditScoreAdjustment(70); // Above 50
    expect(adjustment).toBeLessThan(0);
  });
});

describe('calculateDurationDiscount', () => {
  it('should return 0 below minimum duration', () => {
    expect(calculateDurationDiscount(LOAN_CONFIG.minLoanDurationCycles - 10)).toBe(0);
  });

  it('should return 0 at minimum duration', () => {
    expect(calculateDurationDiscount(LOAN_CONFIG.minLoanDurationCycles)).toBe(0);
  });

  it('should return negative discount for longer durations', () => {
    const discount = calculateDurationDiscount(LOAN_CONFIG.minLoanDurationCycles + LOAN_CONFIG.loanDurationStepCycles);
    expect(discount).toBeLessThan(0);
  });
});

// ============================================================================
// REPAY LOAN CREDIT SCORE TESTS
// ============================================================================

// ============================================================================
// EARLY VS REGULAR REPAYMENT COST COMPARISON TESTS
// ============================================================================

describe('Early vs Regular Repayment Cost Comparison', () => {
  /**
   * These tests document the realistic cost difference between early and regular loan repayment.
   *
   * Cost components:
   * 1. Origination Fee: 1.5% of loan amount (same for both options)
   * 2. Interest: 6% base rate, charged every 20 cycles as (balance × rate / 20) = 0.3% per period
   * 3. Early Repayment Fee: 0.5% of repayment amount (only for early repayment)
   *
   * Key insight (realistic behavior like real-world finance):
   * - Interest per period: 0.30% of balance
   * - Early repayment fee: 0.50% of balance
   * - Break-even: ~1.67 saved interest periods
   *
   * This means:
   * - Short loans (40 cycles / 2 periods): Early repayment is MORE EXPENSIVE (saves only 1 period)
   * - Long loans (60+ cycles / 3+ periods): Early repayment SAVES MONEY (saves 2+ periods)
   *
   * This is realistic: In real finance, prepayment penalties often make early repayment
   * unattractive for short-term loans. However, players still have non-financial incentives:
   * - Credit score bonus: +5 (early) vs +3 (on-time)
   * - Frees up a loan slot (max 3 concurrent loans)
   * - Reduces risk of default during market crashes
   */

  // Helper function to calculate compound interest over a number of periods
  const calculateCompoundInterest = (
    principal: number,
    interestRate: number,
    periods: number
  ): { totalInterest: number; finalBalance: number } => {
    const interestChargeCycles = LOAN_CONFIG.interestChargeCycles;
    let balance = principal;
    let totalInterest = 0;

    for (let i = 0; i < periods; i++) {
      const interestThisPeriod = balance * (interestRate / interestChargeCycles);
      totalInterest += interestThisPeriod;
      balance += interestThisPeriod;
    }

    return { totalInterest, finalBalance: balance };
  };

  // Helper function to calculate total interest paid over full loan term
  const calculateTotalInterestForFullTerm = (
    principal: number,
    interestRate: number,
    durationCycles: number
  ): number => {
    const numberOfInterestPeriods = Math.floor(durationCycles / LOAN_CONFIG.interestChargeCycles);
    return calculateCompoundInterest(principal, interestRate, numberOfInterestPeriods).totalInterest;
  };

  // Helper function to calculate cost of early repayment
  const calculateEarlyRepaymentCost = (
    principal: number,
    interestRate: number,
    repayAtCycle: number,
    totalDurationCycles: number
  ): {
    interestPaid: number;
    earlyRepaymentFee: number;
    totalCost: number;
    savedInterest: number;
  } => {
    const interestChargeCycles = LOAN_CONFIG.interestChargeCycles;
    const periodsBeforeRepayment = Math.floor(repayAtCycle / interestChargeCycles);
    const totalPeriods = Math.floor(totalDurationCycles / interestChargeCycles);

    const { totalInterest: interestPaid, finalBalance: balance } =
      calculateCompoundInterest(principal, interestRate, periodsBeforeRepayment);

    const earlyRepaymentFee = balance * LOAN_CONFIG.repaymentFeePercent;

    const { totalInterest: remainingInterest } =
      calculateCompoundInterest(balance, interestRate, totalPeriods - periodsBeforeRepayment);

    return {
      interestPaid,
      earlyRepaymentFee,
      totalCost: interestPaid + earlyRepaymentFee,
      savedInterest: remainingInterest,
    };
  };

  // Helper function to calculate and compare repayment costs
  const calculateRepaymentComparison = (
    principal: number,
    interestRate: number,
    durationCycles: number,
    repayAtCycle: number = 20
  ): {
    fullTermTotal: number;
    earlyRepaymentTotal: number;
    savings: number;
  } => {
    const fullTermInterest = calculateTotalInterestForFullTerm(principal, interestRate, durationCycles);
    const originationFee = principal * LOAN_CONFIG.originationFeePercent;
    const earlyRepayment = calculateEarlyRepaymentCost(principal, interestRate, repayAtCycle, durationCycles);

    const fullTermTotal = originationFee + fullTermInterest;
    const earlyRepaymentTotal = originationFee + earlyRepayment.totalCost;

    return {
      fullTermTotal,
      earlyRepaymentTotal,
      savings: fullTermTotal - earlyRepaymentTotal,
    };
  };

  describe('Short-term loans: early repayment is more expensive', () => {
    it('should show that early repayment costs MORE for 40-cycle loans', () => {
      const principal = 10000;
      const interestRate = LOAN_CONFIG.baseInterestRate;
      const durationCycles = 40; // 2 interest periods

      const fullTermInterest = calculateTotalInterestForFullTerm(principal, interestRate, durationCycles);
      const originationFee = principal * LOAN_CONFIG.originationFeePercent;
      const earlyRepayment = calculateEarlyRepaymentCost(principal, interestRate, 20, durationCycles);

      const fullTermTotal = originationFee + fullTermInterest;
      const earlyRepaymentTotal = originationFee + earlyRepayment.totalCost;

      // For short loans, early repayment is MORE expensive
      // Because: 0.5% fee > 0.3% saved interest (only 1 period saved)
      expect(earlyRepaymentTotal).toBeGreaterThan(fullTermTotal);

      // The extra cost is approximately: fee (0.5%) - saved interest (0.3%) = ~0.2% of principal
      const extraCost = earlyRepaymentTotal - fullTermTotal;
      expect(extraCost).toBeGreaterThan(0);
      expect(extraCost).toBeLessThan(principal * 0.003); // Less than 0.3%
    });

    it('should apply to all loan amounts for 40-cycle duration', () => {
      const amounts = [1000, 5000, 10000, 50000, 100000];
      const interestRate = LOAN_CONFIG.baseInterestRate;
      const duration = 40;

      amounts.forEach(principal => {
        const originationFee = principal * LOAN_CONFIG.originationFeePercent;
        const fullTermInterest = calculateTotalInterestForFullTerm(principal, interestRate, duration);
        const fullTermTotal = originationFee + fullTermInterest;

        const earlyRepayment = calculateEarlyRepaymentCost(principal, interestRate, 20, duration);
        const earlyRepaymentTotal = originationFee + earlyRepayment.totalCost;

        // Early repayment should be more expensive for all amounts
        expect(earlyRepaymentTotal).toBeGreaterThan(fullTermTotal);
      });
    });
  });

  describe('Long-term loans: early repayment saves money', () => {
    it('should show that early repayment SAVES money for 60-cycle loans', () => {
      const { fullTermTotal, earlyRepaymentTotal, savings } =
        calculateRepaymentComparison(10000, LOAN_CONFIG.baseInterestRate, 60);

      // For longer loans, early repayment saves money
      expect(earlyRepaymentTotal).toBeLessThan(fullTermTotal);
      expect(savings).toBeGreaterThan(0);
    });

    it('should show substantial savings for 100-cycle loans', () => {
      const { fullTermTotal, earlyRepaymentTotal, savings } =
        calculateRepaymentComparison(10000, LOAN_CONFIG.baseInterestRate, 100);

      // Substantial savings for long-term loans
      expect(earlyRepaymentTotal).toBeLessThan(fullTermTotal);
      expect(savings).toBeGreaterThan(50); // Meaningful savings
    });

    const longDurations = [60, 80, 100];
    const amounts = [1000, 5000, 10000, 50000, 100000];

    longDurations.forEach(duration => {
      amounts.forEach(principal => {
        it(`should save money: $${principal} loan, ${duration} cycles`, () => {
          const { fullTermTotal, earlyRepaymentTotal } =
            calculateRepaymentComparison(principal, LOAN_CONFIG.baseInterestRate, duration);

          expect(earlyRepaymentTotal).toBeLessThan(fullTermTotal);
        });
      });
    });
  });

  describe('Break-even analysis', () => {
    it('should calculate the break-even point correctly', () => {
      // Interest per period: 6% / 20 = 0.3%
      // Early repayment fee: 0.5%
      // Break-even: 0.5% / 0.3% ≈ 1.67 periods

      const interestPerPeriod = LOAN_CONFIG.baseInterestRate / LOAN_CONFIG.interestChargeCycles;
      const earlyRepaymentFee = LOAN_CONFIG.repaymentFeePercent;
      const breakEvenPeriods = earlyRepaymentFee / interestPerPeriod;

      expect(breakEvenPeriods).toBeCloseTo(1.67, 1);

      // This means: need to save MORE than 1.67 periods to break even
      // 40 cycles = 2 periods, save 1 → NOT profitable
      // 60 cycles = 3 periods, save 2 → profitable
    });

    it('should verify fee configuration in config', () => {
      expect(LOAN_CONFIG.originationFeePercent).toBe(0.015);
      expect(LOAN_CONFIG.repaymentFeePercent).toBe(0.005);
      expect(LOAN_CONFIG.baseInterestRate).toBe(0.06);
      expect(LOAN_CONFIG.interestChargeCycles).toBe(20);
    });
  });

  describe('Non-financial incentives for early repayment', () => {
    it('should give higher credit score bonus for early repayment', () => {
      // Even when early repayment costs more financially,
      // there's a credit score incentive
      expect(LOAN_CONFIG.creditScoreEarlyBonus).toBe(5);
      expect(LOAN_CONFIG.creditScoreOnTimeBonus).toBe(3);
      expect(LOAN_CONFIG.creditScoreEarlyBonus).toBeGreaterThan(LOAN_CONFIG.creditScoreOnTimeBonus);
    });
  });

  describe('Integration test with Redux store', () => {
    it('should demonstrate actual loan flow: early repayment saves money for long loans', () => {
      const store = createTestStore();
      const principal = 10000;
      const interestRate = LOAN_CONFIG.baseInterestRate;
      const duration = 60; // 3 interest periods - long enough for savings

      store.dispatch(takeLoan({ amount: principal, interestRate, durationCycles: duration }));
      const loanId = store.getState().loans.loans[0].id;

      const originationFee = store.getState().loans.totalOriginationFeesPaid;
      expect(originationFee).toBe(principal * LOAN_CONFIG.originationFeePercent);

      // Simulate one interest period
      for (let i = 0; i < LOAN_CONFIG.interestChargeCycles; i++) {
        store.dispatch(incrementInterestCycleCounter());
      }
      store.dispatch(chargeInterest());

      const balanceAfterFirstPeriod = store.getState().loans.loans[0].balance;
      const interestFirstPeriod = balanceAfterFirstPeriod - principal;

      const earlyRepaymentFee = balanceAfterFirstPeriod * LOAN_CONFIG.repaymentFeePercent;
      store.dispatch(repayLoan({
        loanId,
        amount: balanceAfterFirstPeriod,
        feeDeducted: earlyRepaymentFee,
        isEarlyRepayment: true,
      }));

      expect(store.getState().loans.loans).toHaveLength(0);

      const fullTermInterest = calculateTotalInterestForFullTerm(principal, interestRate, duration);
      const actualCost = originationFee + interestFirstPeriod + earlyRepaymentFee;
      const fullTermCost = originationFee + fullTermInterest;

      expect(actualCost).toBeLessThan(fullTermCost);
    });
  });
});

describe('repayLoan credit score effects', () => {
  it('should give early repayment bonus', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
    const loanId = store.getState().loans.loans[0].id;
    const initialScore = store.getState().loans.creditScore;

    store.dispatch(repayLoan({ loanId, amount: 10000, feeDeducted: 50, isEarlyRepayment: true }));

    expect(store.getState().loans.creditScore).toBe(initialScore + LOAN_CONFIG.creditScoreEarlyBonus);
    const history = store.getState().loans.creditHistory;
    expect(history[0].type).toBe('repaid_early');
  });

  it('should give on-time bonus for non-early full repayment', () => {
    const store = createTestStore();
    store.dispatch(takeLoan({ amount: 10000, interestRate: 0.06, durationCycles: 50 }));
    const loanId = store.getState().loans.loans[0].id;
    const initialScore = store.getState().loans.creditScore;

    store.dispatch(repayLoan({ loanId, amount: 10000, feeDeducted: 0, isEarlyRepayment: false }));

    expect(store.getState().loans.creditScore).toBe(initialScore + LOAN_CONFIG.creditScoreOnTimeBonus);
  });

  it('should not give bonus when repaying overdue loan', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'overdue-loan',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: true,
          overdueForCycles: 3,
        },
      ],
      delinquencyHistory: [
        { loanId: 'overdue-loan', maxOverdueCycles: 3, startedAt: Date.now() },
      ],
    });

    const initialScore = store.getState().loans.creditScore;

    store.dispatch(repayLoan({ loanId: 'overdue-loan', amount: 5000, feeDeducted: 0, isEarlyRepayment: false }));

    // No score change when repaying overdue
    expect(store.getState().loans.creditScore).toBe(initialScore);
  });

  it('should mark delinquency as resolved when overdue loan fully repaid', () => {
    const store = createTestStore({
      loans: [
        {
          id: 'overdue-loan',
          loanNumber: 1,
          principal: 5000,
          balance: 5000,
          interestRate: 0.06,
          createdAt: Date.now(),
          totalInterestPaid: 0,
          durationCycles: 40,
          remainingCycles: 0,
          isOverdue: true,
          overdueForCycles: 3,
        },
      ],
      delinquencyHistory: [
        { loanId: 'overdue-loan', maxOverdueCycles: 3, startedAt: Date.now() },
      ],
    });

    store.dispatch(repayLoan({ loanId: 'overdue-loan', amount: 5000, feeDeducted: 0, isEarlyRepayment: false }));

    const delinquencyHistory = store.getState().loans.delinquencyHistory;
    expect(delinquencyHistory[0].resolvedAt).toBeDefined();
  });
});

// ============================================================================
// BASE COLLATERAL INTEGRATION TESTS
// ============================================================================

describe('Base Collateral Integration', () => {
  it('should allow player to borrow based on base collateral even without stocks', () => {
    // Player with $100,000 starting capital has $25,000 base collateral
    // This gives them a credit line of $25,000 × 2.5 = $62,500
    const store = createFullTestStore(
      { cash: 100000, holdings: [] },  // No stock holdings
      [],                               // No stocks available
      { orders: [] },
      100000                            // initialCash = $100,000
    );

    const creditInfo = selectCreditLineInfo(store.getState());

    expect(creditInfo.collateralBreakdown.baseCollateral).toBe(25000);
    expect(creditInfo.collateralBreakdown.largeCapStocks).toBe(0);
    expect(creditInfo.collateralBreakdown.smallCapStocks).toBe(0);
    expect(creditInfo.recommendedCreditLine).toBe(25000);
    expect(creditInfo.maxCreditLine).toBe(62500);
    expect(creditInfo.availableCredit).toBe(62500);
  });

  it('should enable scenario where player loses more than starting capital', () => {
    // This tests the "burn through base collateral" scenario from Ticket #810
    //
    // Scenario:
    // 1. Player starts with $100,000
    // 2. Player takes max loans ($62,500) using base collateral
    // 3. Player loses all cash + borrowed money
    // 4. Net worth becomes: $0 - $62,500 = -$62,500
    // 5. Player lost $162,500 total (more than the $100,000 starting capital!)
    //
    // The base collateral ($25,000) enabled this "over-loss" because it
    // counts toward creditworthiness but NOT toward net worth.

    const store = createFullTestStore(
      { cash: 100000, holdings: [] },
      [],
      { orders: [] },
      100000
    );

    // Take maximum loan using base collateral
    store.dispatch(takeLoan({ amount: 62500, interestRate: 0.06, durationCycles: 40 }));

    const state = store.getState();
    const totalDebt = selectTotalDebt(state);

    // Player now has: cash + loan = $100,000 + $62,500 = $162,500
    // But their net worth is: $100,000 + $62,500 (cash) - $62,500 (debt) = $100,000
    // (Base collateral is NOT included in net worth)

    // If they lose all their cash...
    // Net worth would be: $0 - $62,500 = -$62,500

    expect(totalDebt).toBe(62500);
    expect(state.loans.loans.length).toBe(1);

    // The credit line info should show the debt
    const creditInfo = selectCreditLineInfo(state);
    expect(creditInfo.currentDebt).toBe(62500);
    expect(creditInfo.utilizationRatio).toBe(1); // 100% utilized

    // Verify that base collateral enabled this loan
    // Without base collateral (initialCash = 0), maxCreditLine would be 0
    const storeWithoutBase = createFullTestStore(
      { cash: 100000, holdings: [] },
      [],
      { orders: [] },
      0  // No base collateral
    );
    const creditInfoNoBase = selectCreditLineInfo(storeWithoutBase.getState());
    expect(creditInfoNoBase.maxCreditLine).toBe(0);
    expect(creditInfoNoBase.availableCredit).toBe(0);
  });

  it('should combine base collateral with stock collateral', () => {
    const stocks: Stock[] = [
      {
        symbol: 'AAPL',
        name: 'Apple',
        sector: 'tech',
        currentPrice: 200,
        marketCapBillions: 3000,  // Large cap
        change: 0,
        changePercent: 0,
        priceHistory: [],
      },
    ];

    // Player with $100,000 starting capital and $14,000 in large-cap stocks
    // Base collateral: $25,000
    // Stock collateral: $14,000 × 70% = $9,800
    // Total: $34,800 → recommended $34,000
    const store = createFullTestStore(
      { cash: 86000, holdings: [{ symbol: 'AAPL', shares: 70, avgBuyPrice: 150 }] },
      stocks,
      { orders: [] },
      100000
    );

    const creditInfo = selectCreditLineInfo(store.getState());

    expect(creditInfo.collateralBreakdown.baseCollateral).toBe(25000);
    expect(creditInfo.collateralBreakdown.largeCapStocks).toBe(9800); // 70 × $200 × 0.70
    expect(creditInfo.collateralBreakdown.total).toBe(34800);
    expect(creditInfo.recommendedCreditLine).toBe(34000);
    expect(creditInfo.maxCreditLine).toBe(85000);
  });
});
