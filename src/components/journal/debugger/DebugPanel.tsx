
import React from 'react';
import { motion } from 'framer-motion';
import { Code, X, ChevronDown, ChevronUp } from 'lucide-react';
import { CurrentDebugState } from './CurrentDebugState';
import { DebugHistory } from './DebugHistory';

interface DebugPanelProps {
  isExpanded: boolean;
  renderCount: number;
  userId?: string;
  entriesCount: number;
  processingEntries: string[];
  debugHistory: any[];
  isSavingRecording: boolean;
  isRecordingComplete: boolean;
  activeTab: string;
  loading: boolean;
  error: string | null;
  processingError: string | null;
  lastAction?: string;
  audioStatus?: string;
  recordingDuration?: number;
  lastRenderTime?: string;
  mountStatus?: string;
  layoutInfo?: any;
  cssState?: any;
  onToggleExpanded: () => void;
  onClose: () => void;
}

export function DebugPanel({
  isExpanded,
  renderCount,
  userId,
  entriesCount,
  processingEntries,
  debugHistory,
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
  cssState,
  onToggleExpanded,
  onClose
}: DebugPanelProps) {
  return (
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
            <ChevronDown size={18} className="cursor-pointer hover:text-yellow-500" onClick={onToggleExpanded} />
          ) : (
            <ChevronUp size={18} className="cursor-pointer hover:text-yellow-500" onClick={onToggleExpanded} />
          )}
          <X size={18} className="cursor-pointer hover:text-yellow-500" onClick={onClose} />
        </div>
      </div>
      
      <div className="space-y-3 text-xs">
        <CurrentDebugState
          userId={userId}
          entriesCount={entriesCount}
          processingEntries={processingEntries}
          isSavingRecording={isSavingRecording}
          isRecordingComplete={isRecordingComplete}
          activeTab={activeTab}
          loading={loading}
          error={error}
          processingError={processingError}
          lastAction={lastAction}
          audioStatus={audioStatus}
          recordingDuration={recordingDuration}
          lastRenderTime={lastRenderTime}
          mountStatus={mountStatus}
          layoutInfo={layoutInfo}
          cssState={cssState}
        />
        
        {isExpanded && <DebugHistory debugHistory={debugHistory} />}
      </div>
    </motion.div>
  );
}

export default DebugPanel;
