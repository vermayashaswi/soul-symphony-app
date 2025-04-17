
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
  const { toast } = useToast();

  useEffect(() => {
    let cleanup = () => {};
    
    if (isRecording) {
      const setupRecording = async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100, // Standard sample rate for better compatibility
              sampleSize: 16,    // Standard bit depth for better compatibility
              channelCount: 1,   // Mono for simpler processing and compatibility
            } 
          });
          
          setStream(mediaStream);
          
          const options = {
            type: 'audio',
            mimeType: 'audio/wav', // WAV format for better compatibility with OpenAI
            recorderType: StereoAudioRecorder,
            numberOfAudioChannels: 1, // Mono for simplicity and compatibility
            desiredSampRate: 44100,   // Standard sample rate
            checkForInactiveTracks: true,
            timeSlice: 1000, // Record in 1-second chunks for better stability
            audioBitsPerSecond: 128000, // Lower bitrate for smaller files
          };
          
          const rtcRecorder = new RecordRTC(mediaStream, options);
          rtcRecorder.startRecording();
          setRecorder(rtcRecorder);
          
          // Auto-stop after 15 seconds
          const timeout = setTimeout(() => {
            if (isRecording) {
              handleVoiceRecording();
            }
          }, 15000);
          
          cleanup = () => {
            clearTimeout(timeout);
            if (rtcRecorder) {
              rtcRecorder.stopRecording(() => {
                rtcRecorder.destroy();
                mediaStream.getTracks().forEach(track => track.stop());
              });
            }
          };
        } catch (error) {
          console.error("Error recording audio:", error);
          toast({
            title: "Recording error",
            description: "Could not access microphone. Check browser permissions.",
            variant: "destructive"
          });
        }
      };
      
      setupRecording();
    }
    
    return cleanup;
  }, [isRecording, toast]);
  
  const handleVoiceRecording = () => {
    if (isRecording && recorder) {
      recorder.stopRecording(() => {
        try {
          const blob = recorder.getBlob();
          console.log("[VoiceRecordingButton] Recording stopped, blob created:", {
            size: blob.size,
            type: blob.type,
            duration: (blob as any).duration || 'unknown'
          });
          
          // Verify the blob is valid
          if (blob.size < 100) {
            throw new Error("Recording produced an empty or invalid audio file");
          }
          
          // Add duration property to blob if missing
          if (!('duration' in blob)) {
            try {
              Object.defineProperty(blob, 'duration', {
                value: recordingTime / 1000, // Convert ms to seconds
                writable: false
              });
              console.log("[VoiceRecordingButton] Added duration property to blob:", recordingTime / 1000);
            } catch (err) {
              console.warn("[VoiceRecordingButton] Could not add duration to blob:", err);
            }
          }
          
          onStopRecording(blob);
        } catch (error) {
          console.error("[VoiceRecordingButton] Error getting blob:", error);
          toast({
            title: "Recording error",
            description: "Failed to process recording. Please try again.",
            variant: "destructive"
          });
        }
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        
        setRecorder(null);
      });
    } else {
      onStartRecording();
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
        disabled={isLoading}
        className={cn(
          "relative rounded-full flex items-center justify-center",
          isRecording ? "bg-red-500 hover:bg-red-600" : "",
          isRecording && "animate-pulse",
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
        ) : (
          <Mic className={`${size === "sm" ? "h-4 w-4" : "h-5 w-5"}`} />
        )}
        {isRecording && (
          <span className={`absolute ${size === "sm" ? "-bottom-5" : "-bottom-6"} text-xs font-medium`}>
            {formatTime(recordingTime)}
          </span>
        )}
      </Button>
    </div>
  );
};

export default VoiceRecordingButton;
