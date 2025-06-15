
import React from 'react';
import { motion } from 'framer-motion';

const SplashBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* High contrast gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-800 to-purple-700" />
      
      {/* Overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-purple-900/50 via-transparent to-purple-600/30" />
      
      {/* Animated gradient orbs with higher contrast */}
      <motion.div
        className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-purple-400/40 to-purple-500/30 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.3, 1],
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] bg-gradient-to-tl from-purple-300/30 to-purple-400/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          x: [0, -60, 0],
          y: [0, 40, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3
        }}
      />
      
      {/* Floating particles with better visibility */}
      {[...Array(15)].map((_, index) => (
        <motion.div
          key={index}
          className="absolute w-3 h-3 bg-purple-200/60 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            borderRadius: index % 3 === 0 ? '50%' : index % 3 === 1 ? '0%' : '25%',
          }}
          animate={{
            y: [-30, -120, -30],
            x: [-15, 15, -15],
            rotate: [0, 180, 360],
            scale: [0.3, 1.2, 0.3],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 20 + Math.random() * 15,
            repeat: Infinity,
            delay: Math.random() * 8,
            ease: "easeInOut"
          }}
        />
      ))}
      
      {/* Enhanced wave pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path
            d="M0,60 Q25,40 50,60 T100,60 L100,100 L0,100 Z"
            fill="url(#enhancedWaveGradient)"
            animate={{
              d: [
                "M0,60 Q25,40 50,60 T100,60 L100,100 L0,100 Z",
                "M0,70 Q25,50 50,70 T100,70 L100,100 L0,100 Z",
                "M0,60 Q25,40 50,60 T100,60 L100,100 L0,100 Z"
              ]
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <defs>
            <linearGradient id="enhancedWaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#C4B5FD" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {/* Central radial glow with higher intensity */}
      <motion.div
        className="absolute top-1/2 left-1/2 w-[40rem] h-[40rem] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, rgba(139, 92, 246, 0.15) 40%, transparent 80%)',
        }}
        animate={{
          scale: [1, 1.4, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  );
};

export default SplashBackground;
