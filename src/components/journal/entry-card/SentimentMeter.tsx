
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface SentimentMeterProps {
  sentiment?: string | number | {
    sentiment: string;
    score: number;
  };
  isProcessing?: boolean;
}

export function SentimentMeter({ sentiment, isProcessing = false }: SentimentMeterProps) {
  if (isProcessing) {
    return <Skeleton className="h-2 w-24" />;
  }

  // If sentiment is missing or invalid, show a neutral meter
  if (!sentiment) {
    return <div className="h-2 w-24 bg-neutral-300 rounded-full"></div>;
  }

  const getSentimentScore = (): number => {
    try {
      if (typeof sentiment === 'string') {
        return parseFloat(sentiment);
      } else if (typeof sentiment === 'number') {
        return sentiment;
      } else if (sentiment && typeof sentiment === 'object') {
        if ('score' in sentiment) {
          return sentiment.score;
        } else if ('sentiment' in sentiment && typeof sentiment.sentiment === 'string') {
          return parseFloat(sentiment.sentiment);
        }
      }
      return 0;
    } catch (error) {
      console.error("[SentimentMeter] Error parsing sentiment score:", error);
      return 0;
    }
  };

  const score = getSentimentScore();
  // Convert score from -1 to 1 range to 0 to 100 for the progress component
  const normalizedScore = ((score + 1) / 2) * 100;
  
  // Create a gradient from red to green
  const gradientStyle = {
    background: 'linear-gradient(to right, #ea384c, #F2FCE2)'
  };

  return (
    <div className="w-24 h-3 relative">
      <div className="absolute inset-0 rounded-full" style={gradientStyle}></div>
      <div 
        className="absolute w-3 h-3 bg-white border border-gray-300 rounded-full transform -translate-y-1/4"
        style={{ left: `calc(${normalizedScore}% - 4px)` }}
      ></div>
    </div>
  );
}

export default SentimentMeter;
