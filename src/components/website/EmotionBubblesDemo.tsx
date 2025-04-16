
import React from 'react';
import { motion } from 'framer-motion';

// Demo component that shows floating emotion bubbles
const EmotionBubblesDemo = () => {
  // Define emotions with their colors and sizes (relative)
  const emotions = [
    { name: "Joy", color: "#8b5cf6", size: 1.6 },
    { name: "Calm", color: "#06b6d4", size: 1.2 },
    { name: "Hope", color: "#10b981", size: 1.3 },
    { name: "Focus", color: "#f59e0b", size: 0.8 },
    { name: "Inspired", color: "#ec4899", size: 0.9 }
  ];

  return (
    <div className="w-full h-full relative">
      {emotions.map((emotion, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full flex items-center justify-center"
          style={{
            backgroundColor: emotion.color,
            width: `${emotion.size * 18}px`,
            height: `${emotion.size * 18}px`,
            fontSize: `${emotion.size * 4}px`,
            color: 'white',
            fontWeight: 'bold',
            top: `${25 + Math.sin(index * 1.5) * 15}px`,
            left: `${(index * 16) % 95}%`,
            zIndex: Math.floor(emotion.size * 10),
            boxShadow: `0 0 10px ${emotion.color}80`
          }}
          animate={{
            y: [0, -5, 0, 5, 0],
            scale: [1, 1.05, 1, 0.95, 1]
          }}
          transition={{
            duration: 4 + index,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
};

export default EmotionBubblesDemo;
