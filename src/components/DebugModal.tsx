import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { closeDebugModal } from '../store/uiSlice';
import { useClickOutside } from '../hooks/useClickOutside';
import { CopyIcon, CheckIcon } from './Icons';

/**
 * Modal for displaying debug output (Alt+D)
 * Shows JSON data with a copy-to-clipboard button
 */
export const DebugModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { debugModalOpen, debugModalContent } = useAppSelector(state => state.ui);
  const modalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useClickOutside(modalRef, () => dispatch(closeDebugModal()));

  if (!debugModalOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugModalContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => {
    dispatch(closeDebugModal());
  };

  return (
    <div className="debug-modal__overlay">
      <div className="debug-modal" ref={modalRef}>
        <div className="debug-modal__header">
          <h2>{t('debug.title')}</h2>
          <button className="debug-modal__close" onClick={handleClose} aria-label={t('common.close')}>
            &times;
          </button>
        </div>
        <div className="debug-modal__content">
          <pre className="debug-modal__code">{debugModalContent}</pre>
        </div>
        <div className="debug-modal__footer">
          <button
            className="debug-modal__copy-btn"
            onClick={handleCopy}
            aria-label={copied ? t('debug.copied') : t('debug.copy')}
          >
            {copied ? <CheckIcon size={20} /> : <CopyIcon size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};
