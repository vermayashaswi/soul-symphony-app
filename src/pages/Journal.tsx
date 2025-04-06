
import React, { useState, useEffect, useRef } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { processRecording } from '@/utils/audio-processing';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import VoiceRecorder from '@/components/VoiceRecorder';
import JournalHeader from '@/components/journal/JournalHeader';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearAllToasts } from '@/services/notificationService';

const Journal = () => {
  const { user, ensureProfileExists } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('record');
  const [profileCheckTimeoutId, setProfileCheckTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [entryHasBeenProcessed, setEntryHasBeenProcessed] = useState(false);
  const [toastIds, setToastIds] = useState<{ [key: string]: string }>({});
  const [notifiedEntryIds, setNotifiedEntryIds] = useState<Set<number>>(new Set());
  const previousEntriesRef = useRef<number[]>([]);
  const profileCheckedOnceRef = useRef(false);
  
  const { entries, loading, fetchEntries, error } = useJournalEntries(
    user?.id,
    refreshKey,
    isProfileChecked
  );

  // Clear toasts on mount and unmount
  useEffect(() => {
    clearAllToasts();
    
    return () => {
      clearAllToasts();
      
      Object.values(toastIds).forEach(id => {
        if (id) toast.dismiss(id);
      });
      
      if (profileCheckTimeoutId) {
        clearTimeout(profileCheckTimeoutId);
      }
    };
  }, []);

  // Check for new entries
  useEffect(() => {
    if (entries.length > 0) {
      const currentEntryIds = entries.map(entry => entry.id);
      const prevEntryIds = previousEntriesRef.current;
      
      const newEntryIds = currentEntryIds.filter(id => !prevEntryIds.includes(id));
      
      if (newEntryIds.length > 0 && processingEntries.length > 0) {
        console.log('[Journal] New entries detected:', newEntryIds);
        setEntryHasBeenProcessed(true);
        
        // Mark these entries as processed so they get auto-expanded
        setProcessedEntryIds(prev => [...prev, ...newEntryIds]);
        
        toast.success('Journal entry analyzed and saved', {
          duration: 3000,
          id: 'journal-success-toast',
          closeButton: false
        });
        
        // Clear processing state
        setProcessingEntries([]);
        setToastIds({});
        
        // Force a refetch after a short delay to get updated themes
        setTimeout(() => {
          fetchEntries();
        }, 1000);
      }
      
      previousEntriesRef.current = currentEntryIds;
    }
  }, [entries, processingEntries, toastIds, fetchEntries]);

  // Clean up toasts on unmount
  useEffect(() => {
    return () => {
      Object.values(toastIds).forEach(id => {
        if (id) toast.dismiss(id);
      });
      
      if (profileCheckTimeoutId) {
        clearTimeout(profileCheckTimeoutId);
      }
    };
  }, [toastIds, profileCheckTimeoutId]);

  // Profile check timeout
  useEffect(() => {
    if (user?.id && isCheckingProfile && !profileCheckedOnceRef.current) {
      const timeoutId = setTimeout(() => {
        console.log('[Journal] Profile check taking too long, proceeding anyway');
        setIsCheckingProfile(false);
        setIsProfileChecked(true);
        profileCheckedOnceRef.current = true;
      }, 5000);
      
      setProfileCheckTimeoutId(timeoutId);
      
      return () => {
        clearTimeout(timeoutId);
        setProfileCheckTimeoutId(null);
      };
    }
  }, [user?.id, isCheckingProfile]);

  // Initial profile check - silently attempt to ensure profile exists
  useEffect(() => {
    if (user?.id && !isProfileChecked && !isCheckingProfile && !profileCheckedOnceRef.current) {
      checkUserProfile(user.id);
    }
  }, [user?.id, isProfileChecked, isCheckingProfile]);

  // Check for completed processing entries
  useEffect(() => {
    if (!loading && entries.length > 0 && processingEntries.length > 0) {
      const entryIds = entries.map(entry => entry.id.toString());
      const completedProcessingEntries = processingEntries.filter(tempId => 
        entryIds.includes(tempId)
      );
      
      if (completedProcessingEntries.length > 0) {
        console.log('[Journal] Found completed processing entries, dismissing their toasts:', completedProcessingEntries);
        setEntryHasBeenProcessed(true);
        
        // Get the actual entry IDs for auto-expanding
        const processedIds = entries
          .filter(entry => completedProcessingEntries.includes(entry.id.toString()))
          .map(entry => entry.id);
          
        setProcessedEntryIds(prev => [...prev, ...processedIds]);
        
        completedProcessingEntries.forEach(tempId => {
          if (toastIds[tempId]) {
            toast.success('Journal entry analyzed and saved', { 
              id: toastIds[tempId], 
              duration: 3000,
              closeButton: false
            });
          }
        });
        
        setProcessingEntries(prev => 
          prev.filter(tempId => !completedProcessingEntries.includes(tempId))
        );
        
        const newToastIds = { ...toastIds };
        completedProcessingEntries.forEach(tempId => {
          delete newToastIds[tempId];
        });
        setToastIds(newToastIds);
        
        // Force a refetch after a short delay to get updated themes
        setTimeout(() => {
          fetchEntries();
        }, 1000);
      }
    }
  }, [entries, loading, processingEntries, toastIds, fetchEntries]);

  // Notify about new entries
  useEffect(() => {
    if (loading || entries.length === 0) return;
    
    const newEntries = entries.filter(entry => 
      !notifiedEntryIds.has(entry.id) && 
      !processingEntries.some(tempId => tempId === entry.id.toString())
    );
    
    if (newEntries.length > 0 && notifiedEntryIds.size > 0) {
      if (!entryHasBeenProcessed) {
        toast.success('Journal entry analyzed and saved', { duration: 3000, closeButton: false });
        setEntryHasBeenProcessed(true);
      }
      
      // Mark these entries as processed for auto-expanding
      setProcessedEntryIds(prev => [...prev, ...newEntries.map(entry => entry.id)]);
      
      const updatedNotifiedIds = new Set(notifiedEntryIds);
      newEntries.forEach(entry => updatedNotifiedIds.add(entry.id));
      setNotifiedEntryIds(updatedNotifiedIds);
    } 
    else if (notifiedEntryIds.size === 0 && entries.length > 0) {
      const initialIds = new Set(entries.map(entry => entry.id));
      setNotifiedEntryIds(initialIds);
    }
    
    const newProcessingEntries = processingEntries.filter(tempId => 
      !entries.some(entry => entry.id.toString() === tempId)
    );
    
    if (newProcessingEntries.length !== processingEntries.length) {
      setProcessingEntries(newProcessingEntries);
      
      const newToastIds = { ...toastIds };
      processingEntries.forEach(tempId => {
        if (!newProcessingEntries.includes(tempId)) {
          delete newToastIds[tempId];
        }
      });
      setToastIds(newToastIds);
    }
  }, [entries, loading, notifiedEntryIds, processingEntries, entryHasBeenProcessed, toastIds]);

  // Poll for updates while processing entries with more frequent and longer polling
  useEffect(() => {
    if (processingEntries.length > 0) {
      // Set up an interval to poll for updates
      const interval = setInterval(() => {
        console.log('[Journal] Polling for updates while processing entries');
        setRefreshKey(prev => prev + 1);
        fetchEntries();
      }, 2000);
      
      // Set up individual polling times with increasing intervals
      const pollTimes = [1000, 2000, 3000, 5000, 8000, 12000, 15000, 20000, 25000, 30000];
      
      // Create individual timeouts for each poll time
      const timeouts = pollTimes.map(time => 
        setTimeout(() => {
          console.log(`[Journal] One-time poll at ${time}ms`);
          fetchEntries();
          setRefreshKey(prev => prev + 1);
        }, time)
      );
      
      return () => {
        clearInterval(interval);
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [processingEntries.length, fetchEntries]);

  // Silently check and create user profile if needed
  const checkUserProfile = async (userId: string) => {
    try {
      setIsCheckingProfile(true);
      
      console.log('[Journal] Checking user profile for ID:', userId);
      
      // Silently try to ensure profile exists - no UI indication of failure
      await ensureProfileExists();
      profileCheckedOnceRef.current = true;
      
      setIsProfileChecked(true);
    } catch (error: any) {
      console.error('[Journal] Error checking/creating user profile:', error);
      setIsProfileChecked(true);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handleStartRecording = () => {
    console.log('Starting new recording');
    setActiveTab('record');
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!audioBlob || !user?.id) {
      console.error('[Journal] Cannot process recording: missing audio blob or user ID');
      return;
    }
    
    try {
      // Make sure we're on the entries tab after clicking save
      setActiveTab('entries');
      
      setEntryHasBeenProcessed(false);
      clearAllToasts();
      
      const toastId = toast.loading('Processing your journal entry with AI...', {
        duration: 30000, // Increased from 15000 to 30000
        closeButton: false,
        onAutoClose: () => {
          if (toastId) {
            const updatedToastIds = { ...toastIds };
            Object.keys(updatedToastIds).forEach(key => {
              if (updatedToastIds[key] === String(toastId)) {
                delete updatedToastIds[key];
              }
            });
            setToastIds(updatedToastIds);
          }
        }
      });
      
      console.log('[Journal] Starting processing for audio file:', audioBlob.size, 'bytes');
      const { success, tempId, error } = await processRecording(audioBlob, user.id);
      
      if (success && tempId) {
        console.log('[Journal] Processing started with tempId:', tempId);
        setProcessingEntries(prev => [...prev, tempId]);
        setToastIds(prev => ({ ...prev, [tempId]: String(toastId) }));
        
        // Trigger immediate fetch
        fetchEntries();
        setRefreshKey(prev => prev + 1);
        
        // Set up polling at regular intervals with more frequent checks
        const pollIntervals = [1000, 2000, 3000, 4000, 5000, 7000, 9000, 12000, 15000, 20000, 25000];
        
        pollIntervals.forEach(interval => {
          setTimeout(() => {
            if (processingEntries.includes(tempId)) {
              console.log(`[Journal] Polling for entry at ${interval}ms interval`);
              fetchEntries();
              setRefreshKey(prev => prev + 1);
            }
          }, interval);
        });
        
        // Failsafe: If entry is still processing after max time, remove it from processing list
        setTimeout(() => {
          if (processingEntries.includes(tempId)) {
            console.log('[Journal] Maximum processing time reached for tempId:', tempId);
            
            setProcessingEntries(prev => prev.filter(id => id !== tempId));
            
            if (toastIds[tempId]) {
              toast.dismiss(toastIds[tempId]);
              
              toast.success('Journal entry analyzed and saved', { 
                duration: 3000,
                closeButton: false
              });
              
              setToastIds(prev => {
                const newToastIds = { ...prev };
                delete newToastIds[tempId];
                return newToastIds;
              });
            }
            
            // Final fetch attempt
            fetchEntries();
            setRefreshKey(prev => prev + 1);
          }
        }, 35000); // Increased from 20000 to 35000
      } else {
        console.error('[Journal] Processing failed:', error);
        toast.dismiss(toastId);
        
        toast.error(`Failed to process recording: ${error || 'Unknown error'}`, { 
          duration: 3000,
          closeButton: false
        });
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      toast.error('Error processing your recording', { 
        duration: 3000,
        closeButton: false
      });
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!user?.id) return;
    
    try {
      clearAllToasts();
      
      processingEntries.forEach(tempId => {
        if (toastIds[tempId]) {
          toast.dismiss(toastIds[tempId]);
        }
      });
      
      setProcessingEntries([]);
      setToastIds({});
      
      setNotifiedEntryIds(prev => {
        const updated = new Set(prev);
        updated.delete(entryId);
        return updated;
      });
      
      // Remove from processedEntryIds as well
      setProcessedEntryIds(prev => prev.filter(id => id !== entryId));
      
      setRefreshKey(prev => prev + 1);
      fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  // Handle profile check loading state
  if (isCheckingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
        <JournalHeader />
        <div className="mt-8 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-200">
                Error loading your journal entries: {error}
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full sm:w-auto border-red-500 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
              onClick={() => {
                setRefreshKey(prev => prev + 1);
                fetchEntries();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> 
              Retry Loading
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
      <JournalHeader />
      
      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="record">Record Entry</TabsTrigger>
          <TabsTrigger value="entries">Past Entries</TabsTrigger>
        </TabsList>
        
        <TabsContent value="record" className="mt-0">
          <div className="mb-4">
            <VoiceRecorder 
              onRecordingComplete={handleRecordingComplete}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="entries" className="mt-0">
          <JournalEntriesList
            entries={entries}
            loading={loading}
            processingEntries={processingEntries}
            processedEntryIds={processedEntryIds}
            onStartRecording={handleStartRecording}
            onDeleteEntry={handleDeleteEntry}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Journal;
