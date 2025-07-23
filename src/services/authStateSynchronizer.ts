
import { supabase } from '@/integrations/supabase/client';
import { authStateManager } from './authStateManager';

interface AuthStateSyncOptions {
  forceSync?: boolean;
  debugEnabled?: boolean;
}

class AuthStateSynchronizer {
  private static instance: AuthStateSynchronizer;
  private isSyncing = false;
  private lastSyncTime = 0;
  private readonly SYNC_DEBOUNCE_MS = 1000;
  private debugEnabled = true;

  static getInstance(): AuthStateSynchronizer {
    if (!AuthStateSynchronizer.instance) {
      AuthStateSynchronizer.instance = new AuthStateSynchronizer();
    }
    return AuthStateSynchronizer.instance;
  }

  private log(message: string, data?: any) {
    if (this.debugEnabled) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
      console.log(`[AuthStateSynchronizer:${timestamp}] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.error(`[AuthStateSynchronizer:${timestamp}] ERROR: ${message}`, error || '');
  }

  public async syncOnboardingStatus(userId: string, options: AuthStateSyncOptions = {}): Promise<boolean> {
    const now = Date.now();
    
    if (this.isSyncing && !options.forceSync && (now - this.lastSyncTime) < this.SYNC_DEBOUNCE_MS) {
      this.log('Sync already in progress or debounced, skipping');
      return this.getLocalOnboardingStatus();
    }

    this.isSyncing = true;
    this.lastSyncTime = now;

    try {
      this.log('Starting comprehensive onboarding status sync', { userId, options });

      // Get comprehensive status from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, display_name, tutorial_completed, tutorial_step')
        .eq('id', userId)
        .single();

      if (error) {
        this.error('Database query failed, using localStorage fallback:', error);
        return this.getLocalOnboardingStatus();
      }

      // Determine if onboarding is truly complete
      const isOnboardingComplete = this.determineOnboardingStatus(profile);
      const localStatus = this.getLocalOnboardingStatus();

      this.log('Comprehensive status comparison:', {
        database: {
          onboarding_completed: profile?.onboarding_completed,
          tutorial_completed: profile?.tutorial_completed,
          tutorial_step: profile?.tutorial_step
        },
        computed: isOnboardingComplete,
        localStorage: localStatus,
        displayName: profile?.display_name
      });

      // If computed status and localStorage don't match, update localStorage
      if (isOnboardingComplete !== localStatus) {
        this.log('Status mismatch detected, syncing localStorage with computed status', {
          from: localStatus,
          to: isOnboardingComplete
        });
        
        localStorage.setItem('onboardingComplete', isOnboardingComplete.toString());
        
        // Sync display name if available
        if (profile?.display_name) {
          localStorage.setItem('user_display_name', profile.display_name);
        }
      }

      // Update database if computed status differs from stored onboarding_completed
      if (profile && profile.onboarding_completed !== isOnboardingComplete) {
        this.log('Updating database onboarding_completed to match computed status', {
          from: profile.onboarding_completed,
          to: isOnboardingComplete
        });
        
        await this.updateDatabaseOnboardingStatus(userId, isOnboardingComplete);
      }

      return isOnboardingComplete;

    } catch (error) {
      this.error('Sync failed with exception:', error);
      return this.getLocalOnboardingStatus();
    } finally {
      this.isSyncing = false;
    }
  }

  private determineOnboardingStatus(profile: any): boolean {
    if (!profile) return false;

    // If onboarding_completed is explicitly true, respect that
    if (profile.onboarding_completed === true) {
      return true;
    }

    // If tutorial is completed (YES), consider onboarding complete
    if (profile.tutorial_completed === 'YES') {
      this.log('Tutorial completed - considering onboarding complete');
      return true;
    }

    // If tutorial step is high enough, consider onboarding complete
    if (profile.tutorial_step >= 5) {
      this.log('Tutorial step indicates completion - considering onboarding complete', {
        tutorial_step: profile.tutorial_step
      });
      return true;
    }

    // Default to incomplete
    return false;
  }

  private getLocalOnboardingStatus(): boolean {
    return localStorage.getItem('onboardingComplete') === 'true';
  }

  private async updateDatabaseOnboardingStatus(userId: string, isComplete: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: isComplete,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        this.error('Failed to update database onboarding status:', error);
      } else {
        this.log('Successfully updated database onboarding status');
      }
    } catch (error) {
      this.error('Exception updating database onboarding status:', error);
    }
  }

  public async syncProfileData(userId: string): Promise<void> {
    try {
      this.log('Syncing profile data', { userId });

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name, onboarding_completed, tutorial_completed, tutorial_step')
        .eq('id', userId)
        .single();

      if (error) {
        this.error('Failed to sync profile data:', error);
        return;
      }

      // Determine and sync onboarding status
      const isOnboardingComplete = this.determineOnboardingStatus(profile);
      localStorage.setItem('onboardingComplete', isOnboardingComplete.toString());

      // Sync display name
      if (profile.display_name) {
        localStorage.setItem('user_display_name', profile.display_name);
      } else {
        localStorage.removeItem('user_display_name');
      }

      this.log('Profile data synced successfully', {
        ...profile,
        computed_onboarding_complete: isOnboardingComplete
      });

    } catch (error) {
      this.error('Profile sync failed:', error);
    }
  }

  public async ensureProfileExists(userId: string, userEmail?: string): Promise<void> {
    try {
      this.log('Ensuring profile exists for user', { userId, userEmail });

      const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (selectError && selectError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        this.log('Profile not found, creating new profile');

        const displayName = localStorage.getItem('user_display_name');
        const onboardingComplete = this.getLocalOnboardingStatus();

        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userEmail,
            display_name: displayName,
            onboarding_completed: onboardingComplete,
            tutorial_completed: 'NO',
            tutorial_step: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          this.error('Failed to create profile:', insertError);
        } else {
          this.log('Profile created successfully');
        }
      } else if (selectError) {
        this.error('Error checking for existing profile:', selectError);
      } else {
        this.log('Profile already exists');
      }

    } catch (error) {
      this.error('Profile creation check failed:', error);
    }
  }

  public async recoverAuthState(userId: string): Promise<{ onboardingComplete: boolean; shouldRedirect: boolean; redirectPath: string }> {
    try {
      this.log('Recovering auth state for native app restart', { userId });

      // Force sync to get latest status
      const onboardingComplete = await this.syncOnboardingStatus(userId, { forceSync: true });
      
      // Determine redirect path based on comprehensive status
      let redirectPath = '/app/home';
      let shouldRedirect = false;

      if (!onboardingComplete) {
        redirectPath = '/app/onboarding';
        shouldRedirect = true;
        this.log('Auth recovery: redirecting to onboarding');
      } else {
        this.log('Auth recovery: user ready for home');
      }

      return { onboardingComplete, shouldRedirect, redirectPath };

    } catch (error) {
      this.error('Auth state recovery failed:', error);
      return { 
        onboardingComplete: false, 
        shouldRedirect: true, 
        redirectPath: '/app/onboarding' 
      };
    }
  }

  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.log(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export const authStateSynchronizer = AuthStateSynchronizer.getInstance();
