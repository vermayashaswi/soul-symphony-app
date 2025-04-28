
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useProfileManagement } from '@/hooks/use-profile-management';
import { processRecording, getEntryIdForProcessingId, removeProcessingEntryById } from '@/utils/audio-processing';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { toast } from 'sonner';
import { clearAllToasts } from '@/services/notificationService';
import ErrorBoundary from '@/components/journal/ErrorBoundary';
import { supabase } from '@/integrations/supabase/client';
import JournalHeader from '@/components/journal/JournalHeader';
import { ProfileManager } from '@/components/journal/profile/ProfileManager';
import { ErrorDisplay } from '@/components/journal/errors/ErrorDisplay';
import { JournalTabs } from '@/components/journal/tabs/JournalTabs';

const logInfo = (message: string, source: string) => {
  console.log(`[${source}] ${message}`);
};

const Journal = () => {
  const { user, ensureProfileExists } = useAuth();
  const { translate } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState('record');
  const [toastIds, setToastIds] = useState<{ [key: string]: string }>({});
  const [notifiedEntryIds, setNotifiedEntryIds] = useState<Set<number>>(new Set());
  const [entryHasBeenProcessed, setEntryHasBeenProcessed] = useState(false);
  const [isRecordingComplete, setIsRecordingComplete] = useState(false);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [hasRenderError, setHasRenderError] = useState(false);
  const [safeToSwitchTab, setSafeToSwitchTab] = useState(true);
  const [tabChangeInProgress, setTabChangeInProgress] = useState(false);
  const [lastAction, setLastAction] = useState<string>('Page Loaded');
  const [audioStatus, setAudioStatus] = useState<string>('No Recording');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [entriesReady, setEntriesReady] = useState(false);
  
  // Create refs outside of the hook
  const previousEntriesRef = useRef<number[]>([]);
  const entriesListRef = useRef<HTMLDivElement>(null);
  const autoRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processingToEntryMapRef = useRef<Map<string, number>>(new Map());
  const profileCheckedOnceRef = useRef(false);
  
  const [deletedProcessingIds, setDeletedProcessingIds] = useState<Set<string>>(new Set());
  const [profileCheckTimeoutId, setProfileCheckTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [lastProfileErrorTime, setLastProfileErrorTime] = useState(0);
  
  const { 
    isProfileChecked,
    isCheckingProfile,
    showRetryButton,
    checkUserProfile,
    handleRetryProfileCreation
  } = useProfileManagement({
    userId: user?.id,
    ensureProfileExists
  });

  const { 
    entries, 
    loading, 
    fetchEntries, 
    error: entriesError,
  } = useJournalEntries(
    user?.id,
    refreshKey,
    isProfileChecked
  );

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[Journal] Caught render error:', event);
      setHasRenderError(true);
    };
    
    window.addEventListener('error', handleError);
    
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      if (event.detail && Array.isArray(event.detail.entries)) {
        console.log(`[Journal] Processing entries changed: ${event.detail.entries.length} entries`);
        // Filter out entries that were deleted
        const filteredEntries = event.detail.entries.filter(id => !deletedProcessingIds.has(id));
        setProcessingEntries(filteredEntries);
      }
    };
    
    const handleProcessingEntryMapped = (event: CustomEvent) => {
      if (event.detail && event.detail.tempId && event.detail.entryId) {
        console.log(`[Journal] Processing entry mapped: ${event.detail.tempId} -> ${event.detail.entryId}`);
        
        // Check if this entry was already deleted
        if (deletedProcessingIds.has(event.detail.tempId)) {
          console.log(`[Journal] Skipping mapped entry as its tempId was deleted: ${event.detail.tempId}`);
          return;
        }
        
        processingToEntryMapRef.current.set(event.detail.tempId, event.detail.entryId);
        
        if (processingEntries.includes(event.detail.tempId)) {
          setProcessedEntryIds(prev => [...prev, event.detail.entryId]);
          
          console.log('[Journal] Fetching new data immediately after entry mapped');
          fetchEntries();
          
          setTimeout(() => {
            setProcessingEntries(prev => prev.filter(id => id !== event.detail.tempId));
            
            if (toastIds[event.detail.tempId]) {
              toast.dismiss(toastIds[event.detail.tempId]);
              
              setToastIds(prev => {
                const newToastIds = { ...prev };
                delete newToastIds[event.detail.tempId];
                return newToastIds;
              });
            }
          }, 3000);
          
          toast.success('Journal entry analyzed and saved', {
            duration: 3000,
            id: 'journal-success-toast',
            closeButton: false
          });
          
          const fetchIntervals = [500, 1500, 3000];
          fetchIntervals.forEach(interval => {
            setTimeout(() => {
              if (componentMounted.current) {
                console.log(`[Journal] Scheduled fetch at ${interval}ms after mapping`);
                fetchEntries();
                setRefreshKey(prev => prev + 1);
              }
            }, interval);
          });
        }
      }
    };
    
    const componentMounted = { current: true };
    
    window.addEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
    window.addEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
    
    return () => {
      componentMounted.current = false;
      window.removeEventListener('error', handleError);
      window.removeEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
      window.removeEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
      
      clearAllToasts();
    };
  }, [processingEntries, toastIds, fetchEntries, deletedProcessingIds]);

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
      
      if (newEntryIds.length > 0) {
        console.log('[Journal] New entries detected:', newEntryIds);
        logInfo(`New entries detected: ${newEntryIds.join(', ')}`, 'Journal');
        
        const connectedProcessingEntries: string[] = [];
        processingEntries.forEach(tempId => {
          const mappedEntryId = getEntryIdForProcessingId(tempId);
          if (mappedEntryId && newEntryIds.includes(mappedEntryId)) {
            connectedProcessingEntries.push(tempId);
          }
        });
        
        if (connectedProcessingEntries.length > 0 || processingEntries.length > 0) {
          console.log('[Journal] Found connection between new entries and processing entries:', connectedProcessingEntries);
          setEntryHasBeenProcessed(true);
          
          setProcessedEntryIds(prev => [...prev, ...newEntryIds]);
          
          if (!newEntryIds.some(id => notifiedEntryIds.has(id))) {
            toast.success('Journal entry analyzed and saved', {
              duration: 3000,
              id: 'journal-success-toast',
              closeButton: false
            });
            
            setNotifiedEntryIds(prev => {
              const newSet = new Set(prev);
              newEntryIds.forEach(id => newSet.add(id));
              return newSet;
            });
          }
          
          if (connectedProcessingEntries.length > 0) {
            setProcessingEntries(prev => prev.filter(id => !connectedProcessingEntries.includes(id)));
            
            connectedProcessingEntries.forEach(tempId => {
              if (toastIds[tempId]) {
                toast.dismiss(toastIds[tempId]);
              }
            });
            
            setToastIds(prev => {
              const newToastIds = { ...prev };
              connectedProcessingEntries.forEach(tempId => {
                delete newToastIds[tempId];
              });
              return newToastIds;
            });
          }
          
          const fetchIntervals = [1000, 2000];
          fetchIntervals.forEach(interval => {
            setTimeout(() => {
              console.log(`[Journal] Additional fetch at ${interval}ms after new entries detected`);
              fetchEntries();
              setRefreshKey(prev => prev + 1);
            }, interval);
          });
          
          setIsSavingRecording(false);
          setSafeToSwitchTab(true);
          
          if (activeTab === 'record') {
            setActiveTab('entries');
          }
        }
        
        setEntriesReady(true);
      }
      
      previousEntriesRef.current = currentEntryIds;
      
      if (!entriesReady && entries.length > 0) {
        setEntriesReady(true);
      }
    }
  }, [entries, processingEntries, toastIds, entriesReady, activeTab, fetchEntries, notifiedEntryIds]);

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

  useEffect(() => {
    if (activeTab === 'entries') {
      const currentlyProcessing = processingEntries.filter(tempId => {
        return !getEntryIdForProcessingId(tempId);
      });
      
      if (currentlyProcessing.length !== processingEntries.length) {
        setProcessingEntries(currentlyProcessing);
      }
    }
  }, [activeTab, processingEntries]);

  const handleStartRecording = () => {
    console.log('Starting new recording');
    setActiveTab('record');
    setLastAction('Start Recording Tab');
    setProcessingError(null);
  };

  const handleTabChange = async (value: string) => {
    console.log(`[Journal] Tab change requested to: ${value}. Current safeToSwitchTab: ${safeToSwitchTab}`);
    
    if (value === 'entries' && !safeToSwitchTab) {
      console.log('[Journal] User attempting to switch to entries while processing');
      
      const translatedMessage = await translate('Processing in progress...');
      toast.info(translatedMessage, { 
        duration: 2000,
        closeButton: false
      });
    }
    
    setTabChangeInProgress(true);
    
    setTimeout(() => {
      if (value === 'entries' && !safeToSwitchTab) {
        console.log('[Journal] User attempting to switch to entries while processing');
        
        // Using a non-async approach here since we're in a setTimeout callback
        translate('Processing in progress...').then(translatedMessage => {
          toast.info(translatedMessage, { 
            duration: 2000,
            closeButton: false
          });
        });
      }
      
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
      
      setTimeout(() => {
        setActiveTab('entries');
      }, 50);

      const translatedProcessingMessage = await translate('Processing your journal entry with AI...');
      
      const toastId = toast.loading(translatedProcessingMessage, {
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
        
        fetchEntries();
        setRefreshKey(prev => prev + 1);
        
        window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
          detail: { 
            entries: [...processingEntries, tempId], 
            lastUpdate: Date.now(),
            forceUpdate: true 
          }
        }));
        
        const pollIntervals = [1000, 2000, 3000, 5000, 8000, 10000, 15000];
        
        pollIntervals.forEach(interval => {
          setTimeout(() => {
            console.log(`[Journal] Polling for entry data at ${interval}ms interval`);
            fetchEntries();
            setRefreshKey(prev => prev + 1);
          }, interval);
        });
        
        setTimeout(() => {
          console.log('[Journal] Maximum processing time check for tempId:', tempId);
          setProcessingEntries(prev => {
            if (prev.includes(tempId)) {
              console.log('[Journal] Maximum processing time reached for tempId:', tempId);
              setLastAction(`Max Processing Time Reached (${tempId})`);
              
              if (toastIds[tempId]) {
                toast.dismiss(toastIds[tempId]);
                
                // Using a Promise to handle the async operation inside setTimeout
                (async () => {
                  const translatedSuccessMessage = await translate('Journal entry processed');
                  toast.success(translatedSuccessMessage, { 
                    duration: 3000,
                    closeButton: false
                  });
                })();
                
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
        
        const translatedErrorMessage = await translate(`Failed to process recording: ${error || 'Unknown error'}`);
        toast.error(translatedErrorMessage, { 
          duration: 3000,
          closeButton: false
        });
      }
    } catch (error: any) {
      console.error('Error processing recording:', error);
      setProcessingError(error?.message || 'Unknown error occurred');
      setLastAction(`Exception: ${error?.message || 'Unknown'}`);
      
      clearAllToasts();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const translatedErrorMessage = await translate('Error processing your recording');
      toast.error(translatedErrorMessage, { 
        duration: 3000,
        closeButton: false
      });
      
      setIsRecordingComplete(false);
      setIsSavingRecording(false);
      setSafeToSwitchTab(true);
      
      setTimeout(() => {
        setActiveTab('record');
      }, 100);
    }
  };

  const handleDeleteEntry = useCallback(async (entryId: number) => {
    if (!user?.id) return;
    
    try {
      console.log(`[Journal] Deleting entry ${entryId}`);
      setLastAction(`Deleting Entry ${entryId}`);
      
      clearAllToasts();
      
      // Find and mark any processing entries related to this one as deleted
      const tempIdsToDelete: string[] = [];
      
      processingEntries.forEach(tempId => {
        const mappedId = getEntryIdForProcessingId(tempId);
        if (mappedId === entryId) {
          tempIdsToDelete.push(tempId);
          
          if (toastIds[tempId]) {
            toast.dismiss(toastIds[tempId]);
          }
        }
      });
      
      // Also check the map for any other tempIds that might map to this entryId
      processingToEntryMapRef.current.forEach((mappedId, tempId) => {
        if (mappedId === entryId && !tempIdsToDelete.includes(tempId)) {
          tempIdsToDelete.push(tempId);
        }
      });
      
      // Mark these as deleted to prevent them from reappearing
      if (tempIdsToDelete.length > 0) {
        console.log(`[Journal] Marking processing entries as deleted:`, tempIdsToDelete);
        setDeletedProcessingIds(prev => {
          const newSet = new Set(prev);
          tempIdsToDelete.forEach(id => newSet.add(id));
          return newSet;
        });
      }
      
      // Clean up processing entries
      removeProcessingEntryById(entryId);
      
      // Update UI states
      const updatedProcessingEntries = processingEntries.filter(
        tempId => !tempIdsToDelete.includes(tempId) && getEntryIdForProcessingId(tempId) !== entryId
      );
      setProcessingEntries(updatedProcessingEntries);
      
      const updatedToastIds = { ...toastIds };
      Object.keys(updatedToastIds).forEach(key => {
        if (key.includes(String(entryId)) || tempIdsToDelete.includes(key)) {
          delete updatedToastIds[key];
        }
      });
      setToastIds(updatedToastIds);
      
      setNotifiedEntryIds(prev => {
        const updated = new Set(prev);
        updated.delete(entryId);
        return updated;
      });
      
      // Delete from the database
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entryId);
        
      if (error) {
        throw error;
      }
      
      // Refresh entries
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

  useEffect(() => {
    const handleJournalEntryUpdated = (event: CustomEvent) => {
      if (event.detail && event.detail.entryId) {
        console.log(`[Journal] Entry updated event detected for ID: ${event.detail.entryId}, refreshing data`);
        setRefreshKey(prev => prev + 1);
        fetchEntries();
      }
    };
    
    window.addEventListener('journalEntryUpdated', handleJournalEntryUpdated as EventListener);
    
    return () => {
      window.removeEventListener('journalEntryUpdated', handleJournalEntryUpdated as EventListener);
    };
  }, [fetchEntries]);

  return (
    <ErrorBoundary onReset={resetError}>
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
        <JournalHeader />
        
        <ProfileManager 
          isCheckingProfile={isCheckingProfile}
          showRetryButton={showRetryButton}
          onRetryProfileCreation={handleRetryProfileCreation}
        />
        
        <ErrorDisplay 
          entriesError={entriesError}
          processingError={processingError}
          onRetryLoading={() => {
            setRefreshKey(prev => prev + 1);
            fetchEntries();
          }}
          onTryAgainProcessing={() => {
            setProcessingError(null);
            setActiveTab('record');
          }}
        />
        
        {!isCheckingProfile && !entriesError && (
          <JournalTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onRecordingComplete={handleRecordingComplete}
            updateDebugInfo={updateDebugInfo}
            entries={entries}
            loading={loading}
            processingEntries={processingEntries}
            processedEntryIds={processedEntryIds}
            onStartRecording={handleStartRecording}
            onDeleteEntry={handleDeleteEntry}
            entriesListRef={entriesListRef}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Journal;
