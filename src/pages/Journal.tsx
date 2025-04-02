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
import { useIsMobile } from '@/hooks/use-mobile';

const Journal = () => {
  const [activeTab, setActiveTab] = useState('record');
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = useIsMobile();
  
  const { entries, loading, fetchEntries } = useJournalEntries(user?.id, refreshKey, isProfileChecked);

  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);

  useEffect(() => {
    if (user?.id) {
      window.dispatchEvent(new CustomEvent('operation-start', {
        detail: {
          operation: 'Check User Profile',
          details: `Checking if profile exists for user: ${user.id.substring(0, 8)}...`
        }
      }));
      
      checkUserProfile(user.id);
    }
  }, [user?.id]);
  
  useEffect(() => {
    if (activeTab === 'entries' && isProfileChecked) {
      console.log('Tab changed to entries, fetching entries...');
      
      window.dispatchEvent(new CustomEvent('operation-start', {
        detail: {
          operation: 'Fetch Entries',
          details: 'Loading journal entries from database'
        }
      }));
      
      fetchEntries();
    }
  }, [activeTab, isProfileChecked, fetchEntries]);

  useEffect(() => {
    if (processingEntries.length > 0 && activeTab === 'entries') {
      console.log('Setting up polling for processing entries:', processingEntries);
      
      const pollingInterval = setInterval(() => {
        console.log('Polling for entries updates...');
        fetchEntries();
      }, 5000);
      
      return () => clearInterval(pollingInterval);
    }
  }, [processingEntries, activeTab, fetchEntries]);

  useEffect(() => {
    const handleJournalEntryCreated = () => {
      console.log('Journal entry created event received');
      setRefreshKey(prev => prev + 1);
      fetchEntries();
      
      if (isMobile) {
        setActiveTab('entries');
      }
    };
    
    window.addEventListener('journal-entry-created', handleJournalEntryCreated);
    
    return () => {
      window.removeEventListener('journal-entry-created', handleJournalEntryCreated);
    };
  }, [fetchEntries, isMobile]);

  useEffect(() => {
    if (processingEntries.length > 0 && entries.length > 0) {
      const newlyCompletedTempIds = [];
      
      for (const entry of entries) {
        if (entry.foreignKey && processingEntries.includes(entry.foreignKey)) {
          newlyCompletedTempIds.push(entry.foreignKey);
          setProcessedEntryIds(prev => [...prev, entry.id]);
        }
      }
      
      if (newlyCompletedTempIds.length > 0) {
        console.log('Found newly completed entries:', newlyCompletedTempIds);
        setProcessingEntries(prev => 
          prev.filter(id => !newlyCompletedTempIds.includes(id))
        );
      }
    }
  }, [entries, processingEntries]);

  const checkUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (error || !profile) {
        console.log('Creating user profile...');
        
        window.dispatchEvent(new CustomEvent('operation-start', {
          detail: {
            operation: 'Create Profile',
            details: `Creating new profile for user: ${userId.substring(0, 8)}...`
          }
        }));
        
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
        
        window.dispatchEvent(new CustomEvent('operation-complete', {
          detail: {
            operation: 'Create Profile',
            success: true,
            details: 'User profile created successfully'
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('operation-complete', {
          detail: {
            operation: 'Check User Profile',
            success: true,
            details: 'User profile exists'
          }
        }));
      }
      
      setIsProfileChecked(true);
    } catch (error: any) {
      console.error('Error checking/creating user profile:', error);
      
      window.dispatchEvent(new CustomEvent('operation-complete', {
        detail: {
          operation: error.message.includes('Creating') ? 'Create Profile' : 'Check User Profile',
          success: false,
          error: error.message || 'Unknown error'
        }
      }));
      
      toast.error('Error setting up profile. Please try again.');
    }
  };

  const onEntryRecorded = async (audioBlob: Blob, tempId?: string) => {
    console.log('Entry recorded, adding to processing queue with temp ID:', tempId);
    
    window.dispatchEvent(new CustomEvent('operation-complete', {
      detail: {
        operation: 'Record Entry',
        success: true,
        details: `Recorded audio with temp ID: ${tempId}`
      }
    }));
    
    window.dispatchEvent(new CustomEvent('operation-start', {
      detail: {
        operation: 'Process Entry',
        details: `Processing entry with temp ID: ${tempId}`
      }
    }));
    
    if (tempId) {
      setProcessingEntries(prev => [...prev, tempId]);
    }
    
    if (isMobile) {
      setActiveTab('entries');
    }
    
    setRefreshKey(prev => prev + 1);
    fetchEntries();
    
    const checkEntryProcessed = async () => {
      try {
        console.log('Checking if entry is processed with temp ID:', tempId);
        
        window.dispatchEvent(new CustomEvent('operation-start', {
          detail: {
            operation: 'Check Entry Status',
            details: `Checking status for entry with temp ID: ${tempId}`
          }
        }));
        
        const { data, error } = await supabase
          .from('"Journal_Entries"')
          .select('id, "refined text"')
          .eq('foreign key', tempId)
          .single();
          
        if (error) {
          console.error('Error fetching newly created entry:', error);
          
          window.dispatchEvent(new CustomEvent('operation-complete', {
            detail: {
              operation: 'Check Entry Status',
              success: false,
              error: error.message || 'Error fetching entry status'
            }
          }));
          
          return false;
        } else if (data) {
          console.log('New entry found:', data.id);
          
          window.dispatchEvent(new CustomEvent('operation-complete', {
            detail: {
              operation: 'Check Entry Status',
              success: true,
              details: `Entry found with ID: ${data.id}`
            }
          }));
          
          window.dispatchEvent(new CustomEvent('operation-start', {
            detail: {
              operation: 'Generate Themes',
              details: `Generating themes for entry ID: ${data.id}`
            }
          }));
          
          await supabase.functions.invoke('generate-themes', {
            body: {
              text: data["refined text"],
              entryId: data.id
            }
          }).then(() => {
            window.dispatchEvent(new CustomEvent('operation-complete', {
              detail: {
                operation: 'Generate Themes',
                success: true,
                details: 'Themes generated successfully'
              }
            }));
          }).catch(error => {
            window.dispatchEvent(new CustomEvent('operation-complete', {
              detail: {
                operation: 'Generate Themes',
                success: false,
                error: error.message || 'Error generating themes'
              }
            }));
          });
          
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error checking for processed entry:', error);
        
        window.dispatchEvent(new CustomEvent('operation-complete', {
          detail: {
            operation: 'Check Entry Status',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error checking entry status'
          }
        }));
        
        return false;
      }
    };
    
    const pollInterval = setInterval(async () => {
      const isProcessed = await checkEntryProcessed();
      
      if (isProcessed) {
        clearInterval(pollInterval);
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        setRefreshKey(prev => prev + 1);
        fetchEntries();
        
        window.dispatchEvent(new CustomEvent('operation-complete', {
          detail: {
            operation: 'Process Entry',
            success: true,
            details: 'Entry processed and stored successfully'
          }
        }));
        
        toast.success('Journal entry processed successfully!');
      }
    }, 3000);
    
    setTimeout(() => {
      clearInterval(pollInterval);
      if (processingEntries.includes(tempId || '')) {
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        
        window.dispatchEvent(new CustomEvent('operation-complete', {
          detail: {
            operation: 'Process Entry',
            success: false,
            details: 'Entry processing is taking longer than expected',
            error: 'Processing timeout - the entry should appear soon'
          }
        }));
        
        toast.info('Entry processing is taking longer than expected. It should appear soon.');
        
        fetchEntries();
      }
    }, 120000);
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
    const content = entry.content.toLowerCase();
    const themes = entry.themes?.join(' ').toLowerCase() || '';
    
    return content.includes(query) || themes.includes(query);
  });

  const showLoading = loading && activeTab === 'entries' && !entries.length;
  
  const showEntries = activeTab === 'entries' && (!loading || entries.length > 0);

  const tabContainerClass = isMobile ? "container mx-auto px-4 py-4 max-w-5xl" : "container mx-auto px-4 py-6 max-w-5xl";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <JournalHeader />
      
      <div className={tabContainerClass}>
        <Tabs defaultValue="record" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 md:mb-6">
            <TabsTrigger value="record" className="text-sm md:text-base">Record Entry</TabsTrigger>
            <TabsTrigger value="entries" className="text-sm md:text-base">Past Entries</TabsTrigger>
          </TabsList>
          
          <TabsContent value="record" className="mt-2 md:mt-4">
            <Card>
              <CardHeader className="pb-2 md:pb-4">
                <CardTitle className="text-center text-lg md:text-xl">Record a New Journal Entry</CardTitle>
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
              <div className="flex flex-col items-center justify-center h-48 md:h-64">
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
