import React from "react";
import { cn } from "@/lib/utils";

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
        size === "sm" ? "text-[0.5rem]" : "text-xs"
      )}
      style={{
        width: size === "sm" ? "90px" : "110px",
        height: size === "sm" ? "90px" : "110px",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        opacity: 0.7,
        animation: "floatText 15s linear infinite",
      }}
    >
      <div className="flex flex-col items-center justify-center h-full">
        {languageWords.map((word, index) => (
          <span
            key={index}
            className="whitespace-nowrap"
            style={{
              animationDelay: `${index * 1.2}s`,
              animationDuration: "15s",
              animationIterationCount: "infinite",
              animationTimingFunction: "linear",
              animationName: "floatText",
            }}
          >
            {word}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes floatText {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(-100%);
          }
        }
      `}</style>
    </div>
  );
};

export default FloatingLanguages;
