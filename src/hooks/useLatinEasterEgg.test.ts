import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLatinEasterEgg } from './useLatinEasterEgg';

describe('useLatinEasterEgg', () => {
  const mockOnLanguageChange = vi.fn();

  beforeEach(() => {
    mockOnLanguageChange.mockClear();
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
});
