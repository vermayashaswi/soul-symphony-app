import React, { useState, useEffect } from 'react';
import { Loader2, ChevronRight, AlertTriangle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRecordRTCRecorder } from '@/hooks/use-recordrtc-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { processRecording } from '@/utils/audio-processing';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingVisualizer } from '@/components/voice-recorder/RecordingVisualizer';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { MultilingualTextAnimation } from '@/components/voice-recorder/MultilingualTextAnimation';
import { normalizeAudioBlob } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, tempId?: string) => void;
  onCancel?: () => void;
  className?: string;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className }: VoiceRecorderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
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
    requestPermissions,
    resetRecording
  } = useRecordRTCRecorder({ 
    noiseReduction: false,
    maxDuration: 300
  });
  
  const {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    audioRef,
    reset: resetPlayback
  } = useAudioPlayback({ audioBlob });

  useEffect(() => {
    if (isRecording) {
      setRecordingError(null);
    }
  }, [isRecording]);
  
  useEffect(() => {
    if (isRecording && recordingTime >= 120) {
      toast.warning("Your recording is quite long. Consider stopping now for better processing.");
    }
  }, [isRecording, recordingTime]);
  
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      setRecordingError("No audio recording available");
      return;
    }
    
    if (audioDuration < 0.5) {
      setRecordingError("Recording is too short. Please try again.");
      return;
    }
    
    try {
      setIsProcessing(true);
      setRecordingError(null);
      
      const normalizedBlob = normalizeAudioBlob(audioBlob);
      
      console.log('Processing audio:', {
        type: normalizedBlob.type,
        size: normalizedBlob.size,
        duration: audioDuration,
        recordingTime: recordingTime
      });
      
      const result = await processRecording(normalizedBlob, user?.id);
      
      if (result.success && onRecordingComplete) {
        onRecordingComplete(normalizedBlob, result.tempId);
        toast.success("Recording saved and processing began!");
      } else if (!result.success) {
        setRecordingError(result.error || "Failed to process recording");
        toast.error(result.error || "Failed to process recording");
      }
    } catch (error: any) {
      console.error('Error in save entry:', error);
      setRecordingError(error?.message || "An unexpected error occurred");
      toast.error("Error saving recording: " + (error?.message || "An unexpected error occurred"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestart = () => {
    resetRecording();
    resetPlayback();
    setRecordingError(null);
    toast.info("Recording discarded. Ready to start a new recording.");
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <audio ref={audioRef} className="hidden" />
      
      <RecordingVisualizer 
        isRecording={isRecording}
        audioLevel={audioLevel}
        ripples={ripples}
      />
      
      {!isRecording && !audioBlob && hasPermission !== false && (
        <MultilingualTextAnimation />
      )}
      
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
          <div className="flex flex-col items-center w-full">
            <PlaybackControls
              audioBlob={audioBlob}
              isPlaying={isPlaying}
              isProcessing={isProcessing}
              playbackProgress={playbackProgress}
              audioDuration={audioDuration}
              onTogglePlayback={togglePlayback}
              onSaveEntry={handleSaveEntry}
            />
            
            <Button
              onClick={handleRestart}
              variant="outline"
              className="mt-4 flex items-center gap-2"
              disabled={isProcessing}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start Over</span>
            </Button>
          </div>
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
      
      {recordingError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>{recordingError}</div>
        </motion.div>
      )}
      
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
