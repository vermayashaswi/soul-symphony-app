
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MessageSquare, ChartBar, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { useEffect, useState } from 'react';
import { createOrUpdateSession } from '@/utils/audio/auth-utils';
import { toast } from 'sonner';

export default function Index() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionTracked, setSessionTracked] = useState(false);

  // Add a timeout to prevent infinite loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthChecked(true);
    }, 2000); // 2 second timeout
    
    return () => clearTimeout(timer);
  }, []);

  // Mark as checked once we have definitive auth state
  useEffect(() => {
    if (!isLoading) {
      setAuthChecked(true);
    }
  }, [isLoading]);

  // Track session when user visits index page - only if authenticated
  useEffect(() => {
    if (user && !isLoading && !sessionTracked) {
      console.log("Index page: Tracking session for user", user.id);
      
      // Add retry logic for session tracking
      const trackSession = async () => {
        try {
          const result = await createOrUpdateSession(user.id, '/');
          console.log("Session tracking result:", result);
          setSessionTracked(true);
        } catch (error) {
          console.error("Error tracking session on index page:", error);
          // We don't want to show this error to users since it's non-critical
        }
      };
      
      // Try session tracking with a backoff interval
      const retryIntervals = [0, 1000, 3000]; // Retry immediately, then after 1s, then after 3s
      
      for (let i = 0; i < retryIntervals.length; i++) {
        setTimeout(() => {
          if (!sessionTracked) {
            trackSession();
          }
        }, retryIntervals[i]);
      }
    }
  }, [user, isLoading, sessionTracked]);

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
