import React, { useState, useEffect } from 'react';
import { Loader2, ChevronRight, AlertTriangle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRecordRTCRecorder } from '@/hooks/use-recordrtc-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { processRecording } from '@/utils/audio-processing';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { normalizeAudioBlob } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import FloatingLanguages from '@/components/voice-recorder/FloatingLanguages';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, tempId?: string) => void;
  onCancel?: () => void;
  className?: string;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className }: VoiceRecorderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [showAnimation, setShowAnimation] = useState(true); // Always show animation by default
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
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

  // Only hide animation when actively recording
  useEffect(() => {
    if (isRecording) {
      setShowAnimation(false);
    }
  }, [isRecording]);

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
    <div className={cn("flex flex-col items-center relative z-10 w-full mb-[1rem]", className)}>
      <audio ref={audioRef} className="hidden" />
      
      <div className={cn(
        "relative w-full h-full flex flex-col items-center justify-between overflow-hidden rounded-2xl border border-slate-200/20",
        isMobile ? "min-h-[calc(80vh-160px)]" : "min-h-[500px]"
      )}>
        <div className="absolute inset-0 flex items-center justify-center">
          {showAnimation && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center">
              <FloatingLanguages size="md" />
            </div>
          )}
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-start w-full h-full pt-20">
          <div className="relative z-10 flex justify-center items-center mt-40">
            <RecordingButton
              isRecording={isRecording}
              isProcessing={isProcessing}
              hasPermission={hasPermission}
              onRecordingStart={() => {
                setShowAnimation(false);
                startRecording();
              }}
              onRecordingStop={stopRecording}
              onPermissionRequest={requestPermissions}
              audioLevel={audioLevel}
              showAnimation={true} // Always show animation in the button
            />
          </div>

          <AnimatePresence mode="wait">
            {isRecording ? (
              <RecordingStatus 
                isRecording={isRecording} 
                recordingTime={recordingTime} 
              />
            ) : audioBlob ? (
              <div className="flex flex-col items-center w-full relative z-10 mt-auto mb-8">
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
                  className="mt-3 flex items-center gap-2 bg-background/80 backdrop-blur-sm"
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
                className="text-center text-muted-foreground relative z-10 mt-auto mb-8"
              >
                Microphone access is required for recording
              </motion.p>
            ) : (
              <></>
            )}
          </AnimatePresence>
          
          {recordingError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2 relative z-10 absolute bottom-8"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>{recordingError}</div>
            </motion.div>
          )}
          
          {isProcessing && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground relative z-10 absolute bottom-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing with AI...</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceRecorder;
