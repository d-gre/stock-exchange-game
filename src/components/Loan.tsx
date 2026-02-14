import { useState, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  takeLoan,
  selectCreditLineInfo,
  selectCanTakeLoanEffective,
  selectEffectiveLoanCount,
  calculateInterestRate,
} from '../store/loansSlice';
import { selectRiskProfile } from '../store/tradeHistorySlice';
import { closeLoanModal } from '../store/uiSlice';
import { addCash } from '../store/portfolioSlice';
import { LOAN_CONFIG } from '../config';
import { LoanInfoDetails } from './LoanInfoDetails';
import { formatCurrency, formatPercent as formatPercentUtil, getFormatLocale } from '../utils/formatting';

/**
 * Modal for taking new loans
 * Shows credit line info, interest rate breakdown, and cost summary
 */
export const Loan = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();

  const creditLineInfo = useAppSelector(selectCreditLineInfo);
  const canTakeNewLoan = useAppSelector(selectCanTakeLoanEffective);
  const effectiveLoanCount = useAppSelector(selectEffectiveLoanCount);
  const riskProfile = useAppSelector(selectRiskProfile);

  const locale = getFormatLocale(i18n.language);

  // Initialize amount with recommended credit line (capped at available credit)
  const [amount, setAmount] = useState<string>(() => {
    const initialAmount = Math.min(creditLineInfo.recommendedCreditLine, creditLineInfo.availableCredit);
    return initialAmount > 0 ? initialAmount.toString() : '';
  });

  // Loan duration state
  const [durationCycles, setDurationCycles] = useState<number>(LOAN_CONFIG.defaultLoanDurationCycles);

  // Generate duration options
  const durationOptions = useMemo(() => {
    const options: number[] = [];
    for (
      let cycles = LOAN_CONFIG.minLoanDurationCycles;
      cycles <= LOAN_CONFIG.maxLoanDurationCycles;
      cycles += LOAN_CONFIG.loanDurationStepCycles
    ) {
      options.push(cycles);
    }
    return options;
  }, []);

  const formatMoney = (num: number): string => formatCurrency(num, 2, locale);
  const formatRate = (rate: number): string => formatPercentUtil(rate, 2, false, locale);

  const loanAmount = parseFloat(amount) || 0;

  // Calculate interest rate with current parameters
  // EXACTLY same logic as TradePanel for consistency
  const interestBreakdown = useMemo(() => {
    // Calculate new utilization after this loan (same as TradePanel)
    const newUtilization = creditLineInfo.maxCreditLine > 0
      ? (creditLineInfo.currentDebt + loanAmount) / creditLineInfo.maxCreditLine
      : 0;
    return calculateInterestRate(
      riskProfile?.riskScore ?? null,
      riskProfile?.totalRealizedProfitLoss ?? 0,
      newUtilization,
      effectiveLoanCount,
      riskProfile?.totalTrades ?? 0,
      LOAN_CONFIG.initialCreditScore,
      durationCycles
    );
  }, [riskProfile, creditLineInfo.currentDebt, creditLineInfo.maxCreditLine, loanAmount, effectiveLoanCount, durationCycles]);
  const originationFee = loanAmount * LOAN_CONFIG.originationFeePercent;
  const netDisbursement = loanAmount - originationFee;

  const canTakeLoan = canTakeNewLoan && loanAmount > 0 && loanAmount <= creditLineInfo.availableCredit;

  const handleClose = () => {
    dispatch(closeLoanModal());
  };

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      // Limit to available credit
      const numValue = parseFloat(value) || 0;
      if (numValue > creditLineInfo.availableCredit) {
        setAmount(creditLineInfo.availableCredit.toString());
      } else {
        setAmount(value);
      }
    }
  };

  const handleConfirmLoan = () => {
    if (!canTakeLoan) return;

    // Take the loan
    dispatch(takeLoan({
      amount: loanAmount,
      interestRate: interestBreakdown.effectiveRate,
      durationCycles,
    }));

    // Add net amount to portfolio (after origination fee)
    dispatch(addCash(netDisbursement));

    handleClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal loan">
        <div className="modal-header">
          <h2>{t('loans.takeLoan')} ({t('loans.remaining', { count: LOAN_CONFIG.maxLoans - effectiveLoanCount })})</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          {/* 1. Loan Amount */}
          <div className="loan__amount-section">
            <label className="loan__amount-label">{t('loans.amount')}:</label>
            <div className="loan__amount-input-wrapper">
              <div className="loan__amount-input">
                <span className="loan__currency-symbol">$</span>
                <input
                  type="text"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0"
                  disabled={!canTakeNewLoan}
                />
              </div>
              <span className="loan__amount-hint">
                {t('loans.maxAvailable')}: {formatMoney(creditLineInfo.availableCredit)}
              </span>
            </div>
          </div>

          {/* 2. Duration Selection */}
          <div className="loan__duration-section">
            <label className="loan__duration-label">{t('loans.duration')}:</label>
            <div className="loan__duration-options">
              {durationOptions.map(cycles => (
                <button
                  key={cycles}
                  type="button"
                  className={`loan__duration-option${durationCycles === cycles ? ' loan__duration-option--selected' : ''}`}
                  onClick={() => setDurationCycles(cycles)}
                  disabled={!canTakeNewLoan}
                >
                  {cycles}
                </button>
              ))}
            </div>
            <span className="loan__duration-unit">{t('loans.cycles')}</span>
          </div>

          {/* 3. Effective Interest Rate */}
          <div className="loan__rate-row">
            <span className="loan__rate-label">{t('loans.effectiveRate')}:</span>
            <span className="loan__rate-value">{formatRate(interestBreakdown.effectiveRate)}</span>
          </div>

          {/* 4. Origination Fee */}
          <div className="loan__fee-row">
            <span className="loan__fee-label">
              {t('loans.originationFee')} ({formatRate(LOAN_CONFIG.originationFeePercent)}):
            </span>
            <span className="loan__fee-value">
              {loanAmount > 0 ? formatMoney(originationFee) : '-'}
            </span>
          </div>

          {/* 5. Conditions (expandable) */}
          <LoanInfoDetails
            creditLineInfo={creditLineInfo}
            interestBreakdown={interestBreakdown}
          />

          {/* 6. Net Disbursement */}
          {loanAmount > 0 && (
            <div className="loan__net-row">
              <span className="loan__net-label">{t('loans.netDisbursement')}:</span>
              <span className="loan__net-value">{formatMoney(netDisbursement)}</span>
            </div>
          )}

          {/* Confirm Button */}
          <button
            className="loan__confirm-btn"
            onClick={handleConfirmLoan}
            disabled={!canTakeLoan}
          >
            {t('loans.confirmLoan')}
          </button>
        </div>
      </div>
    </div>
  );
};
