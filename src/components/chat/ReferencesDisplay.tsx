
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { TimeAnalysis } from "@/services/chat";

interface ReferencesDisplayProps {
  references: any[];
  threadId?: string;
  timeAnalysis?: TimeAnalysis;
}

const ReferencesDisplay: React.FC<ReferencesDisplayProps> = ({ 
  references,
  threadId,
  timeAnalysis
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!references || references.length === 0) {
    return null;
  }

  // Display total number of references but only show a subset
  const visibleReferences = expanded ? references : references.slice(0, 3);
  const totalReferences = references.length;
  
  // Calculate total analyzed entries (shown + not shown)
  // If timeAnalysis is present, use that as the source of truth for total entries analyzed
  const totalEntriesAnalyzed = timeAnalysis?.totalEntries || totalReferences;

  // Extract date range if available
  const dates = references.map(ref => ref.date ? new Date(ref.date) : null).filter(Boolean);
  const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d ? d.getTime() : 0))) : null;
  const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d ? d.getTime() : 0))) : null;
  
  const dateRangeText = earliestDate && latestDate ? 
    `from ${earliestDate.toLocaleDateString()} to ${latestDate.toLocaleDateString()}` : 
    '';

  // Determine if this is likely a mental health related response
  const hasMentalHealthKeywords = references.some(ref => {
    if (!ref.emotions) return false;
    const emotionsList = Array.isArray(ref.emotions) 
      ? ref.emotions 
      : (typeof ref.emotions === 'object' ? Object.keys(ref.emotions) : []);
    
    const mentalHealthEmotions = ['anxiety', 'stress', 'depression', 'worry', 'fear', 'sadness', 'overwhelm'];
    return emotionsList.some(e => mentalHealthEmotions.includes(e.toLowerCase()));
  });

  // Format text differently based on query type and content
  const entryText = totalEntriesAnalyzed === totalReferences 
    ? `Based on ${totalReferences} journal ${totalReferences === 1 ? 'entry' : 'entries'} ${dateRangeText}`
    : `Based on ${totalEntriesAnalyzed} analyzed journal ${totalEntriesAnalyzed === 1 ? 'entry' : 'entries'} (showing ${totalReferences}) ${dateRangeText}`;

  return (
    <div className="mt-3 text-sm">
      <Button
        variant="ghost"
        size="sm"
        className="p-0 h-6 text-xs font-normal flex items-center gap-1 text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        <TranslatableText text={entryText} />
        {expanded ? (
          <ChevronUp className="h-3 w-3 ml-1" />
        ) : (
          <ChevronDown className="h-3 w-3 ml-1" />
        )}
      </Button>
      
      {expanded && (
        <div className="mt-2 space-y-2 border-l-2 border-primary/20 pl-3">
          {timeAnalysis && (
            <Card className={`p-2 text-xs ${hasMentalHealthKeywords ? 'bg-primary/10' : 'bg-muted/30'}`}>
              <div className="font-medium">Time Pattern Analysis</div>
              <div className="text-muted-foreground">
                <p>Peak journaling times: {timeAnalysis.peakHours.map(p => p.label).join(', ')}</p>
                <p className="mt-1">Journal entries by time of day:</p>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  <div className="text-center">
                    <div className="font-medium">Morning</div>
                    <div>{timeAnalysis.timePeriods.morning}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Afternoon</div>
                    <div>{timeAnalysis.timePeriods.afternoon}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Evening</div>
                    <div>{timeAnalysis.timePeriods.evening}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Night</div>
                    <div>{timeAnalysis.timePeriods.night}</div>
                  </div>
                </div>
              </div>
            </Card>
          )}
          
          {visibleReferences.map((ref, idx) => {
            // Determine if this entry contains strong emotions
            const hasStrongEmotions = ref.emotions && (
              (Array.isArray(ref.emotions) && ref.emotions.some(e => 
                ['anger', 'anxiety', 'sadness', 'fear', 'stress', 'depression'].includes(e.toLowerCase())
              )) || 
              (typeof ref.emotions === 'object' && Object.entries(ref.emotions)
                .some(([emotion, value]) => 
                  ['anger', 'anxiety', 'sadness', 'fear', 'stress', 'depression'].includes(emotion.toLowerCase()) && 
                  (value as number) > 0.6
                )
              )
            );
            
            return (
              <Card 
                key={idx} 
                className={`p-2 text-xs ${hasStrongEmotions ? 'border-primary/40' : ''}`}
              >
                <div className="font-medium">
                  {ref.date ? new Date(ref.date).toLocaleDateString() : "Unknown date"}
                </div>
                <p className="text-muted-foreground">{ref.snippet}</p>
                {ref.emotions && (
                  <div className={`text-xs mt-1 ${hasStrongEmotions ? 'text-primary-600 font-medium' : 'text-primary-600'}`}>
                    Emotions: {Array.isArray(ref.emotions) ? ref.emotions.join(', ') : 
                      (typeof ref.emotions === 'object' ? 
                        Object.entries(ref.emotions)
                          .sort((a, b) => (b[1] as number) - (a[1] as number))
                          .slice(0, 3)
                          .map(([emotion, value]) => `${emotion} (${Math.round((value as number) * 100)}%)`)
                          .join(', ') 
                        : ref.emotions)}
                  </div>
                )}
                {ref.themes && (
                  <div className="text-xs text-secondary-600 mt-1">
                    Themes: {Array.isArray(ref.themes) ? ref.themes.join(', ') : ref.themes}
                  </div>
                )}
              </Card>
            );
          })}
          {references.length > visibleReferences.length && !expanded && (
            <div className="text-xs text-muted-foreground">
              <TranslatableText text={`+ ${references.length - visibleReferences.length} more entries`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReferencesDisplay;
