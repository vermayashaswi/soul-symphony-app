
import React from 'react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useIsMobile } from '@/hooks/use-mobile';
import { signInWithGoogle, signInWithApple } from '@/services/authService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { nativeAuthService } from '@/services/nativeAuthService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PlatformAuthButtonProps {
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  onError: (error: string) => void;
}

const PlatformAuthButton: React.FC<PlatformAuthButtonProps> = ({ 
  isLoading, 
  onLoadingChange, 
  onError 
}) => {
  const { isIOS, isAndroid } = useIsMobile();

  // REPLACE the handleGoogleSignIn function with this:

  const handleGoogleSignIn = async () => {
    try {
      onLoadingChange(true);
      onError(''); // Clear any previous errors

      console.log('[PlatformAuth] Starting Google sign-in process');

      // CRITICAL: Always try native auth first in mobile apps
      if (nativeIntegrationService.isRunningNatively()) {
        console.log('[PlatformAuth] Native environment - using native Google auth');
        
        // Add timeout for native auth
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Native Google authentication timed out'));
          }, 45000); // 45 seconds timeout
        });

        const authPromise = nativeAuthService.signInWithGoogle();

        try {
          await Promise.race([authPromise, timeoutPromise]);
          console.log('[PlatformAuth] Native Google sign-in completed successfully');
          return;
        } catch (nativeError: any) {
          console.error('[PlatformAuth] Native auth failed:', nativeError);
          
          // Enhanced error handling with specific messages
          let userFriendlyMessage = 'Something went wrong with Google sign-in';
          
          if (nativeError.message?.includes('timeout')) {
            userFriendlyMessage = 'Sign-in timed out. Please try again.';
          } else if (nativeError.message?.includes('cancelled')) {
            userFriendlyMessage = 'Sign-in was cancelled. Please try again.';
          } else if (nativeError.message?.includes('network')) {
            userFriendlyMessage = 'Network error. Please check your connection and try again.';
          } else if (nativeError.message?.includes('token')) {
            userFriendlyMessage = 'Authentication token error. Please try again.';
          } else if (nativeError.message?.includes('not available')) {
            userFriendlyMessage = 'Google sign-in is not available on this device.';
          }

          onError(userFriendlyMessage);
          toast.error(userFriendlyMessage);
          throw nativeError;
        }
      }

      // Web fallback
      console.log('[PlatformAuth] Web environment - using Supabase OAuth');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app/auth`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        console.error('[PlatformAuth] Web OAuth error:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('[PlatformAuth] Google sign-in failed:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Don't show error again if it was already handled above
      if (!error.message?.includes('Native Google authentication')) {
        const errorMessage = error.message || 'Google sign-in failed';
        onError?.(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      onLoadingChange(false);
    }
  };


  const handleAppleSignIn = async () => {
    try {
      onLoadingChange(true);
      onError('');
      console.log('Initiating Apple ID sign-in');
      await signInWithApple();
    } catch (error: any) {
      console.error('Apple ID sign-in error:', error.message);
      onError(error.message);
      onLoadingChange(false);
    }
  };

  // For iOS devices, show Apple ID sign-in
  if (isIOS) {
    return (
      <Button 
        size="lg" 
        className="w-full flex items-center justify-center gap-2 bg-black text-white hover:bg-gray-800"
        onClick={handleAppleSignIn}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="animate-spin h-5 w-5 border-t-2 border-white rounded-full mr-2" />
        ) : (
          <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M12.017 14.999c-1.45-.074-2.693-1.057-3.115-2.441-.422-1.384.07-2.888 1.221-3.73.65-.475 1.44-.742 2.259-.762 1.45.074 2.693 1.057 3.115 2.441.422 1.384-.07 2.888-1.221 3.73-.65.475-1.44.742-2.259.762zm7.5-1.999c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10 10 4.477 10 10z"/>
          </svg>
        )}
        <TranslatableText text="Sign in with Apple" forceTranslate={true} />
      </Button>
    );
  }

  // For Android devices, show Google sign-in
  if (isAndroid) {
    return (
      <Button 
        size="lg" 
        className="w-full flex items-center justify-center gap-2"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="animate-spin h-5 w-5 border-t-2 border-white rounded-full mr-2" />
        ) : (
          <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
              <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
              <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
              <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
              <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
            </g>
          </svg>
        )}
        <TranslatableText text="Sign in with Google" forceTranslate={true} />
      </Button>
    );
  }

  // Fallback for desktop or undetected devices - show Google sign-in
  return (
    <Button 
      size="lg" 
      className="w-full flex items-center justify-center gap-2"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <span className="animate-spin h-5 w-5 border-t-2 border-white rounded-full mr-2" />
      ) : (
        <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
            <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
          </g>
        </svg>
      )}
      <TranslatableText text="Sign in with Google" forceTranslate={true} />
    </Button>
  );
};

export default PlatformAuthButton;
