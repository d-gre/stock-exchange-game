import { useEffect, type RefObject } from 'react';

/**
 * Hook that detects clicks outside of a referenced element
 * and calls the provided callback when detected.
 */
export const useClickOutside = (
  ref: RefObject<HTMLElement | null>,
  onClickOutside: () => void
): void => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, onClickOutside]);
};
