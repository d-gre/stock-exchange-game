import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectAllLoans,
  selectCreditLineInfo,
  selectCanTakeLoanEffective,
  selectRemainingLoanSlots,
  repayLoan,
} from '../store/loansSlice';
import { openLoanModal, clearLoanHighlight } from '../store/uiSlice';
import { deductCash } from '../store/portfolioSlice';
import { dismissNotificationsForLoan } from '../store/notificationsSlice';
import { PlusCircleIcon, DollarCircleIcon, LockIcon, AlertTriangleIcon } from './Icons';
import { LOAN_CONFIG } from '../config';
import type { Loan } from '../types';
import { formatCurrency, formatNumber, formatPercent as formatPercentUtil, getFormatLocale, toRomanNumeral } from '../utils/formatting';

/**
 * Displays the list of active loans in the portfolio panel
 * Allows taking new loans and repaying existing ones
 */
export const LoansList = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();

  const loans = useAppSelector(selectAllLoans);
  const cash = useAppSelector(state => state.portfolio.cash);
  const creditLineInfo = useAppSelector(selectCreditLineInfo);
  const canTakeLoan = useAppSelector(selectCanTakeLoanEffective);
  const remainingLoanSlots = useAppSelector(selectRemainingLoanSlots);
  // Check if trade panel is open (blocks loan modal)
  const isTradePanelOpen = useAppSelector(state => state.ui.tradeModal.isOpen);
  // Check if a loan is highlighted (from toast click)
  const highlightedLoanId = useAppSelector(state => state.ui.highlightedLoanId);

  // Check stock collateral value (excluding cash)
  const stockCollateral = creditLineInfo.collateralBreakdown.largeCapStocks +
                          creditLineInfo.collateralBreakdown.smallCapStocks;
  // Minimum collateral required to take a loan (prevents tiny loans)
  const hasInsufficientCollateral = stockCollateral < LOAN_CONFIG.minCollateralForLoan;
  // Allow opening modal if there's sufficient stock collateral and trade panel is not open
  const canOpenNewLoan = canTakeLoan && !hasInsufficientCollateral && !isTradePanelOpen;

  const locale = getFormatLocale(i18n.language);

  // Hide entire component if no loans and insufficient collateral
  if (loans.length === 0 && hasInsufficientCollateral) {
    return null;
  }

  const formatMoney = (num: number): string => formatCurrency(num, 2, locale);
  const formatRate = (rate: number): string => formatPercentUtil(rate, 1, false, locale);

  /**
   * Generate loan display name (e.g., "K#I", "L#II")
   */
  const getLoanName = (loan: Loan): string => {
    const abbreviation = t('loans.loanAbbreviation');
    return `${abbreviation}#${toRomanNumeral(loan.loanNumber)}`;
  };

  const handleOpenModal = () => {
    dispatch(openLoanModal());
  };

  /**
   * Calculate total cost to fully repay a loan (balance + fee if early repayment)
   */
  const calculateFullRepaymentCost = (loan: Loan): number => {
    const isEarlyRepayment = loan.remainingCycles > 0 && !loan.isOverdue;
    const fee = isEarlyRepayment ? loan.balance * LOAN_CONFIG.repaymentFeePercent : 0;
    return loan.balance + fee;
  };

  /**
   * Check if user has enough cash to fully repay a loan
   */
  const canRepayFully = (loan: Loan, availableCash: number): boolean => {
    return availableCash >= calculateFullRepaymentCost(loan);
  };

  const handleRepayLoan = (loan: Loan) => {
    // Safety check: only allow full repayment if user has enough cash
    if (!canRepayFully(loan, cash)) {
      return;
    }

    // Check if this is an early repayment (fee applies only if remainingCycles > 0 and not overdue)
    const isEarlyRepayment = loan.remainingCycles > 0 && !loan.isOverdue;
    const repaymentFee = isEarlyRepayment ? loan.balance * LOAN_CONFIG.repaymentFeePercent : 0;
    const totalCost = loan.balance + repaymentFee;

    dispatch(deductCash(totalCost));
    dispatch(repayLoan({
      loanId: loan.id,
      amount: loan.balance,
      feeDeducted: repaymentFee,
      isEarlyRepayment,
    }));
    // Remove any notifications related to this loan (e.g., overdue warnings)
    dispatch(dismissNotificationsForLoan(loan.id));
  };

  return (
    <div className="loans-list">
      <div className="loans-list__header">
        <h3 className="loans-list__title">
          {t('loans.title')}
          {remainingLoanSlots > 0 && !hasInsufficientCollateral && (
            <span className="loans-list__remaining">
              ({t('loans.slotsAvailable', { count: remainingLoanSlots })})
            </span>
          )}
        </h3>
        {!hasInsufficientCollateral && (
          canOpenNewLoan ? (
            <button
              className="icon-btn loans-list__add-btn"
              onClick={handleOpenModal}
              title={t('loans.newLoan')}
            >
              <PlusCircleIcon size={16} />
            </button>
          ) : (
            <button
              className="icon-btn loans-list__add-btn loans-list__add-btn--disabled"
              disabled
              title={isTradePanelOpen ? t('loans.blockedByTradePanel') : t('loans.maxLoansReached')}
            >
              <LockIcon size={16} />
            </button>
          )
        )}
      </div>

      {loans.length > 0 ? (
        <div className="loans-list__items">
          {loans.map(loan => {
            const canRepay = canRepayFully(loan, cash);
            const isEarlyRepayment = loan.remainingCycles > 0 && !loan.isOverdue;
            const isDueSoon = loan.remainingCycles <= LOAN_CONFIG.loanDueWarningCycles && loan.remainingCycles > 0 && !loan.isOverdue;
            const isHighlighted = highlightedLoanId === loan.id;

            const handleItemClick = () => {
              if (isHighlighted) {
                dispatch(clearLoanHighlight());
              }
            };

            return (
              <div
                key={loan.id}
                className={`portfolio__list-item loans-list__item ${loan.isOverdue ? 'portfolio__list-item--danger' : ''} ${isDueSoon ? 'portfolio__list-item--warning' : ''} ${isHighlighted ? 'loans-list__item--highlighted' : ''}`}
                onClick={isHighlighted ? handleItemClick : undefined}
                role={isHighlighted ? 'button' : undefined}
                tabIndex={isHighlighted ? 0 : undefined}
              >
                <div className="loans-list__item-info">
                  <div className="loans-list__item-top">
                    <span className="loans-list__item-name">
                      {getLoanName(loan)}
                    </span>
                    <span className="loans-list__item-amount">
                      {formatMoney(loan.balance)}
                    </span>
                    {loan.isOverdue && (
                      <span className="loans-list__item-overdue-badge" title={t('loans.overdueTooltip')}>
                        <AlertTriangleIcon size={14} />
                        {t('loans.overdue')}
                      </span>
                    )}
                  </div>
                  <div className="loans-list__item-details">
                    <span className="loans-list__item-rate">
                      {formatRate(loan.interestRate)}
                    </span>
                    <span className="loans-list__item-duration">
                      {loan.isOverdue ? (
                        <span className="loans-list__item-overdue-cycles">
                          {t('loans.overdueFor', { cycles: loan.overdueForCycles })}
                        </span>
                      ) : loan.remainingCycles === 0 ? (
                        <span className="loans-list__item-due-now">{t('loans.dueNow')}</span>
                      ) : (
                        <span className={isDueSoon ? 'loans-list__item-due-soon-text' : ''}>
                          {t('loans.dueIn', { cycles: loan.remainingCycles })}
                        </span>
                      )}
                    </span>
                    {loan.totalInterestPaid > 0 && (
                      <span className="loans-list__item-interest">
                        {t('loans.interest')}: {formatMoney(loan.totalInterestPaid)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className={`icon-btn loans-list__repay-btn ${!canRepay ? 'loans-list__repay-btn--disabled' : ''}`}
                  onClick={() => handleRepayLoan(loan)}
                  disabled={!canRepay}
                  title={!canRepay
                    ? t('loans.cannotRepayInsufficientFunds')
                    : isEarlyRepayment
                      ? `${t('loans.repay')} (${formatNumber(LOAN_CONFIG.repaymentFeePercent * 100, 1, locale)}% ${t('loans.fee')})`
                      : t('loans.repayNoFee')
                  }
                >
                  <DollarCircleIcon size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="loans-list__empty">{t('loans.noLoans')}</p>
      )}
    </div>
  );
};
