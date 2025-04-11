
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import SouloLogo from '@/components/SouloLogo';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface HeroSectionProps {
  user: any;
}

const PulsatingEnergy = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Glowing center */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-16 h-16 rounded-full bg-primary/40 blur-xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 blur-md"></div>
      </div>
      
      {/* Radiating pulses */}
      {[...Array(6)].map((_, index) => (
        <motion.div
          key={index}
          className="absolute top-1/2 left-1/2 rounded-full"
          initial={{ 
            width: 20, 
            height: 20, 
            x: -10, 
            y: -10, 
            opacity: 0.6, 
            background: "radial-gradient(circle, rgba(var(--primary),0.3) 0%, rgba(var(--primary),0.2) 50%, rgba(var(--primary),0.1) 100%)" 
          }}
          animate={{ 
            width: 300, 
            height: 300, 
            x: -150, 
            y: -150, 
            opacity: 0,
            background: "radial-gradient(circle, rgba(var(--primary),0.15) 0%, rgba(var(--primary),0.1) 50%, rgba(var(--primary),0.05) 100%)" 
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 3 + index * 0.4, 
            ease: "easeOut",
            delay: index * 0.5
          }}
        />
      ))}
      
      {/* Additional smaller pulses */}
      {[...Array(8)].map((_, index) => (
        <motion.div
          key={`small-${index}`}
          className="absolute top-1/2 left-1/2 rounded-full"
          initial={{ 
            width: 10, 
            height: 10, 
            x: -5, 
            y: -5, 
            opacity: 0.7, 
            background: "radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(var(--primary),0.3) 50%, rgba(var(--primary),0.1) 100%)" 
          }}
          animate={{ 
            width: 200, 
            height: 200, 
            x: -100, 
            y: -100, 
            opacity: 0
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 2 + index * 0.3, 
            ease: "easeOut",
            delay: index * 0.3
          }}
        />
      ))}
    </div>
  );
};

const HeroSection: React.FC<HeroSectionProps> = ({ user }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile || mobileDemo;

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
      <PulsatingEnergy />
      
      <div className="relative z-10">
        <h1 className={`${shouldRenderMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-3 flex items-center justify-center`}>
          <span className="text-foreground dark:text-white">
            Welcome to
          </span> 
          <SouloLogo size={shouldRenderMobile ? "large" : "large"} className="ml-2" useColorTheme={true} animate={true} />
        </h1>
        <p className={`${shouldRenderMobile ? 'text-lg' : 'text-xl'} max-w-2xl mx-auto text-primary animate-pulse mt-4 mb-8`}>
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
              className="animate-pulse relative z-10"
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
