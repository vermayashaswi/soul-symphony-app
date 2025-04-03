
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
import JournalDebugPanel from '@/components/journal/JournalDebugPanel';

const Journal = () => {
  const [activeTab, setActiveTab] = useState('record');
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { entries, loading, fetchEntries } = useJournalEntries(user?.id, refreshKey, isProfileChecked);

  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);

  useEffect(() => {
    if (user?.id) {
      console.log("User authenticated, ID:", user.id);
      checkUserProfile(user.id);
    } else {
      console.warn("No user ID found, authentication may be needed");
    }
  }, [user?.id]);
  
  useEffect(() => {
    if (activeTab === 'entries' && isProfileChecked) {
      console.log('Tab changed to entries, fetching entries...');
      
      // Dispatch operation start event
      const event = new CustomEvent('journalOperationStart', {
        detail: {
          type: 'loading',
          message: 'Loading journal entries'
        }
      });
      const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;
      
      fetchEntries()
        .then(() => {
          if (opId) {
            window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
              detail: {
                id: opId,
                status: 'success'
              }
            }));
          }
        })
        .catch(error => {
          if (opId) {
            window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
              detail: {
                id: opId,
                status: 'error',
                details: error.message
              }
            }));
          }
        });
    }
  }, [activeTab, isProfileChecked, fetchEntries]);

  useEffect(() => {
    if (processingEntries.length > 0 && activeTab === 'entries') {
      console.log('Setting up polling for processing entries:', processingEntries);
      
      const pollingInterval = setInterval(() => {
        fetchEntries();
      }, 5000);
      
      return () => clearInterval(pollingInterval);
    }
  }, [processingEntries, activeTab, fetchEntries]);

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
        setProcessingEntries(prev => 
          prev.filter(id => !newlyCompletedTempIds.includes(id))
        );
      }
    }
  }, [entries, processingEntries]);

  const checkUserProfile = async (userId: string) => {
    try {
      // Dispatch operation start event
      const event = new CustomEvent('journalOperationStart', {
        detail: {
          type: 'loading',
          message: 'Checking user profile'
        }
      });
      const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;
      
      console.log('Checking user profile for ID:', userId);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (error || !profile) {
        console.log('Creating user profile...');
        
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          if (opId) {
            window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
              detail: {
                id: opId,
                status: 'error',
                details: `Auth error: ${userError.message}`
              }
            }));
          }
          throw userError;
        }
        
        console.log('User data retrieved:', userData.user?.id);
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: userId,
            email: userData.user?.email,
            full_name: userData.user?.user_metadata?.full_name || '',
            avatar_url: userData.user?.user_metadata?.avatar_url || ''
          }]);
          
        if (insertError) {
          console.error('Error creating user profile:', insertError);
          if (opId) {
            window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
              detail: {
                id: opId,
                status: 'error',
                details: `Insert error: ${insertError.message}`
              }
            }));
          }
          throw insertError;
        }
        console.log('Profile created successfully');
      } else {
        console.log('Profile exists:', profile.id);
      }
      
      setIsProfileChecked(true);
      if (opId) {
        window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
          detail: {
            id: opId,
            status: 'success'
          }
        }));
      }
    } catch (error: any) {
      console.error('Error checking/creating user profile:', error);
      toast.error('Error setting up profile. Please try again.');
    }
  };

  const onEntryRecorded = async (audioBlob: Blob, tempId?: string) => {
    if (!user?.id) {
      toast.error('You must be logged in to record journal entries.');
      return;
    }
    
    // Dispatch operation start event
    const event = new CustomEvent('journalOperationStart', {
      detail: {
        type: 'recording',
        message: 'Processing new journal entry',
        details: `Temp ID: ${tempId}`
      }
    });
    const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;
    
    console.log('Entry recorded, adding to processing queue. User ID:', user.id);
    
    if (tempId) {
      setProcessingEntries(prev => [...prev, tempId]);
      
      if (opId) {
        window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
          detail: {
            id: opId,
            message: 'Entry recorded, processing started'
          }
        }));
      }
    }
    
    setActiveTab('entries');
    
    fetchEntries();
    
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
          
          if (opId) {
            window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
              detail: {
                id: opId,
                details: `Error checking entry: ${error.message}`
              }
            }));
          }
          
          return false;
        } else if (data) {
          console.log('New entry found:', data.id);
          
          if (opId) {
            window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
              detail: {
                id: opId,
                message: 'Entry processed, generating themes and entities'
              }
            }));
          }
          
          try {
            // Ensure themes are generated for the entry
            const themesResult = await supabase.functions.invoke('generate-themes', {
              body: {
                text: data["refined text"],
                entryId: data.id
              }
            });
            
            console.log('Themes generation result:', themesResult);

            // Ensure entities are extracted for the entry
            const entitiesResult = await supabase.functions.invoke('batch-extract-entities', {
              body: {
                userId: user.id,
                processAll: false
              }
            });
            
            console.log('Entity extraction result:', entitiesResult);
            
            if (opId) {
              window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
                detail: {
                  id: opId,
                  status: 'success',
                  message: 'Entry fully processed with themes and entities',
                  details: JSON.stringify({
                    themes: themesResult,
                    entities: entitiesResult
                  }, null, 2)
                }
              }));
            }
          } catch (processingError: any) {
            console.error('Error processing entry:', processingError);
            
            if (opId) {
              window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
                detail: {
                  id: opId,
                  status: 'error',
                  details: `Processing error: ${processingError.message || 'Unknown error'}`
                }
              }));
            }
          }
          
          return true;
        }
        return false;
      } catch (error: any) {
        console.error('Error checking for processed entry:', error);
        
        if (opId) {
          window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
            detail: {
              id: opId,
              status: 'error',
              details: `Error checking entry: ${error.message}`
            }
          }));
        }
        
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
        toast.success('Journal entry processed successfully!');
      }
    }, 3000);
    
    setTimeout(() => {
      clearInterval(pollInterval);
      if (processingEntries.includes(tempId || '')) {
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        toast.info('Entry processing is taking longer than expected. It should appear soon.');
        
        if (opId) {
          window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
            detail: {
              id: opId,
              status: 'error',
              message: 'Entry processing timeout',
              details: 'Processing took longer than expected. The entry may still appear soon.'
            }
          }));
        }
      }
    }, 120000);
  };

  const handleDeleteEntry = async (entryId: number) => {
    // Dispatch operation start event
    const event = new CustomEvent('journalOperationStart', {
      detail: {
        type: 'deletion',
        message: `Deleting entry #${entryId}`
      }
    });
    const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;
    
    try {
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entryId);
        
      if (error) {
        console.error('Error deleting entry:', error);
        
        if (opId) {
          window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
            detail: {
              id: opId,
              status: 'error',
              details: `Deletion error: ${error.message}`
            }
          }));
        }
        
        toast.error('Failed to delete entry');
        return;
      }
      
      console.log('Entry deleted, updating UI:', entryId);
      
      if (opId) {
        window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
          detail: {
            id: opId,
            status: 'success'
          }
        }));
      }
      
      setRefreshKey(prev => prev + 1);
      toast.success('Entry deleted successfully');
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      
      if (opId) {
        window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
          detail: {
            id: opId,
            status: 'error',
            details: error.message
          }
        }));
      }
      
      toast.error('Failed to delete entry');
    }
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
      
      <JournalDebugPanel />
    </div>
  );
};

export default Journal;
