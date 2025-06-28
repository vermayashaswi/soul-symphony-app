
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

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nativeAuthReady, setNativeAuthReady] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const [authError, setAuthError] = useState<string | null>(null);
  
  const redirectParam = searchParams.get('redirectTo');
  const fromLocation = location.state?.from?.pathname;
  const storedRedirect = typeof window !== 'undefined' ? localStorage.getItem('authRedirectTo') : null;
  
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
    onboardingComplete
  });

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
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // If user is logged in and page has finished initial loading, redirect
    if (user && !authLoading && !redirecting && nativeAuthReady) {
      console.log('User is logged in, redirecting to:', redirectTo);
      setRedirecting(true);
      
      // Clean up stored redirect
      localStorage.removeItem('authRedirectTo');
      
      // Add small delay to ensure state updates before navigation
      const timer = setTimeout(() => {
        // Always redirect to home after successful login (user is already authenticated)
        navigate('/app/home', { replace: true });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, navigate, redirecting, redirectTo, nativeAuthReady]);

  // If still checking auth state or initializing native auth, show loading
  if (authLoading || !nativeAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
          <div className="mb-4 p-2 border border-red-500 bg-red-50 text-red-600 rounded">
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
