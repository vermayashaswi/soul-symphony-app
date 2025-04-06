
import React from 'react';

interface SentimentEmojiProps {
  sentiment?: string | {
    sentiment: string;
    score: number;
  };
}

export function SentimentEmoji({ sentiment }: SentimentEmojiProps) {
  const getSentimentScore = (): number => {
    if (typeof sentiment === 'string') {
      return parseFloat(sentiment);
    } else if (sentiment) {
      return sentiment.score;
    }
    return 0;
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
