
import React, { useState } from 'react';
import { RecordingButton } from './RecordingButton';

interface VoiceRecordingButtonWrapperProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const VoiceRecordingButtonWrapper: React.FC<VoiceRecordingButtonWrapperProps> = ({
  onStartRecording,
  onStopRecording,
  isRecording,
  disabled,
  size
}) => {
  // Default props needed by RecordingButton that aren't passed from parent
  const [hasPermission, setHasPermission] = useState<boolean | null>(true); // Assume permission granted
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Map the wrapper props to the RecordingButton props
  const handleRecordingStart = () => {
    onStartRecording();
  };

  const handleRecordingStop = () => {
    onStopRecording();
  };

  const handlePermissionRequest = () => {
    // In a real implementation, this would request microphone permissions
    console.log('Permission requested');
    setHasPermission(true);
  };

  return (
    <div id="voice-record-button">
      <RecordingButton
        isRecording={isRecording}
        isProcessing={false} // Default value
        hasPermission={hasPermission}
        onRecordingStart={handleRecordingStart}
        onRecordingStop={handleRecordingStop}
        onPermissionRequest={handlePermissionRequest}
        audioLevel={audioLevel}
        showAnimation={true}
        audioBlob={audioBlob}
      />
    </div>
  );
};

export default VoiceRecordingButtonWrapper;
