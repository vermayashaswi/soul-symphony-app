
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MessageSquare, ChartBar, BookOpen } from 'lucide-react';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
      icon: <BookOpen className="h-12 w-12 text-amber-500" />,
      action: "Start Reflecting",
      onClick: () => navigate('/journal')
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Particle background with relative positioning */}
      <div className="fixed inset-0 w-full h-full -z-10">
        <ParticleBackground />
      </div>
      
      {/* Navbar with proper spacing */}
      <Navbar />
      
      {/* Main content with padding to avoid navbar overlap */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 pt-24 pb-12">
        <div className="max-w-3xl w-full text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500 mb-4">
            Welcome to Feelosophy
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Explore your thoughts, track your emotions, and gain valuable insights with AI-powered journaling
          </p>
          <Button size="lg" onClick={handleGetStarted} className="text-lg px-8 py-6">
            {user ? 'Go to Journal' : 'Get Started'}
          </Button>
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
