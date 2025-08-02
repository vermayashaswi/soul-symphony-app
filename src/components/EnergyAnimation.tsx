
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';

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
  // Defensive hook usage to prevent runtime errors during app initialization
  let colorTheme = 'Default';
  let customColor = '#3b82f6';
  
  try {
    const themeData = useTheme();
    colorTheme = themeData.colorTheme;
    customColor = themeData.customColor || '#3b82f6';
  } catch (error) {
    // ThemeProvider not ready, using defaults
  }
  
  // Determine the base color to use based on the user's selected theme
  const getThemeColors = () => {
    switch(colorTheme) {
      case 'Calm':
        return {
          main: 'rgba(139,92,246,0.6)',
          secondary: 'rgba(124,58,237,0.4)',
          tertiary: 'rgba(109,40,217,0.2)',
          pulse: 'rgba(139,92,246,0.8)',
          light: 'rgba(186,230,253,0.5)'
        };
      case 'Energy':
        return {
          main: 'rgba(245,158,11,0.6)',
          secondary: 'rgba(234,88,12,0.4)',
          tertiary: 'rgba(194,65,12,0.2)',
          pulse: 'rgba(245,158,11,0.8)',
          light: 'rgba(254,240,138,0.5)'
        };
      case 'Soothing':
        return {
          main: 'rgba(255,222,226,0.6)',
          secondary: 'rgba(248,180,184,0.4)',
          tertiary: 'rgba(244,114,182,0.2)',
          pulse: 'rgba(244,114,182,0.8)',
          light: 'rgba(253,242,248,0.5)'
        };
      case 'Focus':
        return {
          main: 'rgba(16,185,129,0.6)',
          secondary: 'rgba(5,150,105,0.4)',
          tertiary: 'rgba(6,95,70,0.2)',
          pulse: 'rgba(16,185,129,0.8)',
          light: 'rgba(209,250,229,0.5)'
        };
      case 'Custom':
        // For custom color, we need to convert hex to rgba
        const hexToRgba = (hex: string, alpha: number): string => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r},${g},${b},${alpha})`;
        };
        
        return {
          main: hexToRgba(customColor, 0.6),
          secondary: hexToRgba(customColor, 0.4),
          tertiary: hexToRgba(customColor, 0.2),
          pulse: hexToRgba(customColor, 0.8),
          light: 'rgba(255,255,255,0.5)' // Default light for custom
        };
      default: // Default case - including the 'Default' theme which is blue
        return {
          main: 'rgba(59,130,246,0.6)',
          secondary: 'rgba(37,99,235,0.4)',
          tertiary: 'rgba(29,78,216,0.2)',
          pulse: 'rgba(59,130,246,0.8)',
          light: 'rgba(219,234,254,0.5)'
        };
    }
  };
  
  const colors = getThemeColors();
  
  return (
    <div 
      ref={containerRef}
      className={`absolute ${fullScreen ? 'fixed inset-0' : 'w-full h-full'} 
                 ${bottomNavOffset ? 'bottom-16' : 'bottom-0'} 
                 left-0 right-0 ${bottomNavOffset ? 'top-0' : 'top-0'} overflow-hidden opacity-70 z-0 ${className}`}
      style={{ pointerEvents: 'none' }} // Ensure the animation doesn't interfere with user interactions
    >
      {/* Glowing center with enhanced blur */}
      <div className={`absolute left-1/2 transform -translate-x-1/2 ${bottomNavOffset ? 'top-1/2 -translate-y-8' : 'top-1/2 -translate-y-1/2'} z-10`}>
        <div 
          className="w-32 h-32 rounded-full blur-3xl opacity-70"
          style={{ backgroundColor: colors.pulse }}
        ></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white blur-md opacity-80"></div>
      </div>
      
      {/* Expanded radiating pulses with staggered transitions */}
      {[...Array(15)].map((_, index) => (
        <motion.div
          key={index}
          className={`absolute left-1/2 rounded-full ${bottomNavOffset ? 'top-1/2' : 'top-1/2'}`}
          style={{
            transform: bottomNavOffset ? 'translateY(-32px)' : undefined,
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
      
      {/* Additional smaller, faster pulses with improved timing */}
      {[...Array(24)].map((_, index) => (
        <motion.div
          key={`small-${index}`}
          className={`absolute left-1/2 rounded-full ${bottomNavOffset ? 'top-1/2' : 'top-1/2'}`}
          style={{
            transform: bottomNavOffset ? 'translateY(-32px)' : undefined,
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
      
      {/* Ultra-small particles with random paths for added fluidity */}
      {[...Array(40)].map((_, index) => (
        <motion.div
          key={`particle-${index}`}
          className={`absolute left-1/2 rounded-full bg-white/80 ${bottomNavOffset ? 'top-1/2' : 'top-1/2'}`}
          style={{ transform: bottomNavOffset ? 'translateY(-32px)' : undefined }}
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
