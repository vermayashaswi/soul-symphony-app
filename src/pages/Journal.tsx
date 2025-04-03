import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import VoiceRecorder from '@/components/VoiceRecorder';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import JournalHeader from '@/components/journal/JournalHeader';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import JournalSearch from '@/components/journal/JournalSearch';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useEntryProcessing } from '@/hooks/use-entry-processing';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Journal = () => {
  const [activeTab, setActiveTab] = useState('record');
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { entries, loading, fetchEntries } = useJournalEntries(user?.id, refreshKey, isProfileChecked);
  
  const { 
    processingEntries, 
    processedEntryIds, 
    handleEntryRecording 
  } = useEntryProcessing(activeTab, fetchEntries, entries);

  useEffect(() => {
    if (user?.id) {
      checkUserProfile(user.id);
    }
  }, [user?.id]);
  
  useEffect(() => {
    if (activeTab === 'entries' && isProfileChecked) {
      console.log('Tab changed to entries, fetching entries...');
      fetchEntries();
    }
  }, [activeTab, isProfileChecked, fetchEntries]);

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
    if (!tempId) {
      console.error('No tempId provided for entry recording');
      return;
    }
    
    setActiveTab('entries');
    
    await handleEntryRecording(audioBlob, tempId);
  };

  const handleDeleteEntry = (entryId: number) => {
    console.log('Entry deleted, updating UI:', entryId);
    setRefreshKey(prev => prev + 1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const filteredEntries = entries.filter(entry => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const content = entry.content?.toLowerCase() || '';
    const themes = entry.master_themes?.join(' ').toLowerCase() || '';
    
    return content.includes(query) || themes.includes(query);
  });

  const showLoading = loading && activeTab === 'entries' && !entries.length;
  
  const showEntries = activeTab === 'entries' && (!loading || entries.length > 0);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <JournalHeader />
      
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Tabs defaultValue="record" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="record">Record Entry</TabsTrigger>
            <TabsTrigger value="entries">Past Entries</TabsTrigger>
          </TabsList>
          
          <TabsContent value="record" className="mt-4">
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
            
            {showLoading && (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading your journal entries...</p>
              </div>
            )}
            
            {showEntries && (
              <JournalEntriesList 
                entries={filteredEntries} 
                loading={false}
                processingEntries={processingEntries}
                processedEntryIds={processedEntryIds}
                onStartRecording={() => setActiveTab('record')}
                onDeleteEntry={handleDeleteEntry}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Journal;
