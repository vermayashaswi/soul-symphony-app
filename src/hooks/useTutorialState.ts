
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useTutorialState = () => {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);

  // Check tutorial status from database
  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!user || tutorialChecked) return;
      
      try {
        console.log('[TutorialState] Checking tutorial status for user:', user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('[TutorialState] Error fetching tutorial status:', error);
          setTutorialChecked(true);
          return;
        }
        
        const isCompleted = data?.tutorial_completed === 'YES';
        const startingStep = data?.tutorial_step || 0;
        
        console.log('[TutorialState] Tutorial status:', { isCompleted, startingStep });
        
        setCurrentStep(startingStep);
        setTutorialCompleted(isCompleted);
        setTutorialChecked(true);
      } catch (error) {
        console.error('[TutorialState] Error in tutorial check:', error);
        setTutorialChecked(true);
      }
    };
    
    checkTutorialStatus();
  }, [user, tutorialChecked]);

  return {
    isActive,
    setIsActive,
    currentStep,
    setCurrentStep,
    tutorialCompleted,
    setTutorialCompleted,
    tutorialChecked,
    setTutorialChecked
  };
};
