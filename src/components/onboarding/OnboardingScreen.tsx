
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { staticTranslationService } from '@/services/staticTranslationService';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { preloadWebsiteTranslations } from '@/utils/website-translations';
import LanguageSelector from '@/components/LanguageSelector';
import EmotionBubblesDemo from '@/components/website/EmotionBubblesDemo';
import SentimentChartDemo from '@/components/website/SentimentChartDemo';

// Define the onboarding steps
const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to SOuLO',
    description: 'Your journey to self-awareness begins here'
  },
  {
    id: 'privacy',
    title: 'Your Data is Private',
    description: 'We prioritize your privacy and security'
  },
  {
    id: 'voice-journaling',
    title: 'Voice Journaling',
    description: 'Speak your thoughts and feelings freely'
  },
  {
    id: 'ai-analysis',
    title: 'AI Analysis',
    description: 'Discover patterns in your emotional journey'
  },
  {
    id: 'chat',
    title: 'Chat with Your Journal',
    description: 'Have meaningful conversations with your past insights'
  },
  {
    id: 'track-journey',
    title: 'Track Your Emotional Journey',
    description: 'Visualize your growth over time'
  },
  {
    id: 'name',
    title: 'What Should We Call You?',
    description: 'Personalize your experience'
  },
  {
    id: 'language',
    title: 'Preferred Language',
    description: 'Select your language for a personalized experience'
  },
  {
    id: 'ready',
    title: 'Ready to Start Your Journey?',
    description: 'Begin your path to self-discovery'
  }
];

