import { useState, useEffect } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { TranslatableText } from '@/components/translation/TranslatableText';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';

export default function Auth() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);
  const [buttonLoading, setButtonLoading] = useState(false);
  const { user, isLoading } = useAuth();

  const redirectParam = searchParams.get('redirectTo') || searchParams.get('redirect');

  // Handle OAuth errors from URL
  useEffect(() => {
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('[Auth] OAuth error:', { error, errorDescription });
      
      let userFriendlyMessage = 'Authentication failed. Please try again.';
      
      if (error === 'access_denied') {
        userFriendlyMessage = 'Access was denied. Please try signing in again.';
      } else if (errorDescription) {
        userFriendlyMessage = `Authentication error: ${errorDescription}`;
      }
      
      setAuthError(userFriendlyMessage);
      toast.error(userFriendlyMessage);
    }
  }, [searchParams]);

  // Simple redirect path determination
  const getRedirectPath = () => {
    return redirectParam || '/app/home';
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="mb-4 w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  // Redirect authenticated users
  if (user) {
    const redirectPath = getRedirectPath();
    console.log('[Auth] User authenticated, redirecting to:', redirectPath);
    return <Navigate to={redirectPath} replace />;
  }

  // Show authentication UI for unauthenticated users
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-muted/50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <SouloLogo className="h-12 w-auto" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <TranslatableText text="Welcome to Soulo" />
          </h1>
          <p className="mt-2 text-muted-foreground">
            <TranslatableText text="Sign in to continue your journey" />
          </p>
        </div>

        <div className="space-y-4">
          <PlatformAuthButton 
            isLoading={buttonLoading}
            onLoadingChange={setButtonLoading}
            onError={setAuthError}
          />
          
          {authError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <p className="text-sm text-destructive">{authError}</p>
              <button
                onClick={() => setAuthError(null)}
                className="mt-2 text-xs text-destructive/70 hover:text-destructive underline"
              >
                <TranslatableText text="Dismiss" />
              </button>
            </motion.div>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>
            <TranslatableText text="By signing in, you agree to our" />{' '}
            <a href="/privacy-policy" target="_blank" className="underline hover:text-foreground">
              <TranslatableText text="Privacy Policy" />
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}