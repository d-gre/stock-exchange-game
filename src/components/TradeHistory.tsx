import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
import { selectAllTrades, selectPortfolioValueHistory, selectRiskProfile } from '../store/tradeHistorySlice';
import { selectCreditScore, selectCreditHistory, selectDelinquencyStats } from '../store/loansSlice';
import { LOAN_CONFIG } from '../config';
import type { CreditScoreEvent } from '../types';
import { TradeHistoryChart } from './TradeHistoryChart';
import { formatCurrency as formatCurrencyUtil, formatPercent, getFormatLocale, type FormatLocale } from '../utils/formatting';
import type { CompletedTrade, RiskProfileAnalysis, TradeFailureReason } from '../types';
import type { Theme } from '../hooks/useTheme';

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
};

interface RiskProfileCardProps {
  profile: RiskProfileAnalysis;
  t: (key: string) => string;
  locale: FormatLocale;
}

const RiskProfileCard = ({ profile, t, locale }: RiskProfileCardProps) => {
  const formatMoney = (value: number): string => formatCurrencyUtil(value, 2, locale);

  const categoryLabels = {
    conservative: t('tradeHistory.riskProfile.conservative'),
    moderate: t('tradeHistory.riskProfile.moderate'),
    aggressive: t('tradeHistory.riskProfile.aggressive'),
  };

  const categoryDescriptions = {
    conservative: t('tradeHistory.riskProfile.conservativeDesc'),
    moderate: t('tradeHistory.riskProfile.moderateDesc'),
    aggressive: t('tradeHistory.riskProfile.aggressiveDesc'),
  };

  // Gauge Position (0-100%)
  const gaugePosition = ((profile.riskScore + 100) / 200) * 100;

  return (
    <div className="trade-history__risk-card trade-history__risk-card--risk-profile">
      <h3>{t('tradeHistory.riskProfile.title')}</h3>

      <div className="trade-history__risk-gauge-container">
        <div className="trade-history__risk-gauge">
          <div className="trade-history__risk-gauge-track">
            <div className="trade-history__risk-gauge-fill" style={{ width: `${gaugePosition}%` }} />
            <div className="trade-history__risk-gauge-marker" style={{ left: `${gaugePosition}%` }} />
          </div>
          <div className="trade-history__risk-gauge-labels">
            <span>-100</span>
            <span>0</span>
            <span>+100</span>
          </div>
        </div>
        <div className={`trade-history__risk-score trade-history__risk-score--${profile.category}`}>
          <span className="trade-history__risk-score-value">{profile.riskScore}</span>
          <span className="trade-history__risk-score-label">{categoryLabels[profile.category]}</span>
        </div>
      </div>

      <p className="trade-history__risk-description">{categoryDescriptions[profile.category]}</p>

      <div className="trade-history__risk-stats-grid">
        <div className="trade-history__risk-stat">
          <span className="trade-history__risk-stat-label">{t('tradeHistory.riskProfile.trades')}</span>
          <span className="trade-history__risk-stat-value">{profile.totalTrades}</span>
        </div>
        <div className="trade-history__risk-stat">
          <span className="trade-history__risk-stat-label">{t('tradeHistory.riskProfile.avgPosition')}</span>
          <span className="trade-history__risk-stat-value">{profile.avgPositionSizePercent.toFixed(1)}%</span>
        </div>
        <div className="trade-history__risk-stat">
          <span className="trade-history__risk-stat-label">{t('tradeHistory.riskProfile.holdingDuration')}</span>
          <span className="trade-history__risk-stat-value">{formatDuration(profile.avgHoldingDuration)}</span>
        </div>
        <div className="trade-history__risk-stat">
          <span className="trade-history__risk-stat-label">{t('tradeHistory.riskProfile.winLoss')}</span>
          <span className="trade-history__risk-stat-value">
            {profile.winLossRatio === Infinity ? '100%' : profile.winLossRatio.toFixed(2)}
          </span>
        </div>
        <div className="trade-history__risk-stat">
          <span className="trade-history__risk-stat-label">{t('tradeHistory.riskProfile.avgWin')}</span>
          <span className="trade-history__risk-stat-value trade-history__risk-stat-value--positive">
            {formatMoney(profile.avgWin)}
          </span>
        </div>
        <div className="trade-history__risk-stat">
          <span className="trade-history__risk-stat-label">{t('tradeHistory.riskProfile.avgLoss')}</span>
          <span className="trade-history__risk-stat-value trade-history__risk-stat-value--negative">
            {formatMoney(-profile.avgLoss)}
          </span>
        </div>
      </div>

      <div className={`trade-history__total-profit-loss ${profile.totalRealizedProfitLoss >= 0 ? 'trade-history__total-profit-loss--positive' : 'trade-history__total-profit-loss--negative'}`}>
        <span className="trade-history__total-profit-loss-label">{t('tradeHistory.riskProfile.realizedPL')}</span>
        <span className="trade-history__total-profit-loss-value">
          {formatMoney(profile.totalRealizedProfitLoss)}
        </span>
      </div>
    </div>
  );
};

