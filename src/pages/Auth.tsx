
import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { useOnboarding } from '@/hooks/use-onboarding';
import { TranslatableText } from '@/components/translation/TranslatableText';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Safely get auth state with error handling
  let user = null;
  let authLoading = true;
  
  try {
    const authState = useAuth();
    user = authState.user;
    authLoading = authState.isLoading;
  } catch (error) {
    console.error('[Auth] Error accessing auth context:', error);
    setAuthError('Authentication system is still initializing. Please wait...');
  }
  
  const { onboardingComplete } = useOnboarding();
  
  const redirectParam = searchParams.get('redirectTo');
  const fromLocation = location.state?.from?.pathname;
  const storedRedirect = typeof window !== 'undefined' ? localStorage.getItem('authRedirectTo') : null;
  
  // Get valid redirect path with priority
  const getValidRedirectPath = (path: string | null) => {
    if (!path) {
      return onboardingComplete ? '/app/home' : '/app/onboarding';
    }
    
    // Normalize legacy paths
    if (path === '/home') return '/app/home';
    if (path === '/onboarding') return '/app/onboarding';
    
    return path;
  };
  
  // Determine where to redirect after auth
  const redirectTo = getValidRedirectPath(redirectParam || fromLocation || storedRedirect);

  console.log('[Auth] Component state:', { 
    redirectTo, 
    redirectParam, 
    fromLocation,
    storedRedirect,
    hasUser: !!user,
    currentPath: location.pathname,
    onboardingComplete,
    authLoading,
    authError
  });

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // If user is logged in and page has finished initial loading, redirect
    if (user && !authLoading && !redirecting && !authError) {
      console.log('[Auth] User is logged in, redirecting to:', redirectTo);
      setRedirecting(true);
      
      // Clean up stored redirect
      localStorage.removeItem('authRedirectTo');
      
      // Add small delay to ensure state updates before navigation
      const timer = setTimeout(() => {
        // If onboarding is not complete, redirect to onboarding
        if (!onboardingComplete && !redirectTo.includes('onboarding')) {
          console.log('[Auth] Redirecting to onboarding as it is not complete');
          navigate('/app/onboarding', { replace: true });
        } else {
          navigate(redirectTo, { replace: true });
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, navigate, redirecting, redirectTo, onboardingComplete, authError]);

  // If there's an auth error, show it
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-4">Authentication Initializing</h2>
          <p className="text-muted-foreground mb-6">{authError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // If still checking auth state, show loading
  if (authLoading) {
    console.log('[Auth] Auth is loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If already logged in, redirect to target page
  if (user) {
    // If onboarding is not complete, redirect to onboarding instead
    const finalRedirect = !onboardingComplete && !redirectTo.includes('onboarding') 
      ? '/app/onboarding'
      : redirectTo;
      
    console.log('[Auth] User already logged in, redirecting to:', finalRedirect, {
      onboardingComplete,
      originalRedirect: redirectTo
    });
    return <Navigate to={finalRedirect} replace />;
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
