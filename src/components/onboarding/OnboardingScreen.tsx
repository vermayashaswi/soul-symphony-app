import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Mic, MessageSquare, Brain, LineChart, LockOpen, Lock, User, Languages, Search, X } from "lucide-react";
import SouloLogo from "@/components/SouloLogo";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { RecordingVisualizer } from "@/components/voice-recorder/RecordingVisualizer";
import { toast } from "sonner";
import { useSwipeGesture } from "@/hooks/use-swipe-gesture";
import { useTranslation } from "@/contexts/TranslationContext";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PremiumBadge } from "@/components/onboarding/PremiumBadge";

interface OnboardingScreenProps {
  onComplete?: () => void;
}

interface NameStepProps {
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
}

const createWavePath = (
  width: number, 
  height: number, 
  amplitude: number, 
  frequency: number, 
  phase: number
): string => {
  let path = `M 0 ${height / 2}`;
  const segments = 30;
  
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width;
    const y = (height / 2) + Math.sin(((i / segments) * Math.PI * 2 * frequency) + phase) * amplitude;
    path += ` L ${x} ${y}`;
  }
  
  return path;
};

const LANGUAGES = [
  { code: 'en', label: 'English', region: 'European' },
  { code: 'es', label: 'Español', region: 'European' },
  { code: 'fr', label: 'Français', region: 'European' },
  { code: 'de', label: 'Deutsch', region: 'European' },
  { code: 'hi', label: 'हिन्दी', region: 'Indian' },
  { code: 'zh', label: '中文', region: 'Asian' },
  { code: 'ja', label: '日本語', region: 'Asian' },
  { code: 'ru', label: 'Русский', region: 'European' },
  { code: 'ar', label: 'العربية', region: 'Middle Eastern' },
  { code: 'pt', label: 'Português', region: 'European' },
  { code: 'bn', label: 'বাংলা', region: 'Indian' },
  { code: 'ta', label: 'தமிழ்', region: 'Indian' },
  { code: 'te', label: 'తెలుగు', region: 'Indian' },
  { code: 'mr', label: 'मराठी', region: 'Indian' },
  { code: 'gu', label: 'ગુજરાતી', region: 'Indian' },
  { code: 'kn', label: 'ಕನ್ನಡ', region: 'Indian' },
  { code: 'ml', label: 'മലയാളം', region: 'Indian' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', region: 'Indian' },
  { code: 'as', label: 'অসমীয়া', region: 'Indian' },
  { code: 'or', label: 'ଓଡ଼ିଆ', region: 'Indian' },
  { code: 'ur', label: 'اردو', region: 'Indian' },
  { code: 'sd', label: 'سنڌي', region: 'Indian' },
  { code: 'ks', label: 'कॉशुर', region: 'Indian' },
  { code: 'kok', label: 'कोंकणी', region: 'Indian' },
  { code: 'mai', label: 'मैथिली', region: 'Indian' },
  { code: 'it', label: 'Italiano', region: 'European' },
  { code: 'ko', label: '한국어', region: 'Asian' },
  { code: 'tr', label: 'Türkçe', region: 'European' },
  { code: 'nl', label: 'Nederlands', region: 'European' },
  { code: 'pl', label: 'Polski', region: 'European' },
  { code: 'sv', label: 'Svenska', region: 'European' },
  { code: 'th', label: 'ไทย', region: 'Asian' },
  { code: 'vi', label: 'Tiếng Việt', region: 'Asian' },
  { code: 'id', label: 'Bahasa Indonesia', region: 'Asian' },
  { code: 'uk', label: 'Українська', region: 'European' },
  { code: 'el', label: 'Ελληνικά', region: 'European' },
  { code: 'ro', label: 'Română', region: 'European' },
  { code: 'hu', label: 'Magyar', region: 'European' },
  { code: 'cs', label: 'Čeština', region: 'European' },
  { code: 'he', label: 'עברית', region: 'Middle Eastern' },
];

interface StepIllustration {
  title: string;
  subtitle: string;
  description: string;
  illustration: React.FC<any>;
  buttonText: string;
  isPremium?: boolean;
}

const ONBOARDING_STEPS: StepIllustration[] = [
  {
    title: "Your Voice Journaling Companion",
    subtitle: "",
    description: "Welcome to Voice Journaling - Just speak and we'll do the rest",
    illustration: (props: {}) => (
      <div className="flex flex-col justify-center items-center my-2">
        <motion.div 
          className="relative w-full h-48"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="absolute inset-0 flex items-center justify-center z-10 mb-12">
            <div className="relative z-20">
              <SouloLogo size="large" className="scale-[2.2]" useColorTheme={false} textClassName="font-bold text-white" />
            </div>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center z-5 mt-12">
            <div className="absolute w-full h-16 flex items-center justify-center overflow-hidden">
              <RecordingVisualizer 
                isRecording={false} 
                audioLevel={0.5} 
                ripples={[]} 
                fullWidth={true} 
              />
            </div>
          </div>
        </motion.div>
        
        <motion.h1 
          className="text-2xl font-bold mb-3 mt-8 text-foreground text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <TranslatableText text="Your Voice Journaling Companion" forceTranslate={true} />
        </motion.h1>
        
        <motion.p 
          className="text-muted-foreground mb-6 max-w-xs font-medium text-theme animate-pulse text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            scale: [1, 1.05, 1]
          }}
          transition={{ 
            delay: 0.4,
            scale: {
              repeat: Infinity,
              duration: 2,
              ease: "easeInOut"
            }
          }}
        >
          <TranslatableText text="Express your thoughts and feelings with voice notes - we'll do the rest." forceTranslate={true} />
        </motion.p>
        
        {/* Language selector */}
        <motion.div
          className="mt-4 w-full max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex flex-col gap-2 bg-background/90 p-4 rounded-lg border border-theme-light">
            <label className="text-sm font-medium text-foreground">
              <TranslatableText text="Preferred Language" forceTranslate={true} />
            </label>
            <LanguageSelector />
          </div>
        </motion.div>
      </div>
    ),
    buttonText: "Get Started"
  },
  {
    title: "Your Data is Private",
    subtitle: "",
    description: "Your journal entries are securely stored and only accessible to you. We take your privacy seriously.",
    illustration: (props: {}) => (
      <div className="flex justify-center items-center my-2">
        <motion.div 
          className="relative w-64 h-64 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
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
                <motion.div className="relative w-10 h-10">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{ 
                      times: [0, 0.2, 0.8, 1],
                      duration: 2.5,
                      repeat: Infinity,
                      repeatDelay: 1.5
                    }}
                    className="absolute inset-0 flex justify-center items-center z-20"
                  >
                    <LockOpen className="w-10 h-10 text-theme" />
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: [0, 0, 1, 1],
                    }}
                    transition={{ 
                      times: [0, 0.8, 0.9, 1],
                      duration: 2.5,
                      repeat: Infinity,
                      repeatDelay: 1.5
                    }}
                    className="absolute inset-0 flex justify-center items-center z-10"
                  >
                    <Lock className="w-10 h-10 text-theme" />
                  </motion.div>
                  
                  <motion.div 
                    className="absolute top-0 left-0 w-full h-full overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={`data-particle-${i}`}
                        className="absolute w-1.5 h-1.5 rounded-full bg-theme"
                        style={{
                          left: `${40 + (Math.random() * 20)}%`,
                          top: i % 2 === 0 ? '-20%' : '-30%',
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ 
                          y: [0, 55],
                          opacity: [0, 1, 0],
                        }}
                        transition={{
                          y: { duration: 1 },
                          opacity: { duration: 1, times: [0, 0.3, 1] },
                          delay: i * 0.1,
                          repeat: Infinity,
                          repeatDelay: 2
                        }}
                      />
                    ))}
                  </motion.div>
                  
                  <motion.div 
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    animate={{ 
                      scale: [1, 1.3, 1],
                      opacity: [0, 0.7, 0] 
                    }}
                    transition={{ 
                      duration: 0.8,
                      delay: 2,
                      repeat: Infinity,
                      repeatDelay: 2.2
                    }}
                  >
                    <div className="w-full h-full rounded-full border-2 border-theme"></div>
                  </motion.div>
                </motion.div>
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
    subtitle: "",
    description: "Record your thoughts with voice notes that are automatically transcribed and analyzed for emotional patterns.",
    illustration: (props: {}) => (
      <div className="flex justify-center items-center my-2">
        <div className="relative w-64 h-64 flex items-center justify-center overflow-hidden">
          {[45, 60, 80, 100].map((size, index) => (
            <motion.div
              key={`circle-${index}`}
              className={`absolute rounded-full ${index % 2 === 0 ? 'bg-theme/30 dark:bg-theme/30' : 'bg-theme-light/30 dark:bg-theme-light/30'}`}
              style={{ width: size, height: size }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.15, 0.25, 0.15]
              }}
              transition={{
                duration: 2 + index * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.2
              }}
            />
          ))}
          
          <motion.div
            className="relative w-28 h-28 rounded-full bg-theme-light flex items-center justify-center"
            animate={{
              scale: [1, 1.1, 1],
              boxShadow: [
                "0 0 0 0 rgba(var(--color-theme), 0.7)",
                "0 0 0 15px rgba(var(--color-theme), 0)",
                "0 0 0 0 rgba(var(--color-theme), 0)"
              ]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="w-20 h-20 rounded-full bg-theme flex items-center justify-center text-white">
              <Mic className="w-10 h-10 animate-pulse" />
            </div>
          </motion.div>
        </div>
      </div>
    ),
    buttonText: "Next"
  },
  {
    title: "AI Analysis",
    subtitle: "",
    description: "Get insights into your emotional patterns and growth through advanced AI analysis.",
    isPremium: true,
    illustration: (props: {}) => (
      <div className="flex justify-center items-center my-2">
        <div className="relative w-64 h-64 flex flex-col items-center justify-center overflow-hidden p-4">
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
                <TranslatableText text={theme} forceTranslate={true} />
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
    subtitle: "",
    description: "Ask questions about your emotions, patterns, and growth through natural conversation with AI.",
    isPremium: true,
    illustration: (props: {}) => (
      <div className="flex justify-center items-center my-2 w-full">
        <div className="relative w-full max-w-xs bg-theme-dark/30 dark:bg-theme-dark/30 rounded-xl flex items-center justify-center overflow-hidden p-4">
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-transparent to-theme/10"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
          />
          
          <div className="relative z-10 flex flex-col gap-3 w-full mt-4 mb-2">
            <motion.div 
              className="self-start max-w-[90%] bg-white dark:bg-white p-2.5 rounded-2xl rounded-bl-none text-sm text-gray-800"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <TranslatableText text="How have I been feeling lately?" forceTranslate={true} />
            </motion.div>
            
            <motion.div 
              className="self-end max-w-[90%] bg-theme text-white p-2.5 rounded-2xl rounded-br-none text-sm"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <TranslatableText text="Based on your recent entries, you've been feeling more positive and energetic this week..." forceTranslate={true} />
            </motion.div>
            
            <motion.div
              className="self-start flex items-center justify-center w-10 h-10 bg-muted rounded-full mt-1.5"
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
    subtitle: "",
    description: "See your emotional patterns and growth over time with beautiful visualizations.",
    isPremium: true,
    illustration: (props: {}) => (
      <div className="flex justify-center items-center my-2">
        <div className="relative w-64 h-64 flex items-center justify-center overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-theme/10 to-theme/30 dark:from-theme/10 dark:to-theme/30"
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
                <div className="text-xs font-medium text-theme">
                  <TranslatableText text="Mood Trends" forceTranslate={true} />
                </div>
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
                <span><TranslatableText text="Jan" forceTranslate={true} /></span>
                <span><TranslatableText text="Mar" forceTranslate={true} /></span>
                <span><TranslatableText text="Now" forceTranslate={true} /></span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    ),
    buttonText: "Next"
  },
  {
    title: "What Should We Call You?",
    subtitle: "",
    description: "Your name helps us make your journey more personal.",
    illustration: (props: NameStepProps) => (
      <div className="flex flex-col justify-center items-center my-2 w-full">
        <motion.div 
          className="relative w-full max-w-xs bg-theme-dark/30 dark:bg-theme-dark/30 rounded-xl flex flex-col items-center justify-center overflow-hidden p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="w-20 h-20 bg-theme/20 rounded-full flex items-center justify-center mb-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.3 }}
          >
            <User className="w-10 h-10 text-theme" />
          </motion.div>
          
          <motion.div 
            className="w-full space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <NameInput
              name={props.name}
              setName={props.setName}
            />
            
            <div className="text-sm text-muted-foreground text-center">
              <TranslatableText text="This is how SOuLO will address you" forceTranslate={true} />
            </div>
          </motion.div>
          
          <motion.div 
            className="absolute -z-10 inset-0 opacity-20"
            animate={{ 
              background: [
                "radial-gradient(circle at 20% 20%, var(--color-theme-dark) 0%, transparent 70%)",
                "radial-gradient(circle at 80% 80%, var(--color-theme-dark) 0%, transparent 70%)",
                "radial-gradient(circle at 20% 20%, var(--color-theme-dark) 0%, transparent 70%)"
              ]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    ),
    buttonText: "Continue"
  },
  {
    title: "Ready to Start Your Journey?",
    subtitle: "",
    description: "",
    illustration: (props: {}) => (
      <div className="flex justify-center items-center my-2">
        <motion.div 
          className="relative w-64 h-64 rounded-xl flex items-center justify-center overflow-hidden"
          animate={{ 
            boxShadow: ["0 0 0 0px rgba(var(--color-theme), 0.2)", "0 0 0 20px rgba(var(--color-theme), 0)", "0 0 0 0px rgba(var(--color-theme), 0.2)"]
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 2.5,
            ease: "easeInOut" 
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
          >
            <SouloLogo size="large" className="scale-[2.5]" useColorTheme={false} animate={true} textClassName="font-bold text-white" />
          </motion.div>
          
          <motion.div
            className="absolute bottom-5 w-full flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <div className="text-theme text-sm font-medium text-center">
              <TranslatableText text="Emotional wellness through voice" forceTranslate={true} />
            </div>
          </motion.div>
        </motion.div>
      </div>
    ),
    buttonText: "Sign In"
  }
];

// Create a separate component for the name input with proper translation handling
const NameInput: React.FC<{ name: string; setName: (name: string) => void }> = ({ name, setName }) => {
  const { translate, currentLanguage } = useTranslation();
  const [placeholder, setPlaceholder] = useState("Enter your name");
  
  useEffect(() => {
    const translatePlaceholder = async () => {
      if (currentLanguage !== 'en') {
        try {
          const translatedPlaceholder = await translate("Enter your name", "en");
          setPlaceholder(translatedPlaceholder);
        } catch (error) {
          console.error('Failed to translate placeholder:', error);
          setPlaceholder("Enter your name");
        }
      } else {
        setPlaceholder("Enter your name");
      }
    };
    
    translatePlaceholder();
  }, [currentLanguage, translate]);
  
  return (
    <Input
      placeholder={placeholder}
      value={name}
      onChange={(e) => setName(e.target.value)}
      className="bg-background/80 border-theme/20 focus:border-theme text-white"
      autoFocus
    />
  );
};

// Enhanced Language Selector component for onboarding - simplified without search
const LanguageSelector = () => {
  const { currentLanguage, setLanguage } = useTranslation();

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    
    // Store recently used language
    try {
      const recentLangs = localStorage.getItem('recentLanguages') || '[]';
      const parsed = JSON.parse(recentLangs);
      const updated = [
        value,
        ...parsed.filter((code: string) => code !== value)
      ].slice(0, 3);
      localStorage.setItem('recentLanguages', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to store recent language:', err);
    }
  };

  // Group languages by region
  const languagesByRegion = () => {
    const regions = {};
    
    LANGUAGES.forEach(lang => {
      if (!regions[lang.region]) {
        regions[lang.region] = [];
      }
      regions[lang.region].push(lang);
    });
    
    return regions;
  };

  const grouped = languagesByRegion();
  const regions = Object.keys(grouped);

  // Find the current language label
  const currentLanguageLabel = LANGUAGES.find(lang => lang.code === currentLanguage)?.label || 'Select a language';

  return (
    <div className="w-full">
      <Select value={currentLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-full bg-background/80 border-theme/20 text-white">
          <SelectValue placeholder="Select a language" className="text-white">
            {currentLanguageLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px] bg-background/90 border-theme/30">
          {regions.map(region => (
            <React.Fragment key={region}>
              <SelectItem value={`group_${region}`} disabled className="font-semibold text-muted-foreground">
                {region}
              </SelectItem>
              {grouped[region].map(language => (
                <SelectItem 
                  key={language.code} 
                  value={language.code} 
                  className="pl-6 hover:bg-theme/20 data-[state=checked]:bg-theme/40 data-[state=checked]:text-white"
                >
                  {language.label}
                </SelectItem>
              ))}
            </React.Fragment>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const { setColorTheme } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  
  // Define isNameStep before it's used in useSwipeGesture
  const isFirstStep = currentStep === 0;
  const isNameStep = currentStep === 6;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  
  useEffect(() => {
    setColorTheme('Calm');
  }, [setColorTheme]);
  
  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      if (currentStep === 6 && !name.trim()) {
        toast.error("Please enter your name to continue");
        return;
      }
      
      setCurrentStep(prev => prev + 1);
    } else {
      if (name) {
        localStorage.setItem("user_display_name", name.trim());
      }
      
      localStorage.setItem("onboardingComplete", "true");
      
      if (onComplete) {
        onComplete();
      } else {
        navigate("/app/auth");
      }
    }
  };
  
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const handleSkip = () => {
    console.log("Skip button clicked, user auth status:", !!user);
    
    if (name) {
      localStorage.setItem("user_display_name", name.trim());
    }
    
    localStorage.setItem("onboardingComplete", "true");
    
    if (onComplete) {
      onComplete();
    } else {
      // Check if user is already authenticated
      if (user) {
        console.log("User is authenticated, navigating to /app/home");
        navigate("/app/home");
      } else {
        console.log("User is not authenticated, navigating to /app/auth");
        navigate("/app/auth");
      }
    }
  };

  useSwipeGesture(contentRef, {
    onSwipeLeft: () => {
      if (currentStep < ONBOARDING_STEPS.length - 1) {
        handleNext();
      }
    },
    onSwipeRight: () => {
      if (currentStep > 0) {
        handlePrevious();
      }
    },
    minDistance: 50,
    disabled: isNameStep
  });

  const CurrentIllustration = ONBOARDING_STEPS[currentStep].illustration;
  const currentStepData = ONBOARDING_STEPS[currentStep];

  return (
    <div className="flex flex-col h-[100dvh] bg-background dark">
      <div 
        ref={contentRef}
        className="flex-1 flex flex-col overflow-hidden relative"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background to-theme/5 pointer-events-none" />
        
        <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
          <div className="flex space-x-2">
            {ONBOARDING_STEPS.map((_, index) => (
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
        
        <div className="absolute top-4 right-4 z-10">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-foreground hover:text-theme">
            <TranslatableText text="Skip" forceTranslate={true} />
          </Button>
        </div>

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
              {currentStep === 0 ? (
                <CurrentIllustration />
              ) : isNameStep ? (
                <>
                  <div className="flex items-center justify-center mb-2">
                    <h2 className="text-2xl font-bold text-theme">
                      <TranslatableText text={currentStepData.title} forceTranslate={true} />
                    </h2>
                    {currentStepData.isPremium && <PremiumBadge />}
                  </div>
                  {currentStepData.description && (
                    <p className="mb-8 text-muted-foreground max-w-xs">
                      <TranslatableText text={currentStepData.description} forceTranslate={true} />
                    </p>
                  )}
                  <CurrentIllustration name={name} setName={setName} />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center mb-2">
                    <h2 className="text-2xl font-bold text-theme">
                      <TranslatableText text={currentStepData.title} forceTranslate={true} />
                    </h2>
                    {currentStepData.isPremium && <PremiumBadge />}
                  </div>
                  {currentStepData.description && (
                    <p className="mb-8 text-muted-foreground max-w-xs">
                      <TranslatableText text={currentStepData.description} forceTranslate={true} />
                    </p>
                  )}
                  <CurrentIllustration />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        
        <div className="pb-12 pt-4 px-6 relative z-10">
          <div className="flex justify-between items-center">
            {currentStep > 0 ? (
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handlePrevious}
                className="bg-background/50 dark:bg-muted/20 border-muted hover:bg-muted/30 h-10 w-10"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </Button>
            ) : (
              <div className="w-10"></div>
            )}
            
            <Button 
              size="lg" 
              onClick={handleNext} 
              className="bg-theme hover:bg-theme-dark text-white"
            >
              <TranslatableText text={currentStepData.buttonText} forceTranslate={true} />
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