interface DelinquencyStats {
  totalDelinquentLoans: number;
  activeDelinquencies: number;
  totalOverdueCycles: number;
  maxSingleOverdue: number;
  avgOverdueCycles: number;
}

interface CreditScoreCardProps {
  creditScore: number;
  creditHistory: CreditScoreEvent[];
  delinquencyStats: DelinquencyStats;
  t: (key: string) => string;
}

/** Summarized credit event for display */
interface SummarizedCreditEvent {
  type: CreditScoreEvent['type'];
  totalChange: number;
  count: number;
}

const CreditScoreCard = ({ creditScore, creditHistory, delinquencyStats, t }: CreditScoreCardProps) => {
  // Credit score categories
  const getCreditCategory = (score: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (score >= 75) return 'excellent';
    if (score >= 50) return 'good';
    if (score >= 25) return 'fair';
    return 'poor';
  };

  const category = getCreditCategory(creditScore);
  const categoryLabels = {
    excellent: t('loans.creditScore.excellent'),
    good: t('loans.creditScore.good'),
    fair: t('loans.creditScore.fair'),
    poor: t('loans.creditScore.poor'),
  };

  // Gauge position (0-100)
  const gaugePosition = (creditScore / LOAN_CONFIG.maxCreditScore) * 100;

  // Summarize credit events by type (instead of showing individual events)
  const summarizedEvents = useMemo((): SummarizedCreditEvent[] => {
    if (!creditHistory || creditHistory.length === 0) return [];

    const eventMap = new Map<CreditScoreEvent['type'], SummarizedCreditEvent>();

    for (const event of creditHistory) {
      const existing = eventMap.get(event.type);
      if (existing) {
        existing.totalChange += event.change;
        existing.count += 1;
      } else {
        eventMap.set(event.type, {
          type: event.type,
          totalChange: event.change,
          count: 1,
        });
      }
    }

    return Array.from(eventMap.values());
  }, [creditHistory]);

  const getEventLabel = (type: CreditScoreEvent['type'], count: number): string => {
    switch (type) {
      case 'repaid_early': return t('loans.creditScore.events.repaidEarly');
      case 'repaid_on_time': return t('loans.creditScore.events.repaidOnTime');
      case 'auto_repaid': return t('loans.creditScore.events.autoRepaid');
      case 'overdue': return count > 1 ? t('loans.creditScore.events.overdueMultiple') : t('loans.creditScore.events.overdue');
      case 'default_penalty': return t('loans.creditScore.events.defaultPenalty');
      default: return type;
    }
  };

  return (
    <div className="trade-history__risk-card trade-history__risk-card--credit">
      <h3>{t('loans.creditScore.title')}</h3>
        <div className="trade-history__credit-gauge-container">
          <div className="trade-history__credit-gauge">
            <div className="trade-history__credit-gauge-track">
              <div
                className={`trade-history__credit-gauge-fill trade-history__credit-gauge-fill--${category}`}
                style={{ width: `${gaugePosition}%` }}
              />
              <div className="trade-history__credit-gauge-marker" style={{ left: `${gaugePosition}%` }} />
            </div>
            <div className="trade-history__credit-gauge-labels">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
          <div className={`trade-history__credit-score trade-history__credit-score--${category}`}>
            <span className="trade-history__credit-score-value">{creditScore}</span>
            <span className="trade-history__credit-score-label">{categoryLabels[category]}</span>
          </div>
        </div>

        <p className="trade-history__credit-description">
          {t('loans.creditScore.description')}
        </p>

        {summarizedEvents.length > 0 && (
          <div className="trade-history__credit-summary">
            <div className="trade-history__credit-events">
              <div className="trade-history__credit-event trade-history__credit-event--neutral">
                <span className="trade-history__credit-event-label">
                  {t('loans.creditScore.baseValue')}
                </span>
                <span className="trade-history__credit-event-change">{LOAN_CONFIG.initialCreditScore}</span>
              </div>
              {summarizedEvents.map((event) => (
                <div
                  key={event.type}
                  className={`trade-history__credit-event trade-history__credit-event--${event.totalChange >= 0 ? 'positive' : 'negative'}`}
                >
                  <span className="trade-history__credit-event-label">
                    {getEventLabel(event.type, event.count)}
                  </span>
                  <span className="trade-history__credit-event-change">
                    {event.totalChange >= 0 ? '+' : ''}{event.totalChange}
                  </span>
                </div>
              ))}
              <div className={`trade-history__credit-event trade-history__credit-event--total trade-history__credit-event--${category}`}>
                <span className="trade-history__credit-event-label">
                  {t('loans.creditScore.title')}
                </span>
                <span className="trade-history__credit-event-change">{creditScore}</span>
              </div>
            </div>
          </div>
        )}

        {delinquencyStats.totalDelinquentLoans > 0 && (
          <div className="trade-history__delinquency-stats">
            <h4 className="trade-history__delinquency-title">{t('loans.creditScore.delinquency.title')}</h4>
            <div className="trade-history__delinquency-grid">
              <div className="trade-history__delinquency-stat">
                <span className="trade-history__delinquency-stat-value">{delinquencyStats.totalDelinquentLoans}</span>
                <span className="trade-history__delinquency-stat-label">{t('loans.creditScore.delinquency.totalLoans')}</span>
              </div>
              <div className="trade-history__delinquency-stat">
                <span className="trade-history__delinquency-stat-value">{delinquencyStats.totalOverdueCycles}</span>
                <span className="trade-history__delinquency-stat-label">{t('loans.creditScore.delinquency.totalCycles')}</span>
              </div>
              <div className="trade-history__delinquency-stat">
                <span className="trade-history__delinquency-stat-value">{delinquencyStats.maxSingleOverdue}</span>
                <span className="trade-history__delinquency-stat-label">{t('loans.creditScore.delinquency.maxOverdue')}</span>
              </div>
              <div className="trade-history__delinquency-stat">
                <span className="trade-history__delinquency-stat-value">{delinquencyStats.avgOverdueCycles.toFixed(1)}</span>
                <span className="trade-history__delinquency-stat-label">{t('loans.creditScore.delinquency.avgOverdue')}</span>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

interface TradeListProps {
  trades: CompletedTrade[];
  t: (key: string) => string;
  locale: FormatLocale;
}

const TradeList = ({ trades, t, locale }: TradeListProps) => {
  const formatMoney = (value: number): string => formatCurrencyUtil(value, 2, locale);
  const getFailureReasonText = (reason: TradeFailureReason): string => {
    switch (reason) {
      case 'insufficient_funds': return t('tradeHistory.failureReasons.insufficient_funds');
      case 'insufficient_shares': return t('tradeHistory.failureReasons.insufficient_shares');
      case 'expired': return t('tradeHistory.failureReasons.expired');
      default: return t('tradeHistory.failureReasons.unknown');
    }
  };

  const getFailureDisplayText = (trade: CompletedTrade): string => {
    // If we have detailed failure info, use it
    if (trade.failureDetails) {
      return trade.failureDetails;
    }
    // Otherwise fall back to the generic reason
    if (trade.failureReason) {
      return getFailureReasonText(trade.failureReason);
    }
    return t('tradeHistory.failureReasons.unknown');
  };

  if (trades.length === 0) {
    return (
      <div className="trade-history__list-empty">
        <p>{t('tradeHistory.noTrades')}</p>
      </div>
    );
  }

  // Calculate profit/loss percentage for a trade
  const calculateProfitLossPercent = (trade: CompletedTrade): number | undefined => {
    if (trade.realizedProfitLoss === undefined || !trade.avgBuyPrice || trade.shares <= 0) {
      return undefined;
    }
    const costBasis = trade.avgBuyPrice * trade.shares;
    if (costBasis <= 0) return undefined;
    return (trade.realizedProfitLoss / costBasis) * 100;
  };

  // Format profit/loss percentage for display
  const formatProfitLossPercent = (percent: number | undefined): string => {
    if (percent === undefined) return '';
    return ` (${formatPercent(percent / 100, 1, true, locale)})`;
  };

  return (
    <div className="trade-history__list">
      <div className="trade-history__list-header">
        <span className="trade-history__col trade-history__col--time">{t('tradeHistory.cycle')}</span>
        <span className="trade-history__col trade-history__col--type">{t('tradeHistory.type')}</span>
        <span className="trade-history__col trade-history__col--symbol">{t('tradeHistory.symbol')}</span>
        <span className="trade-history__col trade-history__col--shares">{t('tradeHistory.shares')}</span>
        <span className="trade-history__col trade-history__col--price">{t('tradeHistory.price')}</span>
        <span className="trade-history__col trade-history__col--total">{t('tradeHistory.total')}</span>
        <span className="trade-history__col trade-history__col--profit-loss">{t('tradeHistory.pl')}</span>
      </div>
      <div className="trade-history__list-body">
        {trades.map((trade) => {
          const isFailed = trade.status === 'failed';
          const profitLossPercent = calculateProfitLossPercent(trade);
          return (
            <div key={trade.id} className={`trade-history__list-row trade-history__list-row--${trade.type} ${isFailed ? 'trade-history__list-row--failed' : ''}`}>
              <span className="trade-history__col trade-history__col--time">{trade.cycle ?? '-'}</span>
              <span className={`trade-history__col trade-history__col--type trade-history__col--type-${trade.type}`}>
                {trade.type === 'buy' ? t('tradeHistory.buy') : trade.type === 'sell' ? t('tradeHistory.sell') : trade.type === 'shortSell' ? t('tradeHistory.shortSell') : t('tradeHistory.buyToCover')}
              </span>
              <span className="trade-history__col trade-history__col--symbol">{trade.symbol}</span>
              <span className="trade-history__col trade-history__col--shares">{trade.shares}</span>
              <span className="trade-history__col trade-history__col--price">{formatMoney(trade.pricePerShare)}</span>
              <span className="trade-history__col trade-history__col--total">{formatMoney(trade.totalAmount)}</span>
              <span className={`trade-history__col trade-history__col--profit-loss ${isFailed ? 'trade-history__col--profit-loss-failed' : (trade.realizedProfitLoss !== undefined ? (trade.realizedProfitLoss >= 0 ? 'trade-history__col--profit-loss-positive' : 'trade-history__col--profit-loss-negative') : '')}`}>
                {isFailed ? (
                  <span className="trade-history__failure-reason" title={getFailureDisplayText(trade)}>
                    {t('tradeHistory.expired')} ({getFailureDisplayText(trade)})
                  </span>
                ) : trade.realizedProfitLoss !== undefined ? (
                  <>
                    {formatMoney(trade.realizedProfitLoss)}{formatProfitLossPercent(profitLossPercent)}
                  </>
                ) : (
                  '-'
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TradeHistoryProps {
  theme?: Theme;
}

export const TradeHistory = ({ theme = 'dark' }: TradeHistoryProps) => {
  const { t, i18n } = useTranslation();
  const trades = useAppSelector(selectAllTrades);
  const portfolioValueHistory = useAppSelector(selectPortfolioValueHistory);
  const riskProfile = useAppSelector(selectRiskProfile);
  const creditScore = useAppSelector(selectCreditScore);
  const creditHistory = useAppSelector(selectCreditHistory);
  const delinquencyStats = useAppSelector(selectDelinquencyStats);

  const locale = getFormatLocale(i18n.language);

  const formatMoney = (value: number): string => formatCurrencyUtil(value, 2, locale);

  const tradeStats = useMemo(() => {
    const buys = trades.filter(t => t.type === 'buy' || t.type === 'buyToCover');
    const sells = trades.filter(t => t.type === 'sell' || t.type === 'shortSell');
    const totalBuyVolume = buys.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalSellVolume = sells.reduce((sum, t) => sum + t.totalAmount, 0);

    return {
      buyCount: buys.length,
      sellCount: sells.length,
      totalBuyVolume,
      totalSellVolume,
    };
  }, [trades]);

  return (
    <div className="trade-history">
      <div className="trade-history__content">
        <div className="trade-history__risk-card trade-history__risk-card--portfolio">
          <div className="trade-history__header">
            <h3>{t('tradeHistory.title')}</h3>
            <div className="trade-history__stats-summary">
              <span className="trade-history__stat trade-history__stat--buy">
                {t('tradeHistory.buys', { count: tradeStats.buyCount })} ({formatMoney(tradeStats.totalBuyVolume)})
              </span>
              <span className="trade-history__stat trade-history__stat--sell">
                {t('tradeHistory.sells', { count: tradeStats.sellCount })} ({formatMoney(tradeStats.totalSellVolume)})
              </span>
            </div>
          </div>
          <div className="trade-history__chart-section">
            <TradeHistoryChart
              trades={trades}
              portfolioValueHistory={portfolioValueHistory}
              autoHeight
              theme={theme}
              locale={locale}
            />
          </div>
        </div>

        <div className="trade-history__details">
          <div className="trade-history__profile-cards">
            {riskProfile && <RiskProfileCard profile={riskProfile} t={t} locale={locale} />}
            <CreditScoreCard creditScore={creditScore} creditHistory={creditHistory} delinquencyStats={delinquencyStats} t={t} />
          </div>

          <div className="trade-history__list-section">
            <h3>{t('tradeHistory.recentTrades')}</h3>
            <TradeList trades={trades.slice(0, 20)} t={t} locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
};
