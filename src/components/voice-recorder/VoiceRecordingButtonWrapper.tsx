
import React from 'react';
import { RecordingButton } from './RecordingButton';

interface VoiceRecordingButtonWrapperProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const VoiceRecordingButtonWrapper: React.FC<VoiceRecordingButtonWrapperProps> = (props) => {
  return (
    <div id="voice-record-button">
      <RecordingButton {...props} />
    </div>
  );
};

export default VoiceRecordingButtonWrapper;
