
import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { getRedirectUrl } from '@/services/authService';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState(null);
  const [loginAttemptTime, setLoginAttemptTime] = useState<number | null>(null);
  
  const redirectParam = searchParams.get('redirectTo');
  const from = '/app/home';

  useEffect(() => {
    // Check for error params in URL
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    if (errorParam) {
      setAuthError(errorDescription || 'Authentication failed. Please try again.');
      console.error('Auth error from URL params:', errorParam, errorDescription);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        console.log('Checking auth state on Auth page load');
        // Check if there's already an active session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error checking auth state:', error);
          setAuthError('Failed to check authentication state');
        }
        
        setAuthUser(data.session?.user || null);
        setIsLoading(false);
      } catch (error) {
        console.error('Exception checking auth state:', error);
        setIsLoading(false);
      }
    };
    
    checkAuthState();
  }, []);

  useEffect(() => {
    if (authUser && !redirecting) {
      console.log('Auth page: User detected, redirecting to:', from);
      setRedirecting(true);
      
      // Clean up any auth-related items from local storage
      localStorage.removeItem('authRedirectTo');
      localStorage.removeItem('supabase.auth.error');
      localStorage.removeItem('loginAttemptTime');
      
      // Small delay to ensure state updates before navigation
      const timer = setTimeout(() => {
        navigate(from, { replace: true });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [authUser, navigate, redirecting, from]);

  useEffect(() => {
    const handleAuthRedirect = async () => {
      // Check for auth callback indicators in URL
      const hasAuthParams = window.location.hash.includes('access_token') || 
                          window.location.hash.includes('error') ||
                          window.location.search.includes('error');
                          
      if (hasAuthParams) {
        console.log('Detected auth redirect with params:', { 
          hash: window.location.hash,
          search: window.location.search 
        });
        
        // Handle error case first
        if (window.location.hash.includes('error') || window.location.search.includes('error')) {
          const urlParams = new URLSearchParams(window.location.search);
          const errorDescription = urlParams.get('error_description');
          
          const errorMessage = errorDescription || 'Authentication failed. Please try again.';
          console.error('Error detected in redirect URL:', errorMessage);
          setAuthError(errorMessage);
          toast.error(errorMessage);
          setIsLoading(false);
          return;
        }
        
        try {
          console.log('Processing successful auth redirect');
          
          // Clean any stale auth error that might be in localStorage
          localStorage.removeItem('supabase.auth.error');
          
          // Get the session after the redirect
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error getting session after redirect:', error);
            setAuthError('Authentication error. Please try again.');
            toast.error('Authentication error. Please try again.');
            setIsLoading(false);
          } else if (data.session) {
            console.log('Successfully retrieved session after redirect:', {
              user: data.session.user.email
            });
            
            setAuthUser(data.session.user);
            localStorage.removeItem('loginAttemptTime');
          } else {
            console.warn('No session found after redirect despite hash params');
            setAuthError('Unable to complete sign-in. Please try again.');
            setIsLoading(false);
          }
        } catch (e) {
          console.error('Exception during auth redirect handling:', e);
          setAuthError('Unexpected error during authentication');
          toast.error('Unexpected error during authentication');
          setIsLoading(false);
        }
      } else {
        console.log('No auth redirect detected in URL');
        setIsLoading(false);
      }
    };
    
    handleAuthRedirect();
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsLoading(true);
    
    // Set login attempt time for timing metrics
    const currentTime = Date.now();
    setLoginAttemptTime(currentTime);
    localStorage.setItem('loginAttemptTime', currentTime.toString());
    
    console.log('Initiating Google sign-in from', window.location.href);
    
    try {
      // Clear any existing auth errors or stale session data
      localStorage.removeItem('supabase.auth.error');
      
      // Generate unique values to prevent caching issues
      const timestamp = Date.now();
      const nonce = Math.random().toString(36).substring(2, 15);
      
      // Get the redirect URL
      const redirectUrl = getRedirectUrl();
      console.log('Using redirect URL:', redirectUrl);
      
      // Initiate Google sign-in with explicit options
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            // Force prompt selection to avoid automatic login
            prompt: 'select_account',
            // Add these to prevent caching issues
            _t: timestamp.toString(),
            nonce: nonce
          },
        },
      });
      
      if (error) {
        console.error('Failed to initiate Google sign-in:', error);
        setAuthError(`Failed to initiate sign-in: ${error.message}`);
        toast.error(`Failed to initiate sign-in: ${error.message}`);
        setIsLoading(false);
        throw error;
      }
      
      console.log('Google OAuth flow initiated successfully at:', timestamp);
    } catch (error: any) {
      console.error('Failed to initiate Google sign-in:', error);
      setAuthError('Failed to initiate sign-in process. Please try again.');
      toast.error('Failed to initiate sign-in process. Please try again.');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (authUser) {
    console.log('Auth page: User exists in render, redirecting to', from);
    return <Navigate to={from} replace />;
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
            Welcome to <SouloLogo size="large" className="text-blue-600" />
          </h1>
          <p className="text-muted-foreground">
            Sign in to start your journaling journey
          </p>
        </div>
        
        {authError && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {authError}
          </div>
        )}
        
        <div className="space-y-4">
          <Button 
            size="lg" 
            className="w-full flex items-center justify-center gap-2"
            onClick={handleSignIn}
            disabled={isLoading}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Sign in with Google
          </Button>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
