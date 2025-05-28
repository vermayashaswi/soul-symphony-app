
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export class SubscriptionService {
  private static instance: SubscriptionService;
  private checkInterval: NodeJS.Timeout | null = null;

  public static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  public startTrialExpiryMonitoring(userId: string): void {
    // Clear any existing interval
    this.stopTrialExpiryMonitoring();

    // Check every hour for trial expiry
    this.checkInterval = setInterval(async () => {
      await this.checkTrialExpiry(userId);
    }, 60 * 60 * 1000); // 1 hour

    // Also check immediately
    this.checkTrialExpiry(userId);
  }

  public stopTrialExpiryMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkTrialExpiry(userId: string): Promise<void> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at, is_premium')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        console.error('Error checking trial expiry:', error);
        return;
      }

      if (profile.subscription_status === 'trial' && profile.trial_ends_at) {
        const trialEndDate = new Date(profile.trial_ends_at);
        const now = new Date();
        const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Show warning notifications
        if (daysRemaining === 3) {
          toast.warning('Your free trial expires in 3 days. Upgrade to continue accessing premium features.');
        } else if (daysRemaining === 1) {
          toast.warning('Your free trial expires tomorrow. Upgrade now to avoid losing access.');
        } else if (daysRemaining <= 0) {
          // Trial has expired, update the profile
          await this.handleTrialExpiry(userId);
        }
      }
    } catch (error) {
      console.error('Error in trial expiry check:', error);
    }
  }

  private async handleTrialExpiry(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'expired',
          is_premium: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating expired trial:', error);
      } else {
        toast.error('Your free trial has expired. Upgrade to continue accessing premium features.');
      }
    } catch (error) {
      console.error('Error handling trial expiry:', error);
    }
  }

  public async activateTrial(userId: string): Promise<boolean> {
    try {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days from now

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          subscription_status: 'trial',
          trial_ends_at: trialEndDate.toISOString(),
          is_premium: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error activating trial:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in trial activation:', error);
      return false;
    }
  }
}

// Initialize subscription service when user logs in
export const initializeSubscriptionService = (userId: string) => {
  const service = SubscriptionService.getInstance();
  service.startTrialExpiryMonitoring(userId);
};

// Cleanup subscription service when user logs out
export const cleanupSubscriptionService = () => {
  const service = SubscriptionService.getInstance();
  service.stopTrialExpiryMonitoring();
};
