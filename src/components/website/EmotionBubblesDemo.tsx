
import React from 'react';
import { motion } from 'framer-motion';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface EmotionBubblesProps {
  isPhonePreview?: boolean;
}

const EmotionBubblesDemo: React.FC<EmotionBubblesProps> = ({ isPhonePreview = false }) => {
  // Sample emotions for the demo
  const emotions = [
    { name: 'Joy', value: 0.8, color: '#FFD700' },
    { name: 'Calm', value: 0.6, color: '#4169E1' },
    { name: 'Focus', value: 0.5, color: '#32CD32' },
    { name: 'Stress', value: 0.3, color: '#FF4500' },
  ];

  const containerSize = isPhonePreview ? 'h-[60px]' : 'h-[120px]';
  const textSize = isPhonePreview ? 'text-[6px]' : 'text-xs';

  return (
    <div className={`w-full ${containerSize} relative`}>
      {emotions.map((emotion, index) => {
        const size = isPhonePreview ? 
          Math.max(15, emotion.value * 30) : 
          Math.max(30, emotion.value * 60);
        
        // Position bubbles with some randomness but ensure they're visible
        const top = isPhonePreview ? 
          `${10 + (index * 10) % 40}%` : 
          `${20 + (index * 15) % 60}%`;
        
        const left = `${15 + (index * 25) % 80}%`;
        
        return (
          <motion.div
            key={emotion.name}
            className="absolute rounded-full flex items-center justify-center"
            style={{
              width: size,
              height: size,
              backgroundColor: `${emotion.color}50`,
              border: `1px solid ${emotion.color}`,
              top,
              left,
            }}
            initial={{ scale: 0 }}
            animate={{ 
              scale: [0.9, 1, 0.95, 1.02, 0.98, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              repeatType: "reverse",
              delay: index * 0.3,
            }}
          >
            <span className={`${textSize} font-medium`}>
              <TranslatableText text={emotion.name} forceTranslate={true} />
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

export default EmotionBubblesDemo;
