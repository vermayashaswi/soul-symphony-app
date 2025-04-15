
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

  const startRecording = useCallback(async () => {
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
      console.log('Starting audio recording - acquiring media');
      
      // Use our custom recorder instead of RecordRTC
      const recorder = await recordAudio();
      setRecorderInstance(recorder);
      setMediaStream(recorder.stream);
      
      // Start timer
      const now = Date.now();
      setStartTime(now);
      setStatus("recording");
      console.log('Audio recording started successfully at', now);
      
      // Update timer at regular intervals
      timerInterval.current = setInterval(() => {
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
      console.error("Error starting recording:", err);
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
  }, []);

  const stopRecording = useCallback(() => {
    if (!recorderInstance) {
      console.error('No recorder instance to stop');
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
    console.log('Stopping audio recording');
    
    // Store final recording duration in seconds - this is critical
    const finalRecordingDuration = recordingDurationRef.current / 1000;
    console.log(`Final recording UI duration: ${finalRecordingDuration} seconds`);
    
    try {
      recorderInstance.stop()
        .then(({ blob }: { blob: Blob }) => {
          console.log(`Recording stopped, blob size: ${blob.size}, type: ${blob.type}`);
          
          // Check for existing duration property
          const existingDuration = (blob as any).duration;
          console.log(`Blob received with duration: ${existingDuration !== undefined ? existingDuration : 'not set'}`);
          
          // Always override the duration property to ensure it's correct
          let blobToUse = blob;
          
          // Create a new blob to ensure the duration property sticks
          const newBlob = new Blob([blob], { type: blob.type });
          Object.defineProperty(newBlob, 'duration', {
            value: Math.max(0.5, finalRecordingDuration),
            writable: false,
            configurable: true,
            enumerable: true
          });
          
          // Verify duration is set correctly
          const newDuration = (newBlob as any).duration;
          console.log(`Final blob duration after explicit setting: ${newDuration}s`);
          blobToUse = newBlob;
          
          setRecordingBlob(blobToUse);
          
          if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
            setMediaStream(null);
          }
          
          if (timerInterval.current) {
            clearInterval(timerInterval.current);
            timerInterval.current = null;
          }
          
          setStatus("idle");
          
          // Even if blob is small, try to process it
          if (blobToUse) {
            const tempId = generateTempId();
            
            // Verify duration before passing to callback
            const blobDuration = (blobToUse as any).duration;
            console.log(`Processing audio blob: ${formatBytes(blobToUse.size)}, UI duration: ${formatTime(elapsedTime)}, blob.duration: ${blobDuration}s`);
            
            // Make one final check to ensure duration meets minimum requirement
            if (blobDuration === undefined || blobDuration < 0.1) {
              console.warn(`Audio duration missing or too short (${blobDuration}s), enforcing minimum duration`);
              
              // One last attempt with a completely new blob
              const finalBlob = new Blob([blobToUse], { type: blobToUse.type });
              // Use a different technique for setting the duration
              (finalBlob as any).duration = Math.max(0.5, finalRecordingDuration);
              console.log(`Created final blob with forced duration: ${(finalBlob as any).duration}s`);
              
              // Double check one last time
              if ((finalBlob as any).duration >= 0.5) {
                onRecordingComplete(finalBlob, tempId);
              } else {
                // Last resort - add duration in a way that's hard to ignore
                const lastResortBlob = new Blob([blobToUse], { type: blobToUse.type });
                Object.defineProperties(lastResortBlob, {
                  'duration': {
                    value: Math.max(0.5, finalRecordingDuration),
                    enumerable: true,
                    configurable: false,
                    writable: false
                  },
                  '_duration': {
                    value: Math.max(0.5, finalRecordingDuration),
                    enumerable: true
                  },
                  'recordingDuration': {
                    value: Math.max(0.5, finalRecordingDuration), 
                    enumerable: true
                  }
                });
                console.log(`LAST RESORT: Created blob with multiple duration properties: ${(lastResortBlob as any).duration}s`);
                onRecordingComplete(lastResortBlob, tempId);
              }
            } else {
              onRecordingComplete(blobToUse, tempId);
            }
          } else {
            console.error("Recording failed: no blob");
            if (onError) onError(new Error("Recording failed: no blob"));
          }
        })
        .catch((err: any) => {
          console.error("Error stopping recording:", err);
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
      console.error("Error in stop recording process:", err);
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
  }, [recorderInstance, mediaStream, elapsedTime, onRecordingComplete, onError]);

  const clearRecording = () => {
    setRecordingBlob(null);
  };

  const recordingTime = formatTime(elapsedTime);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      
      if (recorderInstance) {
        try {
          if (recorderInstance.getState() === 'recording') {
            recorderInstance.stop();
          }
        } catch (e) {
          console.error('Error cleaning up recorder:', e);
        }
      }
    };
  }, [mediaStream, recorderInstance]);

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
