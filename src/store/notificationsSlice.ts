import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';

export type NotificationType = 'warning' | 'error' | 'success' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  /** Auto-dismiss after X milliseconds (0 = no auto-dismiss) */
  autoDismissMs: number;
  /** Auto-dismiss after X game cycles (0 = no cycle-based auto-dismiss) */
  autoDismissCycles?: number;
  /** Optional: Order ID for failed orders (enables editing/deleting) */
  failedOrderId?: string;
  /** Optional: Symbol of the failed order */
  failedOrderSymbol?: string;
  /** Optional: Loan ID for loan-related notifications (enables highlighting) */
  loanId?: string;
  /** Optional: Stock symbol for stock-related notifications (enables chart navigation) */
  stockSymbol?: string;
  /** Optional: Symbol for margin call notifications (enables dismissal when resolved) */
  marginCallSymbol?: string;
}

interface NotificationsState {
  items: Notification[];
}

const initialState: NotificationsState = {
  items: [],
};

interface AddNotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  /** Auto-dismiss after X milliseconds (default: 5000, 0 = no auto-dismiss) */
  autoDismissMs?: number;
  /** Auto-dismiss after X game cycles (0 = no cycle-based auto-dismiss) */
  autoDismissCycles?: number;
  /** Optional: Order ID for failed orders */
  failedOrderId?: string;
  /** Optional: Symbol of the failed order */
  failedOrderSymbol?: string;
  /** Optional: Loan ID for loan-related notifications */
  loanId?: string;
  /** Optional: Stock symbol for stock-related notifications */
  stockSymbol?: string;
  /** Optional: Symbol for margin call notifications */
  marginCallSymbol?: string;
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<AddNotificationPayload>) => {
      const notification: Notification = {
        id: crypto.randomUUID(),
        type: action.payload.type,
        title: action.payload.title,
        message: action.payload.message,
        timestamp: Date.now(),
        autoDismissMs: action.payload.autoDismissMs ?? 5000,
        // Normalize: only store autoDismissCycles if > 0 (0 or undefined = no cycle-based dismiss)
        autoDismissCycles: action.payload.autoDismissCycles && action.payload.autoDismissCycles > 0
          ? action.payload.autoDismissCycles
          : undefined,
        failedOrderId: action.payload.failedOrderId,
        failedOrderSymbol: action.payload.failedOrderSymbol,
        loanId: action.payload.loanId,
        stockSymbol: action.payload.stockSymbol,
        marginCallSymbol: action.payload.marginCallSymbol,
      };
      state.items.push(notification);
    },

    dismissNotification: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(n => n.id !== action.payload);
    },

    clearAllNotifications: (state) => {
      state.items = [];
    },

    /** Removes all notifications for a specific order ID */
    dismissNotificationsForOrder: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(n => n.failedOrderId !== action.payload);
    },

    /** Removes all notifications for a specific loan ID */
    dismissNotificationsForLoan: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(n => n.loanId !== action.payload);
    },

    /** Removes all margin call notifications for a specific symbol */
    dismissNotificationsForMarginCall: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(n => n.marginCallSymbol !== action.payload);
    },

    /** Decrements autoDismissCycles and removes the oldest expired notification (FIFO, one per tick) */
    tickNotificationCycles: (state) => {
      let removedOne = false;

      state.items = state.items.filter(notification => {
        // Skip notifications without cycle-based auto-dismiss
        if (notification.autoDismissCycles === undefined) {
          return true;
        }

        // Previously expired (deferred from an earlier tick) - remove oldest first
        if (notification.autoDismissCycles <= 0) {
          if (!removedOne) {
            removedOne = true;
            return false;
          }
          return true;
        }

        // Decrement active countdowns
        notification.autoDismissCycles -= 1;

        // Check if just expired - remove oldest first (FIFO)
        if (notification.autoDismissCycles <= 0) {
          if (!removedOne) {
            removedOne = true;
            return false;
          }
          // Keep for deferred removal in subsequent ticks
          return true;
        }

        return true;
      });
    },
  },
});

export const {
  addNotification,
  dismissNotification,
  clearAllNotifications,
  dismissNotificationsForOrder,
  dismissNotificationsForLoan,
  dismissNotificationsForMarginCall,
  tickNotificationCycles,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;

// Selectors
export const selectAllNotifications = (state: { notifications: NotificationsState }) =>
  state.notifications.items;

export const selectNotificationsByType = (
  state: { notifications: NotificationsState },
  type: NotificationType
) => state.notifications.items.filter(n => n.type === type);

export const selectFailedOrderIds = createSelector(
  [selectAllNotifications],
  (notifications): string[] =>
    notifications
      .filter(n => n.failedOrderId)
      .map(n => n.failedOrderId as string)
);
