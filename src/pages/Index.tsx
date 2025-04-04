import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Mic, Brain, LineChart, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import SouloLogo from '@/components/SouloLogo';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const [typingText, setTypingText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

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

  const iconVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        duration: 0.5,
        yoyo: Infinity,
        repeatDelay: 2
      }
    }
  };

  const pulseVariants = {
    pulse: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity
      }
    }
  };

  const waveVariants = {
    wave: {
      y: [0, -10, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  useEffect(() => {
    if (shouldRenderMobile) {
      const metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    }
    
    if (isTyping) {
      const text = "How have I been feeling lately?";
      let currentIndex = 0;
      
      const typingInterval = setInterval(() => {
        if (currentIndex <= text.length) {
          setTypingText(text.substring(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
          
          setTimeout(() => {
            setShowResponse(true);
          }, 800);
        }
      }, 100);
      
      return () => clearInterval(typingInterval);
    }
  }, [isTyping, shouldRenderMobile]);

  useEffect(() => {
    const animationCycle = () => {
      setTypingText("");
      setShowResponse(false);
      
      setTimeout(() => {
        setIsTyping(true);
      }, 1500);
    };
    
    animationCycle();
    
    const intervalId = setInterval(animationCycle, 8000);
    
    return () => clearInterval(intervalId);
  }, []);

  const features = [
    {
      title: "Record Your Thoughts",
      description: "Capture your daily reflections with voice recordings that are automatically transcribed and analyzed.",
      icon: <Mic className="h-10 w-10 text-primary" />,
      animation: pulseVariants,
      animationState: "pulse",
      cta: "Start Journaling",
      ctaAction: () => navigateToFeature('/journal'),
      visualComponent: (
        <motion.div 
          className="relative flex items-center justify-center p-4 bg-primary/10 rounded-full"
          variants={pulseVariants}
          animate="pulse"
        >
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/5"
            variants={pulseVariants}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 0.1, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <Mic className="h-12 w-12 text-primary" />
        </motion.div>
      )
    },
    {
      title: "AI Analysis",
      description: "Get insights into your emotional patterns and themes through advanced AI analysis of your journal entries.",
      icon: <Brain className="h-10 w-10 text-primary" />,
      animation: waveVariants,
      animationState: "wave",
      cta: "See Insights",
      ctaAction: () => navigateToFeature('/insights'),
      visualComponent: (
        <motion.div 
          className="flex flex-wrap gap-2 justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {['Happiness', 'Growth', 'Stress', 'Family', 'Work', 'Health'].map((theme, index) => (
            <motion.div
              key={theme}
              className="px-3 py-1 bg-primary/20 rounded-full text-sm font-medium text-primary"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                y: [0, index % 2 === 0 ? -5 : 5, 0]
              }}
              transition={{ 
                delay: index * 0.1 + 0.5,
                y: {
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: index * 0.2
                }
              }}
            >
              {theme}
            </motion.div>
          ))}
        </motion.div>
      )
    },
    {
      title: "Track Your Journey",
      description: "Visualize your emotional progress over time with interactive charts and trend analysis.",
      icon: <LineChart className="h-10 w-10 text-primary" />,
      animation: itemVariants,
      cta: "View Progress",
      ctaAction: () => navigateToFeature('/insights'),
      visualComponent: (
        <motion.div 
          className="relative h-32 w-full bg-background/80 rounded-lg overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <svg viewBox="0 0 500 100" className="w-full h-full">
            {[0, 25, 50, 75, 100].map((line) => (
              <motion.line
                key={`grid-${line}`}
                x1="0"
                y1={line}
                x2="500"
                y2={line}
                stroke="hsl(var(--muted))"
                strokeWidth="0.5"
                strokeDasharray="5,5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 0.8, duration: 1 }}
              />
            ))}
            
            <motion.path
              d="M0,80 C50,70 100,60 150,40 C200,20 250,10 300,15 C350,20 400,10 500,5"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 3, delay: 0.5 }}
            />
            
            {[
              { x: 50, y: 70, delay: 1.0 },
              { x: 150, y: 40, delay: 1.5 },
              { x: 300, y: 15, delay: 2.0 },
              { x: 450, y: 5, delay: 2.5 }
            ].map((point, i) => (
              <motion.circle
                key={`point-${i}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill="hsl(var(--primary))"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: point.delay }}
              />
            ))}
            
            <motion.text
              x="450"
              y="20"
              fontSize="12"
              fill="hsl(var(--primary))"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3 }}
            >
              Joy +95%
            </motion.text>
            
            <motion.text
              x="10"
              y="95"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 3.2 }}
            >
              Jan
            </motion.text>
            <motion.text
              x="480"
              y="95"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 3.4 }}
            >
              Now
            </motion.text>
          </svg>
        </motion.div>
      )
    },
    {
      title: "Chat With Your Journal",
      description: "Ask questions and get personalized insights based on your past journal entries with AI-powered chat.",
      icon: <MessageSquare className="h-10 w-10 text-primary" />,
      animation: itemVariants,
      cta: "Start Chatting",
      ctaAction: () => navigateToFeature('/smart-chat'),
      visualComponent: (
        <motion.div 
          className="flex flex-col gap-2 min-h-[120px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <motion.div 
            className="self-start max-w-[80%] bg-muted p-2 rounded-lg text-xs text-left"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {typingText}
            {isTyping && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block"
              >
                |
              </motion.span>
            )}
          </motion.div>
          
          {showResponse && (
            <motion.div 
              className="self-end max-w-[80%] bg-primary text-primary-foreground p-2 rounded-lg text-xs text-left"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.05 }}
              >
                Based on your recent entries, you've been feeling more positive and energetic this week...
              </motion.span>
            </motion.div>
          )}
        </motion.div>
      )
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ParticleBackground />
      <Navbar />
      
      <motion.main
        className={`flex-1 container mx-auto px-4 py-8 pt-24 relative z-10 ${shouldRenderMobile ? 'max-w-md' : ''} ${shouldRenderMobile ? 'pb-16' : ''}`}
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div
          className="text-center mb-12"
          variants={itemVariants}
        >
          <h1 className={`${shouldRenderMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-4 flex items-center justify-center`}>
            Welcome to <SouloLogo size={shouldRenderMobile ? "large" : "large"} className="ml-2" useColorTheme={true} />
          </h1>
          <p className={`${shouldRenderMobile ? 'text-lg' : 'text-xl'} max-w-2xl mx-auto text-primary animate-pulse`}>
            Your personal AI companion for emotional wellness and self-reflection using VOICE journaling
          </p>
          
          {!user && (
            <motion.div 
              className="mt-8"
              variants={itemVariants}
            >
              <Button 
                size={shouldRenderMobile ? "default" : "lg"} 
                onClick={() => navigate('/auth')}
                className="animate-pulse"
              >
                Get Started
              </Button>
            </motion.div>
          )}
        </motion.div>
        
        <motion.div 
          className={`grid ${shouldRenderMobile ? 'grid-cols-1 gap-4' : 'grid-cols-1 md:grid-cols-2 gap-6'} max-w-4xl mx-auto`}
          variants={containerVariants}
        >
          {features.map((feature, index) => (
            <motion.div key={feature.title} variants={itemVariants}>
              <Card className="h-full border-primary/20 overflow-hidden dark:bg-card/75 bg-card/60">
                <CardHeader className="pb-0 pt-4 flex flex-row items-center justify-center gap-2">
                  <motion.div 
                    variants={iconVariants}
                    initial="initial"
                    animate="animate"
                  >
                    {feature.icon}
                  </motion.div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardDescription className="text-center px-4 mt-2">{feature.description}</CardDescription>
                <CardContent className="flex justify-center py-3">
                  {feature.visualComponent}
                </CardContent>
                <CardFooter className="pt-0">
                  <Button 
                    className="w-full" 
                    onClick={feature.ctaAction}
                    disabled={false}
                  >
                    {feature.cta}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </motion.main>
    </div>
  );
};

export default Index;
