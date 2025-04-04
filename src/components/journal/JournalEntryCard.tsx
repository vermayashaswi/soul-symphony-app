
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/utils/format-time';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import ThemeBoxes from './ThemeBoxes';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  entities?: {
    text: string;
    type: string;
  }[];
  foreignKey?: string;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
}

export function JournalEntryCard({ entry, onDelete }: JournalEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [open, setOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDelete = async () => {
    if (!entry.id) return;
    
    try {
      setIsDeleting(true);
      
      // Delete the entry from the database
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entry.id);
        
      if (error) {
        throw error;
      }
      
      // Close the dialog
      setOpen(false);
      
      // Call the onDelete callback to update the UI
      if (onDelete) {
        onDelete(entry.id);
      }
      
      toast.success('Journal entry deleted');
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      toast.error('Failed to delete entry');
    } finally {
      setIsDeleting(false);
    }
  };

  const createdAtFormatted = formatRelativeTime(entry.created_at);

  // Format sentiment for display with proper sentiment labeling
  const formattedSentiment = () => {
    if (typeof entry.sentiment === 'string') {
      // If sentiment is a string, convert it to a number and format
      const score = parseFloat(entry.sentiment);
      return formatSentimentLabel(score);
    } else if (entry.sentiment) {
      // If sentiment is an object, use the score property
      return formatSentimentLabel(entry.sentiment.score);
    }
    return 'No sentiment data';
  };

  // Helper function to format sentiment score as a label
  const formatSentimentLabel = (score: number) => {
    if (score >= 0.5) return 'Very Positive';
    if (score >= 0.1) return 'Positive';
    if (score > -0.1) return 'Neutral';
    if (score > -0.5) return 'Negative';
    return 'Very Negative';
  };

  // Get sentiment color based on score
  const getSentimentColor = () => {
    const score = typeof entry.sentiment === 'string' 
      ? parseFloat(entry.sentiment) 
      : entry.sentiment?.score || 0;
      
    if (score >= 0.1) return "text-green-600 dark:text-green-400";
    if (score >= -0.1) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card className="bg-background shadow-md">
      <div className="flex justify-between items-start p-3 md:p-4">
        <div>
          <h3 className="scroll-m-20 text-base md:text-lg font-semibold tracking-tight">{createdAtFormatted}</h3>
          <p className={`text-xs md:text-sm ${getSentimentColor()}`}>
            {formattedSentiment()}
          </p>
        </div>

        <div className="flex items-center space-x-1 md:space-x-2">
          <Button variant="ghost" size={isMobile ? "sm" : "icon"} onClick={toggleExpanded} className={isMobile ? "h-8 w-8 p-0" : ""}>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size={isMobile ? "sm" : "icon"} className={isMobile ? "h-8 w-8 p-0" : ""}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-w-[90vw]">
              <DialogHeader>
                <DialogTitle>Are you absolutely sure?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete your journal entry from our
                  servers.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-3 md:p-4">
        {isExpanded ? (
          <div>
            <p className="text-xs md:text-sm text-foreground">{entry.content}</p>
            {entry.themes && entry.themes.length > 0 && (
              <div className="mt-3 md:mt-4">
                <h4 className="text-xs md:text-sm font-semibold text-foreground">Themes</h4>
                <ThemeBoxes themes={entry.themes} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs md:text-sm text-foreground line-clamp-3">{entry.content}</p>
        )}
      </div>
    </Card>
  );
}
