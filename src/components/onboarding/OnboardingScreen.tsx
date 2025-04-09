
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Mic, MessageSquare, Brain, LineChart, Heart } from "lucide-react";
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
      subtitle: "Your personal AI companion for emotional wellness through voice journaling",
      description: "Express your thoughts and feelings with voice notes - we'll do the rest.",
      illustration: (
        <div className="flex justify-center items-center my-2">
          <motion.div 
            className="relative w-64 h-64"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 z-0">
              <motion.div 
                className="w-full h-full rounded-full bg-theme-lighter flex items-center justify-center overflow-hidden"
                animate={{ 
                  boxShadow: ["0 0 0 0px rgba(var(--color-theme), 0.2)", "0 0 0 20px rgba(var(--color-theme), 0)", "0 0 0 0px rgba(var(--color-theme), 0.2)"]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2.5,
                  ease: "easeInOut" 
                }}
              />
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <SouloLogo size="large" className="scale-[2.2]" useColorTheme={true} animate={true} />
            </div>
            
            <motion.div 
              className="absolute inset-0 z-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={`particle-${i}`}
                  className="absolute rounded-full bg-theme-lighter"
                  style={{
                    width: Math.random() * 30 + 10,
                    height: Math.random() * 30 + 10,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: [0, 1, 0],
                    opacity: [0, 0.7, 0],
                    x: [0, Math.random() * 100 - 50],
                    y: [0, Math.random() * -100],
                  }}
                  transition={{
                    duration: Math.random() * 3 + 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        </div>
      ),
      buttonText: "Get Started"
    },
    {
      title: "Your Data is Private",
      subtitle: "Privacy first approach",
      description: "Your journal entries are securely stored and only accessible to you. We take your privacy seriously.",
      illustration: (
        <div className="flex justify-center items-center my-2">
          <motion.div 
            className="relative w-64 h-64 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="absolute w-56 h-56 bg-theme-lighter rounded-full opacity-20"
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            <motion.div 
              className="relative z-10 bg-white/90 dark:bg-gray-800/90 rounded-xl p-5 shadow-lg border border-theme-light"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="w-44 h-44 flex flex-col items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.5 }}
                  className="w-20 h-20 bg-theme-light rounded-full flex items-center justify-center mb-4"
                >
                  <Heart className="w-10 h-10 text-theme" />
                </motion.div>
                
                <motion.div 
                  className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <motion.div 
                    className="h-full bg-theme"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.9, duration: 0.7 }}
                  />
                </motion.div>
                
                <motion.div 
                  className="mt-4 flex space-x-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                >
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-theme-light" />
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      ),
      buttonText: "Next"
    },
    {
      title: "Voice Journaling",
      subtitle: "Speak your mind, we'll capture it",
      description: "Record your thoughts with voice notes that are automatically transcribed and analyzed for emotional patterns.",
      illustration: (
        <div className="flex justify-center items-center my-2">
          <div className="relative w-64 h-64 bg-theme-lighter rounded-full flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="relative w-28 h-28 rounded-full bg-theme-light flex items-center justify-center"
                animate={{
                  scale: [1, 1.05, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(var(--color-theme), 0.7)",
                    "0 0 0 15px rgba(var(--color-theme), 0)",
                    "0 0 0 0 rgba(var(--color-theme), 0)"
                  ]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <div className="w-20 h-20 rounded-full bg-theme flex items-center justify-center text-white">
                  <Mic className="w-10 h-10" />
                </div>
              </motion.div>
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
            
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <motion.div
                className="flex space-x-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-theme rounded-full"
                    style={{ height: 5 }}
                    animate={{
                      height: [5, 12 + Math.random() * 15, 5]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      ),
      buttonText: "Next"
    },
    {
      title: "AI Analysis",
      subtitle: "Meaningful insights, automatically",
      description: "Get insights into your emotional patterns and growth through advanced AI analysis.",
      illustration: (
        <div className="flex justify-center items-center my-2">
          <div className="relative w-64 h-64 bg-theme-lighter rounded-full flex flex-col items-center justify-center overflow-hidden p-4">
            <motion.div 
              className="absolute inset-0 bg-theme opacity-5 rounded-full"
              animate={{
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            <motion.div
              className="relative z-10 mb-3"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
            >
              <Brain className="w-12 h-12 text-theme" />
            </motion.div>
            
            <motion.div 
              className="flex flex-wrap gap-2 max-w-[200px] justify-center relative z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {["Joy", "Growth", "Progress", "Health", "Focus", "Connection", "Creativity"].map((theme, index) => (
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
                    delay: index * 0.1 + 0.5,
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
      ),
      buttonText: "Next"
    },
    {
      title: "Chat with Your Journal",
      subtitle: "Discover insights through conversation",
      description: "Ask questions about your emotions, patterns, and growth through natural conversation with AI.",
      illustration: (
        <div className="flex justify-center items-center my-2">
          <div className="relative w-64 h-64 bg-theme-lighter rounded-full flex items-center justify-center overflow-hidden p-4">
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-transparent to-theme/10"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ 
                duration: 3, 
                repeat: Infinity,
                ease: "easeInOut" 
              }}
            />
            
            <div className="relative z-10 flex flex-col gap-3 w-48">
              <motion.div 
                className="self-start max-w-[80%] bg-muted p-3 rounded-2xl rounded-bl-none text-sm"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                How have I been feeling lately?
              </motion.div>
              
              <motion.div 
                className="self-end max-w-[80%] bg-theme text-white p-3 rounded-2xl rounded-br-none text-sm"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
              >
                Based on your recent entries, you've been feeling more positive and energetic this week...
              </motion.div>
              
              <motion.div
                className="self-start flex items-center justify-center w-10 h-10 bg-muted rounded-full mt-2"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5, type: "spring" }}
              >
                <MessageSquare className="w-5 h-5 text-primary" />
              </motion.div>
            </div>
          </div>
        </div>
      ),
      buttonText: "Next"
    },
    {
      title: "Track Your Emotional Journey",
      subtitle: "Visualize your growth",
      description: "See your emotional patterns and growth over time with beautiful visualizations.",
      illustration: (
        <div className="flex justify-center items-center my-2">
          <div className="relative w-64 h-64 bg-theme-lighter rounded-full flex items-center justify-center overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-theme/5 to-theme/20"
              animate={{ 
                opacity: [0.3, 0.5, 0.3],
                rotate: [0, 5, 0, -5, 0]
              }}
              transition={{ 
                opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 10, repeat: Infinity, ease: "easeInOut" }
              }}
            />
            
            <div className="relative z-10 w-48 h-48 flex items-center justify-center">
              <motion.div
                className="w-44 h-32 bg-white/90 dark:bg-gray-800/90 rounded-xl p-3 shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-theme">Mood Trends</div>
                  <LineChart className="w-4 h-4 text-theme" />
                </div>
                
                <svg viewBox="0 0 100 50" className="w-full h-16">
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="var(--color-theme)" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="var(--color-theme)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  <motion.path
                    d="M0,40 C10,35 20,25 30,30 C40,35 50,20 60,15 C70,10 80,5 100,10"
                    fill="none"
                    stroke="var(--color-theme)"
                    strokeWidth="2"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.5 }}
                  />
                  
                  <motion.path
                    d="M0,40 C10,35 20,25 30,30 C40,35 50,20 60,15 C70,10 80,5 100,10 V50 H0 Z"
                    fill="url(#gradient)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 2 }}
                  />
                  
                  {[
                    { x: 30, y: 30, delay: 1.5 },
                    { x: 60, y: 15, delay: 1.8 },
                    { x: 80, y: 5, delay: 2.1 }
                  ].map((point, i) => (
                    <motion.circle
                      key={`point-${i}`}
                      cx={point.x}
                      cy={point.y}
                      r="3"
                      fill="var(--color-theme)"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: point.delay }}
                    />
                  ))}
                </svg>
                
                <motion.div
                  className="flex justify-between text-xs text-muted-foreground mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.2 }}
                >
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>Now</span>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      ),
      buttonText: "Next"
    },
    {
      title: "Ready to Start Your Journey?",
      subtitle: "Express, reflect, and grow with SOULo",
      description: "Create an account to begin your path to emotional wellness and self-discovery.",
      illustration: (
        <div className="flex justify-center items-center my-2">
          <motion.div 
            className="relative w-64 h-64 rounded-full flex items-center justify-center overflow-hidden"
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
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
            >
              <SouloLogo size="large" className="scale-[2.5]" useColorTheme={true} animate={true} />
            </motion.div>
            
            <motion.div
              className="absolute bottom-5 w-full flex justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
              <div className="text-theme text-sm font-medium text-center">
                Emotional wellness through voice
              </div>
            </motion.div>
          </motion.div>
        </div>
      ),
      buttonText: "Get Started"
    }
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-background to-theme/5 pointer-events-none" />
        
        {/* Progress dots */}
        <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
          <div className="flex space-x-2">
            {onboardingSteps.map((_, index) => (
              <motion.div 
                key={index} 
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  currentStep === index ? "bg-theme w-6" : "bg-muted"
                )}
                animate={currentStep === index ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5, repeat: currentStep === index ? Infinity : 0, repeatDelay: 1.5 }}
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
        <div className="flex-1 relative pt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col justify-center items-center px-6 text-center"
            >
              {onboardingSteps[currentStep].illustration}
              
              <motion.h1 
                className="text-2xl font-bold mb-1 text-foreground"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {onboardingSteps[currentStep].title}
              </motion.h1>
              
              {onboardingSteps[currentStep].subtitle && (
                <motion.h2
                  className="text-lg text-theme mb-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {onboardingSteps[currentStep].subtitle}
                </motion.h2>
              )}
              
              <motion.p 
                className="text-muted-foreground mb-8 max-w-xs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {onboardingSteps[currentStep].description}
              </motion.p>
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
            className="px-8 bg-theme hover:bg-theme-dark text-white"
          >
            {onboardingSteps[currentStep].buttonText || (currentStep === onboardingSteps.length - 1 ? "Get Started" : "Next")}
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
