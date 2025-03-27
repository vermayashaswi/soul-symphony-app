
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Mic, Brain, LineChart, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const features = [
    {
      title: "Record Your Thoughts",
      description: "Capture your daily reflections with voice recordings that are automatically transcribed and analyzed.",
      icon: <Mic className="h-10 w-10 text-primary" />,
      animation: pulseVariants,
      animationState: "pulse",
      cta: "Start Journaling",
      ctaAction: () => navigate('/journal'),
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
      ctaAction: () => navigate('/insights'),
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
      ctaAction: () => navigate('/insights'),
      visualComponent: (
        <motion.div 
          className="relative h-32 w-full bg-background/80 rounded-lg overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <svg viewBox="0 0 500 100" className="w-full h-full">
            <motion.path
              d="M0,50 C150,20 200,80 500,40"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2, delay: 0.5 }}
            />
            <motion.path
              d="M0,70 C100,60 300,20 500,60"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeOpacity="0.5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 2, delay: 0.7 }}
            />
            <motion.circle
              cx="450"
              cy="45"
              r="5"
              fill="hsl(var(--primary))"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 2.5 }}
            />
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
      ctaAction: () => navigate('/chat'),
      visualComponent: (
        <motion.div 
          className="flex flex-col gap-2"
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
            How have I been feeling lately?
          </motion.div>
          <motion.div 
            className="self-end max-w-[80%] bg-primary text-primary-foreground p-2 rounded-lg text-xs text-left"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            Based on your recent entries, you've been feeling more positive and energetic this week...
          </motion.div>
        </motion.div>
      )
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* The particle background must be the first element inside the container */}
      <ParticleBackground />
      <Navbar />
      
      <motion.main
        className="flex-1 container mx-auto px-4 py-8 pt-24 relative z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div
          className="text-center mb-12"
          variants={itemVariants}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Welcome to Feelosophy</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your personal AI companion for emotional wellness and self-reflection using VOICE journaling
          </p>
          
          {!user && (
            <motion.div 
              className="mt-8"
              variants={itemVariants}
            >
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="animate-pulse"
              >
                Get Started
              </Button>
            </motion.div>
          )}
        </motion.div>
        
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
          variants={containerVariants}
        >
          {features.map((feature, index) => (
            <motion.div key={feature.title} variants={itemVariants}>
              <Card className="h-full border-primary/20 overflow-hidden">
                <CardHeader>
                  <motion.div 
                    variants={iconVariants}
                    initial="initial"
                    animate="animate"
                    className="mb-2"
                  >
                    {feature.icon}
                  </motion.div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  {feature.visualComponent}
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    onClick={feature.ctaAction}
                    disabled={!user}
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
