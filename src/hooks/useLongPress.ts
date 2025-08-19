import { useCallback, useRef, useEffect } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  delay?: number;
  disabled?: boolean;
}

export const useLongPress = ({ onLongPress, delay = 500, disabled = false }: LongPressOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const start = useCallback(() => {
    if (disabled) return;
    
    longPressTriggered.current = false;
    timeoutRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay, disabled]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clear();
    longPressTriggered.current = false;
  }, [clear]);

  const onClick = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (longPressTriggered.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  // Mobile touch events
  const onTouchStart = useCallback(() => {
    start();
  }, [start]);

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  const onTouchCancel = useCallback(() => {
    clear();
  }, [clear]);

  // Desktop mouse events
  const onMouseDown = useCallback(() => {
    start();
  }, [start]);

  const onMouseUp = useCallback(() => {
    clear();
  }, [clear]);

  const onMouseLeave = useCallback(() => {
    clear();
  }, [clear]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onClick,
    reset
  };
};