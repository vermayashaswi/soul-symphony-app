
import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { oauthFlowManager } from '@/utils/oauth-flow-manager';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface WebtonativeOAuthHandlerProps {
  onAuthComplete?: (success: boolean, error?: string) => void;
  children?: React.ReactNode;
}

const WebtonativeOAuthHandler: React.FC<WebtonativeOAuthHandlerProps> = ({
  onAuthComplete,
  children
}) => {
  const { isWebtonative } = useIsMobile();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isWebtonative) return;

    // Subscribe to OAuth flow manager
    const unsubscribe = oauthFlowManager.subscribe((state) => {
      setIsProcessing(state.isProcessing);
      setError(state.errorMessage);
      
      if (!state.isProcessing) {
        onAuthComplete?.(!state.hasError, state.errorMessage || undefined);
      }
    });

    // Check for OAuth parameters on mount
    if (oauthFlowManager.hasOAuthParams() && !oauthFlowManager.isProcessing()) {
      console.log('[WebtonativeOAuthHandler] OAuth parameters detected, processing...');
      
      oauthFlowManager.handleCallback().then((result) => {
        onAuthComplete?.(result.success, result.error);
      }).catch((error) => {
        console.error('[WebtonativeOAuthHandler] OAuth handling failed:', error);
        onAuthComplete?.(false, error.message);
      });
    }

    return unsubscribe;
  }, [isWebtonative, onAuthComplete]);

  // Enhanced viewport setup for webtonative OAuth
  useEffect(() => {
    if (!isWebtonative) return;

    const setupWebtonativeViewport = () => {
      // Set viewport properties for OAuth flow
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      document.documentElement.style.setProperty('--auth-viewport-height', `${window.innerHeight}px`);
      
      if (window.visualViewport) {
        document.documentElement.style.setProperty('--available-height', `${window.visualViewport.height}px`);
      }

      // Add OAuth-specific classes
      document.body.classList.add('webtonative-oauth-active');
      document.documentElement.classList.add('oauth-flow');
    };

    const cleanupWebtonativeViewport = () => {
      document.body.classList.remove('webtonative-oauth-active');
      document.documentElement.classList.remove('oauth-flow');
    };

    setupWebtonativeViewport();
    
    // Handle orientation changes during OAuth
    const handleOrientationChange = () => {
      setTimeout(setupWebtonativeViewport, 300);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      cleanupWebtonativeViewport();
    };
  }, [isWebtonative]);

  if (!isWebtonative) {
    return <>{children}</>;
  }

  if (isProcessing) {
    return (
      <div className="webtonative-oauth-processing">
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
            <h2 className="text-xl font-semibold mb-2">
              <TranslatableText text="Completing Authentication..." forceTranslate={true} />
            </h2>
            <p className="text-muted-foreground">
              <TranslatableText text="Please wait while we finalize your sign-in" forceTranslate={true} />
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="webtonative-oauth-error">
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center max-w-md">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2 text-red-600">
              <TranslatableText text="Authentication Failed" forceTranslate={true} />
            </h2>
            <p className="text-muted-foreground mb-4">
              {error}
            </p>
            <button
              onClick={() => {
                setError(null);
                oauthFlowManager.clearState();
                window.location.href = '/app/auth';
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <TranslatableText text="Try Again" forceTranslate={true} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default WebtonativeOAuthHandler;
