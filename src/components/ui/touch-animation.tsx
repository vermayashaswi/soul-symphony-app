
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

export const TouchAnimation = () => {
  const [touchPoints, setTouchPoints] = useState<TouchPoint[]>([]);
  
  useEffect(() => {
    // Touch start event handler
    const handleTouch = (e: TouchEvent | MouseEvent) => {
      const points: TouchPoint[] = [];
      
      if ('touches' in e) {
        // Touch events (mobile)
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          points.push({
            id: touch.identifier,
            x: touch.clientX,
            y: touch.clientY,
            timestamp: Date.now()
          });
        }
      } else {
        // Mouse events (desktop)
        points.push({
          id: Date.now(),
          x: e.clientX,
          y: e.clientY,
          timestamp: Date.now()
        });
      }
      
      setTouchPoints(prev => [...prev, ...points]);
    };
    
    // Add event listeners
    window.addEventListener('touchstart', handleTouch);
    window.addEventListener('mousedown', handleTouch);
    
    // Clean up function
    return () => {
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('mousedown', handleTouch);
    };
  }, []);
  
  // Remove touch points after animation
  useEffect(() => {
    if (touchPoints.length === 0) return;
    
    const now = Date.now();
    const timeoutId = setTimeout(() => {
      setTouchPoints(prev => prev.filter(point => now - point.timestamp < 800));
    }, 800); // Match the animation duration
    
    return () => clearTimeout(timeoutId);
  }, [touchPoints]);
  
  return (
    <>
      {touchPoints.map((point) => (
        <div
          key={`${point.id}-${point.timestamp}`}
          className={cn(
            "touch-ripple absolute rounded-full pointer-events-none",
            "animate-ripple opacity-70 bg-theme/30"
          )}
          style={{
            left: point.x - 20, // Center the ripple on the touch point
            top: point.y - 20,  // Center the ripple on the touch point
            width: '40px',
            height: '40px',
          }}
        />
      ))}
    </>
  );
};
