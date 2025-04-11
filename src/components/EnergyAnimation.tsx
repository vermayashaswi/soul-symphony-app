
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface EnergyAnimationProps {
  className?: string;
  fullScreen?: boolean;
}

const EnergyAnimation: React.FC<EnergyAnimationProps> = ({ className, fullScreen = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div 
      ref={containerRef}
      className={`relative ${fullScreen ? 'fixed inset-0 z-0' : 'w-full h-full'} overflow-hidden ${className}`}
    >
      {/* Glowing center with enhanced blur */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
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
            width: 800, 
            height: 800, 
            x: -400, 
            y: -400, 
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
            width: 500, 
            height: 500, 
            x: -250, 
            y: -250, 
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
      {[...Array(30)].map((_, index) => (
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
            x: -1.5 + (Math.random() * 600 - 300),
            y: -1.5 + (Math.random() * 600 - 300),
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
