import React, { createContext, useContext, useState, useCallback } from 'react';

interface DebugEvent {
  timestamp: number;
  component: string;
  action: string;
  level: 'info' | 'warning' | 'error';
  details?: any;
}

interface DebugContextType {
  events: DebugEvent[];
  addEvent: (component: string, action: string, level: 'info' | 'warning' | 'error', details?: any) => void;
  clearEvents: () => void;
}

const DebugContext = createContext<DebugContextType>({
  events: [],
  addEvent: () => {},
  clearEvents: () => {},
});

export const DebugProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  
  const addEvent = useCallback((component: string, action: string, level: 'info' | 'warning' | 'error', details?: any) => {
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
  }, []);
  
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);
  
  return (
    <DebugContext.Provider value={{ events, addEvent, clearEvents }}>
      {children}
    </DebugContext.Provider>
  );
};

export const useDebugLog = () => useContext(DebugContext);

// Component to display debug logs when needed
export const DebugLogPanel: React.FC<{show?: boolean}> = ({ show = false }) => {
  const { events, clearEvents } = useDebugLog();
  
  if (!show) return null;
  
  return (
    <div className="fixed bottom-0 left-0 w-full bg-black/80 text-white z-50 max-h-[300px] overflow-auto p-2 text-xs">
      <div className="flex justify-between mb-2">
        <h3>Debug Log ({events.length} events)</h3>
        <button onClick={clearEvents} className="text-xs bg-red-500 px-2 py-1 rounded">Clear</button>
      </div>
      <div className="space-y-1">
        {events.map((event, i) => (
          <div key={i} className={`
            ${event.level === 'error' ? 'text-red-400' : 
               event.level === 'warning' ? 'text-yellow-400' : 'text-blue-300'}
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
