
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingContextType {
  showOnboarding: boolean;
  userName: string;
  setUserName: (name: string) => void;
  completeOnboarding: () => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  selectedFocusAreas: string[];
  toggleFocusArea: (area: string) => void;
  reminderSettings: {
    morning: boolean;
    evening: boolean;
    morningTime: string;
    eveningTime: string;
  };
  toggleReminder: (type: 'morning' | 'evening') => void;
  updateReminderTime: (type: 'morning' | 'evening', time: string) => void;
}

// Define the expected profile data structure
interface ProfileData {
  id: string;
  full_name?: string | null;
  onboarding_completed?: boolean | null;
  journal_focus_areas?: string[] | null;
  reminder_settings?: {
    morning: boolean;
    evening: boolean;
    morningTime: string;
    eveningTime: string;
  } | null;
  avatar_url?: string | null;
  created_at?: string;
  email?: string | null;
  updated_at?: string;
  [key: string]: any; // Allow for other properties
}

export const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [userName, setUserName] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [reminderSettings, setReminderSettings] = useState({
    morning: true,
    evening: true,
    morningTime: '08:00',
    eveningTime: '21:00',
  });
  
  // Check if user has completed onboarding
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        // First check localStorage as a fallback
        const localOnboardingCompleted = localStorage.getItem('soulo_onboarding_completed');
        if (localOnboardingCompleted === 'true') {
          setShowOnboarding(false);
          const localUserName = localStorage.getItem('soulo_user_name');
          if (localUserName) {
            setUserName(localUserName);
          }
          return;
        }
        
        // Then check Supabase if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Check if the profile exists
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          console.log("Profile data:", data);
          console.log("Profile error:", error);
            
          if (data) {
            // Type assertion to use our expected profile structure
            const profileData = data as ProfileData;
            
            // Look for onboarding_completed flag
            if (profileData.onboarding_completed) {
              setShowOnboarding(false);
            }
            
            // Set user name if available
            if (profileData.full_name) {
              setUserName(profileData.full_name);
            }
            
            // Set focus areas if available
            if (profileData.journal_focus_areas && Array.isArray(profileData.journal_focus_areas)) {
              setSelectedFocusAreas(profileData.journal_focus_areas);
            }
            
            // Set reminder settings if available
            if (profileData.reminder_settings) {
              setReminderSettings(prev => ({
                ...prev,
                ...profileData.reminder_settings
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      }
    };
    
    checkOnboardingStatus();
  }, []);
  
  const completeOnboarding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Update user profile with onboarding data
        const { error } = await supabase
          .from('profiles')
          .update({
            onboarding_completed: true,
            full_name: userName || user.user_metadata?.full_name || '',
            journal_focus_areas: selectedFocusAreas,
            reminder_settings: reminderSettings
          })
          .eq('id', user.id);
          
        if (error) {
          console.error('Error updating profile:', error);
        }
      }
      
      // Save to localStorage as fallback for non-authenticated users
      localStorage.setItem('soulo_onboarding_completed', 'true');
      localStorage.setItem('soulo_user_name', userName);
      
      setShowOnboarding(false);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still hide onboarding on error to avoid trapping users
      setShowOnboarding(false);
    }
  };
  
  const toggleFocusArea = (area: string) => {
    setSelectedFocusAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area) 
        : [...prev, area]
    );
  };
  
  const toggleReminder = (type: 'morning' | 'evening') => {
    setReminderSettings(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };
  
  const updateReminderTime = (type: 'morning' | 'evening', time: string) => {
    setReminderSettings(prev => ({
      ...prev,
      [`${type}Time`]: time
    }));
  };
  
  return (
    <OnboardingContext.Provider value={{
      showOnboarding,
      userName,
      setUserName,
      completeOnboarding,
      currentStep,
      setCurrentStep,
      selectedFocusAreas,
      toggleFocusArea,
      reminderSettings,
      toggleReminder,
      updateReminderTime
    }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
