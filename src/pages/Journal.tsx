
// Fix how we handle processing of entries, especially after new entry is saved

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { processRecording, getProcessingEntries } from '@/utils/audio-processing';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import VoiceRecorder from '@/components/VoiceRecorder';
import JournalHeader from '@/components/journal/JournalHeader';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearAllToasts } from '@/services/notificationService';
import ErrorBoundary from '@/components/journal/ErrorBoundary';
import { debugLogger, logInfo, logError } from '@/components/debug/DebugPanel';

// Helper function to format bytes to human readable format
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const Journal = () => {
  const { user, ensureProfileExists } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('entries');
  const [profileCheckRetryCount, setProfileCheckRetryCount] = useState(0);
  const [lastProfileErrorTime, setLastProfileErrorTime] = useState(0);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [toastIds, setToastIds] = useState<{ [key: string]: string }>({});
  const [notifiedEntryIds, setNotifiedEntryIds] = useState<Set<number>>(new Set());
  const [profileCheckTimeoutId, setProfileCheckTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [entryHasBeenProcessed, setEntryHasBeenProcessed] = useState(false);
  const [isRecordingComplete, setIsRecordingComplete] = useState(false);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [hasRenderError, setHasRenderError] = useState(false);
  const [safeToSwitchTab, setSafeToSwitchTab] = useState(true);
  const [profileCreationAttempts, setProfileCreationAttempts] = useState(0);
  const [tabChangeInProgress, setTabChangeInProgress] = useState(false);
  const [maxProfileAttempts, setMaxProfileAttempts] = useState(3);
  const previousEntriesRef = useRef<number[]>([]);
  const profileCheckedOnceRef = useRef(false);
  const entriesListRef = useRef<HTMLDivElement>(null);
  const [lastAction, setLastAction] = useState<string>('Page Loaded');
  const [audioStatus, setAudioStatus] = useState<string>('No Recording');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [entriesReady, setEntriesReady] = useState(false);
  const autoRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [shouldPollForUpdates, setShouldPollForUpdates] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    logInfo('Journal page mounted', 'Journal');
    
    // Load any persisted processing entries when the component mounts
    const loadProcessingEntries = () => {
      const storedEntries = getProcessingEntries();
      if (storedEntries.length > 0) {
        console.log('[Journal] Found persisted processing entries:', storedEntries);
        setProcessingEntries(storedEntries);
        setShouldPollForUpdates(true);
      }
    };
    
    loadProcessingEntries();
    
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      if (event.detail && Array.isArray(event.detail.entries)) {
        console.log('[Journal] Processing entries changed event:', event.detail.entries);
        setProcessingEntries(event.detail.entries);
        
        if (event.detail.entries.length > 0) {
          setShouldPollForUpdates(true);
        } else {
          setShouldPollForUpdates(false);
        }
      }
    };
    
    window.addEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
    
    const handleError = (event: ErrorEvent) => {
      console.error('[Journal] Caught render error:', event);
      logError(`Render error: ${event.message}`, 'Journal', {
        filename: event.filename,
        lineno: event.lineno,
        stack: event.error?.stack
      });
      setHasRenderError(true);
    };
    
    window.addEventListener('error', handleError);
    
    return () => {
      logInfo('Journal page unmounted', 'Journal');
      window.removeEventListener('error', handleError);
      window.removeEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
      
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      clearAllToasts();
    };
  }, []);

  const { 
    entries, 
    loading, 
    fetchEntries, 
    error: entriesError, 
    profileExists 
  } = useJournalEntries(
    user?.id,
    refreshKey,
    isProfileChecked
  );

  // Set up polling for updates when we have processing entries
  useEffect(() => {
    if (shouldPollForUpdates) {
      console.log('[Journal] Starting polling for updates');
      
      // Do an immediate fetch
      fetchEntries();
      
      // Set up interval for polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      pollIntervalRef.current = setInterval(() => {
        console.log('[Journal] Polling for updates');
        fetchEntries();
        setRefreshKey(prev => prev + 1);
      }, 3000);
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    } else {
      // Clean up interval if we stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [shouldPollForUpdates, fetchEntries]);

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
      
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!loading && entries.length > 0 && isSavingRecording) {
      const timer = setTimeout(() => {
        setSafeToSwitchTab(true);
        setActiveTab('entries');
        setIsSavingRecording(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [loading, entries.length, isSavingRecording]);

  useEffect(() => {
    if (entries.length > 0) {
      const currentEntryIds = entries.map(entry => entry.id);
      const prevEntryIds = previousEntriesRef.current;
      
      const newEntryIds = currentEntryIds.filter(id => !prevEntryIds.includes(id));
      
      if (newEntryIds.length > 0 && processingEntries.length > 0) {
        console.log('[Journal] New entries detected:', newEntryIds);
        logInfo(`New entries detected: ${newEntryIds.join(', ')}`, 'Journal');
        setEntryHasBeenProcessed(true);
        
        setProcessedEntryIds(prev => [...prev, ...newEntryIds]);
        
        toast.success('Journal entry analyzed and saved', {
          duration: 3000,
          id: 'journal-success-toast',
          closeButton: false
        });
        
        // Do an additional fetch to get complete entry data
        setTimeout(() => {
          console.log('[Journal] Doing additional fetch for complete entry data');
          fetchEntries();
          setRefreshKey(prev => prev + 1);
        }, 1000);
        
        // Clear processing state since we have the entries now
        setProcessingEntries([]);
        setToastIds({});
        setIsSavingRecording(false);
        setSafeToSwitchTab(true);
        setShouldPollForUpdates(false);
        
        // Switch to entries tab if we're still on record
        if (activeTab === 'record') {
          setActiveTab('entries');
        }
        
        setEntriesReady(true);
      }
      
      previousEntriesRef.current = currentEntryIds;
      
      if (!entriesReady && entries.length > 0) {
        setEntriesReady(true);
      }
    }
  }, [entries, processingEntries, toastIds, entriesReady, activeTab, fetchEntries]);

  useEffect(() => {
    return () => {
      Object.values(toastIds).forEach(id => {
        if (id) toast.dismiss(id);
      });
      
      if (profileCheckTimeoutId) {
        clearTimeout(profileCheckTimeoutId);
      }
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [toastIds, profileCheckTimeoutId]);

  useEffect(() => {
    if (user?.id && isCheckingProfile && !profileCheckedOnceRef.current) {
      const timeoutId = setTimeout(() => {
        console.log('[Journal] Profile check taking too long, proceeding anyway');
        logInfo('Profile check taking too long, proceeding anyway', 'Journal');
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

  useEffect(() => {
    if (user?.id && !isProfileChecked && !isCheckingProfile && !profileCheckedOnceRef.current) {
      checkUserProfile(user.id);
    }
  }, [user?.id, isProfileChecked, isCheckingProfile]);

  const checkUserProfile = async (userId: string) => {
    try {
      setIsCheckingProfile(true);
      setShowRetryButton(false);
      setLastAction('Checking Profile');
      
      console.log('[Journal] Checking user profile for ID:', userId);
      logInfo(`Checking user profile for ID: ${userId}`, 'Journal');
      
      const profileCreated = await ensureProfileExists();
      profileCheckedOnceRef.current = true;
      
      console.log('[Journal] Profile check result:', profileCreated);
      logInfo(`Profile check result: ${profileCreated}`, 'Journal');
      
      if (!profileCreated) {
        if (profileCreationAttempts < maxProfileAttempts) {
          setProfileCreationAttempts(prev => prev + 1);
          logInfo(`Scheduling automatic profile creation retry ${profileCreationAttempts + 1}/${maxProfileAttempts}`, 'Journal');
          
          const retryDelay = 1000 * Math.pow(1.5, profileCreationAttempts);
          
          if (autoRetryTimeoutRef.current) {
            clearTimeout(autoRetryTimeoutRef.current);
          }
          
          autoRetryTimeoutRef.current = setTimeout(() => {
            logInfo(`Executing automatic profile creation retry ${profileCreationAttempts + 1}/${maxProfileAttempts}`, 'Journal');
            setLastAction(`Auto Retry Profile ${profileCreationAttempts + 1}`);
            
            if (profileCreationAttempts >= maxProfileAttempts - 1) {
              setShowRetryButton(true);
            }
            
            checkUserProfile(userId);
          }, retryDelay);
        } else {
          setShowRetryButton(true);
          setLastAction('Profile Check Failed');
        }
      } else {
        setLastAction('Profile Check Success');
        setProfileCreationAttempts(0);
      }
      
      setIsProfileChecked(true);
    } catch (error: any) {
      console.error('[Journal] Error checking/creating user profile:', error);
      logError(`Error checking/creating user profile: ${error.message}`, 'Journal', error);
      
      const now = Date.now();
      if (now - lastProfileErrorTime > 60000) {
        setLastProfileErrorTime(now);
      }
      
      if (profileCreationAttempts < maxProfileAttempts) {
        setProfileCreationAttempts(prev => prev + 1);
        logInfo(`Scheduling automatic profile creation retry after error ${profileCreationAttempts + 1}/${maxProfileAttempts}`, 'Journal');
        
        const retryDelay = 1000 * Math.pow(1.5, profileCreationAttempts);
        
        if (autoRetryTimeoutRef.current) {
          clearTimeout(autoRetryTimeoutRef.current);
        }
        
        autoRetryTimeoutRef.current = setTimeout(() => {
          logInfo(`Executing automatic profile creation retry after error ${profileCreationAttempts + 1}/${maxProfileAttempts}`, 'Journal');
          setLastAction(`Auto Retry Profile After Error ${profileCreationAttempts + 1}`);
          
          if (profileCreationAttempts >= maxProfileAttempts - 1) {
            setShowRetryButton(true);
          }
          
          checkUserProfile(userId);
        }, retryDelay);
      } else {
        setShowRetryButton(true);
        setLastAction('Profile Check Error');
      }
      
      setIsProfileChecked(true);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handleRetryProfileCreation = () => {
    if (!user?.id) return;
    
    setProfileCreationAttempts(0);
    profileCheckedOnceRef.current = false;
    setIsProfileChecked(false);
    setLastAction('Retry Profile Creation');
    checkUserProfile(user.id);
  };

  const handleStartRecording = () => {
    console.log('Starting new recording');
    setActiveTab('record');
    setLastAction('Start Recording Tab');
    setProcessingError(null);
  };

  const handleTabChange = (value: string) => {
    console.log(`[Journal] Tab change requested to: ${value}. Current safeToSwitchTab: ${safeToSwitchTab}`);
    
    if (value === 'entries' && !safeToSwitchTab) {
      console.log('[Journal] User attempting to switch to entries while processing');
      
      toast.info('Processing in progress...', { 
        duration: 2000,
        closeButton: false
      });
      
      return; // Don't allow switching to entries while processing
    }
    
    setTabChangeInProgress(true);
    
    setTimeout(() => {
      setActiveTab(value);
      
      if (value === 'entries') {
        fetchEntries();
      }
      
      setTabChangeInProgress(false);
    }, 50);
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!audioBlob || !user?.id) {
      console.error('[Journal] Cannot process recording: missing audio blob or user ID');
      setProcessingError('Cannot process recording: missing required information');
      setIsRecordingComplete(false);
      setIsSavingRecording(false);
      setLastAction('Recording Failed - Missing Data');
      return;
    }
    
    try {
      await new Promise<void>((resolve) => {
        clearAllToasts();
        setTimeout(() => {
          clearAllToasts();
          setTimeout(() => resolve(), 150);
        }, 50);
      });
      
      setIsRecordingComplete(true);
      setIsSavingRecording(true);
      setProcessingError(null);
      setLastAction('Recording Complete - Processing');
      setAudioStatus(`Processing (${formatBytes(audioBlob.size)})`);
      setSafeToSwitchTab(false);
      setEntriesReady(false);
      
      // Switch to entries tab immediately so the user can see the processing state
      setTimeout(() => {
        setActiveTab('entries');
      }, 50);
      
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
      
      console.log('[Journal] Starting processing for audio file:', audioBlob.size, 'bytes');
      const { success, tempId, error } = await processRecording(audioBlob, user.id);
      
      if (success && tempId) {
        console.log('[Journal] Processing started with tempId:', tempId);
        setProcessingEntries(prev => [...prev, tempId]);
        setToastIds(prev => ({ ...prev, [tempId]: String(toastId) }));
        setLastAction(`Processing Started (${tempId})`);
        setShouldPollForUpdates(true);
        
        // Immediately fetch entries to ensure UI is updated
        await fetchEntries();
        setRefreshKey(prev => prev + 1);
        
        // Set up a series of fetches at increasing intervals
        const pollIntervals = [1000, 2000, 3000, 5000, 8000, 10000, 15000];
        
        for (const interval of pollIntervals) {
          setTimeout(() => {
            console.log(`[Journal] Polling for entry data at ${interval}ms interval`);
            fetchEntries();
            setRefreshKey(prev => prev + 1);
          }, interval);
        }
        
        // Safety timeout to prevent UI from being stuck in processing state
        setTimeout(() => {
          console.log('[Journal] Maximum processing time check for tempId:', tempId);
          setProcessingEntries(prev => {
            if (prev.includes(tempId)) {
              console.log('[Journal] Maximum processing time reached for tempId:', tempId);
              setLastAction(`Max Processing Time Reached (${tempId})`);
              
              if (toastIds[tempId]) {
                toast.dismiss(toastIds[tempId]);
                
                toast.success('Journal entry processed', { 
                  duration: 3000,
                  closeButton: false
                });
                
                setToastIds(prev => {
                  const newToastIds = { ...prev };
                  delete newToastIds[tempId];
                  return newToastIds;
                });
              }
              
              fetchEntries();
              setRefreshKey(prev => prev + 1);
              setIsSavingRecording(false);
              setSafeToSwitchTab(true);
              setShouldPollForUpdates(false);
              
              return prev.filter(id => id !== tempId);
            }
            return prev;
          });
        }, 60000); // Increased timeout to 60 seconds for longer processing
      } else {
        console.error('[Journal] Processing failed:', error);
        setProcessingError(error || 'Unknown error occurred');
        setLastAction(`Processing Failed: ${error || 'Unknown'}`);
        
        toast.dismiss(toastId);
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        toast.error(`Failed to process recording: ${error || 'Unknown error'}`, { 
          duration: 3000,
          closeButton: false
        });
        
        setIsRecordingComplete(false);
        setIsSavingRecording(false);
        setSafeToSwitchTab(true);
        setShouldPollForUpdates(false);
        
        setTimeout(() => {
          setActiveTab('record');
        }, 100);
      }
    } catch (error: any) {
      console.error('Error processing recording:', error);
      setProcessingError(error?.message || 'Unknown error occurred');
      setLastAction(`Exception: ${error?.message || 'Unknown'}`);
      
      clearAllToasts();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      toast.error('Error processing your recording', { 
        duration: 3000,
        closeButton: false
      });
      
      setIsRecordingComplete(false);
      setIsSavingRecording(false);
      setSafeToSwitchTab(true);
      setShouldPollForUpdates(false);
      
      setTimeout(() => {
        setActiveTab('record');
      }, 100);
    }
  };

  const handleDeleteEntry = useCallback(async (entryId: number) => {
    try {
      console.log(`[Journal] Deleting entry ${entryId}`);
      setProcessingEntries(prev => 
        prev.filter(id => !id.includes(`entry${entryId}`))
      );
      
      // Wait a bit for animation and then refresh the entries
      setTimeout(() => {
        fetchEntries();
        setRefreshKey(prev => prev + 1);
      }, 500);
      
      return;
    } catch (error) {
      console.error(`[Journal] Error deleting entry ${entryId}:`, error);
      toast.error('Error deleting entry');
    }
  }, [fetchEntries]);

  const handleRefreshEntries = () => {
    toast.info('Refreshing entries...', { duration: 2000 });
    setRefreshKey(prev => prev + 1);
    fetchEntries();
  };

  return (
    <ErrorBoundary>
      <div className="relative container p-4 mx-auto" ref={entriesListRef}>
        <JournalHeader />

        {/* Profile loading or error states */}
        {user?.id && isCheckingProfile && (
          <div className="flex items-center justify-center my-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Setting up your journal...</span>
            </div>
          </div>
        )}

        {user?.id && showRetryButton && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800">Unable to create your profile</h3>
                <p className="text-sm text-red-700 mt-1 mb-3">
                  We encountered an issue while setting up your journal. Please try again.
                </p>
                <Button 
                  onClick={handleRetryProfileCreation} 
                  variant="secondary" 
                  size="sm"
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {user?.id && profileExists === false && !isCheckingProfile && (
          <div className="flex justify-center my-8">
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="h-6 w-6 text-amber-500" />
              <p className="text-muted-foreground">Setting up your profile...</p>
            </div>
          </div>
        )}

        {/* Main content when profile is ready */}
        {(!user?.id || (user?.id && profileExists !== false) || (user?.id && isProfileChecked)) && (
          <div>
            <Tabs
              value={activeTab} 
              onValueChange={handleTabChange}
              className="w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="entries" disabled={tabChangeInProgress}>
                    Journal Entries
                  </TabsTrigger>
                  <TabsTrigger value="record" disabled={tabChangeInProgress}>
                    Record Voice
                  </TabsTrigger>
                </TabsList>
                
                {activeTab === 'entries' && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleRefreshEntries} 
                    disabled={loading}
                    className="h-8 w-8"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>

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

              <TabsContent value="record" className="mt-0">
                <VoiceRecorder 
                  onRecordingComplete={handleRecordingComplete}
                  updateDebugInfo={({status, duration}) => {
                    setAudioStatus(status);
                    if (duration) setRecordingDuration(duration);
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Journal;
