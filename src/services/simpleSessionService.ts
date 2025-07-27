import { supabase } from '@/integrations/supabase/client';

interface SimpleSessionData {
  userId: string;
  deviceType?: string;
  entryPage?: string;
}

/**
 * Simplified session service for native app compatibility
 */
export class SimpleSessionService {
  private static instance: SimpleSessionService;

  static getInstance(): SimpleSessionService {
    if (!SimpleSessionService.instance) {
      SimpleSessionService.instance = new SimpleSessionService();
    }
    return SimpleSessionService.instance;
  }

  /**
   * Create a simple session for the user
   */
  async createSession(data: SimpleSessionData): Promise<string | null> {
    try {
      const { data: session, error } = await supabase
        .rpc('simple_session_manager', {
          p_user_id: data.userId,
          p_device_type: data.deviceType || 'unknown',
          p_entry_page: data.entryPage || '/'
        });

      if (error) {
        console.error('[SimpleSessionService] Failed to create session:', error);
        return null;
      }

      console.log('[SimpleSessionService] Session created:', session);
      return session;
    } catch (error) {
      console.error('[SimpleSessionService] Error creating session:', error);
      return null;
    }
  }

  /**
   * Update session activity (simplified)
   */
  async updateActivity(userId: string): Promise<void> {
    try {
      await supabase
        .from('user_sessions')
        .update({ 
          last_activity: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);
    } catch (error) {
      console.error('[SimpleSessionService] Error updating activity:', error);
    }
  }

  /**
   * End user session
   */
  async endSession(userId: string): Promise<void> {
    try {
      await supabase
        .from('user_sessions')
        .update({ 
          is_active: false,
          session_end: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);
    } catch (error) {
      console.error('[SimpleSessionService] Error ending session:', error);
    }
  }
}

export const simpleSessionService = SimpleSessionService.getInstance();