
import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTutorial } from '@/contexts/TutorialContext';
import { useTWAMicrophonePermission } from '@/hooks/useTWAMicrophonePermission';
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { Button } from '@/components/ui/button';

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
  const isInTutorialStep3 = isInStep(3);
  const isInTutorialStep5 = isActive && isInStep(5);
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
  
  // Don't render during tutorial step 5
  if (isInTutorialStep5) {
    return null;
  }
  
  // Use TWA permission state if in TWA environment, otherwise use prop
  const effectiveHasPermission = (twaEnv.isTWA || twaEnv.isStandalone) ? twaHasPermission : hasPermission;
  const effectiveCanRequest = (twaEnv.isTWA || twaEnv.isStandalone) ? twaCanRequest : true;
  const shouldShowSettings = (twaEnv.isTWA || twaEnv.isStandalone) ? twaRequiresSettings : false;
  
  // Handle permission request
  const handlePermissionRequest = async () => {
    if (twaEnv.isTWA || twaEnv.isStandalone) {
      const granted = await twaRequestPermission();
      if (!granted && shouldShowSettings) {
        // Permission denied and requires settings - the hook will show appropriate toast
        return;
      }
    } else {
      onPermissionRequest();
    }
  };
  
  // Permission denied state - show different UI based on environment
  if (effectiveHasPermission === false) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <motion.button
          onClick={handlePermissionRequest}
          disabled={isRequestingPermission || !effectiveCanRequest}
          className="relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg bg-red-500 border-red-600 w-20 h-20"
          whileTap={{ scale: 0.95 }}
        >
          <Mic className="w-8 h-8 text-white" />
        </motion.button>
        
        <div className="text-center max-w-xs">
          <p className="text-sm text-muted-foreground mb-2">
            {getStatusMessage()}
          </p>
          
          {shouldShowSettings && (
            <Button
              onClick={twaOpenSettings}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Settings className="w-3 h-3 mr-1" />
              Open Settings
            </Button>
          )}
          
          {effectiveCanRequest && !shouldShowSettings && (
            <Button
              onClick={handlePermissionRequest}
              disabled={isRequestingPermission}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              {isRequestingPermission ? 'Requesting...' : 'Allow Microphone'}
            </Button>
          )}
        </div>
      </div>
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
    <div className={`relative flex items-center justify-center ${shouldAddTutorialClass ? 'tutorial-target record-entry-tab' : ''}`}>
      <motion.button
        onClick={isRecording ? onRecordingStop : onRecordingStart}
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
  );
}
