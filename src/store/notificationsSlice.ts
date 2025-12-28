import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type NotificationType = 'warning' | 'error' | 'success' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  /** Auto-dismiss after X milliseconds (0 = no auto-dismiss) */
  autoDismissMs: number;
  /** Optional: Order ID for failed orders (enables editing/deleting) */
  failedOrderId?: string;
  /** Optional: Symbol of the failed order */
  failedOrderSymbol?: string;
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
  /** Optional: Order ID for failed orders */
  failedOrderId?: string;
  /** Optional: Symbol of the failed order */
  failedOrderSymbol?: string;
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
        failedOrderId: action.payload.failedOrderId,
        failedOrderSymbol: action.payload.failedOrderSymbol,
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
  },
});

export const {
  addNotification,
  dismissNotification,
  clearAllNotifications,
  dismissNotificationsForOrder,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;

// Selectors
export const selectAllNotifications = (state: { notifications: NotificationsState }) =>
  state.notifications.items;

export const selectNotificationsByType = (
  state: { notifications: NotificationsState },
  type: NotificationType
) => state.notifications.items.filter(n => n.type === type);

export const selectFailedOrderNotifications = (state: { notifications: NotificationsState }) =>
  state.notifications.items.filter(n => n.failedOrderId !== undefined);
