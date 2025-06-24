
import React, { useEffect, useState } from 'react';
import { usePermissionManager } from '@/hooks/usePermissionManager';
import { PermissionPrompt } from './PermissionPrompt';
import { PermissionType } from '@/services/permissionService';
import { twaPermissionBootstrap } from '@/services/twaPermissionBootstrap';

interface TWAPermissionInitializerProps {
  onComplete?: () => void;
}

export const TWAPermissionInitializer: React.FC<TWAPermissionInitializerProps> = ({
  onComplete
}) => {
  const {
    permissions,
    requestPermission,
    shouldShowPermissionPrompt,
    isTWAEnvironment
  } = usePermissionManager();

  const [currentPrompt, setCurrentPrompt] = useState<PermissionType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualPrompts, setShowManualPrompts] = useState(false);

  // Only run in TWA environment
  useEffect(() => {
    if (!isTWAEnvironment) {
      onComplete?.();
      return;
    }

    // Check if we need to show manual prompts after bootstrap
    const checkForManualPrompts = async () => {
      try {
        // Give bootstrap service time to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const needsManualPrompts = shouldShowPermissionPrompt('microphone') || 
                                  shouldShowPermissionPrompt('notifications');
        
        if (needsManualPrompts) {
          console.log('[TWAPermissionInitializer] Manual permission prompts needed');
          setShowManualPrompts(true);
          startManualPermissionFlow();
        } else {
          console.log('[TWAPermissionInitializer] No manual prompts needed, completing');
          onComplete?.();
        }
      } catch (error) {
        console.error('[TWAPermissionInitializer] Error checking for manual prompts:', error);
        onComplete?.();
      }
    };

    checkForManualPrompts();
  }, [isTWAEnvironment, shouldShowPermissionPrompt, onComplete]);

  const startManualPermissionFlow = () => {
    console.log('[TWAPermissionInitializer] Starting manual permission flow');

    // Priority order: microphone first, then notifications
    const permissionOrder: PermissionType[] = ['microphone', 'notifications'];
    
    for (const permissionType of permissionOrder) {
      if (shouldShowPermissionPrompt(permissionType)) {
        console.log(`[TWAPermissionInitializer] Showing manual prompt for ${permissionType}`);
        setCurrentPrompt(permissionType);
        return;
      }
    }

    // All permissions handled
    console.log('[TWAPermissionInitializer] All manual prompts completed');
    onComplete?.();
  };

  const handleAllowPermission = async () => {
    if (!currentPrompt) return;

    try {
      setIsProcessing(true);
      const granted = await requestPermission(currentPrompt);
      
      console.log(`[TWAPermissionInitializer] Manual permission ${currentPrompt} result:`, granted);
      
      setCurrentPrompt(null);
      
      // Move to next permission after a brief delay
      setTimeout(() => {
        startManualPermissionFlow();
      }, 500);
      
    } catch (error) {
      console.error('[TWAPermissionInitializer] Error requesting manual permission:', error);
      setCurrentPrompt(null);
      startManualPermissionFlow();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDenyPermission = () => {
    if (!currentPrompt) return;
    
    console.log(`[TWAPermissionInitializer] Manual permission ${currentPrompt} denied by user`);
    
    setCurrentPrompt(null);
    
    // Move to next permission
    setTimeout(() => {
      startManualPermissionFlow();
    }, 300);
  };

  const handleClosePrompt = () => {
    console.log('[TWAPermissionInitializer] Manual permission prompt closed');
    handleDenyPermission();
  };

  // Don't render anything if not in TWA environment or if manual prompts aren't needed
  if (!isTWAEnvironment || !showManualPrompts) {
    return null;
  }

  return (
    <PermissionPrompt
      type={currentPrompt || 'microphone'}
      isVisible={currentPrompt !== null}
      isLoading={isProcessing}
      onAllow={handleAllowPermission}
      onDeny={handleDenyPermission}
      onClose={handleClosePrompt}
      isTWAEnvironment={true}
    />
  );
};

export default TWAPermissionInitializer;
