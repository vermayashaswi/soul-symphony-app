import { useState, useEffect, useRef, useMemo } from 'react';
import { CircleCenter, getAnimationCenter } from '@/utils/arrow-positioning';
import { useAnimationReadiness } from '@/contexts/AnimationReadinessProvider';

/**
 * Stable version of useAnimationCenter that prevents flickering during initialization
 * by debouncing position updates and only updating when animation is ready
 */
export function useStableAnimationCenter(bottomNavOffset: boolean = true, verticalOffset: number = 1.0): CircleCenter {
  const { isReady } = useAnimationReadiness();
  const stabilizedRef = useRef(false);
  
  // Calculate initial center position
  const initialCenter = useMemo(() => 
    getAnimationCenter(window.innerWidth, window.innerHeight, bottomNavOffset, verticalOffset),
    [bottomNavOffset, verticalOffset]
  );
  
  const [center, setCenter] = useState<CircleCenter>(initialCenter);

  useEffect(() => {
    if (!isReady) return;

    // Mark as stabilized once animation is ready
    if (!stabilizedRef.current) {
      stabilizedRef.current = true;
      // Update to current position once stable
      setCenter(getAnimationCenter(window.innerWidth, window.innerHeight, bottomNavOffset, verticalOffset));
    }

    let resizeTimeout: NodeJS.Timeout;
    
    const updateCenter = () => {
      // Debounce resize updates to prevent excessive re-renders
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (stabilizedRef.current) {
          setCenter(getAnimationCenter(window.innerWidth, window.innerHeight, bottomNavOffset, verticalOffset));
        }
      }, 100);
    };

    window.addEventListener('resize', updateCenter);
    return () => {
      window.removeEventListener('resize', updateCenter);
      clearTimeout(resizeTimeout);
    };
  }, [isReady, bottomNavOffset, verticalOffset]);

  return center;
}