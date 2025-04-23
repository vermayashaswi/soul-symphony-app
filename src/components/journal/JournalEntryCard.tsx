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
  EntryContent
} from './entry-card';
import { EditEntryButton } from './entry-card/EditEntryButton';
import ErrorBoundary from './ErrorBoundary';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Trash, X } from "lucide-react";
import { JournalEntry as JournalEntryType, Json } from '@/types/journal';

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
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
  isNew?: boolean;
  isProcessing?: boolean;
  setEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
}

export function JournalEntryCard({ 
  entry, 
  onDelete, 
  isNew = false, 
  isProcessing = false,
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
    user_feedback: entry?.user_feedback || null
  };

  const [isExpanded, setIsExpanded] = useState(isNew);
  const [showThemes, setShowThemes] = useState(false);
  const [highlightNew, setHighlightNew] = useState(isNew);
  const [deletionCompleted, setDeletionCompleted] = useState(false);
  const [deletionInProgress, setDeletionInProgress] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [thumbsUp, setThumbsUp] = useState(false);
  const [thumbsDown, setThumbsDown] = useState(false);
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

  const handleMakeNull = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/functions/v1/temporary",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(window?.localStorage?.getItem("sb-access-token")
              ? { Authorization: `Bearer ${window.localStorage.getItem("sb-access-token")}` }
              : {}),
          },
          body: JSON.stringify({
            action: "make_null",
            entryId: entry.id,
          }),
        }
      );

      if (!response.ok) {
        toast.error("Failed to set fields as null");
        return;
      }

      // Refresh the entry
      toast.success("Emotions and entities cleared for this entry!");
      if (onDelete) {
        onDelete(entry.id);
      }
    } catch (error) {
      toast.error("Error: Could not clear fields.");
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
  
  const isThemesProcessing = isProcessing && !contentLoaded && 
                           (!safeEntry.themes || safeEntry.themes.length === 0) && 
                           (!safeEntry.master_themes || safeEntry.master_themes.length === 0);

  const handleEntryUpdate = (newContent: string) => {
    console.log(`[JournalEntryCard] Updating entry ${entry.id} with new content: "${newContent.substring(0, 30)}..."`);
    
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
              <DeleteEntryDialog onDelete={handleDelete} />
              <button
                onClick={handleMakeNull}
                className="border border-muted-foreground rounded-md px-2 py-1 ml-2 flex items-center gap-1 text-xs hover:bg-red-50 dark:hover:bg-red-900 transition"
                title="Set emotions and entities as null"
                aria-label="Make Null"
              >
                <X size={16} className="text-muted-foreground" />
                Make Null
              </button>
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
            
            <div className="mt-3 mb-2 flex items-center">
              <div className="flex space-x-2">
                <button
                  onClick={() => handleUserFeedback(1)}
                  className={`hover:bg-green-100 p-1 rounded-full ${thumbsUp ? 'text-green-600 bg-green-100' : 'text-green-500'}`}
                  aria-label="Thumbs up for translation"
                >
                  <ThumbsUp size={16} />
                </button>
                <button
                  onClick={() => handleUserFeedback(0)}
                  className={`hover:bg-red-100 p-1 rounded-full ${thumbsDown ? 'text-red-600 bg-red-100' : 'text-red-500'}`}
                  aria-label="Thumbs down for translation"
                >
                  <ThumbsDown size={16} />
                </button>
              </div>
            </div>
            
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
