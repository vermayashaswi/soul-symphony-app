
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogEntry {
  timestamp: number;
  type: string;
  message: string;
  data?: any;
}

const DebugLogPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Intercept console.log calls
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.log = (...args) => {
      originalConsoleLog(...args);
      setLogs(prevLogs => [...prevLogs, {
        timestamp: Date.now(),
        type: 'log',
        message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
      }]);
    };

    console.error = (...args) => {
      originalConsoleError(...args);
      setLogs(prevLogs => [...prevLogs, {
        timestamp: Date.now(),
        type: 'error',
        message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
      }]);
    };

    console.warn = (...args) => {
      originalConsoleWarn(...args);
      setLogs(prevLogs => [...prevLogs, {
        timestamp: Date.now(),
        type: 'warn',
        message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
      }]);
    };

    // Restore the original console methods when the component unmounts
    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, []);

  if (logs.length === 0 && !isExpanded) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 z-50 w-96 shadow-lg bg-white/90 backdrop-blur">
      <CardHeader className="p-3">
        <CardTitle className="text-sm flex justify-between items-center">
          <span>Debug Logs ({logs.length})</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLogs([])}>Clear</Button>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-3">
          <ScrollArea className="h-60">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`mb-1 text-xs ${
                  log.type === 'error' ? 'text-red-500' : 
                  log.type === 'warn' ? 'text-yellow-500' : 'text-muted-foreground'
                }`}
              >
                <span className="text-[10px] text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {' '}
                <span>{log.message}</span>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};

export default DebugLogPanel;
