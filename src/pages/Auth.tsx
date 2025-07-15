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

  // Simplified redirect logic - CRITICAL: Always go to home after auth in native apps
  const getFinalRedirectPath = () => {
    // CRITICAL: For native apps, always redirect to home after successful login
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[Auth] Native app detected - redirecting to home after auth');
      return '/app/home';
    }

    // For web, use redirect parameters or default to home
    const webRedirect = redirectParam || fromLocation || storedRedirect;
    if (!webRedirect) {
      return '/app/home';
    }

    // Normalize legacy paths for web
    if (webRedirect === '/home') return '/app/home';
    if (webRedirect === '/onboarding') return '/app/home';

    return webRedirect;
  };

  console.log('[Auth] Auth page mounted', {
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
    // Simplified navigation logic with enhanced debugging
    console.log('[Auth] Navigation check:', {
      hasUser: !!user,
      authLoading,
      redirecting,
      isNative: nativeIntegrationService.isRunningNatively(),
      onboardingComplete
    });

    // If user is logged in and page has finished initial loading, redirect
    if (user && !authLoading && !redirecting) {
      console.log('[Auth] CONDITIONS MET - Starting navigation process');
      setRedirecting(true);

      // Clean up stored redirect
      localStorage.removeItem('authRedirectTo');

      // Get final destination
      const finalDestination = getFinalRedirectPath();
      console.log('[Auth] Final destination determined:', finalDestination);

      // For native apps, use immediate navigation without delay
      if (nativeIntegrationService.isRunningNatively()) {
        console.log('[Auth] NATIVE - Immediate navigation to:', finalDestination);
        
        try {
          navigate(finalDestination, { replace: true });
          console.log('[Auth] NATIVE - Navigation called successfully');
        } catch (error) {
          console.error('[Auth] NATIVE - Navigation failed:', error);
          // Force navigation to home as fallback
          console.log('[Auth] NATIVE - Fallback navigation to /app/home');
          window.location.href = '/app/home';
        }
      } else {
        // Web apps can use delayed navigation
        console.log('[Auth] WEB - Delayed navigation to:', finalDestination);
        const timer = setTimeout(() => {
          try {
            navigate(finalDestination, { replace: true });
            console.log('[Auth] WEB - Navigation called successfully');
          } catch (error) {
            console.error('[Auth] WEB - Navigation failed:', error);
            navigate('/app/home', { replace: true });
          }
        }, 100);

        return () => clearTimeout(timer);
      }
    }
  }, [user, authLoading, navigate, redirecting, onboardingComplete]);

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
    const destination = getFinalRedirectPath();
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
