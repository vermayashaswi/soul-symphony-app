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
  audioStatus?: string;
  recordingDuration?: number;
  setRecordingDuration?: React.Dispatch<React.SetStateAction<number>>;
  processingError?: string | null;
}

export function VoiceRecorder({ 
  onRecordingComplete, 
  onCancel, 
  className, 
  updateDebugInfo, 
  audioStatus, 
  recordingDuration, 
  setRecordingDuration, 
  processingError 
}: VoiceRecorderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [showAnimation, setShowAnimation] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [audioPrepared, setAudioPrepared] = useState(false);
  const [waitingForClear, setWaitingForClear] = useState(false);
  const [toastsCleared, setToastsCleared] = useState(false);
  const [toastOperationsLocked, setToastOperationsLocked] = useState(false);
  const [isUnmounting, setIsUnmounting] = useState(false);
  
  // Refs to track processing state and prevent race conditions
  const saveCompleteRef = useRef(false);
  const savingInProgressRef = useRef(false);
  const domClearAttemptedRef = useRef(false);
  const saveStartTimeRef = useRef<number | null>(null);
  const isFirstSaveAttemptRef = useRef(true);
  const componentMountedRef = useRef(true);
  const animationFramesRef = useRef<number[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  
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
      if (!componentMountedRef.current) return;
      console.log('[VoiceRecorder] Playback started');
      setHasPlayedOnce(true);
    },
    onPlaybackEnd: () => {
      if (!componentMountedRef.current) return;
      console.log('[VoiceRecorder] Playback ended');
    }
  });
  
  // Use effect to track component mounting state
  useEffect(() => {
    componentMountedRef.current = true;
    
    // Enhanced cleanup on unmount
    return () => {
      // Mark component as unmounting to prevent further state updates
      setIsUnmounting(true);
      componentMountedRef.current = false;
      
      // Clear all animation frames
      animationFramesRef.current.forEach(frameId => {
        cancelAnimationFrame(frameId);
      });
      animationFramesRef.current = [];
      
      // Clear all timeouts
      timeoutsRef.current.forEach(timeout => {
        clearTimeout(timeout);
      });
      timeoutsRef.current = [];
      
      // Stop any ongoing audio playback
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current.load();
        } catch (e) {
          console.warn('[VoiceRecorder] Error cleaning up audio:', e);
        }
      }
      
      // Clear any toasts if we're allowed to
      if (!toastOperationsLocked) {
        try {
          clearAllToasts().catch(e => console.warn('[VoiceRecorder] Cleanup error:', e));
        } catch (err) {
          console.error('[VoiceRecorder] Error in unmount cleanup:', err);
        }
      }
    };
  }, []);

  // Helper function to safely create timeouts that won't fire after unmount
  const safeTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timeoutId = setTimeout(() => {
      if (!componentMountedRef.current) return;
      callback();
      // Remove this timeout from our tracking array
      timeoutsRef.current = timeoutsRef.current.filter(id => id !== timeoutId);
    }, delay);
    
    // Add to our tracking array for cleanup
    timeoutsRef.current.push(timeoutId);
    return timeoutId;
  };
  
  // Helper function for safe state updates
  const safeSetState = <T,>(setState: React.Dispatch<React.SetStateAction<T>>, value: T | ((prev: T) => T)): void => {
    if (!componentMountedRef.current || isUnmounting) return;
    setState(value);
  };

  // Check if this is likely to be a first-time user (attempt 1)
  useEffect(() => {
    const checkForFirstTimeUser = async () => {
      try {
        if (user?.id) {
          // Check localStorage for a marker
          const hasRecordedBefore = localStorage.getItem(`hasRecorded_${user.id}`);
          if (!hasRecordedBefore) {
            console.log('[VoiceRecorder] This appears to be a first-time recorder');
            isFirstSaveAttemptRef.current = true;
            
            // More careful toast handling for first-time users
            safeSetState(setToastOperationsLocked, true);
          } else {
            console.log('[VoiceRecorder] User has recorded before');
            isFirstSaveAttemptRef.current = false;
          }
        }
      } catch (err) {
        console.warn('[VoiceRecorder] Error checking first-time user status:', err);
      }
    };
    
    checkForFirstTimeUser();
  }, [user?.id]);

  // Clear toasts on component mount with retry mechanism
  useEffect(() => {
    // Helper function to clear toasts with retries
    const clearToastsWithRetry = async (retryCount = 0): Promise<void> => {
      if (!componentMountedRef.current) return;
      
      if (toastOperationsLocked) {
        console.log('[VoiceRecorder] Toast operations locked, skipping clear');
        safeSetState(setToastsCleared, true);
        return;
      }
      
      try {
        console.log(`[VoiceRecorder] Clearing toasts attempt ${retryCount + 1}`);
        await ensureAllToastsCleared();
        safeSetState(setToastsCleared, true);
      } catch (err) {
        if (!componentMountedRef.current) return;
        console.error(`[VoiceRecorder] Error clearing toasts on attempt ${retryCount + 1}:`, err);
        if (retryCount < 2) {
          console.log(`[VoiceRecorder] Retrying toast clear in 100ms...`);
          timeoutsRef.current.push(setTimeout(() => clearToastsWithRetry(retryCount + 1), 100));
        } else {
          console.log(`[VoiceRecorder] Max toast clear attempts reached, continuing anyway`);
          safeSetState(setToastsCleared, true);
        }
      }
    };
    
    // Attempt to clear toasts
    clearToastsWithRetry();
  }, [toastOperationsLocked]);

  // Reset recording error when recording starts
  useEffect(() => {
    if (isRecording) {
      safeSetState(setRecordingError, null);
    }
  }, [isRecording]);
  
  // Show warning for long recordings
  useEffect(() => {
    if (isRecording && recordingTime >= 120000 && !toastOperationsLocked) {
      try {
        toast.warning("Your recording is quite long. Consider stopping now for better processing.", {
          duration: 3000,
        });
      } catch (e) {
        console.warn('[VoiceRecorder] Error showing warning toast:', e);
      }
    }
  }, [isRecording, recordingTime, toastOperationsLocked]);
  
  // Control animation visibility
  useEffect(() => {
    if (!componentMountedRef.current) return;
    
    if (isRecording) {
      safeSetState(setShowAnimation, true);
    } else if (audioBlob) {
      safeSetState(setShowAnimation, false);
    }
  }, [isRecording, audioBlob]);
  
  // Prepare audio for playback when a new blob is available
  useEffect(() => {
    if (!componentMountedRef.current) return;
    
    if (audioBlob && !audioPrepared) {
      console.log('[VoiceRecorder] New audio blob detected, preparing audio...');
      
      prepareAudio().then(duration => {
        if (!componentMountedRef.current) return;
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        safeSetState(setAudioPrepared, true);
      }).catch(error => {
        if (!componentMountedRef.current) return;
        console.error('[VoiceRecorder] Error preparing audio:', error);
      });
    }
  }, [audioBlob, audioPrepared, prepareAudio]);
  
  // Debug logging for component state
  useEffect(() => {
    if (!componentMountedRef.current) return;
    
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
      toastOperationsLocked,
      saveInProgress: savingInProgressRef.current,
      saveComplete: saveCompleteRef.current,
      isFirstSaveAttempt: isFirstSaveAttemptRef.current,
      saveStartTime: saveStartTimeRef.current ? new Date(saveStartTimeRef.current).toISOString() : null,
      saveElapsedTime: saveStartTimeRef.current ? Date.now() - saveStartTimeRef.current : null
    });
    
    if (updateDebugInfo && !isUnmounting) {
      updateDebugInfo({
        status: isRecording 
          ? 'Recording' 
          : (audioBlob ? (isProcessing ? 'Processing' : 'Recorded') : 'No Recording'),
        duration: audioDuration || (recordingTime / 1000)
      });
    }
  }, [isProcessing, audioBlob, isRecording, hasPermission, audioDuration, hasSaved, hasPlayedOnce, recordingTime, 
       audioPrepared, waitingForClear, toastsCleared, toastOperationsLocked, updateDebugInfo, isUnmounting]);
  
  // Add a recovery mechanism for stuck processing states
  useEffect(() => {
    // If processing has been going on for more than 30 seconds, it's probably stuck
    if (isProcessing && saveStartTimeRef.current) {
      const processingTime = Date.now() - saveStartTimeRef.current;
      if (processingTime > 30000) { // 30 seconds timeout
        console.warn('[VoiceRecorder] Processing appears stuck for over 30 seconds. Attempting recovery...');
        
        // Only try recovery if we haven't completed the save and component is still mounted
        if (!saveCompleteRef.current && componentMountedRef.current) {
          console.log('[VoiceRecorder] Recovery: Re-attempting save completion...');
          if (audioBlob && onRecordingComplete) {
            try {
              console.log('[VoiceRecorder] Recovery: Calling onRecordingComplete directly...');
              onRecordingComplete(audioBlob);
              saveCompleteRef.current = true;
              console.log('[VoiceRecorder] Recovery: Backup save attempt completed');
              
              // If this was a first-time user, mark as recorded
              if (isFirstSaveAttemptRef.current && user?.id) {
                try {
                  localStorage.setItem(`hasRecorded_${user.id}`, 'true');
                  console.log('[VoiceRecorder] Marked user as having recorded before');
                } catch (err) {
                  console.warn('[VoiceRecorder] Error saving recording status to localStorage:', err);
                }
              }
            } catch (err) {
              console.error('[VoiceRecorder] Recovery: Backup save attempt failed:', err);
            }
          }
        }
        
        // Regardless, reset UI state to prevent being stuck if component is still mounted
        if (componentMountedRef.current && !isUnmounting) {
          safeSetState(setIsProcessing, false);
          savingInProgressRef.current = false;
          safeSetState(setToastOperationsLocked, false);
          
          console.log('[VoiceRecorder] Recovery: Processing state reset');
        }
      }
    }
    
    return () => {
      if (isProcessing && !saveCompleteRef.current) {
        console.warn('[VoiceRecorder] Component unmounting during processing - potential source of UI errors');
      }
    };
  }, [isProcessing, audioBlob, onRecordingComplete, user?.id, isUnmounting]);
  
  // The save entry handler with improved robustness
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      safeSetState(setRecordingError, "No audio recording available");
      return;
    }
    
    if (hasSaved || savingInProgressRef.current) {
      console.log('[VoiceRecorder] Already saved this recording or save in progress, ignoring duplicate save request');
      return;
    }
    
    try {
      console.log('[VoiceRecorder] Starting save process, first save attempt:', isFirstSaveAttemptRef.current);
      savingInProgressRef.current = true;
      saveStartTimeRef.current = Date.now();
      
      // For first-time recorders, we'll be extra careful with toast operations
      if (isFirstSaveAttemptRef.current) {
        console.log('[VoiceRecorder] This is a first-time save, using safer approach');
        safeSetState(setToastOperationsLocked, true);
      }
      
      // Set processing state IMMEDIATELY before any other operations
      safeSetState(setIsProcessing, true);
      safeSetState(setRecordingError, null);
      safeSetState(setHasSaved, true);
      
      // Clear toasts with explicit error handling and retries
      safeSetState(setWaitingForClear, true);
      try {
        if (!toastOperationsLocked && componentMountedRef.current) {
          console.log('[VoiceRecorder] Clearing toasts before processing');
          await ensureAllToastsCleared();
          console.log('[VoiceRecorder] Toasts cleared successfully');
        } else {
          console.log('[VoiceRecorder] Toast operations locked, skipping clear');
        }
      } catch (err) {
        console.error('[VoiceRecorder] Error clearing toasts before save, continuing anyway:', err);
      } finally {
        // Continue even if toast clearing failed
        if (componentMountedRef.current && !isUnmounting) {
          safeSetState(setWaitingForClear, false);
          safeSetState(setToastsCleared, true);
        }
      }
      
      // Add a small delay to ensure UI has updated
      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
          resolve(); // This line must be explicitly called without args
          // Remove this timeout from our tracking array when it completes
          timeoutsRef.current = timeoutsRef.current.filter(id => id !== timeoutId);
        }, 100);
        // Add to our tracking array for cleanup
        timeoutsRef.current.push(timeoutId);
      });
      
      // Safety check - don't continue if component unmounted during the delay
      if (!componentMountedRef.current || isUnmounting) {
        console.log('[VoiceRecorder] Component unmounted during save delay, aborting save');
        return;
      }
      
      // Validate audio duration
      if (!hasPlayedOnce || audioDuration === 0) {
        console.log('[VoiceRecorder] Recording not played yet, preparing audio...');
        
        try {
          const duration = await prepareAudio();
          if (!componentMountedRef.current || isUnmounting) return;
          
          console.log('[VoiceRecorder] Audio prepared with duration:', duration);
          safeSetState(setAudioPrepared, true);
          
          if (duration < 0.5) {
            safeSetState(setRecordingError, "Recording is too short. Please try again.");
            safeSetState(setIsProcessing, false);
            safeSetState(setHasSaved, false);
            savingInProgressRef.current = false;
            saveStartTimeRef.current = null;
            safeSetState(setToastOperationsLocked, false);
            return;
          }
        } catch (prepareError) {
          if (!componentMountedRef.current || isUnmounting) return;
          
          console.error('[VoiceRecorder] Error preparing audio:', prepareError);
          // Continue anyway with duration estimation
        }
      } else if (audioDuration < 0.5) {
        safeSetState(setRecordingError, "Recording is too short. Please try again.");
        safeSetState(setIsProcessing, false);
        safeSetState(setHasSaved, false);
        savingInProgressRef.current = false;
        saveStartTimeRef.current = null;
        safeSetState(setToastOperationsLocked, false);
        return;
      }
      
      console.log('[VoiceRecorder] Normalizing audio blob before processing...');
      
      let normalizedBlob: Blob;
      try {
        normalizedBlob = await normalizeAudioBlob(audioBlob);
        if (!componentMountedRef.current || isUnmounting) {
          console.log('[VoiceRecorder] Component unmounted during normalization, aborting');
          return;
        }
        
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
        if (!componentMountedRef.current || isUnmounting) return;
        
        console.error('[VoiceRecorder] Error normalizing audio blob:', error);
        safeSetState(setRecordingError, "Error processing audio. Please try again.");
        safeSetState(setIsProcessing, false);
        safeSetState(setHasSaved, false);
        savingInProgressRef.current = false;
        saveStartTimeRef.current = null;
        safeSetState(setToastOperationsLocked, false);
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
      
      // Generate a unique temp ID to track this entry through the processing pipeline
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      if (onRecordingComplete) {
        try {
          console.log(`[VoiceRecorder] Calling recording completion callback with tempId: ${tempId}`);
          saveCompleteRef.current = false;
          
          // Test base64 conversion first to catch any conversion errors early
          try {
            const base64Test = await blobToBase64(normalizedBlob);
            if (!componentMountedRef.current || isUnmounting) return;
            
            console.log('[VoiceRecorder] Base64 test conversion successful, length:', base64Test.length);
            
            if (base64Test.length < 50) {
              throw new Error('Audio data appears too short or invalid');
            }
          } catch (base64Error) {
            if (!componentMountedRef.current || isUnmounting) return;
            
            console.error('[VoiceRecorder] Base64 conversion test failed:', base64Error);
            throw new Error('Error preparing audio for processing');
          }
          
          // If this is a first-time user, mark as recorded before processing
          // to help with state tracking in case of errors
          if (isFirstSaveAttemptRef.current && user?.id) {
            try {
              localStorage.setItem(`hasRecorded_${user.id}`, 'true');
              console.log('[VoiceRecorder] Marked user as having recorded before');
            } catch (err) {
              console.warn('[VoiceRecorder] Error saving recording status to localStorage:', err);
            }
          }
          
          // Dispatch events for tracking processing status
          try {
            // Pre-announce the entry to help the UI prepare
            window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
              detail: { 
                entries: [tempId], 
                lastUpdate: Date.now(),
                forceUpdate: true,
                showLoader: true
              }
            }));
            
            // Small delay to ensure event is processed
            await new Promise(r => safeTimeout(r, 50));
          } catch (eventError) {
            console.warn('[VoiceRecorder] Error dispatching processing event:', eventError);
          }
          
          console.log('[VoiceRecorder] Directly calling onRecordingComplete with blob and tempId:', tempId);
          await onRecordingComplete(normalizedBlob, tempId);
          
          if (!componentMountedRef.current || isUnmounting) {
            console.log('[VoiceRecorder] Component unmounted during callback, cannot update UI');
            return;
          }
          
          saveCompleteRef.current = true;
          console.log('[VoiceRecorder] Recording callback completed successfully');
          
          // Keep toast lock active for first-time users, let the Journal component handle it
          if (!isFirstSaveAttemptRef.current) {
            safeSetState(setToastOperationsLocked, false);
          }
          
          isFirstSaveAttemptRef.current = false;
          
          // Dispatch an event to inform other components that this entry was saved
          try {
            window.dispatchEvent(new CustomEvent('journalEntrySaved', {
              detail: {
                tempId,
                timestamp: Date.now(),
                status: 'processing'
              }
            }));
          } catch (eventError) {
            console.warn('[VoiceRecorder] Error dispatching entry saved event:', eventError);
          }
        } catch (error: any) {
          if (!componentMountedRef.current || isUnmounting) return;
          
          console.error('[VoiceRecorder] Error in recording callback:', error);
          safeSetState(setRecordingError, error?.message || "An unexpected error occurred");
          
          if (!toastOperationsLocked && componentMountedRef.current) {
            try {
              toast.error("Error saving recording", {
                id: 'error-toast',
                duration: 3000
              });
            } catch (toastError) {
              console.error('[VoiceRecorder] Error showing error toast:', toastError);
            }
          }
          
          safeSetState(setIsProcessing, false);
          safeSetState(setHasSaved, false);
          safeSetState(setToastOperationsLocked, false);
        } finally {
          // Always clean up state
          savingInProgressRef.current = false;
          saveStartTimeRef.current = null;
        }
      }
    } catch (error: any) {
      if (!componentMountedRef.current || isUnmounting) return;
      
      console.error('[VoiceRecorder] Error in save entry:', error);
      safeSetState(setRecordingError, error?.message || "An unexpected error occurred");
      
      if (!toastOperationsLocked && componentMountedRef.current) {
        try {
          toast.error("Error saving recording", {
            id: 'error-toast',
            duration: 3000
          });
        } catch (toastError) {
          console.error('[VoiceRecorder] Error showing error toast:', toastError);
        }
      }
      
      safeSetState(setIsProcessing, false);
      safeSetState(setHasSaved, false);
      savingInProgressRef.current = false;
      saveStartTimeRef.current = null;
      safeSetState(setToastOperationsLocked, false);
    }
  };

  // Reset recorder for a new recording
  const handleRestart = async () => {
    try {
      if (!toastOperationsLocked && componentMountedRef.current) {
        await ensureAllToastsCleared();
      }
    } catch (err) {
      console.error('[VoiceRecorder] Error clearing toasts during restart:', err);
    }
    
    if (!componentMountedRef.current) return;
    
    resetRecording();
    resetPlayback();
    safeSetState(setRecordingError, null);
    safeSetState(setShowAnimation, true);
    safeSetState(setIsProcessing, false);
    safeSetState(setHasSaved, false);
    safeSetState(setHasPlayedOnce, false);
    safeSetState(setAudioPrepared, false);
    saveCompleteRef.current = false;
    savingInProgressRef.current = false;
    domClearAttemptedRef.current = false;
    saveStartTimeRef.current = null;
    
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(); // This line must be explicitly called without args
        timeoutsRef.current = timeoutsRef.current.filter(id => id !== timeoutId);
      }, 300);
      timeoutsRef.current.push(timeoutId);
    });
    
    if (!componentMountedRef.current || isUnmounting) return;
    
    if (!toastOperationsLocked && componentMountedRef.current) {
      try {
        toast.info("Starting a new recording", {
          duration: 2000
        });
      } catch (toastError) {
        console.error('[VoiceRecorder] Error showing info toast during restart:', toastError);
      }
    }
  };

  const shouldShowPrompt = !isRecording && !audioBlob;

  // Check for external error and display it
  useEffect(() => {
    if (processingError && componentMountedRef.current && !isUnmounting) {
      safeSetState(setRecordingError, processingError);
    }
  }, [processingError, isUnmounting]);

  // Update internal recording time from external source if provided
  useEffect(() => {
    if (recordingDuration !== undefined && setRecordingDuration && componentMountedRef.current && !isUnmounting) {
      // We're just using the external value, not setting it
      console.log(`[VoiceRecorder] Using external recording duration: ${recordingDuration}`);
    }
  }, [recordingDuration, isUnmounting]);

  // Don't render anything if component is unmounting
  if (isUnmounting) {
    return null;
  }

  return (
    <div className={cn("flex flex-col items-center relative z-10 w-full mb-[1rem]", className)}>
      <audio ref={audioRef} className="hidden" />
      
      <div className={cn(
        "relative w-full h-full flex flex-col items-center justify-between overflow-hidden rounded-2xl border border-slate-200/20",
        isMobile ? "min-h-[calc(80vh-160px)]" : "min-h-[500px]"
      )}>
        {showAnimation && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
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
                if (!componentMountedRef.current) return;
                
                console.log('[VoiceRecorder] Starting new recording');
                try {
                  if (!toastOperationsLocked && componentMountedRef.current) {
                    await ensureAllToastsCleared();
                  }
                } catch (err) {
                  console.error('[VoiceRecorder] Error clearing toasts before recording:', err);
                }
                startRecording();
              }}
              onRecordingStop={() => {
                if (!componentMountedRef.current) return;
                
                console.log('[VoiceRecorder] Stopping recording');
                stopRecording();
              }}
              onPermissionRequest={() => {
                if (!componentMountedRef.current) return;
                
                console.log('[VoiceRecorder] Requesting permissions');
                requestPermissions();
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
                    if (!componentMountedRef.current) return;
                    
                    console.log('[VoiceRecorder] Toggle playback clicked');
                    try {
                      if (!toastOperationsLocked && componentMountedRef.current) {
                        await ensureAllToastsCleared();
                      }
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
