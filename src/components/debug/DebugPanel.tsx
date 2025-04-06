
import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronUp, ChevronDown, RefreshCw, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'api' | 'render' | 'auth' | 'action';

export interface LogEntry {
  timestamp: Date;
  message: string;
  level: LogLevel;
  details?: any;
  componentName?: string;
}

interface DebuggerState {
  logs: LogEntry[];
  enabled: boolean;
  expanded: boolean;
  filterLevels: Record<LogLevel, boolean>;
}

// Create a global debug logger
class DebugLogger {
  private static instance: DebugLogger;
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private logs: LogEntry[] = [];
  private enabled = false;
  
  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }
  
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  log(level: LogLevel, message: string, componentName?: string, details?: any): void {
    if (!this.enabled) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      message,
      level,
      details,
      componentName
    };
    
    this.logs = [...this.logs, entry];
    console.log(`[${level.toUpperCase()}]${componentName ? ` [${componentName}]` : ''} ${message}`, details || '');
    this.notifyListeners();
  }
  
  getLogs(): LogEntry[] {
    return this.logs;
  }
  
  clearLogs(): void {
    this.logs = [];
    this.notifyListeners();
  }
  
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.logs));
  }
}

// Create global debug functions
export const debugLogger = DebugLogger.getInstance();

export const logInfo = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('info', message, componentName, details);

export const logWarn = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('warn', message, componentName, details);

export const logError = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('error', message, componentName, details);

export const logSuccess = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('success', message, componentName, details);

export const logAPI = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('api', message, componentName, details);

export const logRender = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('render', message, componentName, details);

export const logAuth = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('auth', message, componentName, details);

export const logAction = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('action', message, componentName, details);

export function DebugPanel() {
  const [state, setState] = useState<DebuggerState>({
    logs: [],
    enabled: true,
    expanded: false,
    filterLevels: {
      info: true,
      warn: true,
      error: true,
      success: true,
      api: true,
      render: true,
      auth: true,
      action: true
    }
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    debugLogger.setEnabled(state.enabled);
  }, [state.enabled]);
  
  useEffect(() => {
    const unsubscribe = debugLogger.subscribe((logs) => {
      setState(prev => ({ ...prev, logs }));
      
      // Auto-scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 10);
    });
    
    return unsubscribe;
  }, []);
  
  const filteredLogs = state.logs.filter(log => state.filterLevels[log.level]);
  
  const toggleExpanded = () => {
    setState(prev => ({ ...prev, expanded: !prev.expanded }));
  };
  
  const toggleEnabled = () => {
    setState(prev => {
      const newEnabled = !prev.enabled;
      debugLogger.setEnabled(newEnabled);
      return { ...prev, enabled: newEnabled };
    });
  };
  
  const clearLogs = () => {
    debugLogger.clearLogs();
  };
  
  const toggleFilter = (level: LogLevel) => {
    setState(prev => ({
      ...prev,
      filterLevels: {
        ...prev.filterLevels,
        [level]: !prev.filterLevels[level]
      }
    }));
  };
  
  const downloadLogs = () => {
    const logData = JSON.stringify(state.logs, null, 2);
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const getLevelColor = (level: LogLevel): string => {
    const colors: Record<LogLevel, string> = {
      info: 'bg-blue-500',
      warn: 'bg-yellow-500',
      error: 'bg-red-500',
      success: 'bg-green-500',
      api: 'bg-purple-500',
      render: 'bg-cyan-500',
      auth: 'bg-indigo-500',
      action: 'bg-orange-500'
    };
    return colors[level];
  };
  
  return (
    <div 
      className={cn(
        "fixed right-0 bottom-0 z-50 bg-background border border-border shadow-lg transition-all duration-300",
        state.expanded ? "w-full sm:w-2/3 lg:w-1/2 h-[70vh]" : "w-full sm:w-[300px] h-10"
      )}
    >
      <div className="flex items-center justify-between p-2 border-b bg-muted">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={toggleExpanded}
            aria-label={state.expanded ? "Collapse debugger" : "Expand debugger"}
          >
            {state.expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </Button>
          <span className="font-mono text-sm font-semibold">
            DEBUGGER {filteredLogs.length > 0 && `(${filteredLogs.length})`}
          </span>
        </div>
        
        {state.expanded && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Enabled</span>
              <Switch 
                checked={state.enabled} 
                onCheckedChange={toggleEnabled} 
                size="sm" 
                aria-label="Toggle debugger" 
              />
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={clearLogs}
              aria-label="Clear logs"
            >
              <RefreshCw size={16} />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={downloadLogs}
              aria-label="Download logs"
            >
              <Download size={16} />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => setState(prev => ({ ...prev, expanded: false }))}
              aria-label="Close debugger"
            >
              <X size={16} />
            </Button>
          </div>
        )}
      </div>
      
      {state.expanded && (
        <>
          <div className="p-2 border-b bg-muted flex flex-wrap gap-1.5">
            {(Object.keys(state.filterLevels) as LogLevel[]).map((level) => (
              <Badge 
                key={level}
                variant={state.filterLevels[level] ? "default" : "outline"}
                className={cn(
                  "cursor-pointer text-xs", 
                  state.filterLevels[level] ? getLevelColor(level) : "bg-transparent"
                )}
                onClick={() => toggleFilter(level)}
              >
                {level.toUpperCase()}
              </Badge>
            ))}
          </div>
          
          <ScrollArea className="h-[calc(70vh-80px)]" ref={scrollRef}>
            <div className="p-2 space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  No logs to display
                </div>
              ) : (
                filteredLogs.map((log, index) => (
                  <div 
                    key={index} 
                    className="p-2 rounded text-xs font-mono border border-border hover:bg-muted"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-2 items-start">
                        <Badge 
                          className={cn("text-[10px] uppercase", getLevelColor(log.level))}
                        >
                          {log.level}
                        </Badge>
                        
                        {log.componentName && (
                          <Badge variant="outline" className="text-[10px]">
                            {log.componentName}
                          </Badge>
                        )}
                        
                        <span className="font-medium">{log.message}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {log.details && (
                      <div className="mt-1 pl-4 border-l-2 border-muted text-muted-foreground">
                        {typeof log.details === 'object' ? (
                          <pre className="text-[10px] whitespace-pre-wrap break-all">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : (
                          <span>{String(log.details)}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
