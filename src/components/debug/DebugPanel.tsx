
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  source: string;
  data?: any;
  timestamp: Date;
}

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DebugPanelConfig {
  enabled: boolean;
}

export class DebugLogger {
  private enabled: boolean = false;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private listeners: Array<(logs: LogEntry[]) => void> = [];
  private lastProfileError: string | null = null;
  private errorCount: number = 0;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.log('info', 'Debug mode enabled', 'DebugLogger');
    } else {
      this.log('info', 'Debug mode disabled', 'DebugLogger');
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public subscribe(listener: (logs: LogEntry[]) => void): void {
    this.listeners.push(listener);
    listener(this.logs); // Provide initial logs
  }

  public unsubscribe(listener: (logs: LogEntry[]) => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.logs));
  }

  public clearLogs(): void {
    this.logs = [];
    this.errorCount = 0;
    this.notifyListeners();
  }

  public setMaxLogs(maxLogs: number): void {
    this.maxLogs = maxLogs;
  }

  public log(
    level: LogLevel,
    message: string,
    source: string,
    data?: any,
    timestamp?: Date
  ): void {
    if (!this.enabled) return;
    
    // Increment error count if this is an error
    if (level === 'error') {
      this.errorCount++;
    }
    
    const logEntry: LogEntry = {
      level,
      message,
      source,
      data,
      timestamp: timestamp || new Date(),
    };

    this.logs.push(logEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove the oldest log
    }

    this.notifyListeners();

    // Log to console based on log level
    switch (level) {
      case 'info':
        console.info(`[${source}] ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[${source}] ${message}`, data || '');
        break;
      case 'error':
        console.error(`[${source}] ${message}`, data || '');
        break;
      case 'debug':
        console.debug(`[${source}] ${message}`, data || '');
        break;
    }
  }

  // Add a method to get the error count
  public getErrorCount(): number {
    return this.errorCount;
  }

  public logInfo(message: string, source: string, data?: any): void {
    this.log('info', message, source, data);
  }

  public logWarn(message: string, source: string, data?: any): void {
    this.log('warn', message, source, data);
  }

  public logError(message: string, source: string, data?: any): void {
    this.log('error', message, source, data);
  }

  public logDebug(message: string, source: string, data?: any): void {
    this.log('debug', message, source, data);
  }

  // Add a method to set the last profile error
  public setLastProfileError(error: string | null): void {
    this.lastProfileError = error;
  }

  // Add a method to get the last profile error
  public getLastProfileError(): string | null {
    return this.lastProfileError;
  }
  
  // Add new logging functions
  public logRender(message: string, source: string, data?: any): void {
    this.log('debug', `[Render] ${message}`, source, data);
  }
  
  public logAPI(message: string, source: string, data?: any): void {
    this.log('info', `[API] ${message}`, source, data);
  }
  
  public logAction(message: string, source: string, data?: any): void {
    this.log('info', `[Action] ${message}`, source, data);
  }
  
  public logAuth(message: string, source: string, data?: any): void {
    this.log('info', `[Auth] ${message}`, source, data);
  }
}

export const debugLogger = new DebugLogger();

export const logInfo = (message: string, source: string, data?: any) => {
  debugLogger.logInfo(message, source, data);
};

export const logWarn = (message: string, source: string, data?: any) => {
  debugLogger.logWarn(message, source, data);
};

export const logError = (message: string, source: string, data?: any) => {
  debugLogger.logError(message, source, data);
};

export const logDebug = (message: string, source: string, data?: any) => {
  debugLogger.logDebug(message, source, data);
};

export const logProfile = (message: string, source: string, data?: any) => {
  debugLogger.logInfo(`[Profile] ${message}`, source, data);
};

export const logAuthError = (message: string, source: string, error?: any) => {
  debugLogger.logError(`[Auth] ${message}`, source, error);
};

// Add exports for the new logging functions
export const logRender = (message: string, source: string, data?: any) => {
  debugLogger.logRender(message, source, data);
};

export const logAPI = (message: string, source: string, data?: any) => {
  debugLogger.logAPI(message, source, data);
};

