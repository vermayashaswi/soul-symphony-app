
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
      className="text-center mb-4" 
      variants={itemVariants}
    >
      <div className="flex flex-col items-center justify-center">
        <h1 className={`${shouldRenderMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-3 flex items-center justify-center`}>
          <span className="text-foreground dark:text-white">
            Welcome to
          </span> 
          <SouloLogo size={shouldRenderMobile ? "large" : "large"} className="ml-2" useColorTheme={true} animate={true} />
        </h1>
        
        <div className="w-full max-w-md mx-auto my-8">
          <img 
            src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHkzb2ptOGU3MWYxYXNoZmFsZ3YwZngybHpkZTNuNnl3ZXVyb2lqZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7ZeqYkLtTSQHoXAs/giphy.gif" 
            alt="Spiritual robot with glowing brain and soul" 
            className="w-full h-auto rounded-lg shadow-lg mx-auto"
          />
        </div>
        
        <p className={`${shouldRenderMobile ? 'text-lg' : 'text-xl'} max-w-2xl mx-auto text-primary animate-pulse mt-4 mb-8`}>
          Express. Reflect. <span className="font-bold">Grow.</span>
        </p>
      </div>
      
      {!user && (
        <motion.div 
          className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
          variants={itemVariants}
        >
          <Button 
            size={shouldRenderMobile ? "default" : "lg"} 
            onClick={() => navigate('/auth')}
            className="animate-pulse"
          >
            Get Started
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default HeroSection;
