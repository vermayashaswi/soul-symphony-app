
import { useState, useEffect, useRef } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useAuth } from '@/contexts/AuthContext';

interface DebugState {
  timestamp: string;
  entries: number;
  processingEntries: string[];
  isSavingRecording: boolean;
  isRecordingComplete: boolean;
  activeTab: string;
  lastRefresh: string;
  error?: string | null;
  processingError?: string | null;
  lastAction?: string;
  audioStatus?: string;
  recordingDuration?: number;
  mountStatus?: string;
}

export function useJournalDebugger({
  processingEntries,
  isSavingRecording,
  isRecordingComplete,
  activeTab,
  processingError,
  lastAction,
  audioStatus,
  recordingDuration
}: {
  processingEntries: string[];
  isSavingRecording: boolean;
  isRecordingComplete: boolean;
  activeTab: string;
  processingError: string | null;
  lastAction?: string;
  audioStatus?: string;
  recordingDuration?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [debugHistory, setDebugHistory] = useState<DebugState[]>([]);
  const [renderCount, setRenderCount] = useState(0);
  const [hasErrorState, setHasErrorState] = useState(false);
  const [lastRenderTime, setLastRenderTime] = useState<string>(new Date().toLocaleTimeString());
  const [mountStatus, setMountStatus] = useState<string>("Mounted");
  const { user } = useAuth();
  const componentMounted = useRef(true);
  
  // Safe journal state access with fallback
  const journalState = (() => {
    try {
      return useJournalEntries(user?.id, Date.now(), true);
    } catch (e) {
      console.error("Error accessing journal entries in debugger:", e);
      return { entries: [], loading: false, error: String(e) };
    }
  })();
  
  const { entries = [], loading = false, error = null } = journalState;

  useEffect(() => {
    // Provide cleanup function
    return () => {
      componentMounted.current = false;
      setMountStatus("Unmounted");
    };
  }, []);

  useEffect(() => {
    // Increment render count on each render
    if (componentMounted.current) {
      setRenderCount(prev => prev + 1);
      setLastRenderTime(new Date().toLocaleTimeString());
    }
  });

  const toggleOpen = () => setIsOpen(!isOpen);
  const toggleExpanded = () => setIsExpanded(!isExpanded);

  // Detect if we have error states in the component hierarchy
  useEffect(() => {
    if (!componentMounted.current) return;
    
    const hasErrors = !!error || !!processingError;
    setHasErrorState(hasErrors);
  }, [error, processingError]);

  useEffect(() => {
    if (!componentMounted.current) return;
    
    // Record the current state
    const currentState: DebugState = {
      timestamp: new Date().toISOString(),
      entries: entries.length,
      processingEntries,
      isSavingRecording,
      isRecordingComplete,
      activeTab,
      lastRefresh: new Date().toISOString(),
      error,
      processingError,
      lastAction,
      audioStatus,
      recordingDuration,
      mountStatus
    };

    setDebugHistory(prev => [currentState, ...prev].slice(0, 20));
  }, [
    entries.length, 
    processingEntries, 
    isSavingRecording, 
    isRecordingComplete, 
    activeTab, 
    error, 
    processingError,
    lastAction,
    audioStatus,
    recordingDuration,
    mountStatus
  ]);

  return {
    isOpen,
    isExpanded,
    debugHistory,
    renderCount,
    hasErrorState,
    entries,
    loading,
    error,
    lastRenderTime,
    mountStatus,
    toggleOpen,
    toggleExpanded
  };
}
