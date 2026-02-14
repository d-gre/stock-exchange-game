import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Loan, InterestRateBreakdown, CreditLineInfo, Stock, PortfolioItem, CreditScoreEvent, CreditEventType, DelinquencyRecord } from '../types';
import { LOAN_CONFIG } from '../config';

// ============================================================================
// STATE INTERFACE
// ============================================================================

interface LoansState {
  /** All active loans */
  loans: Loan[];
  /** Cycles since last interest charge */
  cyclesSinceLastInterestCharge: number;
  /** Total interest paid across all loans (for statistics) */
  totalInterestPaid: number;
  /** Total origination fees paid (for statistics) */
  totalOriginationFeesPaid: number;
  /** Total repayment fees paid (for statistics) */
  totalRepaymentFeesPaid: number;
  /** Player's credit score (0-100, 50 = neutral) */
  creditScore: number;
  /** History of credit score events */
  creditHistory: CreditScoreEvent[];
  /** History of all loans that were ever overdue (for delinquency tracking) */
  delinquencyHistory: DelinquencyRecord[];
  /** Next sequential loan number to assign */
  nextLoanNumber: number;
}

const initialState: LoansState = {
  loans: [],
  cyclesSinceLastInterestCharge: 0,
  totalInterestPaid: 0,
  totalOriginationFeesPaid: 0,
  totalRepaymentFeesPaid: 0,
  creditScore: LOAN_CONFIG.initialCreditScore,
  creditHistory: [],
  delinquencyHistory: [],
  nextLoanNumber: 1,
};

// ============================================================================
// HELPER FUNCTIONS (exported for testing)
// ============================================================================

/**
 * Generates a unique loan ID
 */
