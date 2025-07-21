
import React, { useRef, useCallback } from 'react';

interface MobileTouchHandlerProps {
  onNodeClick: (nodeId: string, event: any) => void;
  nodeId: string;
  children: React.ReactNode;
}

export const MobileTouchHandler: React.FC<MobileTouchHandlerProps> = ({
  onNodeClick,
  nodeId,
  children
}) => {
  const touchStartTime = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isTouchDevice = 'ontouchstart' in window;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    touchStartTime.current = Date.now();
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    
    console.log(`[MobileTouchHandler] Touch start for node ${nodeId}`);
  }, [nodeId]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const touchDuration = Date.now() - touchStartTime.current;
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Consider it a tap if duration < 300ms and movement < 10px
    if (touchDuration < 300 && moveDistance < 10) {
      console.log(`[MobileTouchHandler] Valid tap detected for node ${nodeId}`);
      
      // Haptic feedback for mobile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Create synthetic event for Three.js compatibility
      const syntheticEvent = {
        ...e,
        stopPropagation: () => e.stopPropagation(),
        preventDefault: () => e.preventDefault(),
        type: 'click',
        target: e.target,
        currentTarget: e.currentTarget
      };
      
      onNodeClick(nodeId, syntheticEvent);
    }
  }, [nodeId, onNodeClick]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`[MobileTouchHandler] Mouse click for node ${nodeId}`);
    onNodeClick(nodeId, e);
  }, [nodeId, onNodeClick]);

  // Use touch events on mobile, mouse events on desktop
  if (isTouchDevice) {
    return (
      <group
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </group>
    );
  }

  return (
    <group onClick={handleClick}>
      {children}
    </group>
  );
};

export default MobileTouchHandler;
