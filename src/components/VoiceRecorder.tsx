import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRecordRTCRecorder } from '@/hooks/use-recordrtc-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { normalizeAudioBlob, createPlayableAudioBlob } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import FloatingLanguages from '@/components/voice-recorder/FloatingLanguages';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { AnimatedPrompt } from '@/components/voice-recorder/AnimatedPrompt';
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';
import { RecordingDebugger } from '@/components/debug/RecordingDebugger';

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
  const [playableBlob, setPlayableBlob] = useState<Blob | null>(null);
  const [debugInfo, setDebugInfo] = useState<{status: string, duration?: number}>({
    status: 'No Recording'
  });
  const saveCompleteRef = useRef(false);
  const savingInProgressRef = useRef(false);
  const domClearAttemptedRef = useRef(false);
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
  } = useRecordRTCRecorder({ 
    noiseReduction: false,
    maxDuration: 300
  });
  
  useEffect(() => {
    if (audioBlob) {
      try {
        console.log('[VoiceRecorder] Creating playable version of the blob');
        const normalizedBlob = normalizeAudioBlob(audioBlob);
        
        if (recordingTime && recordingTime > 0) {
          const durationInSeconds = recordingTime / 1000;
          Object.defineProperty(normalizedBlob, 'duration', {
            value: durationInSeconds,
            writable: false
          });
          console.log('[VoiceRecorder] Added duration to blob:', durationInSeconds, 'seconds');
        }
        
        const playable = createPlayableAudioBlob(normalizedBlob);
        
        if (recordingTime && recordingTime > 0) {
          const durationInSeconds = recordingTime / 1000;
          Object.defineProperty(playable, 'duration', {
            value: durationInSeconds,
            writable: false
          });
        }
        
        setPlayableBlob(playable);
        console.log('[VoiceRecorder] Created playable blob:', playable.size, playable.type, 'duration:', (playable as any).duration);
      } catch (err) {
        console.error('[VoiceRecorder] Error creating playable blob:', err);
        setPlayableBlob(audioBlob);
      }
    } else {
      setPlayableBlob(null);
    }
  }, [audioBlob, recordingTime]);
  
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
    audioBlob: playableBlob,
    onPlaybackStart: () => {
      console.log('[VoiceRecorder] Playback started');
      setHasPlayedOnce(true);
    },
    onPlaybackEnd: () => {
      console.log('[VoiceRecorder] Playback ended');
    }
  });

  useEffect(() => {
    const clearToastsOnMount = async () => {
      await ensureAllToastsCleared();
      setToastsCleared(true);
    };
    
    clearToastsOnMount();
    
    return () => {
      clearAllToasts();
    };
  }, []);

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
  
  useEffect(() => {
    if (playableBlob && !audioPrepared) {
      console.log('[VoiceRecorder] New playable blob detected, preparing audio...');
      setTimeout(() => {
        prepareAudio(true).then(duration => {
          console.log('[VoiceRecorder] Audio prepared with duration:', duration);
          
          if ((duration === undefined || duration < 0.5) && recordingTime > 0) {
            const recordingDuration = recordingTime / 1000;
            console.log('[VoiceRecorder] Using recording time for duration:', recordingDuration);
          }
          
          setAudioPrepared(true);
        });
      }, 300);
    }
  }, [playableBlob, audioPrepared, prepareAudio, recordingTime]);
  
  useEffect(() => {
    console.log('[VoiceRecorder] State update:', {
      isProcessing,
      hasAudioBlob: !!audioBlob,
      audioSize: audioBlob?.size || 0,
      playableBlobSize: playableBlob?.size || 0,
      isRecording,
      hasPermission,
      audioDuration,
      hasSaved,
      hasPlayedOnce,
      audioPrepared,
      waitingForClear,
      toastsCleared,
      recordingTime
    });
    
    const effectiveDuration = audioDuration && audioDuration > 0.5 
      ? audioDuration 
      : recordingTime / 1000;
    
    const newDebugInfo = {
      status: isRecording 
        ? 'Recording' 
        : (audioBlob ? 'Recorded' : 'No Recording'),
      duration: effectiveDuration
    };
    
    console.log('[VoiceRecorder] Setting debug info:', newDebugInfo);
    setDebugInfo(newDebugInfo);
    
    if (updateDebugInfo) {
      updateDebugInfo(newDebugInfo);
    }
  }, [isProcessing, audioBlob, playableBlob, isRecording, hasPermission, audioDuration, hasSaved, hasPlayedOnce, recordingTime, audioPrepared, waitingForClear, toastsCleared, updateDebugInfo]);
  
  useEffect(() => {
    return () => {
      console.log('[VoiceRecorder] Component unmounting, resetting state');
      
      if (isProcessing && !saveCompleteRef.current) {
        console.warn('[VoiceRecorder] Component unmounted during processing - potential source of UI errors');
      }
      
      clearAllToasts();
    };
  }, [isProcessing]);
  
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      setRecordingError("No audio recording available");
      return;
    }
    
    if (audioBlob.size < 100) {
      setRecordingError("Audio recording is too short or empty");
      return;
    }
    
    const hasDuration = (audioBlob as any).duration > 0.1 || recordingTime > 100;
    if (!hasDuration) {
      console.error('[VoiceRecorder] Recording has invalid duration:', (audioBlob as any).duration, 'recordingTime:', recordingTime);
      setRecordingError("Recording duration is too short");
      return;
    }
    
    if (hasSaved || savingInProgressRef.current) {
      console.log('[VoiceRecorder] Already saved this recording or save in progress, ignoring duplicate save request');
      return;
    }
    
    try {
      console.log('[VoiceRecorder] Starting save process');
      savingInProgressRef.current = true;
      
      setWaitingForClear(true);
      
      await ensureAllToastsCleared();
      
      if (!domClearAttemptedRef.current) {
        domClearAttemptedRef.current = true;
        try {
          const toastElements = document.querySelectorAll('[data-sonner-toast]');
          if (toastElements.length > 0) {
            console.log(`[VoiceRecorder] Found ${toastElements.length} lingering toasts, removing manually`);
            toastElements.forEach(el => {
              if (el.parentNode) {
                el.parentNode.removeChild(el);
              }
            });
          }
        } catch (e) {
          console.error('[VoiceRecorder] Error in manual DOM cleanup:', e);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setIsProcessing(true);
      setRecordingError(null);
      setHasSaved(true);
      setWaitingForClear(false);
      setToastsCleared(true);

      const effectiveDuration = audioDuration && audioDuration > 0.5 
        ? audioDuration 
        : recordingTime / 1000;
        
      console.log('[VoiceRecorder] Processing audio:', {
        originalType: audioBlob.type,
        originalSize: audioBlob.size,
        originalDuration: (audioBlob as any).duration,
        audioDuration: audioDuration,
        recordingTime: recordingTime,
        effectiveDuration: effectiveDuration,
        hasPlayedOnce: hasPlayedOnce,
        audioPrepared: audioPrepared
      });
      
      const normalizedBlob = normalizeAudioBlob(audioBlob);
      console.log('[VoiceRecorder] Normalized blob:', normalizedBlob.size, normalizedBlob.type);
      
      Object.defineProperty(normalizedBlob, 'duration', {
        value: effectiveDuration,
        writable: false
      });
      
      console.log('[VoiceRecorder] Final blob for processing:', {
        size: normalizedBlob.size,
        type: normalizedBlob.type,
        duration: (normalizedBlob as any).duration
      });
      
      if (onRecordingComplete) {
        try {
          console.log('[VoiceRecorder] Calling recording completion callback');
          saveCompleteRef.current = false;
          
          const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          
          await onRecordingComplete(normalizedBlob, tempId);
          
          saveCompleteRef.current = true;
          savingInProgressRef.current = false;
          
          console.log('[VoiceRecorder] Recording callback completed successfully');
        } catch (error: any) {
          console.error('[VoiceRecorder] Error in recording callback:', error);
          setRecordingError(error?.message || "An unexpected error occurred");
          
          setTimeout(() => {
            toast.error("Error saving recording", {
              id: 'error-toast',
              duration: 3000
            });
          }, 300);
          
          setIsProcessing(false);
          setHasSaved(false);
          savingInProgressRef.current = false;
        }
      }
    } catch (error: any) {
      console.error('[VoiceRecorder] Error in save entry:', error);
      setRecordingError(error?.message || "An unexpected error occurred");
      
      setTimeout(() => {
        toast.error("Error saving recording", {
          id: 'error-toast',
          duration: 3000
        });
      }, 300);
      
      setIsProcessing(false);
      setHasSaved(false);
      savingInProgressRef.current = false;
    }
  };

  const handleRestart = async () => {
    await ensureAllToastsCleared();
    
    resetRecording();
    resetPlayback();
    setRecordingError(null);
    setShowAnimation(true);
    setIsProcessing(false);
    setHasSaved(false);
    setHasPlayedOnce(false);
    setAudioPrepared(false);
    setPlayableBlob(null);
    saveCompleteRef.current = false;
    savingInProgressRef.current = false;
    domClearAttemptedRef.current = false;
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    toast.info("Starting a new recording", {
      duration: 2000
    });
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
                await ensureAllToastsCleared();
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
                  audioBlob={playableBlob}
                  isPlaying={isPlaying}
                  isProcessing={isProcessing || waitingForClear}
                  playbackProgress={playbackProgress}
                  audioDuration={audioDuration}
                  onTogglePlayback={async () => {
                    console.log('[VoiceRecorder] Toggle playback clicked');
                    await ensureAllToastsCleared();
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
      
      <RecordingDebugger 
        currentStatus={debugInfo.status} 
        audioDuration={debugInfo.duration}
        audioBlob={audioBlob}
      />
    </div>
  );
}

export default VoiceRecorder;
