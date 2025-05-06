import React from 'react';

interface MoodCalendarGridProps {
  data?: any[];
  sentimentData?: any[];
  interval: string;
  isLoading?: boolean;
  filterLabel?: string;
}

const MoodCalendarGrid: React.FC<MoodCalendarGridProps> = ({
  data,
  sentimentData, 
  interval, 
  isLoading = false,
  filterLabel
}) => {
  // Use either data or sentimentData, with data taking precedence
  const displayData = data || sentimentData || [];
  
  // Your existing implementation would go here
  return (
    <div>
      {/* Calendar grid implementation */}
      {isLoading && <p>Loading...</p>}
    </div>
  );
};

export default MoodCalendarGrid;
