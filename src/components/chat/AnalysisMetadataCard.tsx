
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp, BarChart3, Calendar, Brain } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';

interface AnalysisMetadataProps {
  metadata: {
    entriesAnalyzed: number;
    totalEntries: number;
    dateRange: {
      earliest: Date | null;
      latest: Date | null;
    };
    subQuestionsUsed: number;
    analysisApproaches: string[];
  };
}

export const AnalysisMetadataCard: React.FC<AnalysisMetadataProps> = ({ metadata }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme } = useTheme();

  if (!metadata) return null;

  const formatDateRange = () => {
    if (!metadata.dateRange.earliest || !metadata.dateRange.latest) return 'Various dates';
    
    const earliest = new Date(metadata.dateRange.earliest);
    const latest = new Date(metadata.dateRange.latest);
    
    const sameMonth = earliest.getMonth() === latest.getMonth() && 
                     earliest.getFullYear() === latest.getFullYear();
    
    if (sameMonth) {
      return `${earliest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    } else {
      return `${earliest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${latest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }
  };

  return (
    <Card className="mb-3 border-opacity-30 bg-opacity-50 backdrop-blur-sm">
      <CardContent className="p-3">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className={`h-4 w-4 text-${theme.primary}`} />
            <span className="text-sm font-medium">
              Analyzed {metadata.entriesAnalyzed} journal entries
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              <span>Date range: {formatDateRange()}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Brain className="h-3 w-3" />
              <span>Analysis approaches: {metadata.subQuestionsUsed}</span>
            </div>
            
            {metadata.analysisApproaches && metadata.analysisApproaches.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium mb-1">Analysis methods used:</div>
                <div className="space-y-1">
                  {metadata.analysisApproaches.map((approach, index) => (
                    <div key={index} className="text-xs pl-2 border-l-2 border-opacity-30" style={{ borderColor: `var(--${theme.primary})` }}>
                      {approach}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
