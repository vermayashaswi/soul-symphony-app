
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface SentimentEmojiProps {
  sentiment?: string | {
    sentiment: string;
    score: number;
  };
  isProcessing?: boolean;
}

export function SentimentEmoji({ sentiment, isProcessing = false }: SentimentEmojiProps) {
  if (isProcessing) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  // If sentiment is missing or invalid, show a neutral face
  if (!sentiment) {
    return <span role="img" aria-label="pending sentiment" className="text-2xl text-muted-foreground">⌛</span>;
  }

  const getSentimentScore = (): number => {
    try {
      if (typeof sentiment === 'string') {
        return parseFloat(sentiment);
      } else if (sentiment && typeof sentiment === 'object') {
        return sentiment.score;
      }
      return 0;
    } catch (error) {
      console.error("[SentimentEmoji] Error parsing sentiment score:", error);
      return 0;
    }
  };

  const score = getSentimentScore();
  
  if (score >= 0.3) {
    return <span role="img" aria-label="positive sentiment" className="text-2xl" style={{ color: '#4ade80' }}>😊</span>;
  } else if (score >= -0.1) {
    return <span role="img" aria-label="neutral sentiment" className="text-2xl" style={{ color: '#facc15' }}>😐</span>;
  } else {
    return <span role="img" aria-label="negative sentiment" className="text-2xl" style={{ color: '#ef4444' }}>😔</span>;
  }
}

export default SentimentEmoji;
