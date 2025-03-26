
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MessageSquare, ChartBar, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { useEffect, useState, useRef } from 'react';
import { createOrUpdateSession } from '@/utils/audio/auth-profile';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Index() {
  const navigate = useNavigate();
  const { user, isLoading, refreshSession } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionTracked, setSessionTracked] = useState(false);
  const sessionTrackingAttemptedRef = useRef(false);
  const redirectAttemptedRef = useRef(false);
  const sessionCheckAttemptedRef = useRef(false);

  // Add a timeout to prevent infinite loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!authChecked) {
        console.log("Force completing auth check on index page due to timeout");
        setAuthChecked(true);
      }
    }, 1500); // Reduced from 2 seconds to 1.5 second timeout
    
    return () => clearTimeout(timer);
  }, []);

  // Mark as checked once we have definitive auth state
  useEffect(() => {
    if (!isLoading) {
      console.log("Auth loading complete on index page, setting authChecked to true");
      setAuthChecked(true);
    }
  }, [isLoading]);

  // Forceful session check to address redirect issues
  useEffect(() => {
    if (authChecked && !isLoading && !user && !sessionCheckAttemptedRef.current) {
      sessionCheckAttemptedRef.current = true;
      
      // Check if we should have a session based on localStorage flag
      const authSuccess = localStorage.getItem('auth_success') === 'true';
      if (authSuccess) {
        console.log("Auth success flag is true but no user object exists, checking session");
        
        // Force a session check
        const checkSession = async () => {
          try {
            console.log("Performing manual session check");
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error("Error getting session during manual check:", error);
              localStorage.removeItem('auth_success');
              return;
            }
            
            if (data.session) {
              console.log("Found valid session during manual check, refreshing session");
              const refreshResult = await refreshSession();
              
              if (refreshResult) {
                console.log("Session refreshed successfully, redirecting to journal");
                setTimeout(() => navigate('/journal'), 100);
              }
            } else {
              console.log("No session found during manual check, clearing auth success flag");
              localStorage.removeItem('auth_success');
            }
          } catch (e) {
            console.error("Error in manual session check:", e);
          }
        };
        
        checkSession();
      }
    }
  }, [authChecked, isLoading, user, navigate, refreshSession]);

  // Redirect authenticated users to journal page
  useEffect(() => {
    if (user && !redirectAttemptedRef.current && !isLoading) {
      console.log("User is authenticated, redirecting to journal page");
      redirectAttemptedRef.current = true;
      
      // Use a short delay to ensure any other state updates complete
      const redirectTimer = setTimeout(() => {
        navigate('/journal');
      }, 100);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [user, isLoading, navigate]);

  // Track session when user visits index page - only if authenticated
  useEffect(() => {
    // Prevent multiple session tracking attempts
    if (sessionTrackingAttemptedRef.current) {
      return;
    }
    
    if (user && !sessionTracked) {
      sessionTrackingAttemptedRef.current = true;
      console.log("Index page: Tracking session for user", user.id);
      
      // Track session once without retries to avoid unnecessary operations
      createOrUpdateSession(user.id, '/')
        .then(() => {
          setSessionTracked(true);
        })
        .catch(error => {
          console.error("Error tracking session on index page:", error);
          // Don't show errors to users since it's non-critical
        });
    }
  }, [user, sessionTracked]);

  // Check for auth state issues
  useEffect(() => {
    if (authChecked && !isLoading) {
      try {
        const authSuccess = localStorage.getItem('auth_success') === 'true';
        const lastAuthTime = localStorage.getItem('last_auth_time');
        
        if (authSuccess && lastAuthTime && !user) {
          const timeSinceAuth = Date.now() - parseInt(lastAuthTime, 10);
          const isRecent = timeSinceAuth < 30 * 60 * 1000; // Less than 30 minutes
          
          if (isRecent) {
            console.warn('Auth inconsistency detected: localStorage indicates recent auth but no user object');
            toast.error('Session error detected. Please try signing in again.');
            localStorage.removeItem('auth_success');
            localStorage.removeItem('last_auth_time');
          }
        }
      } catch (e) {
        console.warn('Error checking auth state consistency:', e);
      }
    }
  }, [authChecked, isLoading, user]);

  const handleGetStarted = () => {
    if (user) {
      navigate('/journal');
    } else {
      navigate('/auth');
    }
  };

  const featureCards = [
    {
      title: "Voice Journaling",
      description: "Simply speak your thoughts and let AI transcribe them into meaningful journal entries",
      icon: <Mic className="h-12 w-12 text-primary" />,
      action: "Start Recording",
      onClick: () => navigate('/journal')
    },
    {
      title: "AI Chat Companion",
      description: "Have meaningful conversations about your journal entries with your AI companion",
      icon: <MessageSquare className="h-12 w-12 text-indigo-500" />,
      action: "Chat Now",
      onClick: () => navigate('/chat')
    },
    {
      title: "Emotional Insights",
      description: "Gain valuable insights into your emotional patterns and wellbeing over time",
      icon: <ChartBar className="h-12 w-12 text-green-500" />,
      action: "View Insights",
      onClick: () => navigate('/insights')
    },
    {
      title: "Guided Reflection",
      description: "Follow AI-generated prompts to reflect on your experiences more deeply",
      icon: <BookOpen className="h-12 w-12 text-violet-500" />,
      action: "Start Reflecting",
      onClick: () => navigate('/journal')
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main content with padding to avoid navbar overlap */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-12">
        <div className="max-w-3xl w-full text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-violet-500 mb-4">
            Welcome to Feelosophy
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Explore your thoughts, track your emotions, and gain valuable insights with AI-powered VOICE journaling
          </p>
          
          {isLoading && !authChecked ? (
            <Button size="lg" disabled className="text-lg px-8 py-6">
              <span className="animate-pulse">Loading...</span>
            </Button>
          ) : (
            <Button size="lg" onClick={handleGetStarted} className="text-lg px-8 py-6">
              {user ? 'Go to Journal' : 'Get Started'}
            </Button>
          )}
        </div>

        {/* Feature cards with responsive grid and proper spacing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full mt-8">
          {featureCards.map((card, index) => (
            <Card key={index} className="border shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  {card.icon}
                </div>
                <CardTitle className="text-center">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">{card.description}</CardDescription>
              </CardContent>
              <CardFooter className="flex justify-center">
                <Button variant="outline" onClick={card.onClick}>
                  {card.action}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
