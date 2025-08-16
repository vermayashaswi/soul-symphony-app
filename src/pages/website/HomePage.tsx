
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import HeroSection from '@/components/website/sections/HeroSection';
import FeaturesSection from '@/components/website/sections/FeaturesSection';
import HowItWorksSection from '@/components/website/sections/HowItWorksSection';
import TestimonialsSection from '@/components/website/sections/TestimonialsSection';
import PricingSection from '@/components/website/sections/PricingSection';
import CTASection from '@/components/website/sections/CTASection';

const HomePage = () => {
  const navigate = useNavigate();

  const openAppStore = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const appStoreUrl = 'https://apps.apple.com/app/soulo';
    
    if (isIOS) {
      window.location.href = 'itms-apps://itunes.apple.com/app/soulo';
      setTimeout(() => {
        window.location.href = appStoreUrl;
      }, 500);
    } else {
      window.open(appStoreUrl, '_blank');
    }
  };

  const openPlayStore = () => {
    const isAndroid = /Android/.test(navigator.userAgent);
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.soulo.app';
    
    if (isAndroid) {
      window.location.href = 'market://details?id=com.soulo.app';
      setTimeout(() => {
        window.location.href = playStoreUrl;
      }, 500);
    } else {
      window.open(playStoreUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <HeroSection 
        openAppStore={openAppStore}
        openPlayStore={openPlayStore}
      />
      
      <FeaturesSection />
      
      <HowItWorksSection />
      
      <TestimonialsSection />
      
      <PricingSection 
        openAppStore={openAppStore}
        openPlayStore={openPlayStore}
      />
      
      <CTASection 
        openAppStore={openAppStore}
        openPlayStore={openPlayStore}
      />
      
      <Footer />
    </div>
  );
};

export default HomePage;
