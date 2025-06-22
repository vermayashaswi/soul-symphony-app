
import React, { useState, useEffect } from "react";
import { Mic, Square, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { formatTime } from "@/utils/format-time"; 
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LanguageBackground } from "@/components/voice-recorder/MultilingualTextAnimation";
import { getAudioConfig, getRecorderOptions, RECORDING_LIMITS } from "@/utils/audio/recording-config";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTWAMicrophonePermission } from "@/hooks/useTWAMicrophonePermission";
import { detectTWAEnvironment } from "@/utils/twaDetection";

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
  const { isActive, isInStep } = useTutorial();
  const twaEnv = detectTWAEnvironment();
  
  // Use TWA-specific permission handling
  const {
    hasPermission: twaHasPermission,
    canRequest: twaCanRequest,
    requiresSettings: twaRequiresSettings,
    requestPermission: twaRequestPermission,
    openSettings: twaOpenSettings,
    getStatusMessage,
    isRequestingPermission
  } = useTWAMicrophonePermission();
  
  // Check if we're in tutorial step 5
  const isInTutorialStep = isActive && isInStep(5);
  
  // If we're in tutorial step 5, don't render the component at all
  if (isInTutorialStep) {
    return null;
  }

  // Use TWA permission state if in TWA environment
  const effectiveHasPermission = (twaEnv.isTWA || twaEnv.isStandalone) ? twaHasPermission : true;
  const effectiveCanRequest = (twaEnv.isTWA || twaEnv.isStandalone) ? twaCanRequest : true;
  const shouldShowSettings = (twaEnv.isTWA || twaEnv.isStandalone) ? twaRequiresSettings : false;

  useEffect(() => {
    let cleanup = () => {};
    
    if (isRecording) {
      const setupRecording = async () => {
        try {
          console.log("[VoiceRecordingButton] Starting recording setup");
          
          // Check permission first in TWA environment
          if ((twaEnv.isTWA || twaEnv.isStandalone) && !twaHasPermission) {
            console.log("[VoiceRecordingButton] No permission in TWA environment");
            toast({
              title: "Microphone access required",
              description: getStatusMessage(),
              variant: "destructive"
            });
            return;
          }
          
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
          
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            if (twaEnv.isTWA || twaEnv.isStandalone) {
              toast({
                title: "Microphone access blocked",
                description: "Please enable microphone in your app settings",
                variant: "destructive",
                action: shouldShowSettings ? {
                  altText: "Open Settings",
                  onClick: twaOpenSettings
                } : undefined
              });
            } else {
              toast({
                title: "Microphone access denied",
                description: "Please allow microphone access and try again",
                variant: "destructive"
              });
            }
          } else {
            toast({
              title: "Recording error",
              description: "Could not access microphone. Check browser permissions.",
              variant: "destructive"
            });
          }
        }
      };
      
      setupRecording();
    }
    
    return cleanup;
  }, [isRecording, toast, twaEnv, twaHasPermission, getStatusMessage, shouldShowSettings, twaOpenSettings]);
  
  const handleVoiceRecording = async () => {
    if (isRecording && recorder) {
      console.log("[VoiceRecordingButton] Stopping recording");
      recorder.stopRecording(() => {
        const blob = recorder.getBlob();
        console.log("[VoiceRecordingButton] Recording stopped, blob size:", blob.size);
        
        // Add duration to blob for better processing
        Object.defineProperty(blob, 'duration', {
          value: recordingTime
        });
        
        onStopRecording(blob);
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        
        setRecorder(null);
      });
    } else {
      // Check permission before starting recording in TWA environment
      if ((twaEnv.isTWA || twaEnv.isStandalone) && !twaHasPermission) {
        if (twaCanRequest) {
          const granted = await twaRequestPermission();
          if (granted) {
            console.log("[VoiceRecordingButton] Permission granted, starting recording");
            onStartRecording();
          }
        } else if (shouldShowSettings) {
          toast({
            title: "Microphone access required",
            description: "Please enable microphone in your app settings",
            variant: "destructive",
            action: {
              altText: "Open Settings",
              onClick: twaOpenSettings
            }
          });
        }
        return;
      }
      
      console.log("[VoiceRecordingButton] Starting recording");
      onStartRecording();
    }
  };
  
  // Show permission request UI if needed
  if ((twaEnv.isTWA || twaEnv.isStandalone) && effectiveHasPermission === false) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <Button 
          type="button" 
          size={size} 
          variant="destructive"
          onClick={effectiveCanRequest ? twaRequestPermission : undefined}
          disabled={isLoading || isRequestingPermission || !effectiveCanRequest}
          className={cn(
            "relative rounded-full flex items-center justify-center",
            className
          )}
          style={{
            width: size === "sm" ? "48px" : "64px",
            height: size === "sm" ? "48px" : "64px",
            backgroundColor: "#dc2626"
          }}
        >
          <Mic className={`${size === "sm" ? "h-4 w-4" : "h-5 w-5"} text-white`} />
        </Button>
        
        {shouldShowSettings && (
          <Button
            onClick={twaOpenSettings}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <Settings className="w-3 h-3 mr-1" />
            Settings
          </Button>
        )}
      </div>
    );
  }
  
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
          transition: "all 0.3s ease",
          backgroundColor: "#000000" // Ensure black background
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
