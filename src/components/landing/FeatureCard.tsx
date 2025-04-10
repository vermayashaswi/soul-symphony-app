
import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FeatureVisual from './FeatureVisual';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  cta: string;
  ctaAction: () => void;
  visualType: 'voice' | 'ai' | 'chart' | 'chat';
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon: Icon,
  cta,
  ctaAction,
  visualType
}) => {
  const cardVariants = {
    initial: { 
      y: 20, 
      opacity: 0 
    },
    hover: { 
      y: -5,
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      transition: { 
        y: { type: "spring", stiffness: 300, damping: 15 },
        boxShadow: { duration: 0.2 }
      }
    },
    animate: { 
      y: 0, 
      opacity: 1,
      transition: { 
        duration: 0.5
      }
    }
  };

  const iconVariants = {
    initial: { 
      scale: 0.8, 
      opacity: 0 
    },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        duration: 0.5,
        delay: 0.2
      }
    },
    hover: {
      scale: 1.1,
      rotate: [0, 5, 0, -5, 0],
      transition: { 
        duration: 0.5,
        repeat: 0
      }
    }
  };

  const buttonVariants = {
    initial: { scale: 1 },
    hover: { 
      scale: 1.05,
      transition: { 
        duration: 0.2
      }
    }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      whileHover="hover"
      variants={cardVariants}
      className="h-full"
    >
      <Card className="h-full border-primary/20 overflow-hidden dark:bg-card/75 bg-card/60 backdrop-blur-sm hover:border-primary/40 transition-colors">
        <CardHeader className="pb-0 pt-4">
          <div className="flex flex-row items-center gap-3 mb-2">
            <motion.div 
              variants={iconVariants}
              className="bg-primary/10 rounded-full p-2 flex-shrink-0"
            >
              <Icon className="h-6 w-6 text-primary" />
            </motion.div>
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-3 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/30 rounded-md z-0"></div>
          <div className="relative z-10 w-full">
            <FeatureVisual type={visualType} />
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <motion.div
            className="w-full"
            variants={buttonVariants}
          >
            <Button 
              className="w-full" 
              onClick={ctaAction}
            >
              {cta}
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default FeatureCard;