const generateLoanId = (): string =>
  `loan_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

/**
 * Calculates collateral value based on portfolio
 *
 * Only stock holdings count as collateral - cash is NOT included.
 * This ensures players must have actual investments to take loans.
 *
 * Base collateral (from starting capital) can be added separately.
 * It improves creditworthiness but does NOT count toward net worth,
 * allowing players to lose more than their starting capital.
 */
export const calculateCollateralValue = (
  _cash: number,
  holdings: PortfolioItem[],
  stocks: Stock[],
  baseCollateral: number = 0
): { cash: number; largeCapStocks: number; smallCapStocks: number; baseCollateral: number; total: number } => {
  const {
    largeCapCollateralRatio,
    smallCapCollateralRatio,
    largeCapThresholdBillions,
  } = LOAN_CONFIG;

  // Cash is NOT counted as collateral
  const cashCollateral = 0;

  let largeCapCollateral = 0;
  let smallCapCollateral = 0;

  for (const holding of holdings) {
    const stock = stocks.find(s => s.symbol === holding.symbol);
    if (!stock) continue;

    const holdingValue = stock.currentPrice * holding.shares;

    if (stock.marketCapBillions > largeCapThresholdBillions) {
      largeCapCollateral += holdingValue * largeCapCollateralRatio;
    } else {
      smallCapCollateral += holdingValue * smallCapCollateralRatio;
    }
  }

  return {
    cash: cashCollateral,
    largeCapStocks: largeCapCollateral,
    smallCapStocks: smallCapCollateral,
    baseCollateral,
    total: largeCapCollateral + smallCapCollateral + baseCollateral,
  };
};

/**
 * Calculates credit score adjustment for interest rate
 * Score of 50 = neutral (no adjustment)
 * Score < 50 = penalty (higher rate)
 * Score > 50 = bonus (lower rate)
 */
export const calculateCreditScoreAdjustment = (creditScore: number): number => {
  const {
    creditScorePenaltyRate,
    creditScoreBonusRate,
    initialCreditScore,
  } = LOAN_CONFIG;

  const deviation = creditScore - initialCreditScore; // 50 is neutral

  if (deviation < 0) {
    // Bad credit: penalty (positive adjustment = higher rate)
    return Math.abs(deviation) * creditScorePenaltyRate;
  } else if (deviation > 0) {
    // Good credit: bonus (negative adjustment = lower rate)
    return -deviation * creditScoreBonusRate;
  }
  return 0;
};

/**
 * Calculates the duration-based interest discount
 * Longer loans get better rates to incentivize commitment
 */
export const calculateDurationDiscount = (durationCycles: number): number => {
  const {
    minLoanDurationCycles,
    loanDurationStepCycles,
    durationDiscountPerStep,
    maxDurationDiscount,
  } = LOAN_CONFIG;

  // Calculate how many steps above minimum
  const stepsAboveMin = Math.floor((durationCycles - minLoanDurationCycles) / loanDurationStepCycles);

  if (stepsAboveMin <= 0) return 0;

  // Calculate discount (negative value = lower rate)
  const rawDiscount = stepsAboveMin * durationDiscountPerStep;
  return -Math.min(rawDiscount, maxDurationDiscount);
};

/**
 * Calculates the effective interest rate with all modifiers
 */
export const calculateInterestRate = (
  riskScore: number | null,
  totalRealizedProfitLoss: number,
  utilizationRatio: number,
  loanCount: number,
  totalTrades: number = 0,
  creditScore: number = LOAN_CONFIG.initialCreditScore,
  durationCycles: number = LOAN_CONFIG.defaultLoanDurationCycles
): InterestRateBreakdown => {
  const {
    baseInterestRate,
    conservativeInterestBonus,
    aggressiveInterestPenalty,
    minTradesForFullRiskImpact,
    utilizationTier50Surcharge,
    utilizationTier75Surcharge,
    utilizationTier100Surcharge,
    additionalLoanInterestPenalty,
    profitHistoryModifierRate,
    maxProfitHistoryModifier,
    lossThresholdForHistoryImpact,
  } = LOAN_CONFIG;

  const baseRate = baseInterestRate;

  // Calculate dampening factor based on trade count
  const dampeningFactor = Math.min(1, totalTrades / minTradesForFullRiskImpact);

  // Risk profile adjustment (dampened by trade count)
  let riskProfileAdjustment = 0;
  if (riskScore !== null) {
    let rawAdjustment = 0;
    if (riskScore <= -34) {
      rawAdjustment = conservativeInterestBonus;
    } else if (riskScore >= 34) {
      rawAdjustment = aggressiveInterestPenalty;
    }
    riskProfileAdjustment = rawAdjustment * dampeningFactor;
  }

  // Profit/loss history adjustment
  let profitHistoryAdjustment = 0;
  if (totalRealizedProfitLoss < -lossThresholdForHistoryImpact) {
    const excessLoss = Math.abs(totalRealizedProfitLoss) - lossThresholdForHistoryImpact;
    const rawLossModifier = (excessLoss / 1000) * profitHistoryModifierRate;
    profitHistoryAdjustment = Math.min(maxProfitHistoryModifier, rawLossModifier);
  }

  // Progressive utilization surcharge
  let utilizationSurcharge = 0;
  if (utilizationRatio >= 1.0) {
    utilizationSurcharge = utilizationTier100Surcharge;
  } else if (utilizationRatio >= 0.75) {
    utilizationSurcharge = utilizationTier75Surcharge;
  } else if (utilizationRatio >= 0.50) {
    utilizationSurcharge = utilizationTier50Surcharge;
  }

  // Loan count penalty (first loan is free)
  const loanCountPenalty = Math.max(0, loanCount - 1) * additionalLoanInterestPenalty;

  // Credit score adjustment
  const creditScoreAdjustment = calculateCreditScoreAdjustment(creditScore);

  // Duration discount (longer loans get better rates)
  const durationDiscount = calculateDurationDiscount(durationCycles);

  // Calculate effective rate with minimum of 1%
  const effectiveRate = Math.max(
    0.01,
    baseRate + riskProfileAdjustment + profitHistoryAdjustment + utilizationSurcharge + loanCountPenalty + creditScoreAdjustment + durationDiscount
  );

  return {
    baseRate,
    riskProfileAdjustment,
    profitHistoryAdjustment,
    utilizationSurcharge,
    loanCountPenalty,
    creditScoreAdjustment,
    durationDiscount,
    effectiveRate,
  };
};

/**
 * Clamp credit score to valid range
 */
const clampCreditScore = (score: number): number => {
  return Math.max(LOAN_CONFIG.minCreditScore, Math.min(LOAN_CONFIG.maxCreditScore, score));
};

/**
 * Calculates the progressive penalty for an overdue cycle.
 * The penalty increases the longer a loan is overdue, making prolonged
 * delinquency more severe than multiple short-term delinquencies.
 *
 * Formula: basePenalty * (1 + floor(overdueForCycles / threshold))
 * Example with threshold=5:
 *   - Cycles 1-5:   1x base penalty
 *   - Cycles 6-10:  2x base penalty
 *   - Cycles 11-15: 3x base penalty
 *   - etc.
 *
 * This ensures:
 *   - 1 loan overdue for 40 cycles >> 3 loans each overdue for 2 cycles
 */
export const calculateProgressiveOverduePenalty = (overdueForCycles: number): number => {
  const {
    creditScoreOverduePenaltyPerCycle,
    creditScoreProgressiveThreshold,
    creditScoreMaxPenaltyPerCycle,
  } = LOAN_CONFIG;

  const multiplier = 1 + Math.floor(overdueForCycles / creditScoreProgressiveThreshold);
  const penalty = creditScoreOverduePenaltyPerCycle * multiplier;

  return Math.min(penalty, creditScoreMaxPenaltyPerCycle);
};

// ============================================================================
// SLICE DEFINITION
// ============================================================================

const loansSlice = createSlice({
  name: 'loans',
  initialState,
  reducers: {
    /**
     * Take a new loan with specified duration
     */
    takeLoan: (state, action: PayloadAction<{
      amount: number;
      interestRate: number;
      durationCycles: number;
    }>) => {
      const { amount, interestRate, durationCycles } = action.payload;
      const originationFee = amount * LOAN_CONFIG.originationFeePercent;

      const loan: Loan = {
        id: generateLoanId(),
        loanNumber: state.nextLoanNumber,
        principal: amount,
        balance: amount,
        interestRate,
        createdAt: Date.now(),
        totalInterestPaid: 0,
        durationCycles,
        remainingCycles: durationCycles,
        isOverdue: false,
        overdueForCycles: 0,
      };

      state.loans.push(loan);
      state.totalOriginationFeesPaid += originationFee;
      state.nextLoanNumber += 1;
    },

    /**
     * Repay a specific loan (partially or fully)
     * Fee is only charged for EARLY repayment (remainingCycles > 0 and not overdue)
     */
    repayLoan: (state, action: PayloadAction<{
      loanId: string;
      amount: number;
      feeDeducted: number;
      isEarlyRepayment: boolean;
    }>) => {
      const { loanId, amount, feeDeducted, isEarlyRepayment } = action.payload;
      const loan = state.loans.find(l => l.id === loanId);
      if (!loan) return;

      loan.balance = Math.max(0, loan.balance - amount);

      // Only track fee if it was actually charged (early repayment only)
      if (isEarlyRepayment && feeDeducted > 0) {
        state.totalRepaymentFeesPaid += feeDeducted;
      }

      // Handle full repayment
      if (loan.balance <= 0) {
        // Determine credit event type
        let eventType: CreditEventType;
        let scoreChange: number;

        if (loan.isOverdue) {
          // Repaid while overdue - no bonus, just stop the bleeding
          eventType = 'repaid_on_time';
          scoreChange = 0;

          // Mark the delinquency record as resolved
          const delinquencyRecord = state.delinquencyHistory.find(
            d => d.loanId === loanId && d.resolvedAt === undefined
          );
          if (delinquencyRecord) {
            delinquencyRecord.resolvedAt = Date.now();
          }
        } else if (isEarlyRepayment) {
          // Early repayment - bonus!
          eventType = 'repaid_early';
          scoreChange = LOAN_CONFIG.creditScoreEarlyBonus;
        } else {
          // On-time repayment at maturity
          eventType = 'repaid_on_time';
          scoreChange = LOAN_CONFIG.creditScoreOnTimeBonus;
        }

        // Record credit event
        if (scoreChange !== 0) {
          state.creditScore = clampCreditScore(state.creditScore + scoreChange);
          state.creditHistory.push({
            type: eventType,
            change: scoreChange,
            loanId,
            timestamp: Date.now(),
          });
        }

        // Remove the loan
        state.loans = state.loans.filter(l => l.id !== loanId);
      }
    },

    /**
     * Process automatic repayment at loan maturity
     * Returns the loan that was processed for the caller to handle cash deduction
     */
    processLoanMaturity: (state, action: PayloadAction<{
      loanId: string;
      amountRepaid: number;
      wasFullyRepaid: boolean;
    }>) => {
      const { loanId, amountRepaid, wasFullyRepaid } = action.payload;
      const loan = state.loans.find(l => l.id === loanId);
      if (!loan) return;

      loan.balance = Math.max(0, loan.balance - amountRepaid);

      if (wasFullyRepaid) {
        // Auto-repaid successfully at maturity
        const scoreChange = LOAN_CONFIG.creditScoreOnTimeBonus;
        state.creditScore = clampCreditScore(state.creditScore + scoreChange);
        state.creditHistory.push({
          type: 'auto_repaid',
          change: scoreChange,
          loanId,
          timestamp: Date.now(),
        });
        state.loans = state.loans.filter(l => l.id !== loanId);
      } else {
        // Couldn't fully repay - mark as overdue and create delinquency record
        loan.isOverdue = true;
        state.delinquencyHistory.push({
          loanId,
          maxOverdueCycles: 0,
          startedAt: Date.now(),
        });
      }
    },

    /**
     * Decrement remaining cycles for all loans and process overdue status.
     * Uses progressive penalty: longer overdue periods are punished more severely.
     */
    decrementLoanCycles: (state) => {
      for (const loan of state.loans) {
        if (!loan.isOverdue) {
          loan.remainingCycles = Math.max(0, loan.remainingCycles - 1);
        } else {
          // Already overdue - increment overdue counter and apply progressive penalty
          loan.overdueForCycles += 1;

          // Calculate progressive penalty (increases with duration)
          const penaltyThisCycle = calculateProgressiveOverduePenalty(loan.overdueForCycles);
          state.creditScore = clampCreditScore(state.creditScore - penaltyThisCycle);

          // Record the credit event
          state.creditHistory.push({
            type: 'overdue',
            change: -penaltyThisCycle,
            loanId: loan.id,
            timestamp: Date.now(),
            description: `Overdue for ${loan.overdueForCycles} cycles (penalty: ${penaltyThisCycle})`,
          });

          // Update delinquency record with max overdue cycles
          const delinquencyRecord = state.delinquencyHistory.find(
            d => d.loanId === loan.id && d.resolvedAt === undefined
          );
          if (delinquencyRecord) {
            delinquencyRecord.maxOverdueCycles = loan.overdueForCycles;
          }
        }
      }
    },

    /**
     * Repay all loans with available funds (oldest first)
     */
    repayAllLoans: (state, action: PayloadAction<number>) => {
      let remainingFunds = action.payload;

      // Sort by creation date (oldest first)
      const sortedLoans = [...state.loans].sort((a, b) => a.createdAt - b.createdAt);

      for (const loan of sortedLoans) {
        if (remainingFunds <= 0) break;

        const paymentAmount = Math.min(remainingFunds, loan.balance);
        loan.balance -= paymentAmount;
        remainingFunds -= paymentAmount;
      }

      // Remove fully repaid loans
      state.loans = state.loans.filter(l => l.balance > 0);
    },

    /**
     * Charge interest on all loans
     */
    chargeInterest: (state) => {
      for (const loan of state.loans) {
        const interestAmount = loan.balance * (loan.interestRate / LOAN_CONFIG.interestChargeCycles);
        loan.balance += interestAmount;
        loan.totalInterestPaid += interestAmount;
        state.totalInterestPaid += interestAmount;
      }
      state.cyclesSinceLastInterestCharge = 0;
    },

    /**
     * Increment the cycle counter
     */
    incrementInterestCycleCounter: (state) => {
      state.cyclesSinceLastInterestCharge += 1;
    },

    /**
     * Reset all loan state (for new game)
     */
    resetLoans: () => initialState,

    /**
     * Restore loans state from saved game
     * Handles migration from old save files without loanNumber
     */
    restoreLoans: (_state, action: PayloadAction<LoansState>) => {
      const restoredState = action.payload;

      // Migrate loans without loanNumber (from old save files)
      let maxLoanNumber = 0;
      restoredState.loans = restoredState.loans.map((loan, index) => {
        if (loan.loanNumber === undefined) {
          // Assign sequential numbers based on creation order
          const assignedNumber = index + 1;
          maxLoanNumber = Math.max(maxLoanNumber, assignedNumber);
          return { ...loan, loanNumber: assignedNumber };
        }
        maxLoanNumber = Math.max(maxLoanNumber, loan.loanNumber);
        return loan;
      });

      // Ensure nextLoanNumber is set correctly
      if (restoredState.nextLoanNumber === undefined) {
        restoredState.nextLoanNumber = maxLoanNumber + 1;
      }

      return restoredState;
    },

    /**
     * Mark a loan's warning as shown (to prevent duplicate warnings)
     */
    markLoanWarningShown: (state, action: PayloadAction<string>) => {
      const loan = state.loans.find(l => l.id === action.payload);
      if (loan) {
        loan.warningShown = true;
      }
    },
  },
});

// ============================================================================
// ACTIONS
// ============================================================================

export const {
  takeLoan,
  repayLoan,
  processLoanMaturity,
  decrementLoanCycles,
  repayAllLoans,
  chargeInterest,
  incrementInterestCycleCounter,
  resetLoans,
  restoreLoans,
  markLoanWarningShown,
} = loansSlice.actions;

// ============================================================================
// SELECTORS
// ============================================================================

// Type for the root state
interface RootStateWithLoans {
  loans: LoansState;
  portfolio: { cash: number; holdings: PortfolioItem[] };
  stocks: { items: Stock[] };
  pendingOrders: { orders: Array<{ loanRequest?: { amount: number; interestRate: number; durationCycles: number } }> };
  settings: { initialCash: number };
}

/** Select all active loans */
export const selectAllLoans = (state: RootStateWithLoans): Loan[] =>
  state.loans.loans;

/** Select total outstanding debt */
export const selectTotalDebt = (state: RootStateWithLoans): number =>
  state.loans.loans.reduce((sum, loan) => sum + loan.balance, 0);

/** Select number of active loans */
export const selectActiveLoanCount = (state: RootStateWithLoans): number =>
  state.loans.loans.length;

/** Check if player can take another loan (max 3) - DEPRECATED */
export const selectCanTakeLoan = (state: RootStateWithLoans): boolean =>
  state.loans.loans.length < LOAN_CONFIG.maxLoans;

/** Select number of pending orders with loan requests */
export const selectPendingLoanCount = (state: RootStateWithLoans): number =>
  state.pendingOrders.orders.filter(order => order.loanRequest !== undefined).length;

/** Select effective loan count (active loans + pending orders with loans) */
export const selectEffectiveLoanCount = (state: RootStateWithLoans): number =>
  state.loans.loans.length + selectPendingLoanCount(state);

/** Check if player can take another loan considering pending orders */
export const selectCanTakeLoanEffective = (state: RootStateWithLoans): boolean =>
  selectEffectiveLoanCount(state) < LOAN_CONFIG.maxLoans;

/** Select remaining loan slots */
export const selectRemainingLoanSlots = (state: RootStateWithLoans): number =>
  Math.max(0, LOAN_CONFIG.maxLoans - selectEffectiveLoanCount(state));

/** Select cycles since last interest charge */
export const selectCyclesSinceLastInterestCharge = (state: RootStateWithLoans): number =>
  state.loans.cyclesSinceLastInterestCharge;

/** Check if interest should be charged this cycle */
export const selectShouldChargeInterest = (state: RootStateWithLoans): boolean =>
  state.loans.cyclesSinceLastInterestCharge >= LOAN_CONFIG.interestChargeCycles;

/** Select pending interest */
export const selectPendingInterest = (state: RootStateWithLoans): number => {
  const cyclesSinceLastCharge = state.loans.cyclesSinceLastInterestCharge;
  if (cyclesSinceLastCharge === 0) return 0;

  return state.loans.loans.reduce((total, loan) => {
    const interestPerCycle = loan.balance * (loan.interestRate / LOAN_CONFIG.interestChargeCycles);
    return total + interestPerCycle * cyclesSinceLastCharge;
  }, 0);
};

/** Select loan statistics */
export const selectLoanStatistics = createSelector(
  [
    (state: RootStateWithLoans) => state.loans.totalInterestPaid,
    (state: RootStateWithLoans) => state.loans.totalOriginationFeesPaid,
    (state: RootStateWithLoans) => state.loans.totalRepaymentFeesPaid,
    (state: RootStateWithLoans) => state.loans.loans.length,
  ],
  (totalInterestPaid, totalOriginationFeesPaid, totalRepaymentFeesPaid, activeLoansCount) => ({
    totalInterestPaid,
    totalOriginationFeesPaid,
    totalRepaymentFeesPaid,
    activeLoansCount,
  })
);

/** Select player's credit score */
export const selectCreditScore = (state: RootStateWithLoans): number =>
  state.loans.creditScore;

/** Select credit history */
export const selectCreditHistory = (state: RootStateWithLoans): CreditScoreEvent[] =>
  state.loans.creditHistory;

/** Select delinquency history (all loans that were ever overdue) */
export const selectDelinquencyHistory = (state: RootStateWithLoans): DelinquencyRecord[] =>
  state.loans.delinquencyHistory;

/**
 * Select delinquency statistics for display in the credit score card.
 * Calculates summary statistics about the player's delinquency history.
 */
export const selectDelinquencyStats = createSelector(
  [(state: RootStateWithLoans) => state.loans.delinquencyHistory],
  (delinquencyHistory): {
    totalDelinquentLoans: number;
    activeDelinquencies: number;
    totalOverdueCycles: number;
    maxSingleOverdue: number;
    avgOverdueCycles: number;
  } => {
    if (delinquencyHistory.length === 0) {
      return {
        totalDelinquentLoans: 0,
        activeDelinquencies: 0,
        totalOverdueCycles: 0,
        maxSingleOverdue: 0,
        avgOverdueCycles: 0,
      };
    }

    const activeDelinquencies = delinquencyHistory.filter(d => d.resolvedAt === undefined).length;
    const totalOverdueCycles = delinquencyHistory.reduce((sum, d) => sum + d.maxOverdueCycles, 0);
    const maxSingleOverdue = Math.max(...delinquencyHistory.map(d => d.maxOverdueCycles));
    const avgOverdueCycles = totalOverdueCycles / delinquencyHistory.length;

    return {
      totalDelinquentLoans: delinquencyHistory.length,
      activeDelinquencies,
      totalOverdueCycles,
      maxSingleOverdue,
      avgOverdueCycles,
    };
  }
);

/** Select loans that are due soon (within warning threshold) and haven't been warned yet - memoized */
export const selectLoansDueSoon = createSelector(
  [(state: RootStateWithLoans) => state.loans.loans],
  (loans): Loan[] => loans.filter(
    loan => !loan.isOverdue && !loan.warningShown && loan.remainingCycles > 0 && loan.remainingCycles <= LOAN_CONFIG.loanDueWarningCycles
  )
);

/** Select loans that are due NOW (remainingCycles === 0 and not yet overdue) - memoized */
export const selectLoansDueNow = createSelector(
  [(state: RootStateWithLoans) => state.loans.loans],
  (loans): Loan[] => loans.filter(loan => !loan.isOverdue && loan.remainingCycles === 0)
);

/** Select overdue loans - memoized */
export const selectOverdueLoans = createSelector(
  [(state: RootStateWithLoans) => state.loans.loans],
  (loans): Loan[] => loans.filter(loan => loan.isOverdue)
);

/** Select if player has any overdue loans */
export const selectHasOverdueLoans = (state: RootStateWithLoans): boolean =>
  state.loans.loans.some(loan => loan.isOverdue);

/**
 * Select credit line info (memoized)
 *
 * Includes base collateral from starting capital (25% by default).
 * Base collateral improves creditworthiness but does NOT count toward net worth.
 */
export const selectCreditLineInfo = createSelector(
  [
    (state: RootStateWithLoans) => state.portfolio.cash,
    (state: RootStateWithLoans) => state.portfolio.holdings,
    (state: RootStateWithLoans) => state.stocks.items,
    (state: RootStateWithLoans) => state.loans.loans,
    (state: RootStateWithLoans) => state.pendingOrders.orders,
    (state: RootStateWithLoans) => state.settings.initialCash,
  ],
  (cash, holdings, stocks, loans, pendingOrders, initialCash): CreditLineInfo => {
    // Calculate base collateral from starting capital
    const baseCollateral = initialCash * LOAN_CONFIG.baseCollateralPercent;

    const collateralBreakdown = calculateCollateralValue(cash, holdings, stocks, baseCollateral);
    const currentDebt = loans.reduce((sum, loan) => sum + loan.balance, 0);

    const pendingLoanAmount = pendingOrders.reduce(
      (sum, order) => sum + (order.loanRequest?.amount ?? 0),
      0
    );

    const recommendedCreditLine = Math.floor(collateralBreakdown.total / 1000) * 1000;
    const maxCreditLine = recommendedCreditLine * LOAN_CONFIG.maxCreditLineMultiplier;

    const totalCommittedDebt = currentDebt + pendingLoanAmount;
    const availableCredit = Math.max(0, maxCreditLine - totalCommittedDebt);
    const utilizationRatio = maxCreditLine > 0 ? totalCommittedDebt / maxCreditLine : 0;
    const utilizationVsRecommended = recommendedCreditLine > 0 ? totalCommittedDebt / recommendedCreditLine : 0;

    return {
      recommendedCreditLine,
      maxCreditLine,
      currentDebt,
      availableCredit,
      utilizationRatio,
      utilizationVsRecommended,
      activeLoansCount: loans.length,
      collateralBreakdown: {
        largeCapStocks: collateralBreakdown.largeCapStocks,
        smallCapStocks: collateralBreakdown.smallCapStocks,
        baseCollateral: collateralBreakdown.baseCollateral,
        total: collateralBreakdown.total,
      },
    };
  }
);

export default loansSlice.reducer;
