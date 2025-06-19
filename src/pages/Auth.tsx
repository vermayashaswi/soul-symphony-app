
import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { useOnboarding } from '@/hooks/use-onboarding';
import { TranslatableText } from '@/components/translation/TranslatableText';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';
import { useKeyboardState } from '@/hooks/use-keyboard-state';
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
  const { isWebtonative, isAndroid, isIOS } = useIsMobile();
  const { keyboardState, setInputFocused } = useKeyboardState();
  
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
    keyboardOpen: keyboardState.isOpen,
    keyboardHeight: keyboardState.height,
    availableHeight: keyboardState.availableHeight
  });

  // Enhanced OAuth flow detection and optimization for webtonative
  useEffect(() => {
    if (isWebtonative) {
      const body = document.body;
      const html = document.documentElement;
      
      // Add webtonative OAuth flow classes
      body.classList.add('webtonative-oauth-flow', 'auth-viewport-optimized');
      html.classList.add('webtonative-oauth-environment');
      
      // Set up enhanced viewport management for OAuth
      const optimizeAuthViewport = () => {
        const currentHeight = window.innerHeight;
        const visualHeight = window.visualViewport?.height || currentHeight;
        
        // Set CSS custom properties for auth-specific viewport
        html.style.setProperty('--auth-vh', `${currentHeight * 0.01}px`);
        html.style.setProperty('--auth-visual-vh', `${visualHeight * 0.01}px`);
        html.style.setProperty('--auth-available-height', `${visualHeight}px`);
        html.style.setProperty('--auth-total-height', `${currentHeight}px`);
        
        console.log('[Auth] Viewport optimized for OAuth:', {
          currentHeight,
          visualHeight,
          keyboardHeight: currentHeight - visualHeight,
          isWebtonative
        });
      };
      
      // Initial optimization
      optimizeAuthViewport();
      
      // Set up listeners for viewport changes during OAuth flow
      const handleAuthResize = () => {
        console.log('[Auth] OAuth viewport resize detected');
        setTimeout(optimizeAuthViewport, 100);
      };
      
      const handleAuthOrientationChange = () => {
        console.log('[Auth] OAuth orientation change detected');
        setTimeout(optimizeAuthViewport, 300);
      };
      
      window.addEventListener('resize', handleAuthResize);
      window.addEventListener('orientationchange', handleAuthOrientationChange);
      
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', optimizeAuthViewport);
      }
      
      return () => {
        body.classList.remove('webtonative-oauth-flow', 'auth-viewport-optimized');
        html.classList.remove('webtonative-oauth-environment');
        
        window.removeEventListener('resize', handleAuthResize);
        window.removeEventListener('orientationchange', handleAuthOrientationChange);
        
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', optimizeAuthViewport);
        }
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
      <div className="min-h-screen flex items-center justify-center auth-loading-container">
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

  // Calculate dynamic styles based on keyboard state
  const containerStyles = keyboardState.isOpen && isWebtonative ? {
    height: `${keyboardState.availableHeight}px`,
    maxHeight: `${keyboardState.availableHeight}px`,
    minHeight: `${keyboardState.availableHeight}px`,
  } : {};

  const cardStyles = keyboardState.isOpen && isWebtonative ? {
    maxHeight: `${keyboardState.availableHeight - 32}px`, // 32px for padding
    overflowY: 'auto' as const,
  } : {};

  return (
    <div 
      className={`auth-page ${keyboardState.isOpen ? 'keyboard-visible webtonative-keyboard-open' : ''} ${isWebtonative ? 'webtonative-auth-optimized' : ''}`}
      style={containerStyles}
    >
      <div 
        className={`auth-container ${keyboardState.isOpen ? 'keyboard-visible webtonative-keyboard-open' : ''} ${isWebtonative ? 'webtonative-auth-container' : ''}`}
        style={containerStyles}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`auth-card w-full max-w-md ${keyboardState.isOpen ? 'keyboard-visible webtonative-keyboard-open' : ''} ${isWebtonative ? 'webtonative-auth-card' : ''}`}
          style={cardStyles}
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
              onFocusChange={setInputFocused}
              keyboardState={keyboardState}
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
      
      {/* Enhanced debug info for webtonative development */}
      {(process.env.NODE_ENV === 'development' || isWebtonative) && (
        <div className="debug-auth-info">
          KB: {keyboardState.isOpen ? 'Open' : 'Closed'} | 
          H: {keyboardState.height}px | 
          AH: {keyboardState.availableHeight}px |
          WTN: {isWebtonative ? 'Yes' : 'No'} |
          Platform: {isAndroid ? 'Android' : isIOS ? 'iOS' : 'Other'}
        </div>
      )}
    </div>
  );
}
