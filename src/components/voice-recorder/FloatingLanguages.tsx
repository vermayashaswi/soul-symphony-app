
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MultilingualTextProps, getLanguageSettings } from './MultilingualTextAnimation';

interface FloatingLanguagesProps {
  size?: 'sm' | 'md' | 'lg';
  contained?: boolean;
}

export default function FloatingLanguages({ size = 'md', contained = false }: FloatingLanguagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFramesRef = useRef<number[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const mountedRef = useRef(true);
  
  // Map size to number of languages
  const languageCount = size === 'sm' ? 10 : size === 'md' ? 16 : 24;
  
  // Get language settings
  const languages = getLanguageSettings().slice(0, languageCount);
  
  // Cleanup function to prevent memory leaks and DOM errors
  const cleanup = () => {
    // Cancel all animation frames
    animationFramesRef.current.forEach(id => {
      cancelAnimationFrame(id);
    });
    animationFramesRef.current = [];
    
    // Clear all timeouts
    timeoutsRef.current.forEach(id => {
      clearTimeout(id);
    });
    timeoutsRef.current = [];
  };
  
  // Set up mount tracking and cleanup
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);
  
  // Generate random position within container
  const getRandomPosition = (i: number): { x: number, y: number } => {
    if (!containerRef.current) {
      return { x: 0, y: 0 };
    }
    
    const containerWidth = contained ? containerRef.current.offsetWidth : window.innerWidth;
    const containerHeight = contained ? containerRef.current.offsetHeight : window.innerHeight;
    
    // Generate a spiraling outward pattern to reduce overlap
    const angle = i * 0.6;
    const radius = Math.sqrt(i) * 30;
    
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    let x = centerX + radius * Math.cos(angle);
    let y = centerY + radius * Math.sin(angle);
    
    // Constrain within boundaries
    const padding = 20;
    x = Math.max(padding, Math.min(containerWidth - padding, x));
    y = Math.max(padding, Math.min(containerHeight - padding, y));
    
    return { x, y };
  };
  
  // Create an animation variant for each language
  const languageItems = languages.map((lang, i) => {
    const position = getRandomPosition(i);
    const scale = 0.6 + Math.random() * 0.4; // Random size between 0.6 and 1.0
    const opacity = 0.7 + Math.random() * 0.3; // Random opacity between 0.7 and 1.0
    
    return (
      <motion.div
        key={`lang-${i}-${lang}`}
        className="absolute text-muted-foreground pointer-events-none"
        initial={{ 
          opacity: 0,
          x: position.x,
          y: position.y,
          scale: scale * 0.5
        }}
        animate={{ 
          opacity,
          x: position.x,
          y: position.y,
          scale
        }}
        transition={{ 
          duration: 1.5 + Math.random() * 1.0,
          delay: i * 0.1,
          ease: "easeOut"
        }}
        style={{
          fontSize: size === 'sm' ? '16px' : size === 'md' ? '24px' : '32px',
          fontWeight: 500
        }}
        // Add safety check for animations
        onAnimationStart={() => {
          // Safety check to prevent errors during unmount
          if (!mountedRef.current) {
            cleanup();
          }
        }}
      >
        {lang}
      </motion.div>
    );
  });
  
  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
    >
      {languageItems}
    </div>
  );
}
