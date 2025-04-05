
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
    "স্বাগতম", "Namaste", "Hello", "Hi", "Hey", "Svenska", "Lietuvių",
    "Română", "Беларуская", "Gaeilge", "বাংলা", "فارسی", "Русский", "Shqip"
  ];

  // Generate random positions with wider movement range and more randomness
  const generateRandomPositions = () => {
    // Create an evenly distributed grid to ensure words are spread out
    const gridSize = Math.ceil(Math.sqrt(languageWords.length));
    const cellSize = 160 / gridSize;
    
    return languageWords.map((_, i) => {
      // Calculate grid position
      const gridX = i % gridSize;
      const gridY = Math.floor(i / gridSize);
      
      // Add randomness within grid cell for initial position
      const cellX = (gridX * cellSize) - 80 + (Math.random() * cellSize * 0.8);
      const cellY = (gridY * cellSize) - 80 + (Math.random() * cellSize * 0.8);
      
      return {
        // Initial positions - using grid-based positioning for better distribution
        initialX: cellX,
        initialY: cellY,
        
        // Movement ranges - larger and more variable values for dynamic movement
        moveRangeX: 50 + Math.random() * 80, // Range from 50 to 130
        moveRangeY: 50 + Math.random() * 80, // Range from 50 to 130
        
        // Visual properties
        scale: 0.7 + Math.random() * 0.6, // Range from 0.7 to 1.3
        opacity: 0.4 + Math.random() * 0.6, // Range from 0.4 to 1.0
        
        // Timing properties - more variation for natural movement
        duration: 15 + Math.random() * 25, // Longer durations (15-40s) for smoother motion
        delay: Math.random() * 8, // Varied delay for more natural start
        
        // Direction and movement properties
        directionX: Math.random() > 0.5 ? 1 : -1, // Random initial direction
        directionY: Math.random() > 0.5 ? 1 : -1,  // Random initial direction
        waypoints: 4 + Math.floor(Math.random() * 4) // 4-7 waypoints for complex paths
      };
    });
  };

  const positions = React.useMemo(() => generateRandomPositions(), []);

  return (
    <div
      className={cn(
        "absolute -z-10 inset-0 overflow-hidden rounded-2xl",
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
          
          // Create multiple random waypoints for more organic movement
          const getRandomWaypoints = (range: number, initialPos: number, direction: number) => {
            const numPoints = position.waypoints;
            const points = [];
            
            // Create a more complex path with multiple points
            for (let i = 0; i < numPoints; i++) {
              // Varying amplitude of movement
              const amplitude = Math.random() * range * (0.5 + (i % 2) * 0.7);
              // Direction alternates or randomizes for more chaotic movement
              const pointDirection = (i % 2 === 0) ? direction : -direction;
              // Add random offset from initial position
              points.push(initialPos + (amplitude * pointDirection));
            }
            
            // Always return to somewhere near the initial position to create a loop
            return [
              initialPos, 
              ...points,
              initialPos + (Math.random() * 30 - 15)
            ];
          };
          
          const xWaypoints = getRandomWaypoints(position.moveRangeX, position.initialX, position.directionX);
          const yWaypoints = getRandomWaypoints(position.moveRangeY, position.initialY, position.directionY);
          
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
                  repeatType: "mirror",
                  ease: "easeInOut",
                  delay: position.delay,
                  times: Array(xWaypoints.length).fill(0).map((_, i) => i / (xWaypoints.length - 1))
                },
                y: {
                  duration: position.duration * 1.1, // Slightly different duration for x and y
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut", 
                  delay: position.delay * 1.2, // Offset delay for y to create more variation
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
