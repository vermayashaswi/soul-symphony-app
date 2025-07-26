import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '@/providers/SessionProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { usePlatformDetection } from '@/hooks/use-platform-detection';
import { useCapacitorInitialization } from '@/hooks/useCapacitorInitialization';
import { useSessionValidation } from '@/hooks/useSessionValidation';
import { useLocation, useNavigate } from 'react-router-dom';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { authStateManager } from '@/services/authStateManager';

export const SessionDebugPanel: React.FC = () => {
  const [renderCount, setRenderCount] = useState(0);
  const [logs, setLogs] = useState<Array<{ timestamp: string; message: string; level: 'info' | 'warn' | 'error' }>>([]);
  const startTimeRef = useRef(Date.now());
  const lastUpdateRef = useRef(Date.now());

  // Core hooks
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
  const { theme, colorTheme } = useTheme();
  const platformInfo = usePlatformDetection();
  const capacitorInit = useCapacitorInitialization();
  const sessionValidation = useSessionValidation();
  const location = useLocation();
  const navigate = useNavigate();

  // Helper function to add logs
  const addLog = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prev => [...prev.slice(-49), { timestamp, message, level }]);
    console.log(`[DebugPanel] ${timestamp} ${level.toUpperCase()}: ${message}`);
  };

  // Track render count and potential infinite loops
  useEffect(() => {
    setRenderCount(prev => prev + 1);
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    
    if (timeSinceLastUpdate < 100 && renderCount > 10) {
      addLog(`Potential infinite re-render detected! Render #${renderCount} in ${timeSinceLastUpdate}ms`, 'error');
    } else if (renderCount % 5 === 0) {
      addLog(`Render count: ${renderCount}, since last update: ${timeSinceLastUpdate}ms`, 'info');
    }
    
    lastUpdateRef.current = now;
  });

  // Log initialization states
  useEffect(() => {
    const logStates = async () => {
      try {
        const authState = await authStateManager.getCurrentAuthState();
        
        addLog(`Auth: user=${!!user}, valid=${sessionValidation.isValid}, loading=${sessionValidation.isLoading}`, 'info');
        addLog(`Platform: ${platformInfo.platform}, native=${platformInfo.isNative}, ready=${platformInfo.isReady}`, 'info');
        addLog(`Capacitor: loading=${capacitorInit.isLoading}, complete=${capacitorInit.initializationComplete}, timeout=${capacitorInit.hasTimedOut}`, 'info');
        addLog(`Route: ${location.pathname}, isApp=${location.pathname.startsWith('/app')}`, 'info');
        addLog(`Theme: ${theme}, color=${colorTheme}`, 'info');
        addLog(`Session: active=${isSessionActive}, initialized=${isInitialized}`, 'info');
        
        if (authState) {
          addLog(`AuthState: sessionId=${authState.sessionId || 'none'}, session=${authState.sessionExists}, user=${authState.userExists}`, 'info');
        }
        
        // Log native integration status
        const isNative = nativeIntegrationService.isRunningNatively();
        addLog(`Native: running=${isNative}, capacitor=${!!(window as any).Capacitor}`, 'info');
        
      } catch (error) {
        addLog(`Error logging states: ${error}`, 'error');
      }
    };
    
    logStates();
  }, [user, sessionValidation.isValid, sessionValidation.isLoading, platformInfo, capacitorInit, location.pathname, theme, colorTheme, isSessionActive, isInitialized]);

  // Clear logs function
  const clearLogs = () => {
    setLogs([]);
    setRenderCount(0);
    addLog('Logs cleared', 'info');
  };

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

  const elapsedTime = Math.round((Date.now() - startTimeRef.current) / 1000);

  return (
    <div className="fixed top-4 right-4 w-96 max-h-[80vh] overflow-y-auto bg-background border rounded-lg shadow-lg p-4 z-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Initialization Debug Panel</h3>
        <div className="text-xs text-muted-foreground">
          Renders: {renderCount} | Time: {elapsedTime}s
        </div>
      </div>
      
      <div className="space-y-4 text-xs">
        {/* Authentication State */}
        <div className="border-b border-border pb-2">
          <h4 className="font-medium mb-1 text-sm">🔐 Authentication</h4>
          <div className="space-y-1">
            <div>User: {user ? '✅ Logged in' : '❌ Not logged in'}</div>
            <div>Session Valid: {sessionValidation.isValid ? '✅' : '❌'}</div>
            <div>Session Loading: {sessionValidation.isLoading ? '⏳' : '✅'}</div>
            <div>Session Error: {sessionValidation.error || 'None'}</div>
          </div>
        </div>

        {/* Platform & Capacitor */}
        <div className="border-b border-border pb-2">
          <h4 className="font-medium mb-1 text-sm">📱 Platform & Capacitor</h4>
          <div className="space-y-1">
            <div>Platform: {platformInfo.platform} {platformInfo.isReady ? '✅' : '⏳'}</div>
            <div>Native: {platformInfo.isNative ? '✅' : '❌'}</div>
            <div>Capacitor: {platformInfo.isCapacitor ? '✅' : '❌'}</div>
            <div>Cap Init: {capacitorInit.initializationComplete ? '✅' : capacitorInit.isLoading ? '⏳' : '❌'}</div>
            <div>Cap Timeout: {capacitorInit.hasTimedOut ? '⚠️ Yes' : 'No'}</div>
          </div>
        </div>

        {/* Context Providers */}
        <div className="border-b border-border pb-2">
          <h4 className="font-medium mb-1 text-sm">🎛️ Context Providers</h4>
          <div className="space-y-1">
            <div>Theme: {theme} ({colorTheme}) ✅</div>
            <div>Session: {isSessionActive ? '✅ Active' : '❌ Inactive'}</div>
            <div>Session Init: {isInitialized ? '✅' : '⏳'}</div>
          </div>
        </div>

        {/* Route Processing */}
        <div className="border-b border-border pb-2">
          <h4 className="font-medium mb-1 text-sm">🛣️ Route Processing</h4>
          <div className="space-y-1">
            <div>Current: {location.pathname}</div>
            <div>Is App Route: {location.pathname.startsWith('/app') ? '✅' : '❌'}</div>
            <div>Protected: {user && location.pathname.startsWith('/app') ? '✅' : '❌'}</div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="border-b border-border pb-2">
          <h4 className="font-medium mb-1 text-sm">⚡ Performance</h4>
          <div className="space-y-1">
            <div>Render Count: {renderCount}</div>
            <div>Elapsed Time: {elapsedTime}s</div>
            <div>Re-render Risk: {renderCount > 20 ? '⚠️ High' : renderCount > 10 ? '⚠️ Medium' : '✅ Low'}</div>
          </div>
        </div>

        {/* Live Logs */}
        <div className="border-b border-border pb-2">
          <h4 className="font-medium mb-1 text-sm flex justify-between">
            📋 Live Logs
            <button onClick={clearLogs} className="text-xs bg-muted px-2 py-1 rounded">Clear</button>
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-1 bg-muted p-2 rounded">
            {logs.slice(-10).map((log, i) => (
              <div key={i} className={`text-xs ${
                log.level === 'error' ? 'text-destructive' : 
                log.level === 'warn' ? 'text-yellow-600' : 
                'text-muted-foreground'
              }`}>
                <span className="font-mono">{log.timestamp}</span> {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-xs text-muted-foreground">No logs yet...</div>
            )}
          </div>
        </div>

        {/* Test Actions */}
        <div>
          <h4 className="font-medium mb-2 text-sm">🧪 Test Actions</h4>
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={handleTestActivity}
              className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
            >
              Activity
            </button>
            <button 
              onClick={handleTestConversion}
              className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
            >
              Conversion
            </button>
            <button 
              onClick={handleUpdateSession}
              className="px-2 py-1 bg-accent text-accent-foreground rounded text-xs"
            >
              Update
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-2 py-1 bg-destructive text-destructive-foreground rounded text-xs"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDebugPanel;