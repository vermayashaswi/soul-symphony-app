
import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmotionBubbles from '@/components/EmotionBubbles';
import { JournalEntry } from '@/types/journal';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface JournalEntryCardProps {
  entry: JournalEntry;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ entry }) => {
  // Get themes to display - first try master_themes, then fall back to emotions
  const themesToDisplay = React.useMemo(() => {
    if (entry.master_themes && Array.isArray(entry.master_themes) && entry.master_themes.length > 0) {
      // Trim long theme names to prevent overflow
      return entry.master_themes.slice(0, 10).map(theme => 
        typeof theme === 'string' && theme.length > 12 ? theme.slice(0, 12) + '...' : theme
      );
    } else if (entry.emotions && Array.isArray(entry.emotions) && entry.emotions.length > 0) {
      // Trim long emotion names to prevent overflow
      return entry.emotions.slice(0, 10).map(emotion => 
        typeof emotion === 'string' && emotion.length > 12 ? emotion.slice(0, 12) + '...' : emotion
      );
    }
    return [];
  }, [entry.master_themes, entry.emotions]);

  // Get text to display - always use refined text if available, then fall back to transcription
  const displayText = entry["refined text"] || entry["transcription text"] || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">
              {format(new Date(entry.created_at), 'MMMM d, yyyy - h:mm a')}
            </CardTitle>
            {entry.duration && (
              <span className="text-sm text-muted-foreground">
                {Math.floor(entry.duration / 60)}:{(entry.duration % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div>
                <h3 className="font-medium mb-2">Your Recording</h3>
                {entry.audio_url ? (
                  <audio controls className="w-full">
                    <source src={entry.audio_url} type="audio/webm" />
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <p className="text-muted-foreground">No audio recording available</p>
                )}
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Journal Entry</h3>
                {displayText ? (
                  <p className="whitespace-pre-line">{displayText}</p>
                ) : (
                  <Alert variant="default" className="bg-muted/50">
                    <AlertDescription>
                      Your entry is being processed... This may take a moment.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Soul-ubles
              </h3>
              
              <div className="h-60 mb-4 flex items-center justify-center relative bg-white/50 rounded-lg p-2 border border-border/30 overflow-hidden">
                {themesToDisplay.length > 0 ? (
                  <EmotionBubbles themes={themesToDisplay} />
                ) : (
                  <Alert variant="default" className="bg-muted/50">
                    <AlertDescription className="text-center">
                      Analyzing themes...
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default JournalEntryCard;
