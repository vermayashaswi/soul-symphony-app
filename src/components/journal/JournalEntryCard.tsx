
import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry } from '@/types/journal';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, MessageSquare } from 'lucide-react';
import SentimentEmoji from './entry-card/SentimentEmoji';
import SentimentMeter from './entry-card/SentimentMeter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ThemeBoxes from './ThemeBoxes';
import { EntryContent } from './entry-card/EntryContent';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';
import { FloatingDotsToggle } from './entry-card/FloatingDotsToggle';
import { DeleteEntryDialog } from './entry-card/DeleteEntryDialog';
import { TranslatableText } from '@/components/translation/TranslatableText';
import TranslatedContent from './entry-card/TranslatedContent';
import { EditEntryButton } from './entry-card/EditEntryButton';
import { ExtractThemeButton } from './entry-card/ExtractThemeButton';

interface JournalEntryCardProps {
  entry: JournalEntry;
  processing?: boolean;
  processed?: boolean;
  onDelete: (id: number) => void;
  tempId?: string;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ 
  entry, 
  processing = false, 
  processed = false,
  onDelete,
  tempId
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSentiment, setShowSentiment] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isDotsExpanded, setIsDotsExpanded] = useState(false); // State for dots toggle
  const cardRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(processing);
  
  // NEW: Add data-temp-id attribute if tempId is provided
  const attributes: any = tempId ? { 'data-temp-id': tempId } : {};
  
  // Add data-processing attributes for debugging
  if (processing) {
    attributes['data-processing'] = "true";
  }
  
  // Mark processed entries
  if (processed) {
    attributes['data-processed'] = "true";
  }
  
  // Track when processing state changes
  useEffect(() => {
    if (processingRef.current && !processing) {
      // Processing finished, animate or update UI if needed
      console.log(`[JournalEntryCard] Entry ${entry.id} finished processing`);
    }
    processingRef.current = processing;
  }, [processing, entry.id]);

  // Format date display
  const dateDisplay = entry.created_at ? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true }) : '';
  
  const handleDeleteEntry = async () => {
    if (isDeleting || entry.id < 0) return; // Prevent deletion during processing
    
    try {
      setIsDeleting(true);
      console.log(`[JournalEntryCard] Handling delete for entry: ${entry.id}`);
      
      if (!entry.id) {
        console.error("[JournalEntryCard] Invalid entry ID for deletion");
        return;
      }
      
      // Call the parent component's delete handler
      await onDelete(entry.id);
    } catch (error) {
      console.error(`[JournalEntryCard] Error when deleting entry ${entry.id}:`, error);
      setHasError(true);
      throw error; // Re-throw to let DeleteEntryDialog handle the error display
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle toggle click for the dots animation
  const handleDotsToggle = () => {
    setIsDotsExpanded(prev => !prev);
  };

  // Extract content for passing to child components
  const entryContent = entry.content || entry["refined text"] || entry["transcription text"] || "";

  return (
    <Card 
      className={`p-4 journal-entry-card relative ${processing ? 'border-primary/50 shadow-md' : ''} ${processed ? 'border-green-500/50' : ''}`}
      ref={cardRef}
      {...attributes}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-medium">{dateDisplay}</h3>
          
          <div className="flex items-center text-muted-foreground text-sm mt-1">
            {entry.duration && !processing && (
              <div className="flex items-center mr-3" title="Recording duration">
                <MessageSquare className="w-3 h-3 mr-1" />
                <span>{Math.round(Number(entry.duration))}s</span>
              </div>
            )}
            
            {!processing && entry.sentiment && showSentiment && (
              <div className="flex items-center gap-1">
                <SentimentEmoji sentiment={entry.sentiment} />
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          {!processing && (
            <>
              <FloatingDotsToggle 
                onClick={handleDotsToggle} 
                isExpanded={isDotsExpanded}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground">
                    <MoreHorizontal size={18} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <ExtractThemeButton entryId={entry.id} />
                  <EditEntryButton 
                    entryId={entry.id} 
                    content={entryContent} 
                    onEntryUpdated={(newContent, isProcessing) => {
                      // This callback will be called when the entry is updated
                      console.log(`Entry ${entry.id} updated with new content`);
                    }}
                  />
                  <DropdownMenuItem className="cursor-pointer text-red-500" asChild>
                    <DeleteEntryDialog onDelete={handleDeleteEntry} isDeleting={isDeleting} />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
      
      {processing ? (
        <LoadingEntryContent error={loadingError} />
      ) : (
        <>
          {entry.original_language && entry.original_language !== 'en' ? (
            <TranslatedContent 
              originalContent={entryContent} 
              translatedContent={entry.translation_text || ""} 
              language={entry.original_language} 
            />
          ) : (
            <EntryContent 
              content={entryContent} 
              entryId={entry.id}
            />
          )}
          
          {showSentiment && entry.sentiment && (
            <div className="mt-2">
              <SentimentMeter sentiment={typeof entry.sentiment === 'string' ? entry.sentiment : entry.sentiment.toString()} />
            </div>
          )}
          
          {entry.master_themes && entry.master_themes.length > 0 && (
            <div className="mt-3">
              <ThemeBoxes themes={entry.master_themes} />
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default JournalEntryCard;
