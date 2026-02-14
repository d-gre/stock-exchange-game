import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLatinEasterEgg } from './useLatinEasterEgg';

describe('useLatinEasterEgg', () => {
  const mockOnLanguageChange = vi.fn();
  const mockOnThemeChange = vi.fn();
  const mockGetUserTheme = vi.fn((): 'dark' | 'light' => 'dark');

  beforeEach(() => {
    mockOnLanguageChange.mockClear();
    mockOnThemeChange.mockClear();
    mockGetUserTheme.mockClear();
    mockGetUserTheme.mockReturnValue('dark' as 'dark' | 'light');
  });

  afterEach(() => {
    // Clean up any event listeners
    vi.restoreAllMocks();
  });

  it('should switch to Latin when pressing Ctrl+L', () => {
    renderHook(() => useLatinEasterEgg('de', mockOnLanguageChange));

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    expect(mockOnLanguageChange).toHaveBeenCalledWith('la');
  });

  it('should switch back to previous language when pressing Ctrl+L while in Latin', () => {
    const { rerender } = renderHook(
      ({ language }) => useLatinEasterEgg(language, mockOnLanguageChange),
      { initialProps: { language: 'de' as 'de' | 'en' | 'ja' | 'la' } }
    );

    // First Ctrl+L: switch to Latin
    const event1 = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event1);
    expect(mockOnLanguageChange).toHaveBeenCalledWith('la');

    // Simulate that language changed to Latin
    rerender({ language: 'la' as const });
    mockOnLanguageChange.mockClear();

    // Second Ctrl+L: switch back to German
    const event2 = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event2);
    expect(mockOnLanguageChange).toHaveBeenCalledWith('de');
  });

  it('should not trigger on regular L key press', () => {
    renderHook(() => useLatinEasterEgg('de', mockOnLanguageChange));

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: false,
      bubbles: true,
    });
    document.dispatchEvent(event);

    expect(mockOnLanguageChange).not.toHaveBeenCalled();
  });

  it('should work with Meta key (Mac)', () => {
    renderHook(() => useLatinEasterEgg('en', mockOnLanguageChange));

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    expect(mockOnLanguageChange).toHaveBeenCalledWith('la');
  });

  describe('theme integration', () => {
    it('should switch to medieval theme when switching to Latin', () => {
      renderHook(() => useLatinEasterEgg('de', mockOnLanguageChange, mockOnThemeChange, mockGetUserTheme));

      const event = new KeyboardEvent('keydown', {
        key: 'l',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(mockOnLanguageChange).toHaveBeenCalledWith('la');
      expect(mockOnThemeChange).toHaveBeenCalledWith('medieval');
    });

    it('should restore user theme when switching back from Latin', () => {
      mockGetUserTheme.mockReturnValue('light' as 'dark' | 'light');

      const { rerender } = renderHook(
        ({ language }) => useLatinEasterEgg(language, mockOnLanguageChange, mockOnThemeChange, mockGetUserTheme),
        { initialProps: { language: 'de' as 'de' | 'en' | 'ja' | 'la' } }
      );

      // First Ctrl+L: switch to Latin and medieval theme
      const event1 = new KeyboardEvent('keydown', {
        key: 'l',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event1);
      expect(mockOnThemeChange).toHaveBeenCalledWith('medieval');

      // Simulate that language changed to Latin
      rerender({ language: 'la' as const });
      mockOnThemeChange.mockClear();

      // Second Ctrl+L: switch back and restore theme
      const event2 = new KeyboardEvent('keydown', {
        key: 'l',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event2);
      expect(mockOnThemeChange).toHaveBeenCalledWith('light');
    });

    it('should restore dark theme when user had dark theme before', () => {
      mockGetUserTheme.mockReturnValue('dark' as 'dark' | 'light');

      const { rerender } = renderHook(
        ({ language }) => useLatinEasterEgg(language, mockOnLanguageChange, mockOnThemeChange, mockGetUserTheme),
        { initialProps: { language: 'en' as 'de' | 'en' | 'ja' | 'la' } }
      );

      // Switch to Latin
      const event1 = new KeyboardEvent('keydown', {
        key: 'l',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event1);

      // Simulate that language changed to Latin
      rerender({ language: 'la' as const });
      mockOnThemeChange.mockClear();

      // Switch back from Latin
      const event2 = new KeyboardEvent('keydown', {
        key: 'l',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event2);
      expect(mockOnThemeChange).toHaveBeenCalledWith('dark');
    });

    it('should work without theme callbacks (backwards compatible)', () => {
      // Should not throw when theme callbacks are not provided
      renderHook(() => useLatinEasterEgg('de', mockOnLanguageChange));

      const event = new KeyboardEvent('keydown', {
        key: 'l',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(mockOnLanguageChange).toHaveBeenCalledWith('la');
      // Theme change should not be called since no callback provided
      expect(mockOnThemeChange).not.toHaveBeenCalled();
    });
  });
});
