
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTutorial } from '@/contexts/TutorialContext';
import { usePermissionManager } from '@/hooks/usePermissionManager';
import { PermissionPrompt } from '@/components/permissions/PermissionPrompt';

interface RecordingButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  hasPermission: boolean | null;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onPermissionRequest: () => void;
  audioLevel?: number;
  showAnimation?: boolean;
  audioBlob?: Blob | null;
}

export function RecordingButton({
  isRecording,
  isProcessing,
  hasPermission,
  onRecordingStart,
  onRecordingStop,
  onPermissionRequest,
  audioLevel = 0,
  showAnimation = true,
  audioBlob = null
}: RecordingButtonProps) {
  const { isInStep, tutorialCompleted, isActive } = useTutorial();
  const { requestPermission, permissions, shouldShowPermissionPrompt } = usePermissionManager();
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  
  const isInTutorialStep3 = isInStep(3);
  const isInTutorialStep5 = isActive && isInStep(5);
  
  // Don't render during tutorial step 5
  if (isInTutorialStep5) {
    return null;
  }
  
  const handleMicrophoneClick = async () => {
    if (isRecording) {
      onRecordingStop();
      return;
    }

    // Check if we need to request microphone permission
    if (permissions.microphone !== 'granted') {
      console.log('[RecordingButton] Microphone permission needed, showing prompt');
      setShowPermissionPrompt(true);
      return;
    }

    // Permission is granted, start recording
    onRecordingStart();
  };

  const handlePermissionAllow = async () => {
    try {
      setIsRequestingPermission(true);
      const granted = await requestPermission('microphone');
      
      if (granted) {
        setShowPermissionPrompt(false);
        // Start recording immediately after permission is granted
        setTimeout(() => {
          onRecordingStart();
        }, 500);
      }
    } catch (error) {
      console.error('[RecordingButton] Error requesting microphone permission:', error);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handlePermissionDeny = () => {
    setShowPermissionPrompt(false);
  };

  const handlePermissionClose = () => {
    setShowPermissionPrompt(false);
  };
  
  // Show permission request button if permission is denied
  if (permissions.microphone === 'denied') {
    return (
      <>
        <motion.button
          onClick={() => setShowPermissionPrompt(true)}
          className="relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg bg-red-500 border-red-600 w-20 h-20"
          whileTap={{ scale: 0.95 }}
        >
          <Mic className="w-8 h-8 text-white" />
        </motion.button>
        
        <PermissionPrompt
          type="microphone"
          isVisible={showPermissionPrompt}
          isLoading={isRequestingPermission}
          onAllow={handlePermissionAllow}
          onDeny={handlePermissionDeny}
          onClose={handlePermissionClose}
        />
      </>
    );
  }
  
  // Only show glow when in tutorial step 3 AND tutorial is not completed
  const shouldShowGlow = isInTutorialStep3 && !tutorialCompleted;
  
  // Dynamic glow effect based on audio level - only show prominent glow during recording or in tutorial step 3
  const glowSize = isRecording ? Math.max(12, Math.min(60, audioLevel / 5 * 3)) : 
                  (shouldShowGlow ? 40 : 0);
  
  if (!isRecording && isProcessing) {
    return null; // Don't render anything when processing
  }
  
  // Only add the tutorial target class if we're in tutorial step 3 AND tutorial is not completed
  const shouldAddTutorialClass = isInTutorialStep3 && !tutorialCompleted;
  
  return (
    <>
      <div className={`relative flex items-center justify-center ${shouldAddTutorialClass ? 'tutorial-target record-entry-tab' : ''}`}>
        <motion.button
          onClick={handleMicrophoneClick}
          className={cn(
            "relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg",
            isRecording ? "bg-red-500 border-red-600" : "bg-theme-color hover:bg-theme-color/90 border-theme-color/20",
            "w-20 h-20",
            audioBlob && "opacity-50 cursor-not-allowed",
            shouldAddTutorialClass ? "tutorial-button-highlight" : ""
          )}
          style={{
            // Only apply glow effect if recording or in tutorial step 3 AND tutorial not completed
            boxShadow: (isRecording || shouldShowGlow) ? 
                       `0 0 ${glowSize}px ${glowSize/2}px rgba(239, 68, 68, 0.8)` : undefined,
            backgroundColor: "#000000" // Ensure black background                 
          }}
          whileTap={{ scale: 0.95 }}
          disabled={audioBlob !== null}
          data-tutorial-target={shouldAddTutorialClass ? "record-entry" : undefined}
        >
          {isRecording ? (
            <Square className="w-7 h-7 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </motion.button>
      </div>
      
      <PermissionPrompt
        type="microphone"
        isVisible={showPermissionPrompt}
        isLoading={isRequestingPermission}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
        onClose={handlePermissionClose}
      />
    </>
  );
}
