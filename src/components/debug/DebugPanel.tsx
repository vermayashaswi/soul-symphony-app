import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronUp, ChevronDown, RefreshCw, Download, Code, Activity, Search, Info, Settings, CircleCheck, CircleX, Eye, EyeOff, LogIn, LogOut } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'api' | 'render' | 'auth' | 'action' | 'navigation' | 'state' | 'network' | 'performance';

export interface LogEntry {
  timestamp: Date;
  message: string;
  level: LogLevel;
  details?: any;
  componentName?: string;
  duration?: number;
}

interface DebuggerState {
  logs: LogEntry[];
  enabled: boolean;
  expanded: boolean;
  filterLevels: Record<LogLevel, boolean>;
  searchQuery: string;
  activeTab: string;
  performanceMarks: Record<string, number>;
  errorCount: number;
}

// Create a global debug logger
class DebugLogger {
  private static instance: DebugLogger;
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private logs: LogEntry[] = [];
  private enabled = false;
  private performanceMarks: Record<string, number> = {};
  private errorCount = 0;
  private profileEvents: LogEntry[] = [];
  private authEvents: LogEntry[] = [];
  private lastAuthError: string | null = null;
  private lastProfileError: string | null = null;
  
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
  
  startPerformanceMark(markName: string): void {
    if (!this.enabled) return;
    this.performanceMarks[markName] = performance.now();
  }
  
  endPerformanceMark(markName: string, componentName?: string): void {
    if (!this.enabled || !this.performanceMarks[markName]) return;
    
    const startTime = this.performanceMarks[markName];
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    delete this.performanceMarks[markName];
    
    this.log('performance', `Performance: ${markName} completed in ${duration.toFixed(2)}ms`, componentName, { 
      markName, 
      duration,
      startTime,
      endTime 
    });
  }
  
  getPerformanceMarks(): Record<string, number> {
    return this.performanceMarks;
  }
  
  log(level: LogLevel, message: string, componentName?: string, details?: any, duration?: number): void {
    if (!this.enabled) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      message,
      level,
      details,
      componentName,
      duration
    };
    
    if (level === 'error') {
      this.errorCount++;
    }
    
    this.logs = [...this.logs, entry];
    
    // Format console log based on level
    const styles = {
      info: 'color: #3b82f6; font-weight: bold;',
      warn: 'color: #f59e0b; font-weight: bold;',
      error: 'color: #ef4444; font-weight: bold;',
      success: 'color: #10b981; font-weight: bold;',
      api: 'color: #8b5cf6; font-weight: bold;',
      render: 'color: #06b6d4; font-weight: bold;',
      auth: 'color: #6366f1; font-weight: bold;',
      action: 'color: #f97316; font-weight: bold;',
      navigation: 'color: #14b8a6; font-weight: bold;',
      state: 'color: #ec4899; font-weight: bold;',
      network: 'color: #0ea5e9; font-weight: bold;',
      performance: 'color: #84cc16; font-weight: bold;',
    };
    
    console.log(
      `%c[${level.toUpperCase()}]${componentName ? ` [${componentName}]` : ''}`,
      styles[level],
      message,
      details || ''
    );
    
