import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { normalizeAudioBlob, validateAudioBlob } from '@/utils/audio/blob-utils';
import { blobToBase64 } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import FloatingLanguages from '@/components/voice-recorder/FloatingLanguages';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { AnimatedPrompt } from '@/components/voice-recorder/AnimatedPrompt';
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';

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
  const [waitingForClear, setWaitingForClear] = useState(false);
  const [toastsCleared, setToastsCleared] = useState(false);
  
  // Refs to track processing state and prevent race conditions
  const saveCompleteRef = useRef(false);
  const savingInProgressRef = useRef(false);
  const domClearAttemptedRef = useRef(false);
  const saveStartTimeRef = useRef<number | null>(null);
  
  const { user } = useAuth();
  const { isMobile } = useIsMobile();
  
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
  } = useAudioRecorder({ 
    noiseReduction: false,
    maxDuration: 300
  });
  
  const {
    isPlaying,
    playbackProgress,
    audioDuration,
    audioRef,
    togglePlayback,
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

  // Clear toasts on component mount with retry mechanism
  useEffect(() => {
    // Helper function to clear toasts with retries
    const clearToastsWithRetry = async (retryCount = 0): Promise<void> => {
      try {
        console.log(`[VoiceRecorder] Clearing toasts attempt ${retryCount + 1}`);
        await ensureAllToastsCleared();
        setToastsCleared(true);
      } catch (err) {
        console.error(`[VoiceRecorder] Error clearing toasts on attempt ${retryCount + 1}:`, err);
        if (retryCount < 2) {
          console.log(`[VoiceRecorder] Retrying toast clear in 100ms...`);
          setTimeout(() => clearToastsWithRetry(retryCount + 1), 100);
        } else {
          console.log(`[VoiceRecorder] Max toast clear attempts reached, continuing anyway`);
          setToastsCleared(true);
        }
      }
    };
    
    // Attempt to clear toasts
    clearToastsWithRetry();
    
    // Cleanup on unmount
    return () => {
      try {
        console.log('[VoiceRecorder] Component unmounting, cleaning up toasts');
        clearAllToasts().catch(e => console.warn('[VoiceRecorder] Cleanup error:', e));
      } catch (err) {
        console.error('[VoiceRecorder] Error in unmount cleanup:', err);
      }
    };
  }, []);

  // Reset recording error when recording starts
  useEffect(() => {
    if (isRecording) {
      setRecordingError(null);
    }
  }, [isRecording]);
  
  // Show warning for long recordings
  useEffect(() => {
    if (isRecording && recordingTime >= 120000) {
      try {
        toast.warning("Your recording is quite long. Consider stopping now for better processing.", {
          duration: 3000,
        });
      } catch (e) {
        console.warn('[VoiceRecorder] Error showing warning toast:', e);
      }
    }
  }, [isRecording, recordingTime]);
  
  // Control animation visibility
  useEffect(() => {
    if (isRecording) {
      setShowAnimation(true);
    } else if (audioBlob) {
      setShowAnimation(false);
    }
  }, [isRecording, audioBlob]);
  
  // Prepare audio for playback when a new blob is available
  useEffect(() => {
    if (audioBlob && !audioPrepared) {
      console.log('[VoiceRecorder] New audio blob detected, preparing audio...');
      
      prepareAudio().then(duration => {
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        setAudioPrepared(true);
      }).catch(error => {
        console.error('[VoiceRecorder] Error preparing audio:', error);
      });
    }
  }, [audioBlob, audioPrepared, prepareAudio]);
  
  // Debug logging for component state
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
      audioPrepared,
      waitingForClear,
      toastsCleared,
      saveInProgress: savingInProgressRef.current,
      saveComplete: saveCompleteRef.current,
      saveStartTime: saveStartTimeRef.current ? new Date(saveStartTimeRef.current).toISOString() : null,
      saveElapsedTime: saveStartTimeRef.current ? Date.now() - saveStartTimeRef.current : null
    });
    
    if (updateDebugInfo) {
      updateDebugInfo({
        status: isRecording 
          ? 'Recording' 
          : (audioBlob ? (isProcessing ? 'Processing' : 'Recorded') : 'No Recording'),
        duration: audioDuration || (recordingTime / 1000)
      });
    }
  }, [isProcessing, audioBlob, isRecording, hasPermission, audioDuration, hasSaved, hasPlayedOnce, recordingTime, 
       audioPrepared, waitingForClear, toastsCleared, updateDebugInfo]);
  
  // Add a recovery mechanism for stuck processing states
  useEffect(() => {
    // If processing has been going on for more than 30 seconds, it's probably stuck
    if (isProcessing && saveStartTimeRef.current) {
      const processingTime = Date.now() - saveStartTimeRef.current;
      if (processingTime > 30000) { // 30 seconds timeout
        console.warn('[VoiceRecorder] Processing appears stuck for over 30 seconds. Attempting recovery...');
        
        // Only try recovery if we haven't completed the save
        if (!saveCompleteRef.current) {
          console.log('[VoiceRecorder] Recovery: Re-attempting save completion...');
          if (audioBlob && onRecordingComplete) {
            try {
              console.log('[VoiceRecorder] Recovery: Calling onRecordingComplete directly...');
              onRecordingComplete(audioBlob);
              saveCompleteRef.current = true;
              console.log('[VoiceRecorder] Recovery: Backup save attempt completed');
            } catch (err) {
              console.error('[VoiceRecorder] Recovery: Backup save attempt failed:', err);
            }
          }
        }
        
        // Regardless, reset UI state to prevent being stuck
        setIsProcessing(false);
        savingInProgressRef.current = false;
        
        console.log('[VoiceRecorder] Recovery: Processing state reset');
      }
    }
    
    return () => {
      if (isProcessing && !saveCompleteRef.current) {
        console.warn('[VoiceRecorder] Component unmounting during processing - potential source of UI errors');
      }
    };
  }, [isProcessing, audioBlob, onRecordingComplete]);
  
  // The save entry handler with improved robustness
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      setRecordingError("No audio recording available");
      return;
    }
    
    if (hasSaved || savingInProgressRef.current) {
      console.log('[VoiceRecorder] Already saved this recording or save in progress, ignoring duplicate save request');
      return;
    }
    
    try {
      console.log('[VoiceRecorder] Starting save process');
      savingInProgressRef.current = true;
      saveStartTimeRef.current = Date.now();
      
      // Set processing state IMMEDIATELY before any other operations
      setIsProcessing(true);
      setRecordingError(null);
      setHasSaved(true);
      
      // Clear toasts with explicit error handling and retries
      setWaitingForClear(true);
      try {
        console.log('[VoiceRecorder] Clearing toasts before processing');
        await ensureAllToastsCleared();
        console.log('[VoiceRecorder] Toasts cleared successfully');
      } catch (err) {
        console.error('[VoiceRecorder] Error clearing toasts before save, continuing anyway:', err);
      } finally {
        // Continue even if toast clearing failed
        setWaitingForClear(false);
        setToastsCleared(true);
      }
      
      // Add a small delay to ensure UI has updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Validate audio duration
      if (!hasPlayedOnce || audioDuration === 0) {
        console.log('[VoiceRecorder] Recording not played yet, preparing audio...');
        
        try {
          const duration = await prepareAudio();
          console.log('[VoiceRecorder] Audio prepared with duration:', duration);
          setAudioPrepared(true);
          
          if (duration < 0.5) {
            setRecordingError("Recording is too short. Please try again.");
            setIsProcessing(false);
            setHasSaved(false);
            savingInProgressRef.current = false;
            saveStartTimeRef.current = null;
            return;
          }
        } catch (prepareError) {
          console.error('[VoiceRecorder] Error preparing audio:', prepareError);
          // Continue anyway with duration estimation
        }
      } else if (audioDuration < 0.5) {
        setRecordingError("Recording is too short. Please try again.");
        setIsProcessing(false);
        setHasSaved(false);
        savingInProgressRef.current = false;
        saveStartTimeRef.current = null;
        return;
      }
      
      console.log('[VoiceRecorder] Normalizing audio blob before processing...');
      
      let normalizedBlob: Blob;
      try {
        normalizedBlob = await normalizeAudioBlob(audioBlob);
        console.log('[VoiceRecorder] Blob normalized successfully:', {
          type: normalizedBlob.type,
          size: normalizedBlob.size,
          hasDuration: 'duration' in normalizedBlob,
          duration: (normalizedBlob as any).duration || 'unknown'
        });
        
        const validation = validateAudioBlob(normalizedBlob);
        if (!validation.isValid) {
          throw new Error(validation.errorMessage || "Invalid audio data after normalization");
        }
      } catch (error) {
        console.error('[VoiceRecorder] Error normalizing audio blob:', error);
        setRecordingError("Error processing audio. Please try again.");
        setIsProcessing(false);
        setHasSaved(false);
        savingInProgressRef.current = false;
        saveStartTimeRef.current = null;
        return;
      }
      
      console.log('[VoiceRecorder] Processing audio:', {
        type: normalizedBlob.type,
        size: normalizedBlob.size,
        duration: audioDuration,
        recordingTime: recordingTime / 1000,
        hasPlayedOnce: hasPlayedOnce,
        audioPrepared: audioPrepared,
        blobHasDuration: 'duration' in normalizedBlob
      });
      
      // Ensure the blob has a duration property
      if (!('duration' in normalizedBlob)) {
        const estimatedDuration = recordingTime / 1000;
        console.log(`[VoiceRecorder] Adding estimated duration to blob: ${estimatedDuration}s`);
        
        try {
          Object.defineProperty(normalizedBlob, 'duration', {
            value: estimatedDuration > 0 ? estimatedDuration : 1, // Fallback to 1s if no duration
            writable: false
          });
        } catch (err) {
          console.warn("[VoiceRecorder] Could not add duration to blob:", err);
        }
      }
      
      if (onRecordingComplete) {
        try {
          console.log('[VoiceRecorder] Calling recording completion callback');
          saveCompleteRef.current = false;
          
          // Test base64 conversion first to catch any conversion errors early
          try {
            const base64Test = await blobToBase64(normalizedBlob);
            console.log('[VoiceRecorder] Base64 test conversion successful, length:', base64Test.length);
            
            if (base64Test.length < 50) {
              throw new Error('Audio data appears too short or invalid');
            }
          } catch (base64Error) {
            console.error('[VoiceRecorder] Base64 conversion test failed:', base64Error);
            throw new Error('Error preparing audio for processing');
          }
          
          console.log('[VoiceRecorder] Directly calling onRecordingComplete with blob');
          await onRecordingComplete(normalizedBlob);
          
          saveCompleteRef.current = true;
          console.log('[VoiceRecorder] Recording callback completed successfully');
        } catch (error: any) {
          console.error('[VoiceRecorder] Error in recording callback:', error);
          setRecordingError(error?.message || "An unexpected error occurred");
          
          try {
            toast.error("Error saving recording", {
              id: 'error-toast',
              duration: 3000
            });
          } catch (toastError) {
            console.error('[VoiceRecorder] Error showing error toast:', toastError);
          }
          
          setIsProcessing(false);
          setHasSaved(false);
        } finally {
          // Always clean up state
          savingInProgressRef.current = false;
          saveStartTimeRef.current = null;
        }
      }
    } catch (error: any) {
      console.error('[VoiceRecorder] Error in save entry:', error);
      setRecordingError(error?.message || "An unexpected error occurred");
      
      try {
        toast.error("Error saving recording", {
          id: 'error-toast',
          duration: 3000
        });
      } catch (toastError) {
        console.error('[VoiceRecorder] Error showing error toast:', toastError);
      }
      
      setIsProcessing(false);
      setHasSaved(false);
      savingInProgressRef.current = false;
      saveStartTimeRef.current = null;
    }
  };

  // Reset recorder for a new recording
  const handleRestart = async () => {
    try {
      await ensureAllToastsCleared();
    } catch (err) {
      console.error('[VoiceRecorder] Error clearing toasts during restart:', err);
    }
    
    resetRecording();
    resetPlayback();
    setRecordingError(null);
    setShowAnimation(true);
    setIsProcessing(false);
    setHasSaved(false);
    setHasPlayedOnce(false);
    setAudioPrepared(false);
    saveCompleteRef.current = false;
    savingInProgressRef.current = false;
    domClearAttemptedRef.current = false;
    saveStartTimeRef.current = null;
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      toast.info("Starting a new recording", {
        duration: 2000
      });
    } catch (toastError) {
      console.error('[VoiceRecorder] Error showing info toast during restart:', toastError);
    }
  };

  const shouldShowPrompt = !isRecording && !audioBlob;

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
        
        <div className="relative z-10 flex flex-col items-center justify-start w-full h-full pt-4">
          <AnimatedPrompt show={shouldShowPrompt} />
          
          <div className="relative z-10 flex justify-center items-center mt-40">
            <RecordingButton
              isRecording={isRecording}
              isProcessing={isProcessing}
              hasPermission={hasPermission}
              onRecordingStart={async () => {
                console.log('[VoiceRecorder] Starting new recording');
                try {
                  await ensureAllToastsCleared();
                } catch (err) {
                  console.error('[VoiceRecorder] Error clearing toasts before recording:', err);
                }
                startRecording();
              }}
              onRecordingStop={() => {
                console.log('[VoiceRecorder] Stopping recording');
                stopRecording();
              }}
              onPermissionRequest={() => {
                console.log('[VoiceRecorder] Requesting permissions');
                requestPermissions().then(granted => {
                });
              }}
              audioLevel={audioLevel}
              showAnimation={false}
              audioBlob={audioBlob}
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
                  isProcessing={isProcessing || waitingForClear}
                  playbackProgress={playbackProgress}
                  audioDuration={audioDuration}
                  onTogglePlayback={async () => {
                    console.log('[VoiceRecorder] Toggle playback clicked');
                    try {
                      await ensureAllToastsCleared();
                    } catch (err) {
                      console.error('[VoiceRecorder] Error clearing toasts before playback:', err);
                    }
                    togglePlayback();
                  }}
                  onSaveEntry={handleSaveEntry}
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
          
          {(isProcessing || waitingForClear) && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground relative z-10 absolute bottom-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{waitingForClear ? "Preparing..." : "Processing..."}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceRecorder;
