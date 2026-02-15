import { useRef, useCallback } from 'react';

/**
 * Hook that prevents duplicate form submissions by debouncing.
 * Returns a wrapper function that ignores calls within the cooldown period.
 * 
 * @param fn - The async function to debounce
 * @param cooldownMs - Cooldown period in milliseconds (default: 1000)
 */
export function useSubmitGuard<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  cooldownMs = 1000
): (...args: Parameters<T>) => Promise<void> {
  const lastCallRef = useRef<number>(0);
  const pendingRef = useRef(false);

  return useCallback(
    async (...args: Parameters<T>) => {
      const now = Date.now();
      if (pendingRef.current || now - lastCallRef.current < cooldownMs) {
        return;
      }

      pendingRef.current = true;
      lastCallRef.current = now;

      try {
        await fn(...args);
      } finally {
        pendingRef.current = false;
      }
    },
    [fn, cooldownMs]
  );
}
