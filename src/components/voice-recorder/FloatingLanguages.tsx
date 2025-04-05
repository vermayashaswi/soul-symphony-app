
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
    "வணக்கம்", "Ayubowan", "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ", "Kem Chho", "নমস্কার",
    "স্বাগতম", "Namaste", "Hello", "Hi", "Hey",
  ];

  // Generate random positions with wider movement range
  const generateRandomPositions = () => {
    return languageWords.map(() => ({
      // Initial positions - spread words more evenly across container
      initialX: Math.random() * 160 - 80, // Range from -80 to 80
      initialY: Math.random() * 160 - 80, // Range from -80 to 80
      
      // Movement ranges - larger values for more pronounced movement
      moveRangeX: 40 + Math.random() * 60, // Range from 40 to 100
      moveRangeY: 40 + Math.random() * 60, // Range from 40 to 100
      
      // Visual properties
      scale: 0.7 + Math.random() * 0.6, // Range from 0.7 to 1.3
      opacity: 0.4 + Math.random() * 0.6, // Range from 0.4 to 1.0
      
      // Timing properties
      duration: 12 + Math.random() * 20, // Longer durations (12-32s) for smoother motion
      delay: Math.random() * 5, // Random delay for more natural feel
      
      // Direction control 
      directionX: Math.random() > 0.5 ? 1 : -1, // Random initial direction
      directionY: Math.random() > 0.5 ? 1 : -1  // Random initial direction
    }));
  };

  const positions = React.useMemo(() => generateRandomPositions(), []);

  return (
    <div
      className={cn(
        "absolute -z-10 inset-0 overflow-hidden rounded-full",
        size === "sm" ? "text-[0.5rem]" : "text-xs",
        "will-change-transform"
      )}
      style={{
        width: size === "sm" ? "90px" : "110px",
        height: size === "sm" ? "90px" : "110px",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        opacity: 0.7,
      }}
    >
      <div className="relative h-full w-full perspective-wrapper">
        {languageWords.map((word, index) => {
          const position = positions[index];
          
          // Create multiple random waypoints for more natural movement
          const getRandomWaypoints = () => {
            // Create 3-5 waypoints for each axis
            const numPoints = 3 + Math.floor(Math.random() * 3);
            const points = [];
            
            for (let i = 0; i < numPoints; i++) {
              // Random point within the movement range
              const factor = Math.random() * 2 - 1; // -1 to 1
              points.push(position.initialX + (position.moveRangeX * factor * position.directionX));
            }
            
            // Always return to somewhere near the initial position to create a loop
            return [
              position.initialX, 
              ...points,
              position.initialX + (Math.random() * 20 - 10)
            ];
          };
          
          const xWaypoints = getRandomWaypoints();
          const yWaypoints = getRandomWaypoints();
          
          return (
            <motion.span
              key={index}
              className="absolute whitespace-nowrap transform-gpu"
              style={{
                left: "50%",
                top: "50%",
              }}
              initial={{
                x: position.initialX * 1.5,
                y: position.initialY * 1.5,
                scale: 0,
                opacity: 0
              }}
              animate={{
                x: xWaypoints,
                y: yWaypoints,
                scale: position.scale,
                opacity: position.opacity
              }}
              transition={{
                x: {
                  duration: position.duration,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: position.delay,
                  times: Array(xWaypoints.length).fill(0).map((_, i) => i / (xWaypoints.length - 1))
                },
                y: {
                  duration: position.duration * 1.2, // Slightly different duration for x and y
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut", 
                  delay: position.delay,
                  times: Array(yWaypoints.length).fill(0).map((_, i) => i / (yWaypoints.length - 1))
                },
                opacity: {
                  duration: 1,
                  delay: position.delay
                },
                scale: {
                  duration: 0.8,
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
