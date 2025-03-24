
import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmotionChart from '@/components/EmotionChart';
import EmotionBubbles from '@/components/EmotionBubbles';
import { JournalEntry } from '@/types/journal';

interface JournalEntryCardProps {
  entry: JournalEntry;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ entry }) => {
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
                <p className="whitespace-pre-line">{entry["refined text"] || "No refined text available"}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Soul-ubles
              </h3>
              
              <div className="h-48 mb-4 flex items-center justify-center">
                {entry.master_themes && entry.master_themes.length > 0 ? (
                  <EmotionBubbles themes={entry.master_themes.slice(0, 10)} />
                ) : (
                  entry.emotions && entry.emotions.length > 0 ? (
                    <EmotionBubbles themes={entry.emotions.slice(0, 10)} />
                  ) : (
                    <p className="text-muted-foreground text-center">Analyzing emotions...</p>
                  )
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
