
import React, { useState, useRef, useEffect } from 'react';
import { Mic, ArrowUp, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { RecordingVisualizer } from '@/components/voice-recorder/RecordingVisualizer';
import { TranscriptionService } from '@/utils/audio/transcription-service';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/format-time';
import { toast } from 'sonner';

type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

interface VoiceChatRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  isDisabled?: boolean;
  className?: string;
}

export function VoiceChatRecorder({ 
  onTranscriptionComplete, 
  isDisabled = false,
  className 
}: VoiceChatRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const { user } = useAuth();
  
  const {
    status,
    startRecording,
    stopRecording,
    clearRecording,
    recordingBlob,
    recordingTime,
    elapsedTimeMs
  } = useVoiceRecorder({
    onRecordingComplete: handleRecordingComplete,
    onError: (error) => {
      console.error('[VoiceChatRecorder] Recording error:', error);
      setRecordingState('error');
      toast.error('Recording failed. Please try again.');
      setTimeout(() => setRecordingState('idle'), 2000);
    },
    maxDuration: 120 // 2 minutes max for chat
  });

  async function handleRecordingComplete(audioBlob: Blob) {
    if (!user?.id) {
      toast.error('Please sign in to use voice recording');
      return;
    }

    try {
      setRecordingState('processing');
      
      const transcriptionService = new TranscriptionService(
        import.meta.env.VITE_SUPABASE_URL,
        user.id
      );

      const result = await transcriptionService.transcribeAudio(audioBlob, {
        directTranscription: true,
        highQuality: true,
        recordingTime: elapsedTimeMs
      });

      if (result.transcription && result.transcription.trim()) {
        onTranscriptionComplete(result.transcription.trim());
        clearRecording();
        setRecordingState('idle');
      } else {
        throw new Error('No transcription received');
      }
    } catch (error) {
      console.error('[VoiceChatRecorder] Transcription error:', error);
      setRecordingState('error');
      toast.error('Failed to transcribe audio. Please try again.');
      setTimeout(() => setRecordingState('idle'), 2000);
    }
  }

  const handleStartRecording = async () => {
    try {
      setRecordingState('recording');
      await startRecording();
    } catch (error) {
      console.error('[VoiceChatRecorder] Failed to start recording:', error);
      setRecordingState('error');
      toast.error('Failed to start recording. Please check microphone permissions.');
      setTimeout(() => setRecordingState('idle'), 2000);
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleCancelRecording = () => {
    stopRecording();
    clearRecording();
    setRecordingState('idle');
  };

  // Update state based on recording status
  useEffect(() => {
    if (status === 'recording' && recordingState !== 'recording') {
      setRecordingState('recording');
    }
  }, [status, recordingState]);

  const isRecording = status === 'recording';
  const isProcessing = recordingState === 'processing';
  const isError = recordingState === 'error';

  return (
    <div className={cn("relative", className)}>
      {/* Recording Waveform Overlay */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-md border border-border flex items-center px-3 z-10"
          >
            {/* Cancel Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelRecording}
              className="mr-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Waveform */}
            <div className="flex-1 h-8 flex items-center">
              <RecordingVisualizer
                isRecording={isRecording}
                audioLevel={Math.random() * 100} // Simplified for chat
                ripples={[]}
                fullWidth={true}
              />
            </div>

            {/* Recording Time */}
            <div className="ml-2 text-xs text-muted-foreground font-mono">
              {formatTime(elapsedTimeMs)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Recording Button */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        disabled={isDisabled || isProcessing || isError}
        className={cn(
          "h-10 w-10 rounded-full shrink-0 transition-colors",
          isRecording && "bg-red-500 hover:bg-red-600 text-white",
          isProcessing && "bg-blue-500 text-white",
          isError && "bg-red-500 text-white"
        )}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <ArrowUp className="h-4 w-4" />
        ) : isError ? (
          <X className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
