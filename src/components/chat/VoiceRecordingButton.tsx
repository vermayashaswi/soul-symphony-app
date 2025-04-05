
import React, { useState, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { formatTime } from "@/utils/format-time"; 
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
              sampleRate: 96000,
              sampleSize: 24,
              channelCount: 2,
            } 
          });
          
          setStream(mediaStream);
          
          const options = {
            type: 'audio',
            mimeType: 'audio/wav',
            recorderType: StereoAudioRecorder,
            numberOfAudioChannels: 2,
            desiredSampRate: 96000,
            checkForInactiveTracks: true,
            timeSlice: 50, // Record in smaller chunks for real-time processing
            audioBitsPerSecond: 320000,
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
        const blob = recorder.getBlob();
        onStopRecording(blob);
        
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
  );
};

export default VoiceRecordingButton;
