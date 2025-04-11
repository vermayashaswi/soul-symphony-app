
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface EnergyAnimationProps {
  className?: string;
}

const EnergyAnimation: React.FC<EnergyAnimationProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
    >
      {/* Glowing center */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-24 h-24 rounded-full bg-cyan-300 blur-xl opacity-80"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white blur-md opacity-90"></div>
      </div>
      
      {/* User provided image with reduced opacity */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-50 z-0">
        <img 
          src="/lovable-uploads/fbca5601-f42c-41b3-94af-779d961a1d06.png" 
          alt="Energy silhouette" 
          className="w-full h-full object-contain"
        />
      </div>
      
      {/* Radiating pulses */}
      {[...Array(8)].map((_, index) => (
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
            width: 500, 
            height: 500, 
            x: -250, 
            y: -250, 
            opacity: 0,
            background: "radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(124,58,237,0.1) 50%, rgba(14,165,233,0.05) 100%)" 
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 4 + index * 0.5, 
            ease: "easeOut",
            delay: index * 0.7
          }}
        />
      ))}
      
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-violet-800/20 to-blue-900/20"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/20 via-purple-800/20 to-cyan-900/20"></div>
      
      {/* Additional smaller, faster pulses */}
      {[...Array(12)].map((_, index) => (
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
            width: 300, 
            height: 300, 
            x: -150, 
            y: -150, 
            opacity: 0,
            background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(186,230,253,0.1) 50%, rgba(125,211,252,0.05) 100%)" 
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 2 + index * 0.3, 
            ease: "easeOut",
            delay: index * 0.4
          }}
        />
      ))}
    </div>
  );
};

export default EnergyAnimation;
