
import React from 'react';

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

interface DebugHistoryProps {
  debugHistory: DebugState[];
}

export function DebugHistory({ debugHistory }: DebugHistoryProps) {
  return (
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
  );
}

export default DebugHistory;
