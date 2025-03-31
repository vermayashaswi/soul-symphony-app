
import React, { useState, useEffect } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { formatTime } from "@/utils/format-time"; // Updated import to use existing utility
import { useToast } from "@/hooks/use-toast";

interface VoiceRecordingButtonProps {
  isLoading: boolean;
  isRecording: boolean;
  recordingTime: number;
  onStartRecording: () => void;
  onStopRecording: (blob: Blob) => void;
}

const VoiceRecordingButton: React.FC<VoiceRecordingButtonProps> = ({
  isLoading,
  isRecording,
  recordingTime,
  onStartRecording,
  onStopRecording
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
            timeSlice: 50,
            audioBitsPerSecond: 320000,
          };
          
          const rtcRecorder = new RecordRTC(mediaStream, options);
          rtcRecorder.startRecording();
          setRecorder(rtcRecorder);
          
          toast({
            title: "Recording started",
            description: "Recording for up to 15 seconds. Speak clearly.",
          });
          
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
      size="icon" 
      variant={isRecording ? "destructive" : "outline"}
      onClick={handleVoiceRecording}
      disabled={isLoading}
      className="relative"
    >
      <Mic className={`h-5 w-5 ${isRecording ? 'animate-pulse text-white' : ''}`} />
      {isRecording && (
        <span className="absolute -bottom-6 text-xs font-medium">
          {formatTime(recordingTime)}
        </span>
      )}
    </Button>
  );
};

export default VoiceRecordingButton;
