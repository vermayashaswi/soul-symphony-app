
import React, { useRef, useCallback, useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface CapacitorTouchHandlerProps {
  onNodeClick: (nodeId: string, event: any) => void;
  nodeId: string;
  children: React.ReactNode;
}

export const CapacitorTouchHandler: React.FC<CapacitorTouchHandlerProps> = ({
  onNodeClick,
  nodeId,
  children
}) => {
  const touchStartTime = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isNativeEnv = nativeIntegrationService.isRunningNatively();
  const lastTouchEnd = useRef<number>(0);
  const touchHandled = useRef<boolean>(false);

  console.log(`[CapacitorTouchHandler] Initializing for node ${nodeId}, native: ${isNativeEnv}`);

  // Enhanced touch start handler with error boundaries
  const handleTouchStart = useCallback((e: React.TouchEvent | React.PointerEvent) => {
    try {
      e.stopPropagation();
      touchHandled.current = false;
      touchStartTime.current = Date.now();
      
      const touch = 'touches' in e ? e.touches[0] : e;
      if (touch) {
        touchStartPos.current = { x: touch.clientX, y: touch.clientY };
        console.log(`[CapacitorTouchHandler] Touch start for node ${nodeId} at (${touch.clientX}, ${touch.clientY})`);
      }
    } catch (error) {
      console.error(`[CapacitorTouchHandler] Error in touch start for node ${nodeId}:`, error);
    }
  }, [nodeId]);

  // Enhanced touch end handler with comprehensive validation
  const handleTouchEnd = useCallback((e: React.TouchEvent | React.PointerEvent) => {
    try {
      e.stopPropagation();
      e.preventDefault();
      
      // Prevent double-tap issues
      const now = Date.now();
      if (now - lastTouchEnd.current < 100) {
        console.log(`[CapacitorTouchHandler] Touch end ignored - too soon after last touch`);
        return;
      }
      lastTouchEnd.current = now;
      
      if (touchHandled.current) {
        console.log(`[CapacitorTouchHandler] Touch already handled for node ${nodeId}`);
        return;
      }
      
      const touchDuration = now - touchStartTime.current;
      const touch = 'changedTouches' in e ? e.changedTouches[0] : e;
      
      if (!touch) {
        console.warn(`[CapacitorTouchHandler] No touch data available for node ${nodeId}`);
        return;
      }
      
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
      const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // More lenient tap detection for mobile
      const maxDuration = isNativeEnv ? 500 : 300;
      const maxDistance = isNativeEnv ? 20 : 10;
      
      console.log(`[CapacitorTouchHandler] Touch end for node ${nodeId} - duration: ${touchDuration}ms, distance: ${moveDistance.toFixed(2)}px`);
      
      if (touchDuration < maxDuration && moveDistance < maxDistance) {
        touchHandled.current = true;
        console.log(`[CapacitorTouchHandler] Valid tap detected for node ${nodeId}`);
        
        // Enhanced haptic feedback
        if (isNativeEnv) {
          nativeIntegrationService.vibrate(30).catch(console.warn);
        } else if (navigator.vibrate) {
          navigator.vibrate(30);
        }
        
        // Create robust synthetic event
        const syntheticEvent = {
          type: 'click',
          target: e.target,
          currentTarget: e.currentTarget,
          stopPropagation: () => e.stopPropagation(),
          preventDefault: () => e.preventDefault(),
          timeStamp: now,
          detail: 1,
          bubbles: true,
          cancelable: true,
          composed: true,
          isTrusted: false,
          nativeEvent: e.nativeEvent || e
        };
        
        // Delayed execution to ensure WebGL context stability
        setTimeout(() => {
          try {
            console.log(`[CapacitorTouchHandler] Executing click handler for node ${nodeId}`);
            onNodeClick(nodeId, syntheticEvent);
          } catch (error) {
            console.error(`[CapacitorTouchHandler] Error in click handler for node ${nodeId}:`, error);
            // Fallback notification
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('soulnet-touch-error', { 
                detail: { nodeId, error: error.toString() } 
              }));
            }
          }
        }, isNativeEnv ? 50 : 10);
      }
    } catch (error) {
      console.error(`[CapacitorTouchHandler] Error in touch end for node ${nodeId}:`, error);
    }
  }, [nodeId, onNodeClick, isNativeEnv]);

  // Mouse click fallback for desktop
  const handleClick = useCallback((e: React.MouseEvent) => {
    try {
      e.stopPropagation();
      console.log(`[CapacitorTouchHandler] Mouse click for node ${nodeId}`);
      onNodeClick(nodeId, e);
    } catch (error) {
      console.error(`[CapacitorTouchHandler] Error in mouse click for node ${nodeId}:`, error);
    }
  }, [nodeId, onNodeClick]);

  // Use different event handling based on environment
  if (isNativeEnv || ('ontouchstart' in window)) {
    return (
      <group>
        <mesh
          onPointerDown={handleTouchStart as any}
          onPointerUp={handleTouchEnd as any}
          onPointerCancel={(e) => {
            console.log(`[CapacitorTouchHandler] Touch cancelled for node ${nodeId}`);
            touchHandled.current = true;
          }}
        >
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        {children}
      </group>
    );
  }

  // Desktop fallback
  return (
    <group onClick={handleClick as any}>
      {children}
    </group>
  );
};

export default CapacitorTouchHandler;
