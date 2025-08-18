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

type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

interface VoiceChatRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  isDisabled?: boolean;
  className?: string;
}

interface RecordingOverlayProps {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  onCancel: () => void;
  onStop: () => void;
}

interface AudioVisualizerProps {
  isRecording: boolean;
  audioLevel: number;
}

// Real-time audio visualizer component
function AudioVisualizer({ isRecording, audioLevel }: AudioVisualizerProps) {
  const bars = Array.from({ length: 40 });
  
  return (
    <div className="flex items-center justify-center h-8 space-x-0.5 flex-1">
      {bars.map((_, i) => {
        const baseHeight = Math.sin((i / 40) * Math.PI * 2) * 20 + 10;
        const height = isRecording 
          ? Math.max(4, baseHeight + (audioLevel * 0.5)) 
          : Math.max(4, baseHeight * 0.3);
          
        return (
          <motion.div
            key={i}
            className="w-0.5 bg-primary rounded-full"
            initial={{ height: 4 }}
            animate={{ 
              height: isRecording 
                ? [height * 0.5, height, height * 0.7, height * 0.9, height * 0.6] 
                : [4, 8, 6]
            }}
            transition={{
              duration: isRecording ? 0.8 : 1.5,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
              delay: i * 0.03
            }}
            style={{
              opacity: isRecording ? 0.8 : 0.4
            }}
          />
        );
      })}
    </div>
  );
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
    cancelRecording,
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
          setAudioLevel(average);
          
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
    console.log('[VoiceChatRecorder] Cancelling recording');
    cancelRecording(); // Use the new cancel method instead of stop
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
    <>
      {/* Recording Overlay - Positioned to cover the entire input container */}
      <AnimatePresence>
        {(isRecording || isProcessing) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-x-3 top-1/2 transform -translate-y-1/2 bg-background border border-input rounded-md flex items-center z-50 h-10"
            style={{ left: '12px', right: '12px' }}
          >
            {isRecording ? (
              <>
                {/* Cancel Button (X) */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelRecording}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0 ml-1"
                >
                  <X className="h-4 w-4" />
                </Button>

                {/* Waveform Visualization */}
                <div className="flex-1 mx-2">
                  <AudioVisualizer isRecording={isRecording} audioLevel={audioLevel} />
                </div>

                {/* Stop/Send Button (Up Arrow) */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStopRecording}
                  className="h-8 w-8 p-0 text-primary hover:text-primary/80 shrink-0 mr-1"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </>
            ) : (
              /* Processing state */
              <div className="flex items-center justify-center w-full space-x-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Processing audio...</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Microphone Button - Only visible when idle */}
      <div className={cn("relative", className)}>
        {recordingState === 'idle' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleStartRecording}
            disabled={isDisabled}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}
      </div>
    </>
  );
}
