import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from './Icons';
import { LOAN_CONFIG, SHORT_SELLING_CONFIG, TRADING_MECHANICS, DEFAULT_ORDER_VALIDITY_CYCLES } from '../config';

interface HelpProps {
  onClose: () => void;
}

const SECTION_IDS = ['gameMechanics', 'loans', 'trading', 'economy', 'tips'] as const;
type SectionId = typeof SECTION_IDS[number];

/** Config values passed as i18n interpolation variables */
const configValues = {
  orderValidity: DEFAULT_ORDER_VALIDITY_CYCLES,
  interestChargeCycles: LOAN_CONFIG.interestChargeCycles,
  baseInterestRate: Math.round(LOAN_CONFIG.baseInterestRate * 100),
  maxLoans: LOAN_CONFIG.maxLoans,
  minLoanDuration: LOAN_CONFIG.minLoanDurationCycles,
  maxLoanDuration: LOAN_CONFIG.maxLoanDurationCycles,
  originationFee: LOAN_CONFIG.originationFeePercent * 100,
  earlyRepaymentFee: LOAN_CONFIG.repaymentFeePercent * 100,
  initialMargin: Math.round(SHORT_SELLING_CONFIG.initialMarginPercent * 100),
  maintenanceMargin: Math.round(SHORT_SELLING_CONFIG.maintenanceMarginPercent * 100),
  marginCallGraceCycles: SHORT_SELLING_CONFIG.marginCallGraceCycles,
  baseBorrowFee: SHORT_SELLING_CONFIG.baseBorrowFeePerCycle * 100,
  hardToBorrowMultiplier: SHORT_SELLING_CONFIG.hardToBorrowFeeMultiplier,
  spreadPercent: Math.round(TRADING_MECHANICS.realLife.spreadPercent * 100),
  feePercent: TRADING_MECHANICS.realLife.feePercent * 100,
};

/** Reusable info card (name + description) */
const InfoCard = ({ name, desc }: { name: string; desc: string }) => (
  <div className="help__order-type">
    <strong className="help__order-type-name">{name}</strong>
    <p className="help__order-type-desc">{desc}</p>
  </div>
);

