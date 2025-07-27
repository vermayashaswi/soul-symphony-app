import { supabase } from '@/integrations/supabase/client';

export interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  averagePageViews: number;
  averageQualityScore: number;
  deviceBreakdown: Record<string, number>;
  platformBreakdown: Record<string, number>;
  sessionStates: Record<string, number>;
  conversionEvents: Array<{
    type: string;
    count: number;
    averageSessionDuration: number;
  }>;
}

export interface SessionTrend {
  date: string;
  sessionCount: number;
  averageDuration: number;
  averageQualityScore: number;
  uniqueUsers: number;
}

export class SessionAnalyticsService {
  /**
   * Get comprehensive session analytics for a user
   */
  static async getUserSessionAnalytics(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<SessionAnalytics | null> {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate || new Date();

      // Get session summary data - simplified columns only
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select(`
          id,
          device_type,
          platform,
          is_active,
          page_views,
          created_at,
          last_activity,
          session_start,
          session_end
        `)
        .eq('user_id', userId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (sessionsError || !sessions) {
        console.error('Error fetching session analytics:', sessionsError);
        return null;
      }

      // Calculate analytics - simplified
      const totalSessions = sessions.length;
      const activeSessions = sessions.filter(s => s.is_active).length;

      // Calculate average session duration (in minutes) from start/end times
      const sessionsWithDuration = sessions.filter(s => s.session_end && s.session_start);
      const averageSessionDuration = sessionsWithDuration.length > 0
        ? sessionsWithDuration.reduce((sum, s) => {
            const start = new Date(s.session_start).getTime();
            const end = new Date(s.session_end).getTime();
            return sum + (end - start);
          }, 0) / sessionsWithDuration.length / 60000 // Convert to minutes
        : 0;

      // Calculate other averages
      const averagePageViews = sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.page_views || 1), 0) / sessions.length
        : 0;

      // Default quality score since we removed the complex calculation
      const averageQualityScore = 3.0;

      // Device and platform breakdowns
      const deviceBreakdown = this.groupByField(sessions, 'device_type');
      const platformBreakdown = this.groupByField(sessions, 'platform');
      const sessionStates = { 'active': activeSessions, 'inactive': totalSessions - activeSessions };

      // Simplified conversion events (no complex tracking for now)
      const conversionEvents: Array<{ type: string; count: number; averageSessionDuration: number; }> = [];

      return {
        totalSessions,
        activeSessions,
        averageSessionDuration,
        averagePageViews,
        averageQualityScore,
        deviceBreakdown,
        platformBreakdown,
        sessionStates,
        conversionEvents
      };

    } catch (error) {
      console.error('Exception in getUserSessionAnalytics:', error);
      return null;
    }
  }

  /**
   * Get session trends over time
   */
  static async getSessionTrends(
    userId: string,
    days: number = 30
  ): Promise<SessionTrend[]> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select(`
          created_at,
          session_start,
          session_end,
          user_id
        `)
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error || !sessions) {
        console.error('Error fetching session trends:', error);
        return [];
      }

      // Group sessions by date
      const sessionsByDate = new Map<string, any[]>();
      
      sessions.forEach(session => {
        const date = new Date(session.created_at).toISOString().split('T')[0];
        if (!sessionsByDate.has(date)) {
          sessionsByDate.set(date, []);
        }
        sessionsByDate.get(date)!.push(session);
      });

      // Calculate trends
      const trends: SessionTrend[] = [];
      
      for (const [date, dateSessions] of sessionsByDate) {
        const sessionCount = dateSessions.length;
        const uniqueUsers = new Set(dateSessions.map(s => s.user_id)).size;
        
        const sessionsWithDuration = dateSessions.filter(s => s.session_end && s.session_start);
        const averageDuration = sessionsWithDuration.length > 0
          ? sessionsWithDuration.reduce((sum, s) => {
              const start = new Date(s.session_start).getTime();
              const end = new Date(s.session_end).getTime();
              return sum + (end - start);
            }, 0) / sessionsWithDuration.length / 60000 // Convert to minutes
          : 0;

        // Default quality score since we removed the complex calculation
        const averageQualityScore = 3.0;

        trends.push({
          date,
          sessionCount,
          averageDuration,
          averageQualityScore,
          uniqueUsers
        });
      }

      return trends.sort((a, b) => a.date.localeCompare(b.date));

    } catch (error) {
      console.error('Exception in getSessionTrends:', error);
      return [];
    }
  }

  /**
   * Get real-time session monitoring data
   */
  static async getActiveSessionsMonitoring(): Promise<{
    activeSessions: number;
    averageSessionDuration: number;
    topPages: Array<{ page: string; count: number }>;
    deviceTypes: Record<string, number>;
    qualityDistribution: Record<string, number>;
  } | null> {
    try {
      const { data: activeSessions, error } = await supabase
        .from('user_sessions')
        .select(`
          last_active_page,
          device_type,
          session_start,
          session_end
        `)
        .eq('is_active', true);

      if (error || !activeSessions) {
        console.error('Error fetching active sessions:', error);
        return null;
      }

      // Calculate metrics
      const totalActiveSessions = activeSessions.length;
      
      const averageSessionDuration = activeSessions.length > 0
        ? activeSessions.reduce((sum, s) => {
            const duration = s.session_end 
              ? new Date(s.session_end).getTime() - new Date(s.session_start).getTime()
              : Date.now() - new Date(s.session_start).getTime();
            return sum + duration;
          }, 0) / activeSessions.length / 60000 // Convert to minutes
        : 0;

      // Top pages
      const pageCount = new Map<string, number>();
      activeSessions.forEach(s => {
        const page = s.last_active_page || 'unknown';
        pageCount.set(page, (pageCount.get(page) || 0) + 1);
      });
      
      const topPages = Array.from(pageCount.entries())
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Device types
      const deviceTypes = this.groupByField(activeSessions, 'device_type');

      // Simplified quality distribution (default good quality)
      const qualityDistribution: Record<string, number> = {
        'Poor (0-2)': 0,
        'Fair (2-3)': 0,
        'Good (3-4)': activeSessions.length,
        'Excellent (4-5)': 0
      };

      return {
        activeSessions: totalActiveSessions,
        averageSessionDuration,
        topPages,
        deviceTypes,
        qualityDistribution
      };

    } catch (error) {
      console.error('Exception in getActiveSessionsMonitoring:', error);
      return null;
    }
  }

  /**
   * Helper: Convert PostgreSQL interval to milliseconds
   */
  private static intervalToMilliseconds(interval: string): number {
    if (!interval) return 0;
    
    // Parse PostgreSQL interval format (e.g., "01:23:45.123456")
    const parts = interval.split(':');
    if (parts.length >= 3) {
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      
      return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
    }
    
    return 0;
  }

  /**
   * Helper: Group array by field value
   */
  private static groupByField(items: any[], field: string): Record<string, number> {
    const groups: Record<string, number> = {};
    
    items.forEach(item => {
      const value = item[field] || 'unknown';
      groups[value] = (groups[value] || 0) + 1;
    });
    
    return groups;
  }

  /**
   * Helper: Analyze conversion events from sessions
   */
  private static analyzeConversionEvents(sessions: any[]): Array<{
    type: string;
    count: number;
    averageSessionDuration: number;
  }> {
    const eventMap = new Map<string, { count: number; totalDuration: number }>();
    
    sessions.forEach(session => {
      if (session.conversion_events && Array.isArray(session.conversion_events)) {
        session.conversion_events.forEach((event: any) => {
          if (event.type) {
            const existing = eventMap.get(event.type) || { count: 0, totalDuration: 0 };
            const duration = session.session_duration 
              ? this.intervalToMilliseconds(session.session_duration as string) 
              : 0;
            
            eventMap.set(event.type, {
              count: existing.count + 1,
              totalDuration: existing.totalDuration + duration
            });
          }
        });
      }
    });

    return Array.from(eventMap.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        averageSessionDuration: data.count > 0 ? data.totalDuration / data.count / 60000 : 0 // Convert to minutes
      }))
      .sort((a, b) => b.count - a.count);
  }
}

export default SessionAnalyticsService;