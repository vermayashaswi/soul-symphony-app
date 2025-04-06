
import React from 'react';

interface CurrentDebugStateProps {
  userId?: string;
  entriesCount: number;
  processingEntries: string[];
  isSavingRecording: boolean;
  isRecordingComplete: boolean;
  activeTab: string;
  loading: boolean;
  error?: string | null;
  processingError?: string | null;
  lastAction?: string;
  audioStatus?: string;
  recordingDuration?: number;
  lastRenderTime?: string;
  mountStatus?: string;
  layoutInfo?: any;
  cssState?: any;
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
  processingError,
  lastAction,
  audioStatus,
  recordingDuration,
  lastRenderTime,
  mountStatus,
  layoutInfo,
  cssState
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
        
        <div>Last Render:</div>
        <div className="font-mono text-green-400">{lastRenderTime || new Date().toLocaleTimeString()}</div>
        
        <div>Mount Status:</div>
        <div className="font-mono text-green-400">{mountStatus || 'Normal'}</div>
        
        <div>Last Action:</div>
        <div className="font-mono text-green-400">{lastAction || 'None'}</div>
        
        {/* Layout and CSS debug info */}
        <div className="col-span-2 mt-2 mb-1 text-yellow-400 font-medium">Layout & CSS:</div>
        
        <div>Viewport:</div>
        <div className="font-mono text-green-400">
          {layoutInfo?.viewport ? `${layoutInfo.viewport.width}×${layoutInfo.viewport.height}` : 'Unknown'}
        </div>
        
        <div>Content Height:</div>
        <div className="font-mono text-green-400">{layoutInfo?.contentHeight || 'Unknown'}</div>
        
        <div>Scroll Position:</div>
        <div className="font-mono text-green-400">{layoutInfo?.scrollY !== undefined ? `${layoutInfo.scrollY}px` : 'Unknown'}</div>
        
        <div>Theme:</div>
        <div className="font-mono text-green-400">{cssState?.theme || 'Default'}</div>
        
        <div>CSS Variables:</div>
        <div className="font-mono text-green-400">{cssState?.cssVarCount || '0'} loaded</div>
        
        <div>Styles:</div>
        <div className="font-mono text-green-400">{cssState?.styleSheets || '0'} sheets</div>
        
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
        
        {cssState?.errors && cssState.errors.length > 0 && (
          <>
            <div className="text-red-400">CSS Errors:</div>
            <div className="font-mono text-red-400">{cssState.errors.join(', ')}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default CurrentDebugState;
