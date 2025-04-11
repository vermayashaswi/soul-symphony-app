
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

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
  
  return (
    <div 
      ref={containerRef}
      className={`absolute ${fullScreen ? 'fixed inset-0' : 'w-full h-full'} 
                 ${bottomNavOffset ? 'bottom-16' : 'bottom-0'} 
                 left-0 right-0 top-0 overflow-hidden opacity-70 z-0 ${className}`}
      style={{ pointerEvents: 'none' }} // Ensure the animation doesn't interfere with user interactions
    >
      {/* Buddha image at center */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 w-24 h-24 flex items-center justify-center">
        <img 
          src="/buddha-meditation.png" 
          alt="Buddha Meditation" 
          className="w-full h-full object-contain opacity-90"
        />
      </div>
      
      {/* Glowing center with enhanced blur */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-5">
        <div className="w-32 h-32 rounded-full bg-cyan-300 blur-3xl opacity-70"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white blur-md opacity-80"></div>
      </div>
      
      {/* Expanded radiating pulses with staggered transitions */}
      {[...Array(15)].map((_, index) => (
        <motion.div
          key={index}
          className="absolute top-1/2 left-1/2 rounded-full"
          initial={{ 
            width: 40, 
            height: 40, 
            x: -20, 
            y: -20, 
            opacity: 0.8, 
            background: "radial-gradient(circle, rgba(139,92,246,0.6) 0%, rgba(124,58,237,0.4) 50%, rgba(14,165,233,0.2) 100%)" 
          }}
          animate={{ 
            width: 1000, 
            height: 1000, 
            x: -500, 
            y: -500, 
            opacity: 0,
            background: "radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(124,58,237,0.1) 50%, rgba(14,165,233,0.05) 100%)" 
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
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-violet-800/10 to-blue-900/10"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/10 via-purple-800/10 to-cyan-900/10"></div>
      
      {/* Additional smaller, faster pulses with improved timing */}
      {[...Array(24)].map((_, index) => (
        <motion.div
          key={`small-${index}`}
          className="absolute top-1/2 left-1/2 rounded-full"
          initial={{ 
            width: 20, 
            height: 20, 
            x: -10, 
            y: -10, 
            opacity: 0.7, 
            background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(186,230,253,0.5) 50%, rgba(125,211,252,0.3) 100%)" 
          }}
          animate={{ 
            width: 700, 
            height: 700, 
            x: -350, 
            y: -350, 
            opacity: 0,
            background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(186,230,253,0.1) 50%, rgba(125,211,252,0.05) 100%)" 
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
          className="absolute top-1/2 left-1/2 rounded-full bg-white/80"
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
