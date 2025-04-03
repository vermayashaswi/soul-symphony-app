
import React, { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ThemeBoxes } from './ThemeBoxes';

interface JournalEntryCardProps {
  entry: {
    id: number;
    "refined text"?: string;
    created_at: string;
    audio_url?: string;
    master_themes?: string[];
    emotions?: Record<string, number>;
  };
  onDelete: (id: number) => void;
}

export const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ entry, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleDelete = async () => {
    try {
      if (!confirm('Are you sure you want to delete this journal entry?')) {
        return;
      }

      // Delete the journal entry
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entry.id);

      if (error) {
        console.error('Error deleting journal entry:', error);
        toast.error('Failed to delete journal entry');
        return;
      }

      // Delete related embedding if exists
      const { error: embeddingError } = await supabase
        .from('journal_embeddings')
        .delete()
        .eq('journal_entry_id', entry.id);

      if (embeddingError) {
        console.error('Error deleting embedding:', embeddingError);
      }

      toast.success('Journal entry deleted');
      onDelete(entry.id);
    } catch (error) {
      console.error('Error in handleDelete:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const formattedDate = format(new Date(entry.created_at), 'MMMM d, yyyy h:mm a');
  
  const truncatedText = entry["refined text"] && entry["refined text"].length > 200 
    ? entry["refined text"].substring(0, 200) + '...' 
    : entry["refined text"];

  return (
    <Card className="mb-4 overflow-hidden">
      <CardContent className="p-4">
        <div className="text-sm text-gray-500 mb-2">{formattedDate}</div>
        
        <div className="prose">
          {isExpanded ? (
            <div>
              <p>{entry["refined text"]}</p>
              {entry.master_themes && entry.master_themes.length > 0 && (
                <ThemeBoxes themes={entry.master_themes} />
              )}
            </div>
          ) : (
            <p>{truncatedText}</p>
          )}
        </div>
        
        {entry.audio_url && (
          <div className="mt-4">
            <audio 
              ref={audioRef} 
              src={entry.audio_url} 
              onEnded={handleAudioEnded}
              className="hidden" 
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={togglePlayback}
              className="mr-2"
            >
              {isPlaying ? 'Pause Audio' : 'Play Audio'}
            </Button>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between p-4 pt-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={toggleExpand}
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={handleDelete}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
};
