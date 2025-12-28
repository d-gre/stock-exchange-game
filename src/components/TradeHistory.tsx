import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
import { selectAllTrades, selectPortfolioValueHistory, selectRiskProfile } from '../store/tradeHistorySlice';
import { TradeHistoryChart } from './TradeHistoryChart';
import type { CompletedTrade, RiskProfileAnalysis, TradeFailureReason } from '../types';
import type { Theme } from '../hooks/useTheme';

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${Math.round(seconds / 3600)}h`;
};

interface RiskProfileCardProps {
  profile: RiskProfileAnalysis;
  t: (key: string) => string;
  formatCurrency: (value: number) => string;
}

const RiskProfileCard = ({ profile, t, formatCurrency }: RiskProfileCardProps) => {
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
    <div className="trade-history__risk-card">
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
          <span className="trade-history__risk-stat-value trade-history__risk-stat-value--positive">${formatCurrency(profile.avgWin)}</span>
        </div>
        <div className="trade-history__risk-stat">
          <span className="trade-history__risk-stat-label">{t('tradeHistory.riskProfile.avgLoss')}</span>
          <span className="trade-history__risk-stat-value trade-history__risk-stat-value--negative">-${formatCurrency(profile.avgLoss)}</span>
        </div>
      </div>

      <div className={`trade-history__total-pl ${profile.totalRealizedProfitLoss >= 0 ? 'trade-history__total-pl--positive' : 'trade-history__total-pl--negative'}`}>
        <span className="trade-history__total-pl-label">{t('tradeHistory.riskProfile.realizedPL')}</span>
        <span className="trade-history__total-pl-value">
          {profile.totalRealizedProfitLoss >= 0 ? '+' : ''}${formatCurrency(profile.totalRealizedProfitLoss)}
        </span>
      </div>
    </div>
  );
};

interface TradeListProps {
  trades: CompletedTrade[];
  t: (key: string) => string;
  formatCurrency: (value: number) => string;
  formatDate: (timestamp: number) => string;
}

const TradeList = ({ trades, t, formatCurrency, formatDate }: TradeListProps) => {
  const getFailureReasonText = (reason: TradeFailureReason): string => {
    switch (reason) {
      case 'insufficient_funds': return t('tradeHistory.failureReasons.insufficient_funds');
      case 'insufficient_shares': return t('tradeHistory.failureReasons.insufficient_shares');
      case 'expired': return t('tradeHistory.failureReasons.expired');
      default: return t('tradeHistory.failureReasons.unknown');
    }
  };

  if (trades.length === 0) {
    return (
      <div className="trade-history__list-empty">
        <p>{t('tradeHistory.noTrades')}</p>
      </div>
    );
  }

  return (
    <div className="trade-history__list">
      <div className="trade-history__list-header">
        <span className="trade-history__col trade-history__col--time">{t('tradeHistory.time')}</span>
        <span className="trade-history__col trade-history__col--type">{t('tradeHistory.type')}</span>
        <span className="trade-history__col trade-history__col--symbol">{t('tradeHistory.symbol')}</span>
        <span className="trade-history__col trade-history__col--shares">{t('tradeHistory.shares')}</span>
        <span className="trade-history__col trade-history__col--price">{t('tradeHistory.price')}</span>
        <span className="trade-history__col trade-history__col--total">{t('tradeHistory.total')}</span>
        <span className="trade-history__col trade-history__col--pl">{t('tradeHistory.pl')}</span>
      </div>
      <div className="trade-history__list-body">
        {trades.map((trade) => {
          const isFailed = trade.status === 'failed';
          return (
            <div key={trade.id} className={`trade-history__list-row trade-history__list-row--${trade.type} ${isFailed ? 'trade-history__list-row--failed' : ''}`}>
              <span className="trade-history__col trade-history__col--time">{formatDate(trade.timestamp)}</span>
              <span className={`trade-history__col trade-history__col--type trade-history__col--type-${trade.type}`}>
                {trade.type === 'buy' ? t('tradeHistory.buy') : t('tradeHistory.sell')}
              </span>
              <span className="trade-history__col trade-history__col--symbol">{trade.symbol}</span>
              <span className="trade-history__col trade-history__col--shares">{trade.shares}</span>
              <span className="trade-history__col trade-history__col--price">${formatCurrency(trade.pricePerShare)}</span>
              <span className="trade-history__col trade-history__col--total">${formatCurrency(trade.totalAmount)}</span>
              <span className={`trade-history__col trade-history__col--pl ${isFailed ? 'trade-history__col--pl-failed' : (trade.realizedProfitLoss !== undefined ? (trade.realizedProfitLoss >= 0 ? 'trade-history__col--pl-positive' : 'trade-history__col--pl-negative') : '')}`}>
                {isFailed && trade.failureReason ? (
                  <span className="trade-history__failure-reason" title={getFailureReasonText(trade.failureReason)}>
                    {t('tradeHistory.failed')}
                  </span>
                ) : trade.realizedProfitLoss !== undefined ? (
                  <>
                    {trade.realizedProfitLoss >= 0 ? '+' : ''}${formatCurrency(trade.realizedProfitLoss)}
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

  const locale = i18n.language === 'de' ? 'de-DE' : 'en-US';

  const formatCurrency = (value: number): string => {
    return value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const tradeStats = useMemo(() => {
    const buys = trades.filter(t => t.type === 'buy');
    const sells = trades.filter(t => t.type === 'sell');
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
      <div className="trade-history__header">
        <h2>{t('tradeHistory.title')}</h2>
        <div className="trade-history__stats-summary">
          <span className="trade-history__stat trade-history__stat--buy">
            {t('tradeHistory.buys', { count: tradeStats.buyCount })} (${formatCurrency(tradeStats.totalBuyVolume)})
          </span>
          <span className="trade-history__stat trade-history__stat--sell">
            {t('tradeHistory.sells', { count: tradeStats.sellCount })} (${formatCurrency(tradeStats.totalSellVolume)})
          </span>
        </div>
      </div>

      <div className="trade-history__content">
        <div className="trade-history__chart-section">
          <TradeHistoryChart
            trades={trades}
            portfolioValueHistory={portfolioValueHistory}
            autoHeight
            theme={theme}
          />
        </div>

        <div className="trade-history__details">
          {riskProfile && <RiskProfileCard profile={riskProfile} t={t} formatCurrency={formatCurrency} />}

          <div className="trade-history__list-section">
            <h3>{t('tradeHistory.recentTrades')}</h3>
            <TradeList trades={trades.slice(0, 20)} t={t} formatCurrency={formatCurrency} formatDate={formatDate} />
          </div>
        </div>
      </div>
    </div>
  );
};
