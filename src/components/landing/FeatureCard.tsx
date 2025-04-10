
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
  const iconVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        duration: 0.5,
        yoyo: Infinity,
        repeatDelay: 2
      }
    }
  };

  return (
    <Card className="h-full border-primary/20 overflow-hidden dark:bg-card/75 bg-card/60">
      <CardHeader className="pb-0 pt-4 flex flex-row items-center justify-center gap-2">
        <motion.div 
          variants={iconVariants}
          initial="initial"
          animate="animate"
        >
          <Icon className="h-10 w-10 text-primary" />
        </motion.div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardDescription className="text-center px-4 mt-2">{description}</CardDescription>
      <CardContent className="flex justify-center py-3">
        <FeatureVisual type={visualType} />
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          className="w-full" 
          onClick={ctaAction}
        >
          {cta}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default FeatureCard;
