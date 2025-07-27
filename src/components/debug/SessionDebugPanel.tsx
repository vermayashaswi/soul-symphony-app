import React from 'react';
import { useSession } from '@/providers/SessionProvider';
import { useAuth } from '@/contexts/AuthContext';

export const SessionDebugPanel: React.FC = () => {
  const { 
    currentSession, 
    isInitialized, 
    isSessionActive,
    recordActivity
  } = useSession();
  
  const { user } = useAuth();

  const handleTestActivity = () => {
    recordActivity();
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
      <h3 className="font-semibold mb-4">Simple Session Debug Panel</h3>
      
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
            <strong>Active:</strong> {currentSession?.isActive ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>Page Views:</strong> {currentSession?.pageViews || 0}
          </div>
          <div>
            <strong>Start Time:</strong> {currentSession?.startTime?.toLocaleTimeString() || 'N/A'}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <h4 className="font-medium mb-2">Test Actions</h4>
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={handleTestActivity}
              className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
            >
              Record Activity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDebugPanel;