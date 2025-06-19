
import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { useOnboarding } from '@/hooks/use-onboarding';
import { TranslatableText } from '@/components/translation/TranslatableText';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';
import { useWebtonativeViewport } from '@/hooks/use-webtonative-viewport';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const [authError, setAuthError] = useState<string | null>(null);
  const { isWebtonative } = useIsMobile();
  const { isKeyboardOpen } = useWebtonativeViewport();
  
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

  console.log('Auth page mounted', { 
    redirectTo, 
    redirectParam, 
    fromLocation,
    storedRedirect,
    hasUser: !!user,
    currentPath: location.pathname,
    onboardingComplete,
    isWebtonative,
    isKeyboardOpen
  });

  // Set up OAuth flow detection for webtonative
  useEffect(() => {
    if (isWebtonative) {
      document.body.classList.add('webtonative-oauth-flow');
      return () => {
        document.body.classList.remove('webtonative-oauth-flow');
      };
    }
  }, [isWebtonative]);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // If user is logged in and page has finished initial loading, redirect
    if (user && !authLoading && !redirecting) {
      console.log('User is logged in, redirecting to:', redirectTo);
      setRedirecting(true);
      
      // Clean up stored redirect
      localStorage.removeItem('authRedirectTo');
      
      // Add small delay to ensure state updates before navigation
      const timer = setTimeout(() => {
        // If onboarding is not complete, redirect to onboarding
        if (!onboardingComplete && !redirectTo.includes('onboarding')) {
          console.log('Redirecting to onboarding as it is not complete');
          navigate('/app/onboarding', { replace: true });
        } else {
          navigate(redirectTo, { replace: true });
        }
      }, 500);
      
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

  // If already logged in, redirect to target page
  if (user) {
    // If onboarding is not complete, redirect to onboarding instead
    const finalRedirect = !onboardingComplete && !redirectTo.includes('onboarding') 
      ? '/app/onboarding'
      : redirectTo;
      
    console.log('User already logged in, redirecting to:', finalRedirect, {
      onboardingComplete,
      originalRedirect: redirectTo
    });
    return <Navigate to={finalRedirect} replace />;
  }

  return (
    <div className={`auth-page ${isKeyboardOpen ? 'keyboard-visible webtonative-keyboard-open' : ''}`}>
      <div className={`auth-container ${isKeyboardOpen ? 'keyboard-visible webtonative-keyboard-open' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`auth-card w-full max-w-md ${isKeyboardOpen ? 'keyboard-visible webtonative-keyboard-open' : ''}`}
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              <TranslatableText text="Welcome to" forceTranslate={true} />{" "}
              <SouloLogo size="large" className="text-blue-600" />
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              <TranslatableText 
                text="Sign in to start your journaling journey and track your emotional wellbeing" 
                forceTranslate={true} 
              />
            </p>
          </div>
          
          {authError && (
            <div className="mb-4 p-3 border border-red-500 bg-red-50 text-red-600 rounded-lg">
              <p className="text-sm">
                <TranslatableText text="Error:" forceTranslate={true} /> {authError}
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            <PlatformAuthButton 
              isLoading={isLoading}
              onLoadingChange={setIsLoading}
              onError={setAuthError}
            />
            
            <div className="text-center text-xs md:text-sm text-muted-foreground">
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
      
      {/* Debug info for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-keyboard-info">
          Keyboard: {isKeyboardOpen ? 'Open' : 'Closed'} | 
          Webtonative: {isWebtonative ? 'Yes' : 'No'}
        </div>
      )}
    </div>
  );
}
