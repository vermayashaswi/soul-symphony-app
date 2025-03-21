
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Search, Plus, Mic, Play, Clock, Calendar, Tag, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import VoiceRecorder from '@/components/VoiceRecorder';
import Navbar from '@/components/Navbar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ParticleBackground from '@/components/ParticleBackground';

// Update the type definition to match the actual database structure
type JournalEntry = {
  id: number;
  created_at: string;
  "transcription text"?: string | null;
  "refined text"?: string | null;
  emotions?: string[];
  duration?: string;
  audio_url?: string | null;
};

export default function Journal() {
  const [isRecording, setIsRecording] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchJournalEntries() {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('Journal Entries')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching journal entries:', error);
          setError('Failed to load journal entries.');
          toast.error('Failed to load journal entries');
          return;
        }

        // Transform data to match JournalEntry type
        const formattedEntries: JournalEntry[] = data.map(entry => ({
          ...entry,
          emotions: ['Reflective', 'Thoughtful', 'Calm'], // Default emotions for now
          duration: '2:45', // Default duration for now
        }));
        
        setEntries(formattedEntries);
      } catch (err) {
        console.error('Unexpected error fetching entries:', err);
        setError('An unexpected error occurred.');
        toast.error('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchJournalEntries();
  }, []);
  
  // Filter entries based on search query
  const filteredEntries = entries.filter(entry => 
    (entry["transcription text"] && entry["transcription text"].toLowerCase().includes(searchQuery.toLowerCase())) || 
    (entry["refined text"] && entry["refined text"].toLowerCase().includes(searchQuery.toLowerCase())) ||
    (entry.emotions && entry.emotions.some(emotion => emotion.toLowerCase().includes(searchQuery.toLowerCase())))
  );
  
  const handleNewEntry = async (audioData: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      
      // Make sure we have actual audio data
      if (!audioData || !(audioData instanceof Blob)) {
        toast.error('Invalid audio data received');
        return;
      }
      
      // Save the audio file to Supabase Storage
      const timestamp = Date.now();
      const filename = `journal-entry-${timestamp}.webm`;
      
      // Upload to storage
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('audio-recordings')
        .upload(filename, audioData);
        
      if (storageError) {
        console.error('Error uploading audio:', storageError);
        toast.error('Failed to save audio recording');
        // Continue with transcription even if storage fails
      }
      
      // Get the public URL for the audio
      const { data: urlData } = await supabase
        .storage
        .from('audio-recordings')
        .getPublicUrl(filename);
        
      const audioUrl = urlData?.publicUrl;
      
      reader.readAsDataURL(audioData);
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          toast.error('Failed to process audio');
          return;
        }
        
        toast.loading('Processing your journal entry...');
        
        try {
          // Call the transcribe-audio edge function
          const { data: transcriptionData, error: functionError } = await supabase.functions.invoke('transcribe-audio', {
            body: { audio: base64Audio }
          });
          
          if (functionError) {
            console.error('Error calling transcribe-audio function:', functionError);
            toast.dismiss();
            toast.error('Failed to transcribe audio.');
            return;
          }
          
          toast.dismiss();
          toast.success('Journal entry saved!');
          
          // Create the entry with the audioUrl included
          const { data: entryData, error: insertError } = await supabase
            .from('Journal Entries')
            .insert([{ 
              "transcription text": transcriptionData?.transcription || '',
              "refined text": transcriptionData?.refinedText || '',
              "audio_url": audioUrl
            }])
            .select()
            .single();
            
          if (insertError) {
            console.error('Error creating entry:', insertError);
            toast.error('Failed to save entry details');
            return;
          }
          
          // Add the new entry to the state with placeholder emotions and duration
          const newEntryWithMetadata: JournalEntry = {
            ...entryData,
            emotions: ['Reflective', 'Thoughtful', 'Calm'],
            duration: '2:45'
          };
          
          setEntries(prevEntries => [newEntryWithMetadata, ...prevEntries]);
          
        } catch (err) {
          console.error('Error processing audio:', err);
          toast.dismiss();
          toast.error('An error occurred while processing your journal entry.');
        } finally {
          setIsRecording(false);
        }
      };
    } catch (err) {
      console.error('Error preparing audio data:', err);
      toast.error('Failed to prepare audio data.');
      setIsRecording(false);
    }
  };
  
  const deleteEntry = async (id: number) => {
    try {
      toast.loading('Deleting entry...');
      
      // Find the entry to get its audio URL
      const entryToDelete = entries.find(entry => entry.id === id);
      
      // Delete the audio file from storage if it exists
      if (entryToDelete?.audio_url) {
        const filename = entryToDelete.audio_url.split('/').pop();
        if (filename) {
          await supabase
            .storage
            .from('audio-recordings')
            .remove([filename]);
        }
      }
      
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting entry:', error);
        toast.dismiss();
        toast.error('Failed to delete entry.');
        return;
      }
      
      toast.dismiss();
      toast.success('Entry deleted.');
      
      // Update state to remove the deleted entry
      setEntries(prevEntries => prevEntries.filter(entry => entry.id !== id));
      
    } catch (err) {
      console.error('Unexpected error deleting entry:', err);
      toast.dismiss();
      toast.error('An unexpected error occurred.');
    }
  };
  
  const playAudio = (audioUrl: string | null | undefined) => {
    if (!audioUrl) {
      toast.error('No audio recording available for this entry.');
      return;
    }
    
    // Create audio element and play
    const audio = new Audio(audioUrl);
    audio.play().catch(err => {
      console.error('Error playing audio:', err);
      toast.error('Failed to play the recording.');
    });
  };

  // Render a helpful message if there's an error or if data is loading
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <ParticleBackground />
        <div className="max-w-5xl mx-auto pt-24 px-4">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-2">Error Loading Journal</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button 
              className="mt-4" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <ParticleBackground />
      
      <div className="max-w-5xl mx-auto pt-24 px-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold">My Journal</h1>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input 
                placeholder="Search entries..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={() => setIsRecording(!isRecording)} 
              className={isRecording ? "bg-red-500 hover:bg-red-600" : ""}
            >
              {isRecording ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Recording
                </>
              )}
            </Button>
          </div>
        </div>
        
        <Separator className="mb-8" />
        
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <VoiceRecorder 
              onRecordingComplete={handleNewEntry} 
              onCancel={() => setIsRecording(false)} 
            />
          </motion.div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-64 bg-muted rounded"></div>
              <div className="h-24 w-full max-w-2xl bg-muted rounded"></div>
              <div className="h-8 w-40 bg-muted rounded"></div>
            </div>
          </div>
        ) : filteredEntries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredEntries.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card p-6 rounded-lg shadow-sm border border-border"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">{format(new Date(entry.created_at), 'MMMM d, yyyy')}</h3>
                      <p className="text-muted-foreground mb-3">{entry["refined text"] || entry["transcription text"] || "No content available"}</p>
                      <div className="flex flex-wrap gap-2">
                        {entry.emotions?.map((emotion) => (
                          <span 
                            key={emotion}
                            className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-300"
                          >
                            {emotion}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {entry.audio_url && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => playAudio(entry.audio_url)}
                          className="text-muted-foreground hover:text-primary"
                          title="Play recording"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteEntry(entry.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Delete entry"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border mt-2">
                    <div className="flex items-center">
                      <Clock className="mr-1 h-3 w-3" />
                      <span>{entry.duration}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="mr-1 h-3 w-3" />
                      <span>{format(new Date(entry.created_at), 'h:mm a')}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-2">No journal entries yet</h2>
            <p className="text-muted-foreground mb-8">Record your first voice journal to get started</p>
            <Button onClick={() => setIsRecording(true)}>
              <Mic className="mr-2 h-4 w-4" />
              Start Recording
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
