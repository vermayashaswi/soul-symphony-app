
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRecordRTCRecorder } from '@/hooks/use-recordrtc-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { normalizeAudioBlob } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import FloatingLanguages from '@/components/voice-recorder/FloatingLanguages';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { useNavigate } from 'react-router-dom';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, tempId?: string) => void;
  onCancel?: () => void;
  className?: string;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className }: VoiceRecorderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [showAnimation, setShowAnimation] = useState(true);
  const { user, forceRefreshAuth } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  
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

  const checkAuthBeforeSaving = useCallback(async () => {
    if (!user) {
      try {
        const authValid = await forceRefreshAuth();
        if (!authValid) {
          console.error("[VoiceRecorder] Auth validation failed before saving");
          toast.error("Session expired. Please refresh and try again.");
          return false;
        }
        return true;
      } catch (error) {
        console.error("[VoiceRecorder] Auth refresh error:", error);
        toast.error("Authentication error. Please refresh and try again.");
        return false;
      }
    }
    return true;
  }, [user, forceRefreshAuth]);

  useEffect(() => {
    if (isRecording) {
      setRecordingError(null);
    }
  }, [isRecording]);
  
  useEffect(() => {
    if (isRecording && recordingTime >= 120) {
      toast.warning("Your recording is quite long. Consider stopping now for better processing.", {
        duration: 3000,
      });
    }
  }, [isRecording, recordingTime]);
  
  useEffect(() => {
    if (isRecording) {
      setShowAnimation(true);
    } else if (audioBlob) {
      setShowAnimation(false);
    }
  }, [isRecording, audioBlob]);
  
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      setRecordingError("No audio recording available");
      return;
    }
    
    try {
      setIsProcessing(true);
      setRecordingError(null);
      
      const isAuthValid = await checkAuthBeforeSaving();
      if (!isAuthValid) {
        setIsProcessing(false);
        setRecordingError("Authentication error. Please refresh the page and try again.");
        return;
      }
      
      const normalizedBlob = normalizeAudioBlob(audioBlob);
      
      console.log('Processing audio:', {
        type: normalizedBlob.type,
        size: normalizedBlob.size,
        duration: audioDuration,
        recordingTime: recordingTime
      });
      
      if (onRecordingComplete) {
        // Call the completion handler but with a try/catch to prevent navigation issues
        try {
          console.log("Calling onRecordingComplete callback");
          onRecordingComplete(normalizedBlob);
          
          // If we're on the root route and not in a child component, navigate to journal
          if (window.location.pathname === '/') {
            console.log("Navigating to journal page");
            setTimeout(() => {
              navigate('/journal');
            }, 1000);
          }
        } catch (error) {
          console.error("Error in recording complete callback:", error);
          toast.error("Error processing your recording");
          setIsProcessing(false);
          throw error; // Rethrow to be caught by outer catch
        }
      } else {
        // If no callback is provided, we're done
        setIsProcessing(false);
        toast.success("Recording saved successfully");
        
        // If we're on the root route, navigate to journal
        if (window.location.pathname === '/') {
          console.log("Navigating to journal page");
          setTimeout(() => {
            navigate('/journal');
          }, 1000);
        }
      }
    } catch (error: any) {
      console.error('Error in save entry:', error);
      setRecordingError(error?.message || "An unexpected error occurred");
      toast.error("Error saving recording");
      setIsProcessing(false);
    }
  };

  const handleRestart = () => {
    resetRecording();
    resetPlayback();
    setRecordingError(null);
    setShowAnimation(true);
    toast.info("Starting a new recording");
  };

  return (
    <div className={cn("flex flex-col items-center relative z-10 w-full mb-[1rem]", className)}>
      <audio ref={audioRef} className="hidden" />
      
      <div className={cn(
        "relative w-full h-full flex flex-col items-center justify-between overflow-hidden rounded-2xl border border-slate-200/20",
        isMobile ? "min-h-[calc(80vh-160px)]" : "min-h-[500px]"
      )}>
        {showAnimation && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center">
            <FloatingLanguages size="md" />
          </div>
        )}
        
        <div className="relative z-10 flex flex-col items-center justify-start w-full h-full pt-20">
          <div className="relative z-10 flex justify-center items-center mt-40">
            <RecordingButton
              isRecording={isRecording}
              isProcessing={isProcessing}
              hasPermission={hasPermission}
              onRecordingStart={() => {
                startRecording();
              }}
              onRecordingStop={stopRecording}
              onPermissionRequest={requestPermissions}
              audioLevel={audioLevel}
              showAnimation={false}
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
                  onRestart={handleRestart}
                />
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
              <span>Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceRecorder;
