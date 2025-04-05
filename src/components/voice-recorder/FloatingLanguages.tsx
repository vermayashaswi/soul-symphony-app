
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
      <div className="flex flex-col items-center justify-center h-full perspective-wrapper">
        {languageWords.map((word, index) => (
          <motion.span
            key={index}
            className="whitespace-nowrap"
            initial={{ y: 100, opacity: 0 }}
            animate={{ 
              y: -100, 
              opacity: [0, 1, 1, 0],
              transition: {
                y: {
                  duration: 15,
                  repeat: Infinity,
                  ease: "linear",
                  delay: index * 0.6,
                },
                opacity: {
                  duration: 15,
                  times: [0, 0.1, 0.9, 1],
                  repeat: Infinity,
                  ease: "linear",
                  delay: index * 0.6,
                }
              }
            }}
          >
            {word}
          </motion.span>
        ))}
      </div>
    </div>
  );
};

export default FloatingLanguages;
