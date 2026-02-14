import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
import { selectEndGameStats, selectCurrentCycle, type RiskLevel, type PlayerEndStats, GAME_DURATION_OPTIONS } from '../store/gameSessionSlice';
import { selectDominantPhase, selectAverageClimateScore, selectClimateHistory } from '../store/marketPhaseSlice';
import { selectCreditScore, selectCreditHistory, selectLoanStatistics, selectTotalDebt } from '../store/loansSlice';
import { LOAN_CONFIG } from '../config';
import { selectBestTrade, selectWorstTrade, selectBestShortTrade, selectWorstShortTrade, selectSellTradeCount, selectShortTradeCount, type TradeWithProfitLoss } from '../store/tradeHistorySlice';
import { CONFIG } from '../config';
import { formatCurrency, getFormatLocale } from '../utils/formatting';
import { useClickOutside } from '../hooks/useClickOutside';
import { ClimateHistoryChart } from './ClimateHistoryChart';
import type { MarketPhase } from '../types';
import type { Theme } from '../hooks/useTheme';
import type { RootState } from '../store';

interface GameEndProps {
  onPlayAgain: () => void;
  hasSavedGame: boolean;
  onLoadGame: () => void;
  onContinueGame: (gameDuration: number | null) => void;
  theme?: Theme;
  isPreview?: boolean;
}

/**
 * Full-screen view showing game results when a timed game ends.
 * Displays player ranking, detailed statistics, and comparison with virtual players.
 */
