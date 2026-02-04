'use client';

import { useEffect, useRef } from 'react';

const SCROLL_KEY = 'facts-scroll-position';

/**
 * Saves scroll position to sessionStorage on scroll (debounced).
 * On mount, restores the last saved position after a short delay
 * to allow content to render.
 */
export function useScrollRestore() {
  const restored = useRef(false);

  useEffect(() => {
    // --- Restore scroll position on mount ---
    if (!restored.current) {
      restored.current = true;
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        const scrollY = parseInt(saved, 10);
        if (!isNaN(scrollY) && scrollY > 0) {
          // Use multiple attempts to handle async content loading
          const attempts = [50, 150, 400];
          attempts.forEach((delay) => {
            setTimeout(() => {
              window.scrollTo(0, scrollY);
            }, delay);
          });
        }
      }
    }

    // --- Save scroll position on scroll (debounced) ---
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        } catch {
          // ignore
        }
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
}
