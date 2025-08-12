import { useEffect, useRef, useState } from 'react';

interface PullToRefreshOptions {
  threshold?: number; // px to trigger refresh
  disabled?: boolean;
  onRefresh?: () => Promise<void> | void;
}

export function usePullToRefresh(options: PullToRefreshOptions = {}) {
  const { threshold = 70, disabled = false, onRefresh } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  useEffect(() => {
    const el = containerRef.current || document.scrollingElement || document.documentElement;

    let startY = 0;
    let active = false;
    let blocked = false;

    const isKeyboardContext = () => {
      const keyboardVisible = document.body.classList.contains('keyboard-visible');
      const ae = document.activeElement as HTMLElement | null;
      const inputActive = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
      return keyboardVisible || inputActive;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      // Only start if at top and not in keyboard context
      const scrollTop = (el as HTMLElement).scrollTop ?? window.scrollY;
      blocked = isKeyboardContext();
      if (blocked || scrollTop > 0) return;

      active = true;
      startY = e.touches[0].clientY;
      setIsPulling(false);
      setProgress(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || blocked) return;
      const delta = e.touches[0].clientY - startY;
      if (delta > 0) {
        e.preventDefault(); // prevent overscroll bounce
        setIsPulling(true);
        const p = Math.min(1, delta / threshold);
        setProgress(p);
      }
    };

    const onTouchEnd = async () => {
      if (!active) return;
      const shouldRefresh = progress >= 1 && !blocked;
      active = false;

      if (shouldRefresh) {
        try {
          setIsRefreshing(true);
          if (onRefresh) {
            await onRefresh();
          } else {
            window.location.reload();
          }
        } finally {
          setIsRefreshing(false);
          setIsPulling(false);
          setProgress(0);
        }
      } else {
        setIsPulling(false);
        setProgress(0);
      }
    };

    // Attach listeners on the root scrolling element
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart as any);
      el.removeEventListener('touchmove', onTouchMove as any);
      el.removeEventListener('touchend', onTouchEnd as any);
    };
  }, [disabled, isRefreshing, progress, threshold, onRefresh]);

  return {
    containerRef,
    isPulling,
    isRefreshing,
    progress
  };
}
