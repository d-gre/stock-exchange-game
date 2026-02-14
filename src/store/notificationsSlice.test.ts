import { describe, it, expect } from 'vitest';
import notificationsReducer, {
  addNotification,
  dismissNotification,
  clearAllNotifications,
  selectAllNotifications,
  selectNotificationsByType,
  dismissNotificationsForOrder,
  dismissNotificationsForLoan,
  dismissNotificationsForMarginCall,
  tickNotificationCycles,
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

  describe('dismissNotificationsForLoan', () => {
    it('should remove notifications for a specific loan', () => {
      const stateWithNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'error',
            title: 'Loan Overdue',
            message: 'Your loan is overdue',
            timestamp: Date.now(),
            autoDismissMs: 0,
            loanId: 'loan-1',
          },
          {
            id: 'notif-2',
            type: 'warning',
            title: 'Other Warning',
            message: 'Some other warning',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
          {
            id: 'notif-3',
            type: 'error',
            title: 'Another Loan Overdue',
            message: 'Another loan is overdue',
            timestamp: Date.now(),
            autoDismissMs: 0,
            loanId: 'loan-1',
          },
        ] as Notification[],
      };

      const result = notificationsReducer(stateWithNotifications, dismissNotificationsForLoan('loan-1'));

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('notif-2');
    });

    it('should not remove notifications for other loans', () => {
      const stateWithNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'error',
            title: 'Loan Overdue',
            message: 'Loan 1 overdue',
            timestamp: Date.now(),
            autoDismissMs: 0,
            loanId: 'loan-1',
          },
          {
            id: 'notif-2',
            type: 'error',
            title: 'Loan Overdue',
            message: 'Loan 2 overdue',
            timestamp: Date.now(),
            autoDismissMs: 0,
            loanId: 'loan-2',
          },
        ] as Notification[],
      };

      const result = notificationsReducer(stateWithNotifications, dismissNotificationsForLoan('loan-1'));

      expect(result.items).toHaveLength(1);
      expect(result.items[0].loanId).toBe('loan-2');
    });
  });

  describe('dismissNotificationsForMarginCall', () => {
    it('should remove notifications for a specific margin call symbol', () => {
      const stateWithNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'error',
            title: 'Margin Call!',
            message: 'AAPL position requires margin',
            timestamp: Date.now(),
            autoDismissMs: 0,
            marginCallSymbol: 'AAPL',
          },
          {
            id: 'notif-2',
            type: 'warning',
            title: 'Other Warning',
            message: 'Some other warning',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
          {
            id: 'notif-3',
            type: 'error',
            title: 'Margin Call!',
            message: 'Another AAPL margin call',
            timestamp: Date.now(),
            autoDismissMs: 0,
            marginCallSymbol: 'AAPL',
          },
        ] as Notification[],
      };

      const result = notificationsReducer(stateWithNotifications, dismissNotificationsForMarginCall('AAPL'));

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('notif-2');
    });

    it('should not remove notifications for other margin call symbols', () => {
      const stateWithNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'error',
            title: 'Margin Call!',
            message: 'AAPL margin call',
            timestamp: Date.now(),
            autoDismissMs: 0,
            marginCallSymbol: 'AAPL',
          },
          {
            id: 'notif-2',
            type: 'error',
            title: 'Margin Call!',
            message: 'GOOGL margin call',
            timestamp: Date.now(),
            autoDismissMs: 0,
            marginCallSymbol: 'GOOGL',
          },
        ] as Notification[],
      };

      const result = notificationsReducer(stateWithNotifications, dismissNotificationsForMarginCall('AAPL'));

      expect(result.items).toHaveLength(1);
      expect(result.items[0].marginCallSymbol).toBe('GOOGL');
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

  describe('tickNotificationCycles', () => {
    it('should decrement autoDismissCycles and remove notifications when cycles reach 0', () => {
      const stateWithCycleNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'info',
            title: 'Partial Cover',
            message: 'Some shares covered',
            timestamp: Date.now(),
            autoDismissMs: 0,
            autoDismissCycles: 3,
          },
          {
            id: 'notif-2',
            type: 'warning',
            title: 'Warning',
            message: 'No cycle dismiss',
            timestamp: Date.now(),
            autoDismissMs: 5000,
          },
          {
            id: 'notif-3',
            type: 'info',
            title: 'About to expire',
            message: 'Last cycle',
            timestamp: Date.now(),
            autoDismissMs: 0,
            autoDismissCycles: 1,
          },
        ] as Notification[],
      };

      // First tick: notif-1 goes 3->2, notif-3 goes 1->0 (removed)
      let result = notificationsReducer(stateWithCycleNotifications, tickNotificationCycles());

      expect(result.items).toHaveLength(2);
      expect(result.items.find(n => n.id === 'notif-1')?.autoDismissCycles).toBe(2);
      expect(result.items.find(n => n.id === 'notif-2')).toBeDefined(); // no autoDismissCycles
      expect(result.items.find(n => n.id === 'notif-3')).toBeUndefined(); // removed

      // Second tick: notif-1 goes 2->1
      result = notificationsReducer(result, tickNotificationCycles());
      expect(result.items.find(n => n.id === 'notif-1')?.autoDismissCycles).toBe(1);

      // Third tick: notif-1 goes 1->0 (removed)
      result = notificationsReducer(result, tickNotificationCycles());
      expect(result.items.find(n => n.id === 'notif-1')).toBeUndefined();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('notif-2'); // only the one without autoDismissCycles remains
    });

    it('should not affect notifications without autoDismissCycles', () => {
      const stateWithMixedNotifications = {
        items: [
          {
            id: 'notif-1',
            type: 'warning',
            title: 'No cycle dismiss',
            message: 'Should remain',
            timestamp: Date.now(),
            autoDismissMs: 0,
          },
          {
            id: 'notif-2',
            type: 'error',
            title: 'Also no cycle dismiss',
            message: 'Should also remain',
            timestamp: Date.now(),
            autoDismissMs: 5000,
            // undefined = no cycle-based dismiss
          },
        ] as Notification[],
      };

      const result = notificationsReducer(stateWithMixedNotifications, tickNotificationCycles());

      expect(result.items).toHaveLength(2);
    });

    it('should remove only one notification per tick in FIFO order when multiple expire simultaneously', () => {
      const stateWithSameCycleNotifications = {
        items: [
          {
            id: 'oldest',
            type: 'info',
            title: 'First partial cover',
            message: 'Oldest toast',
            timestamp: 1000,
            autoDismissMs: 0,
            autoDismissCycles: 1,
          },
          {
            id: 'middle',
            type: 'info',
            title: 'Second partial cover',
            message: 'Middle toast',
            timestamp: 2000,
            autoDismissMs: 0,
            autoDismissCycles: 1,
          },
          {
            id: 'newest',
            type: 'info',
            title: 'Third partial cover',
            message: 'Newest toast',
            timestamp: 3000,
            autoDismissMs: 0,
            autoDismissCycles: 1,
          },
        ] as Notification[],
      };

      // Tick 1: all three expire (1->0), but only the oldest is removed
      let result = notificationsReducer(stateWithSameCycleNotifications, tickNotificationCycles());
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('middle');
      expect(result.items[1].id).toBe('newest');

      // Tick 2: middle is removed (deferred from previous tick)
      result = notificationsReducer(result, tickNotificationCycles());
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('newest');

      // Tick 3: newest is removed
      result = notificationsReducer(result, tickNotificationCycles());
      expect(result.items).toHaveLength(0);
    });

    it('should normalize autoDismissCycles: 0 to undefined in addNotification', () => {
      const result = notificationsReducer(initialState, addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        autoDismissCycles: 0,
      }));

      expect(result.items[0].autoDismissCycles).toBeUndefined();
    });
  });
});
