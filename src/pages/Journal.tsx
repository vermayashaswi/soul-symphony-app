
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import VoiceRecorder from '@/components/VoiceRecorder';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import JournalHeader from '@/components/journal/JournalHeader';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import JournalSearch from '@/components/journal/JournalSearch';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Journal = () => {
  const [activeTab, setActiveTab] = useState('record');
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  
  // Use stable references for entries
  const { entries, loading, fetchEntries } = useJournalEntries(user?.id, refreshKey, isProfileChecked);

  useEffect(() => {
    if (user?.id) {
      checkUserProfile(user.id);
    }
  }, [user?.id]);
  
  // Update entriesLoaded state when entries are loaded or loading state changes
  useEffect(() => {
    if (!loading && entries.length > 0) {
      setEntriesLoaded(true);
    }
  }, [loading, entries.length]);
  
  // Monitor active tab changes and fetch entries when switching to entries tab
  useEffect(() => {
    if (activeTab === 'entries' && isProfileChecked) {
      console.log('Tab changed to entries, fetching entries...');
      fetchEntries();
      if (!initialFetchDone) {
        setInitialFetchDone(true);
      }
    }
  }, [activeTab, isProfileChecked, fetchEntries, initialFetchDone]);

  // Add a new effect to monitor processing entries
  useEffect(() => {
    // If there are processing entries, set up a polling interval to check for updates
    if (processingEntries.length > 0 && activeTab === 'entries') {
      console.log('Setting up polling for processing entries:', processingEntries);
      
      const pollingInterval = setInterval(() => {
        fetchEntries();
      }, 5000); // Poll every 5 seconds while processing
      
      return () => clearInterval(pollingInterval);
    }
  }, [processingEntries, activeTab, fetchEntries]);

  const checkUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (error || !profile) {
        console.log('Creating user profile...');
        
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: userId,
            email: userData.user?.email,
            full_name: userData.user?.user_metadata?.full_name || '',
            avatar_url: userData.user?.user_metadata?.avatar_url || ''
          }]);
          
        if (insertError) throw insertError;
        console.log('Profile created successfully');
      }
      
      setIsProfileChecked(true);
    } catch (error: any) {
      console.error('Error checking/creating user profile:', error);
      toast.error('Error setting up profile. Please try again.');
    }
  };

  const onEntryRecorded = async (audioBlob: Blob, tempId?: string) => {
    console.log('Entry recorded, adding to processing queue');
    
    if (tempId) {
      setProcessingEntries(prev => [...prev, tempId]);
    }
    
    setActiveTab('entries');
    
    // Immediately fetch entries to show the processing state
    fetchEntries();
    
    // Set up a check to verify the entry was processed
    const checkEntryProcessed = async () => {
      try {
        console.log('Checking if entry is processed with temp ID:', tempId);
        const { data, error } = await supabase
          .from('Journal Entries')
          .select('id, "refined text"')
          .eq('foreign key', tempId)
          .single();
          
        if (error) {
          console.error('Error fetching newly created entry:', error);
          return false;
        } else if (data) {
          console.log('New entry found:', data.id);
          
          // Generate themes in the background
          await supabase.functions.invoke('generate-themes', {
            body: {
              text: data["refined text"],
              entryId: data.id
            }
          });
          
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error checking for processed entry:', error);
        return false;
      }
    };
    
    // Poll for the entry to be processed
    const pollInterval = setInterval(async () => {
      const isProcessed = await checkEntryProcessed();
      
      if (isProcessed) {
        clearInterval(pollInterval);
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        setRefreshKey(prev => prev + 1);
        fetchEntries();
        toast.success('Journal entry processed successfully!');
      }
    }, 3000); // Check every 3 seconds
    
    // Clear interval after a timeout (e.g., 2 minutes) to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
      if (processingEntries.includes(tempId || '')) {
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        toast.info('Entry processing is taking longer than expected. It should appear soon.');
      }
    }, 120000); // 2 minutes timeout
  };

  const handleDeleteEntry = (entryId: number) => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Filter entries based on search query
  const filteredEntries = entries.filter(entry => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const content = entry.content.toLowerCase();
    const themes = entry.themes?.join(' ').toLowerCase() || '';
    
    return content.includes(query) || themes.includes(query);
  });

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
            {activeTab === 'entries' && (
              <JournalSearch onSearch={handleSearch} />
            )}
            <div className={entriesLoaded ? "" : "opacity-0 h-0 overflow-hidden"}>
              <JournalEntriesList 
                entries={filteredEntries} 
                loading={loading || !isProfileChecked}
                processingEntries={processingEntries}
                onStartRecording={() => setActiveTab('record')}
                onDeleteEntry={handleDeleteEntry}
              />
            </div>
            {!entriesLoaded && activeTab === 'entries' && (loading || !isProfileChecked) && (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading your journal entries...</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Journal;
