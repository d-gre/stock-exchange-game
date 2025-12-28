import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectAllNotifications,
  dismissNotification,
  type Notification,
} from '../store/notificationsSlice';

interface NotificationToastProps {
  onEditFailedOrder?: (orderId: string, symbol: string) => void;
  onDeleteFailedOrder?: (orderId: string) => void;
}

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'warning':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'error':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case 'success':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
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

  useEffect(() => {
    if (notification.autoDismissMs > 0) {
      const timer = setTimeout(() => {
        dispatch(dismissNotification(notification.id));
      }, notification.autoDismissMs);

      return () => clearTimeout(timer);
    }
  }, [dispatch, notification.id, notification.autoDismissMs]);

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

  return (
    <div className={`notification-toast notification-toast--${notification.type} ${hasOrderActions ? 'notification-toast--has-actions' : ''}`}>
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
      <button
        className="notification-toast__close"
        onClick={() => dispatch(dismissNotification(notification.id))}
        aria-label={t('common.close')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
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
