
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
}

export function useJournalDebugger({
  processingEntries,
  isSavingRecording,
  isRecordingComplete,
  activeTab,
  processingError
}: {
  processingEntries: string[];
  isSavingRecording: boolean;
  isRecordingComplete: boolean;
  activeTab: string;
  processingError: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [debugHistory, setDebugHistory] = useState<DebugState[]>([]);
  const [renderCount, setRenderCount] = useState(0);
  const [hasErrorState, setHasErrorState] = useState(false);
  const { user } = useAuth();
  
  // Use try-catch to safely access journal entries
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
    // Increment render count on each render
    setRenderCount(prev => prev + 1);
  });

  const toggleOpen = () => setIsOpen(!isOpen);
  const toggleExpanded = () => setIsExpanded(!isExpanded);

  // Detect if we have error states in the component hierarchy
  useEffect(() => {
    const hasErrors = !!error || !!processingError;
    setHasErrorState(hasErrors);
  }, [error, processingError]);

  useEffect(() => {
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
      processingError
    };

    setDebugHistory(prev => [currentState, ...prev].slice(0, 20));
  }, [entries.length, processingEntries, isSavingRecording, isRecordingComplete, activeTab, error, processingError]);

  return {
    isOpen,
    isExpanded,
    debugHistory,
    renderCount,
    hasErrorState,
    entries,
    loading,
    error,
    toggleOpen,
    toggleExpanded
  };
}
