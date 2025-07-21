
import React, { useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface TouchEventHandlerProps {
  onNodeSelect: (nodeId: string, position: THREE.Vector3) => void;
  onNodeDeselect: () => void;
  nodes: Array<{ id: string; position: THREE.Vector3 }>;
  children: React.ReactNode;
}

export const TouchEventHandler: React.FC<TouchEventHandlerProps> = ({
  onNodeSelect,
  onNodeDeselect,
  nodes,
  children
}) => {
  const { camera, raycaster, size } = useThree();
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isCapacitorNative = useRef(false);

  useEffect(() => {
    // Detect if running in Capacitor native environment
    isCapacitorNative.current = !!(window as any).Capacitor && 
      ((window as any).Capacitor.getPlatform() === 'android' || 
       (window as any).Capacitor.getPlatform() === 'ios');
    
    console.log('[TouchEventHandler] Native detection:', isCapacitorNative.current);
  }, []);

  const getIntersectedNode = useCallback((clientX: number, clientY: number) => {
    const rect = (document.querySelector('canvas') as HTMLCanvasElement)?.getBoundingClientRect();
    if (!rect) return null;

    // Convert screen coordinates to normalized device coordinates
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const mouse = new THREE.Vector2(x, y);
    raycaster.setFromCamera(mouse, camera);

    // Find closest node within selection threshold
    const threshold = 0.5; // Increased threshold for mobile touch
    let closestNode = null;
    let closestDistance = Infinity;

    for (const node of nodes) {
      const distance = raycaster.ray.distanceToPoint(node.position);
      if (distance < threshold && distance < closestDistance) {
        closestDistance = distance;
        closestNode = node;
      }
    }

    console.log('[TouchEventHandler] Node intersection check:', {
      clientX,
      clientY,
      normalizedX: x,
      normalizedY: y,
      closestNode: closestNode?.id,
      distance: closestDistance
    });

    return closestNode;
  }, [camera, raycaster, nodes]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const touch = event.touches[0];
    if (!touch) return;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    console.log('[TouchEventHandler] Touch start:', touchStartRef.current);
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const touchStart = touchStartRef.current;
    if (!touchStart) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const touchEnd = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    // Check if this was a tap (not a drag)
    const deltaX = Math.abs(touchEnd.x - touchStart.x);
    const deltaY = Math.abs(touchEnd.y - touchStart.y);
    const deltaTime = touchEnd.time - touchStart.time;

    const isTap = deltaX < 10 && deltaY < 10 && deltaTime < 300;

    console.log('[TouchEventHandler] Touch end:', {
      touchEnd,
      deltaX,
      deltaY,
      deltaTime,
      isTap
    });

    if (isTap) {
      const intersectedNode = getIntersectedNode(touchEnd.x, touchEnd.y);
      
      if (intersectedNode) {
        console.log('[TouchEventHandler] Node selected:', intersectedNode.id);
        onNodeSelect(intersectedNode.id, intersectedNode.position);
      } else {
        console.log('[TouchEventHandler] Background tapped - deselecting');
        onNodeDeselect();
      }
    }

    touchStartRef.current = null;
  }, [getIntersectedNode, onNodeSelect, onNodeDeselect]);

  const handleMouseClick = useCallback((event: React.MouseEvent) => {
    if (isCapacitorNative.current) return; // Skip mouse events in native environment

    event.preventDefault();
    event.stopPropagation();

    const intersectedNode = getIntersectedNode(event.clientX, event.clientY);
    
    if (intersectedNode) {
      console.log('[TouchEventHandler] Mouse click - Node selected:', intersectedNode.id);
      onNodeSelect(intersectedNode.id, intersectedNode.position);
    } else {
      console.log('[TouchEventHandler] Mouse click - Background clicked - deselecting');
      onNodeDeselect();
    }
  }, [getIntersectedNode, onNodeSelect, onNodeDeselect]);

  return (
    <group
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleMouseClick}
    >
      {children}
    </group>
  );
};
