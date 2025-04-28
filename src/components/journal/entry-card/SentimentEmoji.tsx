
import React, { useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import twemoji from 'twemoji';

interface SentimentEmojiProps {
  sentiment?: string | number | {
    sentiment: string;
    score: number;
  };
  isProcessing?: boolean;
}

export function SentimentEmoji({ sentiment, isProcessing = false }: SentimentEmojiProps) {
  const emojiRef = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    if (emojiRef.current) {
      twemoji.parse(emojiRef.current, {
        folder: 'svg',
        ext: '.svg',
        className: 'emoji-svg',
        size: '72x72'
      });
    }
  }, [sentiment]);
  
  if (isProcessing) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  // If sentiment is missing or invalid, show a neutral face
  if (!sentiment) {
    return <span ref={emojiRef} role="img" aria-label="pending sentiment" className="text-2xl text-muted-foreground">⌛</span>;
  }

  const getSentimentScore = (): number => {
    try {
      if (typeof sentiment === 'string') {
        return parseFloat(sentiment);
      } else if (typeof sentiment === 'number') {
        return sentiment;
      } else if (sentiment && typeof sentiment === 'object') {
        if ('score' in sentiment && typeof sentiment.score === 'number') {
          return sentiment.score;
        } else if ('sentiment' in sentiment && typeof sentiment.sentiment === 'string') {
          return parseFloat(sentiment.sentiment);
        }
      }
      return 0;
    } catch (error) {
      console.error("[SentimentEmoji] Error parsing sentiment score:", error);
      console.log("[SentimentEmoji] Sentiment value that caused the error:", sentiment);
      return 0;
    }
  };

  const score = getSentimentScore();
  
  if (score >= 0.3) {
    return <span ref={emojiRef} role="img" aria-label="positive sentiment" className="text-2xl" style={{ color: '#4ade80' }}>😊</span>;
  } else if (score >= -0.1) {
    return <span ref={emojiRef} role="img" aria-label="neutral sentiment" className="text-2xl" style={{ color: '#facc15' }}>😐</span>;
  } else {
    return <span ref={emojiRef} role="img" aria-label="negative sentiment" className="text-2xl" style={{ color: '#ef4444' }}>😔</span>;
  }
}

export default SentimentEmoji;
