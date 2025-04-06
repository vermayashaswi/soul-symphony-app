
import React from 'react';

interface CurrentDebugStateProps {
  userId?: string;
  entriesCount: number;
  processingEntries: string[];
  isSavingRecording: boolean;
  isRecordingComplete: boolean;
  activeTab: string;
  loading: boolean;
  error: string | null;
  processingError: string | null;
}

export function CurrentDebugState({
  userId,
  entriesCount,
  processingEntries,
  isSavingRecording,
  isRecordingComplete,
  activeTab,
  loading,
  error,
  processingError
}: CurrentDebugStateProps) {
  return (
    <div className="bg-gray-900 p-2 rounded">
      <h4 className="font-medium mb-1 text-yellow-400">Current State:</h4>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div>User ID:</div>
        <div className="font-mono text-green-400">{userId || 'Not logged in'}</div>
        
        <div>Entries:</div>
        <div className="font-mono text-green-400">{entriesCount}</div>
        
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
  );
}

export default CurrentDebugState;
