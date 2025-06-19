
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import SouloLogo from '@/components/SouloLogo';
import { useIsMobile } from '@/hooks/use-mobile';

interface HeroSectionProps {
  user: any;
}

const HeroSection: React.FC<HeroSectionProps> = ({ user }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
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

  return (
    <motion.div
      className="text-center mb-4 relative" 
      variants={itemVariants}
    >
      <div className="relative z-10">
        <h1 className={`${shouldRenderMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-3 flex items-center justify-center`}>
          <span className="text-purple-600">
            Welcome to
          </span> 
          <SouloLogo size={shouldRenderMobile ? "large" : "large"} className="ml-2" useColorTheme={false} animate={true} />
        </h1>
        <p className={`${shouldRenderMobile ? 'text-lg' : 'text-xl'} max-w-2xl mx-auto text-purple-500 animate-pulse mt-4 mb-8`}>
          Your personal AI companion for emotional wellness and self-reflection using VOICE journaling
        </p>
        
        {!user && (
          <motion.div 
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
            variants={itemVariants}
          >
            <Button 
              size={shouldRenderMobile ? "default" : "lg"} 
              onClick={() => navigate('/auth')}
              className="animate-pulse relative z-10 bg-purple-600 hover:bg-purple-700 text-white"
            >
              Get Started
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default HeroSection;
