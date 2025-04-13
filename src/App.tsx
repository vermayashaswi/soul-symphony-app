
import { useEffect } from 'react';
import AppRoutes from './AppRoutes';
import { debugAudioProcessing } from './utils/debug/audio-debug';
import { debugLog } from './utils/debug/debugLog';

function App() {
  useEffect(() => {
    // Initialize debug utilities
    debugAudioProcessing();
    debugLog('App initialized');
    
    // Log detection info
    debugLog('Mobile detection:', {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  }, []);

  return (
    <div className="app">
      <AppRoutes />
    </div>
  );
}

export default App;
