
import { useState, useEffect, useCallback } from 'react';
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
import { handleAuthCallback } from '@/services/authService';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [processingCallback, setProcessingCallback] = useState(false);
  
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const { isWebtonative, isAndroid, isIOS } = useIsMobile();
  const { keyboardState, setInputFocused } = useKeyboardState();
  
  const redirectParam = searchParams.get('redirectTo');
  const fromLocation = location.state?.from?.pathname;
  const storedRedirect = typeof window !== 'undefined' ? localStorage.getItem('authRedirectTo') : null;
  
  // Enhanced redirect path logic
  const getValidRedirectPath = useCallback((path: string | null) => {
    if (!path) {
      return onboardingComplete ? '/app/home' : '/app/onboarding';
    }
    
    // Normalize legacy paths
    if (path === '/home') return '/app/home';
    if (path === '/onboarding') return '/app/onboarding';
    
    return path;
  }, [onboardingComplete]);
  
  const redirectTo = getValidRedirectPath(redirectParam || fromLocation || storedRedirect);

  // Enhanced OAuth callback handling
  useEffect(() => {
    const processOAuthCallback = async () => {
      // Only process if we have auth parameters and not already processing
      const hasAuthParams = window.location.search.includes('code') || 
                          window.location.hash.includes('access_token') ||
                          window.location.search.includes('error') ||
                          window.location.hash.includes('error');
      
      if (!hasAuthParams || processingCallback) {
        return;
      }
      
      console.log('[Auth] Processing OAuth callback...');
      setProcessingCallback(true);
      setIsLoading(true);
      
      try {
        const session = await handleAuthCallback();
        
        if (session?.user) {
          console.log('[Auth] OAuth callback successful, user authenticated');
          // AuthContext will handle the user state update
          // Navigation will happen in the next useEffect
        } else {
          console.log('[Auth] OAuth callback completed but no user found');
          setAuthError('Authentication failed. Please try again.');
        }
      } catch (error: any) {
        console.error('[Auth] OAuth callback error:', error);
        setAuthError(error.message || 'Authentication failed. Please try again.');
      } finally {
        setIsLoading(false);
        setProcessingCallback(false);
      }
    };
    
    // Only run callback processing on mount
    processOAuthCallback();
  }, []); // Empty dependency array to run only once

  // Enhanced user redirect logic
  useEffect(() => {
    if (user && !authLoading && !processingCallback) {
      console.log('[Auth] User authenticated, preparing redirect:', { 
        redirectTo,
        onboardingComplete 
      });
      
      localStorage.removeItem('authRedirectTo');
      
      // Small delay to ensure state consistency
      const timer = setTimeout(() => {
        const finalRedirect = !onboardingComplete && !redirectTo.includes('onboarding') 
          ? '/app/onboarding'
          : redirectTo;
          
        console.log('[Auth] Redirecting to:', finalRedirect);
        navigate(finalRedirect, { replace: true });
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, processingCallback, navigate, redirectTo, onboardingComplete]);

  // Show loading during auth processing
  if (authLoading || processingCallback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            <TranslatableText text="Authenticating..." forceTranslate={true} />
          </p>
        </div>
      </div>
    );
  }

  // Redirect if already authenticated
  if (user) {
    const finalRedirect = !onboardingComplete && !redirectTo.includes('onboarding') 
      ? '/app/onboarding'
      : redirectTo;
      
    return <Navigate to={finalRedirect} replace />;
  }

  // Enhanced container styles for keyboard handling
  const containerStyles = keyboardState.isOpen && isWebtonative ? {
    height: `${keyboardState.availableHeight}px`,
    maxHeight: `${keyboardState.availableHeight}px`,
  } : {};

  return (
    <div 
      className={`min-h-screen flex items-center justify-center p-4 bg-background ${
        keyboardState.isOpen ? 'keyboard-visible' : ''
      } ${isWebtonative ? 'webtonative-auth' : ''}`}
      style={containerStyles}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`w-full max-w-md bg-card rounded-lg shadow-lg p-6 ${
          keyboardState.isOpen ? 'keyboard-adjusted' : ''
        }`}
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
      
      {/* Debug info for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-black text-white p-2 rounded text-xs opacity-70 z-50">
          Webtonative: {isWebtonative ? 'Yes' : 'No'} | 
          Keyboard: {keyboardState.isOpen ? 'Open' : 'Closed'} |
          Processing: {processingCallback ? 'Yes' : 'No'}
        </div>
      )}
    </div>
  );
}
