
import { useState, useEffect, useCallback } from 'react';

interface ViewportDimensions {
  width: number;
  height: number;
  safeAreaTop: number;
  safeAreaBottom: number;
}

interface PositionConfig {
  stepId: number;
  preferredPosition?: 'top' | 'bottom' | 'center';
  targetElement?: string;
  offset?: number;
}

interface CalculatedPosition {
  top?: string;
  bottom?: string;
  left: string;
  transform: string;
  maxWidth: string;
  maxHeight: string;
}

export const useViewportAwarePosition = (config: PositionConfig): CalculatedPosition => {
  const [viewport, setViewport] = useState<ViewportDimensions>({
    width: window.innerWidth,
    height: window.innerHeight,
    safeAreaTop: 0,
    safeAreaBottom: 0
  });

  // Update viewport dimensions on resize
  useEffect(() => {
    const updateViewport = () => {
      const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0');
      const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0');
      
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        safeAreaTop: Math.max(safeAreaTop, 20), // Minimum 20px for status bar
        safeAreaBottom: Math.max(safeAreaBottom, 20) // Minimum 20px for navigation
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  const calculatePosition = useCallback((): CalculatedPosition => {
    const { stepId, preferredPosition, targetElement, offset = 20 } = config;
    const { width, height, safeAreaTop, safeAreaBottom } = viewport;

    // Calculate available space
    const availableHeight = height - safeAreaTop - safeAreaBottom;
    const availableWidth = width - (offset * 2);
    
    // Determine modal dimensions based on content
    const modalWidth = Math.min(
      stepId >= 7 && stepId <= 10 ? 350 : 320, // Wider for infographic steps
      availableWidth
    );
    
    // Estimate modal height based on step content
    const estimatedHeight = stepId >= 7 && stepId <= 10 ? 400 : 300;
    const modalHeight = Math.min(estimatedHeight, availableHeight - 40);

    // Calculate horizontal position (always centered)
    const left = '50%';
    const translateX = '-50%';

    // Calculate vertical position based on step requirements
    let top: string | undefined;
    let bottom: string | undefined;
    let translateY = '0';

    switch (stepId) {
      case 1:
        // Step 1: Center with slight upward bias
        top = `${safeAreaTop + (availableHeight * 0.4)}px`;
        translateY = '-50%';
        break;

      case 2:
        // Step 2: Top positioned to show arrow button
        top = `${safeAreaTop + 40}px`;
        break;

      case 3:
        // Step 3: Centered for theme strips
        top = `${safeAreaTop + (availableHeight / 2)}px`;
        translateY = '-50%';
        break;

      case 4:
      case 5:
        // Steps 4-5: Bottom positioned to avoid covering tabs
        bottom = `${safeAreaBottom + 120}px`;
        break;

      case 6:
        // Step 6: Bottom right positioned for chat interface
        if (width < 640) {
          // Mobile: Bottom positioned
          bottom = `${safeAreaBottom + 20}px`;
        } else {
          // Desktop: Bottom right
          bottom = '20px';
        }
        break;

      case 7:
      case 8:
      case 9:
      case 10:
        // Insights steps: Center positioned
        top = `${safeAreaTop + (availableHeight / 2)}px`;
        translateY = '-50%';
        break;

      default:
        // Default: Center positioned
        top = `${safeAreaTop + (availableHeight / 2)}px`;
        translateY = '-50%';
    }

    // Ensure modal doesn't exceed viewport boundaries
    if (top) {
      const topValue = parseInt(top);
      const minTop = safeAreaTop + offset;
      const maxTop = height - safeAreaBottom - modalHeight - offset;
      
      if (topValue < minTop) {
        top = `${minTop}px`;
      } else if (topValue > maxTop) {
        top = `${maxTop}px`;
      }
    }

    if (bottom) {
      const bottomValue = parseInt(bottom);
      const minBottom = safeAreaBottom + offset;
      const maxBottom = height - safeAreaTop - modalHeight - offset;
      
      if (bottomValue < minBottom) {
        bottom = `${minBottom}px`;
      }
    }

    return {
      top,
      bottom,
      left,
      transform: `translate(${translateX}, ${translateY})`,
      maxWidth: `${modalWidth}px`,
      maxHeight: `${modalHeight}px`
    };
  }, [config, viewport]);

  return calculatePosition();
};
