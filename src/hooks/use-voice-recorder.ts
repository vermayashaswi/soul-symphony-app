
import { useState, useRef, useEffect, useCallback } from "react";
import { recordAudio } from "../utils/audioRecorder";

interface UseVoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, tempId?: string) => void;
  onError?: (error: any) => void;
}

export function useVoiceRecorder({
  onRecordingComplete,
  onError,
}: UseVoiceRecorderProps) {
  const [status, setStatus] = useState<
    "idle" | "acquiring_media" | "recording" | "stopping"
  >("idle");
  const [recorderInstance, setRecorderInstance] = useState<any>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef<number>(0);
  const isMounted = useRef<boolean>(true);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup function
  const cleanupResources = useCallback(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        if (track.readyState === 'live') {
          console.log(`[useVoiceRecorder] Stopping track: ${track.kind}`);
          track.stop();
        }
      });
      setMediaStream(null);
    }
    
    if (recorderInstance) {
      try {
        if (recorderInstance.forceStop) {
          recorderInstance.forceStop();
        }
      } catch (e) {
        console.error('[useVoiceRecorder] Error cleaning up recorder:', e);
      }
      setRecorderInstance(null);
    }
  }, [mediaStream, recorderInstance]);

  const startRecording = useCallback(async () => {
    try {
      // Ensure we're clean before starting
      cleanupResources();
      
      // Dispatch operation start event for debugging
      const event = new CustomEvent('journalOperationStart', {
        detail: {
          type: 'recording',
          message: 'Starting voice recording'
        }
      });
      const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;
      
      setStatus("acquiring_media");
      console.log('[useVoiceRecorder] Starting audio recording - acquiring media');
      
      // Use our custom recorder instead of RecordRTC
      const recorder = await recordAudio();
      
      if (!isMounted.current) {
        console.log('[useVoiceRecorder] Component unmounted during media acquisition');
        recorder.forceStop();
        return;
      }
      
      setRecorderInstance(recorder);
      setMediaStream(recorder.stream);
      
      // Start timer
      const now = Date.now();
      setStartTime(now);
      setStatus("recording");
      console.log('[useVoiceRecorder] Audio recording started successfully at', new Date(now).toISOString());
      
      // Update timer at regular intervals
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      
      timerInterval.current = setInterval(() => {
        if (!isMounted.current) {
          clearInterval(timerInterval.current!);
          return;
        }
        
        const newElapsedTime = Date.now() - startTime;
        setElapsedTime(newElapsedTime);
        // Store in ref for access during stopRecording
        recordingDurationRef.current = newElapsedTime;
      }, 100);
      
      if (opId) {
        window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
          detail: {
            id: opId,
            status: 'success'
          }
        }));
      }
    } catch (err) {
      console.error("[useVoiceRecorder] Error starting recording:", err);
      setStatus("idle");
      if (onError) onError(err);
      
      // Dispatch error event for debugging
      window.dispatchEvent(new CustomEvent('journalOperationStart', {
        detail: {
          type: 'recording',
          message: 'Recording failed to start',
          status: 'error',
          details: err instanceof Error ? err.message : String(err)
        }
      }));
    }
  }, [cleanupResources, onError]);

  const stopRecording = useCallback(() => {
    if (!recorderInstance) {
      console.error('[useVoiceRecorder] No recorder instance to stop');
      return;
    }
    
    // Dispatch operation event for debugging
    const event = new CustomEvent('journalOperationStart', {
      detail: {
        type: 'recording',
        message: 'Finishing recording and processing audio'
      }
    });
    const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;

    setStatus("stopping");
    console.log('[useVoiceRecorder] Stopping audio recording');
    
    // Store final recording duration in seconds - this is critical
    const finalRecordingDuration = recordingDurationRef.current / 1000;
    console.log(`[useVoiceRecorder] Final recording UI duration: ${finalRecordingDuration} seconds`);
    
    // Set a timeout to prevent hanging if something goes wrong
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
    }
    
    stopTimeoutRef.current = setTimeout(() => {
      console.warn('[useVoiceRecorder] Stop timeout triggered - forcing cleanup');
      cleanupResources();
      setStatus("idle");
    }, 5000);
    
    try {
      recorderInstance.stop()
        .then(({ blob }: { blob: Blob }) => {
          if (stopTimeoutRef.current) {
            clearTimeout(stopTimeoutRef.current);
            stopTimeoutRef.current = null;
          }
          
          if (!isMounted.current) {
            console.log('[useVoiceRecorder] Component unmounted during stop');
            return;
          }
          
          console.log(`[useVoiceRecorder] Recording stopped, blob size: ${blob.size}, type: ${blob.type}`);
          
          // Check for existing duration property
          const existingDuration = (blob as any).duration;
          console.log(`[useVoiceRecorder] Blob received with duration: ${existingDuration !== undefined ? existingDuration : 'not set'}`);
          
          // Always create a new blob to ensure the duration property sticks
          let blobToUse: Blob;
          
          if (!existingDuration || existingDuration < 0.1) {
            console.log('[useVoiceRecorder] Setting missing duration property');
            
            // Create a new blob to ensure the duration property sticks
            const newBlob = new Blob([blob], { type: blob.type });
            Object.defineProperty(newBlob, 'duration', {
              value: Math.max(0.5, finalRecordingDuration),
              writable: false,
              configurable: true,
              enumerable: true
            });
            
            // Also set with a different name to make sure at least one works
            Object.defineProperty(newBlob, '_audioDuration', {
              value: Math.max(0.5, finalRecordingDuration),
              writable: false,
              configurable: true,
              enumerable: true
            });
            
            blobToUse = newBlob;
          } else {
            blobToUse = blob;
          }
          
          // Verify duration is set correctly
          const newDuration = (blobToUse as any).duration;
          console.log(`[useVoiceRecorder] Final blob duration after explicit setting: ${newDuration}s`);
          
          setRecordingBlob(blobToUse);
          
          cleanupResources();
          setStatus("idle");
          
          // Generate a temporary ID
          const tempId = generateTempId();
          
          // Verify duration before passing to callback
          const blobDuration = (blobToUse as any).duration;
          console.log(`[useVoiceRecorder] Processing audio blob: ${formatBytes(blobToUse.size)}, UI duration: ${formatTime(elapsedTime)}, blob.duration: ${blobDuration}s`);
          
          // Call the completion callback
          onRecordingComplete(blobToUse, tempId);
        })
        .catch((err: any) => {
          console.error("[useVoiceRecorder] Error stopping recording:", err);
          cleanupResources();
          setStatus("idle");
          
          if (opId) {
            window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
              detail: {
                id: opId,
                status: 'error',
                message: 'Error stopping recording',
                details: err instanceof Error ? err.message : String(err)
              }
            }));
          }
          
          if (onError) onError(err);
        });
    } catch (err) {
      console.error("[useVoiceRecorder] Error in stop recording process:", err);
      cleanupResources();
      setStatus("idle");
      
      if (opId) {
        window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
          detail: {
            id: opId,
            status: 'error',
            message: 'Error in recording stop process',
            details: err instanceof Error ? err.message : String(err)
          }
        }));
      }
      
      if (onError) onError(err);
    }
  }, [recorderInstance, elapsedTime, onRecordingComplete, onError, cleanupResources]);

  const clearRecording = () => {
    setRecordingBlob(null);
  };

  const recordingTime = formatTime(elapsedTime);

  // Clean up on unmount
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      cleanupResources();
    };
  }, [cleanupResources]);

  return {
    status,
    startRecording,
    stopRecording,
    clearRecording,
    recordingBlob,
    recordingTime,
  };
}

// Helper function to format time
function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");

  return `${formattedMinutes}:${formattedSeconds}`;
}

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Generate a random ID for the recording
function generateTempId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
