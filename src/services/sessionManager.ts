import { supabase } from "@/integrations/supabase/client";

export interface SessionState {
  id: string;
  userId: string;
  isActive: boolean;
  startTime: Date;
  lastActivity: Date;
  state: string;
  pageViews: number;
  qualityScore: number;
}

export interface SessionMetrics {
  totalSessions: number;
  avgSessionDuration: number;
  pageViews: number;
  bounceRate: number;
  duration: number;
  foregroundTime: number;
  backgroundTime: number;
  appLaunchCount: number;
}

class SessionManager {
  private currentSessionId: string | null = null;
  private debugEnabled: boolean = false;
  private isInitialized: boolean = false;

  private log(message: string, data?: any) {
    if (this.debugEnabled) {
      console.log(`[SessionManager] ${message}`, data || '');
    }
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.log('Debug mode enabled');
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
    this.log('Session manager initialized');
  }

  async startSession(userId?: string, deviceInfo?: any): Promise<SessionState | null> {
    try {
      if (!userId) {
        this.log('No user ID provided for session start');
        return null;
      }

      this.log('Starting session for user', { userId, deviceInfo });

      // Use the safer session manager function with error handling
      const { data: result, error } = await supabase.rpc('safe_session_manager', {
        p_user_id: userId,
        p_device_type: deviceInfo?.platform || 'web',
        p_entry_page: deviceInfo?.entryPage || window.location.pathname
      });

      if (error) {
        console.error('[SessionManager] Session creation failed with error:', error);
        // Fallback to direct insertion if RPC fails
        return await this.createSessionFallback(userId, deviceInfo);
      }

      // Type assertion for the RPC response
      const sessionResult = result as { success: boolean; session_id?: string; error?: string } | null;

      if (!sessionResult?.success) {
        this.log('Session creation unsuccessful:', sessionResult);
        return await this.createSessionFallback(userId, deviceInfo);
      }

      if (!sessionResult.session_id) {
        this.log('No session ID returned from successful creation');
        return await this.createSessionFallback(userId, deviceInfo);
      }

      this.currentSessionId = sessionResult.session_id;
      this.log('Session created successfully', { sessionId: sessionResult.session_id });

      // Return session state
      return {
        id: sessionResult.session_id,
        userId,
        isActive: true,
        startTime: new Date(),
        lastActivity: new Date(),
        state: 'active',
        pageViews: 1,
        qualityScore: 0
      };
    } catch (error) {
      console.error('[SessionManager] Error in startSession:', error);
      
      // Try fallback session creation
      if (userId) {
        return await this.createSessionFallback(userId, deviceInfo);
      }
      
      return null;
    }
  }

  private async createSessionFallback(userId: string, deviceInfo?: any): Promise<SessionState | null> {
    try {
      this.log('Using fallback session creation for user:', userId);
      
      // Simple direct insertion as fallback
      const { data: session, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          device_type: deviceInfo?.platform || 'web',
          entry_page: deviceInfo?.entryPage || window.location.pathname,
          last_activity: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[SessionManager] Fallback session creation failed:', error);
        return null;
      }

      this.currentSessionId = session.id;
      this.log('Fallback session created:', session.id);

      return {
        id: session.id,
        userId: session.user_id,
        isActive: true,
        startTime: new Date(session.session_start),
        lastActivity: new Date(session.last_activity),
        state: 'active',
        pageViews: session.page_views || 1,
        qualityScore: 0
      };
    } catch (error) {
      console.error('[SessionManager] Fallback session creation error:', error);
      return null;
    }
  }

  async getCurrentSession(): Promise<SessionState | null> {
    try {
      if (!this.currentSessionId) {
        return null;
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return null;
      }

      // Get current session from database
      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('id', this.currentSessionId)
        .eq('user_id', user.user.id)
        .eq('is_active', true)
        .single();

      if (error || !session) {
        this.log('No active session found');
        this.currentSessionId = null;
        return null;
      }

      return {
        id: session.id,
        userId: session.user_id,
        isActive: session.is_active,
        startTime: new Date(session.session_start),
        lastActivity: new Date(session.last_activity),
        state: session.is_active ? 'active' : 'inactive',
        pageViews: session.page_views || 1,
        qualityScore: 0
      };
    } catch (error) {
      console.error('[SessionManager] Error getting current session:', error);
      return null;
    }
  }

  async terminateSession(): Promise<void> {
    try {
      if (!this.currentSessionId) {
        this.log('No active session to terminate');
        return;
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return;
      }

      this.log('Terminating session', { sessionId: this.currentSessionId });

      // Close the session using the close_user_session function
      const { data: success, error } = await supabase.rpc('close_user_session', {
        p_session_id: this.currentSessionId,
        p_user_id: user.user.id
      });

      if (error) {
        console.error('[SessionManager] Error terminating session:', error);
      } else {
        this.log('Session terminated successfully', { success });
      }

      this.currentSessionId = null;
    } catch (error) {
      console.error('[SessionManager] Error in terminateSession:', error);
    }
  }

