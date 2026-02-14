import { useState, useEffect, useCallback } from 'react';

/**
 * Debug Hook: Press Alt+M (Option+M on Mac) to toggle market overview visibility
 * Useful for debugging Hard Life mode where market overview is normally hidden
 * For developers only - not documented
 */
export const useDebugMarketOverview = () => {
  const [isDebugMarketVisible, setIsDebugMarketVisible] = useState(false);

  const toggleDebugMarket = useCallback(() => {
    setIsDebugMarketVisible(prev => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Alt+M (Option+M on Mac)
      if (event.altKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        toggleDebugMarket();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleDebugMarket]);

  return isDebugMarketVisible;
};
