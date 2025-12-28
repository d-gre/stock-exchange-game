import { describe, it, expect } from 'vitest';
import notificationsReducer, {
  addNotification,
  dismissNotification,
  clearAllNotifications,
  selectAllNotifications,
  selectNotificationsByType,
  dismissNotificationsForOrder,
  type Notification,
} from './notificationsSlice';

describe('notificationsSlice', () => {
  const initialState: { items: Notification[] } = {
    items: [],
  };

  describe('addNotification', () => {
    it('should add a notification with default autoDismissMs', () => {
      const result = notificationsReducer(initialState, addNotification({
        type: 'warning',
        title: 'Test Title',
        message: 'Test Message',
      }));

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('warning');
      expect(result.items[0].title).toBe('Test Title');
      expect(result.items[0].message).toBe('Test Message');
      expect(result.items[0].autoDismissMs).toBe(5000);
      expect(result.items[0].id).toBeDefined();
      expect(result.items[0].timestamp).toBeDefined();
    });

    it('should add a notification with custom autoDismissMs', () => {
      const result = notificationsReducer(initialState, addNotification({
        type: 'error',
        title: 'Error',
        message: 'Something went wrong',
        autoDismissMs: 10000,
      }));

      expect(result.items[0].autoDismissMs).toBe(10000);
    });

    it('should add multiple notifications', () => {
      let state = initialState;

      state = notificationsReducer(state, addNotification({
        type: 'warning',
        title: 'Warning 1',
        message: 'Message 1',
      }));

      state = notificationsReducer(state, addNotification({
        type: 'error',
        title: 'Error 1',
        message: 'Message 2',
      }));

      expect(state.items).toHaveLength(2);
    });
  });

  describe('dismissNotification', () => {
    it('should remove a notification by id', () => {
      const stateWithNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'warning',
            title: 'Warning',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
          {
            id: 'notif-2',
            type: 'error',
            title: 'Error',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
        ] as Notification[],
      };

      const result = notificationsReducer(stateWithNotifications, dismissNotification('notif-1'));

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('notif-2');
    });

    it('should do nothing if id does not exist', () => {
      const stateWithNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'warning',
            title: 'Warning',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
        ] as Notification[],
      };

      const result = notificationsReducer(stateWithNotifications, dismissNotification('non-existent'));

      expect(result.items).toHaveLength(1);
    });
  });

  describe('clearAllNotifications', () => {
    it('should remove all notifications', () => {
      const stateWithNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'warning',
            title: 'Warning',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
          {
            id: 'notif-2',
            type: 'error',
            title: 'Error',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
        ] as Notification[],
      };

      const result = notificationsReducer(stateWithNotifications, clearAllNotifications());

      expect(result.items).toHaveLength(0);
    });
  });

  describe('dismissNotificationsForOrder', () => {
    it('should remove notifications for a specific order', () => {
      const stateWithNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'warning',
            title: 'Warning',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 0,
            failedOrderId: 'order-1',
            failedOrderSymbol: 'AAPL',
          },
          {
            id: 'notif-2',
            type: 'error',
            title: 'Error',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
        ] as Notification[],
      };

      const result = notificationsReducer(stateWithNotifications, dismissNotificationsForOrder('order-1'));

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('notif-2');
    });
  });

  describe('selectors', () => {
    const stateWithNotifications = {
      notifications: {
        items: [
          {
            id: 'notif-1',
            type: 'warning',
            title: 'Warning',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
          {
            id: 'notif-2',
            type: 'error',
            title: 'Error',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
          {
            id: 'notif-3',
            type: 'warning',
            title: 'Another Warning',
            message: 'Message',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
        ] as Notification[],
      },
    };

    describe('selectAllNotifications', () => {
      it('should return all notifications', () => {
        const result = selectAllNotifications(stateWithNotifications);
        expect(result).toHaveLength(3);
      });
    });

    describe('selectNotificationsByType', () => {
      it('should return notifications filtered by type', () => {
        const warnings = selectNotificationsByType(stateWithNotifications, 'warning');
        expect(warnings).toHaveLength(2);

        const errors = selectNotificationsByType(stateWithNotifications, 'error');
        expect(errors).toHaveLength(1);

        const successes = selectNotificationsByType(stateWithNotifications, 'success');
        expect(successes).toHaveLength(0);
      });
    });
  });
});
