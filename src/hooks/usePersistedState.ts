'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Like useState, but persists the value in sessionStorage.
 * On mount, restores the saved value (if any).
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setStateRaw] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // ignore parse errors
    }
    return defaultValue;
  });

  // Sync to sessionStorage whenever state changes
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [key, state]);

  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStateRaw(value);
    },
    []
  );

  return [state, setState];
}
