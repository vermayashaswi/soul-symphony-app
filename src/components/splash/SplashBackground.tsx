
import React from 'react';
import { motion } from 'framer-motion';

const SplashBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Gradient orbs */}
      <motion.div
        className="absolute -top-20 -left-20 w-80 h-80 bg-gradient-to-br from-purple-200 to-purple-300 rounded-full opacity-50 blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 30, 0],
          y: [0, -20, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        className="absolute -bottom-20 -right-20 w-96 h-96 bg-gradient-to-tl from-purple-100 to-purple-200 rounded-full opacity-40 blur-3xl"
        animate={{
          scale: [1, 1.1, 1],
          x: [0, -40, 0],
          y: [0, 20, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      />
      
      {/* Floating geometric shapes */}
      {[...Array(12)].map((_, index) => (
        <motion.div
          key={index}
          className="absolute w-4 h-4 bg-purple-200 opacity-30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            borderRadius: index % 3 === 0 ? '50%' : index % 3 === 1 ? '0%' : '25%',
          }}
          animate={{
            y: [-20, -80, -20],
            x: [-10, 10, -10],
            rotate: [0, 180, 360],
            scale: [0.5, 1, 0.5],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 15 + Math.random() * 10,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut"
          }}
        />
      ))}
      
      {/* Subtle wave pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path
            d="M0,50 Q25,30 50,50 T100,50 L100,100 L0,100 Z"
            fill="url(#waveGradient)"
            animate={{
              d: [
                "M0,50 Q25,30 50,50 T100,50 L100,100 L0,100 Z",
                "M0,60 Q25,40 50,60 T100,60 L100,100 L0,100 Z",
                "M0,50 Q25,30 50,50 T100,50 L100,100 L0,100 Z"
              ]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#DDD6FE" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {/* Radial glow effect */}
      <motion.div
        className="absolute top-1/2 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  );
};

export default SplashBackground;
