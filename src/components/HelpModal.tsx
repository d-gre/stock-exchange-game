import { useTranslation } from 'react-i18next';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal = ({ onClose }: HelpModalProps) => {
  const { t } = useTranslation();

  return (
    <div className="help-modal" onClick={onClose}>
      <div className="help-modal__dialog" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="help-modal__close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>
        <div className="help-modal__content">
          <h1 className="help-modal__title">{t('help.title')}</h1>

          <section className="help-modal__section">
            <h2 className="help-modal__section-title">{t('help.intro.title')}</h2>
            <p className="help-modal__text">{t('help.intro.text')}</p>
          </section>

          <section className="help-modal__section">
            <h2 className="help-modal__section-title">{t('help.howToPlay.title')}</h2>
            <div className="help-modal__steps">
              <div className="help-modal__step">
                <span className="help-modal__step-number">1</span>
                <div className="help-modal__step-content">
                  <h3 className="help-modal__step-title">{t('help.howToPlay.step1.title')}</h3>
                  <p className="help-modal__step-text">{t('help.howToPlay.step1.text')}</p>
                </div>
              </div>
              <div className="help-modal__step">
                <span className="help-modal__step-number">2</span>
                <div className="help-modal__step-content">
                  <h3 className="help-modal__step-title">{t('help.howToPlay.step2.title')}</h3>
                  <p className="help-modal__step-text">{t('help.howToPlay.step2.text')}</p>
                </div>
              </div>
              <div className="help-modal__step">
                <span className="help-modal__step-number">3</span>
                <div className="help-modal__step-content">
                  <h3 className="help-modal__step-title">{t('help.howToPlay.step3.title')}</h3>
                  <p className="help-modal__step-text">{t('help.howToPlay.step3.text')}</p>
                </div>
              </div>
              <div className="help-modal__step">
                <span className="help-modal__step-number">4</span>
                <div className="help-modal__step-content">
                  <h3 className="help-modal__step-title">{t('help.howToPlay.step4.title')}</h3>
                  <p className="help-modal__step-text">{t('help.howToPlay.step4.text')}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="help-modal__section">
            <h2 className="help-modal__section-title">{t('help.rules.title')}</h2>
            <ul className="help-modal__list help-modal__list--rules">
              <li>{t('help.rules.rule1')}</li>
              <li>{t('help.rules.rule2')}</li>
              <li>{t('help.rules.rule3')}</li>
              <li>{t('help.rules.rule4')}</li>
              <li>{t('help.rules.rule5')}</li>
              <li>{t('help.rules.rule6')}</li>
            </ul>
          </section>

          <section className="help-modal__section">
            <h2 className="help-modal__section-title">{t('help.virtualPlayers.title')}</h2>
            <p className="help-modal__text">{t('help.virtualPlayers.text')}</p>
          </section>

          <section className="help-modal__section">
            <h2 className="help-modal__section-title">{t('help.orderTypes.title')}</h2>
            <div className="help-modal__order-types">
              <div className="help-modal__order-type">
                <strong className="help-modal__order-type-name">{t('help.orderTypes.marketName')}</strong>
                <p className="help-modal__order-type-desc">{t('help.orderTypes.market')}</p>
              </div>
              <div className="help-modal__order-type">
                <strong className="help-modal__order-type-name">{t('help.orderTypes.limitName')}</strong>
                <p className="help-modal__order-type-desc">{t('help.orderTypes.limit')}</p>
              </div>
              <div className="help-modal__order-type">
                <strong className="help-modal__order-type-name">{t('help.orderTypes.stopName')}</strong>
                <p className="help-modal__order-type-desc">{t('help.orderTypes.stop')}</p>
              </div>
            </div>
          </section>

          <section className="help-modal__section">
            <h2 className="help-modal__section-title">{t('help.marketMechanics.title')}</h2>
            <div className="help-modal__order-types">
              <div className="help-modal__order-type">
                <strong className="help-modal__order-type-name">{t('help.marketMechanics.spreadName')}</strong>
                <p className="help-modal__order-type-desc">{t('help.marketMechanics.spread')}</p>
              </div>
              <div className="help-modal__order-type">
                <strong className="help-modal__order-type-name">{t('help.marketMechanics.slippageName')}</strong>
                <p className="help-modal__order-type-desc">{t('help.marketMechanics.slippage')}</p>
              </div>
            </div>
          </section>

          <section className="help-modal__section">
            <h2 className="help-modal__section-title">{t('help.tips.title')}</h2>
            <ul className="help-modal__list help-modal__list--tips">
              <li>{t('help.tips.tip1')}</li>
              <li>{t('help.tips.tip2')}</li>
              <li>{t('help.tips.tip3')}</li>
            </ul>
          </section>

          <button
            type="button"
            className="help-modal__button"
            onClick={onClose}
          >
            {t('help.understood')}
          </button>
        </div>
      </div>
    </div>
  );
};
