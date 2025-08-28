
import React, { Suspense, lazy } from 'react';
import { Apple, Play, Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SouloLogo from '@/components/SouloLogo';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { PhoneVoiceAnimation } from '@/components/website/PhoneVoiceAnimation';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { AspectRatio } from '@/components/ui/aspect-ratio';

// Lazy load the 3D background to improve initial load performance
const ThreeDBackground = lazy(() => import('@/components/website/3DBackground'));

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
    <div
      className={`
        relative w-full bg-gradient-to-br from-blue-50 to-purple-50 
        pt-32 pb-2 md:pt-4 md:pb-1 
        overflow-hidden min-h-[75vh] md:min-h-[78vh] lg:min-h-[82vh] flex items-center
      `}
    >
      {/* Background image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('/lovable-uploads/32abc730-009c-4901-912c-a16e7c2c1ec6.png')" }}
      ></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/2 text-center lg:text-left"
          >
            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-2 md:mb-3 text-primary leading-tight relative">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
                <motion.img
                  src="https://soulo.online/lovable-uploads/soulo-icon.png?v=3"
                  alt="Soulo Icon"
                  className="w-40 h-40 md:w-50 md:h-50 lg:w-60 lg:h-60 object-contain drop-shadow-lg"
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </div>
              <span className="block">
                <TranslatableText text="Express. Reflect. Grow." />
              </span>
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-gray-700 mb-3 md:mb-4 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              <span className="text-gray-700">Designed to help you understand yourself, improve your mindset, and grow with every word you share. Because your voice deserves to be heard - </span>
              <span className="text-primary font-bold">by YOU</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2 justify-center lg:justify-start mb-2 md:mb-3">
              <Button 
                size="lg" 
                className="gap-2 bg-black text-white hover:bg-gray-800 text-sm md:text-base" 
                onClick={openAppStore}
              >
                <Apple className="h-4 w-4 md:h-5 md:w-5" />
                <TranslatableText text="App Store" />
              </Button>
              <Button 
                size="lg" 
                className="gap-2 bg-primary hover:bg-primary/90 text-sm md:text-base" 
                onClick={openPlayStore}
              >
                <Play className="h-4 w-4 md:h-5 md:w-5" />
                <TranslatableText text="Google Play" />
              </Button>
            </div>
            
            <div className="flex items-center justify-center lg:justify-start gap-4 md:gap-6 text-xs md:text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                <TranslatableText text="Privacy-Focused" />
              </div>
              <div className="flex items-center gap-1">
                <Check className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                <TranslatableText text="14-Day Free Trial" />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="w-full lg:w-1/2 flex items-center justify-center mt-1 lg:mt-0"
          >
            <div className="w-full max-w-[260px] md:max-w-[300px] lg:max-w-sm">
              <AspectRatio ratio={9/16} className="w-full">
                <PhoneVoiceAnimation />
              </AspectRatio>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
