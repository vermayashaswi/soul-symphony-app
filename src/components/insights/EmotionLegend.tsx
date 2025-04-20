
import React from "react";
import { cn } from "@/lib/utils";

interface EmotionLegendProps {
  allEmotions: string[];
  visibleEmotions: string[];
  getEmotionColor: (emotion: string, index: number) => string;
  onClick: (emotion: string) => void;
}

const EmotionLegend: React.FC<EmotionLegendProps> = ({
  allEmotions,
  visibleEmotions,
  getEmotionColor,
  onClick,
}) => (
  <div className="flex flex-wrap justify-center gap-2 mt-6 px-2">
    {allEmotions.map((emotion, index) => {
      const isSelected = visibleEmotions.includes(emotion);
      return (
        <div
          key={emotion}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200",
            isSelected
              ? "bg-secondary font-medium shadow-sm border-2 border-primary"
              : "bg-secondary/30 hover:bg-secondary/50"
          )}
          onClick={() => onClick(emotion)}
        >
          <div
            className={cn("w-3 h-3 rounded-full", isSelected ? "animate-pulse" : "opacity-60")}
            style={{ backgroundColor: getEmotionColor(emotion, index) }}
          />
          <span className={cn("text-sm", isSelected ? "font-bold" : "text-muted-foreground")}>
            {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
          </span>
        </div>
      );
    })}
  </div>
);

export default EmotionLegend;
