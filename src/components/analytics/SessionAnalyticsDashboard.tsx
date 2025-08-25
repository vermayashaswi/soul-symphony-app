import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSessionTrackingContext } from '@/contexts/SessionTrackingContext';
import { Loader2, RefreshCw, BarChart3, Clock, MousePointer, Globe } from 'lucide-react';

interface SessionData {
  id: string;
  session_start: string;
  session_end?: string;
  device_type?: string;
  country?: string;
  app_language?: string;
  start_page?: string;
  most_interacted_page?: string;
  total_page_views?: number;
  pages_visited?: string[];
  page_interactions?: any;
  is_active: boolean;
}

export const SessionAnalyticsDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getSessionStats, getCurrentSessionId } = useSessionTrackingContext();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_sessions')
        .select('*')
        .order('session_start', { ascending: false })
        .limit(10);

      if (fetchError) {
        throw fetchError;
      }

      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const currentStats = getSessionStats();
  const currentSessionId = getCurrentSessionId();

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getMostInteractedPages = (interactions: any) => {
    if (!interactions || typeof interactions !== 'object') return [];
    return Object.entries(interactions)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Session Analytics</h2>
        <Button onClick={fetchSessions} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}

      {/* Current Session Stats */}
      {currentSessionId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Current Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Current Page</p>
                <p className="font-medium">{currentStats.currentPage || '/'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pages Visited</p>
                <p className="font-medium">{currentStats.pagesVisited.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">{Math.floor(currentStats.sessionDuration / 1000)}s</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Interactions</p>
                <p className="font-medium">
                  {String(Object.values(currentStats.pageInteractions).reduce((a: number, b: unknown) => a + (Number(b) || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Sessions */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold">Recent Sessions</h3>
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No sessions found</p>
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-muted-foreground">Duration:</span>
                    </div>
                    <p className="font-medium">
                      {formatDuration(session.session_start, session.session_end)}
                    </p>
                    <p className={`text-xs px-2 py-1 rounded-full w-fit ${
                      session.is_active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {session.is_active ? 'Active' : 'Ended'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-muted-foreground">Device & Location:</span>
                    </div>
                    <p className="font-medium">{session.device_type || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.country || 'Unknown'} • {session.app_language || 'en'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <MousePointer className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-muted-foreground">Navigation:</span>
                    </div>
                    <p className="font-medium text-xs">
                      Start: {session.start_page || '/'}
                    </p>
                    <p className="font-medium text-xs">
                      Most Active: {session.most_interacted_page || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.total_page_views || 0} page views
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-muted-foreground text-sm">Top Interactions:</span>
                    {session.page_interactions && (
                      <div className="space-y-1">
                        {getMostInteractedPages(session.page_interactions).map(([page, count]) => (
                          <div key={String(page)} className="text-xs">
                            <span className="font-medium">{String(page)}</span>
                            <span className="text-muted-foreground ml-2">({String(count)})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};