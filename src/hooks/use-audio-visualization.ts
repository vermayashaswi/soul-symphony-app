
import { useState, useRef, useEffect } from 'react';

interface UseAudioVisualizationProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

interface UseAudioVisualizationReturn {
  audioLevel: number;
  ripples: number[];
}

export function useAudioVisualization({
  stream,
  isRecording
}: UseAudioVisualizationProps): UseAudioVisualizationReturn {
  const [audioLevel, setAudioLevel] = useState(0);
  const [ripples, setRipples] = useState<number[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioLevelTimerRef = useRef<number | null>(null);

  // Set up audio analysis for visualization
  useEffect(() => {
    if (!stream || !isRecording) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyzerNode = audioContext.createAnalyser();
      analyzerNode.fftSize = 1024;
      analyzerRef.current = analyzerNode;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyzerNode);
      
      const dataArray = new Uint8Array(analyzerNode.frequencyBinCount);
      
      audioLevelTimerRef.current = window.setInterval(() => {
        if (analyzerRef.current) {
          analyzerRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const scaledLevel = Math.min(100, Math.max(0, avg * 1.5));
          
          setAudioLevel(scaledLevel);
          
          if (isRecording && avg > 50 && Math.random() > 0.7) {
            setRipples(prev => [...prev, Date.now()]);
          }
        }
      }, 100);
      
      return () => {
        if (audioLevelTimerRef.current) {
          clearInterval(audioLevelTimerRef.current);
          audioLevelTimerRef.current = null;
        }
        
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(console.error);
        }
      };
    } catch (error) {
      console.error('Error setting up audio visualization:', error);
      return undefined;
    }
  }, [stream, isRecording]);

  // Clean up ripples effect
  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => {
        setRipples(current => current.slice(1));
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [ripples]);

  return {
    audioLevel,
    ripples
  };
}
