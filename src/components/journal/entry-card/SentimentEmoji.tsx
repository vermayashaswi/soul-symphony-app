
import React from 'react';

interface SentimentEmojiProps {
  sentiment: string | { sentiment: string; score: number };
}

const SentimentEmoji: React.FC<SentimentEmojiProps> = ({ sentiment }) => {
  // Parse sentiment value
  let sentimentValue: number;
  
  if (typeof sentiment === 'string') {
    sentimentValue = parseFloat(sentiment);
    if (isNaN(sentimentValue)) sentimentValue = 0;
  } else {
    sentimentValue = sentiment.score;
  }
  
  // Choose emoji based on sentiment value
  let emoji = '😐'; // neutral default
  
  if (sentimentValue <= -0.7) {
    emoji = '😡'; // very negative
  } else if (sentimentValue <= -0.4) {
    emoji = '😔'; // quite negative
  } else if (sentimentValue <= -0.1) {
    emoji = '🙁'; // slightly negative
  } else if (sentimentValue >= 0.7) {
    emoji = '😄'; // very positive
  } else if (sentimentValue >= 0.4) {
    emoji = '🙂'; // quite positive
  } else if (sentimentValue >= 0.1) {
    emoji = '😊'; // slightly positive
  }

  return (
    <span role="img" aria-label="sentiment" className="select-none">
      {emoji}
    </span>
  );
};

export default SentimentEmoji;
