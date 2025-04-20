
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
import { JournalEntry as JournalEntryType, Json } from '@/types/journal';

// Using the type from types/journal.ts but extending it with required fields for this component
export interface JournalEntry extends JournalEntryType {
  id: number;
  content: string;
  created_at: string;
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
    user_feedback: entry?.user_feedback || null,
    emotions: entry?.emotions || null,
    duration: entry?.duration || null
  };

  const [showFullContent, setShowFullContent] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isFeedbackGiven, setIsFeedbackGiven] = useState(safeEntry.user_feedback !== null);
  const [feedbackType, setFeedbackType] = useState<string | null>(safeEntry.user_feedback);
  const [isDeleting, setIsDeleting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [showReprocessButton, setShowReprocessButton] = useState(false);
  const [showEditButton, setShowEditButton] = useState(false);
  const [showThumbs, setShowThumbs] = useState(true);
  const [showFloatingDots, setShowFloatingDots] = useState(true);
  const [isEntryContentMounted, setIsEntryContentMounted] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleShowFullContent = () => {
    setShowFullContent(!showFullContent);
  };

  const toggleShowThemes = () => {
    setShowThemes(!showThemes);
  };

  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.3,
        delay: isNew ? 0.2 : 0
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.2
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatShortDate(dateString);
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (onDelete) {
        await onDelete(safeEntry.id);
        toast.success("Entry deleted successfully!");
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleFeedback = useCallback(async (feedback: string) => {
    if (isLoadingFeedback) return;
    
    setIsLoadingFeedback(true);
    
    try {
      const { data, error } = await supabase
        .from('Journal Entries')
        .update({ user_feedback: feedback })
        .eq('id', safeEntry.id);
        
      if (error) {
        console.error("Error submitting feedback:", error);
        toast.error("Failed to submit feedback.");
      } else {
        setIsFeedbackGiven(true);
        setFeedbackType(feedback);
        toast.success("Feedback submitted successfully!");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback.");
    } finally {
      setIsLoadingFeedback(false);
    }
  }, [safeEntry.id, isLoadingFeedback]);

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      const response = await supabase.functions.invoke('reprocess-entry', {
        body: { entryId: safeEntry.id }
      });
      
      if (response.error) {
        console.error("Error reprocessing entry:", response.error);
        toast.error("Failed to reprocess entry.");
      } else {
        toast.success("Entry reprocessing started!");
      }
    } catch (error) {
      console.error("Error reprocessing entry:", error);
      toast.error("Failed to reprocess entry.");
    } finally {
      setIsReprocessing(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setShowReprocessButton(true);
            setShowEditButton(true);
            setShowThumbs(true);
            setShowFloatingDots(true);
          } else {
            setShowReprocessButton(false);
            setShowEditButton(false);
            setShowThumbs(false);
            setShowFloatingDots(false);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
      }
    );
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      const scrollHeight = contentRef.current.scrollHeight;
      const clientHeight = contentRef.current.clientHeight;
      
      setShowScrollbar(scrollHeight > clientHeight);
    }
  }, [showFullContent, isEntryContentMounted]);

  return (
    <motion.div
      ref={cardRef}
      className="relative rounded-lg shadow-md overflow-hidden"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <Card className="w-full">
        <div className="flex justify-between items-start p-4">
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-muted-foreground">
              {formatDate(safeEntry.created_at)}
            </span>
            <EntryContent 
              content={safeEntry.content}
              showFullContent={showFullContent}
              contentRef={contentRef}
              scrollContainerRef={scrollContainerRef}
              setShowScrollbar={setShowScrollbar}
              isEntryContentMounted={isEntryContentMounted}
              setIsEntryContentMounted={setIsEntryContentMounted}
              isProcessing={isProcessing}
            />
            {safeEntry.duration && (
              <div className="mt-2 text-xs text-gray-500">
                Duration: {safeEntry.duration} seconds
              </div>
            )}
            {showScrollbar && (
              <button 
                onClick={toggleShowFullContent}
                className="text-blue-500 hover:underline text-sm mt-2"
              >
                {showFullContent ? "Show Less" : "Show More"}
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isMounted && showFloatingDots && (
              <FloatingDotsToggle 
                onClick={toggleShowThemes} 
                isExpanded={showThemes}
                entry={safeEntry}
                onDeleteClick={handleDeleteClick}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t">
          <div className="flex items-center space-x-4">
            {isMounted && showThumbs && (
              <>
                {!isFeedbackGiven ? (
                  <>
                    <ThumbsUp 
                      className="h-5 w-5 hover:text-green-500 cursor-pointer"
                      onClick={() => handleFeedback('positive')}
                    />
                    <ThumbsDown 
                      className="h-5 w-5 hover:text-red-500 cursor-pointer"
                      onClick={() => handleFeedback('negative')}
                    />
                  </>
                ) : (
                  <div className="text-sm text-gray-500">
                    Feedback given: {feedbackType === 'positive' ? 'Positive' : 'Negative'}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isMounted && showEditButton && (
              <EditEntryButton 
                entryId={safeEntry.id} 
                content={safeEntry.content}
                setEntries={setEntries}
              />
            )}
            {isMounted && showReprocessButton && (
              <ThemeLoader 
                onClick={handleReprocess} 
                isLoading={isReprocessing} 
                title="Reprocess" 
              />
            )}
          </div>
        </div>
      </Card>

      <DeleteEntryDialog 
        showDeleteDialog={showDeleteDialog}
        handleCancelDelete={handleCancelDelete}
        confirmDelete={confirmDelete}
        isDeleting={isDeleting}
      />
    </motion.div>
  );
}
