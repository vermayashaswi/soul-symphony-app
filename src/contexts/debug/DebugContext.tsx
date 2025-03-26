import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Define the type for a debug log entry
export interface DebugLogEntry {
  id: string;
  timestamp: string;
  type: 'navigation' | 'action' | 'error' | 'auth' | 'session' | 'network' | 'info';
  message: string;
  details?: any;
}

// Define the context type
interface DebugContextType {
  logs: DebugLogEntry[];
  isVisible: boolean;
  toggleVisibility: () => void;
  clearLogs: () => void;
  addLog: (type: DebugLogEntry['type'], message: string, details?: any) => void;
}

// Create the context with a default value
const DebugContext = createContext<DebugContextType | undefined>(undefined);

// Maximum number of logs to keep
const MAX_LOGS = 100;

// Provider component
export const DebugProvider = ({ children }: { children: ReactNode }) => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  // Add a log entry
  const addLog = (type: DebugLogEntry['type'], message: string, details?: any) => {
    setLogs(prevLogs => {
      const newLog: DebugLogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type,
        message,
        details
      };
      
      // Keep only the latest MAX_LOGS
      const updatedLogs = [newLog, ...prevLogs].slice(0, MAX_LOGS);
      return updatedLogs;
    });
  };

  // Toggle the visibility of the debug panel
  const toggleVisibility = () => {
    setIsVisible(prev => !prev);
  };

  // Clear all logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Log navigation changes
  useEffect(() => {
    addLog('navigation', `Navigated to: ${location.pathname}`);
  }, [location.pathname]);

  // Log auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      addLog('auth', `Auth state changed: ${event}`, { 
        event, 
        userId: session?.user?.id,
        hasSession: !!session 
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Check and log session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          addLog('session', 'Error fetching session', { error: error.message });
        } else {
          addLog('session', data.session ? 'Active session found' : 'No active session', {
            hasSession: !!data.session,
            userId: data.session?.user?.id,
            expiresAt: data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null
          });
        }
      } catch (e) {
        addLog('error', 'Exception checking session', { error: e });
      }
    };
    
    checkSession();
  }, []);

  return (
    <DebugContext.Provider value={{ logs, isVisible, toggleVisibility, clearLogs, addLog }}>
      {children}
    </DebugContext.Provider>
  );
};

// Custom hook to use the debug context
export const useDebug = () => {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};
