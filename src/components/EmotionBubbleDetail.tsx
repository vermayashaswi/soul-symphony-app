
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import twemoji from 'twemoji';

const EMOTION_EMOJIS: Record<string, string> = {
  joy: '😊',
  happiness: '😄',
  gratitude: '🙏',
  calm: '😌',
  anxiety: '😰',
  sadness: '😢',
  anger: '😠',
  fear: '😨',
  excitement: '🤩',
  love: '❤️',
  stress: '😓',
  surprise: '😲',
  confusion: '😕',
  disappointment: '😞',
  pride: '🦁',
  shame: '😳',
  guilt: '😔',
  hope: '🌟',
  boredom: '😑',
  disgust: '🤢',
  contentment: '😊',
  trust: '🤝',
  anticipation: '🤔',
  pensiveness: '🤔',
  serenity: '🧘',
  annoyance: '😤',
  vigilance: '👀',
  interest: '🤓',
  apprehension: '😟',
  distraction: '🤪',
  admiration: '🥰'
};

interface EmotionBubbleDetailProps {
  name: string;
  size: number;
  color: string;
  isDisturbed?: boolean;
  isDragging?: boolean;
  isHighlighted?: boolean;
  percentage?: number;
  onClick: (emotion: string) => void;
}

const EmotionBubbleDetail: React.FC<EmotionBubbleDetailProps> = ({
  name,
  size,
  isDisturbed = false,
  isDragging = false,
  isHighlighted = false,
  onClick
}) => {
  const emojiRef = useRef<HTMLDivElement>(null);
  const emoji = EMOTION_EMOJIS[name.toLowerCase()] || '🙂';
  const fontSize = Math.max(size / 2.5, 16); // Increased size ratio for emojis
  
  useEffect(() => {
    if (emojiRef.current) {
      twemoji.parse(emojiRef.current, {
        folder: 'svg',
        ext: '.svg',
        className: 'emoji-svg',
        size: '72x72'
      });
    }
  }, [emoji]);

  return (
    <motion.div
      className={cn(
        "flex items-center justify-center w-full h-full rounded-full relative select-none bg-background/80 backdrop-blur-sm border border-border/50",
        isDragging ? "cursor-grabbing" : "cursor-pointer"
      )}
      onClick={() => onClick(name)}
      style={{ fontSize: `${fontSize}px` }}
      animate={{
        scale: isHighlighted ? 1.1 : 1,
        boxShadow: isHighlighted 
          ? `0 0 20px 3px rgba(139, 92, 246, 0.5)` 
          : isDragging 
            ? `0 4px 8px rgba(0, 0, 0, 0.2)` 
            : `0 2px 4px rgba(0, 0, 0, 0.1)`
      }}
      transition={{ 
        duration: isDisturbed ? 0.2 : 0.3,
        ease: "easeOut" 
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div 
        ref={emojiRef} 
        role="img" 
        aria-label={name}
        className="emoji-container"
      >
        {emoji}
      </div>
    </motion.div>
  );
};

export default EmotionBubbleDetail;
