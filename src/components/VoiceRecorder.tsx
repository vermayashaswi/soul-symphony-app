
import React, { useState, useEffect } from 'react';
import { Loader2, ChevronRight, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { processRecording } from '@/utils/audio-processing';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingVisualizer } from '@/components/voice-recorder/RecordingVisualizer';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { createAudioBucket } from '@/utils/supabase-diagnostics';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, tempId?: string, entryId?: number) => void;
  onCancel?: () => void;
  className?: string;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className }: VoiceRecorderProps) {
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCompletedProcessing, setHasCompletedProcessing] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  
  const {
    isRecording,
    recordingTime,
    audioBlob,
    audioLevel,
    hasPermission,
    ripples,
    startRecording,
    stopRecording,
    requestPermissions,
    resetRecording
  } = useVoiceRecorder({ noiseReduction });
  
  const {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    audioRef
  } = useAudioPlayback({ audioBlob });
  
  // Ensure audio bucket exists when component mounts
  useEffect(() => {
    const checkAudioBucket = async () => {
      if (user) {
        const result = await createAudioBucket();
        if (!result.success) {
          console.warn('Could not verify audio bucket:', result.error);
        }
      }
    };
    
    checkAudioBucket();
  }, [user]);
  
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      toast.error("No recording to save");
      return;
    }
    
    if (!user) {
      toast.error("Please sign in to save entries");
      return;
    }
    
    if (isProcessing || hasCompletedProcessing) {
      console.log("Already processing or completed, ignoring duplicate save attempt");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      console.log("Processing recording with blob size:", audioBlob.size, "type:", audioBlob.type, "for user:", user.id);
      
      // Add a timeout to prevent getting stuck in processing state
      const processingTimeout = setTimeout(() => {
        if (isProcessing && !hasCompletedProcessing) {
          console.log("Processing timeout reached, continuing with flow");
          // If the actual processing is still ongoing, we'll just let the UI continue
          if (onRecordingComplete) {
            setHasCompletedProcessing(true);
            onRecordingComplete(audioBlob, "timeout-" + Date.now());
          }
        }
      }, 20000); // 20 seconds timeout
      
      const result = await processRecording(audioBlob, user.id);
      
      // Clear the timeout as we got a response
      clearTimeout(processingTimeout);
      
      if (result.success && onRecordingComplete) {
        console.log("Processing successful, tempId:", result.tempId, "entryId:", result.entryId);
        // Call the completion handler with the temp ID and entry ID if available
        setHasCompletedProcessing(true);
        onRecordingComplete(audioBlob, result.tempId, result.entryId);
      } else if (!result.success) {
        console.error("Processing failed:", result.error);
        setIsProcessing(false);
        toast.error(result.error || "Failed to process recording");
      }
      
      // Note: We don't reset processing state here because the component will unmount
      // when navigating away
      
    } catch (error) {
      console.error("Error in handleSaveEntry:", error);
      setIsProcessing(false);
      toast.error("Failed to save entry. Please try again.");
    }
  };

  // Handle recording restart
  const handleRestartRecording = () => {
    if (isProcessing) {
      console.log("Cannot restart while processing");
      return;
    }
    resetRecording();
    setHasCompletedProcessing(false);
  };

  // Automatically request permissions on component mount
  useEffect(() => {
    if (hasPermission === null) {
      requestPermissions();
    }
  }, [hasPermission, requestPermissions]);
  
  // Clear any stuck processing state when the component is unmounted
  useEffect(() => {
    return () => {
      if (isProcessing) {
        console.log("Component unmounted while processing");
      }
    };
  }, [isProcessing]);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <audio ref={audioRef} className="hidden" />
      
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="noise-reduction"
            checked={noiseReduction}
            onCheckedChange={setNoiseReduction}
            disabled={isRecording || isProcessing}
          />
          <Label htmlFor="noise-reduction" className="text-sm">Noise Reduction</Label>
        </div>
      </div>
      
      <RecordingVisualizer 
        isRecording={isRecording}
        audioLevel={audioLevel}
        ripples={ripples}
      />
      
      <div className="flex items-center gap-3">
        <RecordingButton
          isRecording={isRecording}
          isProcessing={isProcessing}
          hasPermission={hasPermission}
          onRecordingStart={startRecording}
          onRecordingStop={stopRecording}
          onPermissionRequest={requestPermissions}
        />
        
        {!isRecording && audioBlob && !isProcessing && (
          <Button 
            onClick={handleRestartRecording}
            variant="outline"
            size="icon"
            className="rounded-full h-10 w-10"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <AnimatePresence mode="wait">
        {isRecording ? (
          <RecordingStatus 
            isRecording={isRecording} 
            recordingTime={recordingTime} 
          />
        ) : audioBlob ? (
          <PlaybackControls
            audioBlob={audioBlob}
            isPlaying={isPlaying}
            isProcessing={isProcessing}
            playbackProgress={playbackProgress}
            audioDuration={audioDuration}
            onTogglePlayback={togglePlayback}
            onSaveEntry={handleSaveEntry}
          />
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
      
      {authLoading && (
        <div className="text-sm text-muted-foreground mt-4">
          Checking authentication status...
        </div>
      )}
      
      {!user && !authLoading && (
        <div className="text-sm text-red-500 mt-4">
          You need to be signed in to save recordings
        </div>
      )}
      
      {isProcessing && (
        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing with AI...</span>
        </div>
      )}
    </div>
  );
}

export default VoiceRecorder;
