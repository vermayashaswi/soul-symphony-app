
import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FeatureVisual from './FeatureVisual';

type VisualType = 'voice' | 'ai' | 'chart' | 'chat';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  cta: string;
  ctaAction: () => void;
  visualType: VisualType;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon: Icon,
  cta,
  ctaAction,
  visualType
}) => {
  return (
    <motion.div 
      className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden h-full flex flex-col"
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      data-i18n-component="feature-card"
      data-feature-type={visualType}
    >
      <div className="flex items-start mb-4">
        <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mr-4">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-xl font-bold" data-i18n-key={`features.${visualType}Title`}>{title}</h3>
      </div>
      
      <p className="text-muted-foreground mb-6" data-i18n-key={`features.${visualType}Desc`}>{description}</p>
      
      <div className="mt-auto flex flex-col space-y-4">
        <FeatureVisual type={visualType} />
        
        <Button 
          onClick={ctaAction} 
          className="w-full mt-4"
          data-i18n-key={`features.${visualType}CTA`}
        >
          {cta}
        </Button>
      </div>
    </motion.div>
  );
};

export default FeatureCard;
