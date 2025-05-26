
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Mic, Play, Pause, User, Palette, Bell, Shield, Heart, Sparkles, Zap, Target, Calendar, TrendingUp, BarChart3, Brain, MessageCircle, Globe, CheckCircle, Star, Coffee, Sun, Moon, Cloud, Rainbow } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTranslation } from '@/contexts/TranslationContext';
import { languages } from '@/contexts/TranslationContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import SouloLogo from '@/components/SouloLogo';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const { setColorTheme } = useTheme();
  const { completeOnboarding } = useOnboarding();
  const { setLanguage, translate } = useTranslation();
  const [nameInputPlaceholder, setNameInputPlaceholder] = useState('Enter your name');
  const [languageSelectorPlaceholder, setLanguageSelectorPlaceholder] = useState('Select a language');
  
  const recordingInterval = useRef<NodeJS.Timeout>();
  const playbackTimeout = useRef<NodeJS.Timeout>();

  const totalSteps = 6;

  // Update placeholders when language changes
  useEffect(() => {
    const updatePlaceholders = async () => {
      if (selectedLanguage !== 'en') {
        const translatedNamePlaceholder = await translate('Enter your name');
        const translatedLanguagePlaceholder = await translate('Select a language');
        setNameInputPlaceholder(translatedNamePlaceholder);
        setLanguageSelectorPlaceholder(translatedLanguagePlaceholder);
      } else {
        setNameInputPlaceholder('Enter your name');
        setLanguageSelectorPlaceholder('Select a language');
      }
    };
    
    updatePlaceholders();
  }, [selectedLanguage, translate]);

  const demoEmotions = [
    { name: 'Joy', intensity: 85, color: '#10B981', icon: '😊' },
    { name: 'Growth', intensity: 72, color: '#3B82F6', icon: '🌱' },
    { name: 'Progress', intensity: 68, color: '#8B5CF6', icon: '🚀' },
    { name: 'Clarity', intensity: 91, color: '#F59E0B', icon: '💡' },
    { name: 'Peace', intensity: 76, color: '#06B6D4', icon: '☮️' },
    { name: 'Gratitude', intensity: 89, color: '#EC4899', icon: '🙏' },
    { name: 'Energy', intensity: 82, color: '#EF4444', icon: '⚡' },
    { name: 'Focus', intensity: 74, color: '#84CC16', icon: '🎯' }
  ];

  const demoMoodData = [
    { month: 'Jan', happiness: 65, energy: 58, clarity: 62 },
    { month: 'Feb', happiness: 68, energy: 63, clarity: 65 },
    { month: 'Mar', happiness: 72, energy: 67, clarity: 70 },
    { month: 'Apr', happiness: 75, energy: 71, clarity: 74 },
    { month: 'May', happiness: 78, energy: 75, clarity: 77 },
    { month: 'Now', happiness: 82, energy: 79, clarity: 81 }
  ];

  useEffect(() => {
    if (isRecording) {
      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }

    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, [isRecording]);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    // Save the user's name to localStorage for later use
    if (userName) {
      localStorage.setItem('user_display_name', userName);
    }
    
    // Set the selected language
    if (selectedLanguage !== 'en') {
      await setLanguage(selectedLanguage);
    }
    
    completeOnboarding();
    onComplete();
    toast.success(<TranslatableText text="Welcome to SOuLO! Your journey begins now." forceTranslate={true} />);
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    setTimeout(() => {
      setIsRecording(false);
      toast.success(<TranslatableText text="Great! Your voice sample has been captured." forceTranslate={true} />);
    }, 3000);
  };

  const playRecording = () => {
    setIsPlaying(true);
    playbackTimeout.current = setTimeout(() => {
      setIsPlaying(false);
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderLanguageStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-8"
    >
      <div className="space-y-4">
        <Globe className="h-16 w-16 mx-auto text-theme-color" />
        <h2 className="text-3xl font-bold text-foreground">
          <TranslatableText text="Choose Your Language" />
        </h2>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          <TranslatableText text="Select your preferred language for the best experience" />
        </p>
      </div>

      <div className="max-w-sm mx-auto">
        <Select value={selectedLanguage} onValueChange={(value) => {
          setSelectedLanguage(value);
          if (value !== 'en') {
            setLanguage(value);
          }
        }}>
          <SelectTrigger className="w-full h-12 text-lg">
            <SelectValue placeholder={languageSelectorPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto pt-4">
        {['🌍', '🗣️', '💬', '🌐'].map((emoji, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 * index, type: "spring" }}
            className="bg-secondary/50 rounded-xl p-4 text-center"
          >
            <span className="text-2xl">{emoji}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderNameStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-8"
    >
      <div className="space-y-4">
        <User className="h-16 w-16 mx-auto text-theme-color" />
        <h2 className="text-3xl font-bold text-foreground">
          <TranslatableText text="What should we call you?" />
        </h2>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          <TranslatableText text="Help us personalize your SOuLO experience" />
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-3">
        <Input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder={nameInputPlaceholder}
          className="text-center text-lg h-12 border-2 focus:border-theme-color"
          maxLength={25}
        />
        <p className="text-sm text-muted-foreground">
          <TranslatableText text="This is how SOuLO will address you" />
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
        {['👋', '😊', '🌟', '💫'].map((emoji, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 * index, type: "spring" }}
            className="bg-secondary/50 rounded-xl p-4 text-center"
          >
            <span className="text-2xl">{emoji}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderVoiceStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-8"
    >
      <div className="space-y-4">
        <Mic className="h-16 w-16 mx-auto text-theme-color" />
        <h2 className="text-3xl font-bold text-foreground">
          <TranslatableText text="Let's hear your voice" />
        </h2>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          <TranslatableText text="Record a quick sample so SOuLO can learn your voice patterns" />
        </p>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <Button
            onClick={startRecording}
            disabled={isRecording || recordingTime > 0}
            size="lg"
            className={cn(
              "h-24 w-24 rounded-full text-white relative overflow-hidden",
              isRecording ? "bg-red-500 hover:bg-red-600" : "bg-theme hover:bg-theme/90"
            )}
          >
            <motion.div
              animate={isRecording ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Mic className="h-8 w-8" />
            </motion.div>
            {isRecording && (
              <motion.div
                className="absolute inset-0 border-4 border-white rounded-full"
                animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              />
            )}
          </Button>
        </div>

        {(isRecording || recordingTime > 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-3"
          >
            <div className="text-2xl font-mono text-theme-color">
              {formatTime(recordingTime)}
            </div>
            {isRecording && (
              <p className="text-muted-foreground">
                <TranslatableText text="Recording... speak naturally" />
              </p>
            )}
            {!isRecording && recordingTime > 0 && (
              <div className="space-y-3">
                <p className="text-green-600 font-medium">
                  <TranslatableText text="Recording complete!" />
                </p>
                <Button
                  onClick={playRecording}
                  disabled={isPlaying}
                  variant="outline"
                  className="gap-2"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <TranslatableText text={isPlaying ? "Playing..." : "Play Recording"} />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
        {['🎤', '🔊', '🎵', '📢'].map((emoji, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 * index, type: "spring" }}
            className="bg-secondary/50 rounded-xl p-4 text-center"
          >
            <span className="text-2xl">{emoji}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderAIAnalysisStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-8"
    >
      <div className="space-y-4">
        <Brain className="h-16 w-16 mx-auto text-theme-color" />
        <h2 className="text-3xl font-bold text-foreground">
          <TranslatableText text="AI Analysis Preview" />
        </h2>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          <TranslatableText text="See how SOuLO will analyze your emotions and themes" />
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="p-6 space-y-6">
          <h3 className="text-xl font-semibold text-theme-color">
            <TranslatableText text="Detected Emotions & Themes" />
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {demoEmotions.map((emotion, index) => (
              <motion.div
                key={emotion.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * index }}
                className="bg-secondary/50 rounded-xl p-4 space-y-2"
              >
                <div className="text-2xl">{emotion.icon}</div>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">
                    <TranslatableText text={emotion.name} />
                  </h4>
                  <div className="w-full bg-background rounded-full h-2">
                    <motion.div
                      className="h-2 rounded-full"
                      style={{ backgroundColor: emotion.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${emotion.intensity}%` }}
                      transition={{ delay: 0.2 * index, duration: 0.8 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{emotion.intensity}%</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
        {['🧠', '💡', '📊', '🎯'].map((emoji, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 * index, type: "spring" }}
            className="bg-secondary/50 rounded-xl p-4 text-center"
          >
            <span className="text-2xl">{emoji}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderInsightsStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-8"
    >
      <div className="space-y-4">
        <BarChart3 className="h-16 w-16 mx-auto text-theme-color" />
        <h2 className="text-3xl font-bold text-foreground">
          <TranslatableText text="Track Your Progress" />
        </h2>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          <TranslatableText text="Visualize your emotional journey over time" />
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="p-6 space-y-6">
          <h3 className="text-xl font-semibold text-theme-color">
            <TranslatableText text="Mood Trends" />
          </h3>
          
          <div className="h-64 flex items-end justify-between gap-2 px-4">
            {demoMoodData.map((data, index) => (
              <div key={data.month} className="flex-1 space-y-2">
                <div className="space-y-1 h-48 flex flex-col justify-end">
                  {/* Happiness */}
                  <motion.div
                    className="bg-blue-500 rounded-t-sm"
                    initial={{ height: 0 }}
                    animate={{ height: `${data.happiness}%` }}
                    transition={{ delay: 0.1 * index, duration: 0.8 }}
                  />
                  {/* Energy */}
                  <motion.div
                    className="bg-green-500 rounded-t-sm"
                    initial={{ height: 0 }}
                    animate={{ height: `${data.energy}%` }}
                    transition={{ delay: 0.1 * index + 0.2, duration: 0.8 }}
                  />
                  {/* Clarity */}
                  <motion.div
                    className="bg-purple-500 rounded-t-sm"
                    initial={{ height: 0 }}
                    animate={{ height: `${data.clarity}%` }}
                    transition={{ delay: 0.1 * index + 0.4, duration: 0.8 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  <TranslatableText text={data.month} />
                </p>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <TranslatableText text="Happiness" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <TranslatableText text="Energy" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <TranslatableText text="Clarity" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
        {['📈', '📊', '🎯', '🏆'].map((emoji, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 * index, type: "spring" }}
            className="bg-secondary/50 rounded-xl p-4 text-center"
          >
            <span className="text-2xl">{emoji}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderWelcomeStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-8"
    >
      <div className="space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
        >
          <SouloLogo size="large" useColorTheme={true} />
        </motion.div>
        
        <div className="space-y-4">
          <h2 className="text-4xl font-bold text-foreground">
            <TranslatableText text="Welcome to SOuLO" />
            {userName && (
              <>
                , <span className="text-theme-color">{userName}</span>!
              </>
            )}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            <TranslatableText text="Your journey of self-discovery through voice journaling begins now" />
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="p-6 space-y-4">
            <MessageCircle className="h-12 w-12 mx-auto text-theme-color" />
            <h3 className="font-semibold">
              <TranslatableText text="Voice Journaling" />
            </h3>
            <p className="text-sm text-muted-foreground">
              <TranslatableText text="Speak your thoughts and let AI understand your emotions" />
            </p>
          </Card>
          
          <Card className="p-6 space-y-4">
            <Brain className="h-12 w-12 mx-auto text-theme-color" />
            <h3 className="font-semibold">
              <TranslatableText text="AI Insights" />
            </h3>
            <p className="text-sm text-muted-foreground">
              <TranslatableText text="Get personalized insights about your emotional patterns" />
            </p>
          </Card>
          
          <Card className="p-6 space-y-4">
            <TrendingUp className="h-12 w-12 mx-auto text-theme-color" />
            <h3 className="font-semibold">
              <TranslatableText text="Track Progress" />
            </h3>
            <p className="text-sm text-muted-foreground">
              <TranslatableText text="Watch your emotional wellness journey unfold over time" />
            </p>
          </Card>
        </div>
      </div>

      <div className="bg-secondary/30 rounded-2xl p-6 max-w-2xl mx-auto">
        <p className="text-lg font-medium text-theme-color mb-2">
          <TranslatableText text="Ready to start?" />
        </p>
        <p className="text-muted-foreground">
          <TranslatableText text="Create your first journal entry and discover the power of voice-driven emotional awareness" />
        </p>
      </div>
    </motion.div>
  );

  const steps = [
    renderLanguageStep,
    renderNameStep,
    renderVoiceStep,
    renderAIAnalysisStep,
    renderInsightsStep,
    renderWelcomeStep
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 0: return selectedLanguage !== '';
      case 1: return userName.trim().length > 0;
      case 2: return recordingTime > 0;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
      {/* Progress Bar */}
      <div className="w-full bg-secondary/30 h-2">
        <motion.div
          className="h-full bg-theme-color rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 container max-w-6xl mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="h-full flex flex-col justify-center"
          >
            {steps[currentStep]()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="border-t bg-background/80 backdrop-blur-sm">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <TranslatableText text="Previous" />
              </Button>
              
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <span>{currentStep + 1}</span>
                <span>/</span>
                <span>{totalSteps}</span>
              </div>
            </div>

            <Button
              onClick={currentStep === totalSteps - 1 ? handleComplete : handleNext}
              disabled={!canProceed()}
              size="lg"
              className="gap-2 bg-theme hover:bg-theme/90"
            >
              <TranslatableText text={currentStep === totalSteps - 1 ? "Get Started" : "Next"} />
              {currentStep !== totalSteps - 1 && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-sm text-muted-foreground border-t">
        <p className="flex items-center justify-center gap-1">
          <SouloLogo size="small" useColorTheme={true} />
          <TranslatableText text="Emotional wellness through voice" />
        </p>
      </div>
    </div>
  );
}
