
import React from 'react';
export type DebugStep = {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error' | 'in-progress';
  timestamp?: number;
  details?: string;
  duration?: number;
};

interface VoiceRecorderDebugPanelProps {
  steps: DebugStep[];
  isVisible: boolean;
  toggleVisibility: () => void;
  className?: string;
}

// This panel is removed for release; always returns null
export function VoiceRecorderDebugPanel(_: VoiceRecorderDebugPanelProps) {
  return null;
}

export default VoiceRecorderDebugPanel;
