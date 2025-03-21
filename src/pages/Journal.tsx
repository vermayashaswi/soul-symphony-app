
import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Calendar, Search, Filter, Plus, CheckCircle2, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VoiceRecorder from '@/components/VoiceRecorder';
import Navbar from '@/components/Navbar';
import { cn } from '@/lib/utils';

// Sample journal entries (in a real app, these would come from a backend)
const sampleEntries = [
  {
    id: 1,
    date: new Date('2023-05-10'),
    summary: 'Had a productive day at work, felt accomplished',
    emotions: ['Joy', 'Productive', 'Calm'],
    duration: '2:45',
  },
  {
    id: 2,
    date: new Date('2023-05-08'),
    summary: 'Feeling anxious about the upcoming presentation',
    emotions: ['Anxiety', 'Stress', 'Worry'],
    duration: '3:21',
  },
  {
    id: 3,
    date: new Date('2023-05-05'),
    summary: 'Great dinner with friends, laughed a lot',
    emotions: ['Happy', 'Social', 'Relaxed'],
    duration: '4:12',
  },
  {
    id: 4,
    date: new Date('2023-05-02'),
    summary: 'Feeling tired after a long week, need rest',
    emotions: ['Tired', 'Drained', 'Reflective'],
    duration: '1:50',
  },
];

export default function Journal() {
  const [isRecording, setIsRecording] = useState(false);
  const [entries, setEntries] = useState(sampleEntries);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter entries based on search query
  const filteredEntries = entries.filter(entry => 
    entry.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.emotions.some(emotion => emotion.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleRecordingComplete = (blob: Blob) => {
    console.log('Recording completed:', blob);
    // In a real app, this would send the audio to Whisper API for transcription
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
              {filteredEntries.length > 0 ? (
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
                        <h3 className="font-semibold text-lg mb-2">{format(entry.date, 'MMMM d, yyyy')}</h3>
                        <p className="text-muted-foreground mb-3">{entry.summary}</p>
                        <div className="flex flex-wrap gap-2">
                          {entry.emotions.map((emotion) => (
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
                          <span>{entry.duration}</span>
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
