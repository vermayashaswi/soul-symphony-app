
import { useState, useRef, useEffect } from "react";
import { recordAudio } from "@/utils/audioRecorder";
import { validateAudioBlob } from "@/utils/audio/blob-utils";

interface UseVoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, tempId?: string) => void;
  onError?: (error: any) => void;
  maxDuration?: number;
}

export function useVoiceRecorder({
  onRecordingComplete,
  onError,
  maxDuration = 300
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

  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('[useVoiceRecorder] Starting recording');
      setStatus("acquiring_media");
      setElapsedTime(0);
      setAudioDuration(0);
      setRecordingBlob(null);
      
      const recorder = await recordAudio();
      recorderRef.current = recorder;
      
      setStatus("recording");
      const currentTime = Date.now();
      setStartTime(currentTime);
      
      // Update timer
      timerInterval.current = setInterval(() => {
        const current = Date.now();
        const elapsed = current - startTime;
        setElapsedTime(elapsed);
      }, 100);
      
      // Set maximum duration timeout
      if (maxDuration && maxDuration > 0) {
        maxDurationTimeout.current = setTimeout(() => {
          if (status === "recording") {
            console.log(`[useVoiceRecorder] Maximum duration (${maxDuration}s) reached`);
            stopRecording();
          }
        }, maxDuration * 1000);
      }
      
      console.log('[useVoiceRecorder] Recording started successfully');
    } catch (err) {
      console.error("[useVoiceRecorder] Error starting recording:", err);
      setStatus("idle");
      if (onError) onError(err);
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) {
      console.warn("[useVoiceRecorder] Cannot stop recording: No active recorder");
      return;
    }
    
    try {
      console.log('[useVoiceRecorder] Stopping recording');
      setStatus("stopping");
      
      cleanupRecording();
      
      const finalElapsedTime = Date.now() - startTime;
      setElapsedTime(finalElapsedTime);
      
      const { blob, duration } = await recorderRef.current.stop();
      console.log(`[useVoiceRecorder] Recording stopped. Duration: ${duration}s, Size: ${blob.size}`);
      
      const actualDuration = duration > 0 ? duration : finalElapsedTime / 1000;
      setAudioDuration(actualDuration);
      
      // Validate the blob
      const validation = validateAudioBlob(blob);
      if (!validation.isValid) {
        console.error('[useVoiceRecorder] Blob validation failed:', validation.errorMessage);
        throw new Error(validation.errorMessage || "Recording validation failed");
      }
      
      // Ensure blob has duration property
      let finalBlob = blob;
      if (!('duration' in blob) || (blob as any).duration === 0) {
        try {
          Object.defineProperty(finalBlob, 'duration', {
            value: actualDuration,
            writable: false,
            enumerable: true,
            configurable: false
          });
        } catch (error) {
          console.warn('[useVoiceRecorder] Could not add duration property:', error);
        }
      }
      
      setRecordingBlob(finalBlob);
      setStatus("idle");
      
      if (finalBlob.size > 0 && onRecordingComplete) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        console.log(`[useVoiceRecorder] Calling onRecordingComplete with tempId: ${tempId}`);
        onRecordingComplete(finalBlob, tempId);
      } else {
        console.error("[useVoiceRecorder] Recording failed: empty blob");
        if (onError) onError(new Error("Recording failed: empty blob"));
      }
    } catch (err) {
      console.error("[useVoiceRecorder] Error stopping recording:", err);
      setStatus("idle");
      if (onError) onError(err);
    } finally {
      recorderRef.current = null;
    }
  };

  const clearRecording = () => {
    setRecordingBlob(null);
    setAudioDuration(0);
  };

  return {
    status,
    startRecording,
    stopRecording,
    clearRecording,
    recordingBlob,
    recordingTime: formatTime(elapsedTime),
    elapsedTimeMs: elapsedTime,
    audioDuration,
  };
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");

  return `${formattedMinutes}:${formattedSeconds}`;
}
