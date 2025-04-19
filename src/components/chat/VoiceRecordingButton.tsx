
import React, { useState, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { formatTime } from "@/utils/format-time"; 
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LanguageBackground } from "@/components/voice-recorder/MultilingualTextAnimation";

interface VoiceRecordingButtonProps {
  isLoading: boolean;
  isRecording: boolean;
  recordingTime: number;
  onStartRecording: () => void;
  onStopRecording: (blob: Blob) => void;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

const VoiceRecordingButton: React.FC<VoiceRecordingButtonProps> = ({
  isLoading,
  isRecording,
  recordingTime,
  onStartRecording,
  onStopRecording,
  size = "icon",
  className
}) => {
  const [recorder, setRecorder] = useState<RecordRTC | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'initial' | 'recording' | 'processing'>('initial');
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [audioActive, setAudioActive] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const { toast } = useToast();

  // Minimum and maximum recording times
  const MIN_RECORDING_TIME = 1500; // Minimum 1.5 seconds
  const MAX_RECORDING_TIME = 60000; // Maximum 60 seconds
  const WARNING_TIME = 45000; // Warn at 45 seconds

  useEffect(() => {
    let statusCheckInterval: NodeJS.Timeout | null = null;
    let cleanup = () => {};
    
    if (isRecording) {
      setRecordingStatus('recording');
      
      const setupRecording = async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100,
              sampleSize: 16,
              channelCount: 1,
            } 
          });
          
          setStream(mediaStream);
          setAudioActive(true);
          setRecordingError(null);
          setRecordingStartTime(Date.now());
          
          // Check audio levels intermittently to ensure recording is working
          let silentFrames = 0;
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(mediaStream);
          const analyzer = audioContext.createAnalyser();
          analyzer.fftSize = 256;
          source.connect(analyzer);
          
          const bufferLength = analyzer.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          // Check audio levels every second
          statusCheckInterval = setInterval(() => {
            analyzer.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            
            if (average < 5) { // Very low audio level
              silentFrames++;
              console.log(`Low audio detected (${silentFrames} frames)`);
              
              // If 5 consecutive silent frames, warn user
              if (silentFrames >= 5) {
                toast({
                  title: "Low audio detected",
                  description: "Your microphone might not be picking up audio correctly",
                  duration: 3000
                });
                silentFrames = 0; // Reset to avoid repeated warnings
              }
            } else {
              silentFrames = 0; // Reset counter if audio is detected
            }
          }, 1000);
          
          const options = {
            type: 'audio',
            mimeType: 'audio/wav', // WAV format for better compatibility with OpenAI
            recorderType: StereoAudioRecorder,
            numberOfAudioChannels: 1,
            desiredSampRate: 44100,
            checkForInactiveTracks: true,
            timeSlice: 1000, // Record in 1-second chunks for better stability
            audioBitsPerSecond: 128000,
          };
          
          const rtcRecorder = new RecordRTC(mediaStream, options);
          rtcRecorder.startRecording();
          setRecorder(rtcRecorder);
          
          // Auto-stop after MAX_RECORDING_TIME
          const timeout = setTimeout(() => {
            if (isRecording) {
              console.log(`Maximum recording time (${MAX_RECORDING_TIME}ms) reached, stopping automatically`);
              handleVoiceRecording();
            }
          }, MAX_RECORDING_TIME);
          
          // Warn user when approaching max time
          const warningTimeout = setTimeout(() => {
            if (isRecording) {
              toast({
                title: "Recording time limit approaching",
                description: "Your recording will automatically stop in 15 seconds",
                duration: 5000
              });
            }
          }, WARNING_TIME);
          
          cleanup = () => {
            clearTimeout(timeout);
            clearTimeout(warningTimeout);
            if (statusCheckInterval) clearInterval(statusCheckInterval);
            
            if (rtcRecorder) {
              rtcRecorder.stopRecording(() => {
                rtcRecorder.destroy();
                mediaStream.getTracks().forEach(track => track.stop());
              });
            }
            audioContext.close();
          };
        } catch (error) {
          console.error("Error recording audio:", error);
          setRecordingError("Microphone access failed");
          setRecordingStatus('initial');
          
          toast({
            title: "Recording error",
            description: "Could not access microphone. Check browser permissions.",
            variant: "destructive"
          });
        }
      };
      
      setupRecording();
    }
    
    return () => {
      cleanup();
      if (statusCheckInterval) clearInterval(statusCheckInterval);
    };
  }, [isRecording, toast]);
  
  // Effect to check if recording time is too short
  useEffect(() => {
    if (!isRecording && recordingStartTime && recordingTime < MIN_RECORDING_TIME / 10) { // Convert to centiseconds
      setRecordingError("Recording too short");
      
      toast({
        title: "Recording too short",
        description: `Please record for at least ${MIN_RECORDING_TIME/1000} seconds`,
        duration: 3000
      });
    }
  }, [isRecording, recordingStartTime, recordingTime, toast]);
  
  const handleVoiceRecording = () => {
    if (isRecording && recorder) {
      // Check if recording is too short
      const recordingDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;
      
      if (recordingDuration < MIN_RECORDING_TIME) {
        console.log(`Recording too short (${recordingDuration}ms), continuing to record until minimum time`);
        
        // Show toast to inform user
        toast({
          title: "Recording too short",
          description: `Please record for at least ${MIN_RECORDING_TIME/1000} seconds`,
          duration: 2000
        });
        
        // Continue recording until minimum time is reached
        setTimeout(() => {
          stopRecording();
        }, MIN_RECORDING_TIME - recordingDuration);
        
        return;
      }
      
      stopRecording();
    } else {
      onStartRecording();
    }
  };
  
  const stopRecording = () => {
    setRecordingStatus('processing');
    
    if (recorder) {
      recorder.stopRecording(() => {
        try {
          const blob = recorder.getBlob();
          
          // Verify blob is valid
          if (!blob || blob.size === 0) {
            console.error("Recording failed: empty blob");
            setRecordingError("Recording failed: no audio data");
            setRecordingStatus('initial');
            
            toast({
              title: "Recording failed",
              description: "No audio data captured. Please try again.",
              variant: "destructive"
            });
            return;
          }
          
          // Add duration property to blob if missing
          if (!('duration' in blob)) {
            const recordingDuration = recordingStartTime ? (Date.now() - recordingStartTime) / 1000 : 0;
            Object.defineProperty(blob, 'duration', {
              value: recordingDuration,
              writable: false,
              enumerable: true
            });
          }
          
          console.log(`Recording complete: ${blob.size} bytes, duration: ${(blob as any).duration}s`);
          
          onStopRecording(blob);
          
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
          }
          
          setRecorder(null);
          setRecordingStatus('initial');
        } catch (error) {
          console.error("Error processing recording:", error);
          setRecordingError("Error processing recording");
          setRecordingStatus('initial');
          
          toast({
            title: "Processing error",
            description: "Error processing recording. Please try again.",
            variant: "destructive"
          });
        }
      });
    }
  };
  
  return (
    <div className="relative">
      {isRecording && (
        <div className="absolute -z-10 inset-0 overflow-hidden rounded-full" style={{ 
          width: size === "sm" ? "90px" : "110px", 
          height: size === "sm" ? "90px" : "110px",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)"
        }}>
          <LanguageBackground contained={true} />
        </div>
      )}
      
      <Button 
        type="button" 
        size={size} 
        variant={isRecording ? "destructive" : "default"}
        onClick={handleVoiceRecording}
        disabled={isLoading || recordingStatus === 'processing'}
        className={cn(
          "relative rounded-full flex items-center justify-center",
          isRecording ? "bg-red-500 hover:bg-red-600" : "",
          isRecording && "animate-pulse",
          recordingStatus === 'processing' && "opacity-70",
          className
        )}
        style={{
          width: size === "sm" ? "48px" : "64px",
          height: size === "sm" ? "48px" : "64px",
          transition: "all 0.3s ease"
        }}
      >
        {isRecording ? (
          <Square className={`${size === "sm" ? "h-4 w-4" : "h-5 w-5"} text-white`} />
        ) : recordingStatus === 'processing' ? (
          <Mic className={`${size === "sm" ? "h-4 w-4" : "h-5 w-5"} animate-pulse`} />
        ) : (
          <Mic className={`${size === "sm" ? "h-4 w-4" : "h-5 w-5"}`} />
        )}
        {isRecording && (
          <span className={`absolute ${size === "sm" ? "-bottom-5" : "-bottom-6"} text-xs font-medium`}>
            {formatTime(recordingTime)}
          </span>
        )}
        {recordingStatus === 'processing' && (
          <span className={`absolute ${size === "sm" ? "-bottom-5" : "-bottom-6"} text-xs font-medium`}>
            Processing...
          </span>
        )}
      </Button>
      
      {recordingError && (
        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-red-50 px-2 py-1 rounded text-xs text-red-600 whitespace-nowrap">
          {recordingError}
        </div>
      )}
    </div>
  );
};

export default VoiceRecordingButton;
