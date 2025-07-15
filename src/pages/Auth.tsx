import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { useOnboarding } from '@/hooks/use-onboarding';
import { TranslatableText } from '@/components/translation/TranslatableText';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const [authError, setAuthError] = useState<string | null>(null);

  const redirectParam = searchParams.get('redirectTo');
  const fromLocation = location.state?.from?.pathname;
  const storedRedirect = typeof window !== 'undefined' ? localStorage.getItem('authRedirectTo') : null;

  // Check for auth errors in URL params
  useEffect(() => {
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('[Auth] OAuth error from URL:', { error, errorDescription });

      // Clear error from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      newUrl.searchParams.delete('error_description');
      window.history.replaceState({}, '', newUrl.toString());

      // Show user-friendly error message
      let userMessage = 'Sign-in failed';
      if (errorDescription?.includes('redirect_uri_mismatch')) {
        userMessage = 'Google sign-in configuration error. Please try again or contact support.';
      } else if (errorDescription) {
        userMessage = `Sign-in failed: ${errorDescription}`;
      } else if (error === 'access_denied') {
        userMessage = 'Sign-in was cancelled';
      }

      setAuthError(userMessage);
      toast.error(userMessage);
    }
  }, [searchParams]);

  // Get valid redirect path - CRITICAL: Always go to home after auth in native apps
  const getValidRedirectPath = (path: string | null) => {
    // CRITICAL: For native apps, always redirect to home after successful login
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[Auth] Native app detected - redirecting to home after auth');
      return '/app/home';
    }

    if (!path) {
      return '/app/home';
    }

    // Normalize legacy paths for web
    if (path === '/home') return '/app/home';
    if (path === '/onboarding') return '/app/home'; // After login, go to home not onboarding

    return path;
  };

  // Determine where to redirect after auth
  const redirectTo = getValidRedirectPath(redirectParam || fromLocation || storedRedirect);

  console.log('[Auth] Auth page mounted', {
    redirectTo,
    redirectParam,
    fromLocation,
    storedRedirect,
    hasUser: !!user,
    currentPath: location.pathname,
    onboardingComplete,
    isNative: nativeIntegrationService.isRunningNatively(),
    authLoading,
    redirecting
  });

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Enhanced navigation logic with better debugging
    console.log('[Auth] Navigation check:', {
      hasUser: !!user,
      authLoading,
      redirecting,
      redirectTo,
      isNative: nativeIntegrationService.isRunningNatively(),
      onboardingComplete
    });

    // If user is logged in and page has finished initial loading, redirect
    if (user && !authLoading && !redirecting) {
      console.log('[Auth] CONDITIONS MET - Starting navigation process');
      console.log('[Auth] User authenticated, starting redirect to:', redirectTo);
      setRedirecting(true);

      // Clean up stored redirect
      localStorage.removeItem('authRedirectTo');

      // Determine final destination
      const finalDestination = nativeIntegrationService.isRunningNatively() 
        ? '/app/home' 
        : redirectTo;

      console.log('[Auth] Final destination determined:', finalDestination);

      // Add small delay to ensure state updates and auth context sync
      const timer = setTimeout(() => {
        console.log('[Auth] EXECUTING NAVIGATION to:', finalDestination);
        
        try {
          navigate(finalDestination, { replace: true });
          console.log('[Auth] Navigation called successfully');
        } catch (error) {
          console.error('[Auth] Navigation failed:', error);
          // Fallback navigation
          console.log('[Auth] Attempting fallback navigation to /app/home');
          navigate('/app/home', { replace: true });
        }
      }, 100); // Reduced delay for faster navigation

      return () => clearTimeout(timer);
    }
  }, [user, authLoading, navigate, redirecting, redirectTo, onboardingComplete]);

  // If still checking auth state, show loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If already logged in, redirect appropriately
  if (user) {
    const destination = nativeIntegrationService.isRunningNatively() ? '/app/home' : redirectTo;
    console.log('[Auth] User already logged in, immediate redirect to:', destination);
    return <Navigate to={destination} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full glass-card p-8 rounded-xl relative z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <TranslatableText text="Welcome to" forceTranslate={true} />{" "}
            <SouloLogo size="large" className="text-blue-600" />
          </h1>
          <p className="text-muted-foreground">
            <TranslatableText
              text="Sign in to start your journaling journey and track your emotional wellbeing"
              forceTranslate={true}
            />
          </p>
        </div>

        {authError && (
          <div className="mb-4 p-3 border border-red-200 bg-red-50 text-red-700 rounded-md">
            <p className="text-sm">
              {authError}
            </p>
            <button
              onClick={() => setAuthError(null)}
              className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-4">
          <PlatformAuthButton
            isLoading={isLoading}
            onLoadingChange={setIsLoading}
            onError={(error) => {
              console.error('[Auth] Platform auth error:', error);
              setAuthError(error);
            }}
          />

          <div className="text-center text-sm text-muted-foreground">
            <p>
              <TranslatableText
                text="By signing in, you agree to our Terms of Service and Privacy Policy"
                forceTranslate={true}
              />
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
