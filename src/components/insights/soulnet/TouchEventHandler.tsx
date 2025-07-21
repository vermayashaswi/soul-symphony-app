
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface TouchEventHandlerProps {
  onNodeSelect: (nodeId: string | null) => void;
  nodes: Array<{
    id: string;
    position: [number, number, number];
    type: 'entity' | 'emotion';
  }>;
  enabled: boolean;
}

export const TouchEventHandler: React.FC<TouchEventHandlerProps> = ({
  onNodeSelect,
  nodes,
  enabled
}) => {
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const touchStartTime = useRef(0);
  const touchStartPosition = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragThreshold = 10; // pixels
  const tapTimeThreshold = 500; // milliseconds

  // Enhanced raycasting with mobile-optimized settings
  const setupRaycaster = useCallback(() => {
    raycaster.current.params.Points = { threshold: 0.3 };
    raycaster.current.params.Line = { threshold: 0.3 };
    raycaster.current.far = 1000;
    raycaster.current.near = 0.1;
  }, []);

  useEffect(() => {
    setupRaycaster();
  }, [setupRaycaster]);

  // Convert screen coordinates to normalized device coordinates
  const getMousePosition = useCallback((clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return { x, y };
  }, [gl.domElement]);

  // Manual raycasting to find intersected nodes
  const performRaycast = useCallback((screenX: number, screenY: number): string | null => {
    const mousePos = getMousePosition(screenX, screenY);
    mouse.current.set(mousePos.x, mousePos.y);
    
    raycaster.current.setFromCamera(mouse.current, camera);
    
    // Check intersection with each node manually
    for (const node of nodes) {
      const nodePosition = new THREE.Vector3(...node.position);
      const nodeRadius = node.type === 'entity' ? 0.8 : 1.15; // Match node geometry sizes
      
      // Calculate distance from ray to node center
      const ray = raycaster.current.ray;
      const distance = ray.distanceToPoint(nodePosition);
      
      if (distance <= nodeRadius) {
        console.log(`[TouchEventHandler] Node ${node.id} intersected at distance ${distance}`);
        return node.id;
      }
    }
    
    return null;
  }, [camera, nodes, getMousePosition]);

  // Handle touch start
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!enabled || event.touches.length !== 1) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const touch = event.touches[0];
    touchStartTime.current = Date.now();
    touchStartPosition.current = { x: touch.clientX, y: touch.clientY };
    isDragging.current = false;
    
    console.log('[TouchEventHandler] Touch start detected', {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: touchStartTime.current
    });
  }, [enabled]);

  // Handle touch move
  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!enabled || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosition.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosition.current.y);
    
    if (deltaX > dragThreshold || deltaY > dragThreshold) {
      isDragging.current = true;
      console.log('[TouchEventHandler] Touch drag detected', { deltaX, deltaY });
    }
  }, [enabled, dragThreshold]);

  // Handle touch end
  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!enabled) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime.current;
    
    console.log('[TouchEventHandler] Touch end detected', {
      duration: touchDuration,
      isDragging: isDragging.current,
      threshold: tapTimeThreshold
    });
    
    // Only process as tap if it's not a drag and within time threshold
    if (!isDragging.current && touchDuration < tapTimeThreshold) {
      const intersectedNodeId = performRaycast(
        touchStartPosition.current.x,
        touchStartPosition.current.y
      );
      
      console.log('[TouchEventHandler] Tap detected, intersected node:', intersectedNodeId);
      
      if (intersectedNodeId) {
        // Add haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        onNodeSelect(intersectedNodeId);
      } else {
        onNodeSelect(null);
      }
    }
    
    // Reset state
    isDragging.current = false;
    touchStartTime.current = 0;
  }, [enabled, tapTimeThreshold, performRaycast, onNodeSelect]);

  // Handle mouse events for desktop fallback
  const handleMouseClick = useCallback((event: MouseEvent) => {
    if (!enabled) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    console.log('[TouchEventHandler] Mouse click detected', {
      x: event.clientX,
      y: event.clientY
    });
    
    const intersectedNodeId = performRaycast(event.clientX, event.clientY);
    
    if (intersectedNodeId) {
      onNodeSelect(intersectedNodeId);
    } else {
      onNodeSelect(null);
    }
  }, [enabled, performRaycast, onNodeSelect]);

  // Set up event listeners
  useEffect(() => {
    const canvas = gl.domElement;
    
    if (enabled) {
      // Touch events
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      
      // Mouse events for desktop fallback
      canvas.addEventListener('click', handleMouseClick, { passive: false });
      
      console.log('[TouchEventHandler] Event listeners added');
    }
    
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('click', handleMouseClick);
      console.log('[TouchEventHandler] Event listeners removed');
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseClick, gl.domElement]);

  return null; // This component doesn't render anything
};

export default TouchEventHandler;
