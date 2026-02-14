import { useTranslation } from 'react-i18next';
import type { MarketPhase, Sector } from '../types';

interface EconomicClimateProps {
  globalPhase: MarketPhase;
  sectorPhases: Record<Sector, MarketPhase>;
  fearGreedIndex: number;
}

type FearGreedLevel = 'extremeFear' | 'fear' | 'neutral' | 'greed' | 'extremeGreed';

/**
 * Returns the fear/greed level based on the index value
 */
const getFearGreedLevel = (index: number): FearGreedLevel => {
  if (index <= 25) return 'extremeFear';
  if (index <= 45) return 'fear';
  if (index <= 55) return 'neutral';
  if (index <= 75) return 'greed';
  return 'extremeGreed';
};

/**
 * Returns the CSS modifier for a market phase
 */
const getPhaseModifier = (phase: MarketPhase): string => {
  return `economic-climate__phase-badge--${phase}`;
};

/**
 * Returns the CSS modifier for fear/greed level
 */
const getFearGreedModifier = (level: FearGreedLevel): string => {
  return `economic-climate__fear-greed-bar--${level}`;
};

const SECTORS: Sector[] = ['tech', 'finance', 'industrial', 'commodities'];

export const EconomicClimate = ({
  globalPhase,
  sectorPhases,
  fearGreedIndex,
}: EconomicClimateProps) => {
  const { t } = useTranslation();

  const fearGreedLevel = getFearGreedLevel(fearGreedIndex);
  const fearGreedModifier = getFearGreedModifier(fearGreedLevel);

  return (
    <div className="economic-climate">
      <div className="economic-climate__header">
        <span className="economic-climate__title">{t('economicClimate.title')}</span>
      </div>

      <div className="economic-climate__content">
        {/* Fear & Greed Index */}
        <div className="economic-climate__fear-greed">
          <div className="economic-climate__fear-greed-label">
            {t('economicClimate.fearGreedIndex')}
          </div>
          <div className="economic-climate__fear-greed-container">
            <div
              className={`economic-climate__fear-greed-bar ${fearGreedModifier}`}
              style={{ width: `${fearGreedIndex}%` }}
            />
            <span className="economic-climate__fear-greed-value">{fearGreedIndex}</span>
          </div>
          <div className="economic-climate__fear-greed-info">
            <div className="economic-climate__fear-greed-description">
              {t('economicClimate.fearGreedDescription')}
            </div>
            <div className="economic-climate__fear-greed-level">
              {t(`economicClimate.fearLevels.${fearGreedLevel}`)}
            </div>
          </div>
        </div>

        {/* Global Phase */}
        <div className="economic-climate__global-phase">
          <span className="economic-climate__section-label">
            {t('economicClimate.globalPhase')}
          </span>
          <span className={`economic-climate__phase-badge ${getPhaseModifier(globalPhase)}`}>
            {t(`economicClimate.phases.${globalPhase}`)}
          </span>
        </div>

        {/* Sector Phases */}
        <div className="economic-climate__sector-phases">
          <span className="economic-climate__section-label">
            {t('economicClimate.sectorPhases')}
          </span>
          <div className="economic-climate__sector-grid">
            {SECTORS.map(sector => (
              <div key={sector} className="economic-climate__sector-item">
                <span className="economic-climate__sector-name">
                  {t(`sectors.${sector}`)}
                </span>
                <span className={`economic-climate__phase-badge economic-climate__phase-badge--small ${getPhaseModifier(sectorPhases[sector])}`}>
                  {t(`economicClimate.phases.${sectorPhases[sector]}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
