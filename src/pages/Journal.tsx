import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { processRecording, getEntryIdForProcessingId, removeProcessingEntryById } from '@/utils/audio-processing';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import VoiceRecorder from '@/components/VoiceRecorder';
import JournalHeader from '@/components/journal/JournalHeader';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';
import ErrorBoundary from '@/components/journal/ErrorBoundary';
import { supabase } from '@/integrations/supabase/client';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { JournalEntry } from '@/types/journal';
import JournalSearch from '@/components/journal/JournalSearch';

const logInfo = (message: string, source: string) => {
  console.log(`[${source}] ${message}`);
};

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
  const processingToEntryMapRef = useRef<Map<string, number>>(new Map());
  const [deletedProcessingIds, setDeletedProcessingIds] = useState<Set<string>>(new Set());
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [localEntries, setLocalEntries] = useState<JournalEntry[]>([]);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [pendingDeletionIds, setPendingDeletionIds] = useState<Set<number>>(new Set());
  const lastSuccessfulEntriesRef = useRef<JournalEntry[]>([]);
  const forceUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  // New state for first-time users
  const [isProcessingFirstEntry, setIsProcessingFirstEntry] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [toastLockActive, setToastLockActive] = useState(false);
  const firstTimeProcessingRef = useRef(false);

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

  // Detect if this is a first-time user (no entries)
  useEffect(() => {
    if (!loading && entries.length === 0 && !isFirstTimeUser && user?.id) {
      console.log('[Journal] First-time user detected (no entries)');
      setIsFirstTimeUser(true);
    } else if (entries.length > 0 && isFirstTimeUser) {
      console.log('[Journal] User now has entries, no longer a first-time user');
      setIsFirstTimeUser(false);
      setIsProcessingFirstEntry(false);
    }
  }, [loading, entries.length, isFirstTimeUser, user?.id]);

  // Special coordination for first-time users processing their first entry
  useEffect(() => {
    if (isFirstTimeUser && processingEntries.length > 0 && !isProcessingFirstEntry) {
      console.log('[Journal] First-time user is processing first entry');
      setIsProcessingFirstEntry(true);
      firstTimeProcessingRef.current = true;
      
      // Lock toast operations during first entry processing
      setToastLockActive(true);
      
      // Ensure we check frequently for the first entry
      const checkInterval = setInterval(() => {
        if (firstTimeProcessingRef.current) {
          console.log('[Journal] Checking for first entry completion');
          fetchEntries();
          setRefreshKey(prev => prev + 1);
        } else {
          clearInterval(checkInterval);
        }
      }, 2000);
      
      return () => {
        clearInterval(checkInterval);
      };
    }
  }, [isFirstTimeUser, processingEntries.length, isProcessingFirstEntry, fetchEntries]);

  // Clear toast lock after processing completes
  useEffect(() => {
    if (!isProcessingFirstEntry && toastLockActive) {
      // Add some delay before clearing the lock
      const lockTimer = setTimeout(() => {
        console.log('[Journal] Clearing toast lock after processing');
        setToastLockActive(false);
      }, 500);
      
      return () => clearTimeout(lockTimer);
    }
  }, [isProcessingFirstEntry, toastLockActive]);

  useEffect(() => {
    if (entries && entries.length > 0 && !hasLocalChanges) {
      setLocalEntries(entries);
      lastSuccessfulEntriesRef.current = entries;
    } else if (entries && entries.length > 0) {
      const deletedIds = new Set([...pendingDeletionIds]);
      
      const mergedEntries = entries.filter(entry => !deletedIds.has(entry.id));
      
      if (mergedEntries.length > 0) {
        setLocalEntries(mergedEntries);
        lastSuccessfulEntriesRef.current = mergedEntries;
      }
    }
  }, [entries, hasLocalChanges, pendingDeletionIds]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[Journal] Caught render error:', event);
      setHasRenderError(true);
    };
    
    window.addEventListener('error', handleError);
    
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      if (event.detail && Array.isArray(event.detail.entries)) {
        console.log(`[Journal] Processing entries changed: ${event.detail.entries.length} entries`);
        const filteredEntries = event.detail.entries.filter(id => !deletedProcessingIds.has(id));
        setProcessingEntries(filteredEntries);
      }
    };
    
    const handleProcessingEntryMapped = (event: CustomEvent) => {
      if (event.detail && event.detail.tempId && event.detail.entryId) {
        console.log(`[Journal] Processing entry mapped: ${event.detail.tempId} -> ${event.detail.entryId}`);
        
        if (deletedProcessingIds.has(event.detail.tempId)) {
          console.log(`[Journal] Skipping mapped entry as its tempId was deleted: ${event.detail.tempId}`);
          return;
        }
        
        processingToEntryMapRef.current.set(event.detail.tempId, event.detail.entryId);
        
        if (processingEntries.includes(event.detail.tempId)) {
          setProcessedEntryIds(prev => [...prev, event.detail.entryId]);
          
          console.log('[Journal] Fetching new data immediately after entry mapped');
          fetchEntries();
          
          // Remove the temporary entry if it exists
          setLocalEntries(prev => prev.filter(entry => !(entry.tempId === event.detail.tempId)));
          
          setTimeout(() => {
            setProcessingEntries(prev => prev.filter(id => id !== event.detail.tempId));
            
            if (toastIds[event.detail.tempId]) {
              try {
                toast.dismiss(toastIds[event.detail.tempId]);
              } catch (e) {
                console.warn('[Journal] Error dismissing toast:', e);
              }
              
              setToastIds(prev => {
                const newToastIds = { ...prev };
                delete newToastIds[event.detail.tempId];
                return newToastIds;
              });
            }
            
            // If this was the first entry for a first-time user
            if (firstTimeProcessingRef.current) {
              console.log('[Journal] First entry processing completed');
              firstTimeProcessingRef.current = false;
              setIsProcessingFirstEntry(false);
              
              // Show success notification after a short delay
              setTimeout(() => {
                try {
                  toast.success('Your first journal entry has been created!', {
                    duration: 4000,
                    id: 'first-entry-success-toast',
                    closeButton: false
                  });
                } catch (e) {
                  console.warn('[Journal] Error showing first entry success toast:', e);
                }
              }, 500);
            }
          }, 1000);
          
          // Show success toast unless this is a first-time user (they get a special message)
          if (!firstTimeProcessingRef.current) {
            try {
              toast.success('Journal entry analyzed and saved', {
                duration: 3000,
                id: 'journal-success-toast',
                closeButton: false
              });
            } catch (e) {
              console.warn('[Journal] Error showing success toast:', e);
            }
          }
          
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
      if (forceUpdateTimerRef.current) {
        clearTimeout(forceUpdateTimerRef.current);
      }
      
      if (!toastLockActive) {
        clearAllToasts();
      }
    };
  }, [processingEntries, toastIds, fetchEntries, deletedProcessingIds, toastLockActive]);

  useEffect(() => {
    if (!toastLockActive) {
      clearAllToasts();
    } else {
      console.log('[Journal] Toast clear operation skipped due to active lock');
    }
    
    return () => {
      if (!toastLockActive) {
        clearAllToasts();
      
        Object.values(toastIds).forEach(id => {
          try {
            if (id) toast.dismiss(id);
          } catch (e) {
            console.warn('[Journal] Error dismissing toast during cleanup:', e);
          }
        });
      }
      
      if (profileCheckTimeoutId) {
        clearTimeout(profileCheckTimeoutId);
      }
      
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
    };
  }, [toastLockActive]);

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
          
          if (!newEntryIds.some(id => notifiedEntryIds.has(id)) && !isProcessingFirstEntry) {
            try {
              toast.success('Journal entry analyzed and saved', {
                duration: 3000,
                id: 'journal-success-toast',
                closeButton: false
              });
            } catch (e) {
              console.warn('[Journal] Error showing new entries success toast:', e);
            }
            
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
                try {
                  toast.dismiss(toastIds[tempId]);
                } catch (e) {
                  console.warn('[Journal] Error dismissing toast for connected entry:', e);
                }
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
          
          // Switch to entries tab only if not a first-time user
          if (activeTab === 'record' && !firstTimeProcessingRef.current) {
            setActiveTab('entries');
          }
        }
        
        setEntriesReady(true);
        
        // If we were processing first entry, update state
        if (isProcessingFirstEntry && entries.length > 0) {
          setIsProcessingFirstEntry(false);
          firstTimeProcessingRef.current = false;
        }
      }
      
      previousEntriesRef.current = currentEntryIds;
      
      if (!entriesReady && entries.length > 0) {
        setEntriesReady(true);
      }
    }
  }, [entries, processingEntries, toastIds, entriesReady, activeTab, fetchEntries, notifiedEntryIds, isProcessingFirstEntry]);

  useEffect(() => {
    return () => {
      Object.values(toastIds).forEach(id => {
        try {
          if (id) toast.dismiss(id);
        } catch (e) {
          console.warn('[Journal] Error dismissing toast in cleanup:', e);
        }
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

  const checkUserProfile = async (userId: string) => {
    try {
      setIsCheckingProfile(true);
      setShowRetryButton(false);
      setLastAction('Checking Profile');
      
      console.log('[Journal] Checking user profile for ID:', userId);
      
      const profileCreated = await ensureProfileExists();
      profileCheckedOnceRef.current = true;
      
      console.log('[Journal] Profile check result:', profileCreated);
      
      if (!profileCreated) {
        if (profileCreationAttempts < maxProfileAttempts) {
          setProfileCreationAttempts(prev => prev + 1);
          
          const retryDelay = 1000 * Math.pow(1.5, profileCreationAttempts);
          
          if (autoRetryTimeoutRef.current) {
            clearTimeout(autoRetryTimeoutRef.current);
          }
          
          autoRetryTimeoutRef.current = setTimeout(() => {
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
      
      const now = Date.now();
      if (now - lastProfileErrorTime > 60000) {
        setLastProfileErrorTime(now);
      }
      
      if (profileCreationAttempts < maxProfileAttempts) {
        setProfileCreationAttempts(prev => prev + 1);
        
        const retryDelay = 1000 * Math.pow(1.5, profileCreationAttempts);
        
        if (autoRetryTimeoutRef.current) {
          clearTimeout(autoRetryTimeoutRef.current);
        }
        
        autoRetryTimeoutRef.current = setTimeout(() => {
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
    console.log('[Journal] Starting new recording, first-time user:', isFirstTimeUser);
    setActiveTab('record');
    setLastAction('Start Recording Tab');
    setProcessingError(null);
  };

  const handleTabChange = (value: string) => {
    console.log(`[Journal] Tab change requested to: ${value}. Current safeToSwitchTab: ${safeToSwitchTab}`);
    
    if (value === 'entries' && !safeToSwitchTab) {
      console.log('[Journal] User attempting to switch to entries while processing');
      
      try {
        toast.info('Processing in progress...', { 
          duration: 2000,
          closeButton: false
        });
      } catch (e) {
        console.warn('[Journal] Error showing tab change toast:', e);
      }
    }
    
    setTabChangeInProgress(true);
    
    setTimeout(() => {
      if (value === 'entries' && !safeToSwitchTab) {
        console.log('[Journal] User attempting to switch to entries while processing');
        
        try {
          toast.info('Processing in progress...', { 
            duration: 2000,
            closeButton: false
          });
        } catch (e) {
          console.warn('[Journal] Error showing tab change toast (delayed):', e);
        }
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
      // Lock toast operations while processing recording
      setToastLockActive(true);
      
      await new Promise<void>((resolve) => {
        try {
          clearAllToasts();
          setTimeout(() => {
            try {
              clearAllToasts();
            } catch(e) {
              console.warn('[Journal] Error clearing toasts during recording complete:', e);
            }
            setTimeout(() => resolve(), 150);
          }, 50);
        } catch(e) {
          console.warn('[Journal] Error in toast clearing sequence:', e);
          resolve();
        }
      });
      
      setIsRecordingComplete(true);
      setIsSavingRecording(true);
      setProcessingError(null);
      setLastAction('Recording Complete - Processing');
      setAudioStatus(`Processing (${formatBytes(audioBlob.size)})`);
      setSafeToSwitchTab(false);
      setEntriesReady(false);
      
      // For first-time users, we don't switch tabs immediately
      if (!isFirstTimeUser) {
        setTimeout(() => {
          setActiveTab('entries');
        }, 50);
      } else {
        console.log('[Journal] First-time user recording complete, not switching tabs');
      }
      
      // Create a loading toast with error handling
      let toastId;
      
      try {
        toastId = toast.loading('Processing your journal entry with AI...', {
          duration: 15000,
          closeButton: false
        });
      } catch (e) {
        console.warn('[Journal] Error showing loading toast:', e);
      }
      
      console.log('[Journal] Starting processing for audio file:', audioBlob.size, 'bytes', 'First time user:', isFirstTimeUser);
      const { success, tempId, error } = await processRecording(audioBlob, user.id);
      
      if (success && tempId) {
        console.log('[Journal] Processing started with tempId:', tempId);
        setProcessingEntries(prev => [...prev, tempId]);
        
        if (toastId) {
          setToastIds(prev => ({ ...prev, [tempId]: String(toastId) }));
        }
        
        setLastAction(`Processing Started (${tempId})`);
        
        // Create a temporary processing entry to be displayed while the real one is being processed
        const tempEntry: JournalEntry = {
          id: Date.now(), // Temporary ID that won't conflict with real entries
          created_at: new Date().toISOString(),
          content: "Processing entry...",
          tempId: tempId // To track which processing entry this corresponds to
        };
        
        // Add the temporary entry to localEntries
        setLocalEntries(prev => [tempEntry, ...prev]);
        setHasLocalChanges(true);
        
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
                try {
                  toast.dismiss(toastIds[tempId]);
                  
                  toast.success('Journal entry processed', { 
                    duration: 3000,
                    closeButton: false
                  });
                } catch (e) {
                  console.warn('[Journal] Error showing timeout success toast:', e);
                }
                
                setToastIds(prev => {
                  const newToastIds = { ...prev };
                  delete newToastIds[tempId];
                  return newToastIds;
                });
              }
              
              // Remove the temporary entry from localEntries if it's still there
              setLocalEntries(prev => prev.filter(entry => !(entry.tempId === tempId)));
              
              fetchEntries();
              setRefreshKey(prev => prev + 1);
              setIsSavingRecording(false);
              setSafeToSwitchTab(true);
              
              // Clear first-time processing state if applicable
              if (firstTimeProcessingRef.current) {
                setIsProcessingFirstEntry(false);
                firstTimeProcessingRef.current = false;
              }
              
              // Release toast lock
              setToastLockActive(false);
              
              return prev.filter(id => id !== tempId);
            }
            return prev;
          });
        }, 20000);
      } else {
        console.error('[Journal] Processing failed:', error);
        setProcessingError(error || 'Unknown error occurred');
        setLastAction(`Processing Failed: ${error || 'Unknown'}`);
        
        try {
          if (toastId) {
            toast.dismiss(toastId);
          }
        } catch (e) {
          console.warn('[Journal] Error dismissing toast after fail:', e);
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        try {
          toast.error(`Failed to process recording: ${error || 'Unknown error'}`, { 
            duration: 3000,
            closeButton: false
          });
        } catch (e) {
          console.warn('[Journal] Error showing error toast:', e);
        }
        
        setIsRecordingComplete(false);
        setIsSavingRecording(false);
        setSafeToSwitchTab(true);
        
        // Clear first-time processing state if applicable
        if (firstTimeProcessingRef.current) {
          setIsProcessingFirstEntry(false);
          firstTimeProcessingRef.current = false;
        }
        
        // Release toast lock
        setToastLockActive(false);
        
        setTimeout(() => {
          setActiveTab('record');
        }, 100);
      }
    } catch (error: any) {
      console.error('[Journal] Error processing recording:', error);
      setProcessingError(error?.message || 'Unknown error occurred');
      setLastAction(`Exception: ${error?.message || 'Unknown'}`);
      
      try {
        clearAllToasts();
      } catch (e) {
        console.warn('[Journal] Error clearing toasts after exception:', e);
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      try {
        toast.error('Error processing your recording', { 
          duration: 3000,
          closeButton: false
        });
      } catch (e) {
        console.warn('[Journal] Error showing exception toast:', e);
      }
      
      setIsRecordingComplete(false);
      setIsSavingRecording(false);
      setSafeToSwitchTab(true);
      
      // Clear first-time processing state if applicable
      if (firstTimeProcessingRef.current) {
        setIsProcessingFirstEntry(false);
        firstTimeProcessingRef.current = false;
      }
      
      // Release toast lock
      setToastLockActive(false);
      
      setTimeout(() => {
        setActiveTab('record');
      }, 100);
    }
  };

  const handleDeleteEntry = useCallback(async (entryId: number) => {
    if (!user?.id || isDeletingEntry) return;
    
    try {
      console.log(`[Journal] Deleting entry ${entryId}`);
      setLastAction(`Deleting Entry ${entryId}`);
      setDeletingEntryId(entryId);
      setIsDeletingEntry(true);
      
      clearAllToasts();
      
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
      
      processingToEntryMapRef.current.forEach((mappedId, tempId) => {
        if (mappedId === entryId && !tempIdsToDelete.includes(tempId)) {
          tempIdsToDelete.push(tempId);
        }
      });
      
      if (tempIdsToDelete.length > 0) {
        console.log(`[Journal] Marking processing entries as deleted:`, tempIdsToDelete);
        setDeletedProcessingIds(prev => {
          const newSet = new Set(prev);
          tempIdsToDelete.forEach(id => newSet.add(id));
          return newSet;
        });
      }
      
      removeProcessingEntryById(entryId);
      
      const updatedProcessingEntries = processingEntries.filter(
        tempId => !tempIdsToDelete.includes(tempId) && getEntryIdForProcessingId(tempId) !== entryId
      );
      setProcessingEntries(updatedProcessingEntries);
      
      const updatedToastIds = { ...toastIds };
      tempIdsToDelete.forEach(id => {
        delete updatedToastIds[id];
      });
      setToastIds(updatedToastIds);
      
      // Update the pendingDeletionIds
      setPendingDeletionIds(prev => {
        const newSet = new Set(prev);
        newSet.add(entryId);
        return newSet;
      });
      
      // Optimistically update the UI by filtering out the deleted entry
      setLocalEntries(prev => prev.filter(entry => entry.id !== entryId));
      setHasLocalChanges(true);
      
      // Make the API call to actually delete the entry
      try {
        const { error } = await supabase
          .from('Journal Entries') // Fixed table name (it's "Journal Entries", not "journal_entries")
          .delete()
          .eq('id', entryId)
          .eq('user_id', user.id);
        
        if (error) {
          throw error;
        }
        
        console.log(`[Journal] Successfully deleted entry ${entryId}`);
        
        // Notify that entries need refreshing
        window.dispatchEvent(
          new CustomEvent('journalEntriesNeedRefresh', {
            detail: { 
              action: 'delete',
              entryId: entryId,
              timestamp: Date.now()
            }
          })
        );
        
        // Show success toast
        toast.success('Entry deleted successfully', {
          duration: 2000,
          closeButton: false
        });
        
        // Update the UI immediately
        fetchEntries();
        setRefreshKey(prev => prev + 1);
      } catch (error: any) {
        console.error(`[Journal] Error deleting entry ${entryId}:`, error);
        
        // Show error toast
        toast.error(`Failed to delete entry: ${error.message}`, {
          duration: 3000,
          closeButton: false
        });
        
        // Revert the optimistic update
        setHasLocalChanges(false);
        fetchEntries();
      }
    } catch (error: any) {
      console.error(`[Journal] Error in handleDeleteEntry:`, error);
      
      toast.error(`An error occurred: ${error.message}`, {
        duration: 3000,
        closeButton: false
      });
    } finally {
      setIsDeletingEntry(false);
      setDeletingEntryId(null);
    }
  }, [user?.id, isDeletingEntry, processingEntries, toastIds, fetchEntries, setRefreshKey]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSearchResults = (results: JournalEntry[]) => {
    setFilteredEntries(results);
  };

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 pb-24 md:pb-12 max-w-4xl">
        <JournalHeader onStartRecording={handleStartRecording} />
        
        {showRetryButton && (
          <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
              <p className="text-sm text-yellow-700">
                <TranslatableText text="We had trouble initializing your journal. Please try again." />
              </p>
            </div>
            <Button 
              onClick={handleRetryProfileCreation}
              variant="outline"
              size="sm"
              className="mt-2 bg-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <TranslatableText text="Retry" />
            </Button>
          </div>
        )}
        
        {hasRenderError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              <TranslatableText text="Something went wrong" />
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              <TranslatableText text="We're sorry, but there was an error loading your journal." />
            </p>
            <Button 
              onClick={() => window.location.reload()}
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <TranslatableText text="Reload Page" />
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="record" disabled={tabChangeInProgress}>
                <TranslatableText text="Record" />
              </TabsTrigger>
              <TabsTrigger value="entries" disabled={tabChangeInProgress}>
                <TranslatableText text="My Journal" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="focus:outline-none">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <VoiceRecorder 
                  onRecordingComplete={handleRecordingComplete}
                />
              </div>
            </TabsContent>

            <TabsContent value="entries" className="focus:outline-none">
              <div className="space-y-4" ref={entriesListRef}>
                {(!loading && entries && entries.length > 0) && (
                  <JournalSearch 
                    entries={entries} 
                    onSearchResults={handleSearchResults}
                  />  
                )}
                
                <JournalEntriesList 
                  entries={filteredEntries.length > 0 ? filteredEntries : localEntries}
                  loading={loading && !entriesReady}
                  loadMore={() => {}}
                  hasMoreEntries={false}
                  isLoadingMore={false}
                  onDeleteEntry={handleDeleteEntry}
                  processingEntries={processingEntries}
                  processedEntryIds={processedEntryIds}
                  onStartRecording={handleStartRecording}
                  isProcessingFirstEntry={isProcessingFirstEntry}
                />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Journal;
