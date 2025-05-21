
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TranslatableText } from "@/components/translation/TranslatableText";

interface ReferencesDisplayProps {
  references: any[];
  threadId?: string;
}

const ReferencesDisplay: React.FC<ReferencesDisplayProps> = ({ 
  references,
  threadId
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!references || references.length === 0) {
    return null;
  }

  // Display total number of references but only show a subset
  const visibleReferences = expanded ? references : references.slice(0, 3);
  const totalReferences = references.length;

  // Extract date range if available
  const dates = references.map(ref => ref.date ? new Date(ref.date) : null).filter(Boolean);
  const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d ? d.getTime() : 0))) : null;
  const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d ? d.getTime() : 0))) : null;
  
  const dateRangeText = earliestDate && latestDate ? 
    `from ${earliestDate.toLocaleDateString()} to ${latestDate.toLocaleDateString()}` : 
    '';

  return (
    <div className="mt-3 text-sm">
      <Button
        variant="ghost"
        size="sm"
        className="p-0 h-6 text-xs font-normal flex items-center gap-1 text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        <TranslatableText text={`Based on ${totalReferences} journal ${totalReferences === 1 ? 'entry' : 'entries'} ${dateRangeText}`} />
        {expanded ? (
          <ChevronUp className="h-3 w-3 ml-1" />
        ) : (
          <ChevronDown className="h-3 w-3 ml-1" />
        )}
      </Button>
      
      {expanded && (
        <div className="mt-2 space-y-2 border-l-2 border-primary/20 pl-3">
          {visibleReferences.map((ref, idx) => (
            <Card key={idx} className="p-2 text-xs">
              <div className="font-medium">
                {ref.date ? new Date(ref.date).toLocaleDateString() : "Unknown date"}
              </div>
              <p className="text-muted-foreground">{ref.snippet}</p>
              {ref.emotions && (
                <div className="text-xs text-primary-600 mt-1">
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
          ))}
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
