
import React from "react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { TranslatableText } from "@/components/translation/TranslatableText";

interface EmotionRadarChartProps {
  emotions: {
    name: string;
    value: number;
  }[];
  title?: string;
}

const EmotionRadarChart: React.FC<EmotionRadarChartProps> = ({ emotions, title }) => {
  if (!emotions || emotions.length === 0) return null;
  
  // Normalize values to make sure they're all within reasonable range for visualization
  const maxValue = Math.max(...emotions.map(e => e.value));
  const normalizedEmotions = emotions.map(emotion => ({
    ...emotion,
    value: maxValue > 0 ? (emotion.value / maxValue) * 100 : emotion.value
  }));
  
  return (
    <Card className="p-4 mt-4">
      {title && (
        <h4 className="text-sm font-medium mb-2">
          <TranslatableText text={title} />
        </h4>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={normalizedEmotions}>
            <PolarGrid />
            <PolarAngleAxis dataKey="name" />
            <Radar
              name="Emotion Intensity"
              dataKey="value"
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.6}
            />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default EmotionRadarChart;
