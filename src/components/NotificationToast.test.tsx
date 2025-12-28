import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NotificationToast } from './NotificationToast';
import type { Notification } from '../store/notificationsSlice';

// Mock Redux hooks
const mockDispatch = vi.fn();
let mockNotifications: Notification[] = [];

vi.mock('../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => mockNotifications,
}));

vi.mock('../store/notificationsSlice', async () => {
  const actual = await vi.importActual('../store/notificationsSlice');
  return {
    ...actual,
    dismissNotification: (id: string) => ({ type: 'notifications/dismissNotification', payload: id }),
  };
});

describe('NotificationToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockDispatch.mockClear();
    mockNotifications = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
    id: 'test-id',
    type: 'info',
    title: 'Test Title',
    message: 'Test message',
    timestamp: Date.now(),
    autoDismissMs: 5000,
    ...overrides,
  });

  describe('rendering', () => {
    it('should return null when no notifications', () => {
      mockNotifications = [];
      const { container } = render(<NotificationToast />);
      expect(container.firstChild).toBeNull();
    });

    it('should render notification container when notifications exist', () => {
      mockNotifications = [createMockNotification()];
      render(<NotificationToast />);
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should render multiple notifications', () => {
      mockNotifications = [
        createMockNotification({ id: '1', title: 'First' }),
        createMockNotification({ id: '2', title: 'Second' }),
        createMockNotification({ id: '3', title: 'Third' }),
      ];
      render(<NotificationToast />);

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });
  });

  describe('notification types', () => {
    it('should render info notification with correct class', () => {
      mockNotifications = [createMockNotification({ type: 'info' })];
      const { container } = render(<NotificationToast />);
      expect(container.querySelector('.notification-toast--info')).toBeInTheDocument();
    });

    it('should render warning notification with correct class', () => {
      mockNotifications = [createMockNotification({ type: 'warning' })];
      const { container } = render(<NotificationToast />);
      expect(container.querySelector('.notification-toast--warning')).toBeInTheDocument();
    });

    it('should render error notification with correct class', () => {
      mockNotifications = [createMockNotification({ type: 'error' })];
      const { container } = render(<NotificationToast />);
      expect(container.querySelector('.notification-toast--error')).toBeInTheDocument();
    });

    it('should render success notification with correct class', () => {
      mockNotifications = [createMockNotification({ type: 'success' })];
      const { container } = render(<NotificationToast />);
      expect(container.querySelector('.notification-toast--success')).toBeInTheDocument();
    });
  });

  describe('auto dismiss', () => {
    it('should auto dismiss after specified time', () => {
      mockNotifications = [createMockNotification({ id: 'auto-dismiss', autoDismissMs: 3000 })];
      render(<NotificationToast />);

      expect(mockDispatch).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'notifications/dismissNotification',
        payload: 'auto-dismiss',
      });
    });

    it('should not auto dismiss when autoDismissMs is 0', () => {
      mockNotifications = [createMockNotification({ autoDismissMs: 0 })];
      render(<NotificationToast />);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('close button', () => {
    it('should dismiss notification when close button is clicked', () => {
      mockNotifications = [createMockNotification({ id: 'close-test' })];
      render(<NotificationToast />);

      const closeButton = screen.getByLabelText('Schließen');
      fireEvent.click(closeButton);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'notifications/dismissNotification',
        payload: 'close-test',
      });
    });
  });

  describe('failed order actions', () => {
    it('should show action buttons for failed orders', () => {
      mockNotifications = [
        createMockNotification({
          failedOrderId: 'order-123',
          failedOrderSymbol: 'AAPL',
        }),
      ];
      render(<NotificationToast />);

      expect(screen.getByText('Ändern')).toBeInTheDocument();
      expect(screen.getByText('Löschen')).toBeInTheDocument();
    });

    it('should not show action buttons for regular notifications', () => {
      mockNotifications = [createMockNotification()];
      render(<NotificationToast />);

      expect(screen.queryByText('Ändern')).not.toBeInTheDocument();
      expect(screen.queryByText('Löschen')).not.toBeInTheDocument();
    });

    it('should have has-actions class when order actions are available', () => {
      mockNotifications = [
        createMockNotification({
          failedOrderId: 'order-123',
          failedOrderSymbol: 'AAPL',
        }),
      ];
      const { container } = render(<NotificationToast />);

      expect(container.querySelector('.notification-toast.notification-toast--has-actions')).toBeInTheDocument();
    });

    it('should call onEditFailedOrder and dismiss when edit is clicked', () => {
      const onEditFailedOrder = vi.fn();
      mockNotifications = [
        createMockNotification({
          id: 'edit-test',
          failedOrderId: 'order-123',
          failedOrderSymbol: 'AAPL',
        }),
      ];
      render(<NotificationToast onEditFailedOrder={onEditFailedOrder} />);

      fireEvent.click(screen.getByText('Ändern'));

      expect(onEditFailedOrder).toHaveBeenCalledWith('order-123', 'AAPL');
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'notifications/dismissNotification',
        payload: 'edit-test',
      });
    });

    it('should call onDeleteFailedOrder and dismiss when delete is clicked', () => {
      const onDeleteFailedOrder = vi.fn();
      mockNotifications = [
        createMockNotification({
          id: 'delete-test',
          failedOrderId: 'order-123',
          failedOrderSymbol: 'AAPL',
        }),
      ];
      render(<NotificationToast onDeleteFailedOrder={onDeleteFailedOrder} />);

      fireEvent.click(screen.getByText('Löschen'));

      expect(onDeleteFailedOrder).toHaveBeenCalledWith('order-123');
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'notifications/dismissNotification',
        payload: 'delete-test',
      });
    });

    it('should not throw when clicking edit without callback', () => {
      mockNotifications = [
        createMockNotification({
          failedOrderId: 'order-123',
          failedOrderSymbol: 'AAPL',
        }),
      ];
      render(<NotificationToast />);

      expect(() => {
        fireEvent.click(screen.getByText('Ändern'));
      }).not.toThrow();
    });

    it('should not throw when clicking delete without callback', () => {
      mockNotifications = [
        createMockNotification({
          failedOrderId: 'order-123',
          failedOrderSymbol: 'AAPL',
        }),
      ];
      render(<NotificationToast />);

      expect(() => {
        fireEvent.click(screen.getByText('Löschen'));
      }).not.toThrow();
    });
  });

  describe('NotificationIcon', () => {
    it('should render warning icon for warning type', () => {
      mockNotifications = [createMockNotification({ type: 'warning' })];
      const { container } = render(<NotificationToast />);

      const icon = container.querySelector('.notification-toast__icon svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render error icon for error type', () => {
      mockNotifications = [createMockNotification({ type: 'error' })];
      const { container } = render(<NotificationToast />);

      const icon = container.querySelector('.notification-toast__icon svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render success icon for success type', () => {
      mockNotifications = [createMockNotification({ type: 'success' })];
      const { container } = render(<NotificationToast />);

      const icon = container.querySelector('.notification-toast__icon svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render info icon for info type', () => {
      mockNotifications = [createMockNotification({ type: 'info' })];
      const { container } = render(<NotificationToast />);

      const icon = container.querySelector('.notification-toast__icon svg');
      expect(icon).toBeInTheDocument();
    });
  });
});
