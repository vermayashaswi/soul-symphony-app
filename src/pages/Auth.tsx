
import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Auth() {
  const { user, isLoading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [redirecting, setRedirecting] = useState(false);
  
  // Get the return path from the location state or default to /journal
  const from = location.state?.from?.pathname || '/journal';

  useEffect(() => {
    // Log the current origin/domain for debugging
    console.log('Current origin for Auth page:', window.location.origin);
    
    if (user && !redirecting) {
      console.log('Auth page: User detected, redirecting to:', from);
      setRedirecting(true);
      
      // Add a brief delay to ensure state changes have processed
      const timer = setTimeout(() => {
        navigate(from, { replace: true });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, navigate, redirecting, from]);

  // Handle cases where user has just completed authentication via redirect
  useEffect(() => {
    const handleHashRedirect = async () => {
      // Check if we're coming back from an OAuth redirect
      const hasHashParams = window.location.hash.includes('access_token') || 
                           window.location.hash.includes('error') ||
                           window.location.search.includes('error');
                           
      if (hasHashParams) {
        console.log('Detected auth redirect with hash/search params:', { 
          hash: window.location.hash,
          search: window.location.search 
        });
        
        // Check for error in the URL
        if (window.location.hash.includes('error') || window.location.search.includes('error')) {
          console.error('Error detected in redirect URL');
          toast.error('Authentication failed. Please try again.');
          return;
        }
        
        try {
          // This will automatically exchange the auth code for a session
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error getting session after redirect:', error);
            toast.error('Authentication error. Please try again.');
          } else if (data.session) {
            console.log('Successfully retrieved session after redirect:', data.session.user.email);
            console.log('Current domain:', window.location.origin);
            // Session will be picked up by the other useEffect
          }
        } catch (e) {
          console.error('Exception during auth redirect handling:', e);
          toast.error('Unexpected error during authentication');
        }
      }
    };
    
    handleHashRedirect();
  }, []);

  const handleSignIn = async () => {
    console.log('Initiating Google sign-in from', window.location.origin);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Failed to initiate Google sign-in:', error);
      toast.error('Failed to initiate sign-in process. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
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
          <div className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">F</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to Feelosophy</h1>
          <p className="text-muted-foreground">
            Sign in to start your journaling journey and track your emotional wellbeing
          </p>
        </div>
        
        <div className="space-y-4">
          <Button 
            size="lg" 
            className="w-full flex items-center justify-center gap-2"
            onClick={handleSignIn}
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