export const Help = ({ onClose }: HelpProps) => {
  const { t } = useTranslation();
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(['gameMechanics']));

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const s = (key: string) => t(`help.sections.${key}`, configValues);

  const renderAccordion = (id: SectionId, content: React.ReactNode) => {
    const isOpen = openSections.has(id);
    return (
      <div className={`help__accordion${isOpen ? ' help__accordion--open' : ''}`} key={id}>
        <button
          type="button"
          className="help__accordion-header"
          onClick={() => toggleSection(id)}
          aria-expanded={isOpen}
        >
          <h2 className="help__accordion-title">{s(`${id}.title`)}</h2>
          <ChevronDownIcon size={18} className="help__accordion-icon" />
        </button>
        <div className="help__accordion-body">
          <div className="help__accordion-content">
            {content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="help" onClick={onClose}>
      <div className="help__modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="help__close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="help__content">
          <h1 className="help__title">{t('help.title')}</h1>

          {/* Section 1: Game Mechanics */}
          {renderAccordion('gameMechanics', <>
            <p className="help__text help__text--intro">{s('gameMechanics.intro')}</p>

            <h3 className="help__subsection-title">{s('gameMechanics.durationTitle')}</h3>
            <p className="help__text help__text--intro">{s('gameMechanics.durationIntro')}</p>
            <div className="help__order-types">
              <InfoCard name="30 min" desc={s('gameMechanics.duration30min')} />
              <InfoCard name="20 min" desc={s('gameMechanics.duration20min')} />
              <InfoCard name="10 min" desc={s('gameMechanics.duration10min')} />
              <InfoCard name="5 min" desc={s('gameMechanics.duration5min')} />
              <InfoCard name="∞" desc={s('gameMechanics.durationUnlimited')} />
            </div>

            <h3 className="help__subsection-title">{s('gameMechanics.speedTitle')}</h3>
            <p className="help__text help__text--intro">{s('gameMechanics.speedIntro')}</p>
            <div className="help__order-types">
              <InfoCard name="1x" desc={s('gameMechanics.speed1x')} />
              <InfoCard name="2x" desc={s('gameMechanics.speed2x')} />
              <InfoCard name="3x" desc={s('gameMechanics.speed3x')} />
            </div>

            <div className="help__order-types" style={{ marginTop: '0.75rem' }}>
              <InfoCard name={s('gameMechanics.autoPauseName')} desc={s('gameMechanics.autoPause')} />
              <InfoCard name={s('gameMechanics.endScreenName')} desc={s('gameMechanics.endScreen')} />
            </div>

            <p className="help__text" style={{ marginTop: '0.75rem' }}>{s('gameMechanics.previewHotkey')}</p>
          </>)}

          {/* Section 2: Loans */}
          {renderAccordion('loans', <>
            <p className="help__text help__text--intro">{s('loans.intro')}</p>
            <div className="help__order-types">
              <InfoCard name={s('loans.creditLineName')} desc={s('loans.creditLine')} />
              <InfoCard name={s('loans.durationName')} desc={s('loans.duration')} />
              <InfoCard name={s('loans.interestName')} desc={s('loans.interest')} />
              <InfoCard name={s('loans.feesName')} desc={s('loans.fees')} />
              <InfoCard name={s('loans.creditScoreName')} desc={s('loans.creditScore')} />
              <InfoCard name={s('loans.multipleLoansName')} desc={s('loans.multipleLoans')} />
            </div>
          </>)}

          {/* Section 3: Trading */}
          {renderAccordion('trading', <>
            <p className="help__text help__text--intro">{s('trading.intro')}</p>

            <h3 className="help__subsection-title">{s('trading.orderTypesTitle')}</h3>
            <div className="help__order-types">
              <InfoCard name={s('trading.marketOrderName')} desc={s('trading.marketOrder')} />
              <InfoCard name={s('trading.limitOrderName')} desc={s('trading.limitOrder')} />
              <InfoCard name={s('trading.stopBuyName')} desc={s('trading.stopBuy')} />
              <InfoCard name={s('trading.stopLossName')} desc={s('trading.stopLoss')} />
              <InfoCard name={s('trading.stopBuyLimitName')} desc={s('trading.stopBuyLimit')} />
              <InfoCard name={s('trading.stopLossLimitName')} desc={s('trading.stopLossLimit')} />
            </div>

            <h3 className="help__subsection-title">{s('trading.shortSellingTitle')}</h3>
            <p className="help__text help__text--intro">{s('trading.shortSellingIntro')}</p>
            <div className="help__order-types">
              <InfoCard name={s('trading.shortHowItWorksName')} desc={s('trading.shortHowItWorks')} />
              <InfoCard name={s('trading.shortMarginName')} desc={s('trading.shortMargin')} />
              <InfoCard name={s('trading.shortBorrowFeesName')} desc={s('trading.shortBorrowFees')} />
              <InfoCard name={s('trading.shortMarginCallName')} desc={s('trading.shortMarginCall')} />
              <InfoCard name={s('trading.buyToCoverName')} desc={s('trading.buyToCover')} />
            </div>
          </>)}

          {/* Section 4: Economy */}
          {renderAccordion('economy', <>
            <p className="help__text help__text--intro">{s('economy.intro')}</p>

            <h3 className="help__subsection-title">{s('economy.indicesTitle')}</h3>
            <div className="help__order-types">
              <InfoCard name={s('economy.mainIndexName')} desc={s('economy.mainIndex')} />
              <InfoCard name={s('economy.sectorIndicesName')} desc={s('economy.sectorIndices')} />
            </div>

            <h3 className="help__subsection-title">{s('economy.sectorDynamicsTitle')}</h3>
            <p className="help__text help__text--intro">{s('economy.sectorDynamicsIntro')}</p>
            <div className="help__order-types">
              <InfoCard name={s('economy.correlationName')} desc={s('economy.correlation')} />
              <InfoCard name={s('economy.interSectorName')} desc={s('economy.interSector')} />
            </div>

            <h3 className="help__subsection-title">{s('economy.marketMakerTitle')}</h3>
            <p className="help__text help__text--intro">{s('economy.marketMakerIntro')}</p>
            <div className="help__order-types">
              <InfoCard name={s('economy.inventoryName')} desc={s('economy.inventory')} />
              <InfoCard name={s('economy.dynamicSpreadName')} desc={s('economy.dynamicSpread')} />
              <InfoCard name={s('economy.rebalancingName')} desc={s('economy.rebalancing')} />
            </div>

            <h3 className="help__subsection-title">{s('economy.spreadSlippageTitle')}</h3>
            <div className="help__order-types">
              <InfoCard name={s('economy.spreadName')} desc={s('economy.spread')} />
              <InfoCard name={s('economy.slippageName')} desc={s('economy.slippage')} />
            </div>

            <h3 className="help__subsection-title">{s('economy.fearGreedTitle')}</h3>
            <p className="help__text help__text--intro">{s('economy.fearGreed')}</p>

            <h3 className="help__subsection-title">{s('economy.marketPhasesTitle')}</h3>
            <p className="help__text help__text--intro">{s('economy.marketPhasesIntro')}</p>
            <div className="help__order-types">
              <InfoCard name="☀️" desc={s('economy.phaseProsperity')} />
              <InfoCard name="🚀" desc={s('economy.phaseBoom')} />
              <InfoCard name="⚖️" desc={s('economy.phaseConsolidation')} />
              <InfoCard name="🔥" desc={s('economy.phasePanic')} />
              <InfoCard name="📉" desc={s('economy.phaseRecession')} />
              <InfoCard name="🌱" desc={s('economy.phaseRecovery')} />
            </div>
          </>)}

          {/* Section 5: Tips */}
          {renderAccordion('tips', <>
            <ul className="help__list help__list--tips">
              <li>{s('tips.tip1')}</li>
              <li>{s('tips.tip2')}</li>
              <li>{s('tips.tip3')}</li>
              <li>{s('tips.tip4')}</li>
              <li>{s('tips.tip5')}</li>
            </ul>
          </>)}

          <button
            type="button"
            className="help__button"
            onClick={onClose}
          >
            {t('help.understood')}
          </button>
        </div>
      </div>
    </div>
  );
};
