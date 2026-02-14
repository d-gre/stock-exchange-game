import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
import {
  selectShortPositionsWithPL,
  selectTotalShortExposure,
  selectTotalLockedCollateral,
  selectTotalShortProfitLoss,
  selectMarginCallStatuses,
} from '../store/shortPositionsSlice';
import { selectCreditLineInfo, selectCanTakeLoanEffective } from '../store/loansSlice';
import { formatCurrency, formatNumber, formatPercent, getFormatLocale } from '../utils/formatting';
import { DollarCircleIcon, PlusCircleIcon, LockIcon } from './Icons';
import type { Stock, Portfolio } from '../types';
import { LOAN_CONFIG } from '../config';

interface PortfolioShortsProps {
  stocks: Stock[];
  portfolio: Portfolio;
  selectedStock: string;
  onSelectStock: (symbol: string) => void;
  onCoverPosition: (symbol: string) => void;
  onAddMargin: (symbol: string) => void;
}

export const PortfolioShorts = ({
  stocks,
  portfolio,
  selectedStock,
  onSelectStock,
  onCoverPosition,
  onAddMargin,
}: PortfolioShortsProps) => {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);

  const positionsWithPL = useAppSelector(selectShortPositionsWithPL);
  const totalExposure = useAppSelector(selectTotalShortExposure);
  const totalCollateral = useAppSelector(selectTotalLockedCollateral);
  const totalProfitLoss = useAppSelector(selectTotalShortProfitLoss);
  const marginCallStatuses = useAppSelector(selectMarginCallStatuses);
  const creditLineInfo = useAppSelector(selectCreditLineInfo);
  const canTakeLoan = useAppSelector(selectCanTakeLoanEffective);
  const hasCollateral = creditLineInfo.collateralBreakdown.total >= LOAN_CONFIG.minCollateralForLoan;

  if (positionsWithPL.length === 0) {
    return null;
  }

  const getStock = (symbol: string): Stock | undefined => {
    return stocks.find(s => s.symbol === symbol);
  };

  const isInMarginCall = (symbol: string): boolean => {
    return marginCallStatuses.some(m => m.symbol === symbol);
  };

  const getMarginCallCycles = (symbol: string): number => {
    const status = marginCallStatuses.find(m => m.symbol === symbol);
    return status?.cyclesRemaining ?? 0;
  };

  // Check if margin can be added (requires available cash)
  const canAddMarginToPosition = (): { canAdd: boolean; reason?: string } => {
    if (portfolio.cash <= 0) {
      return { canAdd: false, reason: t('shorts.addMarginBlockedNoCash') };
    }
    return { canAdd: true };
  };

  // Check if a buy-to-cover is possible for a position
  // Returns { canCover: boolean, reason?: string }
  const canCoverPosition = (shares: number, currentPrice: number): { canCover: boolean; reason?: string } => {
    const coverCost = shares * currentPrice;
    const canUseLoan = canTakeLoan && hasCollateral;
    const totalAvailableFunds = canUseLoan
      ? portfolio.cash + creditLineInfo.availableCredit
      : portfolio.cash;

    if (coverCost <= totalAvailableFunds) {
      return { canCover: true };
    }

    // Not enough funds - determine reason
    if (!canTakeLoan) {
      return { canCover: false, reason: t('shorts.coverBlockedMaxLoans') };
    }
    if (!hasCollateral) {
      return { canCover: false, reason: t('shorts.coverBlockedNoCollateral') };
    }
    return { canCover: false, reason: t('shorts.coverBlockedInsufficientFunds') };
  };

  return (
    <div className="portfolio-shorts">
      <h3 className="portfolio-shorts__title">{t('shorts.positions')}</h3>

      {/* Summary */}
      <div className="portfolio-shorts__summary">
        <div className="portfolio-shorts__summary-item">
          <span className="portfolio-shorts__summary-label">{t('shorts.totalExposure')}:</span>
          <span className="portfolio-shorts__summary-value">{formatCurrency(totalExposure, 0, locale)}</span>
        </div>
        <div className="portfolio-shorts__summary-item">
          <span className="portfolio-shorts__summary-label">{t('shorts.lockedCollateral')}:</span>
          <span className="portfolio-shorts__summary-value">{formatCurrency(totalCollateral, 0, locale)}</span>
        </div>
        <div className="portfolio-shorts__summary-item">
          <span className="portfolio-shorts__summary-label">{t('shorts.profitLoss')}:</span>
          <span className={`portfolio-shorts__summary-value ${totalProfitLoss >= 0 ? 'portfolio-shorts__summary-value--positive' : 'portfolio-shorts__summary-value--negative'}`}>
            {formatCurrency(totalProfitLoss, 0, locale)}
          </span>
        </div>
      </div>

      {/* Positions List */}
      <div className="portfolio-shorts__list">
        {positionsWithPL.map(position => {
          const stock = getStock(position.symbol);
          const inMarginCall = isInMarginCall(position.symbol);
          const marginCallCycles = getMarginCallCycles(position.symbol);

          return (
            <div
              key={position.symbol}
              className={`portfolio__list-item portfolio__list-item--interactive portfolio-shorts__item ${selectedStock === position.symbol ? 'portfolio__list-item--selected' : ''} ${inMarginCall ? 'portfolio-shorts__item--margin-call' : ''}`}
              onClick={() => onSelectStock(position.symbol)}
            >
              <div className="portfolio-shorts__item-top">
                <div className="portfolio-shorts__item-header">
                  <span className="portfolio-shorts__symbol">{position.symbol}</span>
                  {stock && <span className="portfolio-shorts__name">{stock.name}</span>}
                </div>
                <div className="portfolio-shorts__item-actions">
                  {(() => {
                    const marginStatus = canAddMarginToPosition();
                    return marginStatus.canAdd ? (
                      <button
                        className="icon-btn portfolio-shorts__add-margin-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddMargin(position.symbol);
                        }}
                        title={t('shorts.addMargin')}
                      >
                        <PlusCircleIcon size={16} />
                      </button>
                    ) : (
                      <button
                        className="icon-btn portfolio-shorts__add-margin-btn portfolio-shorts__add-margin-btn--disabled"
                        disabled
                        title={marginStatus.reason}
                      >
                        <LockIcon size={16} />
                      </button>
                    );
                  })()}
                  {(() => {
                    const coverStatus = canCoverPosition(position.shares, position.currentPrice);
                    return coverStatus.canCover ? (
                      <button
                        className="icon-btn portfolio-shorts__cover-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCoverPosition(position.symbol);
                        }}
                        title={t('shorts.buyToCover')}
                      >
                        <DollarCircleIcon size={16} />
                      </button>
                    ) : (
                      <button
                        className="icon-btn portfolio-shorts__cover-btn portfolio-shorts__cover-btn--disabled"
                        disabled
                        title={coverStatus.reason}
                      >
                        <LockIcon size={16} />
                      </button>
                    );
                  })()}
                </div>
              </div>

              <div className="portfolio-shorts__item-details">
                <div className="portfolio-shorts__detail">
                  <span className="portfolio-shorts__detail-label">{t('shorts.shares')}:</span>
                  <span className="portfolio-shorts__detail-value">{formatNumber(position.shares, 0, locale)}</span>
                </div>
                <div className="portfolio-shorts__detail">
                  <span className="portfolio-shorts__detail-label">{t('shorts.entryPrice')}:</span>
                  <span className="portfolio-shorts__detail-value">{formatCurrency(position.entryPrice, 2, locale)}</span>
                </div>
                <div className="portfolio-shorts__detail">
                  <span className="portfolio-shorts__detail-label">{t('shorts.currentPrice')}:</span>
                  <span className="portfolio-shorts__detail-value">{formatCurrency(position.currentPrice, 2, locale)}</span>
                </div>
                <div className="portfolio-shorts__detail">
                  <span className="portfolio-shorts__detail-label">{t('shorts.profitLoss')}:</span>
                  <span className={`portfolio-shorts__detail-value ${position.unrealizedPL >= 0 ? 'portfolio-shorts__detail-value--positive' : 'portfolio-shorts__detail-value--negative'}`}>
                    {formatCurrency(position.unrealizedPL, 0, locale)} ({formatPercent(position.unrealizedPLPercent, 1, false, locale)})
                  </span>
                </div>
                <div className="portfolio-shorts__detail">
                  <span className="portfolio-shorts__detail-label">{t('shorts.collateral')}:</span>
                  <span className="portfolio-shorts__detail-value">{formatCurrency(position.collateralLocked, 0, locale)}</span>
                </div>
              </div>

              {inMarginCall && (
                <div className="portfolio-shorts__margin-call-warning">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                  <span>{t('shorts.marginCall')} - {marginCallCycles} {t('shorts.marginCallGrace')}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
