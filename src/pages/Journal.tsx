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

const Journal = () => {
  const { user, ensureProfileExists } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState('record');
  const [profileCheckRetryCount, setProfileCheckRetryCount] = useState(0);
  const [lastProfileErrorTime, setLastProfileErrorTime] = useState(0);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [toastIds, setToastIds] = useState<{ [key: string]: string }>({});
  const [notifiedEntryIds, setNotifiedEntryIds] = useState<Set<number>>(new Set());
  const [profileCheckTimeoutId, setProfileCheckTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [entryHasBeenProcessed, setEntryHasBeenProcessed] = useState(false);
  const previousEntriesRef = useRef<number[]>([]);
  
  const { entries, loading, fetchEntries } = useJournalEntries(
    user?.id,
    refreshKey,
    isProfileChecked
  );

  // Track previously seen entries to detect when new ones appear
  useEffect(() => {
    if (entries.length > 0) {
      const currentEntryIds = entries.map(entry => entry.id);
      const prevEntryIds = previousEntriesRef.current;
      
      // Check if we have new entries that weren't in the previous list
      const newEntryIds = currentEntryIds.filter(id => !prevEntryIds.includes(id));
      
      if (newEntryIds.length > 0 && processingEntries.length > 0) {
        console.log('[Journal] New entries detected:', newEntryIds);
        setEntryHasBeenProcessed(true);
        
        // Update the list of processed entry IDs
        setProcessedEntryIds(prev => [...prev, ...newEntryIds]);
        
        // Dismiss all processing toast notifications and show success
        processingEntries.forEach(tempId => {
          if (toastIds[tempId]) {
            // Replace processing toast with success toast
            toast.success('Journal entry analyzed and saved', {
              id: toastIds[tempId],
              duration: 3000
            });
          }
        });
        
        // Clear all processing entries as they're now complete
        setProcessingEntries([]);
        setToastIds({});
      }
      
      // Update the reference of previous entries
      previousEntriesRef.current = currentEntryIds;
    }
  }, [entries, processingEntries, toastIds]);

  // Clean up toasts when component unmounts
  useEffect(() => {
    return () => {
      // Dismiss all toasts when unmounting
      Object.values(toastIds).forEach(id => {
        if (id) toast.dismiss(id);
      });
      
      if (profileCheckTimeoutId) {
        clearTimeout(profileCheckTimeoutId);
      }
    };
  }, [toastIds, profileCheckTimeoutId]);

  // Set a maximum timeout for profile checking to prevent infinite loading state
  useEffect(() => {
    if (isCheckingProfile && user?.id) {
      const timeoutId = setTimeout(() => {
        console.log('[Journal] Profile check taking too long, proceeding anyway');
        setIsCheckingProfile(false);
        setIsProfileChecked(true);
      }, 10000); // 10 seconds maximum wait time
      
      setProfileCheckTimeoutId(timeoutId);
      
      return () => {
        clearTimeout(timeoutId);
        setProfileCheckTimeoutId(null);
      };
    }
  }, [isCheckingProfile, user?.id]);

  // Initialize profile checking when user is available
  useEffect(() => {
    if (user?.id && isCheckingProfile && !isProfileChecked) {
      checkUserProfile(user.id);
    }
  }, [user?.id, isCheckingProfile, isProfileChecked]);

  // Check if any processing entries appear in the loaded entries list, and dismiss their loading toasts
  useEffect(() => {
    if (!loading && entries.length > 0 && processingEntries.length > 0) {
      const entryIds = entries.map(entry => entry.id.toString());
      const completedProcessingEntries = processingEntries.filter(tempId => 
        entryIds.includes(tempId)
      );
      
      if (completedProcessingEntries.length > 0) {
        console.log('[Journal] Found completed processing entries, dismissing their toasts:', completedProcessingEntries);
        setEntryHasBeenProcessed(true);
        
        // Dismiss the loading toasts for completed entries and show success notifications
        completedProcessingEntries.forEach(tempId => {
          if (toastIds[tempId]) {
            toast.success('Journal entry analyzed and saved', { 
              id: toastIds[tempId], 
              duration: 3000
            });
          }
        });
        
        // Remove completed entries from processingEntries and toastIds
        setProcessingEntries(prev => 
          prev.filter(tempId => !completedProcessingEntries.includes(tempId))
        );
        
        // Clean up toastIds
        const newToastIds = { ...toastIds };
        completedProcessingEntries.forEach(tempId => {
          delete newToastIds[tempId];
        });
        setToastIds(newToastIds);
      }
    }
  }, [entries, loading, processingEntries, toastIds]);

  // Only show success notification when new entries are added and not for the initial load
  useEffect(() => {
    if (loading || entries.length === 0) return;
    
    const newEntries = entries.filter(entry => 
      !notifiedEntryIds.has(entry.id) && 
      !processingEntries.some(tempId => tempId === entry.id.toString())
    );
    
    if (newEntries.length > 0 && notifiedEntryIds.size > 0) {
      // Only show a toast if we have new entries after the initial load
      if (!entryHasBeenProcessed) {
        toast.success('Journal entry analyzed and saved', { duration: 3000 });
        setEntryHasBeenProcessed(true);
      }
      
      const updatedNotifiedIds = new Set(notifiedEntryIds);
      newEntries.forEach(entry => updatedNotifiedIds.add(entry.id));
      setNotifiedEntryIds(updatedNotifiedIds);
    } 
    else if (notifiedEntryIds.size === 0 && entries.length > 0) {
      // Initialize the set with all current entries on first load
      const initialIds = new Set(entries.map(entry => entry.id));
      setNotifiedEntryIds(initialIds);
    }
    
    // Clear any entries from processingEntries that now appear in the actual entries list
    const newProcessingEntries = processingEntries.filter(tempId => 
      !entries.some(entry => entry.id.toString() === tempId)
    );
    
    if (newProcessingEntries.length !== processingEntries.length) {
      setProcessingEntries(newProcessingEntries);
      
      // Clean up associated toastIds
      const newToastIds = { ...toastIds };
      processingEntries.forEach(tempId => {
        if (!newProcessingEntries.includes(tempId)) {
          delete newToastIds[tempId];
        }
      });
      setToastIds(newToastIds);
    }
  }, [entries, loading, notifiedEntryIds, processingEntries, entryHasBeenProcessed, toastIds]);

  const checkUserProfile = async (userId: string) => {
    try {
      setIsCheckingProfile(true);
      setShowRetryButton(false);
      
      console.log('[Journal] Checking user profile for ID:', userId);
      
      let profileCreated = await ensureProfileExists();
      
      if (!profileCreated && profileCheckRetryCount < 3) {
        console.log('[Journal] Profile check failed, retrying...', profileCheckRetryCount + 1);
        
        const delay = 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        profileCreated = await ensureProfileExists();
        
        setProfileCheckRetryCount(prevCount => prevCount + 1);
      }
      
      // Even if profile creation fails, proceed after a few attempts
      console.log('[Journal] Proceeding with journal view regardless of profile status');
      setIsProfileChecked(true);
      
      if (!profileCreated) {
        setShowRetryButton(true);
      }
    } catch (error: any) {
      console.error('[Journal] Error checking/creating user profile:', error);
      
      const now = Date.now();
      if (now - lastProfileErrorTime > 60000) {
        toast.error('Having trouble with your profile. You can try again or continue using the app.', { duration: 3000 });
        setLastProfileErrorTime(now);
      }
      
      setShowRetryButton(true);
      
      // Still proceed to show the journal even if there was an error
      setIsProfileChecked(true);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handleRetryProfileCreation = () => {
    if (!user?.id) return;
    
    setProfileCheckRetryCount(0);
    setIsProfileChecked(false);
    checkUserProfile(user.id);
  };

  const handleStartRecording = () => {
    console.log('Starting new recording');
    setActiveTab('record');
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!audioBlob || !user?.id) return;
    
    try {
      setActiveTab('entries');
      setEntryHasBeenProcessed(false);
      
      // Use a clearer message for the processing toast
      const toastId = toast.loading('Processing your journal entry with AI...', {
        duration: Infinity // This will persist until we explicitly dismiss it
      });
      
      const { success, tempId, error } = await processRecording(audioBlob, user.id);
      
      if (success && tempId) {
        setProcessingEntries(prev => [...prev, tempId]);
        setToastIds(prev => ({ ...prev, [tempId]: String(toastId) }));
        
        // Refresh entries immediately to check for quick processing
        setRefreshKey(prev => prev + 1);
        fetchEntries();
        
        // Check again after a short delay
        setTimeout(() => {
          setRefreshKey(prev => prev + 1);
          fetchEntries();
        }, 5000);
        
        // Set a maximum processing time after which we'll dismiss the loading toast
        setTimeout(() => {
          if (processingEntries.includes(tempId)) {
            console.log('[Journal] Maximum processing time reached for tempId:', tempId);
            
            // Find and remove the specific entry from processingEntries
            setProcessingEntries(prev => prev.filter(id => id !== tempId));
            
            // Change loading toast to success toast
            if (toastIds[tempId]) {
              toast.success('Journal entry analyzed and saved', { 
                id: toastIds[tempId], 
                duration: 3000
              });
              
              // Remove this toast ID from tracking
              setToastIds(prev => {
                const newToastIds = { ...prev };
                delete newToastIds[tempId];
                return newToastIds;
              });
            }
          }
          
          setRefreshKey(prev => prev + 1);
          fetchEntries();
        }, 15000);
      } else {
        // Dismiss the loading toast and show an error
        toast.error(`Failed to process recording: ${error || 'Unknown error'}`, { 
          id: toastId,
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      toast.error('Error processing your recording', { duration: 3000 });
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!user?.id) return;
    
    try {
      // Clean up any processing states and explicitly dismiss all toasts
      processingEntries.forEach(tempId => {
        if (toastIds[tempId]) {
          toast.dismiss(toastIds[tempId]);
        }
      });
      
      // Clear all processing entries and toast IDs
      setProcessingEntries([]);
      setToastIds({});
      
      setNotifiedEntryIds(prev => {
        const updated = new Set(prev);
        updated.delete(entryId);
        return updated;
      });
      
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

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

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
      <JournalHeader />
      
      {showRetryButton && (
        <div className="mb-6 p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200">
                We're having trouble setting up your profile. Your entries may not be saved correctly.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full sm:w-auto border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
              onClick={handleRetryProfileCreation}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> 
              Retry Profile Setup
            </Button>
          </div>
        </div>
      )}
      
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
