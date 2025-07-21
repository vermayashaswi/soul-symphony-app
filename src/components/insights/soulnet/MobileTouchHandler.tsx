
import React, { useRef, useCallback } from 'react';
import CapacitorTouchHandler from './CapacitorTouchHandler';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

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
  const isNativeEnv = nativeIntegrationService.isRunningNatively();
  const touchStartTime = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  console.log(`[MobileTouchHandler] Rendering for node ${nodeId}, native: ${isNativeEnv}`);

  // Use CapacitorTouchHandler for native environments or enhanced touch handling
  if (isNativeEnv || ('ontouchstart' in window)) {
    return (
      <CapacitorTouchHandler
        nodeId={nodeId}
        onNodeClick={onNodeClick}
      >
        {children}
      </CapacitorTouchHandler>
    );
  }

  // Fallback for desktop environments
  const handleClick = useCallback((e: React.MouseEvent) => {
    try {
      e.stopPropagation();
      console.log(`[MobileTouchHandler] Desktop click for node ${nodeId}`);
      onNodeClick(nodeId, e);
    } catch (error) {
      console.error(`[MobileTouchHandler] Error in desktop click for node ${nodeId}:`, error);
    }
  }, [nodeId, onNodeClick]);

  return (
    <group onClick={handleClick as any}>
      {children}
    </group>
  );
};

export default MobileTouchHandler;
