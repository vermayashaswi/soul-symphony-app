import { useRef, useEffect, useCallback } from 'react';

interface UseAutoScrollOptions {
  /**
   * Dependencies that should trigger auto-scroll
   */
  dependencies: any[];
  
  /**
   * Whether scrolling is enabled
   */
  enabled?: boolean;
  
  /**
   * Delay before scrolling (in milliseconds)
   */
  delay?: number;
  
  /**
   * Whether to use smooth scrolling
   */
  smooth?: boolean;
  
  /**
   * Threshold for detecting if user has scrolled up (to avoid interrupting user scroll)
   */
  scrollThreshold?: number;
}

/**
 * Unified auto-scroll hook that handles all chat scrolling scenarios
 * including new messages, typing indicators, and streaming content
 */
export const useAutoScroll = (options: UseAutoScrollOptions) => {
  const {
    dependencies,
    enabled = true,
    delay = 50,
    smooth = true,
    scrollThreshold = 50
  } = options;

  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Check if user has scrolled up from bottom
  const isNearBottom = useCallback(() => {
    const element = scrollElementRef.current;
    if (!element) return true;

    const { scrollTop, scrollHeight, clientHeight } = element;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= scrollThreshold;
  }, [scrollThreshold]);

  // Scroll to bottom function with smart threshold management
  const scrollToBottom = useCallback((force = false) => {
    if (!enabled && !force) return;
    if (!scrollElementRef.current) return;

    // For force-scroll (user actions), always scroll regardless of position
    if (force) {
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        if (scrollElementRef.current) {
          scrollElementRef.current.scrollTo({
            top: scrollElementRef.current.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
          });
        }
      }, delay);
      return;
    }

    // For automatic scrolling (system actions), respect user position
    if (!isNearBottom()) {
      return;
    }

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollElementRef.current) {
        scrollElementRef.current.scrollTo({
          top: scrollElementRef.current.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    }, delay);
  }, [enabled, delay, smooth, isNearBottom]);

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(() => {
    const element = scrollElementRef.current;
    if (!element) return;

    const currentScrollTop = element.scrollTop;
    
    // Detect if user scrolled up manually
    if (currentScrollTop < lastScrollTopRef.current - 10) {
      isUserScrollingRef.current = true;
      // Reset user scrolling flag after a delay
      setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 2000);
    }
    
    lastScrollTopRef.current = currentScrollTop;
  }, []);

  // Auto-scroll when dependencies change
  useEffect(() => {
    if (dependencies.length === 0) return;
    scrollToBottom();
  }, dependencies);

  // Setup scroll listener
  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    scrollElementRef,
    scrollToBottom,
    isNearBottom,
    isUserScrolling: isUserScrollingRef.current
  };
};