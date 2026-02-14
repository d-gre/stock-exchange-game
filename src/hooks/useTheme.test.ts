import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => mockLocalStorage[key] ?? null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => {
        mockLocalStorage[key] = value;
      }
    );

    // Mock document.documentElement.setAttribute
    vi.spyOn(document.documentElement, 'setAttribute');

    // Clear mocks
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should default to dark theme when no localStorage value exists', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');
    });

    it('should use localStorage value if it exists (dark)', () => {
      mockLocalStorage['stock-exchange-theme'] = 'dark';

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');
    });

    it('should use localStorage value if it exists (light)', () => {
      mockLocalStorage['stock-exchange-theme'] = 'light';

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('light');
    });

    it('should apply theme to document on mount', () => {
      mockLocalStorage['stock-exchange-theme'] = 'light';

      renderHook(() => useTheme());

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-theme',
        'light'
      );
    });
  });

  describe('setTheme', () => {
    it('should update theme state when setTheme is called', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
    });

    it('should save theme to localStorage when setTheme is called', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('light');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'stock-exchange-theme',
        'light'
      );
    });

    it('should apply theme to document when setTheme is called', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('light');
      });

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-theme',
        'light'
      );
    });

    it('should handle switching from light to dark', () => {
      mockLocalStorage['stock-exchange-theme'] = 'light';
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('light');

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'stock-exchange-theme',
        'dark'
      );
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
    });

    it('should toggle from light to dark', () => {
      mockLocalStorage['stock-exchange-theme'] = 'light';
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('light');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should persist toggled theme to localStorage', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.toggleTheme();
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'stock-exchange-theme',
        'light'
      );
    });

    it('should apply toggled theme to document', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.toggleTheme();
      });

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-theme',
        'light'
      );
    });

    it('should toggle multiple times correctly', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');

      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe('light');

      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe('dark');

      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe('light');
    });
  });

  describe('function stability', () => {
    it('should return stable setTheme function reference', () => {
      const { result, rerender } = renderHook(() => useTheme());

      const firstSetTheme = result.current.setTheme;
      rerender();
      const secondSetTheme = result.current.setTheme;

      expect(firstSetTheme).toBe(secondSetTheme);
    });

    it('should update toggleTheme when theme changes', () => {
      const { result } = renderHook(() => useTheme());

      const firstToggle = result.current.toggleTheme;

      act(() => {
        result.current.toggleTheme();
      });

      // toggleTheme depends on theme, so it should update
      const secondToggle = result.current.toggleTheme;
      expect(firstToggle).not.toBe(secondToggle);
    });
  });

  describe('type safety', () => {
    it('should only accept valid theme values', () => {
      const { result } = renderHook(() => useTheme());

      // These should work
      act(() => {
        result.current.setTheme('dark');
      });
      expect(result.current.theme).toBe('dark');

      act(() => {
        result.current.setTheme('light');
      });
      expect(result.current.theme).toBe('light');
    });
  });

  describe('medieval theme', () => {
    it('should accept medieval as a valid theme', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('medieval');
      });

      expect(result.current.theme).toBe('medieval');
    });

    it('should apply medieval theme to document', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('medieval');
      });

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-theme',
        'medieval'
      );
    });

    it('should NOT persist medieval theme to localStorage', () => {
      const { result } = renderHook(() => useTheme());

      // Set a user theme first
      act(() => {
        result.current.setTheme('light');
      });

      // Clear the mock to check only the medieval call
      vi.mocked(localStorage.setItem).mockClear();

      act(() => {
        result.current.setTheme('medieval');
      });

      // localStorage.setItem should NOT be called for medieval
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should NOT restore medieval theme from localStorage on load', () => {
      // Simulate medieval being stored (e.g., from an old bug)
      mockLocalStorage['stock-exchange-theme'] = 'medieval';

      const { result } = renderHook(() => useTheme());

      // Should default to dark, not medieval
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('getUserTheme', () => {
    it('should return dark when no theme is stored', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.getUserTheme()).toBe('dark');
    });

    it('should return stored user theme (light)', () => {
      mockLocalStorage['stock-exchange-user-theme'] = 'light';
      const { result } = renderHook(() => useTheme());

      expect(result.current.getUserTheme()).toBe('light');
    });

    it('should return stored user theme (dark)', () => {
      mockLocalStorage['stock-exchange-user-theme'] = 'dark';
      const { result } = renderHook(() => useTheme());

      expect(result.current.getUserTheme()).toBe('dark');
    });

    it('should fall back to stock-exchange-theme if user-theme is not set', () => {
      mockLocalStorage['stock-exchange-theme'] = 'light';
      const { result } = renderHook(() => useTheme());

      expect(result.current.getUserTheme()).toBe('light');
    });

    it('should return user theme even when medieval is active', () => {
      mockLocalStorage['stock-exchange-user-theme'] = 'light';
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('medieval');
      });

      expect(result.current.theme).toBe('medieval');
      expect(result.current.getUserTheme()).toBe('light');
    });

    it('should save to user-theme when setting dark or light', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('light');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'stock-exchange-user-theme',
        'light'
      );
    });
  });
});
