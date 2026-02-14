import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InterestRateBreakdown, CreditLineInfo } from '../types';
import { LOAN_CONFIG } from '../config';
import { InfoIcon } from './Icons';
import { formatCurrency, formatNumber, formatPercent as formatPercentUtil, getFormatLocale } from '../utils/formatting';

interface LoanInfoDetailsProps {
  /** Credit line information for the credit info section */
  creditLineInfo: CreditLineInfo;
  /** Interest rate breakdown for the rate info section */
  interestBreakdown: InterestRateBreakdown;
  /** Initial expanded state (default: false) */
  initialExpanded?: boolean;
}

/**
 * Reusable component for displaying loan conditions
 * Single expandable section combining interest rate and credit line info.
 * Used in LoanModal and TradePanel.
 */
export const LoanInfoDetails = ({
  creditLineInfo,
  interestBreakdown,
  initialExpanded = false,
}: LoanInfoDetailsProps) => {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const formatMoney = (num: number): string => formatCurrency(num, 2, locale);
  const formatRate = (rate: number): string => formatPercentUtil(rate, 2, false, locale);

  return (
    <div className="loan-info">
      {/* Expandable Conditions Toggle */}
      <button
        className={`loan-info__toggle ${isExpanded ? 'loan-info__toggle--open' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span className="loan-info__toggle-label">{t('loans.conditions')}</span>
        <InfoIcon size={16} className="loan-info__toggle-icon" />
      </button>

      {/* Expandable Content */}
      <div className={`loan-info__expandable ${isExpanded ? 'loan-info__expandable--open' : ''}`}>
        <div className="loan-info__expandable-content">
          {/* Section 1: Interest Rate Breakdown */}
          <div className="loan-info__section">
            <h4 className="loan-info__section-title">{t('loans.interestBreakdownTitle')}</h4>

            <div className="loan-info__breakdown">
              <div className="loan-info__row">
                <span className="loan-info__row-label">{t('loans.baseRate')}:</span>
                <span className="loan-info__row-value">{formatRate(interestBreakdown.baseRate)}</span>
              </div>

              {interestBreakdown.riskProfileAdjustment !== 0 && (
                <div className="loan-info__row">
                  <span className="loan-info__row-label">
                    {t('loans.riskProfileAdjustment')}
                    <span className="loan-info__row-hint">{t('loans.riskProfileHint')}</span>
                  </span>
                  <span className={`loan-info__row-value ${interestBreakdown.riskProfileAdjustment < 0 ? 'loan-info__row-value--positive' : 'loan-info__row-value--negative'}`}>
                    {interestBreakdown.riskProfileAdjustment >= 0 ? '+' : ''}{formatRate(interestBreakdown.riskProfileAdjustment)}
                  </span>
                </div>
              )}

              {interestBreakdown.profitHistoryAdjustment !== 0 && (
                <div className="loan-info__row">
                  <span className="loan-info__row-label">
                    {t('loans.profitHistoryAdjustment')}
                    <span className="loan-info__row-hint">{t('loans.profitHistoryHint')}</span>
                  </span>
                  <span className={`loan-info__row-value ${interestBreakdown.profitHistoryAdjustment < 0 ? 'loan-info__row-value--positive' : 'loan-info__row-value--negative'}`}>
                    {interestBreakdown.profitHistoryAdjustment >= 0 ? '+' : ''}{formatRate(interestBreakdown.profitHistoryAdjustment)}
                  </span>
                </div>
              )}

              {interestBreakdown.utilizationSurcharge > 0 && (
                <div className="loan-info__row">
                  <span className="loan-info__row-label">
                    {t('loans.utilizationSurcharge')}
                    <span className="loan-info__row-hint">{t('loans.utilizationHint')}</span>
                  </span>
                  <span className="loan-info__row-value loan-info__row-value--negative">
                    +{formatRate(interestBreakdown.utilizationSurcharge)}
                  </span>
                </div>
              )}

              {interestBreakdown.loanCountPenalty > 0 && (
                <div className="loan-info__row">
                  <span className="loan-info__row-label">
                    {t('loans.additionalLoanSurcharge')}
                    <span className="loan-info__row-hint">{t('loans.additionalLoanHint')}</span>
                  </span>
                  <span className="loan-info__row-value loan-info__row-value--negative">
                    +{formatRate(interestBreakdown.loanCountPenalty)}
                  </span>
                </div>
              )}

              {interestBreakdown.creditScoreAdjustment !== 0 && (
                <div className="loan-info__row">
                  <span className="loan-info__row-label">{t('loans.creditScoreAdjustment')}:</span>
                  <span className={`loan-info__row-value ${interestBreakdown.creditScoreAdjustment < 0 ? 'loan-info__row-value--positive' : 'loan-info__row-value--negative'}`}>
                    {interestBreakdown.creditScoreAdjustment >= 0 ? '+' : ''}{formatRate(interestBreakdown.creditScoreAdjustment)}
                  </span>
                </div>
              )}

              {interestBreakdown.durationDiscount !== 0 && (
                <div className="loan-info__row">
                  <span className="loan-info__row-label">
                    {t('loans.durationDiscount')}
                    <span className="loan-info__row-hint">{t('loans.durationDiscountHint')}</span>
                  </span>
                  <span className="loan-info__row-value loan-info__row-value--positive">
                    {formatRate(interestBreakdown.durationDiscount)}
                  </span>
                </div>
              )}

              <div className="loan-info__row loan-info__row--total">
                <span className="loan-info__row-label">{t('loans.effectiveRate')}:</span>
                <span className="loan-info__row-value">{formatRate(interestBreakdown.effectiveRate)}</span>
              </div>
            </div>

            <p className="loan-info__note">
              {t('loans.interestChargeNote', { cycles: LOAN_CONFIG.interestChargeCycles })}
            </p>
          </div>

          {/* Section 2: Credit Line Calculation */}
          <div className="loan-info__section">
            <h4 className="loan-info__section-title">{t('loans.creditLineTitle')}</h4>

            <div className="loan-info__breakdown">
              {creditLineInfo.collateralBreakdown.largeCapStocks > 0 && (
                <div className="loan-info__row">
                  <span className="loan-info__row-label">
                    {t('loans.collateralLargeCap')}
                    <span className="loan-info__row-hint">
                      ({(LOAN_CONFIG.largeCapCollateralRatio * 100).toFixed(0)}% {t('loans.ofValue')})
                    </span>
                  </span>
                  <span className="loan-info__row-value">
                    {formatMoney(creditLineInfo.collateralBreakdown.largeCapStocks)}
                  </span>
                </div>
              )}

              {creditLineInfo.collateralBreakdown.smallCapStocks > 0 && (
                <div className="loan-info__row">
                  <span className="loan-info__row-label">
                    {t('loans.collateralSmallCap')}
                    <span className="loan-info__row-hint">
                      ({(LOAN_CONFIG.smallCapCollateralRatio * 100).toFixed(0)}% {t('loans.ofValue')})
                    </span>
                  </span>
                  <span className="loan-info__row-value">
                    {formatMoney(creditLineInfo.collateralBreakdown.smallCapStocks)}
                  </span>
                </div>
              )}

              <div className="loan-info__row">
                <span className="loan-info__row-label">
                  {t('loans.recommendedCredit')}
                  <span className="loan-info__row-hint">
                    ({t('loans.recommendedCreditHint')})
                  </span>
                </span>
                <span className="loan-info__row-value">
                  {formatMoney(creditLineInfo.recommendedCreditLine)}
                </span>
              </div>

              <div className="loan-info__row loan-info__row--total">
                <span className="loan-info__row-label">
                  {t('loans.maxCredit')}
                  <span className="loan-info__row-hint">
                    (= {t('loans.recommendedCredit')} × {LOAN_CONFIG.maxCreditLineMultiplier})
                  </span>
                </span>
                <span className="loan-info__row-value">
                  {formatMoney(creditLineInfo.maxCreditLine)}
                </span>
              </div>

              {creditLineInfo.currentDebt > 0 && (
                <div className="loan-info__row">
                  <span className="loan-info__row-label">{t('loans.currentDebt')}:</span>
                  <span className="loan-info__row-value loan-info__row-value--negative">
                    {formatMoney(-creditLineInfo.currentDebt)}
                  </span>
                </div>
              )}

              <div className="loan-info__row">
                <span className="loan-info__row-label">{t('loans.availableCredit')}:</span>
                <span className="loan-info__row-value">
                  {formatMoney(creditLineInfo.availableCredit)}
                </span>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="loan-info__footer">
            <p>{t('loans.repaymentFeeInfo', { percent: formatNumber(LOAN_CONFIG.repaymentFeePercent * 100, 1, locale) })}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
