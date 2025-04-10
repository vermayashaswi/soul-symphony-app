import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useNavigate } from 'react-router-dom';
import LanguageSelectionStep from './LanguageSelectionStep';
import { useLanguage } from '@/contexts/LanguageContext';

interface OnboardingStepProps {
  onContinue: () => void;
}

const WelcomeStep: React.FC<OnboardingStepProps> = ({ onContinue }) => {
  const { translate } = useLanguage();
  
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-party-popper text-primary"
        >
          <path d="M3 5h18"></path>
          <path d="M18 10a4 4 0 0 0-8 0"></path>
          <path d="M6 10a4 4 0 0 1 8 0"></path>
          <path d="M12 22v-4"></path>
          <path d="M5 18h14"></path>
          <path d="M4 14h3"></path>
          <path d="M17 14h3"></path>
        </svg>
      </motion.div>
      
      <motion.h1 variants={itemVariants} className="text-2xl font-bold mb-3 text-center">
        {translate('onboarding.welcomeTitle', 'Welcome to SOuLO!')}
      </motion.h1>
      
      <motion.p variants={itemVariants} className="text-muted-foreground mb-8 text-center max-w-md">
        {translate('onboarding.welcomeSubtitle', 'Let\'s set up your account and personalize your experience.')}
      </motion.p>
      
      <motion.div variants={itemVariants}>
        <Button onClick={onContinue} size="lg" className="w-full min-w-[200px]">
          {translate('onboarding.continueButton', 'Continue')}
        </Button>
      </motion.div>
    </motion.div>
  );
};

interface NameSelectionStepProps {
  onContinue: (name: string) => void;
}

const NameSelectionStep: React.FC<NameSelectionStepProps> = ({ onContinue }) => {
  const [name, setName] = useState('');
  const { translate } = useLanguage();

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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-user-circle-2 text-primary"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <path d="M16.24 7.76A6 6 0 0 0 6.12 6.12" />
          <path d="M7.76 16.24A6 6 0 0 0 17.88 17.88" />
        </svg>
      </motion.div>
      
      <motion.h1 variants={itemVariants} className="text-2xl font-bold mb-3 text-center">
        {translate('onboarding.nameTitle', 'What should we call you?')}
      </motion.h1>
      
      <motion.p variants={itemVariants} className="text-muted-foreground mb-8 text-center max-w-md">
        {translate('onboarding.nameSubtitle', 'Enter a display name that will be used in your journal.')}
      </motion.p>
      
      <motion.div variants={itemVariants} className="w-full max-w-md mb-8">
        <input
          type="text"
          placeholder={translate('onboarding.namePlaceholder', 'Your Display Name')}
          className="w-full px-4 py-2 rounded-md border border-gray-200 focus:outline-none focus:border-primary"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <Button onClick={() => onContinue(name)} size="lg" className="w-full min-w-[200px]" disabled={!name}>
          {translate('onboarding.continueButton', 'Continue')}
        </Button>
      </motion.div>
    </motion.div>
  );
};

interface FinalStepProps {
  name: string;
}

const FinalStep: React.FC<FinalStepProps> = ({ name }) => {
  const { translate } = useLanguage();
  
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-check-circle-2 text-primary"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </motion.div>
      
      <motion.h1 variants={itemVariants} className="text-2xl font-bold mb-3 text-center">
        {translate('onboarding.finalTitle', 'All set, {name}!', { name })}
      </motion.h1>
      
      <motion.p variants={itemVariants} className="text-muted-foreground mb-8 text-center max-w-md">
        {translate('onboarding.finalSubtitle', 'You\'re ready to start your journaling journey with SOuLO.')}
      </motion.p>
    </motion.div>
  );
};

const OnboardingScreen: React.FC = () => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { completeOnboarding, saveNameToProfile } = useOnboarding();
  const { translate } = useLanguage();
  
  const handleContinue = async () => {
    if (step === 0) {
      // Language selection step
      setStep(1);
    } else if (step === 1) {
      // Welcome step
      setStep(2);
    } else if (step === 2) {
      // Name selection step
      setStep(3);
    } else if (step === 3) {
      // Final step
      try {
        // Save the name to local storage
        localStorage.setItem('user_display_name', name);
        
        // If we have a user, save their name to their profile
        if (user) {
          await saveNameToProfile(user.id, name);
        }
        
        // Mark onboarding as complete
        completeOnboarding();
        
        // Navigate to home
        navigate('/home');
      } catch (error) {
        console.error('Error completing onboarding:', error);
      }
    }
  };
  
  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <LanguageSelectionStep onContinue={handleContinue} />;
      case 1:
        return <WelcomeStep onContinue={handleContinue} />;
      case 2:
        return <NameSelectionStep onContinue={(name) => {
          setName(name);
          handleContinue();
        }} />;
      case 3:
        return <FinalStep name={name} />;
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {step > 0 && (
        <div className="p-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center">
        {renderStep()}
      </div>
      
      <div className="p-4 flex justify-center">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i}
              className={`w-2 h-2 rounded-full ${i === step ? 'bg-primary' : 'bg-gray-300'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
