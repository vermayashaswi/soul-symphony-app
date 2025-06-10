
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logInfo, logError, logProfile, logAuthError } from '@/components/debug/DebugPanel';
import { sessionManager } from './sessionManager';

/**
 * Enhanced profile service with improved error handling and session management
 */
export class EnhancedProfileService {
  private static instance: EnhancedProfileService;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 1000;
  private profileCreationInProgress = new Set<string>();

  private constructor() {}

  static getInstance(): EnhancedProfileService {
    if (!EnhancedProfileService.instance) {
      EnhancedProfileService.instance = new EnhancedProfileService();
    }
    return EnhancedProfileService.instance;
  }

  /**
   * Ensures profile exists with enhanced session validation and error recovery
   */
  async ensureProfileExists(user: User | null): Promise<{ success: boolean; error?: string }> {
    if (!user) {
      return { success: false, error: 'No user provided' };
    }

    // Prevent concurrent profile creation for the same user
    if (this.profileCreationInProgress.has(user.id)) {
      logProfile(`Profile creation already in progress for user: ${user.id}`, 'EnhancedProfileService');
      return { success: false, error: 'Profile creation already in progress' };
    }

    try {
      this.profileCreationInProgress.add(user.id);
      
      // Validate session before attempting profile operations
      const { session, refreshed } = await sessionManager.validateAndRefreshSession();
      
      if (!session) {
        logAuthError('No valid session available for profile creation', 'EnhancedProfileService');
        return { success: false, error: 'Invalid or expired session' };
      }

      if (refreshed) {
        logProfile('Session was refreshed before profile creation', 'EnhancedProfileService');
      }

      // Check if profile already exists
      const existingProfile = await this.checkProfileExists(user.id);
      if (existingProfile.exists) {
        logProfile(`Profile already exists for user: ${user.id}`, 'EnhancedProfileService');
        return { success: true };
      }

      // Create profile with retry logic
      return await this.createProfileWithRetry(user);
      
    } catch (error: any) {
      logAuthError(`Error in ensureProfileExists: ${error.message}`, 'EnhancedProfileService', error);
      return { success: false, error: error.message };
    } finally {
      this.profileCreationInProgress.delete(user.id);
    }
  }

  /**
   * Check if profile exists with error handling
   */
  private async checkProfileExists(userId: string): Promise<{ exists: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logError(`Error checking profile existence: ${error.message}`, 'EnhancedProfileService', error);
        return { exists: false, error: error.message };
      }

      return { exists: !!data };
    } catch (error: any) {
      logError(`Exception checking profile existence: ${error.message}`, 'EnhancedProfileService', error);
      return { exists: false, error: error.message };
    }
  }

  /**
   * Create profile with retry logic and enhanced error handling
   */
  private async createProfileWithRetry(user: User): Promise<{ success: boolean; error?: string }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        logProfile(`Profile creation attempt ${attempt}/${this.MAX_RETRIES} for user: ${user.id}`, 'EnhancedProfileService');

        // Validate session before each attempt
        const sessionState = await sessionManager.getSessionState();
        if (!sessionState.session || sessionState.isExpired) {
          logAuthError(`Session invalid on attempt ${attempt}`, 'EnhancedProfileService');
          
          // Try to refresh session
          const refreshedSession = await sessionManager.refreshSession();
          if (!refreshedSession) {
            return { success: false, error: 'Unable to maintain valid session for profile creation' };
          }
        }

        const result = await this.createProfile(user);
        if (result.success) {
          logProfile(`Profile created successfully on attempt ${attempt}`, 'EnhancedProfileService');
          return result;
        }

        lastError = new Error(result.error || 'Unknown error');
        
        // Check if this is a retryable error
        if (!this.isRetryableError(result.error)) {
          logProfile(`Non-retryable error on attempt ${attempt}: ${result.error}`, 'EnhancedProfileService');
          break;
        }

        // Wait before retrying with exponential backoff
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          logProfile(`Waiting ${delay}ms before retry ${attempt + 1}`, 'EnhancedProfileService');
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error: any) {
        lastError = error;
        logError(`Profile creation attempt ${attempt} failed: ${error.message}`, 'EnhancedProfileService', error);
        
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return { 
      success: false, 
      error: lastError?.message || 'Profile creation failed after all retries' 
    };
  }

  /**
   * Create profile with enhanced metadata extraction
   */
  private async createProfile(user: User): Promise<{ success: boolean; error?: string }> {
    try {
      const timezone = this.getUserTimezone();
      const profileData = this.extractProfileData(user, timezone);

      logProfile('Creating profile with data', 'EnhancedProfileService', profileData);

      const { error } = await supabase
        .from('profiles')
        .upsert([profileData], { 
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        // Check for constraint violations that indicate profile already exists
        if (error.code === '23505') {
          logProfile('Profile already exists (detected via constraint)', 'EnhancedProfileService');
          return { success: true };
        }
        
        logError(`Database error creating profile: ${error.message}`, 'EnhancedProfileService', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      logError(`Exception creating profile: ${error.message}`, 'EnhancedProfileService', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract profile data from user with enhanced provider handling
   */
  private extractProfileData(user: User, timezone: string): any {
    const email = user.email || '';
    let fullName = '';
    let avatarUrl = '';

    // Enhanced metadata extraction for different auth providers
    if (user.app_metadata?.provider === 'google') {
      fullName = user.user_metadata?.name || 
                user.user_metadata?.full_name ||
                `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
      
      avatarUrl = user.user_metadata?.picture || 
                 user.user_metadata?.avatar_url || 
                 '';
    } else {
      fullName = user.user_metadata?.full_name || 
                user.user_metadata?.name ||
                `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
      
      avatarUrl = user.user_metadata?.avatar_url || 
                 user.user_metadata?.picture || 
                 '';
    }

    return {
      id: user.id,
      email,
      full_name: fullName || null,
      avatar_url: avatarUrl || null,
      timezone: timezone,
      onboarding_completed: false,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Get user timezone with fallback
   */
  private getUserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      logError('Error detecting timezone, using UTC', 'EnhancedProfileService', error);
      return 'UTC';
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error?: string): boolean {
    if (!error) return false;
    
    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'server error',
      'internal error',
      'service temporarily unavailable',
      'rate limit'
    ];

    const errorLower = error.toLowerCase();
    return retryableErrors.some(retryableError => errorLower.includes(retryableError));
  }

  /**
   * Update profile with session validation
   */
  async updateProfile(userId: string, updates: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate session before update
      const { session } = await sessionManager.validateAndRefreshSession();
      if (!session) {
        return { success: false, error: 'Invalid session for profile update' };
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logError(`Error updating profile: ${error.message}`, 'EnhancedProfileService', error);
        return { success: false, error: error.message };
      }

      logProfile('Profile updated successfully', 'EnhancedProfileService');
      return { success: true };
    } catch (error: any) {
      logError(`Exception updating profile: ${error.message}`, 'EnhancedProfileService', error);
      return { success: false, error: error.message };
    }
  }
}

export const enhancedProfileService = EnhancedProfileService.getInstance();
