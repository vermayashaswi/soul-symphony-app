
import React from 'react';
import { Card } from '@/components/ui/card';
import { TranslatableText } from "@/components/translation/TranslatableText";

interface EmotionRadarChartProps {
  emotions: Array<{
    name: string;
    score: number;
  }>;
  size?: 'small' | 'medium' | 'large';
}

const EmotionRadarChart: React.FC<EmotionRadarChartProps> = ({ 
  emotions,
  size = 'medium'
}) => {
  if (!emotions || emotions.length === 0) return null;
  
  // This is a placeholder component for now
  // In the future, implement a real radar chart using recharts
  return (
    <Card className="p-4">
      <h4 className="font-medium mb-2">
        <TranslatableText text="Emotion Analysis" forceTranslate={true} />
      </h4>
      
      <div className="space-y-2">
        {emotions.map((emotion, idx) => (
          <div key={idx} className="flex items-center">
            <span className="w-24 text-sm">{emotion.name}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary" 
                style={{width: `${emotion.score * 100}%`}}
              />
            </div>
            <span className="w-12 text-right text-sm">
              {Math.round(emotion.score * 100)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default EmotionRadarChart;
