
import React, { useState, useEffect } from 'react';
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
  
  const { entries, loading, fetchEntries } = useJournalEntries(
    user?.id,
    refreshKey,
    isProfileChecked
  );

  // Cleanup toasts when component unmounts
  useEffect(() => {
    return () => {
      Object.values(toastIds).forEach(id => {
        if (id) toast.dismiss(id);
      });
    };
  }, [toastIds]);

  // Only show success notification when new entries are added and not for the initial load
  useEffect(() => {
    if (loading || entries.length === 0) return;
    
    const newEntries = entries.filter(entry => 
      !notifiedEntryIds.has(entry.id) && 
      !processingEntries.some(tempId => tempId === entry.id.toString())
    );
    
    if (newEntries.length > 0 && notifiedEntryIds.size > 0) {
      // Only show a toast if we have new entries after the initial load
      toast.success('Journal entry processed!', { duration: 1000 });
      
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
    setProcessingEntries(prev => 
      prev.filter(tempId => !entries.some(entry => entry.id.toString() === tempId))
    );
  }, [entries, loading, notifiedEntryIds, processingEntries]);

  const checkUserProfile = async (userId: string) => {
    try {
      setIsCheckingProfile(true);
      setShowRetryButton(false);
      
      console.log('[Journal] Checking user profile for ID:', userId);
      
      let profileCreated = await ensureProfileExists();
      
      if (!profileCreated && profileCheckRetryCount < 5) {
        console.log('[Journal] Profile check failed, retrying...', profileCheckRetryCount + 1);
        
        const delay = 1000 * Math.pow(1.5, profileCheckRetryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        profileCreated = await ensureProfileExists();
        
        setProfileCheckRetryCount(prevCount => prevCount + 1);
      }
      
      if (profileCreated) {
        console.log('[Journal] Profile created or verified successfully');
        setIsProfileChecked(true);
      } else if (profileCheckRetryCount >= 5) {
        console.error('[Journal] Failed to create profile after multiple retries');
        
        const now = Date.now();
        if (now - lastProfileErrorTime > 60000) {
          toast.error('Having trouble setting up your profile. You can try again or continue using the app.', { duration: 3000 });
          setLastProfileErrorTime(now);
        }
        
        setShowRetryButton(true);
        
        setIsProfileChecked(true);
      }
    } catch (error: any) {
      console.error('[Journal] Error checking/creating user profile:', error);
      
      const now = Date.now();
      if (now - lastProfileErrorTime > 60000) {
        toast.error('Having trouble with your profile. You can try again or continue using the app.', { duration: 3000 });
        setLastProfileErrorTime(now);
      }
      
      setShowRetryButton(true);
      
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
      
      const toastId = toast.loading('Processing your journal entry...', {
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
            setProcessingEntries(prev => prev.filter(id => id !== tempId));
            
            if (toastIds[tempId]) {
              toast.success('Journal entry processed!', { 
                id: toastIds[tempId], 
                duration: 1000
              });
              
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
      // Clean up any processing states and toasts
      setProcessingEntries(prev => {
        const newProcessingEntries = [...prev];
        
        newProcessingEntries.forEach(tempId => {
          if (toastIds[tempId]) {
            toast.dismiss(toastIds[tempId]);
            
            setToastIds(prev => {
              const newToastIds = { ...prev };
              delete newToastIds[tempId];
              return newToastIds;
            });
          }
        });
        
        return [];
      });
      
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
