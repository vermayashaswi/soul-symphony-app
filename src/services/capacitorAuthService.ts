import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from './nativeIntegrationService';
import { toast } from 'sonner';

/**
 * Capacitor-specific authentication service for handling auth state debugging
 * and session validation issues that cause message saving failures
 */
class CapacitorAuthService {
  private static instance: CapacitorAuthService;
  private sessionCheckInterval: NodeJS.Timeout | null = null;

  static getInstance(): CapacitorAuthService {
    if (!CapacitorAuthService.instance) {
      CapacitorAuthService.instance = new CapacitorAuthService();
    }
    return CapacitorAuthService.instance;
  }

  /**
   * Enhanced session debugging for Capacitor environment
   */
  async debugSessionState(): Promise<void> {
    const isNative = nativeIntegrationService.isRunningNatively();
    console.log('[CapacitorAuth] Session Debug - Environment:', { isNative });

    try {
      // Check Supabase session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('[CapacitorAuth] Session Debug - Supabase Session:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAccessToken: !!session?.access_token,
        expiresAt: session?.expires_at,
        isExpired: session?.expires_at ? session.expires_at * 1000 < Date.now() : 'unknown',
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        error: error?.message
      });

      // Check localStorage session (for Capacitor WebView)
      if (isNative) {
        const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
        console.log('[CapacitorAuth] Session Debug - LocalStorage:', {
          hasStoredSession: !!storedSession,
          storedSessionSize: storedSession?.length || 0
        });

        if (storedSession) {
          try {
            const parsed = JSON.parse(storedSession);
            console.log('[CapacitorAuth] Session Debug - Parsed Storage:', {
              hasAccessToken: !!parsed.access_token,
              hasRefreshToken: !!parsed.refresh_token,
              expiresAt: parsed.expires_at,
              isStoredExpired: parsed.expires_at ? parsed.expires_at < Date.now() / 1000 : 'unknown'
            });
          } catch (parseError) {
            console.error('[CapacitorAuth] Session Debug - Failed to parse stored session:', parseError);
          }
        }
      }

      // Test RLS access
      await this.testRLSAccess();

    } catch (error) {
      console.error('[CapacitorAuth] Session Debug - Error:', error);
    }
  }

  /**
   * Test RLS access to verify auth.uid() is working
   */
  private async testRLSAccess(): Promise<void> {
    try {
      // Test with chat_threads table (requires auth.uid())
      const { data, error } = await supabase
        .from('chat_threads')
        .select('id')
        .limit(1);

      console.log('[CapacitorAuth] RLS Test - chat_threads:', {
        success: !error,
        hasData: !!data,
        dataLength: data?.length || 0,
        error: error?.message,
        errorCode: error?.code
      });

      // Test with profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      console.log('[CapacitorAuth] RLS Test - profiles:', {
        success: !profileError,
        hasData: !!profileData,
        dataLength: profileData?.length || 0,
        error: profileError?.message,
        errorCode: profileError?.code
      });

    } catch (error) {
      console.error('[CapacitorAuth] RLS Test - Exception:', error);
    }
  }

  /**
   * Validate session and retry authentication if needed
   */
  async validateSessionOrRetry(): Promise<boolean> {
    try {
      console.log('[CapacitorAuth] Validating session...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[CapacitorAuth] Session validation error:', error);
        return false;
      }

      if (!session?.user || !session?.access_token) {
        console.warn('[CapacitorAuth] No valid session found');
        return false;
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        console.warn('[CapacitorAuth] Session is expired, attempting refresh');
        
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('[CapacitorAuth] Session refresh failed:', refreshError);
          return false;
        }

        console.log('[CapacitorAuth] Session refreshed successfully');
        return !!refreshData.session;
      }

      console.log('[CapacitorAuth] Session is valid');
      return true;
      
    } catch (error) {
      console.error('[CapacitorAuth] Session validation exception:', error);
      return false;
    }
  }

  /**
   * Enhanced message saving with auth retry logic
   */
  async saveMessageWithRetry(
    saveFunction: () => Promise<any>,
    maxRetries: number = 2
  ): Promise<any> {
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        // Validate session before attempting save
        const isValidSession = await this.validateSessionOrRetry();
        
        if (!isValidSession) {
          throw new Error('Authentication session is invalid or expired');
        }

        // Attempt to save message
        const result = await saveFunction();
        
        if (result) {
          console.log('[CapacitorAuth] Message saved successfully on attempt:', attempt + 1);
          return result;
        }
        
        throw new Error('Save function returned null/undefined');
        
      } catch (error: any) {
        attempt++;
        console.error(`[CapacitorAuth] Save attempt ${attempt} failed:`, error);
        
        // Check if it's an RLS error
        if (this.isRLSError(error)) {
          console.error('[CapacitorAuth] RLS policy violation detected - authentication issue');
          
          if (attempt < maxRetries) {
            console.log('[CapacitorAuth] Retrying with session refresh...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            continue;
          }
          
          toast.error('Failed to save message: Authentication required. Please sign in again.');
          throw new Error('Authentication required');
        }
        
        // For other errors, don't retry
        if (attempt >= maxRetries) {
          toast.error('Failed to save message. Please try again.');
          throw error;
        }
      }
    }
    
    throw new Error('Max retry attempts reached');
  }

  /**
   * Check if error is related to RLS policy violation
   */
  private isRLSError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || '';
    
    return (
      errorMessage.includes('row-level security') ||
      errorMessage.includes('policy') ||
      errorMessage.includes('permission denied') ||
      errorCode === 'PGRST116' || // PostgREST policy violation
      errorCode === '42501' // PostgreSQL insufficient privilege
    );
  }

  /**
   * Start periodic session monitoring for Capacitor apps
   */
  startSessionMonitoring(): void {
    if (!nativeIntegrationService.isRunningNatively()) {
      console.log('[CapacitorAuth] Not running natively - skipping session monitoring');
      return;
    }

    // Clear existing interval
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }

    console.log('[CapacitorAuth] Starting session monitoring for Capacitor app');
    
    // Check session every 5 minutes
    this.sessionCheckInterval = setInterval(async () => {
      console.log('[CapacitorAuth] Periodic session check...');
      await this.debugSessionState();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop session monitoring
   */
  stopSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
      console.log('[CapacitorAuth] Session monitoring stopped');
    }
  }

  /**
   * Initialize Capacitor-specific auth handling
   */
  async initialize(): Promise<void> {
    console.log('[CapacitorAuth] Initializing Capacitor auth service');
    
    // Debug current session state
    await this.debugSessionState();
    
    // Start monitoring for native apps
    if (nativeIntegrationService.isRunningNatively()) {
      this.startSessionMonitoring();
    }
  }
}

export const capacitorAuthService = CapacitorAuthService.getInstance();