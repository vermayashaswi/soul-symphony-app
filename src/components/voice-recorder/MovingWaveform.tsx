
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface MovingWaveformProps {
  isRecording: boolean;
  audioLevel: number;
}

export function MovingWaveform({ isRecording, audioLevel }: MovingWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);
  const animationRef = useRef<number>();
  const barDataRef = useRef<number[]>([]);
  
  const barCount = 50; // Number of visible bars
  const barWidth = 2; // Width of each bar in pixels
  const barSpacing = 1; // Space between bars
  
  // Initialize bar heights
  useEffect(() => {
    barDataRef.current = Array(barCount * 2).fill(0).map(() => Math.random() * 0.3 + 0.1);
  }, []);
  
  // Animation loop for moving bars
  useEffect(() => {
    if (!isRecording) return;
    
    let startTime = Date.now();
    const moveSpeed = 2; // pixels per frame
    
    const animate = () => {
      if (!containerRef.current) return;
      
      const currentTime = Date.now();
      const deltaTime = currentTime - startTime;
      startTime = currentTime;
      
      // Move bars to the left
      const moveDistance = moveSpeed * (deltaTime / 16); // Normalize to 60fps
      
      barsRef.current.forEach((bar, index) => {
        if (!bar) return;
        
        const currentX = parseFloat(bar.style.transform.replace('translateX(', '').replace('px)', '')) || (index * (barWidth + barSpacing));
        const newX = currentX - moveDistance;
        
        // Reset bar position when it moves off screen
        if (newX < -(barWidth + barSpacing)) {
          const resetX = barCount * (barWidth + barSpacing);
          bar.style.transform = `translateX(${resetX}px)`;
          
          // Generate new random height with audio influence
          const baseHeight = Math.random() * 20 + 5;
          const audioInfluence = audioLevel * 30;
          const finalHeight = Math.min(50, baseHeight + audioInfluence);
          
          bar.style.height = `${finalHeight}px`;
        } else {
          bar.style.transform = `translateX(${newX}px)`;
          
          // Occasionally update height based on audio level for more dynamic feel
          if (Math.random() < 0.1) {
            const currentHeight = parseFloat(bar.style.height.replace('px', '')) || 10;
            const targetHeight = Math.random() * 15 + 5 + (audioLevel * 25);
            const newHeight = currentHeight + (targetHeight - currentHeight) * 0.1;
            bar.style.height = `${Math.min(50, Math.max(3, newHeight))}px`;
          }
        }
      });
      
      if (isRecording) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, audioLevel]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className="relative w-full h-12 overflow-hidden bg-transparent flex items-end"
      style={{ 
        maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)'
      }}
    >
      {Array.from({ length: barCount }).map((_, index) => (
        <div
          key={index}
          ref={el => el && (barsRef.current[index] = el)}
          className="absolute bg-primary rounded-t-sm opacity-80 transition-all duration-75"
          style={{
            width: `${barWidth}px`,
            height: `${Math.random() * 15 + 5}px`,
            left: 0,
            bottom: 0,
            transform: `translateX(${index * (barWidth + barSpacing)}px)`,
            background: isRecording 
              ? 'hsl(var(--primary))' 
              : 'hsl(var(--muted-foreground))'
          }}
        />
      ))}
      
      {/* Gradient overlay for smooth edges */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-background/20 via-transparent to-background/20" />
    </div>
  );
}
