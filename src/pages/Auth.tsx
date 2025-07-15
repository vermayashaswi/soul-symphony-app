import { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { useOnboarding } from '@/hooks/use-onboarding';
import { TranslatableText } from '@/components/translation/TranslatableText';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { Button } from '@/components/ui/button';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const [authError, setAuthError] = useState<string | null>(null);
  const [navigationAttempts, setNavigationAttempts] = useState(0);
  const [showEmergencyButton, setShowEmergencyButton] = useState(false);
  const [navigationDeadlock, setNavigationDeadlock] = useState(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastNavigationAttempt = useRef<number>(0);

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

  // Enhanced navigation logic with deadlock detection and recovery
  const attemptNavigation = (destination: string, attempt: number = 1) => {
    console.log(`[Auth] Navigation attempt ${attempt} to:`, destination);
    
    const now = Date.now();
    const timeSinceLastAttempt = now - lastNavigationAttempt.current;
    
    // Prevent rapid navigation attempts (potential loop)
    if (timeSinceLastAttempt < 1000 && attempt > 1) {
      console.warn('[Auth] Navigation attempt too soon, waiting...');
      setTimeout(() => attemptNavigation(destination, attempt), 1000);
      return;
    }
    
    lastNavigationAttempt.current = now;
    
    try {
      console.log(`[Auth] Executing navigation attempt ${attempt}...`);
      navigate(destination, { replace: true });
      
      // Set timeout to detect navigation failure
      navigationTimeoutRef.current = setTimeout(() => {
        console.error(`[Auth] Navigation timeout after attempt ${attempt}`);
        setNavigationAttempts(prev => prev + 1);
        
        if (attempt < 3) {
          console.log(`[Auth] Retrying navigation (attempt ${attempt + 1})`);
          attemptNavigation(destination, attempt + 1);
        } else {
          console.error('[Auth] Navigation failed after 3 attempts, showing emergency options');
          setNavigationDeadlock(true);
          setShowEmergencyButton(true);
          setRedirecting(false);
          toast.error('Navigation failed. Please use the emergency button to continue.');
        }
      }, 2000); // 2 second timeout
      
    } catch (error) {
      console.error(`[Auth] Navigation attempt ${attempt} failed:`, error);
      
      if (attempt < 3) {
        console.log(`[Auth] Retrying navigation due to error (attempt ${attempt + 1})`);
        setTimeout(() => attemptNavigation(destination, attempt + 1), 1000);
      } else {
        console.error('[Auth] All navigation attempts failed, using window.location fallback');
        
        // Ultimate fallback - force page navigation
        try {
          window.location.href = destination;
        } catch (windowError) {
          console.error('[Auth] Even window.location failed:', windowError);
          setNavigationDeadlock(true);
          setShowEmergencyButton(true);
          setRedirecting(false);
          toast.error('Critical navigation failure. Please refresh the page.');
        }
      }
    }
  };

  // Clean up navigation timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced navigation effect with deadlock detection
  useEffect(() => {
    const isNative = nativeIntegrationService.isRunningNatively();
    
    console.log('[Auth] Enhanced navigation check:', {
      hasUser: !!user,
      authLoading,
      redirecting,
      isNative,
      onboardingComplete,
      navigationAttempts,
      navigationDeadlock,
      currentPath: location.pathname
    });

    // Prevent navigation if we're in a deadlock state
    if (navigationDeadlock) {
      console.log('[Auth] Navigation deadlock detected, skipping navigation logic');
      return;
    }

    // If user is logged in and page has finished initial loading, redirect
    if (user && !authLoading && !redirecting) {
      console.log('[Auth] CONDITIONS MET - Starting enhanced navigation process');
      setRedirecting(true);

      // Clean up stored redirect
      localStorage.removeItem('authRedirectTo');

      // Get final destination
      const finalDestination = getFinalRedirectPath();
      console.log('[Auth] Final destination determined:', finalDestination);

      // Start navigation with enhanced error handling
      attemptNavigation(finalDestination, 1);
    }
  }, [user, authLoading, navigate, redirecting, onboardingComplete, navigationDeadlock]);

  // Emergency navigation handler
  const handleEmergencyNavigation = () => {
    console.log('[Auth] Emergency navigation activated');
    setNavigationDeadlock(false);
    setShowEmergencyButton(false);
    setNavigationAttempts(0);
    
    const destination = getFinalRedirectPath();
    console.log('[Auth] Emergency navigation to:', destination);
    
    // Force navigation using window.location
    try {
      window.location.href = destination;
    } catch (error) {
      console.error('[Auth] Emergency navigation failed:', error);
      toast.error('Emergency navigation failed. Please refresh the page manually.');
    }
  };

  useEffect(() => {
    setIsLoading(false);
  }, []);

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

        {/* Navigation Status Indicator */}
        {redirecting && (
          <div className="mb-4 p-3 border border-blue-200 bg-blue-50 text-blue-700 rounded-md">
            <p className="text-sm">
              {navigationDeadlock ? (
                <>
                  <span className="font-medium">Navigation failed</span>
                  <br />
                  <span className="text-xs">
                    Navigation attempts: {navigationAttempts}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium">Redirecting...</span>
                  <br />
                  <span className="text-xs">
                    Attempt {navigationAttempts + 1} - Taking you to the app
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        {/* Emergency Navigation Button */}
        {showEmergencyButton && (
          <div className="mb-4 p-4 border border-orange-200 bg-orange-50 text-orange-700 rounded-md">
            <p className="text-sm mb-3">
              <span className="font-medium">Navigation Issue Detected</span>
              <br />
              <span className="text-xs">
                The app is having trouble navigating after sign-in. Click the button below to continue manually.
              </span>
            </p>
            <Button
              onClick={handleEmergencyNavigation}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              Continue to App
            </Button>
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
