
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TranslatableText } from "@/components/translation/TranslatableText";

interface ReferencesDisplayProps {
  references: any[];
  threadId?: string;
  totalEntriesAnalyzed?: number; // Add support for totalEntriesAnalyzed
}

const ReferencesDisplay: React.FC<ReferencesDisplayProps> = ({ 
  references,
  threadId,
  totalEntriesAnalyzed
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!references || references.length === 0) {
    return null;
  }
  
  // Use the provided total or fall back to references length
  const totalEntries = totalEntriesAnalyzed || references.length;
  const displayedEntries = Math.min(references.length, 3);

  return (
    <div className="mt-3 text-sm">
      <Button
        variant="ghost"
        size="sm"
        className="p-0 h-6 text-xs font-normal flex items-center gap-1 text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        <TranslatableText text={`Based on analyzing ${totalEntries} journal ${totalEntries === 1 ? 'entry' : 'entries'} (showing samples)`} />
        {expanded ? (
          <ChevronUp className="h-3 w-3 ml-1" />
        ) : (
          <ChevronDown className="h-3 w-3 ml-1" />
        )}
      </Button>
      
      {expanded && (
        <div className="mt-2 space-y-2 border-l-2 border-primary/20 pl-3">
          {references.slice(0, 3).map((ref, idx) => (
            <Card key={idx} className="p-2 text-xs">
              <div className="font-medium">
                {ref.date ? new Date(ref.date).toLocaleDateString() : "Unknown date"}
              </div>
              <p className="text-muted-foreground">{ref.snippet}</p>
            </Card>
          ))}
          {totalEntries > 3 && (
            <div className="text-xs text-muted-foreground">
              <TranslatableText text={`+ ${totalEntries - displayedEntries} more entries analyzed`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReferencesDisplay;
