
import React from 'react';
import { motion } from 'framer-motion';
import { Apple, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/website/Navbar';
import SouloLogo from '@/components/SouloLogo';
import AppFeatureCarousel from '@/components/website/AppFeatureCarousel';
import PrivacySection from '@/pages/landing/components/PrivacySection';
import Footer from '@/components/website/Footer';
import { useIsMobile } from '@/hooks/use-mobile';

const HomePage = () => {
  const isMobile = useIsMobile();

  const openAppStore = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const appStoreUrl = 'https://apps.apple.com/app/soulo';
    
    if (isIOS) {
      // Try to open app store app on iOS
      window.location.href = 'itms-apps://itunes.apple.com/app/soulo';
      
      // Fallback to website after delay
      setTimeout(() => {
        window.location.href = appStoreUrl;
      }, 500);
    } else {
      // Open website on non-iOS devices
      window.open(appStoreUrl, '_blank');
    }
  };

  const openPlayStore = () => {
    const isAndroid = /Android/.test(navigator.userAgent);
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.soulo.app';
    
    if (isAndroid) {
      // Try to open play store app on Android
      window.location.href = 'market://details?id=com.soulo.app';
      
      // Fallback to website after delay
      setTimeout(() => {
        window.location.href = playStoreUrl;
      }, 500);
    } else {
      // Open website on non-Android devices
      window.open(playStoreUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative w-full bg-gradient-to-br from-blue-50 to-purple-50 pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('/lovable-uploads/32abc730-009c-4901-912c-a16e7c2c1ec6.png')" }}
        ></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="max-w-3xl mx-auto"
          >
            <SouloLogo size="large" useColorTheme={true} className="mx-auto mb-4" />
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-primary">
              Express. Reflect. <span className="text-primary">Grow.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto">
              Keep a journal and capture your day without writing down a single word!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="gap-2 bg-black text-white hover:bg-gray-800" 
                onClick={openAppStore}
              >
                <Apple className="h-5 w-5" />
                <span>App Store</span>
              </Button>
              <Button 
                size="lg" 
                className="gap-2 bg-primary hover:bg-primary/90" 
                onClick={openPlayStore}
              >
                <Play className="h-5 w-5" />
                <span>Google Play</span>
              </Button>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.5 }}
            className="mt-12 md:mt-16 max-w-4xl mx-auto"
          >
            <img 
              src="/lovable-uploads/586c1ed2-eaed-4063-a18d-500e7085909d.png" 
              alt="SOULo App Screenshot" 
              className="w-full h-auto rounded-lg shadow-xl"
            />
          </motion.div>
        </div>
      </section>
      
      {/* App Features Carousel */}
      <AppFeatureCarousel />
      
      {/* Privacy Section */}
      <PrivacySection />
      
      {/* Footer with Logo and Download Links */}
      <Footer />
    </div>
  );
};

export default HomePage;
