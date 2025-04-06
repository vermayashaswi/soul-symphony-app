
import React, { useEffect, useState } from 'react';
import { useJournalDebugger } from '@/hooks/use-journal-debugger';
import { DebuggerButton } from './DebuggerButton';
import { DebugPanel } from './DebugPanel';
import { useAuth } from '@/contexts/AuthContext';

interface JournalDebuggerProps {
  processingEntries: string[];
  isSavingRecording: boolean;
  isRecordingComplete: boolean;
  activeTab: string;
  processingError: string | null;
  lastAction?: string;
  audioStatus?: string;
  recordingDuration?: number;
}

const JournalDebugger = (props: JournalDebuggerProps) => {
  const { user } = useAuth();
  const {
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
  } = useJournalDebugger(props);

  // Style to ensure debugger is always visible in center of screen
  const debuggerStyle = {
    zIndex: 9999,
    position: 'fixed' as 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto' as 'auto'
  };

  return (
    <div style={debuggerStyle}>
      {!isOpen ? (
        <DebuggerButton 
          hasErrorState={hasErrorState}
          onClick={toggleOpen}
        />
      ) : (
        <DebugPanel
          isExpanded={isExpanded}
          renderCount={renderCount}
          userId={user?.id}
          entriesCount={entries.length}
          processingEntries={props.processingEntries}
          debugHistory={debugHistory}
          isSavingRecording={props.isSavingRecording}
          isRecordingComplete={props.isRecordingComplete}
          activeTab={props.activeTab}
          loading={loading}
          error={error}
          processingError={props.processingError}
          lastAction={props.lastAction}
          audioStatus={props.audioStatus}
          recordingDuration={props.recordingDuration}
          lastRenderTime={lastRenderTime}
          mountStatus={mountStatus}
          layoutInfo={layoutInfo}
          cssState={cssState}
          onToggleExpanded={toggleExpanded}
          onClose={toggleOpen}
        />
      )}
    </div>
  );
};

export default JournalDebugger;
