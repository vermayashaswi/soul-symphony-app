
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
  layoutInfo?: any;
  cssState?: any;
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
  const [layoutInfo, setLayoutInfo] = useState<any>({});
  const [cssState, setCssState] = useState<any>({});
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

  // Collect layout and CSS information
  useEffect(() => {
    const updateLayoutInfo = () => {
      if (!componentMounted.current) return;
      
      try {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollY = window.scrollY;
        
        setLayoutInfo({
          viewport: { width: viewportWidth, height: viewportHeight },
          contentHeight: documentHeight,
          scrollY: scrollY,
          devicePixelRatio: window.devicePixelRatio,
          orientation: window.screen.orientation ? window.screen.orientation.type : 'unknown'
        });
      } catch (e) {
        console.error("Error collecting layout information:", e);
      }
    };
    
    const updateCssState = () => {
      if (!componentMounted.current) return;
      
      try {
        // Check if there's a theme
        const htmlElement = document.documentElement;
        const theme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
        
        // Count CSS variables
        const cssVars = getComputedStyle(htmlElement);
        let cssVarCount = 0;
        for (let i = 0; i < cssVars.length; i++) {
          if (cssVars[i].startsWith('--')) cssVarCount++;
        }
        
        // Count stylesheets
        const styleSheets = document.styleSheets.length;
        
        // Check for common CSS errors
        const errors: string[] = [];
        
        // Check if main container has 100% height
        const mainContainer = document.querySelector('main');
        if (mainContainer) {
          const mainHeight = getComputedStyle(mainContainer).height;
          if (mainHeight === '0px') errors.push('Main container has zero height');
        }
        
        // Check if there are elements with position: fixed that might be causing issues
        const fixedElements = document.querySelectorAll('[style*="position: fixed"]');
        if (fixedElements.length > 5) errors.push(`${fixedElements.length} fixed-position elements detected`);
        
        setCssState({
          theme,
          cssVarCount,
          styleSheets,
          errors
        });
      } catch (e) {
        console.error("Error collecting CSS information:", e);
        setCssState({ errors: ["Error analyzing CSS: " + String(e)] });
      }
    };
    
    // Collect initial information
    updateLayoutInfo();
    updateCssState();
    
    // Set up event listeners
    window.addEventListener('resize', updateLayoutInfo);
    window.addEventListener('scroll', updateLayoutInfo);
    
    // Monitor for CSS changes periodically
    const cssCheckInterval = setInterval(updateCssState, 2000);
    
    return () => {
      window.removeEventListener('resize', updateLayoutInfo);
      window.removeEventListener('scroll', updateLayoutInfo);
      clearInterval(cssCheckInterval);
    };
  }, []);

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
    
    const hasErrors = !!error || !!processingError || (cssState.errors && cssState.errors.length > 0);
    setHasErrorState(hasErrors);
  }, [error, processingError, cssState.errors]);

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
      mountStatus,
      layoutInfo,
      cssState
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
    mountStatus,
    layoutInfo,
    cssState
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
    layoutInfo,
    cssState,
    toggleOpen,
    toggleExpanded
  };
}
