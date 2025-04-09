
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Mic, Brain } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import SouloLogo from '@/components/SouloLogo';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/use-onboarding';
import { Card, CardContent, CardDescription, CardFooter } from '@/components/ui/card';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { resetOnboarding } = useOnboarding();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile || mobileDemo;

  const navigateToFeature = (path: string) => {
    if (!user && path !== '/') {
      navigate(`/auth?redirectTo=${path}`);
    } else {
      navigate(path);
    }
  };

  const handleStartOnboarding = () => {
    resetOnboarding();
    navigate('/onboarding');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  // If user is not logged in, show welcome screen with auth options
  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <ParticleBackground />
        <Navbar />
        
        <motion.main
          className={cn(
            "flex-1 container mx-auto px-4 py-8 relative z-10",
            shouldRenderMobile ? "max-w-md" : ""
          )}
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.div
            className="text-center mb-4" 
            variants={itemVariants}
          >
            <h1 className={`${shouldRenderMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-3 flex items-center justify-center`}>
              <span className="text-foreground dark:text-white">
                Welcome to
              </span> 
              <SouloLogo size={shouldRenderMobile ? "large" : "large"} className="ml-2" useColorTheme={true} animate={true} />
            </h1>
            <p className={`${shouldRenderMobile ? 'text-lg' : 'text-xl'} max-w-2xl mx-auto text-primary animate-pulse mt-4 mb-8`}>
              Your personal AI companion for emotional wellness and self-reflection using VOICE journaling
            </p>
            
            <motion.div 
              className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
              variants={itemVariants}
            >
              <Button 
                size={shouldRenderMobile ? "default" : "lg"} 
                onClick={() => navigate('/auth')}
                className="animate-pulse"
              >
                Get Started
              </Button>
              
              {(isMobile || mobileDemo) && (
                <Button 
                  size={shouldRenderMobile ? "default" : "lg"} 
                  variant="outline"
                  onClick={handleStartOnboarding}
                >
                  View Onboarding
                </Button>
              )}
            </motion.div>
          </motion.div>
        </motion.main>
      </div>
    );
  }

  // When user is logged in, show feature cards
  const features = [
    {
      title: "Record Your Thoughts",
      description: "Capture your daily reflections with voice recordings that are automatically transcribed and analyzed.",
      icon: <Mic className="h-14 w-14 text-amber-500" />,
      cta: "Start Journaling",
      ctaAction: () => navigateToFeature('/journal'),
    },
    {
      title: "AI Analysis",
      description: "Get insights into your emotional patterns and themes through advanced AI analysis of your journal entries.",
      icon: <Brain className="h-14 w-14 text-amber-500" />,
      cta: "See Insights",
      ctaAction: () => navigateToFeature('/insights'),
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <motion.main
        className="flex-1 container mx-auto px-4 py-8 pb-24 relative z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div 
          className="text-center"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl font-bold mb-2 mt-8 bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            Welcome to SOuLO
          </h1>
          <p className="text-base text-amber-500 mb-8 max-w-md mx-auto">
            Your personal AI companion for emotional wellness and self-reflection using VOICE journaling
          </p>
        </motion.div>

        <div className="space-y-6 max-w-md mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 + 0.3 }}
            >
              <Card className="overflow-hidden border border-amber-200/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 p-2 rounded-full bg-amber-100/10">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-amber-500">{feature.title}</h3>
                      <CardDescription className="mt-2 text-sm text-muted-foreground">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-0">
                  <Button
                    className="w-full rounded-none py-5 text-base bg-amber-500 hover:bg-amber-600"
                    onClick={feature.ctaAction}
                  >
                    {feature.cta}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="h-16"></div> {/* Spacer for bottom navigation */}
      </motion.main>
    </div>
  );
};

export default Index;
