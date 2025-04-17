
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, BugPlay } from 'lucide-react';
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
import { useDebugLog } from '@/utils/debug/DebugContext';
import VoiceRecorderDebugPanel from '@/components/debug/VoiceRecorderDebugPanel';
import { Button } from '@/components/ui/button';

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
  
  const saveCompleteRef = useRef(false);
  const savingInProgressRef = useRef(false);
  const domClearAttemptedRef = useRef(false);
  
  const { user } = useAuth();
  const { isMobile } = useIsMobile();
  
  // Access debug context
  const { 
    addRecorderStep, 
    updateRecorderStep, 
    resetRecorderSteps, 
    recorderSteps,
    showRecorderDebug,
    toggleRecorderDebug
  } = useDebugLog();
  
  // Audio recording hook
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
  
  // Audio playback hook
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
      updateRecorderStep('playback', { status: 'in-progress', details: 'Playing audio' });
    },
    onPlaybackEnd: () => {
      console.log('[VoiceRecorder] Playback ended');
      updateRecorderStep('playback', { status: 'success', details: 'Playback completed' });
    }
  });

  // Clear toasts on mount
  useEffect(() => {
    const clearToastsOnMount = async () => {
      await ensureAllToastsCleared();
      setToastsCleared(true);
    };
    
    clearToastsOnMount();

    // Add first debug step
    addRecorderStep({
      id: 'init',
      name: 'Initialize Voice Recorder',
      status: 'success',
      timestamp: Date.now(),
      details: 'Voice recorder component mounted'
    });
    
    return () => {
      clearAllToasts();
      resetRecorderSteps();
    };
  }, [addRecorderStep, resetRecorderSteps]);

  // Clear recording error when recording starts
  useEffect(() => {
    if (isRecording) {
      setRecordingError(null);
      
      // Add recording start debug step
      addRecorderStep({
        id: 'recording-start',
        name: 'Started Recording',
        status: 'in-progress',
        timestamp: Date.now(),
        details: `Recording in format: ${navigator.mediaDevices ? 'WebM/WAV (browser supported)' : 'Unknown'}`
      });
    } else if (audioBlob && recorderSteps.some(s => s.id === 'recording-start')) {
      // Update recording completion debug step
      updateRecorderStep('recording-start', { 
        status: 'success', 
        name: 'Recording Completed',
        details: `Size: ${(audioBlob.size / 1024).toFixed(2)}KB, Duration: ${(recordingTime / 1000).toFixed(1)}s, Type: ${audioBlob.type}`
      });
    }
  }, [isRecording, audioBlob, recordingTime, addRecorderStep, updateRecorderStep, recorderSteps]);
  
  // Show warning for long recordings
  useEffect(() => {
    if (isRecording && recordingTime >= 120000) {
      toast.warning("Your recording is quite long. Consider stopping now for better processing.", {
        duration: 3000,
      });
    }
  }, [isRecording, recordingTime]);
  
  // Handle animation visibility
  useEffect(() => {
    if (isRecording) {
      setShowAnimation(true);
    } else if (audioBlob) {
      setShowAnimation(false);
    }
  }, [isRecording, audioBlob]);
  
  // Prepare audio when blob is available
  useEffect(() => {
    if (audioBlob && !audioPrepared) {
      console.log('[VoiceRecorder] New audio blob detected, preparing audio...');
      
      addRecorderStep({
        id: 'audio-prepare',
        name: 'Preparing Audio',
        status: 'in-progress',
        timestamp: Date.now(),
        details: `Initializing audio blob of size: ${(audioBlob.size / 1024).toFixed(2)}KB`
      });
      
      prepareAudio().then(duration => {
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        setAudioPrepared(true);
        
        updateRecorderStep('audio-prepare', {
          status: 'success',
          details: `Audio prepared with duration: ${duration.toFixed(2)}s`
        });
      }).catch(error => {
        console.error('[VoiceRecorder] Error preparing audio:', error);
        
        updateRecorderStep('audio-prepare', {
          status: 'error',
          details: `Error preparing audio: ${error.message}`
        });
      });
    }
  }, [audioBlob, audioPrepared, prepareAudio, addRecorderStep, updateRecorderStep]);
  
  // Update debug info when state changes
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
      toastsCleared
    });
    
    if (updateDebugInfo) {
      updateDebugInfo({
        status: isRecording 
          ? 'Recording' 
          : (audioBlob ? 'Recorded' : 'No Recording'),
        duration: audioDuration || (recordingTime / 1000)
      });
    }
  }, [isProcessing, audioBlob, isRecording, hasPermission, audioDuration, hasSaved, hasPlayedOnce, recordingTime, 
       audioPrepared, waitingForClear, toastsCleared, updateDebugInfo]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      console.log('[VoiceRecorder] Component unmounting, resetting state');
      
      if (isProcessing && !saveCompleteRef.current) {
        console.warn('[VoiceRecorder] Component unmounted during processing - potential source of UI errors');
      }
      
      clearAllToasts();
    };
  }, [isProcessing]);
  
  // Handle saving recording
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      setRecordingError("No audio recording available");
      
      addRecorderStep({
        id: 'save-error',
        name: 'Save Error',
        status: 'error',
        timestamp: Date.now(),
        details: 'No audio recording available'
      });
      
      return;
    }
    
    if (hasSaved || savingInProgressRef.current) {
      console.log('[VoiceRecorder] Already saved this recording or save in progress, ignoring duplicate save request');
      return;
    }
    
    try {
      console.log('[VoiceRecorder] Starting save process');
      savingInProgressRef.current = true;
      
      addRecorderStep({
        id: 'save-start',
        name: 'Save Recording',
        status: 'in-progress',
        timestamp: Date.now(),
        details: 'Initiating save process'
      });
      
      setWaitingForClear(true);
      
      await ensureAllToastsCleared();
      
      updateRecorderStep('save-start', {
        details: 'Toasts cleared, preparing for processing'
      });
      
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
            
            updateRecorderStep('save-start', {
              details: `Removed ${toastElements.length} lingering toast elements from DOM`
            });
          }
        } catch (e) {
          console.error('[VoiceRecorder] Error in manual DOM cleanup:', e);
          
          updateRecorderStep('save-start', {
            details: `Error in DOM cleanup: ${e.message}`
          });
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setIsProcessing(true);
      setRecordingError(null);
      setHasSaved(true);
      setWaitingForClear(false);
      setToastsCleared(true);
      
      updateRecorderStep('save-start', {
        details: 'DOM prepared, starting audio validation'
      });
      
      if (!hasPlayedOnce || audioDuration === 0) {
        console.log('[VoiceRecorder] Recording not played yet, preparing audio...');
        
        addRecorderStep({
          id: 'audio-validate',
          name: 'Validating Audio',
          status: 'in-progress',
          timestamp: Date.now(),
          details: 'Audio not played yet, preparing for validation'
        });
        
        const duration = await prepareAudio();
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        setAudioPrepared(true);
        
        updateRecorderStep('audio-validate', {
          status: duration >= 0.5 ? 'success' : 'error',
          details: `Audio duration: ${duration.toFixed(2)}s${duration < 0.5 ? ' (too short)' : ''}`
        });
        
        if (duration < 0.5) {
          setRecordingError("Recording is too short. Please try again.");
          setIsProcessing(false);
          setHasSaved(false);
          savingInProgressRef.current = false;
          
          updateRecorderStep('save-start', {
            status: 'error',
            details: 'Recording too short (< 0.5s)'
          });
          
          return;
        }
      } else if (audioDuration < 0.5) {
        setRecordingError("Recording is too short. Please try again.");
        setIsProcessing(false);
        setHasSaved(false);
        savingInProgressRef.current = false;
        
        addRecorderStep({
          id: 'audio-validate',
          name: 'Validating Audio',
          status: 'error',
          timestamp: Date.now(),
          details: `Audio too short: ${audioDuration.toFixed(2)}s`
        });
        
        updateRecorderStep('save-start', {
          status: 'error',
          details: 'Recording too short (< 0.5s)'
        });
        
        return;
      } else {
        addRecorderStep({
          id: 'audio-validate',
          name: 'Validating Audio',
          status: 'success',
          timestamp: Date.now(),
          details: `Audio valid: ${audioDuration.toFixed(2)}s duration`
        });
      }
      
      // Important: Normalize the blob and await the result
      console.log('[VoiceRecorder] Normalizing audio blob before processing...');
      
      addRecorderStep({
        id: 'audio-normalize',
        name: 'Normalizing Audio',
        status: 'in-progress',
        timestamp: Date.now(),
        details: `Original blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`
      });
      
      let normalizedBlob: Blob;
      try {
        normalizedBlob = await normalizeAudioBlob(audioBlob);
        console.log('[VoiceRecorder] Blob normalized successfully:', {
          type: normalizedBlob.type,
          size: normalizedBlob.size,
          hasDuration: 'duration' in normalizedBlob,
          duration: (normalizedBlob as any).duration || 'unknown'
        });
        
        // Validate the normalized blob
        const validation = validateAudioBlob(normalizedBlob);
        if (!validation.isValid) {
          throw new Error(validation.errorMessage || "Invalid audio data after normalization");
        }
        
        updateRecorderStep('audio-normalize', {
          status: 'success',
          details: `Normalized to: ${normalizedBlob.size} bytes, type: ${normalizedBlob.type}`
        });
      } catch (error) {
        console.error('[VoiceRecorder] Error normalizing audio blob:', error);
        setRecordingError("Error processing audio. Please try again.");
        setIsProcessing(false);
        setHasSaved(false);
        savingInProgressRef.current = false;
        
        updateRecorderStep('audio-normalize', {
          status: 'error',
          details: `Normalization error: ${error instanceof Error ? error.message : String(error)}`
        });
        
        updateRecorderStep('save-start', {
          status: 'error',
          details: 'Failed during audio normalization'
        });
        
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
      
      updateRecorderStep('save-start', {
        details: 'Audio normalized successfully, preparing for transcription'
      });
      
      if (!hasPlayedOnce && audioDuration === 0 && recordingTime > 0) {
        const estimatedDuration = recordingTime / 1000;
        console.log(`[VoiceRecorder] Recording not played yet, estimating duration as ${estimatedDuration}s`);
        
        // Add duration property to normalized blob if missing
        if (!('duration' in normalizedBlob)) {
          try {
            Object.defineProperty(normalizedBlob, 'duration', {
              value: estimatedDuration,
              writable: false
            });
            
            addRecorderStep({
              id: 'duration-set',
              name: 'Set Duration Property',
              status: 'success',
              timestamp: Date.now(),
              details: `Added duration property: ${estimatedDuration.toFixed(2)}s from recording time`
            });
          } catch (err) {
            console.warn("[VoiceRecorder] Could not add duration to blob:", err);
            
            addRecorderStep({
              id: 'duration-set',
              name: 'Set Duration Property',
              status: 'error',
              timestamp: Date.now(),
              details: `Failed to add duration: ${err instanceof Error ? err.message : String(err)}`
            });
          }
        }
      }
      
      if (onRecordingComplete) {
        try {
          console.log('[VoiceRecorder] Calling recording completion callback');
          saveCompleteRef.current = false;
          
          addRecorderStep({
            id: 'audio-encode',
            name: 'Base64 Encoding',
            status: 'in-progress',
            timestamp: Date.now(),
            details: 'Converting audio to Base64 format'
          });
          
          // Test the blob conversion before passing to callback
          const base64Test = await blobToBase64(normalizedBlob).catch(err => {
            console.error('[VoiceRecorder] Base64 conversion test failed:', err);
            
            updateRecorderStep('audio-encode', {
              status: 'error',
              details: `Base64 conversion failed: ${err instanceof Error ? err.message : String(err)}`
            });
            
            throw new Error('Error preparing audio for processing');
          });
          
          console.log('[VoiceRecorder] Base64 test conversion successful, length:', base64Test.length);
          
          updateRecorderStep('audio-encode', {
            status: 'success',
            details: `Base64 encoding successful, length: ${base64Test.length} chars`
          });
          
          addRecorderStep({
            id: 'transcription',
            name: 'Transcribing Audio',
            status: 'in-progress',
            timestamp: Date.now(),
            details: 'Sending audio to OpenAI for transcription'
          });
          
          await onRecordingComplete(normalizedBlob);
          
          saveCompleteRef.current = true;
          savingInProgressRef.current = false;
          
          updateRecorderStep('transcription', {
            status: 'success',
            details: 'Transcription completed successfully'
          });
          
          updateRecorderStep('save-start', {
            status: 'success',
            details: 'All processing completed successfully'
          });
          
          console.log('[VoiceRecorder] Recording callback completed successfully');
        } catch (error: any) {
          console.error('[VoiceRecorder] Error in recording callback:', error);
          setRecordingError(error?.message || "An unexpected error occurred");
          
          updateRecorderStep('transcription', {
            status: 'error',
            details: `Transcription error: ${error?.message || "Unknown error"}`
          });
          
          updateRecorderStep('save-start', {
            status: 'error',
            details: `Failed during transcription phase: ${error?.message || "Unknown error"}`
          });
          
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
      
      updateRecorderStep('save-start', {
        status: 'error',
        details: `General error: ${error?.message || "Unknown error"}`
      });
      
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

  // Handle restarting recording
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
    saveCompleteRef.current = false;
    savingInProgressRef.current = false;
    domClearAttemptedRef.current = false;
    
    // Reset debug steps for new recording
    resetRecorderSteps();
    addRecorderStep({
      id: 'restart',
      name: 'Recording Reset',
      status: 'success',
      timestamp: Date.now(),
      details: 'Started a new recording session'
    });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    toast.info("Starting a new recording", {
      duration: 2000
    });
  };

  // Determine if prompt should be shown
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
                addRecorderStep({
                  id: 'permissions',
                  name: 'Requesting Permissions',
                  status: 'in-progress',
                  timestamp: Date.now(),
                  details: 'Requesting microphone access'
                });
                
                requestPermissions().then(granted => {
                  updateRecorderStep('permissions', {
                    status: granted ? 'success' : 'error',
                    details: granted ? 'Microphone access granted' : 'Microphone access denied'
                  });
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
                    await ensureAllToastsCleared();
                    
                    if (!isPlaying) {
                      addRecorderStep({
                        id: 'playback',
                        name: 'Audio Playback',
                        status: 'in-progress',
                        timestamp: Date.now(),
                        details: 'Starting audio playback'
                      });
                    } else {
                      updateRecorderStep('playback', {
                        status: 'success',
                        details: 'Playback paused'
                      });
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
          
          {/* Debug toggle button */}
          <div className="absolute top-4 right-4 z-20">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleRecorderDebug}
              className="h-8 w-8 p-0 rounded-full bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm"
              title="Toggle Debug Panel"
            >
              <BugPlay className="h-4 w-4" />
              <span className="sr-only">Toggle Debug</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Debug panel */}
      <VoiceRecorderDebugPanel 
        steps={recorderSteps}
        isVisible={showRecorderDebug} 
        toggleVisibility={toggleRecorderDebug}
      />
    </div>
  );
}

export default VoiceRecorder;
