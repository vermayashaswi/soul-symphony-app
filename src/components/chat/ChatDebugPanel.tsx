
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogEntry {
  timestamp: number;
  type: string;
  message: string;
  data?: any;
}

// Create a provider for debugging features
export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);

  const addLog = (message: string, data?: any) => {
    if (!isEnabled) return;
    
    setLogs(prev => [...prev, {
      timestamp: Date.now(),
      type: 'log',
      message,
      data
    }]);
  };

  const addEvent = (eventType: string, data?: any) => {
    if (!isEnabled) return;
    
    setLogs(prev => [...prev, {
      timestamp: Date.now(),
      type: eventType,
      message: eventType,
      data
    }]);
  };

  const clearLogs = () => setLogs([]);
  const toggleEnabled = () => setIsEnabled(prev => !prev);

  return (
    <chatDebugContext.Provider value={{ logs, addLog, addEvent, clearLogs, isEnabled, toggleEnabled }}>
      {children}
    </chatDebugContext.Provider>
  );
};

// Create context
type ChatDebugContextType = {
  logs: LogEntry[];
  addLog: (message: string, data?: any) => void;
  addEvent: (eventType: string, data?: any) => void;
  clearLogs: () => void;
  isEnabled: boolean;
  toggleEnabled: () => void;
};

const chatDebugContext = React.createContext<ChatDebugContextType>({
  logs: [],
  addLog: () => {},
  addEvent: () => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {}
});

// Hook for consuming the context
export const useChatDebug = () => React.useContext(chatDebugContext);

// Debug panel component
const DebugPanel = () => {
  const { logs, clearLogs, isEnabled, toggleEnabled } = useChatDebug();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isEnabled) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 z-50 w-96 shadow-lg bg-white/90 backdrop-blur">
      <CardHeader className="p-3">
        <CardTitle className="text-sm flex justify-between items-center">
          <span>Chat Debug ({logs.length} events)</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={clearLogs}>Clear</Button>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-3">
          <ScrollArea className="h-80">
            {logs.map((log, index) => (
              <div key={index} className="mb-2 border-b pb-2 text-xs">
                <div className="font-medium">
                  {new Date(log.timestamp).toLocaleTimeString()} - {log.type}
                </div>
                <div className="text-muted-foreground">{log.message}</div>
                {log.data && (
                  <pre className="whitespace-pre-wrap text-xs mt-1 text-muted-foreground">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};

export default DebugPanel;
