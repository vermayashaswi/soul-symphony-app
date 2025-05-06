
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import ErrorBoundary from './ErrorBoundary';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { JournalEntry as JournalEntryType } from '@/types/journal';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { textWillOverflow } from '@/utils/textUtils';

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
  Edit_Status?: number | null;
  user_feedback?: string | null;
  "transcription text"?: string;
  "refined text"?: string;
  translation_text?: string;
  original_language?: string;
  tempId?: string;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
  isNew?: boolean;
  isProcessing?: boolean;
  processing?: boolean;
  processed?: boolean;
  setEntries?: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
  showDate?: boolean;
}

// Update the component signature
export function JournalEntryCard({ 
  entry, 
  onDelete, 
  isNew = false, 
  isProcessing = false,
  processing = false,
  processed = false,
  setEntries,
  showDate = false
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
    tempId: entry?.tempId
  };

  const [isExpanded, setIsExpanded] = useState(true); // Always expanded now
  const [showThemes, setShowThemes] = useState(false);
  const [highlightNew, setHighlightNew] = useState(isNew);
  const [hasError, setHasError] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [thumbsUp, setThumbsUp] = useState(false);
  const [thumbsDown, setThumbsDown] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const mountedRef = useRef<boolean>(true);
  
  // Initial check for content overflow
  useEffect(() => {
    if (safeEntry.content) {
      const overflow = textWillOverflow(safeEntry.content);
      setHasOverflow(overflow);
    }
  }, [safeEntry.content]);
  
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
  
  const getSentimentBorderClass = (): string => {
    if (!safeEntry.sentiment || isProcessing) {
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
      return 'border-[#FEF7CD] border-2';
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

  // This function is no longer needed as we're removing the expand/collapse button
  // but we'll keep it for other components that might use it
  const toggleExpanded = () => {
    console.log(`[JournalEntryCard] Toggling expansion for entry ${safeEntry.id}, current state:`, isExpanded);
    setIsExpanded(!isExpanded); // Will always be true now
  };

  const toggleThemes = () => {
    console.log(`[JournalEntryCard] Toggling themes visibility for entry ${safeEntry.id}, current state:`, showThemes);
    setShowThemes(!showThemes);
  };

  const handleUserFeedback = async (feedback: number) => {
    try {
      // Toggle thumbs state
      if (feedback === 1) {
        if (!thumbsUp) {
          setThumbsUp(true);
          setThumbsDown(false);
          toast.success('Glad you liked the translation');
        } else {
          setThumbsUp(false);
          // No toast when deselecting
        }
      } else {
        if (!thumbsDown) {
          setThumbsDown(true);
          setThumbsUp(false);
          toast.error("We'll try and improve on the translation");
        } else {
          setThumbsDown(false);
          // No toast when deselecting
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
      return formatShortDate(safeEntry.created_at);
    } catch (error) {
      console.error('[JournalEntryCard] Error formatting date:', error);
      return 'Recently';
    }
  })();
  
  const initialThemes = extractThemes();
  
  // Determine if this is a processing entry
  const isContentProcessing = processing || isProcessing || 
                            safeEntry.content === "Processing entry..." ||
                            safeEntry.content === "Loading...";
  
  const isThemesProcessing = isProcessing && !contentLoaded && 
                           (!safeEntry.themes || safeEntry.themes.length === 0) && 
                           (!safeEntry.master_themes || safeEntry.master_themes.length === 0);

  const handleEntryUpdate = (newContent: string) => {
    console.log(`[JournalEntryCard] Updating entry ${entry.id} with new content: "${newContent.substring(0, 30)}..."`);
    
    if (setEntries) {
      setEntries(prevEntries => {
        return prevEntries.map(e => {
          if (e.id === entry.id) {
            return {
              ...e,
              content: newContent,
              Edit_Status: 1,
              sentiment: null,
              emotions: null,
              master_themes: [],
              entities: []
            };
          }
          return e;
        });
      });
      
      setTimeout(() => {
        console.log('[JournalEntryCard] Triggering re-fetch for updated analysis data');
        
        window.dispatchEvent(new CustomEvent('journalEntryUpdated', {
          detail: { entryId: entry.id }
        }));
        
        const checkForUpdatedThemes = async () => {
          try {
            const { data, error } = await supabase
              .from('Journal Entries')
              .select('master_themes, emotions, sentiment, entities')
              .eq('id', entry.id)
              .single();
              
            if (error) {
              console.error('[JournalEntryCard] Error fetching updated entry data:', error);
              return false;
            }
            
            if (data) {
              if ((data.master_themes && data.master_themes.length > 0) || 
                  (data.emotions && Object.keys(data.emotions).length > 0)) {
                
                console.log('[JournalEntryCard] Found updated data for entry:', data);
                
                if (setEntries) {
                  setEntries(prevEntries => {
                    return prevEntries.map(e => {
                      if (e.id === entry.id) {
                        let parsedEntities: Array<{type: string, name: string, text?: string}> = [];
                        
                        if (data.entities) {
                          try {
                            if (Array.isArray(data.entities)) {
                              parsedEntities = data.entities.map((entity: any) => ({
                                type: entity.type || 'other',
                                name: entity.name || '',
                                text: entity.text
                              }));
                            }
                            else if (typeof data.entities === 'string') {
                              const parsed = JSON.parse(data.entities);
                              if (Array.isArray(parsed)) {
                                parsedEntities = parsed.map((entity: any) => ({
                                  type: entity.type || 'other',
                                  name: entity.name || '',
                                  text: entity.text
                                }));
                              }
                            }
                            else if (data.entities && typeof data.entities === 'object') {
                              // Handle case where data.entities is already a JSON object
                              const entities = Array.isArray(data.entities) ? data.entities : [data.entities];
                              parsedEntities = entities.map((entity: any) => ({
                                type: entity.type || 'other',
                                name: entity.name || '',
                                text: entity.text
                              }));
                            }
                          } catch (err) {
                            console.error('[JournalEntryCard] Error parsing entities:', err);
                            parsedEntities = [];
                          }
                        }
                        
                        return {
                          ...e,
                          master_themes: data.master_themes || [],
                          themes: data.master_themes || [],
                          sentiment: data.sentiment,
                          emotions: data.emotions,
                          entities: parsedEntities
                        };
                      }
                      return e;
                    });
                  });
                }
                
                return true;
              }
            }
            
            return false;
          } catch (err) {
            console.error('[JournalEntryCard] Error in checkForUpdatedThemes:', err);
            return false;
          }
        };
        
        let pollingAttempts = 0;
        const maxPollingAttempts = 10;
        
        const pollingInterval = setInterval(async () => {
          pollingAttempts++;
          
          const updated = await checkForUpdatedThemes();
          
          if (updated || pollingAttempts >= maxPollingAttempts) {
            clearInterval(pollingInterval);
            
            if (pollingAttempts >= maxPollingAttempts && !updated) {
              console.warn('[JournalEntryCard] Stopped polling for updated data after max attempts');
            }
          }
        }, 3000);
      }, 3000);
    }
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

  // If this is a processing entry, render a simplified card
  if (isContentProcessing && (safeEntry.content === "Processing entry..." || processing)) {
    console.log(`[JournalEntryCard] Rendering processing card for ${safeEntry.tempId || 'unknown'}`);
    
    return (
      <ErrorBoundary>
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
                    {formatShortDate(safeEntry.created_at)}
                  </h3>
                </div>
              </div>
            </div>

            <div className="p-3 md:p-4">
              <LoadingEntryContent />
            </div>
          </Card>
        </motion.div>
      </ErrorBoundary>
    );
  }

  const handleDelete = async () => {
    try {
      if (onDelete && safeEntry.id) {
        console.log(`[JournalEntryCard] Deleting entry ${safeEntry.id}`);
        // Call the parent's onDelete handler and ensure we return the promise
        return await onDelete(safeEntry.id);
      } else {
        throw new Error("Delete handler not available or invalid entry ID");
      }
    } catch (error) {
      console.error("[JournalEntryCard] Error during deletion:", error);
      throw error; // Propagate the error to be handled by the dialog
    }
  };

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
                  {createdAtFormatted}
                </h3>
                {entry.Edit_Status === 1 && (
                  <span className="text-xs text-muted-foreground">(edited)</span>
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
                onDelete={async () => {
                  return new Promise<void>(async (resolve, reject) => {
                    try {
                      if (onDelete && safeEntry.id) {
                        // Call the parent's onDelete handler
                        await onDelete(safeEntry.id);
                        resolve();
                      } else {
                        reject(new Error("Delete handler not available"));
                      }
                    } catch (error) {
                      console.error("[JournalEntryCard] Error during deletion:", error);
                      reject(error);
                    }
                  });
                }} 
              />
            </div>
          </div>

          <div className="p-3 md:p-4">
            <ErrorBoundary>
              <EntryContent 
                content={safeEntry.content} 
                isExpanded={isExpanded} 
                isProcessing={isContentProcessing}
                entryId={safeEntry.id}
                onOverflowChange={handleContentOverflow}
              />
            </ErrorBoundary>
            
            {showThemes && (
              <div className="mt-2">
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
        </Card>
      </motion.div>
    </ErrorBoundary>
  );
}

export default JournalEntryCard;
