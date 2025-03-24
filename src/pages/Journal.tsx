
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import JournalHeader from '@/components/journal/JournalHeader';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import { useJournalEntries } from '@/hooks/use-journal-entries';

const Journal = () => {
  const [activeTab, setActiveTab] = useState('record');
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  
  const { entries, loading } = useJournalEntries(user?.id, refreshKey);

  const onEntryRecorded = (audioBlob: Blob, tempId?: string) => {
    console.log('Entry recorded, adding to processing queue');
    
    // Add this entry to the processing list if we have a tempId
    if (tempId) {
      setProcessingEntries(prev => [...prev, tempId]);
    }
    
    // Switch to entries tab to show progress
    setActiveTab('entries');
    
    // Refresh entries list to catch any completed entries
    // We'll use a timer to simulate the entry being processed
    // (in real app this should happen when the background process completes)
    setTimeout(() => {
      setProcessingEntries(prev => prev.filter(id => id !== tempId));
      setRefreshKey(prev => prev + 1);
    }, 30000); // After 30 seconds, simulate completion and refresh list
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <JournalHeader />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
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
            <JournalEntriesList 
              entries={entries} 
              loading={loading}
              processingEntries={processingEntries}
              onStartRecording={() => setActiveTab('record')}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Journal;
