
import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

const AnimatedLogo = () => {
  const [currentPhase, setCurrentPhase] = useState<'letters' | 'breathing' | 'shimmer'>('letters');
  const controls = useAnimation();

  useEffect(() => {
    const runAnimation = async () => {
      // Phase 1: Letter-by-letter animation (0-2s)
      setCurrentPhase('letters');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Phase 2: Breathing effect (2-3s)
      setCurrentPhase('breathing');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Phase 3: Shimmer effect (3-4s)
      setCurrentPhase('shimmer');
    };

    runAnimation();
  }, []);

  const letterVariants = {
    hidden: { 
      opacity: 0, 
      y: 20,
      scale: 0.8
    },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: i * 0.2,
        duration: 0.6,
        ease: "easeOut"
      }
    })
  };

  const breathingVariants = {
    breathe: {
      scale: [1, 1.1, 1],
      transition: {
        duration: 2,
        ease: "easeInOut",
        repeat: 1
      }
    }
  };

  const shimmerVariants = {
    shimmer: {
      background: [
        "linear-gradient(90deg, #7C3AED 0%, #A855F7 50%, #7C3AED 100%)",
        "linear-gradient(90deg, #A855F7 0%, #DDD6FE 50%, #A855F7 100%)",
        "linear-gradient(90deg, #DDD6FE 0%, #FFFFFF 50%, #DDD6FE 100%)",
        "linear-gradient(90deg, #A855F7 0%, #7C3AED 50%, #A855F7 100%)"
      ],
      transition: {
        duration: 1,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="text-6xl md:text-8xl font-bold flex items-center space-x-1">
        {/* S */}
        <motion.span
          custom={0}
          initial="hidden"
          animate="visible"
          variants={letterVariants}
          className="text-purple-600"
        >
          S
        </motion.span>
        
        {/* O */}
        <motion.span
          custom={1}
          initial="hidden"
          animate={currentPhase === 'breathing' ? 'breathe' : 'visible'}
          variants={currentPhase === 'breathing' ? breathingVariants : letterVariants}
          className="text-purple-500"
        >
          O
        </motion.span>
        
        {/* U with special smiley design */}
        <motion.div
          custom={2}
          initial="hidden"
          animate="visible"
          variants={letterVariants}
          className="relative"
        >
          <div className="w-16 h-16 md:w-24 md:h-24 relative flex items-center justify-center">
            {/* U shape border */}
            <div className="w-full h-3/4 border-4 border-purple-400 rounded-b-full border-t-0 flex items-end pb-1">
              {/* Eyes */}
              <span className="absolute top-[25%] left-[25%] w-[12%] h-[12%] rounded-full bg-purple-400"></span>
              <span className="absolute top-[25%] right-[25%] w-[12%] h-[12%] rounded-full bg-purple-400"></span>
            </div>
          </div>
        </motion.div>
        
        {/* L */}
        <motion.span
          custom={3}
          initial="hidden"
          animate="visible"
          variants={letterVariants}
          className="text-purple-500"
        >
          L
        </motion.span>
        
        {/* O */}
        <motion.span
          custom={4}
          initial="hidden"
          animate={currentPhase === 'shimmer' ? 'shimmer' : 'visible'}
          variants={currentPhase === 'shimmer' ? shimmerVariants : letterVariants}
          className="text-purple-600"
          style={{
            backgroundClip: currentPhase === 'shimmer' ? 'text' : 'unset',
            WebkitBackgroundClip: currentPhase === 'shimmer' ? 'text' : 'unset',
            color: currentPhase === 'shimmer' ? 'transparent' : '#7C3AED'
          }}
        >
          O
        </motion.span>
      </div>
      
      {/* Floating particles around logo */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, index) => (
          <motion.div
            key={index}
            className="absolute w-2 h-2 bg-purple-300 rounded-full opacity-60"
            style={{
              left: `${20 + Math.random() * 60}%`,
              top: `${30 + Math.random() * 40}%`,
            }}
            animate={{
              y: [-10, -30, -10],
              opacity: [0.3, 0.8, 0.3],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default AnimatedLogo;
