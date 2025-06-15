
import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

const AnimatedLogo = () => {
  const [currentPhase, setCurrentPhase] = useState<'letters' | 'smiley' | 'breathing' | 'complete'>('letters');
  const smileyControls = useAnimation();

  useEffect(() => {
    const runAnimation = async () => {
      // Phase 1: Letter-by-letter animation (0-2s)
      setCurrentPhase('letters');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Phase 2: Enhanced smiley animation (2-3.5s)
      setCurrentPhase('smiley');
      await smileyControls.start({
        scale: [1, 1.4, 1.1, 1.3, 1],
        rotate: [0, 15, -10, 8, 0],
        transition: { duration: 1.5, ease: "easeInOut" }
      });
      
      // Phase 3: Breathing effect (3.5-4.5s)
      setCurrentPhase('breathing');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Phase 4: Complete (4.5s+)
      setCurrentPhase('complete');
    };

    runAnimation();
  }, [smileyControls]);

  const letterVariants = {
    hidden: { 
      opacity: 0, 
      y: 30,
      scale: 0.7,
      rotateX: -90
    },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: {
        delay: i * 0.25,
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94] // Custom bezier for smooth entrance
      }
    })
  };

  const breathingVariants = {
    breathe: {
      scale: [1, 1.15, 1],
      filter: [
        "drop-shadow(0 0 0px rgba(168, 85, 247, 0.5))",
        "drop-shadow(0 0 20px rgba(168, 85, 247, 0.8))",
        "drop-shadow(0 0 0px rgba(168, 85, 247, 0.5))"
      ],
      transition: {
        duration: 2,
        ease: "easeInOut",
        repeat: 1
      }
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="text-7xl md:text-9xl font-bold flex items-center space-x-2">
        {/* S */}
        <motion.span
          custom={0}
          initial="hidden"
          animate="visible"
          variants={letterVariants}
          className="text-white drop-shadow-lg"
        >
          S
        </motion.span>
        
        {/* O */}
        <motion.span
          custom={1}
          initial="hidden"
          animate={currentPhase === 'breathing' ? 'breathe' : 'visible'}
          variants={currentPhase === 'breathing' ? breathingVariants : letterVariants}
          className="text-purple-100 drop-shadow-lg"
        >
          O
        </motion.span>
        
        {/* U with enhanced smiley design and animation */}
        <motion.div
          custom={2}
          initial="hidden"
          animate="visible"
          variants={letterVariants}
          className="relative"
        >
          <motion.div 
            className="w-20 h-20 md:w-28 md:h-28 relative flex items-center justify-center"
            animate={smileyControls}
          >
            {/* U shape border with enhanced glow effect */}
            <motion.div 
              className="w-full h-3/4 border-4 border-purple-100 rounded-b-full border-t-0 flex items-end pb-[3px] drop-shadow-lg"
              animate={currentPhase === 'smiley' ? {
                borderColor: ['rgb(196, 181, 253)', 'rgb(255, 255, 255)', 'rgb(196, 181, 253)'],
                boxShadow: [
                  '0 0 0px rgba(196, 181, 253, 0.5)',
                  '0 0 25px rgba(255, 255, 255, 0.8)',
                  '0 0 0px rgba(196, 181, 253, 0.5)'
                ],
                transition: { duration: 1.5, ease: "easeInOut" }
              } : {}}
            >
              {/* Enhanced animated eyes with sparkle effect */}
              <motion.span 
                className="absolute top-[20%] left-[25%] w-[15%] h-[15%] rounded-full bg-purple-100"
                animate={currentPhase === 'smiley' ? {
                  scale: [1, 0.2, 1.2, 1],
                  backgroundColor: ['rgb(196, 181, 253)', 'rgb(255, 255, 255)', 'rgb(196, 181, 253)'],
                  transition: { duration: 1.5, delay: 0.2 }
                } : {}}
              />
              <motion.span 
                className="absolute top-[20%] right-[25%] w-[15%] h-[15%] rounded-full bg-purple-100"
                animate={currentPhase === 'smiley' ? {
                  scale: [1, 0.2, 1.2, 1],
                  backgroundColor: ['rgb(196, 181, 253)', 'rgb(255, 255, 255)', 'rgb(196, 181, 253)'],
                  transition: { duration: 1.5, delay: 0.25 }
                } : {}}
              />
              
              {/* Enhanced smile line with glow animation */}
              {currentPhase === 'smiley' && (
                <motion.div
                  className="absolute bottom-[15%] left-1/2 transform -translate-x-1/2"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: [0, 1.3, 1], 
                    opacity: [0, 1, 1],
                    transition: { delay: 0.4, duration: 1.1 }
                  }}
                >
                  <motion.div 
                    className="w-8 h-4 border-b-2 border-purple-100 rounded-b-full"
                    animate={{
                      borderColor: ['rgb(196, 181, 253)', 'rgb(255, 255, 255)', 'rgb(196, 181, 253)'],
                      filter: [
                        'drop-shadow(0 0 0px rgba(255, 255, 255, 0.5))',
                        'drop-shadow(0 0 15px rgba(255, 255, 255, 0.8))',
                        'drop-shadow(0 0 0px rgba(255, 255, 255, 0.5))'
                      ],
                      transition: { duration: 1.5, ease: "easeInOut" }
                    }}
                  />
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
        
        {/* L */}
        <motion.span
          custom={3}
          initial="hidden"
          animate="visible"
          variants={letterVariants}
          className="text-purple-100 drop-shadow-lg"
        >
          L
        </motion.span>
        
        {/* O - simplified without shimmer effect */}
        <motion.span
          custom={4}
          initial="hidden"
          animate="visible"
          variants={letterVariants}
          className="text-white drop-shadow-lg"
        >
          O
        </motion.span>
      </div>
      
      {/* Enhanced floating particles around logo */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(15)].map((_, index) => (
          <motion.div
            key={index}
            className="absolute w-2 h-2 bg-purple-200/80 rounded-full"
            style={{
              left: `${15 + Math.random() * 70}%`,
              top: `${25 + Math.random() * 50}%`,
            }}
            animate={{
              y: [-15, -45, -15],
              opacity: [0.4, 1, 0.4],
              scale: [0.3, 1, 0.3],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default AnimatedLogo;
