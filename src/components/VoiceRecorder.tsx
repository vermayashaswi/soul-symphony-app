
import React, { useState, useEffect } from 'react';
import { Loader2, ChevronRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { processRecording } from '@/utils/audio-processing';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingVisualizer } from '@/components/voice-recorder/RecordingVisualizer';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { normalizeAudioBlob } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, tempId?: string) => void;
  onCancel?: () => void;
  className?: string;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className }: VoiceRecorderProps) {
  const [noiseReduction, setNoiseReduction] = useState(true);
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
    requestPermissions
  } = useVoiceRecorder({ noiseReduction });
  
  const {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    audioRef
  } = useAudioPlayback({ audioBlob });

  // Clear recording error when starting a new recording
  useEffect(() => {
    if (isRecording) {
      setRecordingError(null);
    }
  }, [isRecording]);
  
  // Minimum recording time check
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
      
      // Normalize the audio blob to ensure proper MIME type
      const normalizedBlob = normalizeAudioBlob(audioBlob);
      
      // Log detailed info about the audio
      console.log('Processing audio:', {
        type: normalizedBlob.type,
        size: normalizedBlob.size,
        duration: audioDuration
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
