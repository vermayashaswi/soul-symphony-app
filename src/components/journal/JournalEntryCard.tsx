
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { formatShortDate } from '@/utils/format-time';
import SentimentMeter from './entry-card/SentimentMeter';
import EntryContent from './entry-card/EntryContent';
import DeleteEntryDialog from './entry-card/DeleteEntryDialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { JournalEntry } from '@/types/journal';
import EditEntryButton from './entry-card/EditEntryButton';
import ThemeBoxes from './ThemeBoxes';
import ExtractThemeButton from './entry-card/ExtractThemeButton';
import { getEntryIdForProcessingId } from '@/utils/audio-processing';

interface JournalEntryCardProps {
  entry: JournalEntry;
  processing?: boolean;
  processed?: boolean;
  onDelete: (entryId: number) => Promise<void>;
  setEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>> | null;
}

export default function JournalEntryCard({ entry, processing, processed, onDelete, setEntries }: JournalEntryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [entryId, setEntryId] = useState<number | undefined>(entry.id);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Callback for completed theme extraction
  const handleThemeExtraction = (updatedEntry: JournalEntry) => {
    if (!setEntries) return;
    
    setEntries(prevEntries => {
      return prevEntries.map(prevEntry => 
        prevEntry.id === updatedEntry.id ? updatedEntry : prevEntry
      );
    });
  };

  // Get the real entry ID if this is a processing entry
  useEffect(() => {
    if (entry.tempId && !entryId) {
      const resolvedId = getEntryIdForProcessingId(entry.tempId);
      if (resolvedId) {
        setEntryId(resolvedId);
      }
    }
  }, [entry.tempId, entryId]);

  // Handle delete button click
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await onDelete(entryId);
    } catch (error) {
      console.error('Error deleting journal entry:', error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Format the date or show "Processing" if no date
  const formattedDate = entry.created_at
    ? formatShortDate(new Date(entry.created_at))
    : 'Processing...';

  return (
    <Card className="p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div className="font-medium text-sm">{formattedDate}</div>
        <div className="flex items-center gap-2">
          {!processed && !processing && entry.id && (
            <ExtractThemeButton 
              entryId={entry.id} 
              onComplete={handleThemeExtraction} 
            />
          )}
          {!processing && entry.id && (
            <EditEntryButton entry={entry} setEntries={setEntries} />
          )}
          {entry.id && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      <EntryContent 
        content={entry.content} 
        audioUrl={entry.audio_url} 
        isProcessing={processing} 
        isProcessed={processed} 
        language={entry.original_language} // Pass the original language
        entryId={entry.id}
      />

      {entry.sentiment && !processing && (
        <SentimentMeter sentiment={parseFloat(entry.sentiment)} />
      )}

      {entry.master_themes && entry.master_themes.length > 0 && (
        <ThemeBoxes themes={entry.master_themes} />
      )}

      <DeleteEntryDialog 
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </Card>
  );
}
