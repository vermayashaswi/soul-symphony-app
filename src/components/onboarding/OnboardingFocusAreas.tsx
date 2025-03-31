
import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingLayout } from './OnboardingLayout';
import { Button } from '@/components/ui/button';
import { Heart, Briefcase, Sparkles, Home, Book, Brain, Users, Star } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface OnboardingFocusAreasProps {
  onContinue: () => void;
  onBack: () => void;
}

interface FocusAreaOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

export function OnboardingFocusAreas({ onContinue, onBack }: OnboardingFocusAreasProps) {
  const { userName, selectedFocusAreas, toggleFocusArea, currentStep } = useOnboarding();
  
  const focusAreas: FocusAreaOption[] = [
    { id: 'partner', label: 'Partner', icon: <Heart className="h-5 w-5" />, color: 'bg-pink-100 text-pink-800 border-pink-300' },
    { id: 'work', label: 'Work', icon: <Briefcase className="h-5 w-5" />, color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    { id: 'personal', label: 'Personal', icon: <Sparkles className="h-5 w-5" />, color: 'bg-purple-100 text-purple-800 border-purple-300' },
    { id: 'family', label: 'Family', icon: <Home className="h-5 w-5" />, color: 'bg-amber-100 text-amber-800 border-amber-300' },
    { id: 'learning', label: 'Learning', icon: <Book className="h-5 w-5" />, color: 'bg-blue-100 text-blue-800 border-blue-300' },
    { id: 'mindfulness', label: 'Mindfulness', icon: <Brain className="h-5 w-5" />, color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    { id: 'friends', label: 'Friends', icon: <Users className="h-5 w-5" />, color: 'bg-orange-100 text-orange-800 border-orange-300' },
    { id: 'goals', label: 'Goals', icon: <Star className="h-5 w-5" />, color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  ];
  
  return (
    <OnboardingLayout
      onContinue={onContinue}
      onBack={onBack}
      currentStep={currentStep}
    >
      <div className="flex flex-col h-full">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold mb-2">
            Great choice, {userName}! 🙌
          </h1>
          <p className="text-muted-foreground">
            Now, you will receive prompts based on these journaling focus areas only:
          </p>
        </motion.div>
        
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {focusAreas.map((area) => (
            <Button
              key={area.id}
              variant="outline"
              className={`h-auto py-3 px-4 justify-start space-x-2 border-2 ${
                selectedFocusAreas.includes(area.id)
                  ? area.color
                  : 'border-muted'
              }`}
              onClick={() => toggleFocusArea(area.id)}
            >
              <span className={`${selectedFocusAreas.includes(area.id) ? '' : 'text-muted-foreground'}`}>
                {area.icon}
              </span>
              <span className={`${selectedFocusAreas.includes(area.id) ? '' : 'text-muted-foreground'}`}>
                {area.label}
              </span>
            </Button>
          ))}
        </motion.div>
        
        <motion.div
          className="mt-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="w-full h-48 flex items-center justify-center">
            <img 
              src="/lovable-uploads/0077fe9b-986d-4b09-877c-35684f9a1292.png" 
              alt="Happy character" 
              className="h-full object-contain"
            />
          </div>
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}
