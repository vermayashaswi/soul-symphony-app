
import { useState, useRef, useEffect } from "react";
import { recordAudio } from "@/utils/audioRecorder";
import { validateAudioBlob } from "@/utils/audio/blob-utils";

interface UseVoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, tempId?: string) => void;
  onError?: (error: any) => void;
  maxDuration?: number; // in seconds
}

export function useVoiceRecorder({
  onRecordingComplete,
  onError,
  maxDuration = 300 // 5 minutes default
}: UseVoiceRecorderProps) {
  const [status, setStatus] = useState<
    "idle" | "acquiring_media" | "recording" | "stopping"
  >("idle");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  
  const recorderRef = useRef<Awaited<ReturnType<typeof recordAudio>> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef<boolean>(false);

  // Clean up function
  const cleanupRecording = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
    
    if (maxDurationTimeout.current) {
      clearTimeout(maxDurationTimeout.current);
      maxDurationTimeout.current = null;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      // Dispatch operation start event for debugging
      const event = new CustomEvent('journalOperationStart', {
        detail: {
          type: 'recording',
          message: 'Starting voice recording'
        }
      });
      const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;
      
      setStatus("acquiring_media");
      setElapsedTime(0);
      setAudioDuration(0);
      setRecordingBlob(null);
      cancelledRef.current = false;
      
      // Set up new recorder
      const recorder = await recordAudio();
      recorderRef.current = recorder;
      
      // Start recording
      setStatus("recording");
      const currentTime = Date.now();
      setStartTime(currentTime);
      
      // Update timer at regular intervals
      timerInterval.current = setInterval(() => {
        const current = Date.now();
        const elapsed = current - startTime;
        setElapsedTime(elapsed);
      }, 100);
      
      // Set maximum duration timeout
      if (maxDuration && maxDuration > 0) {
        maxDurationTimeout.current = setTimeout(() => {
          if (status === "recording") {
            console.log(`[useVoiceRecorder] Maximum recording duration (${maxDuration}s) reached, stopping automatically`);
            stopRecording();
          }
        }, maxDuration * 1000);
      }
      
      if (opId) {
        window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
          detail: {
            id: opId,
            status: 'success'
          }
        }));
      }
      
      console.log('[useVoiceRecorder] Recording started successfully');
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
  };

  const cancelRecording = () => {
    console.log('[useVoiceRecorder] Cancelling recording');
    
    if (!recorderRef.current) {
      console.warn("[useVoiceRecorder] Cannot cancel recording: No active recorder");
      setStatus("idle");
      return;
    }
    
    try {
      // Set cancelled flag to prevent processing
      cancelledRef.current = true;
      
      // Stop the recording timer immediately
      cleanupRecording();
      
      // Stop the recorder without processing
      if (recorderRef.current.stream) {
        recorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      // Reset state immediately
      setStatus("idle");
      setRecordingBlob(null);
      setAudioDuration(0);
      setElapsedTime(0);
      
      console.log('[useVoiceRecorder] Recording cancelled successfully');
    } catch (err) {
      console.error("[useVoiceRecorder] Error cancelling recording:", err);
      setStatus("idle");
      if (onError) onError(err);
    } finally {
      // Clean up recorder reference
      recorderRef.current = null;
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) {
      console.warn("[useVoiceRecorder] Cannot stop recording: No active recorder");
      return;
    }
    
    try {
      // Dispatch operation event for debugging
      const event = new CustomEvent('journalOperationStart', {
        detail: {
          type: 'recording',
          message: 'Finishing recording and processing audio'
        }
      });
      const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;

      setStatus("stopping");
      
      // Stop the recording timer
      cleanupRecording();
      
      // Get the actual recording duration
      const finalElapsedTime = Date.now() - startTime;
      setElapsedTime(finalElapsedTime);
      console.log(`[useVoiceRecorder] Final elapsed time: ${finalElapsedTime/1000}s`);
      
      // Stop the recorder and get the audio blob
      const { blob, duration } = await recorderRef.current.stop();
      console.log(`[useVoiceRecorder] Recording stopped. Duration from recorder: ${duration}s, Elapsed time: ${finalElapsedTime/1000}s`);
      
      // Check if recording was cancelled during stop process
      if (cancelledRef.current) {
        console.log('[useVoiceRecorder] Recording was cancelled, skipping processing');
        setStatus("idle");
        setRecordingBlob(null);
        return;
      }
      
      // Set the duration from the recorder or fallback to elapsed time
      const actualDuration = duration > 0 ? duration : finalElapsedTime / 1000;
      setAudioDuration(actualDuration);
      
      // Validate the blob
      const validation = validateAudioBlob(blob);
      if (!validation.isValid) {
        console.error('[useVoiceRecorder] Blob validation failed:', validation.errorMessage);
        throw new Error(validation.errorMessage || "Recording validation failed");
      }
      
      // Ensure the blob has the duration property
      let finalBlob = blob;
      if (!('duration' in blob) || (blob as any).duration === 0) {
        console.log('[useVoiceRecorder] Adding missing duration to blob:', actualDuration);
        try {
          // Create a new blob with the duration property
          Object.defineProperty(finalBlob, 'duration', {
            value: actualDuration,
            writable: false,
            enumerable: true,
            configurable: false
          });
        } catch (error) {
          console.warn('[useVoiceRecorder] Could not add duration property directly:', error);
          // If we can't add directly, create a new blob
          const newBlob = new Blob([blob], { type: blob.type });
          try {
            Object.defineProperty(newBlob, 'duration', {
              value: actualDuration,
              writable: false,
              enumerable: true,
              configurable: false
            });
            finalBlob = newBlob;
          } catch (e) {
            console.error('[useVoiceRecorder] Failed to add duration to new blob as well:', e);
          }
        }
      }
      
      setRecordingBlob(finalBlob);
      setStatus("idle");
      
      if (finalBlob.size > 0) {
        if (onRecordingComplete) {
          const tempId = generateTempId();
          console.log(`[useVoiceRecorder] Calling onRecordingComplete with blob size: ${finalBlob.size}, duration: ${actualDuration}`);
          onRecordingComplete(finalBlob, tempId);
          
          if (opId) {
            window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
              detail: {
                id: opId,
                status: 'success',
                message: 'Recording completed',
                details: `Audio size: ${formatBytes(finalBlob.size)}, Duration: ${actualDuration}s, TempID: ${tempId}`
              }
            }));
          }
        }
      } else {
        console.error("[useVoiceRecorder] Recording failed: empty blob");
        
        if (opId) {
          window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
            detail: {
              id: opId,
              status: 'error',
              message: 'Recording failed',
              details: 'Empty audio blob received'
            }
          }));
        }
        
        if (onError) onError(new Error("Recording failed: empty blob"));
      }
    } catch (err) {
      console.error("[useVoiceRecorder] Error stopping recording:", err);
      setStatus("idle");
      
      if (onError) onError(err);
    } finally {
      // Clean up recorder reference
      recorderRef.current = null;
    }
  };

  const clearRecording = () => {
    setRecordingBlob(null);
    setAudioDuration(0);
    cancelledRef.current = false;
  };

  return {
    status,
    startRecording,
    stopRecording,
    cancelRecording, // New cancel method
    clearRecording,
    recordingBlob,
    recordingTime: formatTime(elapsedTime),
    elapsedTimeMs: elapsedTime,
    audioDuration,
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
