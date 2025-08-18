import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { formatShortDate } from '@/utils/format-time';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FloatingDotsToggle, 
  ThemeLoader, 
  DeleteEntryDialog,
  EntryContent,
  LoadingEntryContent
} from './entry-card';
import { EditEntryButton } from './entry-card/EditEntryButton';
import { JournalErrorBoundary } from './ErrorBoundary';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { JournalEntry } from '@/types/journal';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { textWillOverflow } from '@/utils/textUtils';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
  isNew?: boolean;
  isProcessing?: boolean;
  processing?: boolean;
  processed?: boolean;
  setEntries?: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
}

export function JournalEntryCard({ 
  entry, 
  onDelete, 
  isNew = false, 
  isProcessing = false,
  processing = false,
  processed = false,
  setEntries
}: JournalEntryCardProps) {
  const safeEntry = {
    id: entry?.id || 0,
    content: entry?.content || "Processing entry...",
    created_at: entry?.created_at || new Date().toISOString(),
    sentiment: entry?.sentiment || null,
    master_themes: Array.isArray(entry?.master_themes) ? entry.master_themes : [],
    themes: Array.isArray(entry?.themes) ? entry.themes : [],
    Edit_Status: entry?.Edit_Status || null,
    user_feedback: entry?.user_feedback || null,
    translation_text: entry?.translation_text,
    original_language: entry?.original_language,
    tempId: entry?.tempId,
    emotions: entry?.emotions || null
  };

  const [isExpanded, setIsExpanded] = useState(true);
  const [showThemes, setShowThemes] = useState(false);
  const [highlightNew, setHighlightNew] = useState(isNew);
  const [hasError, setHasError] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [thumbsUp, setThumbsUp] = useState(false);
  const [thumbsDown, setThumbsDown] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);  // Add state to track if this entry has been deleted
  const mountedRef = useRef<boolean>(true);
  
  // Initial check for content overflow
  useEffect(() => {
    if (safeEntry.content) {
      const overflow = textWillOverflow(safeEntry.content);
      setHasOverflow(overflow);
    }
  }, [safeEntry.content]);
  
  // Listen for global deletion events
  useEffect(() => {
    const handleEntryDeleted = (event: CustomEvent) => {
      if (event.detail && event.detail.entryId === safeEntry.id) {
        console.log(`[JournalEntryCard] Detected deletion event for this entry: ${safeEntry.id}`);
        setIsDeleted(true);
      }
    };
    
    window.addEventListener('journalEntryDeleted', handleEntryDeleted as EventListener);
    
    return () => {
      window.removeEventListener('journalEntryDeleted', handleEntryDeleted as EventListener);
    };
  }, [safeEntry.id]);
  
  // If this entry has been marked as deleted, don't render it
  if (isDeleted) {
    console.log(`[JournalEntryCard] Not rendering deleted entry: ${safeEntry.id}`);
    return null;
  }
  
  const extractThemes = (): string[] => {
    try {
      // Prioritize themes column for display (specific themes)
      const specificThemes = Array.isArray(safeEntry.themes) ? safeEntry.themes : [];
      const masterThemes = Array.isArray(safeEntry.master_themes) ? safeEntry.master_themes : [];
      
      // Filter specific themes first
      const filteredSpecificThemes = specificThemes.filter(theme => 
        theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
      );
      
      // If we have specific themes, use those
      if (filteredSpecificThemes.length > 0) {
        console.log('[JournalEntryCard] Using specific themes for display:', filteredSpecificThemes);
        return filteredSpecificThemes;
      }
      
      // Fallback to master_themes for backward compatibility
      const filteredMasterThemes = masterThemes.filter(theme => 
        theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
      );
      
      if (filteredMasterThemes.length > 0) {
        console.log('[JournalEntryCard] Fallback to master_themes for display:', filteredMasterThemes);
        return filteredMasterThemes;
      }
      
      return [];
    } catch (error) {
      console.error("[JournalEntryCard] Error extracting themes:", error);
      return [];
    }
  };
  
  const getSentimentBorderClass = (): string => {
    // Fixed: Handle sentiment value 0 (neutral) properly - don't treat as falsy
    if (safeEntry.sentiment === null || safeEntry.sentiment === undefined || isProcessing) {
      return '';
    }

    let score = 0;
    try {
      if (typeof safeEntry.sentiment === 'string') {
        score = parseFloat(safeEntry.sentiment);
      } else if (typeof safeEntry.sentiment === 'object' && safeEntry.sentiment !== null) {
        score = (safeEntry.sentiment as any).score || 0;
      }
    } catch (error) {
      console.error("[JournalEntryCard] Error parsing sentiment score:", error);
      return '';
    }

    if (score > 0.2) {
      return 'border-green-500 border-2';
    } else if (score >= -0.1 && score <= 0.2) {
      return 'border-yellow-400 border-2';
    } else {
      return 'border-[#ea384c] border-2';
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
      isProcessing,
      processing,
      tempId: safeEntry.tempId
    });
    
    setContentLoaded(hasValidContent);
  }, [safeEntry.content, isProcessing, processing]);
  
  useEffect(() => {
    console.log(`[JournalEntryCard] Mounted entry ${safeEntry.id} with tempId ${safeEntry.tempId}`);
    mountedRef.current = true;
    
    return () => {
      console.log(`[JournalEntryCard] Unmounted entry ${safeEntry.id} with tempId ${safeEntry.tempId}`);
      mountedRef.current = false;
    };
  }, [safeEntry.id, safeEntry.tempId]);

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

  const handleUserFeedback = async (feedback: number) => {
    try {
      if (feedback === 1) {
        if (!thumbsUp) {
          setThumbsUp(true);
          setThumbsDown(false);
          toast.success('Glad you liked the translation');
        } else {
          setThumbsUp(false);
        }
      } else {
        if (!thumbsDown) {
          setThumbsDown(true);
          setThumbsUp(false);
          toast.error("We'll try and improve on the translation");
        } else {
          setThumbsDown(false);
        }
      }
      
      const { error } = await supabase
        .from('Journal Entries')
        .update({ user_feedback: feedback.toString() })
        .eq('id', safeEntry.id);
    
      if (error) {
        console.error('Error saving user feedback:', error);
        toast.error('Failed to save feedback');
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
      if (!safeEntry.created_at) {
        console.error('[JournalEntryCard] Invalid created_at:', safeEntry.created_at);
        return { type: 'translatable' as const, text: 'Recently' };
      }
      
      const formatted = formatShortDate(safeEntry.created_at);
      return formatted;
    } catch (error) {
      console.error('[JournalEntryCard] Error formatting date:', error, 'Input:', safeEntry.created_at);
      return { type: 'translatable' as const, text: 'Recently' };
    }
  })();

  const initialThemes = extractThemes();
  
  const isContentProcessing = processing || isProcessing || 
                            safeEntry.content === "Processing entry..." ||
                            safeEntry.content === "Loading...";
  
  const isThemesProcessing = isProcessing && !contentLoaded && 
                           (!safeEntry.themes || safeEntry.themes.length === 0) && 
                           (!safeEntry.master_themes || safeEntry.master_themes.length === 0);

  const handleEntryUpdate = (newContent: string, isProcessing?: boolean) => {
    console.log(`[JournalEntryCard] Updating entry ${entry.id} with new content: "${newContent.substring(0, 30)}..."`);
    
    if (setEntries) {
      setEntries(prevEntries => {
        return prevEntries.map(e => {
          if (e.id === entry.id) {
            return {
              ...e,
              content: newContent,
              'refined text': newContent,
              'transcription text': newContent,
              Edit_Status: 1,
              sentiment: isProcessing ? null : e.sentiment,
              emotions: isProcessing ? null : e.emotions,
              master_themes: isProcessing ? [] : e.master_themes,
              entities: isProcessing ? [] : e.entities
            };
          }
          return e;
        });
      });
    }
    
    console.log('[JournalEntryCard] Entry update completed, refresh events will handle the rest');
  };

  const handleContentOverflow = (overflow: boolean) => {
    setHasOverflow(overflow);
  };

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

  if (isContentProcessing && (safeEntry.content === "Processing entry..." || processing)) {
    console.log(`[JournalEntryCard] Rendering processing card for ${safeEntry.tempId || 'unknown'}`);
    
    return (
      <JournalErrorBoundary>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="journal-entry-card" 
          data-entry-id={safeEntry.id}
          data-temp-id={safeEntry.tempId}
          data-processing="true"
        >
          <Card className="bg-background shadow-md">
            <div className="flex justify-between items-center p-3 md:p-4">
              <div className="flex items-center space-x-3">
                <div className="flex flex-col">
                  <h3 className="scroll-m-20 text-base md:text-lg font-semibold tracking-tight">
                    <TranslatableText 
                      text={createdAtFormatted.text} 
                      forceTranslate={createdAtFormatted.type === 'translatable'}
                    />
                  </h3>
                </div>
              </div>
            </div>

            <div className="p-3 md:p-4">
              <LoadingEntryContent />
            </div>
          </Card>
        </motion.div>
      </JournalErrorBoundary>
    );
  }

  const handleDelete = async () => {
    try {
      if (onDelete && safeEntry.id) {
        console.log(`[JournalEntryCard] Deleting entry ${safeEntry.id}`);
        
        setIsDeleted(true);
        
        return await onDelete(safeEntry.id);
      } else {
        throw new Error("Delete handler not available or invalid entry ID");
      }
    } catch (error) {
      console.error("[JournalEntryCard] Error during deletion:", error);
      
      setIsDeleted(false);
      
      throw error;
    }
  };

  return (
    <JournalErrorBoundary>
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
        data-temp-id={safeEntry.tempId}
        data-processing={isProcessing ? "true" : "false"}
        data-expanded={isExpanded ? "true" : "false"}
        data-show-themes={showThemes ? "true" : "false"}
      >
        <Card className={`bg-background shadow-md ${highlightNew ? 'border-primary' : ''} ${getSentimentBorderClass()}`}>
          <div className="flex justify-between items-center p-3 md:p-4">
            <div className="flex items-center space-x-3">
              <div className="flex flex-col">
                <h3 className="scroll-m-20 text-base md:text-lg font-semibold tracking-tight">
                  <TranslatableText 
                    text={createdAtFormatted.text} 
                    forceTranslate={createdAtFormatted.type === 'translatable'}
                  />
                </h3>
                {entry.Edit_Status === 1 && (
                  <span className="text-xs text-muted-foreground">
                    <TranslatableText text="(edited)" forceTranslate={true} />
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <FloatingDotsToggle 
                onClick={toggleThemes} 
                isExpanded={showThemes}
              />
              <EditEntryButton 
                entryId={safeEntry.id}
                content={safeEntry.content}
                onEntryUpdated={handleEntryUpdate}
              />
              <DeleteEntryDialog 
                onDelete={handleDelete} 
              />
            </div>
          </div>

          <div className="p-3 md:p-4">
            <JournalErrorBoundary>
              <EntryContent 
                content={safeEntry.content} 
                isExpanded={isExpanded} 
                isProcessing={isContentProcessing}
                entryId={safeEntry.id}
                onOverflowChange={handleContentOverflow}
              />
            </JournalErrorBoundary>
            
            {showThemes && (
              <div className="mt-2">
                <JournalErrorBoundary>
                  <ThemeLoader 
                    entryId={safeEntry.id}
                    initialThemes={initialThemes}
                    content={safeEntry.content}
                    isProcessing={isThemesProcessing}
                    isNew={isNew}
                  />
                </JournalErrorBoundary>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </JournalErrorBoundary>
  );
}

export default JournalEntryCard;
