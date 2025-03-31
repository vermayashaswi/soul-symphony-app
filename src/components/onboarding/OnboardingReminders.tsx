
import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingLayout } from './OnboardingLayout';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Switch } from '@/components/ui/switch';
import { SunMedium, Moon } from 'lucide-react';

interface OnboardingRemindersProps {
  onContinue: () => void;
  onBack: () => void;
}

export function OnboardingReminders({ onContinue, onBack }: OnboardingRemindersProps) {
  const { reminderSettings, toggleReminder, updateReminderTime, currentStep } = useOnboarding();
  
  return (
    <OnboardingLayout
      onContinue={onContinue}
      onBack={onBack}
      currentStep={currentStep}
    >
      <div className="flex flex-col h-full space-y-6">
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold">Daily Journal Reminders</h1>
          <p className="text-muted-foreground">
            These reminders will help you become consistent at journaling.
          </p>
        </motion.div>
        
        <div className="space-y-8 pt-4">
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="text-lg font-medium text-pink-500">After waking up</div>
            
            <div className="flex items-center justify-between border-b border-muted pb-4">
              <div className="flex items-center space-x-3">
                <SunMedium className="h-6 w-6 text-muted-foreground" />
                <input
                  type="time"
                  value={reminderSettings.morningTime}
                  onChange={(e) => updateReminderTime('morning', e.target.value)}
                  className="bg-transparent text-lg w-24 outline-none"
                  disabled={!reminderSettings.morning}
                />
              </div>
              
              <Switch
                checked={reminderSettings.morning}
                onCheckedChange={() => toggleReminder('morning')}
              />
            </div>
          </motion.div>
          
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-lg font-medium text-pink-500">Before sleeping</div>
            
            <div className="flex items-center justify-between border-b border-muted pb-4">
              <div className="flex items-center space-x-3">
                <Moon className="h-6 w-6 text-muted-foreground" />
                <input
                  type="time"
                  value={reminderSettings.eveningTime}
                  onChange={(e) => updateReminderTime('evening', e.target.value)}
                  className="bg-transparent text-lg w-24 outline-none"
                  disabled={!reminderSettings.evening}
                />
              </div>
              
              <Switch
                checked={reminderSettings.evening}
                onCheckedChange={() => toggleReminder('evening')}
              />
            </div>
          </motion.div>
        </div>
        
        <motion.div
          className="mt-8 text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Allow on the next screen to set these reminders.
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}
