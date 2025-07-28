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
 * Calculates the center point of the concentric circle animation
 * taking into account the container dimensions and bottom navigation offset
 */
export function getAnimationCenter(
  containerWidth: number = window.innerWidth,
  containerHeight: number = window.innerHeight,
  bottomNavOffset: boolean = true
): CircleCenter {
  const effectiveHeight = bottomNavOffset ? containerHeight - 64 : containerHeight; // 64px for bottom nav
  
  return {
    x: containerWidth / 2,
    y: effectiveHeight / 2
  };
}

/**
 * Gets the positioning styles for centering an element on the animation center
 */
export function getAnimationCenterStyles(
  containerWidth?: number,
  containerHeight?: number,
  bottomNavOffset: boolean = true
): React.CSSProperties {
  const center = getAnimationCenter(containerWidth, containerHeight, bottomNavOffset);
  
  return {
    position: 'fixed' as const,
    left: `${center.x}px`,
    top: `${center.y}px`,
    transform: 'translate(-50%, -50%)',
    zIndex: 40,
  };
}

/**
 * Hook to get animation center position with window resize handling
 */
export function useAnimationCenter(bottomNavOffset: boolean = true): CircleCenter {
  const [center, setCenter] = React.useState<CircleCenter>(() => 
    getAnimationCenter(window.innerWidth, window.innerHeight, bottomNavOffset)
  );

  React.useEffect(() => {
    const updateCenter = () => {
      setCenter(getAnimationCenter(window.innerWidth, window.innerHeight, bottomNavOffset));
    };

    window.addEventListener('resize', updateCenter);
    return () => window.removeEventListener('resize', updateCenter);
  }, [bottomNavOffset]);

  return center;
}

// React import for the hook
import React from 'react';