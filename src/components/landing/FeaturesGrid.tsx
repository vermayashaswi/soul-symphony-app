
import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Brain, LineChart, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import FeatureCard from './FeatureCard';

const FeaturesGrid: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

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

  const features = [
    {
      title: "Record Your Thoughts",
      description: "Capture your daily reflections with voice recordings that are automatically transcribed and analyzed.",
      icon: Mic,
      cta: "Start Journaling",
      ctaAction: () => navigateToFeature('/journal'),
      visualType: 'voice' as const
    },
    {
      title: "AI Analysis",
      description: "Get insights into your emotional patterns and themes through advanced AI analysis of your journal entries.",
      icon: Brain,
      cta: "See Insights",
      ctaAction: () => navigateToFeature('/insights'),
      visualType: 'ai' as const
    },
    {
      title: "Track Your Journey",
      description: "Visualize your emotional progress over time with interactive charts and trend analysis.",
      icon: LineChart,
      cta: "View Progress",
      ctaAction: () => navigateToFeature('/insights'),
      visualType: 'chart' as const
    },
    {
      title: "Chat With Your Journal",
      description: "Ask questions and get personalized insights based on your past journal entries with AI-powered chat.",
      icon: MessageSquare,
      cta: "Start Chatting",
      ctaAction: () => navigateToFeature('/smart-chat'),
      visualType: 'chat' as const
    }
  ];

  return (
    <motion.div 
      className={`grid ${shouldRenderMobile ? 'grid-cols-1 gap-4 mb-16' : 'grid-cols-1 md:grid-cols-2 gap-6'} max-w-4xl mx-auto`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {features.map((feature) => (
        <motion.div key={feature.title} variants={itemVariants}>
          <FeatureCard 
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
            cta={feature.cta}
            ctaAction={feature.ctaAction}
            visualType={feature.visualType}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default FeaturesGrid;
