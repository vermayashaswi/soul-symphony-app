
import React, { useState, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { formatTime } from "@/utils/format-time"; 
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LanguageBackground } from "@/components/voice-recorder/MultilingualTextAnimation";
import { getAudioConfig, getRecorderOptions, RECORDING_LIMITS } from "@/utils/audio/recording-config";

interface VoiceRecordingButtonProps {
  isLoading?: boolean;
  isRecording?: boolean;
  recordingTime?: number;
  onStartRecording?: () => void;
  onStopRecording?: (blob: Blob) => void;
  onTranscriptionComplete?: (transcription: string) => void;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: string;
  className?: string;
  disabled?: boolean;
}

const VoiceRecordingButton: React.FC<VoiceRecordingButtonProps> = ({
  isLoading = false,
  isRecording = false,
  recordingTime = 0,
  onStartRecording = () => {},
  onStopRecording = () => {},
  onTranscriptionComplete,
  size = "icon",
  variant = "default",
  className,
  disabled = false
}) => {
  const [recorder, setRecorder] = useState<RecordRTC | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cleanup = () => {};
    
    if (isRecording) {
      const setupRecording = async () => {
        try {
          console.log("[VoiceRecordingButton] Starting recording setup");
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const isAndroid = /Android/.test(navigator.userAgent);
          const platform = isIOS ? 'ios' : (isAndroid ? 'android' : 'web');
          
          console.log(`[VoiceRecordingButton] Detected platform: ${platform}`);
          
          // Get audio configuration based on platform
          const audioConfig = getAudioConfig();
          console.log("[VoiceRecordingButton] Audio config:", audioConfig);
          
          // Request microphone access
          const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: audioConfig
          });
          
          setStream(mediaStream);
          console.log("[VoiceRecordingButton] MediaStream obtained successfully");
          
          // Get recorder options based on platform
          const options = getRecorderOptions(platform);
          console.log("[VoiceRecordingButton] Recorder options:", options);
          
          // Create and start recorder
          const rtcRecorder = new RecordRTC(mediaStream, {
            ...options,
            type: 'audio',
            recorderType: StereoAudioRecorder,
            numberOfAudioChannels: platform === 'ios' ? 1 : 2, // Mono for iOS, stereo for others
            desiredSampRate: platform === 'ios' ? 44100 : 48000,
            disableLogs: false
          });
          
          console.log("[VoiceRecordingButton] Starting recorder");
          rtcRecorder.startRecording();
          setRecorder(rtcRecorder);
          
          // Set recording time limit
          const timeout = setTimeout(() => {
            if (isRecording) {
              console.log("[VoiceRecordingButton] Maximum recording duration reached");
              toast({
                title: "Recording limit reached",
                description: "Maximum recording duration reached (5 minutes)",
                variant: "default"
              });
              handleVoiceRecording();
            }
          }, RECORDING_LIMITS.MAX_DURATION * 1000);
          
          cleanup = () => {
            console.log("[VoiceRecordingButton] Cleaning up recording");
            clearTimeout(timeout);
            if (rtcRecorder) {
              rtcRecorder.stopRecording(() => {
                rtcRecorder.destroy();
                mediaStream.getTracks().forEach(track => track.stop());
              });
            }
          };
        } catch (error) {
          console.error("[VoiceRecordingButton] Error recording audio:", error);
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
            description: "Could not process the recording. Please try again.",
            variant: "destructive"
          });
        }
      });
    } else {
      console.log("[VoiceRecordingButton] Starting recording");
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
