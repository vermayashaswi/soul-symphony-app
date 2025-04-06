
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Code, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
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

const JournalDebugger = ({
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
}) => {
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

  // Style to ensure debugger is always visible
  const debuggerStyle = {
    zIndex: 9999,
    position: 'fixed' as 'fixed',
    top: '2rem',
    right: '2rem',
    pointerEvents: 'auto' as 'auto'  // Fix typing error by using 'auto' instead of string
  };

  return (
    <div style={debuggerStyle}>
      {!isOpen ? (
        <motion.div 
          className={`p-2 rounded-full cursor-pointer shadow-lg hover:opacity-90 transition-colors flex items-center justify-center ${hasErrorState ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'}`}
          onClick={toggleOpen}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {hasErrorState ? (
            <AlertCircle size={20} />
          ) : (
            <Code size={20} />
          )}
        </motion.div>
      ) : (
        <motion.div 
          className="bg-gray-950 text-white p-4 rounded-lg shadow-xl border border-yellow-500 max-w-[90vw]"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{ width: isExpanded ? '600px' : '350px', maxHeight: '80vh', overflow: 'auto' }}
        >
          <div className="flex justify-between items-center mb-3">
            <div className="flex gap-2 items-center">
              <Code size={18} className="text-yellow-500" />
              <h3 className="font-semibold text-yellow-500">Journal Debugger</h3>
              <span className="text-xs text-gray-400">Renders: {renderCount}</span>
            </div>
            <div className="flex gap-2">
              {isExpanded ? (
                <ChevronDown size={18} className="cursor-pointer hover:text-yellow-500" onClick={toggleExpanded} />
              ) : (
                <ChevronUp size={18} className="cursor-pointer hover:text-yellow-500" onClick={toggleExpanded} />
              )}
              <X size={18} className="cursor-pointer hover:text-yellow-500" onClick={toggleOpen} />
            </div>
          </div>
          
          <div className="space-y-3 text-xs">
            <div className="bg-gray-900 p-2 rounded">
              <h4 className="font-medium mb-1 text-yellow-400">Current State:</h4>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div>User ID:</div>
                <div className="font-mono text-green-400">{user?.id || 'Not logged in'}</div>
                
                <div>Entries:</div>
                <div className="font-mono text-green-400">{entries.length}</div>
                
                <div>Processing Entries:</div>
                <div className="font-mono text-green-400">{processingEntries.length > 0 ? processingEntries.join(', ') : 'None'}</div>
                
                <div>Saving Recording:</div>
                <div className={`font-mono ${isSavingRecording ? 'text-yellow-400' : 'text-green-400'}`}>
                  {isSavingRecording ? 'Yes' : 'No'}
                </div>
                
                <div>Recording Complete:</div>
                <div className={`font-mono ${isRecordingComplete ? 'text-yellow-400' : 'text-green-400'}`}>
                  {isRecordingComplete ? 'Yes' : 'No'}
                </div>
                
                <div>Active Tab:</div>
                <div className="font-mono text-green-400">{activeTab}</div>
                
                <div>Loading:</div>
                <div className={`font-mono ${loading ? 'text-yellow-400' : 'text-green-400'}`}>
                  {loading ? 'Yes' : 'No'}
                </div>
                
                <div>Time:</div>
                <div className="font-mono text-green-400">{new Date().toLocaleTimeString()}</div>
                
                {error && (
                  <>
                    <div className="text-red-400">Error:</div>
                    <div className="font-mono text-red-400">{error}</div>
                  </>
                )}
                
                {processingError && (
                  <>
                    <div className="text-red-400">Processing Error:</div>
                    <div className="font-mono text-red-400">{processingError}</div>
                  </>
                )}
              </div>
            </div>
            
            {isExpanded && (
              <div className="bg-gray-900 p-2 rounded">
                <h4 className="font-medium mb-1 text-yellow-400">State History:</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {debugHistory.map((state, index) => (
                    <div key={index} className="border-t border-gray-800 pt-2">
                      <div className="text-gray-400 text-[10px] mb-1">
                        {new Date(state.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <div>Entries:</div>
                        <div className="font-mono">{state.entries}</div>
                        
                        <div>Processing:</div>
                        <div className="font-mono">
                          {state.processingEntries.length > 0 
                            ? state.processingEntries.join(', ')
                            : 'None'
                          }
                        </div>
                        
                        <div>Saving Recording:</div>
                        <div className="font-mono">{state.isSavingRecording ? 'Yes' : 'No'}</div>
                        
                        <div>Tab:</div>
                        <div className="font-mono">{state.activeTab}</div>
                        
                        {state.error && (
                          <>
                            <div className="text-red-400">Error:</div>
                            <div className="font-mono text-red-400">{state.error}</div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default JournalDebugger;
