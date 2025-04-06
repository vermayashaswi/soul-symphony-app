
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { formatRelativeTime } from '@/utils/format-time';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FloatingDotsToggle, 
  SentimentEmoji, 
  ThemeLoader, 
  DeleteEntryDialog 
} from './entry-card';
import ErrorBoundary from './ErrorBoundary';

export interface JournalEntry {
  id: number;
  content: string;
  created_at: string;
  audio_url?: string;
  sentiment?: string | {
    sentiment: string;
    score: number;
  };
  themes?: string[];
  master_themes?: string[];
  entities?: {
    text: string;
    type: string;
    name?: string;
  }[];
  foreignKey?: string;
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
  // Safe defaults for entry properties
  const safeEntry = {
    id: entry?.id || 0,
    content: entry?.content || "Processing entry...",
    created_at: entry?.created_at || new Date().toISOString(),
    sentiment: entry?.sentiment || "",
    master_themes: Array.isArray(entry?.master_themes) ? entry.master_themes : [],
    themes: Array.isArray(entry?.themes) ? entry.themes : []
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [highlightNew, setHighlightNew] = useState(isNew);
  const [deletionCompleted, setDeletionCompleted] = useState(false);
  const [deletionInProgress, setDeletionInProgress] = useState(false);
  const mountedRef = useRef<boolean>(true);
  
  // Extract themes from the entry
  const extractThemes = (): string[] => {
    try {
      // Fall back to empty arrays if properties are undefined
      const masterThemes = Array.isArray(safeEntry.master_themes) ? safeEntry.master_themes : [];
      const entryThemes = Array.isArray(safeEntry.themes) ? safeEntry.themes : [];
      
      // Filter out empty themes
      const filteredMasterThemes = masterThemes.filter(theme => 
        theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
      );
      const filteredEntryThemes = entryThemes.filter(theme => 
        theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
      );
      
      // Use master themes if available, otherwise use regular themes
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
  
  // Log when the component is mounted/unmounted
  useEffect(() => {
    console.log(`[JournalEntryCard] Mounted entry ${safeEntry.id}`);
    mountedRef.current = true;
    
    return () => {
      console.log(`[JournalEntryCard] Unmounted entry ${safeEntry.id}`);
      mountedRef.current = false;
    };
  }, [safeEntry.id]);

  // Auto-expand new entries
  useEffect(() => {
    if (isNew) {
      setIsExpanded(true);
      setHighlightNew(true);
      
      // Remove highlight after 5 seconds
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setHighlightNew(false);
        }
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDelete = async () => {
    if (!safeEntry.id || deletionCompleted || deletionInProgress) {
      console.log(`[JournalEntryCard] Skipping deletion for entry ${safeEntry.id} - already completed or in progress`);
      return;
    }
    
    try {
      console.log(`[JournalEntryCard] Starting deletion of entry ${safeEntry.id}`);
      
      // Mark as in progress to prevent duplicate deletion attempts
      setDeletionInProgress(true);
      
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', safeEntry.id);
        
      if (error) {
        throw error;
      }
      
      console.log(`[JournalEntryCard] Successfully deleted entry ${safeEntry.id} from database`);
      
      // Mark as completed
      setDeletionCompleted(true);
      
      // Call parent handler with a small delay to ensure UI updates properly
      if (onDelete && mountedRef.current) {
        console.log(`[JournalEntryCard] Calling onDelete for entry ${safeEntry.id}`);
        onDelete(safeEntry.id);
      }
      
      toast.success('Journal entry deleted');
    } catch (error) {
      console.error('[JournalEntryCard] Error deleting journal entry:', error);
      
      // Reset state if still mounted
      if (mountedRef.current) {
        setDeletionInProgress(false);
        setDeletionCompleted(false);
      }
      
      toast.error('Failed to delete entry');
      
      // Still try to update the UI even if the database operation failed
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

  const createdAtFormatted = formatRelativeTime(safeEntry.created_at);
  const initialThemes = extractThemes();
  
  // Check if an entry is still being processed
  const isEntryBeingProcessed = () => {
    return (!safeEntry.themes || safeEntry.themes.length === 0) && 
           (!safeEntry.master_themes || safeEntry.master_themes.length === 0) &&
           isNew;
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
      >
        <Card className={`bg-background shadow-md ${highlightNew ? 'border-primary' : ''}`}>
          <div className="flex justify-between items-start p-3 md:p-4">
            <div>
              <h3 className="scroll-m-20 text-base md:text-lg font-semibold tracking-tight">{createdAtFormatted}</h3>
              <div className="mt-1">
                <SentimentEmoji sentiment={safeEntry.sentiment} />
              </div>
            </div>

            <div className="flex items-center space-x-2 md:space-x-3">
              <FloatingDotsToggle onClick={toggleExpanded} />
              <DeleteEntryDialog onDelete={handleDelete} />
            </div>
          </div>

          <div className="p-3 md:p-4">
            {isExpanded ? (
              <div>
                <p className="text-xs md:text-sm text-foreground">{safeEntry.content}</p>
                <ErrorBoundary>
                  <ThemeLoader 
                    entryId={safeEntry.id}
                    initialThemes={initialThemes}
                    content={safeEntry.content}
                    isProcessing={isProcessing || isEntryBeingProcessed()}
                    isNew={isNew}
                  />
                </ErrorBoundary>
              </div>
            ) : (
              <p className="text-xs md:text-sm text-foreground line-clamp-3">{safeEntry.content}</p>
            )}
          </div>
        </Card>
      </motion.div>
    </ErrorBoundary>
  );
}