export const GameEnd = ({ onPlayAgain, hasSavedGame, onLoadGame, onContinueGame, theme = 'dark', isPreview = false }: GameEndProps) => {
  const { t, i18n } = useTranslation();
  const [continueDropdownOpen, setContinueDropdownOpen] = useState(false);
  const continueDropdownRef = useRef<HTMLDivElement>(null);

  // Game stats
  const endGameStats = useAppSelector(selectEndGameStats);
  const currentCycle = useAppSelector(selectCurrentCycle);
  const dominantPhase = useAppSelector(selectDominantPhase);
  const averageClimateScore = useAppSelector(selectAverageClimateScore);
  const climateHistory = useAppSelector(selectClimateHistory);

  // Portfolio breakdown
  const cash = useAppSelector((state: RootState) => state.portfolio.cash);
  const holdings = useAppSelector((state: RootState) => state.portfolio.holdings);
  const stocks = useAppSelector((state: RootState) => state.stocks.items);
  const totalDebt = useAppSelector(selectTotalDebt);

  // Credit & loans
  const creditScore = useAppSelector(selectCreditScore);
  const creditHistory = useAppSelector(selectCreditHistory);
  const loanStats = useAppSelector(selectLoanStatistics);

  // Trade statistics
  const bestTrade = useAppSelector(selectBestTrade);
  const worstTrade = useAppSelector(selectWorstTrade);
  const bestShortTrade = useAppSelector(selectBestShortTrade);
  const worstShortTrade = useAppSelector(selectWorstShortTrade);
  const sellTradeCount = useAppSelector(selectSellTradeCount);
  const shortTradeCount = useAppSelector(selectShortTradeCount);

  const locale = getFormatLocale(i18n.language);

  useClickOutside(continueDropdownRef, useCallback(() => setContinueDropdownOpen(false), []));

  const handleContinueSelect = (cycles: number | null) => {
    setContinueDropdownOpen(false);
    onContinueGame(cycles);
  };

  if (!endGameStats) return null;

  const {
    playerRanking,
    playerNetWorth,
    playerProfit,
    playerRiskLevel,
    allPlayersRanked,
  } = endGameStats;

  const totalPlayers = allPlayersRanked.length;
  const topCount = CONFIG.rankingTopCount;
  const bottomCount = CONFIG.rankingBottomCount;

  // Calculate stock value from holdings
  const stocksValue = holdings.reduce((total, holding) => {
    const stock = stocks.find(s => s.symbol === holding.symbol);
    return total + (stock ? stock.currentPrice * holding.shares : 0);
  }, 0);

  // Calculate unrealized profit/loss for each holding
  const holdingsWithProfitLoss = holdings.map(holding => {
    const stock = stocks.find(s => s.symbol === holding.symbol);
    const currentPrice = stock?.currentPrice ?? 0;
    const unrealizedProfitLoss = (currentPrice - holding.avgBuyPrice) * holding.shares;
    return {
      symbol: holding.symbol,
      shares: holding.shares,
      avgBuyPrice: holding.avgBuyPrice,
      currentPrice,
      unrealizedProfitLoss,
    };
  });

  // Best holding (highest unrealized profit) - only if profit > 0
  const bestHolding = holdingsWithProfitLoss
    .filter(h => h.unrealizedProfitLoss > 0)
    .reduce<typeof holdingsWithProfitLoss[0] | null>(
      (best, h) => (!best || h.unrealizedProfitLoss > best.unrealizedProfitLoss) ? h : best,
      null
    );

  // Worst holding (biggest unrealized loss) - only if loss < 0
  const worstHolding = holdingsWithProfitLoss
    .filter(h => h.unrealizedProfitLoss < 0)
    .reduce<typeof holdingsWithProfitLoss[0] | null>(
      (worst, h) => (!worst || h.unrealizedProfitLoss < worst.unrealizedProfitLoss) ? h : worst,
      null
    );

  // Helper to format currency with current locale
  const fmt = (value: number, decimals = 0) => formatCurrency(value, decimals, locale);

  const getRiskLevelLabel = (level: RiskLevel): string => {
    return t(`gameEnd.riskLevel.${level}`);
  };

  const getRiskLevelClass = (level: RiskLevel): string => {
    switch (level) {
      case 'conservative': return 'game-end__risk--conservative';
      case 'moderate': return 'game-end__risk--moderate';
      case 'aggressive': return 'game-end__risk--aggressive';
    }
  };

  const getRiskLevelShortClass = (level: RiskLevel): string => {
    switch (level) {
      case 'conservative': return 'game-end__player-risk--conservative';
      case 'moderate': return 'game-end__player-risk--moderate';
      case 'aggressive': return 'game-end__player-risk--aggressive';
    }
  };

  const getProfitClass = (profit: number): string => {
    if (profit > 0) return 'game-end__profit--positive';
    if (profit < 0) return 'game-end__profit--negative';
    return '';
  };

  const getRankingEmoji = (rank: number): string => {
    switch (rank) {
      case 1: return '\u{1F947}'; // 🥇
      case 2: return '\u{1F948}'; // 🥈
      case 3: return '\u{1F949}'; // 🥉
      default: return '';
    }
  };

  const getClimateLabel = (score: number): string => {
    if (score >= 75) return t('gameEnd.climate.veryPositive');
    if (score >= 55) return t('gameEnd.climate.positive');
    if (score >= 45) return t('gameEnd.climate.neutral');
    if (score >= 25) return t('gameEnd.climate.negative');
    return t('gameEnd.climate.veryNegative');
  };

  const getClimateClass = (score: number): string => {
    if (score >= 75) return 'game-end__climate--very-positive';
    if (score >= 55) return 'game-end__climate--positive';
    if (score >= 45) return 'game-end__climate--neutral';
    if (score >= 25) return 'game-end__climate--negative';
    return 'game-end__climate--very-negative';
  };

  const getPhaseLabel = (phase: MarketPhase): string => {
    return t(`economicClimate.phases.${phase}`);
  };

  const getCreditScoreLabel = (score: number): string => {
    if (score >= 70) return t('loans.creditScore.excellent');
    if (score >= 55) return t('loans.creditScore.good');
    if (score >= 40) return t('loans.creditScore.fair');
    return t('loans.creditScore.poor');
  };

  const getCreditScoreClass = (score: number): string => {
    if (score >= 70) return 'game-end__credit-score--excellent';
    if (score >= 55) return 'game-end__credit-score--good';
    if (score >= 40) return 'game-end__credit-score--fair';
    return 'game-end__credit-score--poor';
  };

  // Summarize credit history events
  const getCreditScoreSummary = () => {
    const summary: { type: string; total: number }[] = [];
    const grouped = creditHistory.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + event.change;
      return acc;
    }, {} as Record<string, number>);

    const typeLabels: Record<string, string> = {
      repaid_early: t('gameEnd.creditEvents.repaidEarly'),
      repaid_on_time: t('gameEnd.creditEvents.repaidOnTime'),
      auto_repaid: t('gameEnd.creditEvents.autoRepaid'),
      overdue: t('gameEnd.creditEvents.overdue'),
      default_penalty: t('gameEnd.creditEvents.defaultPenalty'),
    };

    for (const [type, total] of Object.entries(grouped)) {
      if (total !== 0) {
        summary.push({ type: typeLabels[type] || type, total });
      }
    }
    return summary;
  };

  const creditScoreSummary = getCreditScoreSummary();

  // Determine which players to show
  const topPlayers = allPlayersRanked.slice(0, topCount);
  const bottomPlayers = totalPlayers > topCount ? allPlayersRanked.slice(-bottomCount) : [];

  // Check if player is in top or bottom lists
  const playerInTop = playerRanking <= topCount;
  const playerInBottom = playerRanking > totalPlayers - bottomCount;
  const playerInMiddle = !playerInTop && !playerInBottom && totalPlayers > topCount + bottomCount;

  // Get player data if they're in the middle
  const playerData = playerInMiddle ? allPlayersRanked.find(p => p.isHuman) : null;

  const renderPlayerRow = (player: PlayerEndStats, rank: number) => {
    const emoji = getRankingEmoji(rank);
    return (
      <div
        key={player.id}
        className={`game-end__player-row ${player.isHuman ? 'game-end__player-row--human' : ''}`}
      >
        <span className="game-end__player-rank">
          {emoji ? `${emoji} ${rank}` : rank}
        </span>
        <span className="game-end__player-name">
          {player.isHuman ? t('gameEnd.you') : player.name}
        </span>
        <span className={`game-end__player-risk ${getRiskLevelShortClass(player.riskLevel)}`}>
          {getRiskLevelLabel(player.riskLevel)}
        </span>
        <span className={`game-end__player-profit ${getProfitClass(player.profit)}`}>
          {fmt(player.profit)}
        </span>
        <span className="game-end__player-networth">
          {fmt(player.netWorth)}
        </span>
      </div>
    );
  };

  // Format player ranking display in result section - only show rank for top 3
  const formatPlayerRankDisplay = (): string | null => {
    if (playerRanking <= 3) {
      const emoji = getRankingEmoji(playerRanking);
      return `${emoji} ${playerRanking}`;
    }
    return null; // Don't show rank if not in top 3
  };

  // Render a trade statistic item
  const renderTradeItem = (
    label: string,
    trade: TradeWithProfitLoss | null,
    isProfit: boolean
  ) => {
    if (!trade) return null;
    return (
      <div className="game-end__stat-item">
        <span className="game-end__stat-label">{label}</span>
        <span className="game-end__stat-value">
          <span className="game-end__stat-symbol">{trade.symbol}</span>
          <span className={isProfit ? 'game-end__profit--positive' : 'game-end__profit--negative'}>
            {fmt(trade.profitLoss)}
          </span>
        </span>
        <span className="game-end__stat-detail">
          {t('gameEnd.sharesAt', { shares: trade.shares, price: fmt(trade.pricePerShare, 2) })}
        </span>
      </div>
    );
  };

  // Render a holding statistic item (unrealized profit/loss)
  const renderHoldingItem = (
    label: string,
    holding: typeof holdingsWithProfitLoss[0] | null,
    isProfit: boolean
  ) => {
    if (!holding) return null;
    return (
      <div className="game-end__stat-item">
        <span className="game-end__stat-label">{label}</span>
        <span className="game-end__stat-value">
          <span className="game-end__stat-symbol">{holding.symbol}</span>
          <span className={isProfit ? 'game-end__profit--positive' : 'game-end__profit--negative'}>
            {fmt(holding.unrealizedProfitLoss)}
          </span>
        </span>
        <span className="game-end__stat-detail">
          {t('gameEnd.holdingDetail', {
            shares: holding.shares,
            avgPrice: fmt(holding.avgBuyPrice, 2),
            currentPrice: fmt(holding.currentPrice, 2)
          })}
        </span>
      </div>
    );
  };

  const rankDisplay = formatPlayerRankDisplay();

  return (
    <div className="game-end">
      <div className="game-end__container">
        <header className="game-end__header">
          <h2>{t('gameEnd.title')}</h2>
        </header>

        <div className="game-end__content">
          {/* Column 1: Your Result */}
          <section className="game-end__column game-end__column--result">
            <h3>{t('gameEnd.yourResult')}</h3>

            {/* Ranking (only for top 3) */}
            {rankDisplay && (
              <div className="game-end__result-highlight">
                <span className="game-end__result-rank">{rankDisplay}</span>
              </div>
            )}

            {/* Net Worth Breakdown */}
            <div className="game-end__breakdown">
              <h4>{t('gameEnd.netWorthBreakdown')}</h4>
              <div className="game-end__breakdown-grid">
                <div className="game-end__breakdown-item">
                  <span className="game-end__breakdown-label">{t('gameEnd.cashBalance')}</span>
                  <span className="game-end__breakdown-value">{fmt(cash)}</span>
                </div>
                <div className="game-end__breakdown-item">
                  <span className="game-end__breakdown-label">{t('gameEnd.stocksValue')}</span>
                  <span className="game-end__breakdown-value">{fmt(stocksValue)}</span>
                </div>
                {totalDebt > 0 && (
                  <div className="game-end__breakdown-item">
                    <span className="game-end__breakdown-label">{t('gameEnd.liabilities')}</span>
                    <span className="game-end__breakdown-value game-end__profit--negative">
                      {fmt(-totalDebt)}
                    </span>
                  </div>
                )}
                <div className="game-end__breakdown-item game-end__breakdown-item--total">
                  <span className="game-end__breakdown-label">{t('gameEnd.netWorth')}</span>
                  <span className="game-end__breakdown-value">
                    {fmt(playerNetWorth)}
                  </span>
                </div>
                <div className="game-end__breakdown-item">
                  <span className="game-end__breakdown-label">{t('gameEnd.profit')}</span>
                  <span className={`game-end__breakdown-value ${getProfitClass(playerProfit)}`}>
                    {fmt(playerProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Credit Score & Interest Paid in one row */}
            <div className="game-end__stat-row">
              <div className="game-end__stat-item game-end__stat-item--half">
                <span className="game-end__stat-label">{t('gameEnd.creditScoreLabel')}</span>
                <span className={`game-end__stat-value ${getCreditScoreClass(creditScore)}`}>
                  {creditScore} ({getCreditScoreLabel(creditScore)})
                </span>
                {creditScoreSummary.length > 0 && (
                  <div className="game-end__credit-breakdown">
                    <span className="game-end__credit-base">
                      {t('gameEnd.creditEvents.base', { value: LOAN_CONFIG.initialCreditScore })}
                    </span>
                    {creditScoreSummary.map((item, idx) => (
                      <span
                        key={idx}
                        className={`game-end__credit-event ${item.total > 0 ? 'game-end__profit--positive' : 'game-end__profit--negative'}`}
                      >
                        {item.total > 0 ? '+' : ''}{item.total} {item.type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {loanStats.totalInterestPaid > 0 && (
                <div className="game-end__stat-item game-end__stat-item--half">
                  <span className="game-end__stat-label">{t('gameEnd.totalInterestPaid')}</span>
                  <span className="game-end__stat-value game-end__profit--negative">
                    {fmt(loanStats.totalInterestPaid, 2)}
                  </span>
                </div>
              )}
            </div>

            {/* Risk Profile */}
            <div className="game-end__stat-item">
              <span className="game-end__stat-label">{t('gameEnd.riskProfile')}</span>
              <span className={`game-end__stat-value ${getRiskLevelClass(playerRiskLevel)}`}>
                {getRiskLevelLabel(playerRiskLevel)}
              </span>
            </div>

            {/* Best/Worst Trades (only if >= 2 sell trades) */}
            {sellTradeCount >= 2 && (
              <>
                {renderTradeItem(t('gameEnd.bestTrade'), bestTrade, true)}
                {renderTradeItem(t('gameEnd.worstTrade'), worstTrade, false)}
              </>
            )}

            {/* Best/Worst Holdings (unrealized profit/loss) */}
            {holdings.length > 0 && (
              <>
                {renderHoldingItem(t('gameEnd.bestHolding'), bestHolding, true)}
                {renderHoldingItem(t('gameEnd.worstHolding'), worstHolding, false)}
              </>
            )}

            {/* Best/Worst Shorts (only if >= 2 short trades) */}
            {shortTradeCount >= 2 && (
              <>
                {renderTradeItem(t('gameEnd.bestShort'), bestShortTrade, true)}
                {renderTradeItem(t('gameEnd.worstShort'), worstShortTrade, false)}
              </>
            )}
          </section>

          {/* Column 2: D-GREX Ranking */}
          <section className="game-end__column game-end__column--ranking">
            <h3>{t('gameEnd.rankingTitle')}</h3>
            {theme === 'medieval' && (() => {
              const thirdSize = Math.ceil(totalPlayers / 3);
              const img = playerRanking <= thirdSize
                ? 'patrician.png'
                : playerRanking <= thirdSize * 2
                  ? 'merchant.png'
                  : 'beggar.png';
              return (
                <div className="game-end__ranking-illustration">
                  <img src={`${import.meta.env.BASE_URL}assets/img/${img}`} alt="" />
                </div>
              );
            })()}
            <div className="game-end__player-list">
              <div className="game-end__player-header">
                <span>{t('gameEnd.rank')}</span>
                <span>{t('gameEnd.player')}</span>
                <span>{t('gameEnd.riskProfile')}</span>
                <span>{t('gameEnd.profit')}</span>
                <span>{t('gameEnd.netWorth')}</span>
              </div>
              {/* Top players */}
              {topPlayers.map((player, index) => renderPlayerRow(player, index + 1))}

              {/* Separator and player row if player is in middle */}
              {playerInMiddle && playerData && (
                <>
                  {/* Only show "..." if player is not directly after top 3 (i.e., not rank 4) */}
                  {playerRanking > topCount + 1 && (
                    <div className="game-end__separator">
                      <span>...</span>
                    </div>
                  )}
                  {renderPlayerRow(playerData, playerRanking)}
                </>
              )}

              {/* Separator before bottom players (if there are bottom players to show) */}
              {bottomPlayers.length > 0 && (
                <>
                  {/* Only show "..." if there's a gap before bottom players */}
                  {/* Gap exists if: player not in middle, OR player is in middle but not directly before bottom 3 */}
                  {(!playerInMiddle || playerRanking < totalPlayers - bottomCount) && (
                    <div className="game-end__separator">
                      <span>...</span>
                    </div>
                  )}
                  {bottomPlayers.map((player, index) =>
                    renderPlayerRow(player, totalPlayers - bottomCount + index + 1)
                  )}
                </>
              )}
            </div>
          </section>

          {/* Column 3: Economic Climate */}
          <section className="game-end__column game-end__column--climate">
            <h3>{t('gameEnd.economicClimate')}</h3>
            <div className="game-end__climate-stats">
              <div className="game-end__stat-item">
                <span className="game-end__stat-label">{t('gameEnd.duration')}</span>
                <span className="game-end__stat-value">
                  {t('gameEnd.cycles', { count: currentCycle })}
                </span>
              </div>
              <div className="game-end__stat-item">
                <span className="game-end__stat-label">{t('gameEnd.averageClimate')}</span>
                <span className={`game-end__stat-value ${getClimateClass(averageClimateScore)}`}>
                  {getClimateLabel(averageClimateScore)}
                </span>
              </div>
              <div className="game-end__stat-item">
                <span className="game-end__stat-label">{t('gameEnd.dominantPhase')}</span>
                <span className="game-end__stat-value">
                  {getPhaseLabel(dominantPhase)}
                </span>
              </div>
            </div>
            {climateHistory.length > 1 && (
              <div className="game-end__chart-container">
                <div className="game-end__chart-legend">
                  <span className="game-end__chart-legend-item">
                    <span className="game-end__chart-legend-color game-end__chart-legend-color--feargreed" />
                    {t('gameEnd.chartLegend.fearGreed')}
                  </span>
                </div>
                <ClimateHistoryChart data={climateHistory} theme={theme} />
              </div>
            )}
          </section>
        </div>

        <footer className="game-end__footer">
          {!isPreview && (
            <div className="game-end__actions">
              {/* Load last saved game (only if save exists) */}
              {hasSavedGame && (
                <button
                  className="game-end__button"
                  onClick={onLoadGame}
                >
                  {t('gameEnd.loadLastSave')}
                </button>
              )}

              {/* Continue game with duration selection */}
              <div className="game-end__continue-wrapper" ref={continueDropdownRef}>
                {continueDropdownOpen && (
                  <div className="game-end__continue-dropdown">
                    {GAME_DURATION_OPTIONS.map((option) => (
                      <button
                        key={option.cycles === null ? 'null' : option.cycles}
                        className="game-end__continue-option"
                        onClick={() => handleContinueSelect(option.cycles)}
                      >
                        {t(option.labelKey)}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="game-end__button"
                  onClick={() => setContinueDropdownOpen(!continueDropdownOpen)}
                >
                  {t('gameEnd.continueGame')}
                </button>
              </div>

              {/* Start new game */}
              <button
                className="game-end__button"
                onClick={onPlayAgain}
              >
                {t('gameEnd.newGame')}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};
