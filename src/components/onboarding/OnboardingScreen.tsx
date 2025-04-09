import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Mic, MessageSquare, Brain, LineChart, Heart } from "lucide-react";
import SouloLogo from "@/components/SouloLogo";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

interface OnboardingScreenProps {
  onComplete?: () => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { setColorTheme } = useTheme();
  
  useEffect(() => {
    setColorTheme('Calm');
  }, [setColorTheme]);
  
  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      localStorage.setItem("onboardingComplete", "true");
      
      if (onComplete) {
        onComplete();
      } else {
        navigate("/auth");
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("onboardingComplete", "true");
    if (onComplete) {
      onComplete();
    } else {
      navigate("/auth");
    }
  };

  // Create waveform animation for the logo
  const WaveformAnimation = () => {
    return (
      <div className="absolute left-0 right-0 flex justify-center items-center h-8 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="w-1 mx-0.5 rounded-full bg-theme-color/60"
            animate={{
              height: [
                `${Math.random() * 8 + 4}px`,
                `${Math.random() * 20 + 10}px`,
                `${Math.random() * 8 + 4}px`
              ]
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              repeatType: "reverse",
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
    );
  };

  const onboardingSteps = [
    // STEP 1: WELCOME
    {
      title: (
        <div className="flex flex-col items-center justify-center text-center">
          <h1 className="text-3xl font-bold mb-2">Welcome to</h1>
          <div className="relative">
            <SouloLogo 
              className="text-4xl mb-2" 
              textClassName="font-bold tracking-wider"
              useColorTheme={true}
            />
            <div className="mt-3">
              <WaveformAnimation />
            </div>
          </div>
          <motion.p 
            className="mt-8 text-lg text-center max-w-xs text-theme-color font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              textShadow: ["0 0 8px rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0.7)", 
                           "0 0 15px rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0.5)", 
                           "0 0 8px rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0.7)"]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              repeatType: "reverse" 
            }}
          >
            Express. Reflect. Evolve.
          </motion.p>
        </div>
      )
    },
    
    // STEP 2: JOURNALING
    {
      title: (
        <div className="flex flex-col items-center justify-center text-center">
          <MessageSquare className="h-12 w-12 text-theme-color mb-4" />
          <h2 className="text-2xl font-bold mb-2">Start Journaling</h2>
          <p className="text-md text-muted-foreground max-w-xs">
            Capture your thoughts and feelings in a private, secure space.
          </p>
        </div>
      )
    },
    
    // STEP 3: SMART CHAT
    {
      title: (
        <div className="flex flex-col items-center justify-center text-center">
          <Brain className="h-12 w-12 text-theme-color mb-4" />
          <h2 className="text-2xl font-bold mb-2">AI-Powered Insights</h2>
          <p className="text-md text-muted-foreground max-w-xs">
            Get personalized insights and guidance from our smart chat feature.
          </p>
        </div>
      )
    },
    
    // STEP 4: TRACKING
    {
      title: (
        <div className="flex flex-col items-center justify-center text-center">
          <LineChart className="h-12 w-12 text-theme-color mb-4" />
          <h2 className="text-2xl font-bold mb-2">Track Your Progress</h2>
          <p className="text-md text-muted-foreground max-w-xs">
            Visualize your emotional journey and identify patterns over time.
          </p>
        </div>
      )
    },
    
    // STEP 5: VOICE
    {
      title: (
        <div className="flex flex-col items-center justify-center text-center">
          <Mic className="h-12 w-12 text-theme-color mb-4" />
          <h2 className="text-2xl font-bold mb-2">Voice to Journal</h2>
          <p className="text-md text-muted-foreground max-w-xs">
            Use your voice to quickly capture thoughts and reflections.
          </p>
        </div>
      )
    },
    
    // STEP 6: COMMUNITY
    {
      title: (
        <div className="flex flex-col items-center justify-center text-center">
          <Heart className="h-12 w-12 text-theme-color mb-4" />
          <h2 className="text-2xl font-bold mb-2">Support & Community</h2>
          <p className="text-md text-muted-foreground max-w-xs">
            Connect with a supportive community and share your journey.
          </p>
        </div>
      )
    },
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-theme/5 pointer-events-none" />
        
        <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
          <div className="flex space-x-2">
            {onboardingSteps.map((_, index) => (
              <button
                key={index}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  currentStep === index 
                    ? "w-8 bg-theme-color" 
                    : "w-2 bg-theme-color/30"
                )}
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </div>
        </div>
        
        <div className="absolute top-4 right-4 z-10">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip
          </Button>
        </div>

        <div className="flex-1 relative pt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col items-center justify-center px-8"
            >
              <div className="max-w-md w-full">
                {onboardingSteps[currentStep].title}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-6 flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleBack}
            disabled={currentStep === 0}
            className={cn(
              "border-theme-color/50 text-theme-color",
              currentStep === 0 && "opacity-0 pointer-events-none"
            )}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <Button 
            onClick={handleNext}
            className="bg-theme-color hover:bg-theme-color/90 text-white"
          >
            {currentStep < onboardingSteps.length - 1 ? (
              <>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              "Get Started"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
