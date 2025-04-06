
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [highlightNew, setHighlightNew] = useState(isNew);
  const [deletionCompleted, setDeletionCompleted] = useState(false);
  const mountedRef = useRef<boolean>(true);
  
  // Extract themes from the entry
  const extractThemes = (): string[] => {
    try {
      // Fall back to empty arrays if properties are undefined
      const masterThemes = Array.isArray(entry.master_themes) ? entry.master_themes : [];
      const entryThemes = Array.isArray(entry.themes) ? entry.themes : [];
      
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
    console.log(`[JournalEntryCard] Mounted entry ${entry.id}`);
    mountedRef.current = true;
    
    return () => {
      console.log(`[JournalEntryCard] Unmounted entry ${entry.id}`);
      mountedRef.current = false;
    };
  }, [entry.id]);

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
    if (!entry.id || deletionCompleted) return;
    
    try {
      console.log(`[JournalEntryCard] Deleting entry ${entry.id}`);
      
      // Mark as completed to prevent duplicate deletion attempts
      setDeletionCompleted(true);
      
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entry.id);
        
      if (error) {
        throw error;
      }
      
      console.log(`[JournalEntryCard] Successfully deleted entry ${entry.id}`);
      
      // Call parent handler with a small delay to ensure UI updates properly
      if (onDelete) {
        console.log(`[JournalEntryCard] Calling onDelete for entry ${entry.id}`);
        onDelete(entry.id);
      }
      
      toast.success('Journal entry deleted');
    } catch (error) {
      console.error('[JournalEntryCard] Error deleting journal entry:', error);
      setDeletionCompleted(false);
      toast.error('Failed to delete entry');
      
      // Still try to update the UI even if the database operation failed
      if (onDelete) {
        setTimeout(() => {
          onDelete(entry.id);
        }, 100);
      }
    }
  };

  const createdAtFormatted = formatRelativeTime(entry.created_at);
  const initialThemes = extractThemes();
  
  // Check if an entry is still being processed
  const isEntryBeingProcessed = () => {
    return (!entry.themes || entry.themes.length === 0) && 
           (!entry.master_themes || entry.master_themes.length === 0) &&
           isNew;
  };

  return (
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
      data-entry-id={entry.id}
    >
      <Card className={`bg-background shadow-md ${highlightNew ? 'border-primary' : ''}`}>
        <div className="flex justify-between items-start p-3 md:p-4">
          <div>
            <h3 className="scroll-m-20 text-base md:text-lg font-semibold tracking-tight">{createdAtFormatted}</h3>
            <div className="mt-1">
              <SentimentEmoji sentiment={entry.sentiment} />
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
              <p className="text-xs md:text-sm text-foreground">{entry.content}</p>
              <ThemeLoader 
                entryId={entry.id}
                initialThemes={initialThemes}
                content={entry.content}
                isProcessing={isProcessing || isEntryBeingProcessed()}
                isNew={isNew}
              />
            </div>
          ) : (
            <p className="text-xs md:text-sm text-foreground line-clamp-3">{entry.content}</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
