
import React from "react";
import { cn } from "@/lib/utils";

interface TopEntitiesListProps {
  entityCounts: [string, number][];
  baseColor?: string;
  className?: string;
}

const TopEntitiesList: React.FC<TopEntitiesListProps> = ({
  entityCounts = [],
  baseColor = "#8b5cf6",
  className,
}) => {
  if (!entityCounts.length) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-muted-foreground">No entities found for this timeframe</p>
      </div>
    );
  }

  const minOpacity = 0.4, maxOpacity = 1.0;
  const n = entityCounts.length;

  return (
    <div className={cn("flex flex-col gap-2 py-4", className)} style={{ maxWidth: 320, margin: "0 auto" }}>
      {entityCounts.map(([entity, count], idx) => {
        const opacity = maxOpacity - ((maxOpacity - minOpacity) * idx / (n > 1 ? n - 1 : 1));
        return (
          <div
            key={entity}
            className={cn(
              "flex items-center justify-between px-4 py-2 rounded-md font-medium text-white shadow transition-all",
              "hover:scale-105"
            )}
            style={{
              background: baseColor,
              opacity,
              minHeight: 38,
              fontSize: "1.05rem",
            }}
          >
            <span className="truncate font-semibold">{entity}</span>
            <span className="ml-3 text-xs font-mono bg-black/10 px-2 py-0.5 rounded">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

export default TopEntitiesList;
