import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { formatShortDate } from '@/utils/format-time';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FloatingDotsToggle, 
  SentimentMeter, 
  ThemeLoader, 
  DeleteEntryDialog,
  EntryContent
} from './entry-card';
import { EditEntryButton } from './entry-card/EditEntryButton';
import ErrorBoundary from './ErrorBoundary';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

export interface JournalEntry {
  id: number;
  content: string;
  created_at: string;
  audio_url?: string;
  sentiment?: string | null;
  themes?: string[] | null;
  master_themes?: string[];
  entities?: Array<{
    type: string;
    name: string;
    text?: string;
  }>;
  foreignKey?: string;
  predictedLanguages?: {
    [key: string]: number;
  } | null;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
  isNew?: boolean;
  isProcessing?: boolean;
}

export function JournalEntryCard({ 
  entry, 
  onDelete, 
  isNew = false, 
  isProcessing = false 
}: JournalEntryCardProps) {
  const safeEntry = {
    id: entry?.id || 0,
    content: entry?.content || "Processing entry...",
    created_at: entry?.created_at || new Date().toISOString(),
    sentiment: entry?.sentiment || null,
    master_themes: Array.isArray(entry?.master_themes) ? entry.master_themes : [],
    themes: Array.isArray(entry?.themes) ? entry.themes : []
  };

  const [isExpanded, setIsExpanded] = useState(isNew);
  const [showThemes, setShowThemes] = useState(isNew);
  const [highlightNew, setHighlightNew] = useState(isNew);
  const [deletionCompleted, setDeletionCompleted] = useState(false);
  const [deletionInProgress, setDeletionInProgress] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const mountedRef = useRef<boolean>(true);
  
  const extractThemes = (): string[] => {
    try {
      const masterThemes = Array.isArray(safeEntry.master_themes) ? safeEntry.master_themes : [];
      const entryThemes = Array.isArray(safeEntry.themes) ? safeEntry.themes : [];
      
      const filteredMasterThemes = masterThemes.filter(theme => 
        theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
      );
      const filteredEntryThemes = entryThemes.filter(theme => 
        theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
      );
      
      if (filteredMasterThemes.length > 0) {
        return filteredMasterThemes;
      } else if (filteredEntryThemes.length > 0) {
        return filteredEntryThemes;
      }
      
      return [];
    } catch (error) {
      console.error("[JournalEntryCard] Error extracting themes:", error);
      return [];
    }
  };
  
  useEffect(() => {
    const hasValidContent = safeEntry.content && 
                         safeEntry.content !== "Processing entry..." && 
                         safeEntry.content !== "Loading..." &&
                         safeEntry.content.trim() !== "";
    
    console.log(`[JournalEntryCard] Entry ${safeEntry.id} content status:`, {
      hasValidContent,
      contentLength: safeEntry.content?.length || 0,
      isProcessing
    });
    
    setContentLoaded(hasValidContent);
    
    if (isNew && hasValidContent && !isExpanded) {
      setIsExpanded(true);
    }
  }, [safeEntry.content, isNew, isExpanded, isProcessing]);
  
  useEffect(() => {
    console.log(`[JournalEntryCard] Mounted entry ${safeEntry.id}`);
    mountedRef.current = true;
    
    return () => {
      console.log(`[JournalEntryCard] Unmounted entry ${safeEntry.id}`);
      mountedRef.current = false;
    };
  }, [safeEntry.id]);

  useEffect(() => {
    if (isNew) {
      setIsExpanded(true);
      setHighlightNew(true);
      
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setHighlightNew(false);
        }
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const toggleExpanded = () => {
    console.log(`[JournalEntryCard] Toggling expansion for entry ${safeEntry.id}, current state:`, isExpanded);
    setIsExpanded(!isExpanded);
  };

  const toggleThemes = () => {
    console.log(`[JournalEntryCard] Toggling themes visibility for entry ${safeEntry.id}, current state:`, showThemes);
    setShowThemes(!showThemes);
  };

  const handleDelete = async () => {
    if (!safeEntry.id || deletionCompleted || deletionInProgress) {
      console.log(`[JournalEntryCard] Skipping deletion for entry ${safeEntry.id} - already completed or in progress`);
      return;
    }
    
    try {
      console.log(`[JournalEntryCard] Starting deletion of entry ${safeEntry.id}`);
      
      setDeletionInProgress(true);
      
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', safeEntry.id);
        
      if (error) {
        throw error;
      }
      
      console.log(`[JournalEntryCard] Successfully deleted entry ${safeEntry.id} from database`);
      
      setDeletionCompleted(true);
      
      if (onDelete && mountedRef.current) {
        console.log(`[JournalEntryCard] Calling onDelete for entry ${safeEntry.id}`);
        onDelete(safeEntry.id);
      }
      
      toast.success('Journal entry deleted');
    } catch (error) {
      console.error('[JournalEntryCard] Error deleting journal entry:', error);
      
      if (mountedRef.current) {
        setDeletionInProgress(false);
        setDeletionCompleted(false);
        setHasError(true);
      }
      
      toast.error('Failed to delete entry');
      
      if (onDelete && mountedRef.current) {
        console.log(`[JournalEntryCard] Calling onDelete after error for entry ${safeEntry.id}`);
        setTimeout(() => {
          if (mountedRef.current) {
            onDelete(safeEntry.id);
          }
        }, 100);
      }
    }
  };

  const handleUserFeedback = async (feedback: number) => {
    try {
      const { error } = await supabase
        .from('Journal Entries')
        .update({ user_feedback: feedback })
        .eq('id', safeEntry.id);
    
      if (error) {
        console.error('Error saving user feedback:', error);
        toast.error('Failed to save feedback');
      } else {
        toast.success('Thank you for your feedback!');
      }
    } catch (error) {
      console.error('Unexpected error saving feedback:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleRefresh = () => {
    if (onDelete) {
      console.log(`[JournalEntryCard] Refreshing entry ${safeEntry.id}`);
      onDelete(safeEntry.id);
    }
  };

  const createdAtFormatted = (() => {
    try {
      return formatShortDate(safeEntry.created_at);
    } catch (error) {
      console.error('[JournalEntryCard] Error formatting date:', error);
      return 'Recently';
    }
  })();
  
  const initialThemes = extractThemes();
  
  const isContentProcessing = isProcessing && (!contentLoaded || !safeEntry.content || 
                                              safeEntry.content === "Processing entry..." ||
                                              safeEntry.content === "Loading...");
  
  const isSentimentProcessing = isProcessing && !safeEntry.sentiment && !contentLoaded;
  const isThemesProcessing = isProcessing && !contentLoaded && 
                           (!safeEntry.themes || safeEntry.themes.length === 0) && 
                           (!safeEntry.master_themes || safeEntry.master_themes.length === 0);

  if (hasError) {
    return (
      <Card className="bg-background shadow-md border-red-300">
        <div className="p-4">
          <h3 className="text-red-600">Error displaying entry</h3>
          <p className="text-sm mt-2">There was a problem showing this entry.</p>
          <button 
            className="text-sm mt-2 text-blue-600 underline" 
            onClick={() => setHasError(false)}
          >
            Try again
          </button>
        </div>
      </Card>
    );
  }

  return (
    <ErrorBoundary>
      <motion.div
        initial={isNew ? { borderColor: 'rgba(var(--color-primary), 0.7)' } : {}}
        animate={highlightNew 
          ? { 
              borderColor: ['rgba(var(--color-primary), 0.7)', 'rgba(var(--color-primary), 0)'],
              boxShadow: ['0 0 15px rgba(var(--color-primary), 0.3)', '0 0 0px rgba(var(--color-primary), 0)']
            } 
          : {}}
        transition={{ duration: 3 }}
        className="journal-entry-card" 
        data-entry-id={safeEntry.id}
        data-processing={isProcessing ? "true" : "false"}
        data-expanded={isExpanded ? "true" : "false"}
        data-show-themes={showThemes ? "true" : "false"}
      >
        <Card className={`bg-background shadow-md ${highlightNew ? 'border-primary' : ''}`}>
          <div className="flex justify-between items-start p-3 md:p-4">
            <div className="flex items-center space-x-3">
              <h3 className="scroll-m-20 text-base md:text-lg font-semibold tracking-tight">{createdAtFormatted}</h3>
              <ErrorBoundary>
                <SentimentMeter 
                  sentiment={safeEntry.sentiment} 
                  isProcessing={isSentimentProcessing}
                />
              </ErrorBoundary>
            </div>

            <div className="flex items-center space-x-2 md:space-x-3">
              <FloatingDotsToggle 
                onClick={toggleThemes} 
                isExpanded={showThemes}
              />
              <EditEntryButton 
                entryId={safeEntry.id}
                content={safeEntry.content}
                onEntryUpdated={handleRefresh}
              />
              <DeleteEntryDialog onDelete={handleDelete} />
            </div>
          </div>

          <div className="p-3 md:p-4">
            <ErrorBoundary>
              <EntryContent 
                content={safeEntry.content} 
                isExpanded={isExpanded} 
                isProcessing={isContentProcessing}
              />
            </ErrorBoundary>
            
            {showThemes && (
              <div>
                <div className="mt-3 mb-2 flex items-center space-x-2">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleUserFeedback(1)}
                      className="text-green-500 hover:bg-green-100 p-1 rounded-full"
                      aria-label="Thumbs up for translation"
                    >
                      <ThumbsUp size={16} />
                    </button>
                    <button
                      onClick={() => handleUserFeedback(0)}
                      className="text-red-500 hover:bg-red-100 p-1 rounded-full"
                      aria-label="Thumbs down for translation"
                    >
                      <ThumbsDown size={16} />
                    </button>
                  </div>
                </div>
                
                <ErrorBoundary>
                  <ThemeLoader 
                    entryId={safeEntry.id}
                    initialThemes={initialThemes}
                    content={safeEntry.content}
                    isProcessing={isThemesProcessing}
                    isNew={isNew}
                  />
                </ErrorBoundary>
              </div>
            )}
          </div>

          <div className="flex justify-end p-2">
            <button
              onClick={toggleExpanded}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? '' : 'Show more'}
            </button>
          </div>
        </Card>
      </motion.div>
    </ErrorBoundary>
  );
}

export default JournalEntryCard;
