
import React from 'react';
import SentimentEmoji from './SentimentEmoji';

type SentimentValue = number | string | { sentiment: string; score: number };

interface SentimentMeterProps {
  sentiment: SentimentValue;
  showText?: boolean;
}

const SentimentMeter: React.FC<SentimentMeterProps> = ({ sentiment, showText = false }) => {
  // Parse the sentiment to get a numeric value between -1 and 1
  const getSentimentValue = (sentiment: SentimentValue): number => {
    if (typeof sentiment === 'number') {
      return sentiment;
    } else if (typeof sentiment === 'string') {
      return parseFloat(sentiment);
    } else {
      return sentiment.score;
    }
  };

  const sentimentValue = getSentimentValue(sentiment);
  
  // Convert sentiment to a percentage (0-100 scale)
  const percentage = Math.round((sentimentValue + 1) * 50);
  
  // Determine sentiment text
  const getSentimentText = (value: number): string => {
    if (value < -0.6) return "Very Negative";
    if (value < -0.2) return "Negative";
    if (value < 0.2) return "Neutral";
    if (value < 0.6) return "Positive";
    return "Very Positive";
  };

  const sentimentText = getSentimentText(sentimentValue);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center">
          <SentimentEmoji sentiment={sentimentValue} />
          {showText && <span className="text-xs ml-2 text-muted-foreground">{sentimentText}</span>}
        </div>
        <span className="text-xs text-muted-foreground">{percentage}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div 
          className="h-1.5 rounded-full" 
          style={{ 
            width: `${percentage}%`,
            backgroundColor: sentimentValue < -0.3 ? '#ef4444' : 
                            sentimentValue < 0.3 ? '#f59e0b' : '#22c55e'
          }}
        ></div>
      </div>
    </div>
  );
};

export default SentimentMeter;
