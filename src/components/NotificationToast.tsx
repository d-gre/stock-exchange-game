import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectAllNotifications,
  dismissNotification,
  type Notification,
} from '../store/notificationsSlice';
import { highlightLoan, clearLoanHighlight, selectStock } from '../store/uiSlice';
import { setPaused } from '../store/settingsSlice';
import {
  AlertTriangleIcon,
  ErrorCircleIcon,
  SuccessCircleIcon,
  InfoIcon,
  CloseIcon,
} from './Icons';

interface NotificationToastProps {
  onEditFailedOrder?: (orderId: string, symbol: string) => void;
  onDeleteFailedOrder?: (orderId: string) => void;
}

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'warning':
      return <AlertTriangleIcon size={20} />;
    case 'error':
      return <ErrorCircleIcon size={20} />;
    case 'success':
      return <SuccessCircleIcon size={20} />;
    case 'info':
    default:
      return <InfoIcon size={20} />;
  }
};

interface NotificationItemProps {
  notification: Notification;
  onEditFailedOrder?: (orderId: string, symbol: string) => void;
  onDeleteFailedOrder?: (orderId: string) => void;
}

const NotificationItem = ({ notification, onEditFailedOrder, onDeleteFailedOrder }: NotificationItemProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const hasOrderActions = notification.failedOrderId && notification.failedOrderSymbol;
  const hasLoanId = !!notification.loanId;
  const hasStockSymbol = !!notification.stockSymbol;
  const hasMarginCall = !!notification.marginCallSymbol;

  useEffect(() => {
    if (notification.autoDismissMs > 0) {
      const timer = setTimeout(() => {
        // Clear loan highlight when auto-dismissed
        if (notification.loanId) {
          dispatch(clearLoanHighlight());
        }
        dispatch(dismissNotification(notification.id));
      }, notification.autoDismissMs);

      return () => clearTimeout(timer);
    }
  }, [dispatch, notification.id, notification.autoDismissMs, notification.loanId]);

  const handleToastClick = () => {
    if (notification.loanId) {
      dispatch(highlightLoan(notification.loanId));
    }
    if (notification.stockSymbol) {
      dispatch(selectStock(notification.stockSymbol));
    }
    if (notification.marginCallSymbol) {
      // Pause the game so player can react to margin call
      dispatch(setPaused(true));
    }
  };

  const handleDismiss = () => {
    // Clear loan highlight when manually dismissed
    if (notification.loanId) {
      dispatch(clearLoanHighlight());
    }
    dispatch(dismissNotification(notification.id));
  };

  const handleEdit = () => {
    if (notification.failedOrderId && notification.failedOrderSymbol && onEditFailedOrder) {
      onEditFailedOrder(notification.failedOrderId, notification.failedOrderSymbol);
      dispatch(dismissNotification(notification.id));
    }
  };

  const handleDelete = () => {
    if (notification.failedOrderId && onDeleteFailedOrder) {
      onDeleteFailedOrder(notification.failedOrderId);
      dispatch(dismissNotification(notification.id));
    }
  };

  const isClickable = hasLoanId || hasStockSymbol || hasMarginCall;

  return (
    <div
      className={`notification-toast notification-toast--${notification.type} ${hasOrderActions ? 'notification-toast--has-actions' : ''} ${isClickable ? 'notification-toast--clickable' : ''}`}
      onClick={isClickable ? handleToastClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="notification-toast__icon">
        <NotificationIcon type={notification.type} />
      </div>
      <div className="notification-toast__content">
        <div className="notification-toast__title">{notification.title}</div>
        <div className="notification-toast__message">{notification.message}</div>
        {hasOrderActions && (
          <div className="notification-toast__actions">
            <button className="notification-toast__action-btn notification-toast__action-btn--edit" onClick={handleEdit}>
              {t('notification.change')}
            </button>
            <button className="notification-toast__action-btn notification-toast__action-btn--delete" onClick={handleDelete}>
              {t('notification.delete')}
            </button>
          </div>
        )}
      </div>
      {!hasOrderActions && (
        <button
          className="notification-toast__close"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          aria-label={t('common.close')}
        >
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  );
};

export const NotificationToast = ({ onEditFailedOrder, onDeleteFailedOrder }: NotificationToastProps) => {
  const notifications = useAppSelector(selectAllNotifications);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-toast__container">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onEditFailedOrder={onEditFailedOrder}
          onDeleteFailedOrder={onDeleteFailedOrder}
        />
      ))}
    </div>
  );
};
