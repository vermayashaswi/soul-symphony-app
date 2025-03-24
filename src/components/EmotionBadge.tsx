
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface EmotionBadgeProps {
  emotion: string;
}

export function EmotionBadge({ emotion }: EmotionBadgeProps) {
  const getEmotionColor = (emotion: string): string => {
    const emotionMap: Record<string, string> = {
      joy: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
      happiness: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
      sadness: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      anger: 'bg-red-100 text-red-800 hover:bg-red-200',
      fear: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
      surprise: 'bg-green-100 text-green-800 hover:bg-green-200',
      love: 'bg-pink-100 text-pink-800 hover:bg-pink-200',
      gratitude: 'bg-teal-100 text-teal-800 hover:bg-teal-200',
      confusion: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
      anxiety: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
      hope: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200',
      peace: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
    };
    
    // Convert emotion to lowercase and find exact match
    const lowerEmotion = emotion.toLowerCase();
    if (emotionMap[lowerEmotion]) {
      return emotionMap[lowerEmotion];
    }
    
    // If no exact match, try to find partial match
    for (const key in emotionMap) {
      if (lowerEmotion.includes(key) || key.includes(lowerEmotion)) {
        return emotionMap[key];
      }
    }
    
    // Default color
    return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  };

  return (
    <Badge variant="outline" className={getEmotionColor(emotion)}>
      {emotion}
    </Badge>
  );
}
