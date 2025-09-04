
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
      return localStorage.getItem('onboardingComplete') === 'true';
    }

    this.isSyncing = true;
    this.lastSyncTime = now;

    try {
      this.log('Starting onboarding status sync', { userId, options });

      // Get status from database (authoritative source)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, display_name')
        .eq('id', userId)
        .single();

      if (error) {
        this.error('Database query failed, using localStorage fallback:', error);
        return localStorage.getItem('onboardingComplete') === 'true';
      }

      const dbStatus = profile?.onboarding_completed || false;
      const localStatus = localStorage.getItem('onboardingComplete') === 'true';

      this.log('Status comparison:', {
        database: dbStatus,
        localStorage: localStatus,
        displayName: profile?.display_name
      });

      // If database and localStorage don't match, database wins
      if (dbStatus !== localStatus) {
        this.log('Status mismatch detected, syncing localStorage with database', {
          from: localStatus,
          to: dbStatus
        });
        
        localStorage.setItem('onboardingComplete', dbStatus.toString());
        
        // Sync display name if available
        if (profile?.display_name) {
          localStorage.setItem('user_display_name', profile.display_name);
        }
      }

      return dbStatus;

    } catch (error) {
      this.error('Sync failed with exception:', error);
      // Fallback to localStorage in case of network issues
      return localStorage.getItem('onboardingComplete') === 'true';
    } finally {
      this.isSyncing = false;
    }
  }

  public async syncProfileData(userId: string): Promise<void> {
    try {
      this.log('Syncing profile data', { userId });

      // RLS policies ensure user can only access their own profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name, onboarding_completed')
        .eq('id', userId)
        .single();

      if (error) {
        this.error('Failed to sync profile data:', error);
        return;
      }

      // Sync onboarding status
      if (profile.onboarding_completed !== undefined) {
        localStorage.setItem('onboardingComplete', profile.onboarding_completed.toString());
      }

      // Sync display name
      if (profile.display_name) {
        localStorage.setItem('user_display_name', profile.display_name);
      } else {
        localStorage.removeItem('user_display_name');
      }

      this.log('Profile data synced successfully', profile);

    } catch (error) {
      this.error('Profile sync failed:', error);
    }
  }

  public async ensureProfileExists(userId: string, userEmail?: string): Promise<void> {
    try {
      this.log('Ensuring profile exists for user', { userId, userEmail });

      // RLS policies ensure user can only access their own profile
      const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (selectError && selectError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        this.log('Profile not found, creating new profile');

        const displayName = localStorage.getItem('user_display_name');
        const onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';

        // RLS policies ensure user can only insert their own profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userEmail,
            display_name: displayName,
            onboarding_completed: onboardingComplete,
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

  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.log(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export const authStateSynchronizer = AuthStateSynchronizer.getInstance();
