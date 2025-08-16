
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Brain, Heart, TrendingUp, Sparkles, MessageSquare, BarChart3 } from 'lucide-react';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import { TranslatableText } from '@/components/translation/TranslatableText';
import SouloLogo from '@/components/SouloLogo';
import { useAuth } from '@/contexts/AuthContext';

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/app/home');
    } else {
      navigate('/app/auth');
    }
  };

  const handleTryFeature = (feature: string) => {
    if (user) {
      navigate(`/app/${feature}`);
    } else {
      navigate(`/app/auth?redirectTo=${encodeURIComponent(`/app/${feature}`)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="mb-8">
            <SouloLogo size="large" className="mx-auto mb-6" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            <TranslatableText text="Your AI-Powered Mental Wellness Journey" />
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
            <TranslatableText text="Transform your thoughts into insights with intelligent journaling, AI conversations, and personalized mental health tracking." />
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button size="lg" onClick={handleGetStarted} className="text-lg px-8 py-4">
              <Sparkles className="mr-2 h-5 w-5" />
              {user ? (
                <TranslatableText text="Open Your Dashboard" />
              ) : (
                <TranslatableText text="Start Your Journey Free" />
              )}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            {!user && (
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => navigate('/app/auth')}
                className="text-lg px-8 py-4"
              >
                <TranslatableText text="Sign In" />
              </Button>
            )}
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <TranslatableText text="Privacy First" />
            </div>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <TranslatableText text="AI-Powered Insights" />
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <TranslatableText text="Track Your Progress" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <TranslatableText text="Powerful Features for Your Wellbeing" />
            </h2>
            <p className="text-xl text-muted-foreground">
              <TranslatableText text="Discover tools designed to support your mental health journey" />
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer group" 
                  onClick={() => handleTryFeature('chat')}>
              <CardHeader>
                <MessageSquare className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <CardTitle className="text-xl">
                  <TranslatableText text="Smart AI Chat" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Have meaningful conversations with your AI companion that understands your emotional journey" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full group-hover:bg-primary/10">
                  {user ? (
                    <TranslatableText text="Start Chatting" />
                  ) : (
                    <TranslatableText text="Try Smart Chat" />
                  )}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => handleTryFeature('insights')}>
              <CardHeader>
                <BarChart3 className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <CardTitle className="text-xl">
                  <TranslatableText text="Personal Insights" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Get AI-powered analysis of your mood patterns and personal growth trends" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full group-hover:bg-primary/10">
                  {user ? (
                    <TranslatableText text="View Insights" />
                  ) : (
                    <TranslatableText text="Explore Insights" />
                  )}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => handleTryFeature('journal')}>
              <CardHeader>
                <Brain className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <CardTitle className="text-xl">
                  <TranslatableText text="Intelligent Journaling" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Transform your thoughts into structured insights with AI-guided reflection prompts" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full group-hover:bg-primary/10">
                  {user ? (
                    <TranslatableText text="Open Journal" />
                  ) : (
                    <TranslatableText text="Start Journaling" />
                  )}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            <TranslatableText text="Ready to Transform Your Mental Wellness?" />
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            <TranslatableText text="Join thousands of users who have already started their journey to better mental health with AI-powered insights." />
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleGetStarted} className="text-lg px-8 py-4">
              <Sparkles className="mr-2 h-5 w-5" />
              {user ? (
                <TranslatableText text="Continue Your Journey" />
              ) : (
                <TranslatableText text="Get Started Free" />
              )}
            </Button>
            
            {!user && (
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => navigate('/app/auth')}
                className="text-lg px-8 py-4"
              >
                <TranslatableText text="Learn More" />
              </Button>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
