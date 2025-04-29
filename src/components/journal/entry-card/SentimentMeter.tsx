
import React from 'react';

interface SentimentMeterProps {
  sentiment: string | { sentiment: string; score: number };
}

const SentimentMeter: React.FC<SentimentMeterProps> = ({ sentiment }) => {
  // Handle different sentiment formats
  let sentimentScore: number;
  
  if (typeof sentiment === 'string') {
    // Parse the sentiment string to a number between -1 and 1
    sentimentScore = parseFloat(sentiment);
    // If parsing fails or value is out of range, use a default neutral value
    if (isNaN(sentimentScore) || sentimentScore < -1 || sentimentScore > 1) {
      sentimentScore = 0;
    }
  } else {
    // Use the score from the sentiment object
    sentimentScore = sentiment.score;
  }
  
  // Map from [-1, 1] range to [0, 100] for the meter
  const meterValue = ((sentimentScore + 1) / 2) * 100;
  
  // Determine color based on sentiment score
  let barColor = '';
  if (sentimentScore < -0.3) {
    barColor = 'bg-red-500';
  } else if (sentimentScore > 0.3) {
    barColor = 'bg-green-500';
  } else {
    barColor = 'bg-amber-500';
  }
  
  return (
    <div className="w-full">
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
        <div 
          className={`h-1.5 rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${meterValue}%` }}
        />
      </div>
    </div>
  );
};

export default SentimentMeter;
