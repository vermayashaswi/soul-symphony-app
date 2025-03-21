
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Calendar, Search, Filter, Plus, CheckCircle2, Clock, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VoiceRecorder from '@/components/VoiceRecorder';
import Navbar from '@/components/Navbar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type JournalEntry = {
  id: number;
  created_at: string;
  transcription: string;
  "refined text": string;
  emotions?: string[];
  duration?: string;
};

export default function Journal() {
  const [isRecording, setIsRecording] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch journal entries from Supabase
  useEffect(() => {
    async function fetchEntries() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('Journal Entries')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching journal entries:', error);
          toast.error('Failed to load journal entries');
          return;
        }
        
        // Add placeholder emotions and duration if they don't exist yet
        const entriesWithMetadata = data.map(entry => ({
          ...entry,
          emotions: ['Reflective', 'Thoughtful', 'Calm'],
          duration: '2:45'
        }));
        
        setEntries(entriesWithMetadata);
      } catch (error) {
        console.error('Error in fetchEntries:', error);
        toast.error('Something went wrong while loading entries');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchEntries();
  }, []);
  
  // Filter entries based on search query
  const filteredEntries = entries.filter(entry => 
    (entry.transcription && entry.transcription.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (entry["refined text"] && entry["refined text"].toLowerCase().includes(searchQuery.toLowerCase())) ||
    (entry.emotions && entry.emotions.some(emotion => emotion.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const handleRecordingComplete = async (data: { transcription: string, refinedText: string }) => {
    // The data is already stored in Supabase by the edge function,
    // so we just need to refresh our entries
    try {
      const { data: newEntries, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.error('Error fetching new entry:', error);
        return;
      }
      
      // Add the new entry to the state with placeholder emotions and duration
      const newEntryWithMetadata = {
        ...newEntries,
        emotions: ['Reflective', 'Thoughtful', 'Calm'],
        duration: '2:45'
      };
      
      setEntries(prev => [newEntryWithMetadata, ...prev]);
    } catch (error) {
      console.error('Error in handleRecordingComplete:', error);
    }
    
    // Hide the recorder
    setIsRecording(false);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 pt-28">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Journal</h1>
            <p className="text-muted-foreground">Record your thoughts and feelings</p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <Button 
              onClick={toggleRecording}
              className="rounded-full"
              variant={isRecording ? "destructive" : "default"}
            >
              {isRecording ? 'Cancel' : 'New Entry'}
              {!isRecording && <Plus className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        {isRecording ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-xl shadow-sm p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-4 text-center">New Journal Entry</h2>
            <VoiceRecorder 
              onRecordingComplete={handleRecordingComplete}
              className="max-w-md mx-auto"
            />
          </motion.div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search journal entries..."
                  className="pl-10 rounded-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" className="rounded-full flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </Button>
              <Button variant="outline" className="rounded-full flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Date</span>
              </Button>
            </div>
            
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground">Loading journal entries...</p>
                  </div>
                </div>
              ) : filteredEntries.length > 0 ? (
                filteredEntries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{format(new Date(entry.created_at), 'MMMM d, yyyy')}</h3>
                        <p className="text-muted-foreground mb-3">{entry["refined text"] || entry.transcription}</p>
                        <div className="flex flex-wrap gap-2">
                          {entry.emotions?.map((emotion) => (
                            <span 
                              key={emotion} 
                              className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                            >
                              {emotion}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center text-muted-foreground text-xs mb-2">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>{entry.duration || "2:45"}</span>
                        </div>
                        <div className="mt-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="bg-muted inline-flex p-3 rounded-full mb-4">
                    <Tag className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No entries found</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    {searchQuery ? 
                      `No entries match "${searchQuery}". Try a different search term.` : 
                      "You haven't created any journal entries yet. Click 'New Entry' to get started."}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
