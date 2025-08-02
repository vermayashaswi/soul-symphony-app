import React, { useState, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { formatTime } from "@/utils/format-time"; 
import { cn } from "@/lib/utils";
import { LanguageBackground } from "@/components/voice-recorder/MultilingualTextAnimation";
import { getAudioConfig, getRecorderOptions, RECORDING_LIMITS } from "@/utils/audio/recording-config";
import { useTutorial } from "@/contexts/TutorialContext";
import { logger } from '@/utils/logger';
import { TOAST_MESSAGES, showErrorToast, showInfoToast } from '@/utils/toast-messages';

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
  const { isInStep, tutorialCompleted, isActive } = useTutorial();
  
  const componentLogger = logger.createLogger('VoiceRecordingButton');
  
  // Check if we're in tutorial step 5 (chat) - hide the component
  const isInTutorialStep5 = isActive && isInStep(5);
  
  // Only show tutorial styling when in tutorial step 3 AND tutorial is not completed
  const shouldAddTutorialClass = isInStep(3) && !tutorialCompleted;
  
  // Enhanced check: If we're in tutorial step 5, don't render at all
  if (isInTutorialStep5) {
    componentLogger.debug('Hidden during tutorial step 5 (chat)');
    return null;
  }
  
  useEffect(() => {
    let cleanup = () => {};
    
    if (isRecording) {
      const setupRecording = async () => {
        try {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const isAndroid = /Android/.test(navigator.userAgent);
          const platform = isIOS ? 'ios' : (isAndroid ? 'android' : 'web');
          
          const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: getAudioConfig()
          });
          
          setStream(mediaStream);
          
          const options = getRecorderOptions(platform);
          const rtcRecorder = new RecordRTC(mediaStream, options);
          rtcRecorder.startRecording();
          setRecorder(rtcRecorder);
          
          const timeout = setTimeout(() => {
            if (isRecording) {
              showInfoToast("Recording limit reached", "Maximum recording duration reached (5 minutes)");
              handleVoiceRecording();
            }
          }, RECORDING_LIMITS.MAX_DURATION * 1000);
          
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
          componentLogger.error("Error recording audio", error);
          showErrorToast("Recording error", "Could not access microphone. Check browser permissions.");
        }
      };
      
      setupRecording();
    }
    
    return cleanup;
  }, [isRecording]);
  
  const handleVoiceRecording = () => {
    if (isRecording && recorder) {
      recorder.stopRecording(() => {
        try {
          const blob = recorder.getBlob();
          componentLogger.debug("Recording stopped, blob created", {
            size: blob.size,
            type: blob.type,
            duration: (blob as any).duration || 'unknown'
          });
          
          if (blob.size < 100) {
            throw new Error("Recording produced an empty or invalid audio file");
          }
          
          if (!('duration' in blob)) {
            try {
              Object.defineProperty(blob, 'duration', {
                value: recordingTime / 1000,
                writable: false
              });
              componentLogger.debug("Added duration property to blob", { duration: recordingTime / 1000 });
            } catch (err) {
              componentLogger.warn("Could not add duration to blob", err);
            }
          }
          
          onStopRecording(blob);
        } catch (error) {
          componentLogger.error("Error getting blob", error);
          showErrorToast("Recording error", "Failed to process recording. Please try again.");
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
          shouldAddTutorialClass ? "tutorial-target record-entry-tab" : "",
          className
        )}
        style={{
          width: size === "sm" ? "48px" : "64px",
          height: size === "sm" ? "48px" : "64px",
          transition: "all 0.3s ease",
          boxShadow: shouldAddTutorialClass ? "0 0 20px 10px var(--color-theme)" : undefined,
          backgroundColor: "#000000"
        }}
        data-tutorial-target={shouldAddTutorialClass ? "record-entry" : undefined}
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
