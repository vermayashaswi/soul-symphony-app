
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Brain, LineChart, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import FeatureCard from './FeatureCard';
import { useTranslation } from 'react-i18next';
import { useDebugLog } from '@/utils/debug/DebugContext';

const FeaturesGrid: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { addEvent } = useDebugLog();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  // Log translation status for debugging
  useEffect(() => {
    addEvent('i18n', 'FeaturesGrid translation check', 'info', {
      feature1: t('features.voiceJournaling'),
      feature1Translated: t('features.voiceJournaling') !== 'features.voiceJournaling',
      feature2: t('features.aiAnalysis'),
      feature2Translated: t('features.aiAnalysis') !== 'features.aiAnalysis',
      feature3: t('features.progressTracking'),
      feature3Translated: t('features.progressTracking') !== 'features.progressTracking',
      feature4: t('features.journalChat'),
      feature4Translated: t('features.journalChat') !== 'features.journalChat',
    });
  }, [t, addEvent]);

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
      title: t('features.voiceJournaling'),
      description: t('features.voiceJournalingDesc'),
      icon: Mic,
      cta: t('features.startJournaling'),
      ctaAction: () => navigateToFeature('/journal'),
      visualType: 'voice' as const
    },
    {
      title: t('features.aiAnalysis'),
      description: t('features.aiAnalysisDesc'),
      icon: Brain,
      cta: t('features.seeInsights'),
      ctaAction: () => navigateToFeature('/insights'),
      visualType: 'ai' as const
    },
    {
      title: t('features.progressTracking'),
      description: t('features.progressTrackingDesc'),
      icon: LineChart,
      cta: t('features.viewProgress'),
      ctaAction: () => navigateToFeature('/insights'),
      visualType: 'chart' as const
    },
    {
      title: t('features.journalChat'),
      description: t('features.journalChatDesc'),
      icon: MessageSquare,
      cta: t('features.startChatting'),
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
      data-i18n-section="features-grid"
    >
      {features.map((feature, index) => (
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
