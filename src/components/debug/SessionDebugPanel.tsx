import React from 'react';
import { useSession } from '@/providers/SessionProvider';
import { useAuth } from '@/contexts/AuthContext';

export const SessionDebugPanel: React.FC = () => {
  const { 
    currentSession, 
    sessionMetrics, 
    isInitialized, 
    isSessionActive,
    recordActivity,
    trackConversion,
    updateSessionState,
    updateSessionMetrics
  } = useSession();
  
  const { user } = useAuth();

  const handleTestConversion = async () => {
    await trackConversion('debug_test_conversion', { 
      timestamp: new Date().toISOString(),
      source: 'debug_panel'
    });
  };

  const handleTestActivity = () => {
    recordActivity();
  };

  const handleUpdateSession = () => {
    updateSessionState();
    updateSessionMetrics();
  };

  if (!user) {
    return (
      <div className="p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">Session Debug Panel</h3>
        <p className="text-sm text-muted-foreground">User not authenticated - no session tracking available</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted rounded-lg">
      <h3 className="font-semibold mb-4">Session Debug Panel</h3>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Session Active:</strong> {isSessionActive ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>Initialized:</strong> {isInitialized ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>Session ID:</strong> {currentSession?.id?.substring(0, 8) || 'None'}
          </div>
          <div>
            <strong>State:</strong> {currentSession?.state || 'None'}
          </div>
          <div>
            <strong>Page Views:</strong> {currentSession?.pageViews || 0}
          </div>
          <div>
            <strong>Quality:</strong> {currentSession?.qualityScore?.toFixed(2) || 'N/A'}
          </div>
        </div>

        {sessionMetrics && (
          <div className="mt-4 pt-3 border-t border-border">
            <h4 className="font-medium mb-2">Session Metrics</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Duration:</strong> {Math.round(sessionMetrics.duration / 1000)}s
              </div>
              <div>
                <strong>Foreground:</strong> {Math.round(sessionMetrics.foregroundTime / 1000)}s
              </div>
              <div>
                <strong>Background:</strong> {Math.round(sessionMetrics.backgroundTime / 1000)}s
              </div>
              <div>
                <strong>Launch Count:</strong> {sessionMetrics.appLaunchCount}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border">
          <h4 className="font-medium mb-2">Test Actions</h4>
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={handleTestActivity}
              className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
            >
              Record Activity
            </button>
            <button 
              onClick={handleTestConversion}
              className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm"
            >
              Test Conversion
            </button>
            <button 
              onClick={handleUpdateSession}
              className="px-3 py-1 bg-accent text-accent-foreground rounded text-sm"
            >
              Update Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDebugPanel;