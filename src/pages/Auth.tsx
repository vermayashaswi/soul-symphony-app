
import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { useOnboarding } from '@/hooks/use-onboarding';
import { TranslatableText } from '@/components/translation/TranslatableText';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';
import { nativeAuthService } from '@/services/nativeAuthService';
import { handleAuthCallback } from '@/services/authService';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nativeAuthReady, setNativeAuthReady] = useState(false);
  const [authCallbackProcessed, setAuthCallbackProcessed] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const [authError, setAuthError] = useState<string | null>(null);
  
  const redirectParam = searchParams.get('redirectTo');
  const fromLocation = location.state?.from?.pathname;
  const storedRedirect = typeof window !== 'undefined' ? localStorage.getItem('authRedirectTo') : null;
  
  // Enhanced OAuth callback detection
  const hasAuthCallback = location.hash.includes('access_token') || 
                         location.hash.includes('error') ||
                         location.search.includes('error') ||
                         location.search.includes('code') ||
                         searchParams.get('error');
  
  // Check for OAuth errors in URL parameters
  const oauthError = searchParams.get('error');
  const oauthErrorDescription = searchParams.get('error_description');
  
  // Get valid redirect path - default to /app/home after successful login
  const getValidRedirectPath = (path: string | null) => {
    if (!path) {
      return '/app/home';
    }
    
    // Normalize legacy paths
    if (path === '/home') return '/app/home';
    if (path === '/onboarding') return '/app/home'; // After login, go to home not onboarding
    
    return path;
  };
  
  // Determine where to redirect after auth
  const redirectTo = getValidRedirectPath(redirectParam || fromLocation || storedRedirect);

  console.log('Auth page mounted', { 
    redirectTo, 
    redirectParam, 
    fromLocation,
    storedRedirect,
    hasUser: !!user,
    currentPath: location.pathname,
    onboardingComplete,
    hasAuthCallback,
    oauthError,
    oauthErrorDescription,
    hash: location.hash,
    search: location.search
  });

  // Handle OAuth errors in URL
  useEffect(() => {
    if (oauthError && !authCallbackProcessed) {
      console.log('[Auth] OAuth error detected in URL:', oauthError, oauthErrorDescription);
      setAuthCallbackProcessed(true);
      
      let errorMessage = 'Authentication failed';
      
      if (oauthError === 'redirect_uri_mismatch') {
        errorMessage = 'Sign-in configuration error. Please contact support.';
        console.error('[Auth] Redirect URI mismatch - Google OAuth settings need to be updated');
      } else if (oauthError === 'access_denied') {
        errorMessage = 'Sign-in was cancelled.';
      } else if (oauthError === 'invalid_request') {
        errorMessage = 'Invalid sign-in request. Please try again.';
      } else if (oauthErrorDescription) {
        errorMessage = oauthErrorDescription;
      }
      
      setAuthError(errorMessage);
      toast.error(errorMessage);
      
      // Clean up URL
      window.history.replaceState(null, '', '/app/auth');
    }
  }, [oauthError, oauthErrorDescription, authCallbackProcessed]);

  // Handle OAuth callback
  useEffect(() => {
    const processAuthCallback = async () => {
      if (hasAuthCallback && !authCallbackProcessed && !user && !oauthError) {
        console.log('[Auth] Processing OAuth callback');
        setAuthCallbackProcessed(true);
        setIsLoading(true);
        
        try {
          const session = await handleAuthCallback();
          if (session) {
            console.log('[Auth] OAuth callback successful, session created');
            // Don't redirect here - let the auth state change handler do it
          } else {
            console.log('[Auth] OAuth callback did not create session');
            setAuthError('Authentication incomplete. Please try again.');
            setIsLoading(false);
          }
        } catch (error) {
          console.error('[Auth] OAuth callback error:', error);
          setAuthError('Authentication failed. Please try again.');
          setIsLoading(false);
        }
      }
    };

    processAuthCallback();
  }, [hasAuthCallback, authCallbackProcessed, user, oauthError]);

  // Initialize native auth service
  useEffect(() => {
    const initializeNativeAuth = async () => {
      try {
        console.log('[Auth] Initializing native auth service');
        await nativeAuthService.initialize();
        setNativeAuthReady(true);
        console.log('[Auth] Native auth service ready');
      } catch (error) {
        console.warn('[Auth] Native auth initialization failed, using web fallback:', error);
        setNativeAuthReady(true); // Still allow web auth
      }
    };

    initializeNativeAuth();
  }, []);

  // Handle successful authentication
  useEffect(() => {
    // If user is logged in and page has finished initial loading, redirect
    if (user && !authLoading && !redirecting && nativeAuthReady && !isLoading) {
      console.log('User is logged in, redirecting to:', redirectTo);
      setRedirecting(true);
      
      // Clean up stored redirect
      localStorage.removeItem('authRedirectTo');
      
      // Clear URL hash and search params from OAuth callback
      if (hasAuthCallback) {
        window.history.replaceState(null, '', '/app/auth');
      }
      
      // Add small delay to ensure state updates before navigation
      const timer = setTimeout(() => {
        // Always redirect to home after successful login (user is already authenticated)
        navigate('/app/home', { replace: true });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, navigate, redirecting, redirectTo, nativeAuthReady, isLoading, hasAuthCallback]);

  // Show loading during OAuth callback processing or auth state check
  if (authLoading || !nativeAuthReady || (hasAuthCallback && !authCallbackProcessed && !oauthError) || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">
            {hasAuthCallback ? 'Completing sign-in...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // If already logged in, redirect to home
  if (user) {
    console.log('User already logged in, redirecting to home');
    return <Navigate to="/app/home" replace />;
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
          <div className="mb-4 p-4 border border-red-200 bg-red-50 text-red-700 rounded-lg">
            <div className="flex items-start space-x-2">
              <div className="text-red-500 mt-1">⚠️</div>
              <div>
                <p className="text-sm font-medium">
                  <TranslatableText text="Authentication Error" forceTranslate={true} />
                </p>
                <p className="text-sm mt-1">{authError}</p>
                {authError.includes('configuration error') && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-red-600 hover:text-red-800">
                      Technical Details
                    </summary>
                    <p className="text-xs mt-1 text-red-600">
                      This error typically means the Google OAuth redirect URI needs to be updated. 
                      Contact support if this persists.
                    </p>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <PlatformAuthButton 
            isLoading={isLoading}
            onLoadingChange={setIsLoading}
            onError={setAuthError}
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
