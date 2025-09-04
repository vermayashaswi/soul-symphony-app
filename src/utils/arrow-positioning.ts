/**
 * Utilities for positioning elements relative to concentric circle animations
 */

export interface CircleCenter {
  x: number;
  y: number;
}

export interface AnimationDimensions {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Detects if the app is running in a Capacitor native environment
 */
function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && 
         (window as any).Capacitor && 
         (window as any).Capacitor.isNativePlatform();
}

/**
 * Calculates the center point of the concentric circle animation
 * taking into account the container dimensions and bottom navigation offset
 */
export function getAnimationCenter(
  containerWidth: number = window.innerWidth,
  containerHeight: number = window.innerHeight,
  bottomNavOffset: boolean = true,
  verticalOffset: number = 1.0
): CircleCenter {
  const effectiveHeight = bottomNavOffset ? containerHeight - 64 : containerHeight; // 64px for bottom nav
  
  // Add additional offset for Capacitor native apps to account for status bar/navigation differences
  const capacitorOffset = isCapacitorNative() ? 15 : 0;
  
  return {
    x: containerWidth / 2,
    y: (effectiveHeight / 2 - capacitorOffset) * verticalOffset
  };
}

/**
 * Gets the positioning styles for centering an element on the animation center
 */
export function getAnimationCenterStyles(
  containerWidth?: number,
  containerHeight?: number,
  bottomNavOffset: boolean = true,
  verticalOffset: number = 1.0
): React.CSSProperties {
  const center = getAnimationCenter(containerWidth, containerHeight, bottomNavOffset, verticalOffset);
  
  return {
    position: 'fixed' as const,
    left: `${center.x}px`,
    top: `${center.y}px`,
    transform: 'translate(-50%, -50%)',
    zIndex: 40,
  };
}

/**
 * Detects if the app is currently in tutorial mode
 */
function isTutorialActive(): boolean {
  return typeof document !== 'undefined' && 
         document.body.classList.contains('tutorial-active');
}

/**
 * Hook to get animation center position with window resize handling
 * Adapts positioning based on tutorial mode to handle different coordinate systems
 */
export function useAnimationCenter(bottomNavOffset: boolean = true, verticalOffset: number = 1.0): CircleCenter {
  const [center, setCenter] = React.useState<CircleCenter>(() => {
    // Always use actual pixel coordinates, regardless of tutorial mode
    return getAnimationCenter(window.innerWidth, window.innerHeight, bottomNavOffset, verticalOffset);
  });

  React.useEffect(() => {
    const updateCenter = () => {
      // Always calculate actual pixel coordinates for consistent positioning
      setCenter(getAnimationCenter(window.innerWidth, window.innerHeight, bottomNavOffset, verticalOffset));
    };

    // Update center on resize
    window.addEventListener('resize', updateCenter);
    
    // Also listen for tutorial state changes (when tutorial-active class is added/removed)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          updateCenter();
        }
      });
    });
    
    if (typeof document !== 'undefined') {
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    return () => {
      window.removeEventListener('resize', updateCenter);
      observer.disconnect();
    };
  }, [bottomNavOffset, verticalOffset]);

  return center;
}

// React import for the hook
import React from 'react';