    this.notifyListeners();
  }
  
  logProfileEvent(message: string, componentName?: string, details?: any): void {
    if (!this.enabled) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      message,
      level: 'auth',
      details,
      componentName
    };
    
    this.logs = [...this.logs, entry];
    this.profileEvents = [...this.profileEvents, entry];
    
    console.log(
      `%c[PROFILE]${componentName ? ` [${componentName}]` : ''}`,
      'color: #8b5cf6; font-weight: bold;',
      message,
      details || ''
    );
    
    this.notifyListeners();
  }
  
  logAuthError(message: string, componentName?: string, details?: any): void {
    if (!this.enabled) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      message,
      level: 'error',
      details,
      componentName: componentName || 'AuthContext'
    };
    
    this.logs = [...this.logs, entry];
    this.authEvents = [...this.authEvents, entry];
    this.lastAuthError = message;
    this.errorCount++;
    
    console.error(
      `%c[AUTH ERROR]${componentName ? ` [${componentName}]` : ''}`,
      'color: #ef4444; font-weight: bold; background-color: #fef2f2; padding: 2px 4px; border-radius: 2px;',
      message,
      details || ''
    );
    
    this.notifyListeners();
  }
  
  setLastProfileError(error: string | null): void {
    this.lastProfileError = error;
    this.notifyListeners();
  }
  
  getLastProfileError(): string | null {
    return this.lastProfileError;
  }
  
  getLastAuthError(): string | null {
    return this.lastAuthError;
  }
  
  getProfileEvents(): LogEntry[] {
    return this.profileEvents;
  }
  
  getAuthEvents(): LogEntry[] {
    return this.authEvents;
  }
  
  clearLogs(): void {
    this.logs = [];
    this.errorCount = 0;
    this.notifyListeners();
  }
  
  clearProfileEvents(): void {
    this.profileEvents = [];
    this.lastProfileError = null;
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

export const logNavigation = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('navigation', message, componentName, details);

export const logState = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('state', message, componentName, details);

export const logNetwork = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('network', message, componentName, details);

export const logPerformance = (message: string, componentName?: string, details?: any) => 
  debugLogger.log('performance', message, componentName, details);

export const logProfile = (message: string, componentName?: string, details?: any) => 
  debugLogger.logProfileEvent(message, componentName, details);

export const logAuthError = (message: string, componentName?: string, details?: any) => 
  debugLogger.logAuthError(message, componentName, details);

export function startPerformanceMeasure(name: string): () => void {
  debugLogger.startPerformanceMark(name);
  return () => debugLogger.endPerformanceMark(name);
}

export function measurePerformance<T extends (...args: any[]) => any>(
  fn: T, 
  name: string, 
  componentName?: string
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    debugLogger.startPerformanceMark(name);
    const result = fn(...args);
    
    // Handle promises
    if (result instanceof Promise) {
      return result.finally(() => {
        debugLogger.endPerformanceMark(name, componentName);
      }) as ReturnType<T>;
    }
    
    debugLogger.endPerformanceMark(name, componentName);
    return result;
  };
}

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
      action: true,
      navigation: true,
      state: true,
      network: true,
      performance: true
    },
    searchQuery: '',
    activeTab: 'logs',
    performanceMarks: {},
    errorCount: 0
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    debugLogger.setEnabled(state.enabled);
  }, [state.enabled]);
  
  useEffect(() => {
    const unsubscribe = debugLogger.subscribe((logs) => {
      setState(prev => ({ 
        ...prev, 
        logs,
        errorCount: debugLogger.getErrorCount(),
        performanceMarks: debugLogger.getPerformanceMarks()
      }));
      
      // Auto-scroll to bottom if already at bottom
      if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
        
        if (isAtBottom) {
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }, 10);
        }
      }
    });
    
    return unsubscribe;
  }, []);
  
  // Apply filters to logs
  const filteredLogs = state.logs.filter(log => {
    // Check log level filter
    if (!state.filterLevels[log.level]) return false;
    
    // Check search query
    if (state.searchQuery) {
      const searchLower = state.searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(searchLower) ||
        (log.componentName && log.componentName.toLowerCase().includes(searchLower)) ||
        log.level.toLowerCase().includes(searchLower) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });
  
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
      action: 'bg-orange-500',
      navigation: 'bg-teal-500',
      state: 'bg-pink-500',
      network: 'bg-sky-500',
      performance: 'bg-lime-500'
    };
    return colors[level];
  };
  
  const getLevelIcon = (level: LogLevel) => {
    const icons: Record<LogLevel, React.ReactNode> = {
      info: <Info size={12} />,
      warn: <Info size={12} />,
      error: <CircleX size={12} />,
      success: <CircleCheck size={12} />,
      api: <Activity size={12} />,
      render: <Eye size={12} />,
      auth: <LogIn size={12} />,
      action: <Settings size={12} />,
      navigation: <ChevronUp size={12} />,
      state: <Code size={12} />,
      network: <Activity size={12} />,
      performance: <Activity size={12} />
    };
    return icons[level];
  };

  // Group logs by component
  const logsByComponent = filteredLogs.reduce((acc, log) => {
    const component = log.componentName || 'Unknown';
    if (!acc[component]) {
      acc[component] = [];
    }
    acc[component].push(log);
    return acc;
  }, {} as Record<string, LogEntry[]>);
  
  // Extract performance metrics
  const performanceMetrics = filteredLogs
    .filter(log => log.level === 'performance' && log.duration)
    .reduce((acc, log) => {
      const key = log.componentName ? `${log.componentName}: ${log.message}` : log.message;
      if (!acc[key]) {
        acc[key] = [];
      }
      if (log.duration) {
        acc[key].push(log.duration);
      }
      return acc;
    }, {} as Record<string, number[]>);
  
  // Calculate average performance
  const performanceAverages = Object.entries(performanceMetrics).map(([key, durations]) => {
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    const average = total / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);
    return { key, average, max, min, count: durations.length };
  }).sort((a, b) => b.average - a.average);
  
  const authEvents = state.logs.filter(log => 
    log.level === 'auth' || 
    (log.componentName && log.componentName.toLowerCase().includes('auth'))
  );
  
  const profileEvents = state.logs.filter(log => 
    (log.componentName && log.componentName.toLowerCase().includes('profile')) ||
    log.message.toLowerCase().includes('profile')
  );
  
  const tabsContent = [
    { id: 'logs', label: 'Logs', content: (
      <ScrollArea className="h-full" ref={scrollRef}>
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
                      size="sm"
                    >
                      {log.level}
                    </Badge>
                    
                    {log.componentName && (
                      <Badge variant="outline" className="text-[10px]" size="sm">
                        {log.componentName}
                      </Badge>
                    )}
                    
                    <span className="font-medium">{log.message}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {log.timestamp.toLocaleTimeString()}
                    {log.duration && ` (${log.duration.toFixed(2)}ms)`}
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
    )},
    { id: 'components', label: 'Components', content: (
      <ScrollArea className="h-full">
        <div className="p-2 space-y-4">
          {Object.keys(logsByComponent).length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No component logs to display
            </div>
          ) : (
            Object.entries(logsByComponent).map(([component, logs]) => (
              <div key={component} className="border border-border rounded-md overflow-hidden">
                <div className="bg-muted p-2 font-semibold">
                  {component} <Badge variant="outline" className="ml-2">{logs.length}</Badge>
                </div>
                <div className="p-2 space-y-1">
                  {logs.map((log, idx) => (
                    <div 
                      key={idx}
                      className="text-xs p-1.5 rounded hover:bg-muted flex items-start justify-between"
                    >
                      <div className="flex gap-2 items-start">
                        <Badge 
                          className={cn("text-[10px] uppercase", getLevelColor(log.level))}
                          size="sm"
                        >
                          {log.level}
                        </Badge>
                        <span>{log.message}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    )},
    { id: 'performance', label: 'Performance', content: (
      <ScrollArea className="h-full">
        <div className="p-2 space-y-4">
          {performanceAverages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No performance metrics available
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-4 text-xs font-medium p-2 border-b">
                <div className="col-span-2">Operation</div>
                <div>Avg (ms)</div>
                <div>Min/Max (ms)</div>
                <div>Count</div>
              </div>
              {performanceAverages.map((metric, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "grid grid-cols-5 gap-4 text-xs p-2 rounded",
                    metric.average > 100 ? "bg-red-50 dark:bg-red-950/20" : 
                    metric.average > 50 ? "bg-yellow-50 dark:bg-yellow-950/20" :
                    "hover:bg-muted"
                  )}
                >
                  <div className="col-span-2 font-mono">{metric.key}</div>
                  <div className={cn(
                    "font-mono",
                    metric.average > 100 ? "text-red-600 dark:text-red-400" : 
                    metric.average > 50 ? "text-yellow-600 dark:text-yellow-400" : ""
                  )}>
                    {metric.average.toFixed(2)}
                  </div>
                  <div className="font-mono">{metric.min.toFixed(1)} / {metric.max.toFixed(1)}</div>
                  <div>{metric.count}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    )},
    { id: 'network', label: 'Network', content: (
      <ScrollArea className="h-full">
        <div className="p-2">
          {filteredLogs.filter(log => log.level === 'api' || log.level === 'network').length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No network activity recorded
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs
                .filter(log => log.level === 'api' || log.level === 'network')
                .map((log, idx) => (
                  <div 
                    key={idx} 
                    className="p-2 rounded text-xs border border-border hover:bg-muted"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-2 items-start">
                        <Badge 
                          className={cn("text-[10px] uppercase", getLevelColor(log.level))}
                          size="sm"
                        >
                          {log.level}
                        </Badge>
                        
                        {log.componentName && (
                          <Badge variant="outline" className="text-[10px]" size="sm">
                            {log.componentName}
                          </Badge>
                        )}
                        
                        <span className="font-medium">{log.message}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                        {log.duration && ` (${log.duration.toFixed(2)}ms)`}
                      </span>
                    </div>
                    
                    {log.details && (
                      <div className="mt-1 pl-4 border-l-2 border-muted text-muted-foreground">
                        <pre className="text-[10px] whitespace-pre-wrap break-all">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    )},
    { id: 'auth', label: 'Auth', content: (
      <ScrollArea className="h-full">
        <div className="p-2">
          {debugLogger.getLastAuthError() && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Last Auth Error</h3>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">{debugLogger.getLastAuthError()}</p>
            </div>
          )}
          
          {debugLogger.getLastProfileError() && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Last Profile Error</h3>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">{debugLogger.getLastProfileError()}</p>
            </div>
          )}
          
          <div className="mb-4">
            <h3 className="text-sm font-medium">Auth Events Timeline</h3>
            <div className="mt-2 space-y-2">
              {authEvents.length === 0 ? (
                <div className="text-xs text-muted-foreground p-2">No auth events recorded</div>
              ) : (
                authEvents.map((event, idx) => (
                  <div key={idx} className="relative pl-4 pb-2 border-l border-primary/30">
                    <div className="absolute w-2 h-2 bg-primary rounded-full -left-1 top-1.5"></div>
                    <div className="text-[11px] text-muted-foreground">
                      {event.timestamp.toLocaleTimeString()}
                    </div>
                    <div className="text-xs font-medium">{event.message}</div>
                    {event.details && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {typeof event.details === 'object' ? 
                          JSON.stringify(event.details) : String(event.details)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium">Profile Events Timeline</h3>
            <div className="mt-2 space-y-2">
              {profileEvents.length === 0 ? (
                <div className="text-xs text-muted-foreground p-2">No profile events recorded</div>
              ) : (
                profileEvents.map((event, idx) => (
                  <div key={idx} className="relative pl-4 pb-2 border-l border-secondary/30">
                    <div className="absolute w-2 h-2 bg-secondary rounded-full -left-1 top-1.5"></div>
                    <div className="text-[11px] text-muted-foreground">
                      {event.timestamp.toLocaleTimeString()}
                    </div>
                    <div className="text-xs font-medium">{event.message}</div>
                    {event.details && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {typeof event.details === 'object' ? 
                          JSON.stringify(event.details) : String(event.details)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    )},
  ];
  
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
          <span className="font-mono text-sm font-semibold flex items-center gap-1.5">
            DEBUGGER 
            {filteredLogs.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {filteredLogs.length}
              </Badge>
            )}
            {state.errorCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {state.errorCount} {state.errorCount === 1 ? 'error' : 'errors'}
              </Badge>
            )}
            {debugLogger.getLastProfileError() && (
              <Badge variant="warning" className="text-[10px] bg-yellow-500">
                Profile Error
              </Badge>
            )}
          </span>
        </div>
        
        {state.expanded && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Enabled</span>
              <Switch 
                checked={state.enabled} 
                onCheckedChange={toggleEnabled} 
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
          <div className="p-2 border-b bg-muted">
            <div className="flex gap-2 items-center mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={state.searchQuery}
                  onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
                  placeholder="Search logs..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button 
                variant={state.searchQuery ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => setState(prev => ({ ...prev, searchQuery: '' }))}
                disabled={!state.searchQuery}
              >
                <X size={12} className="mr-1" /> Clear
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(state.filterLevels) as LogLevel[]).map((level) => (
                <Badge 
                  key={level}
                  variant={state.filterLevels[level] ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "cursor-pointer text-xs flex items-center gap-1", 
                    state.filterLevels[level] ? getLevelColor(level) : "bg-transparent"
                  )}
                  onClick={() => toggleFilter(level)}
                >
                  {getLevelIcon(level)}
                  {level.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>
          
          <Tabs 
            defaultValue="logs" 
            value={state.activeTab} 
            onValueChange={(tab) => setState(prev => ({ ...prev, activeTab: tab }))}
            className="flex flex-col h-[calc(70vh-112px)]"
          >
            <TabsList className="mx-2 mt-2 mb-0">
              {tabsContent.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                  {tab.label}
                  {tab.id === 'auth' && debugLogger.getLastAuthError() && (
                    <span className="ml-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {tabsContent.map(tab => (
              <TabsContent key={tab.id} value={tab.id} className="flex-1 overflow-hidden p-0 m-0">
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}
