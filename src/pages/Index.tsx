
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/use-onboarding';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesGrid from '@/components/landing/FeaturesGrid';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { resetOnboarding } = useOnboarding();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile || mobileDemo;

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

  useEffect(() => {
    if (shouldRenderMobile) {
      const metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    }
  }, [shouldRenderMobile]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ParticleBackground />
      <Navbar />
      
      <motion.main
        className={cn(
          "flex-1 container mx-auto px-4 py-8 relative z-10",
          shouldRenderMobile ? "max-w-md" : "",
          shouldRenderMobile ? "pb-28 pt-24" : "pt-24"
        )}
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <HeroSection user={user} />
        <FeaturesGrid />
      </motion.main>
    </div>
  );
};

export default Index;
