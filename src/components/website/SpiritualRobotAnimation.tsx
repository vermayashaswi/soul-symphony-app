
import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Brain } from 'lucide-react';

interface SpiritualRobotAnimationProps {
  className?: string;
}

const SpiritualRobotAnimation: React.FC<SpiritualRobotAnimationProps> = ({ className }) => {
  const [glowIntensity, setGlowIntensity] = useState(0);
  const robotControls = useAnimation();
  const brainControls = useAnimation();
  const soulControls = useAnimation();
  
  // Animation sequence
  useEffect(() => {
    const animateRobot = async () => {
      // Initial state
      await robotControls.start({ opacity: 1, scale: 1 });
      
      // Animation loop
      const sequence = async () => {
        // Brain glows
        await brainControls.start({ 
          filter: 'drop-shadow(0 0 15px rgba(138, 43, 226, 0.8))',
          transition: { duration: 2, ease: "easeInOut" }
        });
        setGlowIntensity(1);
        
        // Soul emerges
        await soulControls.start({ 
          opacity: 1, 
          scale: 1.1,
          transition: { duration: 1.5, ease: "easeOut" }
        });
        
        // Pulse together
        await Promise.all([
          brainControls.start({ 
            scale: [1, 1.05, 1],
            transition: { duration: 3, times: [0, 0.5, 1], repeat: 1, repeatType: "reverse" }
          }),
          soulControls.start({ 
            scale: [1.1, 1.15, 1.1],
            filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.7))',
            transition: { duration: 3, times: [0, 0.5, 1], repeat: 1, repeatType: "reverse" }
          })
        ]);
        
        // Reset for next cycle
        await Promise.all([
          brainControls.start({ 
            filter: 'drop-shadow(0 0 5px rgba(138, 43, 226, 0.3))',
            transition: { duration: 1.5, ease: "easeIn" }
          }),
          soulControls.start({ 
            opacity: 0.7, 
            scale: 0.95,
            filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.3))',
            transition: { duration: 1.5, ease: "easeIn" }
          })
        ]);
        setGlowIntensity(0.3);
        
        // Small pause before repeating
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Repeat the sequence
        sequence();
      };
      
      sequence();
    };
    
    animateRobot();
  }, [robotControls, brainControls, soulControls]);
  
  return (
    <div className={`relative ${className}`}>
      {/* Robot body */}
      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={robotControls}
        transition={{ duration: 1 }}
      >
        {/* Robot Head */}
        <div className="relative w-56 h-64 bg-gradient-to-b from-white to-gray-200 rounded-t-full border-2 border-gray-300">
          {/* Eyes */}
          <div className="absolute top-16 left-10 w-10 h-10 bg-black rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
          </div>
          <div className="absolute top-16 right-10 w-10 h-10 bg-black rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
          </div>
          
          {/* Mouth - subtle curve */}
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 w-20 h-8 border-b-4 border-gray-600 rounded-full"></div>
          
          {/* Brain */}
          <motion.div 
            className="absolute top-2 left-1/2 transform -translate-x-1/2 text-purple-600"
            initial={{ filter: 'drop-shadow(0 0 5px rgba(138, 43, 226, 0.3))' }}
            animate={brainControls}
          >
            <Brain size={40} />
          </motion.div>
          
          {/* Soul/Aura */}
          <motion.div 
            className="absolute inset-0 bg-gradient-radial from-yellow-300/30 to-transparent rounded-t-full"
            initial={{ opacity: 0.7, scale: 0.95, filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.3))' }}
            animate={soulControls}
          ></motion.div>
        </div>
        
        {/* Robot Body - simple suggestion */}
        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 w-40 h-20 bg-gradient-to-b from-gray-200 to-gray-300 rounded-b-lg border-2 border-gray-300">
          {/* Simple control panel */}
          <div className="absolute top-5 left-1/2 transform -translate-x-1/2 w-24 h-8 bg-gray-700 rounded-lg flex items-center justify-around">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        </div>
      </motion.div>
      
      {/* Glow effect around the entire robot */}
      <motion.div 
        className="absolute inset-0 rounded-full bg-gradient-radial from-yellow-500/20 to-transparent -z-10"
        animate={{ 
          opacity: glowIntensity,
          scale: glowIntensity > 0.5 ? 1.2 : 1.1,
          filter: `blur(${10 + glowIntensity * 10}px)`
        }}
        transition={{ duration: 2 }}
      ></motion.div>
    </div>
  );
};

export default SpiritualRobotAnimation;
