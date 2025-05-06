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
import { EmptyState } from '@/components/insights/soulnet/EmptyState';
import PlaceholderEntryManager from '@/components/journal/PlaceholderEntryManager';

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
  // Add componentMountedRef to fix errors
  const componentMountedRef = useRef(true);

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

  // Update useEffect to set componentMountedRef to false when unmounting
  useEffect(() => {
    // Set to true when mounting
    componentMountedRef.current = true;
    
    return () => {
      // Set to false when unmounting
      componentMountedRef.current = false;
    };
  }, []);

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
        if (firstTimeProcessingRef.current && componentMountedRef.current) {
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
      }, 1000); // Increased from 500 to 1000 to ensure proper cleanup
      
      return () => clearTimeout(lockTimer);
    }
  }, [isProcessingFirstEntry, toastLockActive]);
  
  // Update entries management with improved error handling
  useEffect(() => {
    if (entries && entries.length > 0 && !hasLocalChanges) {
      setLocalEntries(entries);
      lastSuccessfulEntriesRef.current = entries;
      
      // If we were processing first entry, update state
      if (isProcessingFirstEntry && entries.length > 0) {
        console.log('[Journal] First entry processing appears to be complete');
        setTimeout(() => {
          setIsProcessingFirstEntry(false);
          firstTimeProcessingRef.current = false;
        }, 500);
      }
    } else if (entries && entries.length > 0) {
      const deletedIds = new Set([...pendingDeletionIds]);
      
      const mergedEntries = entries.filter(entry => !deletedIds.has(entry.id));
      
      if (mergedEntries.length > 0) {
        setLocalEntries(mergedEntries);
        lastSuccessfulEntriesRef.current = mergedEntries;
        
        // Also check for first entry completion
        if (isProcessingFirstEntry && mergedEntries.length > 0) {
          console.log('[Journal] First entry processing appears to be complete (merged entries)');
          setTimeout(() => {
            setIsProcessingFirstEntry(false);
            firstTimeProcessingRef.current = false;
          }, 500);
        }
      }
    }
  }, [entries, hasLocalChanges, pendingDeletionIds, isProcessingFirstEntry]);

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
              if (componentMountedRef.current) {
                console.log(`[Journal] Scheduled fetch at ${interval}ms after mapping`);
                fetchEntries();
                setRefreshKey(prev => prev + 1);
              }
            }, interval);
          });
        }
      }
    };
    
    // Using componentMountedRef
    window.addEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
    window.addEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
    
    return () => {
      componentMountedRef.current = false;
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
        }, 300); // Increased from 50 to 300ms for more reliable tab switch
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
        
        // More frequent polling for the first minute of processing
        const pollIntervals = [1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000];
        
        // Create multiple scheduled fetches to ensure we get updates
        pollIntervals.forEach(interval => {
          setTimeout(() => {
            if (componentMountedRef.current) {
              console.log(`[Journal] Polling for entry data at ${interval}ms interval`);
              fetchEntries();
              setRefreshKey(prev => prev + 1);
            }
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
                
                // For first-time users, switch to entries tab after processing completes
                if (isFirstTimeUser && activeTab === 'record') {
                  setTimeout(() => {
                    setActiveTab('entries');
                  }, 500);
                }
              }
              
              // Release toast lock
              setTimeout(() => {
                setToastLockActive(false);
              }, 500);
              
              return prev.filter(id => id !== tempId);
            }
            return prev;
          });
        }, 30000); // Increased from 20s to 30s for more reliable handling
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
      
      // Apply local changes to entries before database changes are reflected
      setLocalEntries(prev => prev.filter(entry => entry.id !== entryId));
      setPendingDeletionIds(prev => {
        const newSet = new Set(prev);
        newSet.add(entryId);
        return newSet;
      });
      setHasLocalChanges(true);
      
      if (deletingEntryId === entryId) {
        setDeletingEntryId(null);
      }
      
      // Fix: Use "Journal Entries" instead of "journal_entries" as the table name
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entryId);
      
      if (error) {
        console.error(`[Journal] Error deleting entry ${entryId}:`, error);
        throw new Error(error.message);
      }
      
      console.log(`[Journal] Entry ${entryId} successfully deleted`);
      
      setRefreshKey(prev => prev + 1);
      fetchEntries();
      
      toast.success('Entry deleted successfully', {
        duration: 3000,
        closeButton: false
      });
      
      // Update search results if active
      if (filteredEntries.length > 0) {
        setFilteredEntries(prev => prev.filter(entry => entry.id !== entryId));
      }
    } catch (error) {
      console.error('[Journal] Error deleting entry:', error);
      
      // Revert local changes
      setPendingDeletionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
      
      setLocalEntries(lastSuccessfulEntriesRef.current);
      setHasLocalChanges(false);
      
      toast.error('Failed to delete entry', {
        duration: 3000,
        closeButton: false
      });
    } finally {
      setIsDeletingEntry(false);
    }
  }, [user?.id, isDeletingEntry, processingEntries, toastIds, fetchEntries, filteredEntries.length]);

  // Define the function to handle search results
  const handleSearchResults = useCallback((searchResults: JournalEntry[]) => {
    setFilteredEntries(searchResults);
  }, []);

  // Define function to clear search results
  const clearSearchResults = useCallback(() => {
    setFilteredEntries([]);
  }, []);

  // Format bytes to human-readable string
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const handlePlaceholderEntryCreated = useCallback(() => {
    console.log('[Journal] Placeholder entry created, refreshing entries');
    fetchEntries();
    setRefreshKey(prev => prev + 1);
  }, [fetchEntries]);

  if (hasRenderError) {
    return (
      <div className="p-4 border border-red-500 rounded-md">
        <div className="flex items-center mb-2">
          <AlertCircle className="text-red-500 mr-2 h-5 w-5" />
          <h3 className="text-lg font-semibold">Rendering Error</h3>
        </div>
        <p className="mb-4">There was a problem rendering the journal.</p>
        <Button 
          onClick={() => {
            setHasRenderError(false);
            setRefreshKey(prev => prev + 1);
            window.location.reload();
          }}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Try Again</span>
        </Button>
      </div>
    );
  }

  if (!isProfileChecked || isCheckingProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-lg text-center">
          <TranslatableText text="Loading your journal..." />
        </p>
      </div>
    );
  }

  if (showRetryButton) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <div className="flex items-center mb-4 text-amber-500">
          <AlertCircle className="h-8 w-8 mr-2" />
        </div>
        <p className="text-lg text-center mb-4">
          <TranslatableText text="There was a problem loading your journal profile." />
        </p>
        <Button onClick={handleRetryProfileCreation} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          <TranslatableText text="Retry" />
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container max-w-4xl mx-auto pb-20">
        <JournalHeader />
        
        {/* PlaceholderEntryManager with the proper callback */}
        {user?.id && !loading && entries.length === 0 && !isFirstTimeUser && (
          <PlaceholderEntryManager 
            onEntryCreated={handlePlaceholderEntryCreated}
            hasEntries={entries.length > 0}
            isProcessingFirstEntry={isProcessingFirstEntry}
          />
        )}
        
        <Tabs 
          value={activeTab} 
          onValueChange={handleTabChange}
          className="mt-6"
          defaultValue="record"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-background border">
            <TabsTrigger value="record">
              <TranslatableText text="Record" />
            </TabsTrigger>
            <TabsTrigger value="entries">
              <TranslatableText text="Entries" />
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="record" className="mt-2">
            <VoiceRecorder 
              onRecordingComplete={handleRecordingComplete}
              audioStatus={audioStatus}
              recordingDuration={recordingDuration}
              setRecordingDuration={setRecordingDuration}
              processingError={processingError}
            />
          </TabsContent>
          
          <TabsContent value="entries" className="mt-0">
            <div className="mb-4">
              <JournalSearch 
                entries={localEntries} 
                onSearchResults={handleSearchResults}
              />
            </div>
            
            <div ref={entriesListRef}>
              <JournalEntriesList
                entries={filteredEntries.length > 0 ? filteredEntries : localEntries}
                loading={loading && !hasLocalChanges}
                loadMore={() => {}} // Placeholder for pagination
                hasMoreEntries={false} // Placeholder for pagination
                isLoadingMore={false} // Placeholder for pagination
                onDeleteEntry={handleDeleteEntry}
                processingEntries={processingEntries}
                processedEntryIds={processedEntryIds}
                onStartRecording={handleStartRecording}
                isProcessingFirstEntry={isProcessingFirstEntry}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
};

export default Journal;
