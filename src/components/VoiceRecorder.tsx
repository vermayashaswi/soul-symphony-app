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
import { RecordingVisualizer } from '@/components/voice-recorder/RecordingVisualizer';
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';
import { processRecording } from '@/utils/audio-processing';

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
  const [playbackAudioLevel, setPlaybackAudioLevel] = useState(0);
  const [lastPlaybackTime, setLastPlaybackTime] = useState(0);
  const [localRipples, setLocalRipples] = useState<number[]>([]);
  const [actualDuration, setActualDuration] = useState<number | null>(null);
  const playbackLevelInterval = useRef<number | null>(null);
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
    maxDuration: 300,
    onAudioLevelChange: (level) => {
      console.log('[VoiceRecorder] Audio level update:', level);
    }
  });
  
  const {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    audioRef,
    reset: resetPlayback,
    seekTo,
    prepareAudio,
    currentPlaybackTime
  } = useAudioPlayback({ 
    audioBlob,
    onPlaybackStart: () => {
      console.log('[VoiceRecorder] Playback started');
      setHasPlayedOnce(true);
      
      // Initialize playback visualization
      if (playbackLevelInterval.current) {
        window.clearInterval(playbackLevelInterval.current);
      }
      
      playbackLevelInterval.current = window.setInterval(() => {
        if (isPlaying) {
          // Generate somewhat realistic audio levels based on playback time and progress
          const now = Date.now();
          const timeDiff = now - lastPlaybackTime;
          setLastPlaybackTime(now);
          
          // Create variations in the audio level that seem natural
          const baseLevel = 30 + (Math.sin(currentPlaybackTime * 3) * 15); 
          const randomFactor = Math.random() * 20;
          const timeFactorFluctuation = Math.sin(now / 500) * 10;
          
          // Every few seconds, add a "peak" in audio level to simulate speech patterns
          const peakFactor = (now % 2000 < 200) ? 20 : 0;
          
          const newLevel = Math.min(90, Math.max(10, 
            baseLevel + randomFactor + timeFactorFluctuation + peakFactor
          ));
          
          setPlaybackAudioLevel(newLevel);
          console.log('[VoiceRecorder] Playback audio level:', newLevel);
          
          // Occasionally add a ripple for visual interest
          if (Math.random() < 0.05 && newLevel > 40) {
            setLocalRipples(prev => [...prev, Date.now()]);
          }
        }
      }, 50);
    },
    onPlaybackEnd: () => {
      console.log('[VoiceRecorder] Playback ended');
      if (playbackLevelInterval.current) {
        window.clearInterval(playbackLevelInterval.current);
        playbackLevelInterval.current = null;
      }
      setPlaybackAudioLevel(0);
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
      if (playbackLevelInterval.current) {
        window.clearInterval(playbackLevelInterval.current);
        playbackLevelInterval.current = null;
      }
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
    if (audioBlob && !audioPrepared) {
      console.log('[VoiceRecorder] New audio blob detected, preparing audio...');
      prepareAudio().then(duration => {
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        setAudioPrepared(true);
        setActualDuration(duration);
        
        if (updateDebugInfo) {
          updateDebugInfo({
            status: 'Audio Prepared',
            duration: duration
          });
        }
      });
    }
  }, [audioBlob, audioPrepared, prepareAudio, updateDebugInfo]);
  
  useEffect(() => {
    console.log('[VoiceRecorder] State update:', {
      isProcessing,
      hasAudioBlob: !!audioBlob,
      audioSize: audioBlob?.size || 0,
      isRecording,
      hasPermission,
      audioDuration,
      actualDuration,
      audioLevel,
      playbackAudioLevel,
      hasSaved,
      hasPlayedOnce,
      audioPrepared,
      waitingForClear,
      toastsCleared,
      currentPlaybackTime
    });
    
    if (updateDebugInfo) {
      updateDebugInfo({
        status: isRecording 
          ? 'Recording' 
          : (isPlaying ? 'Playing' : (audioBlob ? 'Recorded' : 'No Recording')),
        duration: actualDuration || audioDuration || recordingTime
      });
    }
  }, [isProcessing, audioBlob, isRecording, isPlaying, hasPermission, audioDuration, actualDuration, hasSaved, hasPlayedOnce, recordingTime, audioPrepared, waitingForClear, toastsCleared, updateDebugInfo, audioLevel, playbackAudioLevel, currentPlaybackTime]);
  
  useEffect(() => {
    return () => {
      console.log('[VoiceRecorder] Component unmounting, resetting state');
      
      if (isProcessing && !saveCompleteRef.current) {
        console.warn('[VoiceRecorder] Component unmounted during processing - potential source of UI errors');
      }
      
      clearAllToasts();
      
      if (playbackLevelInterval.current) {
        window.clearInterval(playbackLevelInterval.current);
        playbackLevelInterval.current = null;
      }
    };
  }, [isProcessing]);
  
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
      
      if (!hasPlayedOnce || audioDuration === 0) {
        console.log('[VoiceRecorder] Recording not played yet, preparing audio...');
        const duration = await prepareAudio();
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        setAudioPrepared(true);
        setActualDuration(duration);
        
        if (duration < 0.5) {
          setRecordingError("Recording is too short. Please try again.");
          setIsProcessing(false);
          setHasSaved(false);
          savingInProgressRef.current = false;
          return;
        }
      } else if (audioDuration < 0.5) {
        setRecordingError("Recording is too short. Please try again.");
        setIsProcessing(false);
        setHasSaved(false);
        savingInProgressRef.current = false;
        return;
      }
      
      const normalizedBlob = normalizeAudioBlob(audioBlob);
      
      console.log('[VoiceRecorder] Processing audio:', {
        type: normalizedBlob.type,
        size: normalizedBlob.size,
        duration: audioDuration,
        actualDuration: actualDuration,
        recordingTime: recordingTime,
        hasPlayedOnce: hasPlayedOnce,
        audioPrepared: audioPrepared
      });
      
      const finalDuration = actualDuration || audioDuration || (recordingTime / 1000);
      
      if (!hasPlayedOnce && audioDuration === 0 && recordingTime > 0) {
        const estimatedDuration = recordingTime / 1000;
        console.log(`[VoiceRecorder] Recording not played yet, estimating duration as ${estimatedDuration}s`);
      }
      
      if (user && user.id) {
        const { success, tempId, error } = await processRecording(normalizedBlob, user.id);
        
        if (!success) {
          console.error('[VoiceRecorder] Error processing recording:', error);
          setRecordingError(error || "Failed to process recording");
          setIsProcessing(false);
          setHasSaved(false);
          savingInProgressRef.current = false;
          return;
        }
        
        if (onRecordingComplete) {
          onRecordingComplete(normalizedBlob, tempId);
        }
        
        saveCompleteRef.current = true;
        savingInProgressRef.current = false;
      } else {
        if (onRecordingComplete) {
          const tempId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          onRecordingComplete(normalizedBlob, tempId);
          saveCompleteRef.current = true;
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
    setPlaybackAudioLevel(0);
    setLocalRipples([]);
    setActualDuration(null);
    saveCompleteRef.current = false;
    savingInProgressRef.current = false;
    domClearAttemptedRef.current = false;
    
    if (playbackLevelInterval.current) {
      window.clearInterval(playbackLevelInterval.current);
      playbackLevelInterval.current = null;
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    toast.info("Starting a new recording", {
      duration: 2000
    });
  };

  useEffect(() => {
    return () => {
      if (playbackLevelInterval.current) {
        window.clearInterval(playbackLevelInterval.current);
        playbackLevelInterval.current = null;
      }
    };
  }, []);

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
          {(isPlaying && audioBlob) && (
            <div className="absolute top-1/3 left-0 right-0 z-0 w-full">
              <RecordingVisualizer 
                isRecording={false} 
                isPlaying={isPlaying}
                audioLevel={isPlaying ? playbackAudioLevel : audioLevel}
                height={80}
                color="primary"
                ripples={localRipples}
              />
            </div>
          )}
          
          {isRecording && (
            <div className="absolute top-1/3 left-0 right-0 z-0 w-full">
              <RecordingVisualizer 
                isRecording={true}
                isPlaying={false}
                audioLevel={audioLevel}
                height={80}
                color="primary"
                ripples={ripples}
              />
            </div>
          )}
          
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
              audioLevel={isRecording ? audioLevel : (isPlaying ? playbackAudioLevel : 0)}
              showAnimation={false}
              disabled={!isRecording && audioBlob !== null}
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
                  audioDuration={actualDuration || audioDuration || (recordingTime / 1000)}
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
    </div>
  );
}

export default VoiceRecorder;