export const logAction = (message: string, source: string, data?: any) => {
  debugLogger.logAction(message, source, data);
};

export const logAuth = (message: string, source: string, data?: any) => {
  debugLogger.logAuth(message, source, data);
};

const DebugPanel: React.FC<DebugPanelProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState<DebugPanelConfig>({ enabled: debugLogger.isEnabled() });
  const [logFilter, setLogFilter] = useState<LogLevel | 'all'>('all');

  useEffect(() => {
    const updateLogs = (newLogs: LogEntry[]) => {
      setLogs([...newLogs].reverse());
    };

    debugLogger.subscribe(updateLogs);

    return () => {
      debugLogger.unsubscribe(updateLogs);
    };
  }, []);

  const toggleEnabled = () => {
    const newEnabled = !config.enabled;
    setConfig({ enabled: newEnabled });
    debugLogger.setEnabled(newEnabled);
  };

  const clearLogs = () => {
    debugLogger.clearLogs();
  };

  const filteredLogs = logFilter === 'all' ? logs : logs.filter(log => log.level === logFilter);

  return (
    <motion.div
      className="fixed right-0 top-0 h-screen z-[100] shadow-lg"
      initial={{ x: '100%' }}
      animate={{ x: isOpen ? 0 : '100%' }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      <div className="bg-background border-l border-border h-full w-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Debug Panel</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        
        <Tabs defaultValue="logs" className="flex-1 flex flex-col">
          <TabsList className="px-4 justify-start">
            <TabsTrigger value="logs" className="data-[state=active]:bg-primary/10">
              Logs
              {debugLogger.getErrorCount() > 0 && (
                <Badge variant="outline" className="ml-2 bg-red-500 text-white">
                  {debugLogger.getErrorCount()}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="auth" className="data-[state=active]:bg-primary/10">
              Auth
            </TabsTrigger>
            <TabsTrigger value="network" className="data-[state=active]:bg-primary/10">
              Network
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-primary/10">
              Performance
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="logs" className="flex-1 flex flex-col p-4">
            <div className="flex items-center space-x-4 mb-4">
              <Label htmlFor="enabled" className="text-sm font-medium">
                Enabled:
              </Label>
              <Switch id="enabled" checked={config.enabled} onCheckedChange={toggleEnabled} />
              <Button variant="outline" size="sm" onClick={clearLogs}>
                Clear Logs
              </Button>
              <div>
                <Label htmlFor="log-filter" className="text-sm font-medium">
                  Filter:
                </Label>
                <select
                  id="log-filter"
                  className="ml-2 p-1 border rounded"
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as LogLevel | 'all')}
                >
                  <option value="all">All</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                  <option value="debug">Debug</option>
                </select>
              </div>
            </div>
            <ScrollArea className="rounded-md border flex-1">
              <div className="p-4 space-y-2">
                {filteredLogs.map((log, index) => (
                  <div key={index} className="text-sm">
                    <span className="text-xs text-muted-foreground mr-2">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="font-semibold mr-2">[{log.source}]</span>
                    <span
                      className={
                        log.level === 'error'
                          ? 'text-red-500'
                          : log.level === 'warn'
                          ? 'text-yellow-500'
                          : 'text-foreground'
                      }
                    >
                      {log.message}
                    </span>
                    {log.data && (
                      <div className="ml-6 mt-1 text-xs text-muted-foreground">
                        <pre>{JSON.stringify(log.data, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-sm text-muted-foreground">No logs yet.</div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="auth" className="flex-1 flex flex-col p-4">
            <p>Auth-related debug information will appear here.</p>
            {debugLogger.getLastProfileError() && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                <h4 className="font-semibold">Last Profile Error:</h4>
                <p>{debugLogger.getLastProfileError()}</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="network" className="flex-1 flex flex-col p-4">
            <p>Network-related debug information will appear here.</p>
          </TabsContent>
          <TabsContent value="performance" className="flex-1 flex flex-col p-4">
            <p>Performance-related debug information will appear here.</p>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default DebugPanel;
