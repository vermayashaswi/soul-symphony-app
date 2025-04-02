
import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseAudioRecorderProps {
  maxDuration?: number;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  stream: MediaStream | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useAudioRecorder({
  maxDuration = 300
}: UseAudioRecorderProps = {}): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);

  const cleanupRecording = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }, [stream]);

  const startRecording = async () => {
    try {
      setAudioBlob(null);
      setRecordingTime(0);
      chunksRef.current = [];
      
      toast.loading('Accessing microphone...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 96000,
          sampleSize: 24,
          channelCount: 2,
        } 
      });
      
      toast.dismiss();
      toast.success('Microphone accessed. Recording started!');
      
      setStream(mediaStream);
      
      const mimeTypes = [
        'audio/wav',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          console.log(`Using media recorder MIME type: ${type}`);
          break;
        }
      }
      
      const options: MediaRecorderOptions = {
        bitsPerSecond: 320000
      };
      
      if (selectedMimeType) {
        options.mimeType = selectedMimeType;
      }
      
      const mediaRecorder = new MediaRecorder(mediaStream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log(`Recorded chunk: ${e.data.size} bytes`);
        }
      };
      
      mediaRecorder.onstop = () => {
        if (chunksRef.current.length === 0) {
          toast.error('No audio data recorded. Please try again.');
          setAudioBlob(null);
          return;
        }
        
        console.log(`Recording stopped, got ${chunksRef.current.length} chunks`);
        let totalSize = 0;
        chunksRef.current.forEach((chunk, i) => {
          console.log(`Chunk ${i}: size=${chunk.size}, type=${chunk.type}`);
          totalSize += chunk.size;
        });
        console.log(`Total audio size: ${totalSize} bytes`);
        
        const blob = new Blob(chunksRef.current, { type: selectedMimeType || 'audio/wav' });
        console.log('Recording stopped, blob size:', blob.size, 'blob type:', blob.type);
        setAudioBlob(blob);
        
        cleanupRecording();
        
        toast.success('Recording saved!');
      };
      
      setIsRecording(true);
      mediaRecorder.start(50);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      if (maxDuration > 0) {
        maxDurationTimerRef.current = window.setTimeout(() => {
          if (isRecording && mediaRecorderRef.current) {
            console.log(`Max recording duration of ${maxDuration}s reached, stopping automatically`);
            stopRecording();
          }
        }, maxDuration * 1000);
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.dismiss();
      toast.error('Could not access microphone. Please check permissions and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("Stopping recording...");
      try {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      } catch (error) {
        console.error("Error stopping recording:", error);
        toast.error("Error stopping recording. Please refresh and try again.");
      }
    }
  };

  return {
    isRecording,
    recordingTime,
    audioBlob,
    stream,
    startRecording,
    stopRecording
  };
}
