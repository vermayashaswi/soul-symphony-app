
import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FloatingLanguagesProps {
  size: "sm" | "md";
}

const FloatingLanguages: React.FC<FloatingLanguagesProps> = ({ size }) => {
  const languageWords = [
    "नमस्ते", "你好", "Hola", "Bonjour", "Ciao", "こんにちは",
    "Guten Tag", "Olá", "Привет", "Merhaba", "أهلاً", "Shalom",
    "வணக்கம்", "Ayubowan", "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ", "Kem Chho", "நமஸ்காரம்",
    "স্বাগতম", "Namaste", "Hello", "Hi", "Hey", "Svenska", "Lietuvių",
    "Română", "Беларуская", "Gaeilge", "বাংলা", "فارسی", "Русский", "Shqip"
  ];

  // Generate positions that radiate outward from the center
  const generateRadialPositions = () => {
    return languageWords.map((_, i) => {
      // Calculate angle around the circle (divide the full circle by number of words)
      const angle = (i / languageWords.length) * 2 * Math.PI;
      
      // Calculate distances from center (random within a range)
      // Initial positions closer to center, animation moves outward
      const initialDistance = 20 + Math.random() * 30;
      const animateDistance = 80 + Math.random() * 70;
      
      // Convert polar coordinates to cartesian
      const initialX = Math.cos(angle) * initialDistance;
      const initialY = Math.sin(angle) * initialDistance;
      
      return {
        angle,
        // Initial positions - closer to center
        initialX,
        initialY,
        
        // Target animation positions - farther from center in same angle
        targetX: Math.cos(angle) * animateDistance - 30, // Shift left by 15% (changed from -50 to -30)
        targetY: Math.sin(angle) * animateDistance,
        
        // Visual properties
        scale: 0.7 + Math.random() * 0.6, // Range from 0.7 to 1.3
        opacity: 0.3 + Math.random() * 0.4, // Range from 0.3 to 0.7
        
        // Timing properties
        duration: 15 + Math.random() * 25, // Longer durations (15-40s) for smoother motion
        delay: Math.random() * 5, // Varied delay for more natural start
      };
    });
  };

  const positions = React.useMemo(() => generateRadialPositions(), []);

  // Updated container styles to match voice recorder dimensions
  const containerSize = {
    width: size === "sm" ? "100%" : "100%",
    height: size === "sm" ? "100%" : "100%",
    maxWidth: size === "sm" ? "300px" : "320px", // Match the width of the voice recorder
    minHeight: size === "sm" ? "185px" : "185px", // Match the min-height of voice recorder
  };

  return (
    <div
      className={cn(
        "absolute -z-10 overflow-hidden rounded-2xl", // Changed to rounded-2xl to match voice recorder
        size === "sm" ? "text-[0.5rem]" : "text-xs",
        "will-change-transform"
      )}
      style={{
        ...containerSize,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        opacity: 0.8,
      }}
    >
      <div className="relative h-full w-full">
        {languageWords.map((word, index) => {
          const position = positions[index];
          
          return (
            <motion.span
              key={index}
              className="absolute whitespace-nowrap transform-gpu"
              style={{
                left: "50%", 
                top: "50%",
              }}
              initial={{
                x: position.initialX,
                y: position.initialY,
                scale: 0,
                opacity: 0
              }}
              animate={{
                x: position.targetX,
                y: position.targetY,
                scale: position.scale,
                opacity: position.opacity
              }}
              transition={{
                x: {
                  duration: position.duration,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeOut",
                  delay: position.delay,
                },
                y: {
                  duration: position.duration,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeOut", 
                  delay: position.delay,
                },
                opacity: {
                  duration: 2,
                  delay: position.delay
                },
                scale: {
                  duration: 1.5,
                  delay: position.delay
                }
              }}
            >
              {word}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingLanguages;
