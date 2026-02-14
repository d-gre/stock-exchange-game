import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebugMarketOverview } from './useDebugMarketOverview';

describe('useDebugMarketOverview', () => {
  beforeEach(() => {
    // Clean up any existing event listeners
  });

  afterEach(() => {
    // Clean up
  });

  it('should return false initially', () => {
    const { result } = renderHook(() => useDebugMarketOverview());
    expect(result.current).toBe(false);
  });

  it('should toggle to true when Alt+M is pressed', () => {
    const { result } = renderHook(() => useDebugMarketOverview());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'm',
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(result.current).toBe(true);
  });

  it('should toggle back to false when Alt+M is pressed again', () => {
    const { result } = renderHook(() => useDebugMarketOverview());

    // First press - toggle on
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'm',
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });
    expect(result.current).toBe(true);

    // Second press - toggle off
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'm',
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });
    expect(result.current).toBe(false);
  });

  it('should work with uppercase M', () => {
    const { result } = renderHook(() => useDebugMarketOverview());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'M',
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(result.current).toBe(true);
  });

  it('should not toggle without Alt key', () => {
    const { result } = renderHook(() => useDebugMarketOverview());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'm',
        altKey: false,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(result.current).toBe(false);
  });

  it('should not toggle with different key', () => {
    const { result } = renderHook(() => useDebugMarketOverview());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(result.current).toBe(false);
  });

  it('should clean up event listener on unmount', () => {
    const { unmount } = renderHook(() => useDebugMarketOverview());

    // Unmount the hook
    unmount();

    // Create a new hook to verify the old listener is gone
    const { result } = renderHook(() => useDebugMarketOverview());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'm',
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    // Should only toggle once (from the new hook), not twice
    expect(result.current).toBe(true);
  });
});
