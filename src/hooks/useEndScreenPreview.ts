import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  showEndScreenPreview,
  hideEndScreenPreview,
  selectIsGameEnded,
  selectEndScreenPreview,
} from '../store/gameSessionSlice';
import type { EndGameStats } from '../store/gameSessionSlice';

/**
 * Hook: Press Alt+R to toggle the end screen preview.
 * Shows a snapshot of the current standings without ending the game.
 * The action buttons are hidden in preview mode.
 */
export const useEndScreenPreview = (
  calculateEndGameStats: () => EndGameStats,
) => {
  const dispatch = useAppDispatch();
  const isGameEnded = useAppSelector(selectIsGameEnded);
  const isPreview = useAppSelector(selectEndScreenPreview);

  const togglePreview = useCallback(() => {
    if (isGameEnded) return;

    if (isPreview) {
      dispatch(hideEndScreenPreview());
    } else {
      const stats = calculateEndGameStats();
      dispatch(showEndScreenPreview(stats));
    }
  }, [dispatch, isGameEnded, isPreview, calculateEndGameStats]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        togglePreview();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePreview]);
};
