
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

  // Generate random positions for each word
  const generateRandomPositions = () => {
    return languageWords.map((_, index) => ({
      x: Math.random() * 200 - 100, // Range from -100 to 100
      y: Math.random() * 200 - 100, // Range from -100 to 100
      scale: 0.8 + Math.random() * 0.4, // Range from 0.8 to 1.2
      opacity: 0.4 + Math.random() * 0.6, // Range from 0.4 to 1.0
      delay: index * 0.1, // Staggered delay for each word
      duration: 5 + Math.random() * 10 // Different durations for more natural movement
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
          
          return (
            <motion.span
              key={index}
              className="absolute whitespace-nowrap transform-gpu"
              style={{
                left: "50%",
                top: "50%",
              }}
              initial={{
                x: position.x * 2,
                y: position.y * 2,
                scale: 0,
                opacity: 0
              }}
              animate={{
                x: [position.x, position.x + 15, position.x - 10, position.x],
                y: [position.y, position.y - 10, position.y + 15, position.y],
                scale: position.scale,
                opacity: position.opacity
              }}
              transition={{
                x: {
                  duration: position.duration,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: position.delay
                },
                y: {
                  duration: position.duration * 1.2, // Slightly different duration for x and y
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut", 
                  delay: position.delay
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
