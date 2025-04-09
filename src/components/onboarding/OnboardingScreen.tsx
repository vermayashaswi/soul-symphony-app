
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SouloLogo from "@/components/SouloLogo";
import { cn } from "@/lib/utils";

interface OnboardingScreenProps {
  onComplete?: () => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ 
  onComplete 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  
  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Save that onboarding is complete
      localStorage.setItem("onboardingComplete", "true");
      
      // Navigate to auth or call onComplete
      if (onComplete) {
        onComplete();
      } else {
        navigate("/auth");
      }
    }
  };
  
  const handlePrevious = () => {
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

  const onboardingSteps = [
    {
      title: "Welcome to SOULo",
      description: "Your personal AI companion for emotional wellness and self-reflection.",
      illustration: (
        <div className="flex justify-center items-center my-8">
          <div className="relative w-48 h-48 bg-theme-lighter rounded-full flex items-center justify-center">
            <SouloLogo size="large" className="scale-[2.5]" useColorTheme={true} animate={true} />
          </div>
        </div>
      )
    },
    {
      title: "Voice Journaling",
      description: "Record your thoughts with voice notes that are automatically transcribed and analyzed.",
      illustration: (
        <div className="flex justify-center items-center my-8">
          <div className="relative w-48 h-48 bg-theme-lighter rounded-full flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <div className="w-12 h-12 rounded-full bg-theme flex items-center justify-center text-white">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 15C13.6569 15 15 13.6569 15 12V6C15 4.34315 13.6569 3 12 3C10.3431 3 9 4.34315 9 6V12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M19 10V12C19 16.4183 15.4183 20 11 20C6.58172 20 3 16.4183 3 12V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 20V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 23H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </motion.div>
              </div>
            </div>
            <motion.div 
              className="absolute inset-0 opacity-20"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.3, 0.2] 
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 2,
                ease: "easeInOut" 
              }}
            >
              <div className="w-full h-full rounded-full bg-theme"></div>
            </motion.div>
          </div>
        </div>
      )
    },
    {
      title: "AI Analysis",
      description: "Get insights into your emotional patterns and growth through advanced AI analysis.",
      illustration: (
        <div className="flex justify-center items-center my-8">
          <div className="relative w-48 h-48 bg-theme-lighter rounded-full flex flex-col items-center justify-center overflow-hidden p-4">
            <motion.div 
              className="flex flex-wrap gap-2 max-w-[200px] justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {["Joy", "Growth", "Motivation", "Health", "Focus"].map((theme, index) => (
                <motion.div
                  key={theme}
                  className="px-3 py-1 bg-theme/20 rounded-full text-sm font-medium text-theme"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: 1, 
                    opacity: 1,
                    y: [0, index % 2 === 0 ? -5 : 5, 0]
                  }}
                  transition={{ 
                    delay: index * 0.1 + 0.3,
                    y: {
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                      delay: index * 0.2
                    }
                  }}
                >
                  {theme}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      )
    },
    {
      title: "Chat with Your Journal",
      description: "Ask questions and get personalized insights based on your journal entries.",
      illustration: (
        <div className="flex justify-center items-center my-8">
          <div className="relative w-48 h-48 bg-theme-lighter rounded-full flex items-center justify-center overflow-hidden p-4">
            <div className="flex flex-col gap-2 w-full">
              <motion.div 
                className="self-start max-w-[80%] bg-muted p-2 rounded-lg text-xs"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                How have I been feeling lately?
              </motion.div>
              
              <motion.div 
                className="self-end max-w-[80%] bg-theme text-white p-2 rounded-lg text-xs"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                Based on your recent entries, you've been feeling more positive...
              </motion.div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Start Your Journey",
      description: "Create an account to begin your path to emotional wellness and self-discovery.",
      illustration: (
        <div className="flex justify-center items-center my-8">
          <motion.div 
            className="relative w-48 h-48 rounded-full flex items-center justify-center overflow-hidden"
            animate={{ 
              boxShadow: ["0 0 0 0px rgba(var(--color-theme), 0.2)", "0 0 0 20px rgba(var(--color-theme), 0)", "0 0 0 0px rgba(var(--color-theme), 0.2)"]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 2.5,
              ease: "easeInOut" 
            }}
          >
            <div className="absolute inset-0 bg-theme-lighter rounded-full"></div>
            <SouloLogo size="large" className="scale-[2]" useColorTheme={true} animate={true} />
          </motion.div>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Progress dots */}
        <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
          <div className="flex space-x-2">
            {onboardingSteps.map((_, index) => (
              <div 
                key={index} 
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  currentStep === index ? "bg-theme w-4" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
        
        {/* Skip button */}
        <div className="absolute top-4 right-4 z-10">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip
          </Button>
        </div>

        {/* Onboarding content */}
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col justify-center items-center p-6 text-center"
            >
              {onboardingSteps[currentStep].illustration}
              
              <h1 className="text-2xl font-bold mb-4 text-foreground">
                {onboardingSteps[currentStep].title}
              </h1>
              
              <p className="text-muted-foreground mb-8 max-w-xs">
                {onboardingSteps[currentStep].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="p-6 flex justify-between">
          <Button 
            variant="outline" 
            size="icon"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={currentStep === 0 ? "opacity-0" : ""}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Button 
            onClick={handleNext}
            className="px-8"
          >
            {currentStep === onboardingSteps.length - 1 ? "Get Started" : "Next"}
            {currentStep !== onboardingSteps.length - 1 && (
              <ChevronRight className="ml-2 h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
