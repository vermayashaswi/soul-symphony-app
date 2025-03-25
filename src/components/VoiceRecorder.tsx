
import React, { useState, useEffect } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { processRecording } from '@/utils/audio-processing';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingVisualizer } from '@/components/voice-recorder/RecordingVisualizer';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, tempId?: string) => void;
  onCancel?: () => void;
  className?: string;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className }: VoiceRecorderProps) {
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  
  const {
    isRecording,
    recordingTime,
    audioBlob,
    audioLevel,
    hasPermission,
    ripples,
    startRecording,
    stopRecording,
    requestPermissions
  } = useVoiceRecorder({ noiseReduction });
  
  const {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    audioRef
  } = useAudioPlayback({ audioBlob });
  
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      toast.error("No recording to save");
      return;
    }
    
    if (!user) {
      toast.error("Please sign in to save entries");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      console.log("Processing recording with blob size:", audioBlob.size);
      console.log("Audio blob type:", audioBlob.type);
      
      const result = await processRecording(audioBlob, user?.id);
      
      if (result.success && onRecordingComplete) {
        onRecordingComplete(audioBlob, result.tempId);
      } else if (!result.success) {
        toast.error(result.error || "Failed to process recording");
      }
    } catch (error) {
      console.error("Error in handleSaveEntry:", error);
      toast.error("Failed to save entry. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Automatically request permissions on component mount
  useEffect(() => {
    if (hasPermission === null) {
      requestPermissions();
    }
  }, [hasPermission, requestPermissions]);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <audio ref={audioRef} className="hidden" />
      
      <div className="flex items-center justify-center mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            checked={noiseReduction}
            onChange={() => setNoiseReduction(!noiseReduction)}
            disabled={isRecording}
          />
          <div className={`h-5 w-10 rounded-full transition-colors ${noiseReduction ? 'bg-primary' : 'bg-gray-300'} relative`}>
            <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${noiseReduction ? 'translate-x-5' : ''}`} />
          </div>
          <span className="ml-2 text-sm">Noise Reduction</span>
        </label>
      </div>
      
      <RecordingVisualizer 
        isRecording={isRecording}
        audioLevel={audioLevel}
        ripples={ripples}
      />
      
      <RecordingButton
        isRecording={isRecording}
        isProcessing={isProcessing}
        hasPermission={hasPermission}
        onRecordingStart={startRecording}
        onRecordingStop={stopRecording}
        onPermissionRequest={requestPermissions}
      />
      
      <AnimatePresence mode="wait">
        {isRecording ? (
          <RecordingStatus 
            isRecording={isRecording} 
            recordingTime={recordingTime} 
          />
        ) : audioBlob ? (
          <PlaybackControls
            audioBlob={audioBlob}
            isPlaying={isPlaying}
            isProcessing={isProcessing}
            playbackProgress={playbackProgress}
            audioDuration={audioDuration}
            onTogglePlayback={togglePlayback}
            onSaveEntry={handleSaveEntry}
          />
        ) : hasPermission === false ? (
          <motion.p
            key="permission"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center text-muted-foreground"
          >
            Microphone access is required for recording
          </motion.p>
        ) : (
          <motion.p
            key="instruction"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center text-muted-foreground"
          >
            Tap the microphone to start recording
          </motion.p>
        )}
      </AnimatePresence>
      
      {isProcessing && (
        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing with AI...</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

export default VoiceRecorder;
