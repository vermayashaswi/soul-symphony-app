
import React, { useEffect, useState } from 'react';
import { usePermissionManager } from '@/hooks/usePermissionManager';
import { PermissionPrompt } from './PermissionPrompt';
import { PermissionType } from '@/services/permissionService';
import { detectTWAEnvironment } from '@/utils/twaDetection';

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
  const [completedPrompts, setCompletedPrompts] = useState<Set<PermissionType>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Only run in TWA environment
  useEffect(() => {
    if (!isTWAEnvironment) {
      onComplete?.();
      return;
    }

    // Start the permission flow after a brief delay
    const timer = setTimeout(() => {
      startPermissionFlow();
    }, 1000);

    return () => clearTimeout(timer);
  }, [isTWAEnvironment]);

  const startPermissionFlow = () => {
    console.log('[TWAPermissionInitializer] Starting permission flow', {
      permissions,
      isTWAEnvironment
    });

    // Priority order: microphone first, then notifications
    const permissionOrder: PermissionType[] = ['microphone', 'notifications'];
    
    for (const permissionType of permissionOrder) {
      if (shouldShowPermissionPrompt(permissionType) && !completedPrompts.has(permissionType)) {
        console.log(`[TWAPermissionInitializer] Showing prompt for ${permissionType}`);
        setCurrentPrompt(permissionType);
        return;
      }
    }

    // All permissions handled
    console.log('[TWAPermissionInitializer] All permissions handled, completing initialization');
    onComplete?.();
  };

  const handleAllowPermission = async () => {
    if (!currentPrompt) return;

    try {
      setIsProcessing(true);
      const granted = await requestPermission(currentPrompt);
      
      console.log(`[TWAPermissionInitializer] Permission ${currentPrompt} result:`, granted);
      
      setCompletedPrompts(prev => new Set([...prev, currentPrompt]));
      setCurrentPrompt(null);
      
      // Move to next permission after a brief delay
      setTimeout(() => {
        startPermissionFlow();
      }, 500);
      
    } catch (error) {
      console.error('[TWAPermissionInitializer] Error requesting permission:', error);
      setCurrentPrompt(null);
      startPermissionFlow();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDenyPermission = () => {
    if (!currentPrompt) return;
    
    console.log(`[TWAPermissionInitializer] Permission ${currentPrompt} denied by user`);
    
    setCompletedPrompts(prev => new Set([...prev, currentPrompt]));
    setCurrentPrompt(null);
    
    // Move to next permission
    setTimeout(() => {
      startPermissionFlow();
    }, 300);
  };

  const handleClosePrompt = () => {
    console.log('[TWAPermissionInitializer] Permission prompt closed');
    handleDenyPermission();
  };

  // Don't render anything if not in TWA environment
  if (!isTWAEnvironment) {
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
