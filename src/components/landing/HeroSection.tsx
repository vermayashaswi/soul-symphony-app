
import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import SouloLogo from '@/components/SouloLogo';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDebugLog } from '@/utils/debug/DebugContext';

interface HeroSectionProps {
  user: any;
}

const HeroSection: React.FC<HeroSectionProps> = ({ user }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { addEvent } = useDebugLog();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  // Log translation status for debugging
  React.useEffect(() => {
    addEvent('i18n', 'HeroSection translation check', 'info', {
      welcomeText: t('hero.welcome'),
      isTranslated: t('hero.welcome') !== 'hero.welcome',
      taglineText: t('hero.tagline'),
      taglineTranslated: t('hero.tagline') !== 'hero.tagline',
      getStartedText: t('hero.getStarted'),
      getStartedTranslated: t('hero.getStarted') !== 'hero.getStarted',
    });
  }, [t, addEvent]);

  return (
    <motion.div
      className="text-center mb-4 relative" 
      variants={itemVariants}
      data-i18n-section="hero"
    >
      <div className="relative z-10">
        <h1 className={`${shouldRenderMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-3 flex items-center justify-center`}>
          <span className="text-foreground dark:text-white" data-i18n-key="hero.welcome">
            {t('hero.welcome')}
          </span> 
          <SouloLogo size={shouldRenderMobile ? "large" : "large"} className="ml-2" useColorTheme={true} animate={true} />
        </h1>
        <p className={`${shouldRenderMobile ? 'text-lg' : 'text-xl'} max-w-2xl mx-auto text-primary animate-pulse mt-4 mb-8`} data-i18n-key="hero.tagline">
          {t('hero.tagline')}
        </p>
        
        {!user && (
          <motion.div 
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
            variants={itemVariants}
          >
            <Button 
              size={shouldRenderMobile ? "default" : "lg"} 
              onClick={() => navigate('/auth')}
              className="animate-pulse relative z-10"
              data-i18n-key="hero.getStarted"
            >
              {t('hero.getStarted')}
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default HeroSection;
