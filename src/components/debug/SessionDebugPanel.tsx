import React from 'react';
import { useSession } from '@/providers/SessionProvider';

export const SessionDebugPanel: React.FC = () => {
  const { 
    sessionState,
    isInitialized,
    circuitBreakerState,
    resetCircuitBreaker,
    sessionEvents
  } = useSession();

  return (
    <div className="p-4 bg-muted rounded-lg">
      <h3 className="font-semibold mb-4">Optimized Session Debug Panel</h3>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Session Active:</strong> {sessionState.isActive ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>Initialized:</strong> {isInitialized ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>Session ID:</strong> {sessionState.id?.substring(0, 8) || 'None'}
          </div>
          <div>
            <strong>Circuit Breaker:</strong> {circuitBreakerState}
          </div>
          <div>
            <strong>Start Time:</strong> {sessionState.startTime ? new Date(sessionState.startTime).toLocaleTimeString() : 'N/A'}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <h4 className="font-medium mb-2">Session Events</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {sessionEvents.length > 0 ? (
              sessionEvents.map((event, index) => (
                <div key={index} className="text-xs bg-background p-2 rounded">
                  {event}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-sm">No events recorded</div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <h4 className="font-medium mb-2">Actions</h4>
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={resetCircuitBreaker}
              className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
            >
              Reset Circuit Breaker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDebugPanel;