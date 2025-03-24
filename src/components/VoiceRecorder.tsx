
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, ChevronRight, Loader2, AlertCircle, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onCancel?: () => void;
  className?: string;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioLevelTimerRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const [ripples, setRipples] = useState<number[]>([]);
  
  // Check for microphone permission on component mount
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately after checking permission
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (error) {
        console.error('Microphone permission error:', error);
        setHasPermission(false);
      }
    };
    
    checkMicPermission();
    
    // Cleanup function
    return () => {
      cleanupResources();
    };
  }, []);
  
  const cleanupResources = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioLevelTimerRef.current) {
      clearInterval(audioLevelTimerRef.current);
      audioLevelTimerRef.current = null;
    }
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
  };

  // Function to create audio processing setup for visualizations and noise reduction
  const setupAudioProcessing = (stream: MediaStream) => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create analyzer node for visualization
      const analyzerNode = audioContext.createAnalyser();
      analyzerNode.fftSize = 256;
      analyzerRef.current = analyzerNode;
      
      // Create source from stream
      const source = audioContext.createMediaStreamSource(stream);
      
      // If noise reduction is enabled, add filtering
      if (noiseReduction) {
        // High-pass filter to remove low-frequency noise
        const highpassFilter = audioContext.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = 80;
        highpassFilter.Q.value = 0.7;
        
        // Low-pass filter to remove high-frequency noise
        const lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = 8000;
        lowpassFilter.Q.value = 0.7;
        
        // Compressor to normalize volume
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        
        // Connect the nodes
        source.connect(highpassFilter);
        highpassFilter.connect(lowpassFilter);
        lowpassFilter.connect(compressor);
        compressor.connect(analyzerNode);
      } else {
        // Simple connection without filtering
        source.connect(analyzerNode);
      }
      
      // Start monitoring audio levels
      const dataArray = new Uint8Array(analyzerNode.frequencyBinCount);
      
      audioLevelTimerRef.current = window.setInterval(() => {
        if (analyzerRef.current) {
          analyzerRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const scaledLevel = Math.min(100, Math.max(0, avg * 1.5)); // Scale 0-255 to 0-100
          
          setAudioLevel(scaledLevel);
          
          // Add ripple based on audio level
          if (isRecording && avg > 50 && Math.random() > 0.7) {
            setRipples(prev => [...prev, Date.now()]);
          }
        }
      }, 100);
      
      return audioContext;
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      return null;
    }
  };
  
  const startRecording = async () => {
    try {
      // Reset state
      setAudioBlob(null);
      setRecordingTime(0);
      chunksRef.current = [];
      
      // Request microphone permission with user interaction
      toast.loading('Accessing microphone...');
      
      // Enhanced media constraints for better recording quality
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Use higher sample rate for better quality
          sampleRate: 48000,
          // Try to use higher bit depth
          sampleSize: 16,
          // Use stereo if available
          channelCount: 2
        } 
      });
      
      toast.dismiss();
      toast.success('Microphone accessed. Recording started!');
      
      // Save stream reference for cleanup
      streamRef.current = stream;
      
      // Set up audio processing
      setupAudioProcessing(stream);
      
      // Try to use the best available codec
      let options: MediaRecorderOptions = {};
      
      // Check what MIME types are supported to get the best quality
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];
      
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          options.mimeType = type;
          console.log(`Using media recorder MIME type: ${type}`);
          break;
        }
      }
      
      // Create MediaRecorder with best available options
      // Add higher bitrate for better quality, when supported
      const mediaRecorder = new MediaRecorder(stream, {
        ...options,
        bitsPerSecond: 128000 // 128 kbps for better audio quality
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up data handling with more frequent data collection
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      // Set up stop handler
      mediaRecorder.onstop = () => {
        if (chunksRef.current.length === 0) {
          toast.error('No audio data recorded. Please try again.');
          setAudioBlob(null);
          return;
        }
        
        const blob = new Blob(chunksRef.current, { type: options.mimeType || 'audio/webm' });
        console.log('Recording stopped, blob size:', blob.size);
        setAudioBlob(blob);
        
        // Clean up resources
        cleanupResources();
        
        toast.success('Recording saved!');
      };
      
      // Start recording with more frequent data collection (every 500ms)
      setIsRecording(true);
      mediaRecorder.start(500);
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Initial ripple
      setRipples([Date.now()]);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.dismiss();
      toast.error('Could not access microphone. Please check permissions and try again.');
      setHasPermission(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear ripples
      setRipples([]);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioBlob) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    } else {
      // Create a new audio element each time to ensure fresh playback
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      
      // Setup audio duration and progress tracking
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          setAudioDuration(audioRef.current.duration);
        }
      };
      
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          
          // Setup progress tracking timer
          playbackTimerRef.current = window.setInterval(() => {
            if (audioRef.current) {
              const currentTime = audioRef.current.currentTime;
              const duration = audioRef.current.duration;
              setPlaybackProgress(Math.floor((currentTime / duration) * 100));
            }
          }, 100); // Update progress more frequently (every 100ms)
        })
        .catch(err => {
          console.error('Error playing audio:', err);
          toast.error('Failed to play the recording.');
        });
    }
  };
  
  const processRecording = async () => {
    if (!audioBlob) {
      toast.error('No recording to process.');
      return;
    }
    
    if (audioBlob.size < 1000) { // 1KB minimum
      toast.error('Recording is too short. Please try again.');
      return;
    }
    
    try {
      setIsProcessing(true);
      toast.loading('Processing your journal entry with advanced AI...');
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onerror = function() {
        console.error('Error reading audio file:', reader.error);
        toast.dismiss();
        toast.error('Error reading audio file. Please try again.');
        setIsProcessing(false);
      };
      
      reader.onloadend = async function() {
        try {
          const base64Audio = reader.result as string;
          
          // Validate base64 data
          if (!base64Audio || base64Audio.length < 100) {
            console.error('Invalid base64 audio data');
            toast.dismiss();
            toast.error('Invalid audio data. Please try again.');
            setIsProcessing(false);
            return;
          }
          
          // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
          const base64String = base64Audio.split(',')[1]; 
          
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            toast.dismiss();
            toast.error('You must be signed in to save journal entries.');
            setIsProcessing(false);
            return;
          }

          console.log("Sending audio to transcribe function...");
          console.log("Audio base64 length:", base64String.length);
          
          // Send to the Edge Function
          const { data, error } = await supabase.functions.invoke('transcribe-audio', {
            body: {
              audio: base64String,
              userId: user.id
            }
          });

          if (error) {
            console.error('Transcription error:', error);
            toast.dismiss();
            toast.error(`Failed to transcribe audio: ${error.message || 'Unknown error'}`);
            setIsProcessing(false);
            return;
          }

          console.log("Transcription response:", data);
          
          if (data && data.success) {
            toast.dismiss();
            toast.success('Journal entry saved successfully!');
            
            if (onRecordingComplete) {
              onRecordingComplete(audioBlob);
            }
            
            setAudioBlob(null);
          } else {
            toast.dismiss();
            toast.error(data?.error || 'Failed to process recording');
          }
        } catch (err) {
          console.error('Error processing audio:', err);
          toast.dismiss();
          toast.error(`Failed to process audio: ${err.message || 'Unknown error'}`);
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (error) {
      console.error('Error processing recording:', error);
      toast.dismiss();
      toast.error(`Error processing recording: ${error.message || 'Unknown error'}`);
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Set up audio ended handler
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = null;
        }
      };
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
      }
    };
  }, [audioBlob]);
  
  // Request permissions if they were denied
  const requestPermissions = async () => {
    try {
      toast.loading('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      toast.dismiss();
      toast.success('Microphone permission granted!');
    } catch (error) {
      console.error('Failed to get permission:', error);
      toast.dismiss();
      toast.error('Microphone permission denied. Please adjust your browser settings.');
    }
  };

  // Manage ripples lifecycle
  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => {
        setRipples(current => current.slice(1));
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [ripples]);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <audio 
        ref={audioRef} 
        className="hidden"
      />
      
      <div className="flex items-center justify-center mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            checked={noiseReduction}
            onChange={() => setNoiseReduction(!noiseReduction)}
            disabled={isRecording}
          />
          <div className={`h-5 w-10 rounded-full transition-colors ${noiseReduction ? 'bg-primary' : 'bg-gray-300'} relative`}>
            <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${noiseReduction ? 'translate-x-5' : ''}`} />
          </div>
          <span className="ml-2 text-sm">Noise Reduction</span>
        </label>
      </div>
      
      <div className="relative flex items-center justify-center my-8">
        <AnimatePresence>
          {ripples.map((id) => (
            <motion.div
              key={id}
              initial={{ scale: 0.5, opacity: 0.7 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="absolute rounded-full bg-primary/30"
              style={{ width: '100%', height: '100%' }}
            />
          ))}
        </AnimatePresence>
        
        {isRecording && (
          <motion.div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="h-full w-full rounded-full border-4 border-transparent relative">
              <div className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(rgba(147, 51, 234, ${Math.min(0.8, audioLevel / 100 + 0.1)}) ${audioLevel}%, transparent ${audioLevel}%)`,
                  transform: 'rotate(-90deg)',
                  transition: 'all 0.2s ease'
                }}
              />
            </div>
          </motion.div>
        )}
        
        {hasPermission === false ? (
          <motion.button
            onClick={requestPermissions}
            className="relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg bg-red-500 border-red-600 w-20 h-20"
            whileTap={{ scale: 0.95 }}
          >
            <Mic className="w-8 h-8 text-white" />
          </motion.button>
        ) : (
          <motion.button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={cn(
              "relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg",
              isRecording 
                ? "bg-red-500 border-red-600 w-16 h-16" 
                : "bg-primary hover:bg-primary/90 border-primary/20 w-20 h-20",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
            whileTap={{ scale: 0.95 }}
            animate={isRecording ? { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 1.5 } } : {}}
          >
            {isRecording ? (
              <Square className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </motion.button>
        )}
      </div>
      
      <AnimatePresence mode="wait">
        {isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center"
          >
            <div className="flex items-center gap-2 text-red-500 font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span>Recording</span>
            </div>
            <p className="text-lg font-mono mt-1">{formatTime(recordingTime)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <AlertCircle className="h-3 w-3 inline-block mr-1" />
              Speak clearly for best results
            </p>
          </motion.div>
        ) : audioBlob ? (
          <motion.div 
            key="playback"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-3 w-full max-w-xs"
          >
            <div className="w-full">
              <Button 
                onClick={togglePlayback} 
                variant="outline"
                disabled={isProcessing}
                className="rounded-full h-10 px-4 flex items-center gap-2 w-full mb-2"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Play Recording</span>
                  </>
                )}
              </Button>
              
              {/* Playback progress indicator */}
              {audioBlob && (
                <div className="w-full space-y-1">
                  <Progress value={playbackProgress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatTime(Math.floor((playbackProgress / 100) * (audioDuration || 0)))}
                    </span>
                    <span>{formatTime(Math.floor(audioDuration || 0))}</span>
                  </div>
                </div>
              )}
            </div>
            
            <Button 
              onClick={processRecording}
              disabled={isProcessing}
              className="w-full mt-2 rounded-lg flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing with AI...</span>
                </>
              ) : (
                <>
                  <span>Save Entry</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </motion.div>
        ) : hasPermission === false ? (
          <motion.p
            key="permission"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center text-muted-foreground"
          >
            Microphone access is required for recording
          </motion.p>
        ) : (
          <motion.p
            key="instruction"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center text-muted-foreground"
          >
            Tap the microphone to start recording
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VoiceRecorder;
