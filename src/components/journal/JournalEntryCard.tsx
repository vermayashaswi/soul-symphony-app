
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/utils/format-time';
import { Trash2, ChevronDown, ChevronUp, Layers, Frown, Meh, Smile } from 'lucide-react';
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
  sentiment?: {
    sentiment: string | number;
    score: number;
  } | string | number;
  themes?: string[];
  entities?: {
    text: string;
    type: string;
  }[];
  foreignKey?: string;
  isChunked?: boolean;
  chunksCount?: number;
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
    
    window.dispatchEvent(new CustomEvent('operation-complete', {
      detail: {
        operation: 'Toggle Entry',
        success: true,
        details: `Entry ${entry.id} ${!isExpanded ? 'expanded' : 'collapsed'}`
      }
    }));
  };

  const handleDelete = async () => {
    if (!entry.id) return;
    
    try {
      setIsDeleting(true);
      
      window.dispatchEvent(new CustomEvent('operation-start', {
        detail: {
          operation: 'Delete Entry',
          details: `Deleting entry ID: ${entry.id}`
        }
      }));
      
      const { error } = await supabase
        .from('Journal_Entries') // Updated table name reference
        .delete()
        .eq('id', entry.id);
        
      if (error) {
        window.dispatchEvent(new CustomEvent('operation-complete', {
          detail: {
            operation: 'Delete Entry',
            success: false,
            error: error.message || 'Error deleting entry'
          }
        }));
        
        throw error;
      }
      
      window.dispatchEvent(new CustomEvent('operation-complete', {
        detail: {
          operation: 'Delete Entry',
          success: true,
          details: `Entry ${entry.id} deleted successfully`
        }
      }));
      
      setOpen(false);
      
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

  const getSentimentValue = (): number => {
    if (typeof entry.sentiment === 'number') {
      return entry.sentiment;
    } else if (typeof entry.sentiment === 'string') {
      return parseFloat(entry.sentiment) || 0;
    } else if (entry.sentiment && typeof entry.sentiment === 'object' && 'score' in entry.sentiment) {
      return typeof entry.sentiment.score === 'number' 
        ? entry.sentiment.score 
        : parseFloat(entry.sentiment.score as string) || 0;
    }
    return 0;
  };

  const renderSentimentEmoji = () => {
    const sentimentValue = getSentimentValue();
    
    if (sentimentValue >= 0.3) {
      return <Smile className="h-4 w-4 text-green-500" />;
    } else if (sentimentValue >= -0.1) {
      return <Meh className="h-4 w-4 text-amber-500" />;
    } else {
      return <Frown className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <Card className="bg-background shadow-md">
      <div className="flex justify-between items-start p-3 md:p-4">
        <div>
          <h3 className="scroll-m-20 text-base md:text-lg font-semibold tracking-tight">{createdAtFormatted}</h3>
          <div className="flex items-center text-xs md:text-sm text-muted-foreground gap-1">
            {renderSentimentEmoji()}
            <span>Sentiment</span>
          </div>
          {entry.isChunked && (
            <div className="flex items-center mt-1 text-xs text-muted-foreground">
              <Layers className="h-3 w-3 mr-1" />
              <span>{entry.chunksCount} chunks</span>
            </div>
          )}
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
