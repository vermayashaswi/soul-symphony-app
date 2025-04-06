import React, { useState, useEffect, useRef } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { processRecording, isProcessingEntry } from '@/utils/audio-processing';
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
  const profileCheckedOnceRef = useRef(false);
  
  const { entries, loading, fetchEntries } = useJournalEntries(
    user?.id,
    refreshKey,
    isProfileChecked
  );

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

  useEffect(() => {
    if (entries.length > 0) {
      const currentEntryIds = entries.map(entry => entry.id);
      const prevEntryIds = previousEntriesRef.current;
      
      const newEntryIds = currentEntryIds.filter(id => !prevEntryIds.includes(id));
      
      if (newEntryIds.length > 0 && processingEntries.length > 0) {
        console.log('[Journal] New entries detected:', newEntryIds);
        setEntryHasBeenProcessed(true);
        
        setProcessedEntryIds(prev => [...prev, ...newEntryIds]);
        
        toast.success('Journal entry analyzed and saved', {
          duration: 1000,
          id: 'journal-success-toast',
          closeButton: false
        });
        
        setProcessingEntries([]);
        setToastIds({});
      }
      
      previousEntriesRef.current = currentEntryIds;
    }
  }, [entries, processingEntries, toastIds]);

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

  useEffect(() => {
    if (isCheckingProfile && user?.id) {
      const timeoutId = setTimeout(() => {
        console.log('[Journal] Profile check taking too long, proceeding anyway');
        setIsCheckingProfile(false);
        setIsProfileChecked(true);
      }, 10000);
      
      setProfileCheckTimeoutId(timeoutId);
      
      return () => {
        clearTimeout(timeoutId);
        setProfileCheckTimeoutId(null);
      };
    }
  }, [isCheckingProfile, user?.id]);

  useEffect(() => {
    if (user?.id && isCheckingProfile && !isProfileChecked && !profileCheckedOnceRef.current) {
      checkUserProfile(user.id);
    }
  }, [user?.id, isCheckingProfile, isProfileChecked]);

  useEffect(() => {
    if (!loading && entries.length > 0 && processingEntries.length > 0) {
      const entryIds = entries.map(entry => entry.id.toString());
      const completedProcessingEntries = processingEntries.filter(tempId => 
        entryIds.includes(tempId)
      );
      
      if (completedProcessingEntries.length > 0) {
        console.log('[Journal] Found completed processing entries, dismissing their toasts:', completedProcessingEntries);
        setEntryHasBeenProcessed(true);
        
        completedProcessingEntries.forEach(tempId => {
          if (toastIds[tempId]) {
            toast.success('Journal entry analyzed and saved', { 
              id: toastIds[tempId], 
              duration: 1000,
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
      }
    }
  }, [entries, loading, processingEntries, toastIds]);

  useEffect(() => {
    if (loading || entries.length === 0) return;
    
    const newEntries = entries.filter(entry => 
      !notifiedEntryIds.has(entry.id) && 
      !processingEntries.some(tempId => tempId === entry.id.toString())
    );
    
    if (newEntries.length > 0 && notifiedEntryIds.size > 0) {
      if (!entryHasBeenProcessed) {
        toast.success('Journal entry analyzed and saved', { duration: 1000, closeButton: false });
        setEntryHasBeenProcessed(true);
      }
      
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

  useEffect(() => {
    if (processingEntries.length > 0) {
      const interval = setInterval(() => {
        console.log('[Journal] Polling for updates while processing entries');
        setRefreshKey(prev => prev + 1);
        fetchEntries();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [processingEntries.length, fetchEntries]);

  const checkUserProfile = async (userId: string) => {
    try {
      setIsCheckingProfile(true);
      setShowRetryButton(false);
      
      console.log('[Journal] Checking user profile for ID:', userId);
      
      if (!profileCheckedOnceRef.current) {
        const profileCreated = await ensureProfileExists();
        profileCheckedOnceRef.current = true;
        
        console.log('[Journal] Profile check result:', profileCreated);
        
        if (!profileCreated) {
          setShowRetryButton(true);
        }
      }
      
      setIsProfileChecked(true);
    } catch (error: any) {
      console.error('[Journal] Error checking/creating user profile:', error);
      
      const now = Date.now();
      if (now - lastProfileErrorTime > 60000) {
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
    profileCheckedOnceRef.current = false;
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
      
      clearAllToasts();
      
      const toastId = toast.loading('Processing your journal entry with AI...', {
        duration: 15000,
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
      
      const { success, tempId, error } = await processRecording(audioBlob, user.id);
      
      if (success && tempId) {
        setProcessingEntries(prev => [...prev, tempId]);
        setToastIds(prev => ({ ...prev, [tempId]: String(toastId) }));
        
        setRefreshKey(prev => prev + 1);
        fetchEntries();
        
        const pollIntervals = [3000, 6000, 10000, 15000];
        
        pollIntervals.forEach(interval => {
          setTimeout(() => {
            if (processingEntries.includes(tempId)) {
              console.log(`[Journal] Polling for entry at ${interval}ms interval`);
              setRefreshKey(prev => prev + 1);
              fetchEntries();
            }
          }, interval);
        });
        
        setTimeout(() => {
          if (processingEntries.includes(tempId)) {
            console.log('[Journal] Maximum processing time reached for tempId:', tempId);
            
            setProcessingEntries(prev => prev.filter(id => id !== tempId));
            
            if (toastIds[tempId]) {
              toast.dismiss(toastIds[tempId]);
              
              toast.success('Journal entry analyzed and saved', { 
                duration: 1000,
                closeButton: false
              });
              
              setToastIds(prev => {
                const newToastIds = { ...prev };
                delete newToastIds[tempId];
                return newToastIds;
              });
            }
            
            setRefreshKey(prev => prev + 1);
            fetchEntries();
          }
        }, 20000);
      } else {
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
