
import { supabase } from '@/integrations/supabase/client';

export interface TutorialStateInfo {
  isStuck: boolean;
  currentStep: number;
  completed: boolean;
  canRecover: boolean;
  reason?: string;
}

export class TutorialStateRecovery {
  // Check if tutorial is in a problematic state
  static async checkTutorialState(userId: string): Promise<TutorialStateInfo> {
    try {
      console.log('[TutorialStateRecovery] Checking tutorial state for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('tutorial_completed, tutorial_step')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('[TutorialStateRecovery] Error fetching tutorial state:', error);
        return {
          isStuck: false,
          currentStep: 0,
          completed: false,
          canRecover: false,
          reason: 'Database error'
        };
      }
      
      const isCompleted = data?.tutorial_completed === 'YES';
      const currentStep = data?.tutorial_step || 0;
      
      // Check for stuck states
      const isStuck = !isCompleted && (
        currentStep >= 8 || // Stuck at end without completion
        currentStep === 5    // Stuck at chat step (common issue)
      );
      
      console.log('[TutorialStateRecovery] Tutorial state analysis:', {
        completed: isCompleted,
        currentStep,
        isStuck,
        tutorialCompleted: data?.tutorial_completed
      });
      
      return {
        isStuck,
        currentStep,
        completed: isCompleted,
        canRecover: isStuck,
        reason: isStuck ? `Stuck at step ${currentStep}` : undefined
      };
    } catch (error) {
      console.error('[TutorialStateRecovery] Error in checkTutorialState:', error);
      return {
        isStuck: false,
        currentStep: 0,
        completed: false,
        canRecover: false,
        reason: 'Exception occurred'
      };
    }
  }
  
  // Force complete tutorial for stuck users
  static async forceCompleteTutorial(userId: string): Promise<boolean> {
    try {
      console.log('[TutorialStateRecovery] Force completing tutorial for user:', userId);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          tutorial_completed: 'YES',
          tutorial_step: 8, // Mark as completed
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (error) {
        console.error('[TutorialStateRecovery] Error force completing tutorial:', error);
        return false;
      }
      
      console.log('[TutorialStateRecovery] Tutorial force completed successfully');
      return true;
    } catch (error) {
      console.error('[TutorialStateRecovery] Error in forceCompleteTutorial:', error);
      return false;
    }
  }
  
  // Reset tutorial to beginning
  static async resetTutorial(userId: string): Promise<boolean> {
    try {
      console.log('[TutorialStateRecovery] Resetting tutorial for user:', userId);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          tutorial_completed: 'NO',
          tutorial_step: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (error) {
        console.error('[TutorialStateRecovery] Error resetting tutorial:', error);
        return false;
      }
      
      console.log('[TutorialStateRecovery] Tutorial reset successfully');
      return true;
    } catch (error) {
      console.error('[TutorialStateRecovery] Error in resetTutorial:', error);
      return false;
    }
  }
}
