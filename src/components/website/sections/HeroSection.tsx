
import React from 'react';
import { Apple, Play, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import SouloLogo from '@/components/SouloLogo';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

interface HeroSectionProps {
  openAppStore: () => void;
  openPlayStore: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ openAppStore, openPlayStore }) => {
  const isMobile = useIsMobile();
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  return (
    <div className="relative w-full bg-gradient-to-br from-blue-50 to-purple-50 pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('/lovable-uploads/32abc730-009c-4901-912c-a16e7c2c1ec6.png')" }}
      ></div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/2 text-center lg:text-left"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-primary">
              <TranslatableText text="Express. Reflect. Grow." />
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto lg:mx-0">
              <TranslatableText text="Journaling should be as simple as talking. Use voice and leave the rest to us." />
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
              <Button 
                size="lg" 
                className="gap-2 bg-black text-white hover:bg-gray-800" 
                onClick={openAppStore}
              >
                <Apple className="h-5 w-5" />
                <TranslatableText text="App Store" />
              </Button>
              <Button 
                size="lg" 
                className="gap-2 bg-primary hover:bg-primary/90" 
                onClick={openPlayStore}
              >
                <Play className="h-5 w-5" />
                <TranslatableText text="Google Play" />
              </Button>
            </div>
            
            <div className="flex items-center justify-center lg:justify-start gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4 text-primary" />
                <TranslatableText text="Privacy-Focused" />
              </div>
              <div className="flex items-center gap-1">
                <Check className="h-4 w-4 text-primary" />
                <TranslatableText text="14-Day Free Trial" />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="w-full lg:w-1/2 flex items-center justify-center"
          >
            <PhoneVoiceAnimation />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
