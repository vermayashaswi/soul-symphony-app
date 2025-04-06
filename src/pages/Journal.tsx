import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import ErrorBoundary from '@/components/journal/ErrorBoundary';
import { debugLogger, logInfo, logError } from '@/components/debug/DebugPanel';

const Journal = () => {
  const { user, ensureProfileExists } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('record');
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
  const maxProfileAttempts = 3;
  const previousEntriesRef = useRef<number[]>([]);
  const profileCheckedOnceRef = useRef(false);
  const entriesListRef = useRef<HTMLDivElement>(null);
  const [lastAction, setLastAction] = useState<string>('Page Loaded');
  const [audioStatus, setAudioStatus] = useState<string>('No Recording');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [entriesReady, setEntriesReady] = useState(false);
  const autoRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    logInfo('Journal page mounted', 'Journal');
    
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
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
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
        
        setProcessingEntries([]);
        setToastIds({});
        setIsSavingRecording(false);
        setSafeToSwitchTab(true);
        
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
  }, [entries, processingEntries, toastIds, entriesReady, activeTab]);

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

  useEffect(() => {
    if (processingEntries.length > 0 || isSavingRecording) {
      const interval = setInterval(() => {
        console.log('[Journal] Polling for updates while processing entries');
        logInfo('Polling for updates while processing entries', 'Journal');
        setRefreshKey(prev => prev + 1);
        fetchEntries();
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [processingEntries.length, fetchEntries, isSavingRecording]);

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
      console.log('[Journal] Attempted to switch to entries but waiting for processing');
      return;
    }
    
    setActiveTab(value);
    
    if (value === 'entries') {
      fetchEntries();
    }
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
      setIsRecordingComplete(true);
      setIsSavingRecording(true);
      setProcessingError(null);
      setLastAction('Recording Complete - Processing');
      setAudioStatus(`Processing (${formatBytes(audioBlob.size)})`);
      setSafeToSwitchTab(false);
      setEntriesReady(false);
      
      setActiveTab('entries');
      
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
        
        await fetchEntries();
        setRefreshKey(prev => prev + 1);
        
        const pollIntervals = [1000, 2000, 3000, 5000, 8000, 12000];
        
        for (const interval of pollIntervals) {
          setTimeout(() => {
            console.log(`[Journal] Polling for entry at ${interval}ms interval`);
            fetchEntries();
            setRefreshKey(prev => prev + 1);
          }, interval);
        }
        
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
              
              return prev.filter(id => id !== tempId);
            }
            return prev;
          });
        }, 20000);
      } else {
        console.error('[Journal] Processing failed:', error);
        setProcessingError(error || 'Unknown error occurred');
        setLastAction(`Processing Failed: ${error || 'Unknown'}`);
        toast.dismiss(toastId);
        
        toast.error(`Failed to process recording: ${error || 'Unknown error'}`, { 
          duration: 3000,
          closeButton: false
        });
        
        setIsRecordingComplete(false);
        setIsSavingRecording(false);
        setSafeToSwitchTab(true);
        
        setActiveTab('record');
      }
    } catch (error: any) {
      console.error('Error processing recording:', error);
      setProcessingError(error?.message || 'Unknown error occurred');
      setLastAction(`Exception: ${error?.message || 'Unknown'}`);
      
      toast.error('Error processing your recording', { 
        duration: 3000,
        closeButton: false
      });
      
      setIsRecordingComplete(false);
      setIsSavingRecording(false);
      setSafeToSwitchTab(true);
      
      setActiveTab('record');
    }
  };

  const handleDeleteEntry = useCallback(async (entryId: number) => {
    if (!user?.id) return;
    
    try {
      console.log(`[Journal] Deleting entry ${entryId}`);
      setLastAction(`Deleting Entry ${entryId}`);
      
      clearAllToasts();
      
      processingEntries.forEach(tempId => {
        if (toastIds[tempId]) {
          toast.dismiss(toastIds[tempId]);
        }
      });
      
      const updatedProcessingEntries = processingEntries.filter(
        tempId => !tempId.includes(String(entryId))
      );
      setProcessingEntries(updatedProcessingEntries);
      
      const updatedToastIds = { ...toastIds };
      Object.keys(updatedToastIds).forEach(key => {
        if (key.includes(String(entryId))) {
          delete updatedToastIds[key];
        }
      });
      setToastIds(updatedToastIds);
      
      setNotifiedEntryIds(prev => {
        const updated = new Set(prev);
        updated.delete(entryId);
        return updated;
      });
      
      setTimeout(() => {
        setRefreshKey(Date.now());
        fetchEntries();
      }, 100);
      
      toast.success('Entry deleted successfully');
      
    } catch (error) {
      console.error('[Journal] Error deleting entry:', error);
      setLastAction(`Delete Entry Error (${entryId})`);
      toast.error('Failed to delete entry');
      
      setTimeout(() => {
        setRefreshKey(Date.now());
        fetchEntries();
      }, 500);
    }
  }, [user?.id, processingEntries, toastIds, fetchEntries, setRefreshKey, setProcessingEntries, setToastIds, setNotifiedEntryIds]);

  const resetError = useCallback(() => {
    setHasRenderError(false);
    setProcessingError(null);
    setActiveTab('entries');
    setRefreshKey(Date.now());
    setLastAction('Reset Error State');
    setSafeToSwitchTab(true);
    setTimeout(() => {
      fetchEntries();
    }, 100);
  }, [fetchEntries]);

  const showLoadingFeedback = (isRecordingComplete || isSavingRecording) && 
                             !entriesError && 
                             !processingError && 
                             processingEntries.length > 0;

  if (hasRenderError) {
    console.error('[Journal] Recovering from render error');
    setHasRenderError(false);
    setLastAction('Recovering from Render Error');
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const updateDebugInfo = (info: {status: string, duration?: number}) => {
    setAudioStatus(info.status);
    if (info.duration !== undefined) {
      setRecordingDuration(info.duration);
    }
    setLastAction(`Recorder: ${info.status}`);
  };

  return (
    <ErrorBoundary onReset={resetError}>
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
        <JournalHeader />
        
        {isCheckingProfile ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Setting up your profile...</p>
            </div>
          </div>
        ) : entriesError && !loading ? (
          <>
            <div className="mt-8 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-red-800 dark:text-red-200">
                    Error loading your journal entries: {entriesError}
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
          </>
        ) : (
          <>
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
            
            {processingError && (
              <div className="mb-6 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-red-800 dark:text-red-200">
                      Error processing your recording: {processingError}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto border-red-500 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
                    onClick={() => {
                      setProcessingError(null);
                      setActiveTab('record');
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> 
                    Try Again
                  </Button>
                </div>
              </div>
            )}
            
            <Tabs 
              defaultValue={activeTab} 
              value={activeTab} 
              onValueChange={handleTabChange} 
              className="mt-6"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="record">Record Entry</TabsTrigger>
                <TabsTrigger value="entries">Past Entries</TabsTrigger>
              </TabsList>
              
              <TabsContent value="record" className="mt-0">
                <div className="mb-4">
                  <VoiceRecorder 
                    onRecordingComplete={handleRecordingComplete}
                    updateDebugInfo={updateDebugInfo}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="entries" className="mt-0" ref={entriesListRef}>
                {!safeToSwitchTab && isSavingRecording ? (
                  <div className="mt-8 flex flex-col items-center justify-center p-12 border border-dashed border-gray-300 rounded-lg">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                    <p className="text-muted-foreground font-medium">Processing your recording...</p>
                    <p className="text-muted-foreground text-sm mt-2">Your journal entry will appear here in a moment</p>
                  </div>
                ) : showLoadingFeedback ? (
                  <div className="mt-8 flex flex-col items-center justify-center p-12 border border-dashed border-gray-300 rounded-lg">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                    <p className="text-muted-foreground font-medium">Processing your entry with AI...</p>
                    <p className="text-muted-foreground text-sm mt-2">Analyzing your journal entry for themes and sentiment</p>
                  </div>
                ) : (
                  <ErrorBoundary>
                    <JournalEntriesList
                      entries={entries}
                      loading={loading}
                      processingEntries={processingEntries}
                      processedEntryIds={processedEntryIds}
                      onStartRecording={handleStartRecording}
                      onDeleteEntry={handleDeleteEntry}
                    />
                  </ErrorBoundary>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Journal;
