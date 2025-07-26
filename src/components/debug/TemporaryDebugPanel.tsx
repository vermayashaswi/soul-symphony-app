import React, { useState } from 'react';
import { SessionDebugPanel } from './SessionDebugPanel';
import { useAuth } from '@/contexts/AuthContext';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export const TemporaryDebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { user } = useAuth();
  const isNative = nativeIntegrationService.isRunningNatively();

  // Only show in development or in native apps when debugging is needed
  const shouldShow = process.env.NODE_ENV === 'development' || isNative;

  if (!shouldShow) {
    return null;
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed top-4 left-4 bg-red-600 text-white px-2 py-1 rounded text-xs z-50 opacity-50 hover:opacity-100"
        style={{ zIndex: 9999 }}
      >
        🐛 Debug {isVisible ? '✕' : '👁️'}
      </button>

      {/* Debug panel */}
      {isVisible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" style={{ zIndex: 9998 }}>
          <div className="fixed top-16 left-4 right-4 bottom-4 bg-background border rounded-lg overflow-hidden">
            <div className="h-full overflow-y-auto p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Debug Panel (Temporary)</h2>
                <button 
                  onClick={() => setIsVisible(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              
              <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted rounded">
                This panel is temporarily enabled for debugging the loader/navigation issues.
                Native: {isNative ? 'Yes' : 'No'} | User: {user ? 'Yes' : 'No'}
              </div>
              
              <SessionDebugPanel />
            </div>
          </div>
        </div>
      )}
    </>
  );
};