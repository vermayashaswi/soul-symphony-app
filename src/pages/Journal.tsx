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
import { clearAllToasts } from '@/services/notificationService';
import { JournalErrorBoundary } from '@/components/journal/ErrorBoundary';
import { supabase } from '@/integrations/supabase/client';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { JournalEntry } from '@/types/journal';
import JournalSearch from '@/components/journal/JournalSearch';
import { setProcessingIntent } from '@/utils/journal/processing-intent';

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
  const [deletedEntryIds, setDeletedEntryIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');

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
    if (entries && entries.length > 0 && !hasLocalChanges) {
      // Filter out any entries that are in our deleted entries list
      const filteredEntries = entries.filter(entry => !deletedEntryIds.has(entry.id));
      setLocalEntries(filteredEntries);
      lastSuccessfulEntriesRef.current = filteredEntries;
    } else if (entries && entries.length > 0) {
      const deletedIds = new Set([...pendingDeletionIds, ...deletedEntryIds]);
      
      const mergedEntries = entries.filter(entry => !deletedIds.has(entry.id));
      
      if (mergedEntries.length > 0) {
        setLocalEntries(mergedEntries);
        lastSuccessfulEntriesRef.current = mergedEntries;
      }
    }
  }, [entries, hasLocalChanges, pendingDeletionIds, deletedEntryIds]);

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
      if (forceUpdateTimerRef.current) {
        clearTimeout(forceUpdateTimerRef.current);
      }
      
      clearAllToasts();
    };
  }, [processingEntries, fetchEntries, deletedProcessingIds]);

  useEffect(() => {
    clearAllToasts();
    
    return () => {
      clearAllToasts();
      
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
  }, [entries, processingEntries, entriesReady, activeTab, fetchEntries, notifiedEntryIds]);

  useEffect(() => {
    return () => {
      if (profileCheckTimeoutId) {
        clearTimeout(profileCheckTimeoutId);
      }
    };
  }, [profileCheckTimeoutId]);

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
    }
    
    setTabChangeInProgress(true);
    
    setTimeout(() => {
      if (value === 'entries' && !safeToSwitchTab) {
        console.log('[Journal] User attempting to switch to entries while processing');
        
        toast.info('Processing in progress...', { 
          duration: 2000,
          closeButton: false
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
      // CRITICAL: Set processing intent IMMEDIATELY before any async operations
      console.log('[Journal] Setting processing intent immediately');
      setProcessingIntent(true);
      
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
      
      // Dispatch immediate processing events for instant UI feedback
      window.dispatchEvent(new CustomEvent('immediateProcessingStarted', {
        detail: { 
          tempId: 'immediate-processing',
          timestamp: Date.now(),
          immediate: true 
        }
      }));
      
      setTimeout(() => {
        setActiveTab('entries');
      }, 50);
      
      console.log('[Journal] Starting processing for audio file:', audioBlob.size, 'bytes');
      const { success, tempId, error } = await processRecording(audioBlob, user.id);
      
      if (success && tempId) {
        console.log('[Journal] Processing started with tempId:', tempId);
        setProcessingEntries(prev => [...prev, tempId]);
        setLastAction(`Processing Started (${tempId})`);
        
        // Clear processing intent as real processing has started
        setProcessingIntent(false);
        
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
              
              toast.success('Journal entry processed', { 
                duration: 3000,
                closeButton: false
              });
              
              // Remove the temporary entry from localEntries if it's still there
              setLocalEntries(prev => prev.filter(entry => !(entry.tempId === tempId)));
              
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
        
        // Clear processing intent on failure
        setProcessingIntent(false);
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        toast.error(`Failed to process recording: ${error || 'Unknown error'}`, { 
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
    } catch (error: any) {
      console.error('Error processing recording:', error);
      setProcessingError(error?.message || 'Unknown error occurred');
      setLastAction(`Exception: ${error?.message || 'Unknown'}`);
      
      // Clear processing intent on exception
      setProcessingIntent(false);
      
      clearAllToasts();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      toast.error('Error processing your recording', { 
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
      
      setNotifiedEntryIds(prev => {
        const updated = new Set(prev);
        updated.delete(entryId);
        return updated;
      });
      
      // Update local entries to immediately remove the deleted entry
      setLocalEntries(prevEntries => {
        const filteredEntries = prevEntries.filter(entry => entry.id !== entryId);
        console.log(`[Journal] Locally filtered entries: ${filteredEntries.length} (removed entry ${entryId})`);
        return filteredEntries;
      });
      
      // Add to both pending deletion IDs (for temporary state) and permanent deleted entry IDs
      setPendingDeletionIds(prev => {
        const newSet = new Set(prev);
        newSet.add(entryId);
        return newSet;
      });

      // Add to permanent deleted entries record
      setDeletedEntryIds(prev => {
        const newSet = new Set(prev);
        newSet.add(entryId);
        return newSet;
      });
      
      setHasLocalChanges(true);
      
      // Perform the actual deletion in the database
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entryId);
        
      if (error) {
        console.error('[Journal] Database error while deleting entry:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      
      console.log(`[Journal] Entry ${entryId} successfully deleted from database`);
      
      // Dispatch event to notify other components about the deletion
      window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
        detail: { 
          action: 'delete',
          entryId: entryId,
          timestamp: Date.now()
        }
      }));
      
      // Schedule refresh intervals to ensure UI is updated
      const refreshIntervals = [300, 1000, 2500];
      refreshIntervals.forEach((interval, index) => {
        setTimeout(() => {
          if (index === refreshIntervals.length - 1) {
            // Keep the entry ID in deletedEntryIds permanently, but remove from pendingDeletionIds
            setPendingDeletionIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(entryId);
              return newSet;
            });
            
            // Only reset hasLocalChanges when we've confirmed deletion
            setHasLocalChanges(false);
          }
          
          setRefreshKey(prev => prev + 1);
          if (index === 0) {
            fetchEntries();
          }
        }, interval);
      });
      
      toast.success('Entry successfully deleted', {
        duration: 3000,
        id: 'delete-success-toast',
        closeButton: false
      });
      
    } catch (error) {
      console.error('[Journal] Error deleting entry:', error);
      setLastAction(`Delete Entry Error (${entryId})`);
      toast.error('Failed to delete entry');
      
      // On error, restore the entry from the deleted lists
      if (hasLocalChanges) {
        setLocalEntries(entries);
        setPendingDeletionIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(entryId);
          return newSet;
        });
        setDeletedEntryIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(entryId);
          return newSet;
        });
        setHasLocalChanges(false);
      }
      
      throw error;
    } finally {
      setIsDeletingEntry(false);
      setDeletingEntryId(null);
    }
  }, [user?.id, processingEntries, fetchEntries, entries, hasLocalChanges, isDeletingEntry]);

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
    
    // Add handler for entry deletion events
    const handleJournalEntryDeleted = (event: CustomEvent) => {
      if (event.detail && event.detail.entryId) {
        const deletedId = Number(event.detail.entryId);
        console.log(`[Journal] Entry deletion event detected for ID: ${deletedId}`);
        
        // Add to permanent deleted IDs
        setDeletedEntryIds(prev => {
          const newSet = new Set(prev);
          newSet.add(deletedId);
          return newSet;
        });
      }
    };
    
    window.addEventListener('journalEntryUpdated', handleJournalEntryUpdated as EventListener);
    window.addEventListener('journalEntryDeleted', handleJournalEntryDeleted as EventListener);
    
    return () => {
      window.removeEventListener('journalEntryUpdated', handleJournalEntryUpdated as EventListener);
      window.removeEventListener('journalEntryDeleted', handleJournalEntryDeleted as EventListener);
    };
  }, [fetchEntries]);

  // Update the handleSearchResults function to ensure type compatibility
  const handleSearchResults = (filtered: JournalEntry[], query: string) => {
    setFilteredEntries(filtered);
    setSearchQuery(query);
  };

  // Update the entries handling to ensure types are compatible
  const displayEntries = hasLocalChanges ? localEntries : 
                        (entries && entries.length > 0) ? 
                          entries.filter(entry => !deletedEntryIds.has(entry.id)) : 
                        (lastSuccessfulEntriesRef.current.length > 0) ? 
                          lastSuccessfulEntriesRef.current.filter(entry => !deletedEntryIds.has(entry.id)) : [];
  
  // Define the missing showLoading variable
  const isReallyEmpty = displayEntries.length === 0 && 
                        lastSuccessfulEntriesRef.current.length === 0 && 
                        !loading;
                        
  const showLoading = loading && displayEntries.length === 0 && !hasLocalChanges;

  // Convert entries to ensure they have the required content field
  const entriesToDisplay = (() => {
    const hasActiveSearch = searchQuery.trim() !== '';
    const hasSearchResults = filteredEntries.length > 0;
    
    if (!hasActiveSearch) {
      // No search query - show all entries
      return displayEntries.map(entry => ({
        ...entry,
        content: entry.content || entry["refined text"] || entry["transcription text"] || ""
      }));
    } else if (hasSearchResults) {
      // Search query with results - show filtered entries
      return filteredEntries.map(entry => ({
        ...entry,
        content: entry.content || entry["refined text"] || entry["transcription text"] || ""
      }));
    } else {
      // Search query with no results - show empty array
      return [];
    }
  })();

  if (hasRenderError) {
    console.error('[Journal] Recovering from render error');
    setHasRenderError(false);
    setLastAction('Recovering from Render Error');
  }

  return (
    <JournalErrorBoundary onReset={resetError}>
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
        <JournalHeader />
        
        {isCheckingProfile ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
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
                <TabsTrigger 
                  value="record" 
                  className="tutorial-record-entry-button record-entry-tab"
                  data-tutorial-target="record-entry"
                  id="new-entry-button"
                >
                  <TranslatableText text="Record Entry" />
                </TabsTrigger>
                <TabsTrigger 
                  value="entries"
                  className="entries-tab"
                  data-tutorial-target="past-entries"
                  id="past-entries-button"
                >
                  <TranslatableText text="Past Entries" />
                </TabsTrigger>
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
                <JournalErrorBoundary>
                  <JournalSearch
                    entries={displayEntries}
                    onSelectEntry={() => {}}
                    onSearchResults={handleSearchResults}
                  />
                  <JournalEntriesList
                    entries={entriesToDisplay}
                    loading={showLoading}
                    processingEntries={processingEntries}
                    processedEntryIds={processedEntryIds}
                    onStartRecording={handleStartRecording}
                    onDeleteEntry={handleDeleteEntry}
                    isSavingRecording={isSavingRecording}
                  />
                </JournalErrorBoundary>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </JournalErrorBoundary>
  );
};

export default Journal;
