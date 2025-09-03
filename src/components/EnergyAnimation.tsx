
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useStableAnimationCenter } from '@/hooks/useStableAnimationCenter';
import { useStableThemeColors } from '@/hooks/useStableThemeColors';
import { useAnimationReadiness } from '@/contexts/AnimationReadinessProvider';

interface EnergyAnimationProps {
  className?: string;
  fullScreen?: boolean;
  bottomNavOffset?: boolean;
}

const EnergyAnimation: React.FC<EnergyAnimationProps> = ({ 
  className, 
  fullScreen = false,
  bottomNavOffset = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isReady } = useAnimationReadiness();
  
  // Use stable hooks that prevent flickering during initialization
  const colors = useStableThemeColors();
  const animationCenter = useStableAnimationCenter(bottomNavOffset, 1.07);

  // Show static placeholder during initialization to prevent flickering
  if (!isReady) {
    return (
      <div 
        ref={containerRef}
        className={`absolute ${fullScreen ? 'fixed inset-0' : 'w-full h-full'} 
                   ${bottomNavOffset ? 'bottom-16' : 'bottom-0'} 
                   left-0 right-0 ${bottomNavOffset ? 'top-0' : 'top-0'} overflow-hidden opacity-70 z-0 ${className}`}
        style={{ pointerEvents: 'none' }}
      >
        {/* Static center glow during initialization */}
        <div 
          className="absolute z-10"
          style={{
            left: animationCenter.x,
            top: animationCenter.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div 
            className="w-32 h-32 rounded-full blur-3xl opacity-50 transition-opacity duration-500"
            style={{ backgroundColor: colors.pulse }}
          />
        </div>
        
        {/* Static background gradients */}
        <div 
          className="absolute inset-0 transition-opacity duration-500"
          style={{ 
            background: `linear-gradient(to bottom right, ${colors.main}10, ${colors.secondary}10, ${colors.tertiary}10)`
          }}
        />
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className={`absolute ${fullScreen ? 'fixed inset-0' : 'w-full h-full'} 
                 ${bottomNavOffset ? 'bottom-16' : 'bottom-0'} 
                 left-0 right-0 ${bottomNavOffset ? 'top-0' : 'top-0'} overflow-hidden opacity-70 z-0 ${className}`}
      style={{ pointerEvents: 'none' }} // Ensure the animation doesn't interfere with user interactions
    >
      {/* Glowing center with enhanced blur */}
      <div 
        className="absolute z-10"
        style={{
          left: animationCenter.x,
          top: animationCenter.y,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div 
          className="w-32 h-32 rounded-full blur-3xl opacity-70"
          style={{ backgroundColor: colors.pulse }}
        ></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white blur-md opacity-80"></div>
      </div>
      
      {/* Reduced radiating pulses for better performance */}
      {[...Array(8)].map((_, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            left: animationCenter.x,
            top: animationCenter.y,
            background: `radial-gradient(circle, ${colors.main} 0%, ${colors.secondary} 50%, ${colors.tertiary} 100%)`
          }}
          initial={{ 
            width: 40, 
            height: 40, 
            x: -20, 
            y: -20, 
            opacity: 0.8
          }}
          animate={{ 
            width: 1000, 
            height: 1000, 
            x: -500, 
            y: -500, 
            opacity: 0
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 6 + (index % 3) * 0.5, 
            ease: "easeOut",
            delay: index * 0.6,
            repeatDelay: 0.1
          }}
        />
      ))}
      
      {/* Enhanced background gradients with wider coverage */}
      <div 
        className="absolute inset-0"
        style={{ 
          background: `linear-gradient(to bottom right, ${colors.main}10, ${colors.secondary}10, ${colors.tertiary}10)`
        }}
      ></div>
      <div 
        className="absolute inset-0"
        style={{ 
          background: `linear-gradient(to top right, ${colors.secondary}10, ${colors.main}10, ${colors.tertiary}10)`
        }}
      ></div>
      
      {/* Reduced smaller pulses for better performance */}
      {[...Array(12)].map((_, index) => (
        <motion.div
          key={`small-${index}`}
          className="absolute rounded-full"
          style={{
            left: animationCenter.x,
            top: animationCenter.y,
            background: `radial-gradient(circle, rgba(255,255,255,0.8) 0%, ${colors.light} 50%, ${colors.tertiary} 100%)`
          }}
          initial={{ 
            width: 20, 
            height: 20, 
            x: -10, 
            y: -10, 
            opacity: 0.7
          }}
          animate={{ 
            width: 700, 
            height: 700, 
            x: -350, 
            y: -350, 
            opacity: 0
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 4 + (index % 5) * 0.3, 
            ease: "easeOut",
            delay: index * 0.4,
            repeatDelay: 0.05
          }}
        />
      ))}
      
      {/* Reduced particles for better performance */}
      {[...Array(20)].map((_, index) => (
        <motion.div
          key={`particle-${index}`}
          className="absolute rounded-full bg-white/80"
          style={{
            left: animationCenter.x,
            top: animationCenter.y
          }}
          initial={{ 
            width: 3, 
            height: 3, 
            x: -1.5, 
            y: -1.5, 
            opacity: 0.9
          }}
          animate={{ 
            x: -1.5 + (Math.random() * 800 - 400),
            y: -1.5 + (Math.random() * 800 - 400),
            opacity: 0
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 4 + Math.random() * 3,
            delay: index * 0.2,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
};

export default EnergyAnimation;
