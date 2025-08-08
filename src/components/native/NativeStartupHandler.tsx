import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { useNativeAuthInitialization } from '@/hooks/useNativeAuthInitialization';

interface NativeStartupHandlerProps {
  children: React.ReactNode;
}

/**
 * Handles native app startup sequence and ensures proper authentication
 * before rendering the main app
 */
export const NativeStartupHandler: React.FC<NativeStartupHandlerProps> = ({ children }) => {
  const navigate = useNavigate();
  const nativeAuth = useNativeAuthInitialization();
  const [hasHandledStartup, setHasHandledStartup] = useState(false);
  
  const isNative = nativeIntegrationService.isRunningNatively();

  useEffect(() => {
    if (!isNative || hasHandledStartup) {
      return;
    }

    if (nativeAuth.isInitialized) {
      console.log('[NativeStartup] Auth initialized, handling startup navigation');
      
      // If we have a session, navigate to app
      if (nativeAuth.session) {
        console.log('[NativeStartup] Session found, navigating to app home');
        navigate('/app/home', { replace: true });
      } else {
        console.log('[NativeStartup] No session, navigating to auth');
        navigate('/app/auth', { replace: true });
      }
      
      setHasHandledStartup(true);
    }
  }, [isNative, nativeAuth.isInitialized, nativeAuth.session, hasHandledStartup, navigate]);

  // For web apps, render children immediately
  if (!isNative) {
    return <>{children}</>;
  }

  // For native apps, show startup screen until auth is ready
  if (!nativeAuth.isInitialized || !hasHandledStartup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Starting Soulo...</p>
          {nativeAuth.error && (
            <p className="text-destructive text-sm">{nativeAuth.error}</p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};