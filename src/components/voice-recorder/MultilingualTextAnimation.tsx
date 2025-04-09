
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';

const languages = [
  "Speak in any language!!",
  "¡Habla en cualquier idioma!",
  "Parlez dans n'importe quelle langue !",
  "Sprechen Sie in jeder Sprache!",
  "Parli in qualsiasi lingua!",
  "Fale em qualquer idioma!",
  "किसी भी भाषा में बोलें!",
  "أتحدث بأي لغة!",
  "Praat in enige taal!",
  "Tala på valfritt språk!",
  "Snakk på hvilket som helst språk!",
  "Puhu millä tahansa kielellä!",
  "Tal på hvilket som helst sprog!",
  "Berbicara dalam bahasa apa pun!",
  "任何言語で話してください！",
  "任何语言都可以说！",
  "어떤 언어로든 말하세요!",
  "Mówić w dowolnym języku!",
  "Mluvte v jakémkoli jazyce!",
  "พูดได้ทุกภาษา!",
  "Konuş herhangi bir dilde!",
  "Beszélj bármilyen nyelven!",
  "Vorbește în orice limbă!",
  "Μιλήστε σε οποιαδήποτε γλώσσα!",
  "Говорите на любом языке!",
];

export function LanguageBackground({ contained = false }: { contained?: boolean }) {
  const { theme } = useTheme();
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {languages.map((text, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none select-none whitespace-nowrap text-sm"
          initial={{
            x: contained ? `${Math.random() * 100}%` : `${100 + Math.random() * 100}%`,
            y: contained ? `${Math.random() * 100}%` : `${Math.random() * 100}%`,
            opacity: 0,
            scale: 0.8,
          }}
          animate={{
            x: contained ? `${Math.random() * 100}%` : `${-50 + Math.random() * 50}%`,
            y: contained ? `${Math.random() * 100}%` : `${Math.random() * 100}%`,
            opacity: [0, 1, 0],
            scale: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            delay: i * 2,
            repeatDelay: languages.length * 1.5,
            ease: "easeInOut",
          }}
          style={{
            color: theme === 'dark' ? "#fff" : undefined,
          }}
        >
          {text}
        </motion.div>
      ))}
    </div>
  );
}

export function AnimatedPrompt() {
  const { theme } = useTheme();
  
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-3"
      >
        <h3 
          className="text-lg font-medium mb-1"
          style={{
            color: theme === 'dark' ? "#fff" : undefined,
          }}
        >
          Speak in any language!!
        </h3>
        <p 
          className="text-sm opacity-80"
          style={{
            color: theme === 'dark' ? "rgba(255, 255, 255, 0.8)" : undefined,
          }}
        >
          I'll transcribe and analyze your voice recording
        </p>
      </motion.div>
    </div>
  );
}
