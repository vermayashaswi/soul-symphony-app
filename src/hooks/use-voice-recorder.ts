import { useState, useRef, useEffect } from "react";
import RecordRTC, { StereoAudioRecorder } from "recordrtc";

interface UseVoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, tempId?: string, useGoogleSTT?: boolean) => void;
  onError?: (error: any) => void;
  useGoogleSTT?: boolean;
}

export function useVoiceRecorder({
  onRecordingComplete,
  onError,
  useGoogleSTT = false,
}: UseVoiceRecorderProps) {
  const [status, setStatus] = useState<
    "idle" | "acquiring_media" | "recording" | "stopping"
  >("idle");
  const [recorder, setRecorder] = useState<RecordRTC | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);

      const recorder = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/webm",
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 16000,
      });

      recorder.startRecording();
      setRecorder(recorder);
      setStatus("recording");
      setStartTime(Date.now());

      // Update timer at regular intervals
      timerInterval.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
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
  };

  const stopRecording = () => {
    if (!recorder) return;
    
    // Dispatch operation event for debugging
    const event = new CustomEvent('journalOperationStart', {
      detail: {
        type: 'recording',
        message: 'Finishing recording and processing audio'
      }
    });
    const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;

    setStatus("stopping");
    
    try {
      recorder.stopRecording(() => {
        const blob = recorder.getBlob();
        setRecordingBlob(blob);
        
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop());
          setMediaStream(null);
        }
        
        if (timerInterval.current) {
          clearInterval(timerInterval.current);
          timerInterval.current = null;
        }
        
        setStatus("idle");
        
        if (blob.size > 0) {
          if (onRecordingComplete) {
            const tempId = generateTempId();
            onRecordingComplete(blob, tempId, useGoogleSTT);
            
            if (opId) {
              window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
                detail: {
                  id: opId,
                  status: 'success',
                  message: 'Recording completed',
                  details: `Audio size: ${formatBytes(blob.size)}, Duration: ${formatTime(elapsedTime)}, TempID: ${tempId}, Using Google STT: ${useGoogleSTT ? 'Yes' : 'No'}`
                }
              }));
            }
          }
        } else {
          console.error("Recording failed: empty blob");
          
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
      });
    } catch (err) {
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
    }
  };

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
    };
  }, []);

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
