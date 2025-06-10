
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingContextType {
  onboardingComplete: boolean | null;
  loading: boolean;
  displayName: string | null;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  saveNameToProfile: (userId: string, name: string) => Promise<void>;
  checkOnboardingStatus: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const checkOnboardingStatus = () => {
    const isComplete = localStorage.getItem('onboardingComplete') === 'true';
    setOnboardingComplete(isComplete);
    
    const name = localStorage.getItem('user_display_name');
    if (name) {
      setDisplayName(name);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setOnboardingComplete(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('onboardingComplete');
    setOnboardingComplete(false);
  };

  const saveNameToProfile = async (userId: string, name: string) => {
    if (!userId || !name) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          display_name: name,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) {
        console.error('Error saving display name to profile:', error);
      } else {
        localStorage.removeItem('user_display_name');
      }
    } catch (error) {
      console.error('Error in saving display name:', error);
    }
  };

  return (
    <OnboardingContext.Provider value={{
      onboardingComplete,
      loading,
      displayName,
      completeOnboarding,
      resetOnboarding,
      saveNameToProfile,
      checkOnboardingStatus
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
