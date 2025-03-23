
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import EmotionChart from '@/components/EmotionChart';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Update JournalEntry type to match Supabase table schema exactly with optional properties
type JournalEntry = {
  id: number;
  "transcription text": string;
  "refined text": string;
  created_at: string;
  audio_url: string | null;
  user_id: string | null;
  "foreign key": string | null;
  emotions?: { [key: string]: number };
  duration?: number;
};

const Journal = () => {
  const [activeTab, setActiveTab] = useState('record');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [user]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      console.log('Fetching entries for user ID:', user?.id);
      
      // Fix: Use the correct table name "Journal Entries" instead of "journal_entries"
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      console.log('Fetched entries:', data);
      // We need to ensure data matches our JournalEntry type
      const typedEntries = (data || []) as JournalEntry[];
      setEntries(typedEntries);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  };

  const onEntryRecorded = () => {
    fetchEntries();
    setActiveTab('entries');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto px-4 py-8 max-w-5xl"
    >
      <h1 className="text-4xl font-bold text-center mb-8">Your Journal</h1>
      
      <Tabs defaultValue="record" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="record">Record Entry</TabsTrigger>
          <TabsTrigger value="entries">Past Entries</TabsTrigger>
        </TabsList>
        
        <TabsContent value="record" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Record a New Journal Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <VoiceRecorder onRecordingComplete={onEntryRecorded} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="entries">
          {loading ? (
            <div className="flex justify-center my-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : entries.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
              {entries.map((entry) => (
                <Card key={entry.id} className="overflow-hidden">
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
                          {entry.audio_url && (
                            <audio controls className="w-full">
                              <source src={entry.audio_url} type="audio/webm" />
                              Your browser does not support the audio element.
                            </audio>
                          )}
                        </div>
                        
                        <div>
                          <h3 className="font-medium mb-2">Transcription</h3>
                          <p className="text-muted-foreground whitespace-pre-line">
                            {entry["transcription text"]}
                          </p>
                        </div>
                        
                        <div>
                          <h3 className="font-medium mb-2">Refined Entry</h3>
                          <p className="whitespace-pre-line">{entry["refined text"]}</p>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-4">Emotion Analysis</h3>
                        {entry.emotions ? (
                          <EmotionChart data={entry.emotions} />
                        ) : (
                          <p className="text-muted-foreground">No emotion data available</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Mic className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">No Journal Entries Yet</h3>
                <p className="text-muted-foreground text-center mb-6">
                  Start recording your thoughts to begin your journaling journey
                </p>
                <Button onClick={() => setActiveTab('record')}>
                  Record Your First Entry
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default Journal;
