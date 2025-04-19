import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { LogLevel } from './debugLogTypes';

interface DebugEvent {
  timestamp: number;
  component: string;
  action: string;
  level: LogLevel;
  details?: any;
}

interface DebugContextType {
  events: DebugEvent[];
  addEvent: (component: string, action: string, level: LogLevel, details?: any) => void;
  clearEvents: () => void;
  networkStatus: 'online' | 'offline' | 'slow' | 'unknown';
}

const DebugContext = createContext<DebugContextType>({
  events: [],
  addEvent: () => {},
  clearEvents: () => {},
  networkStatus: 'unknown'
});

export const DebugProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'slow' | 'unknown'>('unknown');
  
  // Monitor network status
  useEffect(() => {
    const checkNetworkSpeed = async () => {
      try {
        const startTime = Date.now();
        const response = await fetch('https://www.google.com/favicon.ico', { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // If it takes more than 1 second to fetch a tiny favicon, network is slow
        const isNetworkSlow = duration > 1000;
        
        setNetworkStatus(isNetworkSlow ? 'slow' : 'online');
        
        addEventToState('DebugContext', 'Network check', 'info', {
          duration,
          status: isNetworkSlow ? 'slow' : 'good'
        });
      } catch (error) {
        console.error('Network check failed:', error);
        setNetworkStatus('offline');
        
        addEventToState('DebugContext', 'Network check failed', 'error', {
          error: String(error)
        });
      }
    };
    
    const handleOnline = () => {
      setNetworkStatus('online');
      checkNetworkSpeed();
      addEventToState('DebugContext', 'Network online', 'info');
    };
    
    const handleOffline = () => {
      setNetworkStatus('offline');
      addEventToState('DebugContext', 'Network offline', 'warning');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial network check
    if (navigator.onLine) {
      checkNetworkSpeed();
    } else {
      setNetworkStatus('offline');
    }
    
    // Periodically check network speed
    const interval = setInterval(checkNetworkSpeed, 30000); // every 30 seconds
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);
  
  const addEventToState = (component: string, action: string, level: LogLevel, details?: any) => {
    const newEvent: DebugEvent = {
      timestamp: Date.now(),
      component,
      action,
      level,
      details
    };
    
    // Log to console for easier debugging
    console.log(`[${component}] ${action}:`, details);
    
    setEvents(prev => {
      const updatedEvents = [...prev, newEvent];
      
      // Keep only the last 100 events to prevent memory issues
      if (updatedEvents.length > 100) {
        return updatedEvents.slice(-100);
      }
      
      return updatedEvents;
    });
  };
  
  const addEvent = useCallback((component: string, action: string, level: LogLevel, details?: any) => {
    addEventToState(component, action, level, details);
  }, []);
  
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);
  
  return (
    <DebugContext.Provider value={{ events, addEvent, clearEvents, networkStatus }}>
      {children}
    </DebugContext.Provider>
  );
};

export const useDebugLog = () => useContext(DebugContext);

// Component to display debug logs when needed
export const DebugLogPanel: React.FC<{show?: boolean}> = ({ show = false }) => {
  const { events, clearEvents, networkStatus } = useDebugLog();
  
  if (!show) return null;
  
  return (
    <div className="fixed bottom-0 left-0 w-full bg-black/80 text-white z-50 max-h-[300px] overflow-auto p-2 text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3>Debug Log ({events.length} events)</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <span>Network: </span>
            <span className={`ml-1 ${
              networkStatus === 'online' ? 'text-green-400' :
              networkStatus === 'slow' ? 'text-yellow-400' :
              networkStatus === 'offline' ? 'text-red-400' :
              'text-gray-400'
            }`}>
              {networkStatus}
            </span>
          </div>
          <button onClick={clearEvents} className="text-xs bg-red-500 px-2 py-1 rounded">Clear</button>
        </div>
      </div>
      <div className="space-y-1">
        {events.map((event, i) => (
          <div key={i} className={`
            ${event.level === 'error' ? 'text-red-400' : 
               event.level === 'warning' ? 'text-yellow-400' : 
               event.level === 'success' ? 'text-green-400' : 'text-blue-300'}
          `}>
            <span className="opacity-70">{new Date(event.timestamp).toLocaleTimeString()}</span>
            {' - '}
            <span className="font-bold">{event.component}</span>
            {': '}
            <span>{event.action}</span>
            {event.details && (
              <pre className="ml-4 text-[10px] opacity-70 whitespace-pre-wrap">
                {typeof event.details === 'object' 
                  ? JSON.stringify(event.details, null, 2)
                  : String(event.details)
                }
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
