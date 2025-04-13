import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { normalizeAudioBlob } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import FloatingLanguages from '@/components/voice-recorder/FloatingLanguages';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { AnimatedPrompt } from '@/components/voice-recorder/AnimatedPrompt';
import { ModelSelector } from '@/components/voice-recorder/ModelSelector';
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, tempId?: string, useGoogleSTT?: boolean) => void;
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
  const [transcriptionModel, setTranscriptionModel] = useState<string>("openai"); // Default to OpenAI
  const saveCompleteRef = useRef(false);
  const savingInProgressRef = useRef(false);
  const domClearAttemptedRef = useRef(false);
  const { user } = useAuth();
  const { isMobile } = useIsMobile();
  
  const {
    status,
    recordingTime,
    recordingBlob: audioBlob,
    startRecording,
    stopRecording,
    clearRecording,
    hasPermission,
    audioLevel,
    ripples,
    requestPermissions
  } = useVoiceRecorder({
    onRecordingComplete: (blob, tempId, useGoogleSTT) => {
      // This is now handled in handleSaveEntry
    },
    onError: (error) => {
      setRecordingError(error?.message || "An unexpected error occurred");
    },
    useGoogleSTT: transcriptionModel === "google"
  });
  
  const isRecording = status === 'recording';
  
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
    if (isRecording && typeof recordingTime === 'number' && recordingTime >= 120) {
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
      });
    }
  }, [audioBlob, audioPrepared, prepareAudio]);
  
  useEffect(() => {
    console.log('[VoiceRecorder] State update:', {
      isProcessing,
      hasAudioBlob: !!audioBlob,
      audioSize: audioBlob?.size || 0,
      isRecording,
      audioDuration,
      hasSaved,
      hasPlayedOnce,
      audioPrepared,
      waitingForClear,
      toastsCleared
    });
    
    if (updateDebugInfo) {
      updateDebugInfo({
        status: isRecording 
          ? 'Recording' 
          : (audioBlob ? 'Recorded' : 'No Recording'),
        duration: audioDuration || (typeof recordingTime === 'number' ? recordingTime : 0)
      });
    }
  }, [isProcessing, audioBlob, isRecording, audioDuration, hasSaved, hasPlayedOnce, recordingTime, audioPrepared, waitingForClear, toastsCleared, updateDebugInfo]);
  
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
        recordingTime: recordingTime,
        hasPlayedOnce: hasPlayedOnce,
        audioPrepared: audioPrepared,
        model: transcriptionModel
      });
      
      if (!hasPlayedOnce && audioDuration === 0 && typeof recordingTime === 'number' && recordingTime > 0) {
        const estimatedDuration = recordingTime / 1000;
        console.log(`[VoiceRecorder] Recording not played yet, estimating duration as ${estimatedDuration}s`);
      }
      
      if (onRecordingComplete) {
        try {
          console.log('[VoiceRecorder] Calling recording completion callback with model:', transcriptionModel);
          saveCompleteRef.current = false;
          
          await onRecordingComplete(normalizedBlob, undefined, transcriptionModel === "google");
          
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
    
    clearRecording();
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
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    toast.info("Starting a new recording", {
      duration: 2000
    });
  };

  const shouldShowPrompt = status !== 'recording' && !audioBlob;

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
          
          {shouldShowPrompt && (
            <div className="absolute top-4 right-4 z-20 w-48">
              <ModelSelector 
                selectedModel={transcriptionModel} 
                onChange={setTranscriptionModel} 
                disabled={status === 'recording' || isProcessing}
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
              audioLevel={audioLevel}
              showAnimation={false}
              audioBlob={audioBlob}
            />
          </div>

          <AnimatePresence mode="wait">
            {status === 'recording' ? (
              <RecordingStatus 
                isRecording={status === 'recording'} 
                recordingTime={typeof recordingTime === 'string' ? recordingTime : '00:00'} 
              />
            ) : audioBlob ? (
              <div className="flex flex-col items-center w-full relative z-10 mt-auto mb-8">
                <div className="mb-4 px-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Using {transcriptionModel === 'google' ? 'Google Speech-to-Text' : 'OpenAI Whisper'} for transcription
                  </p>
                </div>
                <PlaybackControls
                  audioBlob={audioBlob}
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
            ) : false ? (
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
