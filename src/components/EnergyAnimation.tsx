import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';

interface EnergyAnimationProps {
  className?: string;
  fullScreen?: boolean;
  bottomNavOffset?: boolean;
}

// WebView detection utility
const isWebView = (): boolean => {
  try {
    const userAgent = navigator.userAgent;
    return userAgent.includes('wv') || 
           userAgent.includes('WebView') || 
           window.location.protocol === 'file:' ||
           (window as any).AndroidInterface !== undefined ||
           document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
  } catch {
    return false;
  }
};

const EnergyAnimation: React.FC<EnergyAnimationProps> = ({ 
  className, 
  fullScreen = false,
  bottomNavOffset = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { colorTheme, customColor } = useTheme();
  
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
  
  // WebView-specific styling and containment
  useEffect(() => {
    if (isWebView() && containerRef.current) {
      const container = containerRef.current;
      
      // Apply WebView-specific containment styles
      container.style.overflow = 'hidden';
      container.style.contain = 'layout style paint';
      container.style.isolation = 'isolate';
      container.style.backfaceVisibility = 'hidden';
      container.style.webkitBackfaceVisibility = 'hidden';
      container.style.transform = 'translate3d(0, 0, 0)';
      container.style.webkitTransform = 'translate3d(0, 0, 0)';
      
      // Reduce animation intensity for WebView
      container.style.opacity = '0.5';
    }
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className={`absolute ${fullScreen ? 'fixed inset-0' : 'w-full h-full'} 
                 ${bottomNavOffset ? 'bottom-16' : 'bottom-0'} 
                 left-0 right-0 top-0 overflow-hidden z-0 ${className}`}
      style={{ 
        pointerEvents: 'none',
        opacity: isWebView() ? '0.4' : '0.7', // Reduced opacity for WebView
        contain: isWebView() ? 'layout style paint' : 'none',
        isolation: isWebView() ? 'isolate' : 'auto',
        backfaceVisibility: isWebView() ? 'hidden' : 'visible',
        WebkitBackfaceVisibility: isWebView() ? 'hidden' : 'visible'
      }}
    >
      {/* Glowing center with enhanced blur */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <div 
          className="w-32 h-32 rounded-full blur-3xl opacity-70"
          style={{ backgroundColor: colors.pulse }}
        ></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white blur-md opacity-80"></div>
      </div>
      
      {/* Reduced number of pulses for WebView performance */}
      {[...Array(isWebView() ? 8 : 15)].map((_, index) => (
        <motion.div
          key={index}
          className="absolute top-1/2 left-1/2 rounded-full"
          initial={{ 
            width: 40, 
            height: 40, 
            x: -20, 
            y: -20, 
            opacity: 0.8
          }}
          animate={{ 
            width: isWebView() ? 600 : 1000, 
            height: isWebView() ? 600 : 1000, 
            x: isWebView() ? -300 : -500, 
            y: isWebView() ? -300 : -500, 
            opacity: 0
          }}
          style={{
            background: `radial-gradient(circle, ${colors.main} 0%, ${colors.secondary} 50%, ${colors.tertiary} 100%)`,
            contain: isWebView() ? 'layout style paint' : 'none'
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
      
      {/* Enhanced background gradients with containment */}
      <div 
        className="absolute inset-0"
        style={{ 
          background: `linear-gradient(to bottom right, ${colors.main}10, ${colors.secondary}10, ${colors.tertiary}10)`,
          contain: isWebView() ? 'layout style paint' : 'none'
        }}
      ></div>
      <div 
        className="absolute inset-0"
        style={{ 
          background: `linear-gradient(to top right, ${colors.secondary}10, ${colors.main}10, ${colors.tertiary}10)`,
          contain: isWebView() ? 'layout style paint' : 'none'
        }}
      ></div>
      
      {/* Reduce particle count for WebView */}
      {[...Array(isWebView() ? 12 : 24)].map((_, index) => (
        <motion.div
          key={`small-${index}`}
          className="absolute top-1/2 left-1/2 rounded-full"
          initial={{ 
            width: 20, 
            height: 20, 
            x: -10, 
            y: -10, 
            opacity: 0.7
          }}
          animate={{ 
            width: isWebView() ? 400 : 700, 
            height: isWebView() ? 400 : 700, 
            x: isWebView() ? -200 : -350, 
            y: isWebView() ? -200 : -350, 
            opacity: 0
          }}
          style={{
            background: `radial-gradient(circle, rgba(255,255,255,0.8) 0%, ${colors.light} 50%, ${colors.tertiary} 100%)`,
            contain: isWebView() ? 'layout style paint' : 'none'
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
      
      {/* Significantly reduce ultra-small particles for WebView */}
      {[...Array(isWebView() ? 15 : 40)].map((_, index) => (
        <motion.div
          key={`particle-${index}`}
          className="absolute top-1/2 left-1/2 rounded-full bg-white/80"
          initial={{ 
            width: 3, 
            height: 3, 
            x: -1.5, 
            y: -1.5, 
            opacity: 0.9
          }}
          animate={{ 
            x: -1.5 + (Math.random() * (isWebView() ? 400 : 800) - (isWebView() ? 200 : 400)),
            y: -1.5 + (Math.random() * (isWebView() ? 400 : 800) - (isWebView() ? 200 : 400)),
            opacity: 0
          }}
          style={{
            contain: isWebView() ? 'layout style paint' : 'none'
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
