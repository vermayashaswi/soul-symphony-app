
import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SouloLogo from '@/components/SouloLogo';
import { signInWithGoogle, debugAuthState } from '@/services/authService';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [debugOpen, setDebugOpen] = useState(true); // Set debug to open by default
  const { addEvent, isEnabled, toggleEnabled } = useDebugLog();
  
  const redirectParam = searchParams.get('redirectTo');
  const fromLocation = location.state?.from?.pathname;
  const storedRedirect = typeof window !== 'undefined' ? localStorage.getItem('authRedirectTo') : null;
  
  // Determine where to redirect after auth
  const redirectTo = redirectParam || fromLocation || storedRedirect || '/app/home';

  // Enhanced debug logging
  useEffect(() => {
    // Enable debug mode by default
    if (!isEnabled) {
      toggleEnabled();
    }
    
    const debugData = {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      redirectTo,
      hasUser: !!user,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      authLoadingState: authLoading,
      redirectingState: redirecting
    };
    
    setDebugInfo(prev => ({...prev, initialMount: debugData}));
    console.log('Auth: Component mounted', debugData);
    addEvent('auth', 'Auth component mounted', 'info', debugData);

    // Add additional debugging info for the URL and navigation timing
    const navTiming = window.performance && window.performance.timing ? {
      navigationStart: window.performance.timing.navigationStart,
      redirectStart: window.performance.timing.redirectStart,
      redirectEnd: window.performance.timing.redirectEnd,
      fetchStart: window.performance.timing.fetchStart,
      domainLookupStart: window.performance.timing.domainLookupStart,
      domainLookupEnd: window.performance.timing.domainLookupEnd,
      connectStart: window.performance.timing.connectStart,
      connectEnd: window.performance.timing.connectEnd,
      secureConnectionStart: window.performance.timing.secureConnectionStart,
      requestStart: window.performance.timing.requestStart,
      responseStart: window.performance.timing.responseStart,
      responseEnd: window.performance.timing.responseEnd,
      domLoading: window.performance.timing.domLoading,
      domInteractive: window.performance.timing.domInteractive,
      domContentLoadedEventStart: window.performance.timing.domContentLoadedEventStart,
      domContentLoadedEventEnd: window.performance.timing.domContentLoadedEventEnd,
      domComplete: window.performance.timing.domComplete,
      loadEventStart: window.performance.timing.loadEventStart,
      loadEventEnd: window.performance.timing.loadEventEnd
    } : 'Navigation Timing API not available';
    
    setDebugInfo(prev => ({...prev, navigationTiming: navTiming}));
    addEvent('auth', 'Navigation timing info', 'info', navTiming);

    // Debug auth state on component mount
    debugAuthState().then(({ session, user }) => {
      const authStateData = { 
        hasSession: !!session, 
        hasUser: !!user,
        userEmail: user?.email,
        sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        provider: user?.app_metadata?.provider || null
      };
      
      setDebugInfo(prev => ({...prev, initialAuthState: authStateData}));
      console.log('Auth: Initial auth state', authStateData);
      addEvent('auth', 'Initial auth state checked', !!session ? 'success' : 'info', authStateData);
    });
  }, []);

  useEffect(() => {
    // Check if we're coming back from OAuth with hash parameters
    const hasHashParams = window.location.hash.includes('access_token') || 
                          window.location.hash.includes('error') ||
                          window.location.search.includes('error');
                          
    if (hasHashParams) {
      const hashData = {
        hash: window.location.hash,
        search: window.location.search,
        timestamp: new Date().toISOString()
      };
      
      setDebugInfo(prev => ({...prev, hashParams: hashData}));
      console.log('Auth: Detected hash params in URL, processing auth result', hashData);
      addEvent('auth', 'Detected hash params in URL', 'info', hashData);
      
      // Process the hash using the correct method
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          const errorData = {
            message: error.message,
            code: error.code,
            status: error.status,
            timestamp: new Date().toISOString()
          };
          
          setDebugInfo(prev => ({...prev, sessionError: errorData}));
          console.error('Auth: Error getting session from URL', error);
          addEvent('auth', 'Error getting session from URL', 'error', errorData);
          setAuthError(error.message);
          toast.error(`Authentication failed: ${error.message}`);
        } else if (data.session) {
          const sessionData = {
            user: data.session.user.email,
            expires: data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null,
            provider: data.session.user.app_metadata?.provider || null,
            accessTokenLength: data.session.access_token ? data.session.access_token.length : 0,
            hasRefreshToken: !!data.session.refresh_token,
            timestamp: new Date().toISOString()
          };
          
          setDebugInfo(prev => ({...prev, sessionSuccess: sessionData}));
          console.log('Auth: Successfully got session from URL', sessionData);
          addEvent('auth', 'Successfully got session from URL', 'success', sessionData);
        } else {
          const noSessionData = {
            message: 'No session returned but no error either',
            timestamp: new Date().toISOString()
          };
          
          setDebugInfo(prev => ({...prev, noSession: noSessionData}));
          console.warn('Auth: No session returned from URL', noSessionData);
          addEvent('auth', 'No session returned from URL', 'warning', noSessionData);
        }
        setIsLoading(false);
      });
      
      // Show error toast if error in URL
      if (window.location.hash.includes('error') || window.location.search.includes('error')) {
        const urlErrorData = {
          hash: window.location.hash,
          search: window.location.search,
          timestamp: new Date().toISOString()
        };
        
        setDebugInfo(prev => ({...prev, urlError: urlErrorData}));
        console.error('Auth: Error detected in redirect URL', urlErrorData);
        addEvent('auth', 'Error detected in redirect URL', 'error', urlErrorData);
        toast.error('Authentication failed. Please try again.');
        setAuthError('Error detected in redirect URL');
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const authStateData = { 
      user: !!user, 
      authLoading, 
      redirectTo,
      authError,
      timestamp: new Date().toISOString()
    };
    
    setDebugInfo(prev => ({...prev, currentAuthState: authStateData}));
    console.log('Auth: Current session state:', authStateData);
    addEvent('auth', 'Current session state updated', !!user ? 'success' : 'info', authStateData);
    
    // If user is logged in and page has finished initial loading, redirect
    if (user && !authLoading && !redirecting) {
      const redirectData = {
        destination: redirectTo,
        user: user.email,
        timestamp: new Date().toISOString()
      };
      
      setDebugInfo(prev => ({...prev, redirectAttempt: redirectData}));
      console.log('Auth: User authenticated, redirecting to:', redirectData);
      addEvent('auth', 'User authenticated, redirecting', 'success', redirectData);
      setRedirecting(true);
      
      // Clean up stored redirect
      localStorage.removeItem('authRedirectTo');
      
      // Add small delay to ensure state updates before navigation
      const timer = setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, navigate, redirecting, redirectTo]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      
      const signInData = {
        timestamp: new Date().toISOString(),
        redirectTo: redirectTo,
        currentPath: location.pathname
      };
      
      setDebugInfo(prev => ({...prev, signInAttempt: signInData}));
      console.log('Auth: Initiating Google sign-in', signInData);
      addEvent('auth', 'Initiating Google sign-in', 'info', signInData);
      
      await signInWithGoogle();
      addEvent('auth', 'Google sign-in initialization successful', 'success');
      // The page will be redirected by Supabase, so no need to do anything else here
    } catch (error: any) {
      const errorData = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      
      setDebugInfo(prev => ({...prev, signInError: errorData}));
      console.error('Auth: Failed to initiate Google sign-in:', error);
      addEvent('auth', 'Failed to initiate Google sign-in', 'error', errorData);
      setAuthError(error.message);
      toast.error('Failed to initiate sign-in. Please try again.');
      setIsLoading(false);
    }
  };
  
  const forceDebugState = async () => {
    const state = await debugAuthState();
    setDebugInfo(prev => ({
      ...prev, 
      forcedDebugState: {
        ...state,
        timestamp: new Date().toISOString(),
        hasSession: !!state.session,
        hasUser: !!state.user,
        sessionExpiry: state.session?.expires_at ? new Date(state.session.expires_at * 1000).toISOString() : null,
        signInMethodData: state.session?.user?.app_metadata
      }
    }));
    addEvent('auth', 'Forced debug state check', 'info', state);
    
    // Check local storage for redirect info
    const localStorageItems = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          localStorageItems[key] = localStorage.getItem(key);
        } catch (e) {
          localStorageItems[key] = '[Error reading value]';
        }
      }
    }
    
    setDebugInfo(prev => ({
      ...prev,
      localStorage: {
        items: localStorageItems,
        timestamp: new Date().toISOString()
      }
    }));
    
    addEvent('auth', 'Local storage checked', 'info', { localStorage: localStorageItems });
    
    // Check cookies
    const cookieData = document.cookie ? document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {}) : {};
    
    setDebugInfo(prev => ({
      ...prev,
      cookies: {
        items: cookieData,
        timestamp: new Date().toISOString()
      }
    }));
    
    addEvent('auth', 'Cookies checked', 'info', { cookies: cookieData });
    
    // Check network connectivity
    const connectionData = {
      online: navigator.onLine,
      effectiveType: (navigator as any).connection ? (navigator as any).connection.effectiveType : 'unknown',
      timestamp: new Date().toISOString()
    };
    
    setDebugInfo(prev => ({
      ...prev,
      networkConnection: connectionData
    }));
    
    addEvent('auth', 'Network connection checked', 'info', connectionData);
    
    // Also enable debug mode
    if (!isEnabled) {
      toggleEnabled();
    }
  };

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
    console.log('Auth: User already logged in, redirecting to:', redirectTo);
    return <Navigate to={redirectTo} replace />;
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
            Sign in to start your journaling journey and track your emotional wellbeing
          </p>
        </div>
        
        {authError && (
          <div className="mb-4 p-2 border border-red-500 bg-red-50 text-red-600 rounded">
            <p className="text-sm">Error: {authError}</p>
          </div>
        )}
        
        <div className="space-y-4">
          <Button 
            size="lg" 
            className="w-full flex items-center justify-center gap-2"
            onClick={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="animate-spin h-5 w-5 border-t-2 border-white rounded-full mr-2" />
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                </g>
              </svg>
            )}
            Sign in with Google
          </Button>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
        
        {/* Debug Button and Collapsible Debug Panel */}
        <div className="mt-8 border-t pt-4">
          <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
            <div className="flex justify-between items-center">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  {debugOpen ? "Hide Debugging Info" : "Show Debugging Info"}
                </Button>
              </CollapsibleTrigger>
              <Button 
                variant="secondary" 
                size="sm" 
                className="ml-2"
                onClick={forceDebugState}
              >
                Refresh Debug
              </Button>
            </div>
            <CollapsibleContent className="mt-4 space-y-2">
              <div className="rounded border p-2 text-xs bg-slate-50 overflow-auto max-h-80">
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const debugData = JSON.stringify(debugInfo, null, 2);
                    navigator.clipboard.writeText(debugData);
                    toast.success("Debug info copied to clipboard");
                  }}
                >
                  Copy Debug Info
                </Button>
                <Button 
                  variant={isEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleEnabled}
                >
                  {isEnabled ? "Disable Debug Mode" : "Enable Debug Mode"}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </motion.div>
    </div>
  );
}