  async recordActivity(): Promise<void> {
    try {
      if (!this.currentSessionId) {
        return;
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return;
      }

      // Update last activity timestamp
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          session_timeout: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes from now
        })
        .eq('id', this.currentSessionId)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('[SessionManager] Error recording activity:', error);
      }
    } catch (error) {
      console.error('[SessionManager] Error in recordActivity:', error);
    }
  }

  async trackPageView(path?: string): Promise<void> {
    try {
      if (!this.currentSessionId) {
        return;
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return;
      }

      this.log('Tracking page view', { path, sessionId: this.currentSessionId });

      // Get current page views first, then increment
      const { data: currentSession } = await supabase
        .from('user_sessions')
        .select('page_views')
        .eq('id', this.currentSessionId)
        .eq('user_id', user.user.id)
        .single();

      const currentPageViews = currentSession?.page_views || 0;

      // Update page views and current page
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          page_views: currentPageViews + 1,
          last_active_page: path || window.location.pathname,
          last_activity: new Date().toISOString()
        })
        .eq('id', this.currentSessionId)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('[SessionManager] Error tracking page view:', error);
      }
    } catch (error) {
      console.error('[SessionManager] Error in trackPageView:', error);
    }
  }

  async getSessionMetrics(): Promise<SessionMetrics | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return null;
      }

      // Get session metrics for the user
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.user.id);

      if (error) {
        console.error('[SessionManager] Error getting session metrics:', error);
        return null;
      }

      if (!sessions || sessions.length === 0) {
        return {
          totalSessions: 0,
          avgSessionDuration: 0,
          pageViews: 0,
          bounceRate: 0,
          duration: 0,
          foregroundTime: 0,
          backgroundTime: 0,
          appLaunchCount: 0
        };
      }

      const totalSessions = sessions.length;
      const totalPageViews = sessions.reduce((sum, s) => sum + (s.page_views || 0), 0);
      const activeSessions = sessions.filter(s => s.is_active);
      
      // Calculate average session duration for completed sessions
      const completedSessions = sessions.filter(s => !s.is_active && s.session_end);
      const avgDuration = completedSessions.length > 0 
        ? completedSessions.reduce((sum, s) => {
            const start = new Date(s.session_start).getTime();
            const end = new Date(s.session_end).getTime();
            return sum + (end - start);
          }, 0) / completedSessions.length
        : 0;

      return {
        totalSessions,
        avgSessionDuration: avgDuration / 1000, // Convert to seconds
        pageViews: totalPageViews,
        bounceRate: sessions.filter(s => (s.page_views || 0) <= 1).length / totalSessions,
        duration: avgDuration / 1000,
        foregroundTime: avgDuration / 1000,
        backgroundTime: 0,
        appLaunchCount: totalSessions
      };
    } catch (error) {
      console.error('[SessionManager] Error getting session metrics:', error);
      return null;
    }
  }

  async recordError(error?: any): Promise<void> {
    try {
      this.log('Recording error', { error });
      
      if (!this.currentSessionId) {
        return;
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return;
      }

      // Record error in auth_errors table
      const { error: insertError } = await supabase
        .from('auth_errors')
        .insert({
          user_id: user.user.id,
          error_type: 'session_error',
          error_message: error?.message || 'Unknown session error',
          context: JSON.stringify({ sessionId: this.currentSessionId, error })
        });

      if (insertError) {
        console.error('[SessionManager] Error recording error:', insertError);
      }
    } catch (err) {
      console.error('[SessionManager] Error in recordError:', err);
    }
  }

  async recordCrash(): Promise<void> {
    try {
      this.log('Recording crash');
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return;
      }

      // Record crash in auth_errors table
      const { error } = await supabase
        .from('auth_errors')
        .insert({
          user_id: user.user.id,
          error_type: 'app_crash',
          error_message: 'Application crash detected',
          context: JSON.stringify({ sessionId: this.currentSessionId, timestamp: new Date().toISOString() })
        });

      if (error) {
        console.error('[SessionManager] Error recording crash:', error);
      }

      // Also terminate the current session
      await this.terminateSession();
    } catch (error) {
      console.error('[SessionManager] Error in recordCrash:', error);
    }
  }

  // Legacy methods for compatibility
  async createSession(): Promise<SessionState | null> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return null;
    
    return this.startSession(user.user.id);
  }

  async endSession(): Promise<void> {
    await this.terminateSession();
  }
}

export const sessionManager = new SessionManager();