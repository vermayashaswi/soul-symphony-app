import React, { useState, useRef, useEffect } from 'react';
import { Mic, ArrowUp, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useAuth } from '@/contexts/AuthContext';
import { processChatVoiceRecording } from '@/utils/chat-audio-processing';
import { normalizeAudioBlob, validateAudioBlob, blobToBase64 } from '@/utils/audio/blob-utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MovingWaveform } from '@/components/voice-recorder/MovingWaveform';

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
  const [audioLevel, setAudioLevel] = useState(0);
  const { user } = useAuth();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  
  const {
    status,
    startRecording,
    stopRecording,
    clearRecording,
    elapsedTimeMs
  } = useVoiceRecorder({
    onRecordingComplete: handleRecordingComplete,
    onError: (error) => {
      console.error('[VoiceChatRecorder] Recording error:', error);
      setRecordingState('error');
      toast.error('Recording failed. Please try again.');
      setTimeout(() => setRecordingState('idle'), 2000);
    },
    maxDuration: 120
  });

  // Real-time audio level detection
  const setupAudioAnalysis = async (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255); // Normalize to 0-1
          
          if (status === 'recording') {
            animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
          }
        }
      };
      
      updateAudioLevel();
    } catch (error) {
      console.warn('Audio analysis setup failed:', error);
    }
  };

  const cleanupAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  async function handleRecordingComplete(audioBlob: Blob) {
    if (!user?.id) {
      toast.error('Please sign in to use voice recording');
      return;
    }

    try {
      setRecordingState('processing');
      cleanupAudioAnalysis();
      
      console.log('[VoiceChatRecorder] Starting chat transcription with blob:', {
        size: audioBlob.size,
        type: audioBlob.type,
        hasDuration: 'duration' in audioBlob
      });
      
      // Add the same validation and normalization as journal
      const validation = validateAudioBlob(audioBlob);
      if (!validation.isValid) {
        throw new Error(validation.errorMessage || 'Invalid audio data');
      }
      
      // Normalize the audio blob
      let normalizedBlob: Blob;
      try {
        normalizedBlob = await normalizeAudioBlob(audioBlob);
        console.log('[VoiceChatRecorder] Audio blob normalized:', {
          type: normalizedBlob.type,
          size: normalizedBlob.size,
          hasDuration: 'duration' in normalizedBlob
        });
      } catch (error) {
        console.error('[VoiceChatRecorder] Error normalizing audio:', error);
        throw new Error('Error processing audio. Please try again.');
      }
      
      // Test base64 conversion
      try {
        const base64Test = await blobToBase64(normalizedBlob);
        console.log('[VoiceChatRecorder] Base64 test successful, length:', base64Test.length);
        
        if (base64Test.length < 50) {
          throw new Error('Audio data appears too short or invalid');
        }
      } catch (error) {
        console.error('[VoiceChatRecorder] Base64 test failed:', error);
        throw new Error('Error preparing audio for processing');
      }
      
      // Use chat-specific processing - no journal entries
      const result = await processChatVoiceRecording(normalizedBlob, user.id);
      
      if (result.success && result.transcription) {
        console.log('[VoiceChatRecorder] Chat transcription successful:', result.transcription);
        onTranscriptionComplete(result.transcription.trim());
        clearRecording();
        setRecordingState('idle');
      } else {
        throw new Error(result.error || 'Failed to transcribe audio');
      }
    } catch (error: any) {
      console.error('[VoiceChatRecorder] Processing error:', error);
      setRecordingState('error');
      toast.error(`Transcription failed: ${error.message}`);
      setTimeout(() => setRecordingState('idle'), 2000);
    }
  }

  const handleStartRecording = async () => {
    try {
      setRecordingState('recording');
      
      // Get user media for audio analysis
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setupAudioAnalysis(stream);
      
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
    cleanupAudioAnalysis();
  };

  const handleCancelRecording = () => {
    stopRecording();
    clearRecording();
    cleanupAudioAnalysis();
    setRecordingState('idle');
  };

  // Update state based on recording status
  useEffect(() => {
    if (status === 'recording' && recordingState !== 'recording') {
      setRecordingState('recording');
    }
  }, [status, recordingState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioAnalysis();
    };
  }, []);

  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';
  const isError = recordingState === 'error';

  return (
    <div className={cn("relative", className)}>
      {/* Recording Overlay - Full Screen When Recording */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
          >
            {/* Header with Cancel */}
            <div className="absolute top-6 left-0 right-0 flex justify-between items-center px-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelRecording}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-5 w-5" />
              </Button>
              <span className="text-sm text-muted-foreground">Recording...</span>
              <div className="w-10" /> {/* Spacer for centering */}
            </div>

            {/* Main Recording Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 w-full max-w-md">
              {/* Moving Waveform */}
              <div className="w-full mb-8">
                <MovingWaveform 
                  isRecording={isRecording} 
                  audioLevel={audioLevel} 
                />
              </div>
              
              {/* Timer */}
              <div className="text-2xl font-mono text-foreground mb-8">
                {Math.floor(elapsedTimeMs / 60000).toString().padStart(2, '0')}:
                {Math.floor((elapsedTimeMs % 60000) / 1000).toString().padStart(2, '0')}
              </div>
              
              {/* Stop/Send Button */}
              <Button
                size="lg"
                onClick={handleStopRecording}
                className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
              >
                <ArrowUp className="h-6 w-6" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background border border-input rounded-md flex items-center justify-center z-20"
          >
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Processing audio...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Microphone Button - Only visible when idle, positioned absolutely on the right */}
      {recordingState === 'idle' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleStartRecording}
          disabled={isDisabled}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground z-10"
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
