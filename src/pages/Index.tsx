
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/use-onboarding';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import EnergyAnimation from '@/components/EnergyAnimation';
import HomePage from '@/pages/website/HomePage';
import LandingPage from '@/pages/landing/LandingPage';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { resetOnboarding } = useOnboarding();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;
  const isAppSubdomain = window.location.hostname === 'app.soulo.online';

  // IMPORTANT: If this is the main domain (not app subdomain), render the modern homepage with features
  if (!isAppSubdomain) {
    console.log('Rendering modern marketing homepage on main domain');
    return <HomePage />;
  }

  // Continue with the regular Index rendering for app subdomain
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

  // This is the app interface rendering
  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      {/* Full-width and height animation with bottom navbar offset */}
      <EnergyAnimation fullScreen={true} bottomNavOffset={shouldRenderMobile} />
      
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
        
        {/* Main Tagline */}
        <div className="text-center my-12">
          <h2 className="text-2xl md:text-3xl font-medium">Keep a journal and capture your day without writing down a single word!</h2>
        </div>
        
        <FeaturesGrid />
      </motion.main>
    </div>
  );
};

export default Index;
