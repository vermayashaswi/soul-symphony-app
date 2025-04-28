
import React, { useState } from 'react';
import { JournalEntry } from '@/types/journal';
import { EntryContent } from './entry-card/EntryContent';
import DeleteEntryDialog from './entry-card/DeleteEntryDialog';
import { format } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Clock, Volume2 } from 'lucide-react';
import SentimentMeter from './entry-card/SentimentMeter';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Loader2 } from 'lucide-react';

interface JournalEntryCardProps {
  entry: JournalEntry;
  processing?: boolean;
  processed?: boolean;
  onDelete: (entryId: number) => Promise<void>;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
  entry,
  processing = false,
  processed = false,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDeleteEntry = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      console.log(`[JournalEntryCard] Deleting entry with ID: ${entry.id}`);
      await onDelete(entry.id);
    } catch (error) {
      console.error(`[JournalEntryCard] Error deleting entry ${entry.id}:`, error);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Format date with fallback
  const formatCreatedDate = () => {
    try {
      if (!entry.created_at) return 'Unknown date';
      return format(new Date(entry.created_at), 'MMM d, yyyy • h:mm a');
    } catch (e) {
      console.error('[JournalEntryCard] Error formatting date:', e);
      return 'Invalid date';
    }
  };

  return (
    <Card className={`transition-all duration-200 ${processed ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock size={12} className="mr-1" />
            <span>{formatCreatedDate()}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {entry.audio_url && (
              <button className="text-gray-500 hover:text-blue-500">
                <Volume2 size={16} />
              </button>
            )}
            
            {isDeleting ? (
              <Loader2 size={16} className="animate-spin text-red-500" />
            ) : (
              <DeleteEntryDialog onDelete={handleDeleteEntry} isProcessing={processing} />
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 px-4">
        <EntryContent
          content={entry.content || ""}
          isExpanded={isExpanded}
          isProcessing={processing}
        />
      </CardContent>
      
      <CardFooter className="px-4 pt-0 pb-2 flex items-center justify-between">
        <SentimentMeter sentiment={entry.sentiment || 'neutral'} />
        
        <Button
          variant="ghost"
          size="sm"
          className="text-xs p-0 h-auto flex items-center"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <TranslatableText text={isExpanded ? "Show less" : "Show more"} />
          {isExpanded ? (
            <ChevronUp className="h-3 w-3 ml-1" />
          ) : (
            <ChevronDown className="h-3 w-3 ml-1" />
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default JournalEntryCard;
