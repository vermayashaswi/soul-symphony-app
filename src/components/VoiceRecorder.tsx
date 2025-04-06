
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRecordRTCRecorder } from '@/hooks/use-recordrtc-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { normalizeAudioBlob } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import FloatingLanguages from '@/components/voice-recorder/FloatingLanguages';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { clearAllToasts } from '@/services/notificationService';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, tempId?: string) => void;
  onCancel?: () => void;
  className?: string;
  updateDebugInfo?: (info: {status: string, duration?: number}) => void;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className, updateDebugInfo }: VoiceRecorderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [showAnimation, setShowAnimation] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [audioPrepared, setAudioPrepared] = useState(false);
  const saveCompleteRef = useRef(false);
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
    reset: resetPlayback,
    seekTo,
    prepareAudio
  } = useAudioPlayback({ 
    audioBlob,
    onPlaybackStart: () => {
      console.log('[VoiceRecorder] Playback started');
      setHasPlayedOnce(true);
    },
    onPlaybackEnd: () => {
      console.log('[VoiceRecorder] Playback ended');
    }
  });

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
  
  // When we get an audio blob, prepare audio to ensure duration is loaded
  useEffect(() => {
    if (audioBlob && !audioPrepared) {
      console.log('[VoiceRecorder] New audio blob detected, preparing audio...');
      prepareAudio().then(duration => {
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        setAudioPrepared(true);
      });
    }
  }, [audioBlob, audioPrepared, prepareAudio]);
  
  useEffect(() => {
    console.log('[VoiceRecorder] State update:', {
      isProcessing,
      hasAudioBlob: !!audioBlob,
      audioSize: audioBlob?.size || 0,
      isRecording,
      hasPermission,
      audioDuration,
      hasSaved,
      hasPlayedOnce,
      audioPrepared
    });
    
    if (updateDebugInfo) {
      updateDebugInfo({
        status: isRecording 
          ? 'Recording' 
          : (audioBlob ? 'Recorded' : 'No Recording'),
        duration: audioDuration || recordingTime
      });
    }
  }, [isProcessing, audioBlob, isRecording, hasPermission, audioDuration, hasSaved, hasPlayedOnce, recordingTime, audioPrepared, updateDebugInfo]);
  
  useEffect(() => {
    return () => {
      console.log('[VoiceRecorder] Component unmounting, resetting state');
      
      if (isProcessing && !saveCompleteRef.current) {
        console.warn('[VoiceRecorder] Component unmounted during processing - potential source of UI errors');
      }
      
      // Clear all toasts when component unmounts to prevent lingering toasts
      clearAllToasts();
    };
  }, [isProcessing]);
  
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      setRecordingError("No audio recording available");
      return;
    }
    
    if (hasSaved) {
      console.log('[VoiceRecorder] Already saved this recording, ignoring duplicate save request');
      return;
    }
    
    try {
      console.log('[VoiceRecorder] Starting save process');
      setIsProcessing(true);
      setRecordingError(null);
      setHasSaved(true);
      
      // Clear existing toasts to prevent interference with save process
      clearAllToasts();
      
      // If recording hasn't been played, ensure audio is prepared
      if (!hasPlayedOnce || audioDuration === 0) {
        console.log('[VoiceRecorder] Recording not played yet, preparing audio...');
        const duration = await prepareAudio();
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        setAudioPrepared(true);
        
        if (duration < 0.5) {
          setRecordingError("Recording is too short. Please try again.");
          setIsProcessing(false);
          setHasSaved(false);
          return;
        }
      } else if (audioDuration < 0.5) {
        setRecordingError("Recording is too short. Please try again.");
        setIsProcessing(false);
        setHasSaved(false);
        return;
      }
      
      const normalizedBlob = normalizeAudioBlob(audioBlob);
      
      console.log('[VoiceRecorder] Processing audio:', {
        type: normalizedBlob.type,
        size: normalizedBlob.size,
        duration: audioDuration,
        recordingTime: recordingTime,
        hasPlayedOnce: hasPlayedOnce,
        audioPrepared: audioPrepared
      });
      
      // If the recording hasn't been played yet, we'll initialize audioDuration 
      // based on recording time to ensure proper UI transitions
      if (!hasPlayedOnce && audioDuration === 0 && recordingTime > 0) {
        // Convert recordingTime from milliseconds to seconds for consistency with audioDuration
        const estimatedDuration = recordingTime / 1000;
        console.log(`[VoiceRecorder] Recording not played yet, estimating duration as ${estimatedDuration}s`);
      }
      
      if (onRecordingComplete) {
        try {
          console.log('[VoiceRecorder] Calling recording completion callback');
          saveCompleteRef.current = false;
          
          // Show a toast independent of the save process
          toast.loading('Processing your journal entry...', {
            id: 'processing-toast',
            duration: 3000
          });
          
          await onRecordingComplete(normalizedBlob);
          
          saveCompleteRef.current = true;
          
          console.log('[VoiceRecorder] Recording callback completed successfully');
          
          // Dismiss the loading toast to avoid lingering UI elements
          toast.dismiss('processing-toast');
        } catch (error: any) {
          console.error('[VoiceRecorder] Error in recording callback:', error);
          setRecordingError(error?.message || "An unexpected error occurred");
          
          // Dismiss any loading toasts
          toast.dismiss('processing-toast');
          
          toast.error("Error saving recording", {
            id: 'error-toast',
            duration: 3000
          });
          
          setIsProcessing(false);
          setHasSaved(false);
        }
      }
    } catch (error: any) {
      console.error('[VoiceRecorder] Error in save entry:', error);
      setRecordingError(error?.message || "An unexpected error occurred");
      
      toast.error("Error saving recording", {
        id: 'error-toast',
        duration: 3000
      });
      
      setIsProcessing(false);
      setHasSaved(false);
    }
  };

  const handleRestart = () => {
    // Clear all toasts when restarting to avoid UI conflicts
    clearAllToasts();
    
    resetRecording();
    resetPlayback();
    setRecordingError(null);
    setShowAnimation(true);
    setIsProcessing(false);
    setHasSaved(false);
    setHasPlayedOnce(false);
    setAudioPrepared(false);
    saveCompleteRef.current = false;
    
    toast.info("Starting a new recording", {
      duration: 2000
    });
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
                console.log('[VoiceRecorder] Starting new recording');
                startRecording();
              }}
              onRecordingStop={() => {
                console.log('[VoiceRecorder] Stopping recording');
                stopRecording();
              }}
              onPermissionRequest={() => {
                console.log('[VoiceRecorder] Requesting permissions');
                requestPermissions();
              }}
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
                  onSaveEntry={() => {
                    console.log('[VoiceRecorder] Save button clicked');
                    handleSaveEntry();
                  }}
                  onRestart={handleRestart}
                  onSeek={seekTo}
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
