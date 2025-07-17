import { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { TranslatableText } from '@/components/translation/TranslatableText';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export default function Auth() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [navigationAttempted, setNavigationAttempted] = useState(false);
  const [navigationSuccessful, setNavigationSuccessful] = useState(false);
  const [showNavigationIndicator, setShowNavigationIndicator] = useState(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigationRetryCount = useRef(0);
  const maxNavigationRetries = 3;

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
    isNative: nativeIntegrationService.isRunningNatively(),
    authLoading
  });

  // Clear loading state on component mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // CRITICAL: Immediate navigation for native apps with enhanced state management
  useEffect(() => {
    const isNative = nativeIntegrationService.isRunningNatively();
    console.log('[Auth] Navigation Decision Point:', {
      hasUser: !!user,
      userId: user?.id,
      authLoading,
      navigationAttempted,
      navigationSuccessful,
      isNative,
      currentPath: location.pathname,
      retryCount: navigationRetryCount.current,
      timestamp: new Date().toISOString()
    });

    // CRITICAL: For native apps, navigate immediately when user is authenticated
    if (user && !authLoading && !navigationAttempted && !navigationSuccessful) {
      console.log('[Auth] STARTING NAVIGATION PROCESS - User authenticated');
      setNavigationAttempted(true);
      
      const destination = getFinalRedirectPath();
      console.log('[Auth] Navigation destination determined:', destination);

      // Clear any existing timeouts
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }

      if (isNative) {
        console.log('[Auth] NATIVE APP: Initiating immediate navigation sequence');
        setShowNavigationIndicator(true);
        
        // Enhanced navigation with multiple fallback strategies
        const attemptNavigation = () => {
          console.log(`[Auth] NATIVE: Navigation attempt #${navigationRetryCount.current + 1}`);
          
          try {
            // Method 1: window.location.href (most reliable for native)
            console.log('[Auth] NATIVE: Attempting window.location.href navigation');
            window.location.href = destination;
            
            // Mark as successful immediately for native apps
            setNavigationSuccessful(true);
            console.log('[Auth] NATIVE: Navigation initiated successfully');
            
            // Verify navigation after a short delay
            setTimeout(() => {
              if (location.pathname === '/app/auth') {
                console.warn('[Auth] NATIVE: Still on auth page, attempting fallback');
                if (navigationRetryCount.current < maxNavigationRetries) {
                  navigationRetryCount.current++;
                  attemptNavigation();
                } else {
                  console.error('[Auth] NATIVE: All navigation attempts failed');
                  setAuthError('Navigation failed. Please restart the app to continue.');
                }
              }
            }, 500);
            
          } catch (error) {
            console.error('[Auth] NATIVE: Primary navigation failed:', error);
            
            // Method 2: React Router as immediate fallback
            try {
              console.log('[Auth] NATIVE: Attempting React Router fallback');
              navigate(destination, { replace: true });
              setNavigationSuccessful(true);
              console.log('[Auth] NATIVE: React Router fallback executed');
            } catch (navError) {
              console.error('[Auth] NATIVE: React Router fallback failed:', navError);
              
              // Method 3: Force refresh as last resort
              if (navigationRetryCount.current < maxNavigationRetries) {
                navigationRetryCount.current++;
                setTimeout(attemptNavigation, 1000);
              } else {
                console.error('[Auth] NATIVE: All navigation methods exhausted');
                setAuthError('Navigation failed. Please restart the app.');
              }
            }
          }
        };

        // Start navigation immediately for native apps
        attemptNavigation();
        
      } else {
        console.log('[Auth] WEB APP: Using standard React Router navigation');
        // For web apps, use standard React Router navigation
        try {
          navigate(destination, { replace: true });
          setNavigationSuccessful(true);
          console.log('[Auth] WEB: Navigation executed successfully');
        } catch (error) {
          console.error('[Auth] WEB: Navigation failed:', error);
          setAuthError('Navigation failed. Please try refreshing the page.');
        }
      }
    }

    // Clean up timeouts on unmount or user state change
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, [user, authLoading, navigationAttempted, navigationSuccessful, navigate, location.pathname]);

  // Clean up stored redirect when user logs in
  useEffect(() => {
    if (user) {
      localStorage.removeItem('authRedirectTo');
    }
  }, [user]);

  // Component cleanup on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, []);

  // If still checking auth state, show loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If already logged in, handle navigation based on platform with enhanced state tracking
  if (user) {
    const destination = getFinalRedirectPath();
    const isNative = nativeIntegrationService.isRunningNatively();
    
    console.log('[Auth] User Present - Navigation State Check:', {
      destination,
      navigationAttempted,
      navigationSuccessful,
      showNavigationIndicator,
      isNative,
      currentPath: location.pathname,
      timestamp: new Date().toISOString()
    });
    
    // For native apps: Show enhanced navigation indicator with state feedback
    if (isNative) {
      console.log('[Auth] NATIVE: Rendering navigation interface');
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-6">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">Welcome back!</p>
              <p className="text-sm text-muted-foreground">
                {navigationSuccessful 
                  ? "Navigation successful - loading your dashboard..." 
                  : navigationAttempted 
                  ? "Completing sign-in process..."
                  : "Taking you to your dashboard..."
                }
              </p>
              {navigationAttempted && navigationRetryCount.current > 0 && (
                <p className="text-xs text-amber-600">
                  Retry attempt {navigationRetryCount.current}/{maxNavigationRetries}
                </p>
              )}
            </div>
            {authError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm max-w-md">
                {authError}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    // For web: Use standard React Router navigation
    console.log('[Auth] WEB: Using Navigate component for redirection');
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