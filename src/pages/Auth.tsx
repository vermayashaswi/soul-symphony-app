import { useState, useEffect } from 'react';
import { Navigate, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { TranslatableText } from '@/components/translation/TranslatableText';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { nativeNavigationService } from '@/services/nativeNavigationService';
import { useOnboarding } from '@/hooks/use-onboarding';
import { authStateManager } from '@/services/authStateManager';
import { AuthRedirectFallback } from '@/components/auth/AuthRedirectFallback';

export default function Auth() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();
  const [authError, setAuthError] = useState<string | null>(null);
  const [navigationProcessing, setNavigationProcessing] = useState(false);
  const [authDebugInfo, setAuthDebugInfo] = useState<any>(null);

  const redirectParam = searchParams.get('redirectTo') || searchParams.get('redirect');
  const fromLocation = location.state?.from?.pathname;
  const storedRedirect = typeof window !== 'undefined' ? localStorage.getItem('authRedirectTo') : null;

  // Enhanced error handling and auth state tracking
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const debugInfo = await authStateManager.getCurrentAuthState();
        setAuthDebugInfo(debugInfo);
        console.log('[Auth] Current auth state:', debugInfo);
      } catch (error) {
        console.error('[Auth] Error checking auth state:', error);
      }
    };

    checkAuthState();

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
      authStateManager.handleAuthFailure({ message: userMessage });
    }
  }, [searchParams]);

  // Determine where to redirect after successful login
  const getFinalRedirectPath = () => {
    // CRITICAL FIX: For native apps, let AuthStateManager handle the logic
    // Don't override the onboarding flow by forcing home redirect
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[Auth] Native app detected - letting AuthStateManager decide redirect');
      // Return null to signal AuthStateManager should handle the logic
      return null;
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

  // Log important state for debugging
  useEffect(() => {
    console.log('[Auth] Auth page state', {
      hasUser: !!user,
      userId: user?.id,
      authLoading,
      onboardingComplete,
      onboardingLoading,
      isNative: nativeIntegrationService.isRunningNatively(),
      currentPath: location.pathname,
      navigationProcessing
    });
  }, [user, authLoading, onboardingComplete, onboardingLoading, navigationProcessing, location.pathname]);

  // CENTRALIZED NAVIGATION: Auth page only handles UI, AuthStateManager handles navigation
  useEffect(() => {
    if (user && !authLoading && !navigationProcessing) {
      console.log('[Auth] User authenticated, delegating to AuthStateManager for navigation');
      
      // Check if auth state manager is already processing
      if (authStateManager.getProcessingState()) {
        console.log('[Auth] Auth state manager already processing, skipping');
        return;
      }
      
      setNavigationProcessing(true);
      
      const finalRedirectPath = getFinalRedirectPath();
      console.log('[Auth] Delegating navigation to AuthStateManager:', finalRedirectPath);
      
      // CENTRALIZED: Let AuthStateManager handle all navigation logic
      authStateManager.handleAuthSuccess(finalRedirectPath)
        .finally(() => {
          // Reset processing after a delay to prevent UI flickering
          setTimeout(() => setNavigationProcessing(false), 2000);
        });
    }
  }, [user, authLoading, navigationProcessing]);

  // Show loading state while checking auth
  if (authLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show minimal loading for navigation processing to prevent getting stuck
  if (navigationProcessing && !nativeIntegrationService.isRunningNatively()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Handle authenticated users - let the useEffect handle navigation
  if (user && !navigationProcessing) {
    const finalRedirectPath = getFinalRedirectPath();
    
    // For web apps, use React Router navigation immediately
    if (!nativeIntegrationService.isRunningNatively()) {
      return <Navigate to={finalRedirectPath} replace />;
    }
    
    // For native apps, navigation is handled in useEffect above
    // Show fallback component with manual redirect option
    return (
      <AuthRedirectFallback 
        onManualRedirect={() => nativeNavigationService.handleAuthSuccess()}
      />
    );
  }

  // Login form for unauthenticated users
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
              authStateManager.handleAuthFailure(error);
              setNavigationProcessing(false);
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