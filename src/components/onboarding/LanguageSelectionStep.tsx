
import React from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage, SUPPORTED_LANGUAGES, LanguageCode } from '@/contexts/LanguageContext';

interface LanguageSelectionStepProps {
  onContinue: () => void;
}

const LanguageSelectionStep: React.FC<LanguageSelectionStepProps> = ({ onContinue }) => {
  const { language, setLanguage } = useLanguage();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full px-6 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="mb-8">
        <Globe className="h-16 w-16 text-primary" />
      </motion.div>
      
      <motion.h1 variants={itemVariants} className="text-2xl font-bold mb-3 text-center">
        Choose Your Language
      </motion.h1>
      
      <motion.p variants={itemVariants} className="text-muted-foreground mb-8 text-center max-w-md">
        Select your preferred language for the SOuLO experience
      </motion.p>
      
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 w-full max-w-md mb-8">
        {Object.entries(SUPPORTED_LANGUAGES).map(([code, { name }]) => (
          <Button
            key={code}
            variant={language === code ? "default" : "outline"}
            className={`flex items-center justify-center h-12 ${language === code ? "bg-primary text-primary-foreground" : "border-gray-200"}`}
            onClick={() => setLanguage(code as LanguageCode)}
          >
            {name}
          </Button>
        ))}
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <Button onClick={onContinue} size="lg" className="w-full min-w-[200px]">
          Continue
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default LanguageSelectionStep;
