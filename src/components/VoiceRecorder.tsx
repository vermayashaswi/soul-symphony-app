import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { normalizeAudioBlob, validateAudioBlob } from '@/utils/audio/blob-utils';
import { blobToBase64 } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTutorial } from '@/contexts/TutorialContext';
import FloatingLanguages from '@/components/voice-recorder/FloatingLanguages';
import { RecordingButton } from '@/components/voice-recorder/RecordingButton';
import { RecordingStatus } from '@/components/voice-recorder/RecordingStatus';
import { PlaybackControls } from '@/components/voice-recorder/PlaybackControls';
import { AnimatedPrompt } from '@/components/voice-recorder/AnimatedPrompt';
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';
import { setProcessingIntent } from '@/utils/journal/processing-intent';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, tempId?: string) => void;
  onCancel?: () => void;
  className?: string;
  updateDebugInfo?: (info: {status: string, duration?: number}) => void;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className, updateDebugInfo }: VoiceRecorderProps) {
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [showAnimation, setShowAnimation] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [audioPrepared, setAudioPrepared] = useState(false);
  
  const saveCompleteRef = useRef(false);
  const { user } = useAuth();
  const { isMobile } = useIsMobile();
  const { isInStep } = useTutorial();
  
  // Use enhanced voice recorder hook
  const { 
    isSaving, 
    isProcessing, 
    processRecording, 
    cancelProcessing 
  } = useVoiceRecorder();
  
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
  } = useAudioRecorder({ 
    noiseReduction: false,
    maxDuration: 300
  });
  
  const {
    isPlaying,
    playbackProgress,
    audioDuration,
    audioRef,
    togglePlayback,
    reset: resetPlayback,
    seekTo,
    prepareAudio
  } = useAudioPlayback({ 
    audioBlob,
    onPlaybackStart: () => {
      console.log('[VoiceRecorder] Playback started');
      setHasPlayedOnce(true);
    },
    onPlaybackEnd: () => {
      console.log('[VoiceRecorder] Playback ended');
    }
  });

  useEffect(() => {
    const clearToastsOnMount = async () => {
      await ensureAllToastsCleared();
    };
    
    clearToastsOnMount();
    
    return () => {
      clearAllToasts();
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      setRecordingError(null);
    }
  }, [isRecording]);
  
  useEffect(() => {
    if (isRecording && recordingTime >= 120000) {
      toast.warning("Your recording is quite long. Consider stopping now for better processing.", {
        duration: 3000,
      });
    }
  }, [isRecording, recordingTime]);
  
  useEffect(() => {
    if (isRecording) {
      setShowAnimation(true);
    } else if (audioBlob) {
      setShowAnimation(false);
    }
  }, [isRecording, audioBlob]);
  
  useEffect(() => {
    if (audioBlob && !audioPrepared) {
      console.log('[VoiceRecorder] New audio blob detected, preparing audio...');
      
      prepareAudio().then(duration => {
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        setAudioPrepared(true);
      }).catch(error => {
        console.error('[VoiceRecorder] Error preparing audio:', error);
      });
    }
  }, [audioBlob, audioPrepared, prepareAudio]);
  
  useEffect(() => {
    console.log('[VoiceRecorder] State update:', {
      isSaving,
      isProcessing,
      hasAudioBlob: !!audioBlob,
      audioSize: audioBlob?.size || 0,
      isRecording,
      hasPermission,
      audioDuration,
      hasSaved,
      hasPlayedOnce,
      audioPrepared
    });
    
    if (updateDebugInfo) {
      updateDebugInfo({
        status: isRecording 
          ? 'Recording' 
          : (audioBlob ? 'Recorded' : 'No Recording'),
        duration: audioDuration || (recordingTime / 1000)
      });
    }
  }, [isSaving, isProcessing, audioBlob, isRecording, hasPermission, audioDuration, hasSaved, hasPlayedOnce, recordingTime, 
       audioPrepared, updateDebugInfo]);
  
  const handleSaveEntry = async () => {
    if (!audioBlob) {
      setRecordingError("No audio recording available");
      return;
    }
    
    if (hasSaved) {
      console.log('[VoiceRecorder] Already saved this recording, ignoring duplicate save request');
      return;
    }
    
    try {
      console.log('[VoiceRecorder] Starting save process');
      
      // Set processing intent for immediate UI feedback
      setProcessingIntent(true);
      
      // Set local state
      setHasSaved(true);
      setRecordingError(null);
      
      await ensureAllToastsCleared();
      
      if (!hasPlayedOnce || audioDuration === 0) {
        console.log('[VoiceRecorder] Recording not played yet, preparing audio...');
        
        const duration = await prepareAudio();
        console.log('[VoiceRecorder] Audio prepared with duration:', duration);
        setAudioPrepared(true);
        
        if (duration < 0.5) {
          setRecordingError("Recording is too short. Please try again.");
          setProcessingIntent(false);
          setHasSaved(false);
          return;
        }
      }
      
      console.log('[VoiceRecorder] Processing recording...');
      
      // Process the recording
      const result = await processRecording(audioBlob);
      
      if (result.success) {
        console.log('[VoiceRecorder] Recording processed successfully:', result);
        
        // Call completion callback
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, result.tempId);
        }
        
        // Clear processing intent
        setProcessingIntent(false);
        
        saveCompleteRef.current = true;
        
      } else {
        console.error('[VoiceRecorder] Recording processing failed:', result.error);
        setRecordingError(result.error || 'Processing failed');
        setHasSaved(false);
        setProcessingIntent(false);
      }
      
    } catch (error: any) {
      console.error('[VoiceRecorder] Error in save process:', error);
      setRecordingError(error.message || 'Unknown error occurred');
      setHasSaved(false);
      setProcessingIntent(false);
    }
  };
  
  const handleCancel = () => {
    console.log('[VoiceRecorder] Cancelling recording');
    
    // Cancel any ongoing processing
    cancelProcessing();
    
    // Clear processing intent
    setProcessingIntent(false);
    
    // Reset all state
    resetRecording();
    resetPlayback();
    setHasSaved(false);
    setHasPlayedOnce(false);
    setAudioPrepared(false);
    setRecordingError(null);
    saveCompleteRef.current = false;
    
    if (onCancel) {
      onCancel();
    }
  };

  const shouldShowPrompt = !isRecording && !audioBlob;
  
  // Determine if we should show the floating languages animation
  // Hide it only during tutorial steps 3 and 4
  const shouldShowFloatingLanguages = !isInStep(3) && !isInStep(4);

  return (
    <div className={cn("flex flex-col items-center space-y-6 p-6", className)}>
      <div className="relative">
        <FloatingLanguages />
        
        <div className="relative z-10">
          <RecordingButton
            isRecording={isRecording}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            hasPermission={hasPermission}
            onRequestPermissions={requestPermissions}
            audioLevel={audioLevel}
            ripples={ripples}
            disabled={isSaving || isProcessing}
          />
        </div>
      </div>

      <RecordingStatus
        isRecording={isRecording}
        recordingTime={recordingTime}
        hasAudioBlob={!!audioBlob}
        isSaving={isSaving || isProcessing}
      />

      {audioBlob && !isRecording && (
        <PlaybackControls
          isPlaying={isPlaying}
          playbackProgress={playbackProgress}
          audioDuration={audioDuration}
          onTogglePlayback={togglePlayback}
          onSeek={seekTo}
          onSave={handleSaveEntry}
          onCancel={handleCancel}
          disabled={isSaving || isProcessing}
          saving={isSaving || isProcessing}
        />
      )}

      {recordingError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{recordingError}</span>
        </motion.div>
      )}

      <AnimatePresence>
        {showAnimation && (
          <AnimatedPrompt key="animated-prompt" />
        )}
      </AnimatePresence>
    </div>
  );
}

export default VoiceRecorder;
