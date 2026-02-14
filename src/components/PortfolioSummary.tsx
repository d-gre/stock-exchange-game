import { useTranslation } from 'react-i18next';
import { formatCurrency, getFormatLocale } from '../utils/formatting';

interface PortfolioSummaryProps {
  availableCash: number;
  reservedCash: number;
  totalHoldingsValue: number;
  totalDebt: number;
  totalValue: number;
  totalProfitLoss: number;
}

/**
 * Displays the portfolio summary with cash, holdings value, debt, and P/L
 */
export const PortfolioSummary = ({
  availableCash,
  reservedCash,
  totalHoldingsValue,
  totalDebt,
  totalValue,
  totalProfitLoss,
}: PortfolioSummaryProps) => {
  const { i18n, t } = useTranslation();
  const locale = getFormatLocale(i18n.language);

  return (
    <div className="portfolio-summary">
      <div className="portfolio-summary__item">
        <span className="portfolio-summary__label">{t('portfolio.available')}:</span>
        <span className="portfolio-summary__value">{formatCurrency(availableCash, 2, locale)}</span>
      </div>
      {reservedCash > 0 && (
        <div className="portfolio-summary__item portfolio-summary__item--reserved">
          <span className="portfolio-summary__label">{t('portfolio.reserved')}:</span>
          <span className="portfolio-summary__value">{formatCurrency(reservedCash, 2, locale)}</span>
        </div>
      )}
      <div className="portfolio-summary__item">
        <span className="portfolio-summary__label">{t('portfolio.stockValue')}:</span>
        <span className="portfolio-summary__value">{formatCurrency(totalHoldingsValue, 2, locale)}</span>
      </div>
      {totalDebt > 0 && (
        <div className="portfolio-summary__item">
          <span className="portfolio-summary__label">{t('loans.liabilities')}:</span>
          <span className="portfolio-summary__value portfolio-summary__value--negative">
            {formatCurrency(-totalDebt, 2, locale)}
          </span>
        </div>
      )}
      <div className="portfolio-summary__item portfolio-summary__item--total">
        <span className="portfolio-summary__label">{t('portfolio.totalValue')}:</span>
        <span className="portfolio-summary__value">{formatCurrency(totalValue, 2, locale)}</span>
      </div>
      <div className="portfolio-summary__item">
        <span className="portfolio-summary__label">{t('portfolio.profitLoss')}:</span>
        <span
          className={`portfolio-summary__value ${
            totalProfitLoss >= 0
              ? 'portfolio-summary__value--positive'
              : 'portfolio-summary__value--negative'
          }`}
        >
          {formatCurrency(totalProfitLoss, 2, locale)}
        </span>
      </div>
    </div>
  );
};
