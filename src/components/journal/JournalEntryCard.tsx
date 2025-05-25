
import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Play, Pause, Edit, Volume2, MessageSquare, Calendar, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/journal/toast-helper';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TranslatableText } from '@/components/translation/TranslatableText';
import SentimentMeter from './entry-card/SentimentMeter';
import SentimentEmoji from './entry-card/SentimentEmoji';
import EntryContent from './entry-card/EntryContent';
import EditEntryButton from './entry-card/EditEntryButton';
import DeleteEntryDialog from './entry-card/DeleteEntryDialog';
import ExtractThemeButton from './entry-card/ExtractThemeButton';
import ChatSuggestionButton from './entry-card/ChatSuggestionButton';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { motion } from 'framer-motion';
import { useProcessingEntries } from '@/hooks/use-processing-entries';

export interface JournalEntry {
  id: number;
  content: string;
  created_at: string;
  audio_url?: string;
  sentiment?: string;
  themes?: string[];
  foreignKey?: string;
  entities?: Array<{
    type: string;
    name: string;
    text?: string;
  }>;
  emotions?: Record<string, number>;
  duration?: number;
  user_feedback?: string | null;
  Edit_Status?: number | null;
  tempId?: string;
  entry_type?: 'regular' | 'welcome';
  is_deletable?: boolean;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  processing?: boolean;
  processed?: boolean;
  onDelete: (entryId: number) => void;
  setEntries: ((entries: JournalEntry[]) => void) | null;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
  entry,
  processing = false,
  processed = false,
  onDelete,
  setEntries
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState(entry.user_feedback || '');
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const { removeEntry } = useProcessingEntries();
  
  const {
    isPlaying,
    currentTime,
    duration,
    togglePlayback,
    setAudioElement
  } = useAudioPlayback(entry.audio_url);

  const isWelcomeEntry = entry.entry_type === 'welcome';
  const isDeletable = entry.is_deletable !== false && !isWelcomeEntry;

  useEffect(() => {
    if (entry.tempId && processed) {
      console.log(`[JournalEntryCard] Entry ${entry.tempId} marked as processed, removing from processing state`);
      setTimeout(() => {
        removeEntry(entry.tempId!);
      }, 1000);
    }
  }, [processed, entry.tempId, removeEntry]);

  const handleToggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSaveFeedback = async () => {
    try {
      const { error } = await supabase
        .from('Journal Entries')
        .update({ user_feedback: feedback })
        .eq('id', entry.id);

      if (error) throw error;

      showToast("Success", "Feedback saved successfully");
      setIsFeedbackDialogOpen(false);
      
      if (setEntries) {
        // Update the local state to reflect the change
        setEntries((prevEntries: JournalEntry[]) =>
          prevEntries.map(e =>
            e.id === entry.id ? { ...e, user_feedback: feedback } : e
          )
        );
      }
    } catch (error) {
      console.error('Error saving feedback:', error);
      showToast("Error", "Failed to save feedback");
    }
  };

  const handleDelete = () => {
    if (!isDeletable) {
      console.log('[JournalEntryCard] Cannot delete welcome entry');
      return;
    }
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      await onDelete(entry.id);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting entry:', error);
      showToast("Error", "Failed to delete entry");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" }
    }
  };

  return (
    <motion.div
      ref={cardRef}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
      data-temp-id={entry.tempId}
      data-processing={processing}
      data-entry-id={entry.id}
    >
      <Card className={`
        p-4 shadow-md relative transition-all duration-200 journal-entry-card
        ${processing ? 'border-2 border-primary/20 bg-primary/5 processing-card' : 'bg-card border hover:shadow-lg'}
        ${isWelcomeEntry ? 'border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50' : ''}
      `}>
        {/* Welcome Entry Badge */}
        {isWelcomeEntry && (
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
              <Sparkles className="w-3 h-3 mr-1" />
              <TranslatableText text="Welcome" />
            </Badge>
          </div>
        )}

        {/* Processing indicator */}
        {processing && (
          <div className="absolute top-2 right-2 flex items-center justify-center h-8 w-8 bg-primary/30 rounded-full border-2 border-primary/50">
            <div className="h-5 w-5 rounded-full bg-primary/60 animate-ping absolute"></div>
            <div className="h-4 w-4 rounded-full bg-primary relative z-10"></div>
          </div>
        )}

        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {formatDate(entry.created_at)}
              </span>
              {entry.duration && (
                <span className="text-xs text-muted-foreground ml-2">
                  {formatDuration(entry.duration)}
                </span>
              )}
            </div>
            
            {entry.sentiment && (
              <div className="flex items-center gap-2 mb-2">
                <SentimentEmoji sentiment={entry.sentiment} />
                <SentimentMeter sentiment={entry.sentiment} />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 ml-4">
            {entry.audio_url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlayback}
                className="h-8 w-8 p-0"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            )}

            {!isWelcomeEntry && (
              <>
                <EditEntryButton
                  entry={entry}
                  setEntries={setEntries}
                />
                
                <ExtractThemeButton entryId={entry.id} />
                
                <ChatSuggestionButton entry={entry} />
              </>
            )}

            {isDeletable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <EntryContent 
          content={entry.content}
          isExpanded={isExpanded}
          onToggleExpansion={handleToggleExpansion}
        />

        {/* Themes */}
        {entry.themes && entry.themes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {entry.themes.map((theme, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                #{theme}
              </Badge>
            ))}
          </div>
        )}

        {/* Emotions */}
        {entry.emotions && Object.keys(entry.emotions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(entry.emotions)
              .filter(([, value]) => value > 0.3)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([emotion, intensity]) => (
                <Badge key={emotion} variant="secondary" className="text-xs">
                  {emotion} ({(intensity * 100).toFixed(0)}%)
                </Badge>
              ))}
          </div>
        )}

        {/* User Feedback */}
        {!isWelcomeEntry && (
          <div className="mt-3 pt-3 border-t">
            <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto p-1 text-muted-foreground">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  <TranslatableText text={entry.user_feedback ? "Edit feedback" : "Add feedback"} />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle><TranslatableText text="Entry Feedback" /></DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Share your thoughts about this entry..."
                    rows={4}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsFeedbackDialogOpen(false)}>
                      <TranslatableText text="Cancel" />
                    </Button>
                    <Button onClick={handleSaveFeedback}>
                      <TranslatableText text="Save" />
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {entry.user_feedback && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                "{entry.user_feedback}"
              </p>
            )}
          </div>
        )}

        {/* Audio element for playback */}
        {entry.audio_url && (
          <audio
            ref={setAudioElement}
            src={entry.audio_url}
            preload="metadata"
            style={{ display: 'none' }}
          />
        )}

        <DeleteEntryDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={confirmDelete}
          entryTitle={entry.content.substring(0, 50) + (entry.content.length > 50 ? '...' : '')}
        />
      </Card>
    </motion.div>
  );
};

export default JournalEntryCard;
