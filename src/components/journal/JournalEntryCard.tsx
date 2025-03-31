
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

export interface JournalEntry {
  id: number;
  content: string;
  created_at: string;
  audio_url?: string;
  sentiment?: {
    sentiment: string;
    score: number;
  } | string;
  themes?: string[];
  entities?: {
    text: string;
    type: string;
  }[];
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
}

export function JournalEntryCard({ entry, onDelete }: JournalEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true); // Changed to true by default
  const [open, setOpen] = React.useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDelete = () => {
    if (onDelete && entry.id) {
      onDelete(entry.id);
      setOpen(false);
    }
  };

  const createdAtFormatted = formatRelativeTime(entry.created_at);

  return (
    <Card className="bg-background shadow-md">
      <div className="flex justify-between items-start p-4">
        <div>
          <h3 className="scroll-m-20 text-lg font-semibold tracking-tight">{createdAtFormatted}</h3>
          <p className="text-sm text-muted-foreground">
            {typeof entry.sentiment === 'string' 
              ? entry.sentiment 
              : entry.sentiment 
                ? `${entry.sentiment.sentiment} (${entry.sentiment.score})` 
                : 'No sentiment data'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={toggleExpanded}>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Are you absolutely sure?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete your journal entry from our
                  servers.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-4">
        {isExpanded ? (
          <div>
            <p className="text-sm text-foreground">{entry.content}</p>
            {entry.themes && entry.themes.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-foreground">Themes</h4>
                <ThemeBoxes themes={entry.themes} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-foreground line-clamp-3">{entry.content}</p>
        )}
      </div>
    </Card>
  );
}
