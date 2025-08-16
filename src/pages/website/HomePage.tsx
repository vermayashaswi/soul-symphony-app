
import React, { useEffect } from 'react';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import HeroSection from '@/components/website/sections/HeroSection';
import FeaturesSection from '@/components/website/sections/FeaturesSection';
import HowItWorksSection from '@/components/website/sections/HowItWorksSection';
import PricingSection from '@/components/website/sections/PricingSection';
import TestimonialsSection from '@/components/website/sections/TestimonialsSection';
import CTASection from '@/components/website/sections/CTASection';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';
import { NoTranslationWrapper } from '@/contexts/NoTranslationContext';

const HomePage = () => {
  // Force enable scrolling for website pages
  React.useEffect(() => {
    console.log('HomePage: Forcing scroll enabling for website');
    forceEnableScrolling();
    
    // Explicitly ensure scrolling is enabled for website
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.top = '';
    document.body.style.left = '';
  }, []);

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

  // Log the route to help with debugging
  console.log('HomePage: Rendering the website home page at route "/"');

  return (
    <NoTranslationWrapper>
      <div className="min-h-screen bg-white overflow-x-hidden">
        <Navbar />
        
        {/* Hero Section */}
        <HeroSection 
          openAppStore={openAppStore}
          openPlayStore={openPlayStore}
        />
        
        {/* Features Section */}
        <section id="features">
          <FeaturesSection />
        </section>
        
        {/* How It Works Section */}
        <section id="how-it-works">
          <HowItWorksSection />
        </section>
        
        {/* Pricing Section */}
        <section id="pricing">
          <PricingSection 
            openAppStore={openAppStore}
            openPlayStore={openPlayStore}
          />
        </section>
        
        {/* Testimonials Section */}
        <TestimonialsSection />
        
        {/* Call to Action Section */}
        <section id="download">
          <CTASection 
            openAppStore={openAppStore}
            openPlayStore={openPlayStore}
          />
        </section>
        
        <Footer />
      </div>
    </NoTranslationWrapper>
  );
};

export default HomePage;