export const OnboardingScreen: React.FC = () => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const { currentLanguage, setLanguage, isTranslating } = useTranslation();
  const [hasPreloadedTranslations, setHasPreloadedTranslations] = useState(false);

  // Preload translations when language changes
  useEffect(() => {
    if (currentLanguage !== 'en' && !hasPreloadedTranslations) {
      const preloadTranslations = async () => {
        console.log(`Preloading onboarding translations for ${currentLanguage}`);
        await preloadWebsiteTranslations(currentLanguage);
        setHasPreloadedTranslations(true);
      };
      
      preloadTranslations();
    }
  }, [currentLanguage, hasPreloadedTranslations]);

  const handleLanguageSelect = async (languageCode: string) => {
    console.log(`Language selected in onboarding: ${languageCode}`);
    
    // First set the language to update the UI
    await setLanguage(languageCode);
    
    // Store in localStorage
    localStorage.setItem('preferred_language', languageCode);
    
    // Preload translations for smoother experience
    if (languageCode !== 'en') {
      await preloadWebsiteTranslations(languageCode);
      setHasPreloadedTranslations(true);
    }
    
    // Move to next step
    goToNextStep();
  };

  const saveName = () => {
    if (name.trim()) {
      localStorage.setItem('user_display_name', name.trim());
    }
    goToNextStep();
  };

  const completeOnboarding = () => {
    localStorage.setItem('onboardingComplete', 'true');
    navigate('/app/home');
  };

  const goToNextStep = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const goToPrevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  const renderStepContent = () => {
    const currentStep = ONBOARDING_STEPS[step];
    
    switch (currentStep.id) {
      case 'welcome':
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold mb-4">
              <TranslatableText text={currentStep.title} forceTranslate={true} />
            </h2>
            <p className="mb-8">
              <TranslatableText text={currentStep.description} forceTranslate={true} />
            </p>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="rounded-full w-32 h-32 bg-primary/20 mx-auto mb-8 flex items-center justify-center"
            >
              <div className="text-5xl">🌱</div>
            </motion.div>
          </div>
        );
        
      case 'privacy':
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold mb-4">
              <TranslatableText text={currentStep.title} forceTranslate={true} />
            </h2>
            <p className="mb-8">
              <TranslatableText text={currentStep.description} forceTranslate={true} />
            </p>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="rounded-full w-32 h-32 bg-primary/20 mx-auto mb-8 flex items-center justify-center"
            >
              <div className="text-5xl">🔒</div>
            </motion.div>
            <p className="text-sm text-muted-foreground">
              <TranslatableText 
                text="Your data is encrypted and never shared with third parties. You control what's in your journal." 
                forceTranslate={true}
              />
            </p>
          </div>
        );
        
      case 'voice-journaling':
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold mb-4">
              <TranslatableText text={currentStep.title} forceTranslate={true} />
            </h2>
            <p className="mb-8">
              <TranslatableText text={currentStep.description} forceTranslate={true} />
            </p>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="max-w-sm mx-auto mb-8 p-4 bg-card rounded-lg shadow-lg"
            >
              <div className="w-full h-16 bg-primary/10 rounded-full mb-4 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-2xl">🎤</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                <TranslatableText 
                  text="Record voice entries anytime, anywhere. Speak naturally in your preferred language." 
                  forceTranslate={true}
                />
              </p>
            </motion.div>
          </div>
        );
        
      case 'ai-analysis':
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold mb-4">
              <TranslatableText text={currentStep.title} forceTranslate={true} />
            </h2>
            <p className="mb-6">
              <TranslatableText text={currentStep.description} forceTranslate={true} />
            </p>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="relative max-w-sm mx-auto mb-8"
            >
              <div className="w-24 h-24 bg-primary/10 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-3xl">🧠</span>
              </div>
              
              <EmotionBubblesDemo />
              
              <p className="text-sm text-muted-foreground mt-4">
                <TranslatableText 
                  text="AI identifies emotions, themes, and patterns in your journal entries, helping you gain deeper insights." 
                  forceTranslate={true}
                />
              </p>
            </motion.div>
          </div>
        );
        
      case 'chat':
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold mb-4">
              <TranslatableText text={currentStep.title} forceTranslate={true} />
            </h2>
            <p className="mb-6">
              <TranslatableText text={currentStep.description} forceTranslate={true} />
            </p>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="max-w-sm mx-auto mb-6 bg-card rounded-lg shadow-lg overflow-hidden"
            >
              <div className="p-3 bg-primary/10 text-center">
                <TranslatableText text="SOuLO Chat" forceTranslate={true} />
              </div>
              <div className="p-4 space-y-4">
                <div className="flex justify-start">
                  <div className="bg-muted p-3 rounded-lg max-w-[85%]">
                    <TranslatableText 
                      text="How have I been feeling lately?" 
                      forceTranslate={true}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-primary/20 p-3 rounded-lg max-w-[85%]">
                    <TranslatableText 
                      text="Based on your recent entries, you've been feeling more positive and energetic this week..." 
                      forceTranslate={true}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
            <p className="text-sm text-muted-foreground">
              <TranslatableText 
                text="Ask questions about your journal entries and get personalized insights based on your own experiences." 
                forceTranslate={true}
              />
            </p>
          </div>
        );
        
      case 'track-journey':
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold mb-4">
              <TranslatableText text={currentStep.title} forceTranslate={true} />
            </h2>
            <p className="mb-6">
              <TranslatableText text={currentStep.description} forceTranslate={true} />
            </p>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="max-w-sm mx-auto mb-6 bg-card rounded-lg shadow-lg p-4"
            >
              <div className="text-sm font-medium mb-2 text-left">
                <TranslatableText text="Mood Trends" forceTranslate={true} />
              </div>
              
              <SentimentChartDemo />
              
            </motion.div>
            <p className="text-sm text-muted-foreground">
              <TranslatableText 
                text="Visualize how your emotions and energy levels change over time to identify patterns and growth." 
                forceTranslate={true}
              />
            </p>
          </div>
        );
        
      case 'name':
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold mb-4">
              <TranslatableText text={currentStep.title} forceTranslate={true} />
            </h2>
            <p className="mb-8">
              <TranslatableText text={currentStep.description} forceTranslate={true} />
            </p>
            <div className="max-w-sm mx-auto">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 border rounded-md mb-2"
                placeholder={staticTranslationService.translateText("Enter your name")}
              />
              <p className="text-sm text-muted-foreground mb-8">
                <TranslatableText 
                  text="This is how SOuLO will address you" 
                  forceTranslate={true}
                />
              </p>
            </div>
          </div>
        );
        
      case 'language':
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold mb-4">
              <TranslatableText text={currentStep.title} forceTranslate={true} />
            </h2>
            <p className="mb-8">
              <TranslatableText text={currentStep.description} forceTranslate={true} />
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <Button 
                variant="outline" 
                className={`p-4 h-auto ${currentLanguage === 'en' ? 'bg-primary/10 border-primary' : ''}`}
                onClick={() => handleLanguageSelect('en')}
                disabled={isTranslating}
              >
                <div className="text-center">
                  <div className="font-medium">English</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className={`p-4 h-auto ${currentLanguage === 'es' ? 'bg-primary/10 border-primary' : ''}`}
                onClick={() => handleLanguageSelect('es')}
                disabled={isTranslating}
              >
                <div className="text-center">
                  <div className="font-medium">Español</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className={`p-4 h-auto ${currentLanguage === 'fr' ? 'bg-primary/10 border-primary' : ''}`}
                onClick={() => handleLanguageSelect('fr')}
                disabled={isTranslating}
              >
                <div className="text-center">
                  <div className="font-medium">Français</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className={`p-4 h-auto ${currentLanguage === 'de' ? 'bg-primary/10 border-primary' : ''}`}
                onClick={() => handleLanguageSelect('de')}
                disabled={isTranslating}
              >
                <div className="text-center">
                  <div className="font-medium">Deutsch</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className={`p-4 h-auto ${currentLanguage === 'zh' ? 'bg-primary/10 border-primary' : ''}`}
                onClick={() => handleLanguageSelect('zh')}
                disabled={isTranslating}
              >
                <div className="text-center">
                  <div className="font-medium">中文</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className={`p-4 h-auto ${currentLanguage === 'hi' ? 'bg-primary/10 border-primary' : ''}`}
                onClick={() => handleLanguageSelect('hi')}
                disabled={isTranslating}
              >
                <div className="text-center">
                  <div className="font-medium">हिन्दी</div>
                </div>
              </Button>
            </div>
          </div>
        );
        
      case 'ready':
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold mb-4">
              <TranslatableText text={currentStep.title} forceTranslate={true} />
            </h2>
            <p className="mb-8">
              <TranslatableText text={currentStep.description} forceTranslate={true} />
            </p>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="rounded-full w-32 h-32 bg-primary/20 mx-auto mb-8 flex items-center justify-center"
            >
              <div className="text-5xl">✨</div>
            </motion.div>
            <p className="text-sm text-muted-foreground mb-4">
              <TranslatableText 
                text="Your journey to self-discovery and mindfulness begins now." 
                forceTranslate={true}
              />
            </p>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Language selector in top right corner */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-lg shadow-lg overflow-hidden">
          {/* Step content */}
          <div className="min-h-[400px] flex flex-col justify-between">
            <div className="flex-1">
              {renderStepContent()}
            </div>
            
            {/* Navigation buttons */}
            <div className="p-4 border-t flex justify-between">
              {step === 0 ? (
                <Button variant="ghost" onClick={skipOnboarding}>
                  <TranslatableText text="Skip" forceTranslate={true} />
                </Button>
              ) : (
                <Button variant="ghost" onClick={goToPrevStep}>
                  <TranslatableText text="Back" forceTranslate={true} />
                </Button>
              )}
              
              {step === ONBOARDING_STEPS.length - 1 ? (
                <Button onClick={completeOnboarding}>
                  <TranslatableText text="Get Started" forceTranslate={true} />
                </Button>
              ) : step === 6 ? ( // Name input step
                <Button onClick={saveName} disabled={!name.trim()}>
                  <TranslatableText text="Continue" forceTranslate={true} />
                </Button>
              ) : step === 7 ? ( // Language selection step
                <Button variant="ghost" className="opacity-0">
                  <TranslatableText text="Next" forceTranslate={true} />
                </Button>
              ) : (
                <Button onClick={goToNextStep}>
                  <TranslatableText text="Next" forceTranslate={true} />
                </Button>
              )}
            </div>
            
            {/* Progress indicator */}
            <div className="bg-muted h-1 w-full">
              <div 
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${(step / (ONBOARDING_STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
