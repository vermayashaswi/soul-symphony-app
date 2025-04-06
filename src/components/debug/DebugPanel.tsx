import { useState, useEffect, useRef, forwardRef } from 'react';
import { X, AlertTriangle, Info, Bug, Terminal, RefreshCw, DownloadCloud, Filter, ChevronDown, ChevronUp, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as Collapsible from '@radix-ui/react-collapsible';

// Define debug log levels
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'profile' | 'auth';

// Color and icon mappings for log levels
const LOG_LEVEL_PROPERTIES: Record<LogLevel, { icon: React.ReactNode, bgColor: string, textColor: string }> = {
  info: { icon: <Info className="h-4 w-4" />, bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  warn: { icon: <AlertTriangle className="h-4 w-4" />, bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  error: { icon: <AlertTriangle className="h-4 w-4" />, bgColor: 'bg-red-100', textColor: 'text-red-800' },
  debug: { icon: <Bug className="h-4 w-4" />, bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
  profile: { icon: <Terminal className="h-4 w-4" />, bgColor: 'bg-green-100', textColor: 'text-green-800' },
  auth: { icon: <Terminal className="h-4 w-4" />, bgColor: 'bg-orange-100', textColor: 'text-orange-800' }
};

// Debug log entry
export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  source: string;
  timestamp: string;
  details?: any;
  stack?: string;
}

// Debug logger class
class DebugLogger {
  private static instance: DebugLogger;
  private logs: LogEntry[] = [];
  private nextId: number = 1;
  private enabled: boolean = false;
  private listeners: Set<() => void> = new Set();
  private errorCount: number = 0;
  private warnCount: number = 0;
  
  private constructor() {
    // Singleton pattern
  }
  
  public static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }
  
  public log(level: LogLevel, message: string, source: string, details?: any): void {
    if (!this.enabled) return;
    
    // Keep track of error and warning counts
    if (level === 'error') this.errorCount++;
    if (level === 'warn') this.warnCount++;
    
    const logEntry: LogEntry = {
      id: this.nextId++,
      level,
      message,
      source,
      timestamp: new Date().toISOString(),
      details,
      stack: details?.stack
    };
    
    // Also log to console for convenience
    this.logToConsole(logEntry);
    
    this.logs.push(logEntry);
    this.notifyListeners();
  }
  
  private logToConsole(entry: LogEntry): void {
    const consoleMethod = entry.level === 'error' ? console.error : 
                         entry.level === 'warn' ? console.warn : 
                         entry.level === 'debug' ? console.debug : console.log;
    
    consoleMethod(
      `[${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`,
      entry.details || ''
    );
  }
  
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }
  
  public clearLogs(): void {
    this.logs = [];
    this.errorCount = 0;
    this.warnCount = 0;
    this.notifyListeners();
  }
  
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
  
  public getFilteredLogs(filter: string, levels: LogLevel[]): LogEntry[] {
    return this.logs.filter(log => {
      const matchesFilter = filter === '' || 
        log.message.toLowerCase().includes(filter.toLowerCase()) ||
        log.source.toLowerCase().includes(filter.toLowerCase());
        
      const matchesLevel = levels.length === 0 || levels.includes(log.level);
      
      return matchesFilter && matchesLevel;
    });
  }
  
  public getErrorCount(): number {
    return this.errorCount;
  }
  
  public getWarnCount(): number {
    return this.warnCount;
  }
}

// Create and export singleton instance
export const debugLogger = DebugLogger.getInstance();

// Helper logging functions
export const logInfo = (message: string, source: string, details?: any) => {
  debugLogger.log('info', message, source, details);
};

export const logWarn = (message: string, source: string, details?: any) => {
  debugLogger.log('warn', message, source, details);
};

export const logError = (message: string, source: string, details?: any) => {
  debugLogger.log('error', message, source, details);
};

export const logDebug = (message: string, source: string, details?: any) => {
  debugLogger.log('debug', message, source, details);
};

export const logProfile = (message: string, source: string, details?: any) => {
  debugLogger.log('profile', message, source, details);
};

export const logAuthError = (message: string, source: string, details?: any) => {
  debugLogger.log('auth', message, source, details);
};

// Log level selection component
const LogLevelSelect = ({ value, onChange }: { value: LogLevel[], onChange: (value: LogLevel[]) => void }) => {
  const toggleLevel = (level: LogLevel) => {
    if (value.includes(level)) {
      onChange(value.filter(l => l !== level));
    } else {
      onChange([...value, level]);
    }
  };
  
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(LOG_LEVEL_PROPERTIES).map(([level, { bgColor, textColor }]) => (
        <Badge
          key={level}
          variant={value.includes(level as LogLevel) ? "default" : "outline"}
          className={`cursor-pointer ${value.includes(level as LogLevel) ? '' : `border ${textColor}`}`}
          onClick={() => toggleLevel(level as LogLevel)}
        >
          {level}
        </Badge>
      ))}
    </div>
  );
};

// Individual log entry component
const LogEntryItem = ({ log }: { log: LogEntry }) => {
  const [expanded, setExpanded] = useState(false);
  const { icon, bgColor, textColor } = LOG_LEVEL_PROPERTIES[log.level];
  const hasDetails = log.details !== undefined;
  
  const formattedTime = new Date(log.timestamp).toLocaleTimeString();
  
  return (
    <div className="mb-2 overflow-hidden rounded-md border">
      <div 
        className={`${bgColor} p-2 flex justify-between items-center cursor-pointer`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <span className="mr-2">{icon}</span>
          <span className={`font-medium ${textColor}`}>{log.source}</span>
          <span className="ml-2 text-xs text-gray-500">{formattedTime}</span>
        </div>
        {hasDetails && (
          <button className="p-1 rounded-full hover:bg-white/20">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      <div className="p-3 bg-white dark:bg-gray-900">
        <p className="text-sm break-words whitespace-pre-wrap">{log.message}</p>
        
        {expanded && hasDetails && (
          <div className="mt-2 pt-2 border-t">
            <pre className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded overflow-x-auto">
              {typeof log.details === 'object' 
                ? JSON.stringify(log.details, null, 2)
                : String(log.details)}
            </pre>
            
            {log.stack && (
              <div className="mt-2">
                <h4 className="text-xs font-medium mb-1">Stack Trace:</h4>
                <pre className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded overflow-x-auto">
                  {log.stack}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Renders scrollable log list
const LogList = ({ logs }: { logs: LogEntry[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Auto-scroll to bottom when new logs come in
    if (scrollRef.current) {
      const { scrollHeight, clientHeight } = scrollRef.current;
      scrollRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [logs]);
  
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
        <Terminal className="h-8 w-8 mb-2 opacity-50" />
        <p>No logs to display</p>
      </div>
    );
  }
  
  return (
    <div ref={scrollRef} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      {logs.map(log => (
        <LogEntryItem key={log.id} log={log} />
      ))}
    </div>
  );
};

// Save logs dialog
const SaveLogsDialog = ({ logs, isOpen, onClose }: { 
  logs: LogEntry[], 
  isOpen: boolean, 
  onClose: () => void 
}) => {
  const [format, setFormat] = useState<'json' | 'text'>('json');
  
  const downloadLogs = () => {
    let content = '';
    let filename = `debug-logs-${new Date().toISOString().slice(0, 10)}`;
    
    if (format === 'json') {
      content = JSON.stringify(logs, null, 2);
      filename += '.json';
    } else {
      content = logs.map(log => (
        `[${log.level.toUpperCase()}] [${log.timestamp}] [${log.source}] ${log.message}` +
        (log.details ? `\nDetails: ${JSON.stringify(log.details, null, 2)}` : '') +
        (log.stack ? `\nStack: ${log.stack}` : '') +
        '\n'
      )).join('\n');
      filename += '.txt';
    }
    
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Debug Logs</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Download the current debug logs to share with developers or save for later analysis.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Export Format</label>
              <Select value={format} onValueChange={(value) => setFormat(value as 'json' | 'text')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON (Full details)</SelectItem>
                  <SelectItem value="text">Plain Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-sm">
              <p className="font-medium">Summary</p>
              <p className="text-muted-foreground">
                {logs.length} log entries will be exported.
              </p>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={downloadLogs}>
            <DownloadCloud className="h-4 w-4 mr-2" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main debug panel component
interface DebugPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const DebugPanel = forwardRef<HTMLDivElement, DebugPanelProps>(({ isOpen, onClose }, ref) => {
  // Local state
  const [open, setOpen] = useState(!!isOpen);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [activePage, setActivePage] = useState<'console' | 'network' | 'settings'>('console');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSaveDialogOpen, setSaveDialogOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Subscribe to log updates
  useEffect(() => {
    const unsubscribe = debugLogger.subscribe(() => {
      if (autoRefresh) {
        setLogs(debugLogger.getLogs());
      }
    });
    
    // Initialize with current logs
    setLogs(debugLogger.getLogs());
    
    // Auto-refresh interval
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        setRefreshKey(key => key + 1);
      }, 2000);
    }
    
    return () => {
      unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);
  
  // Refresh logs on demand
  useEffect(() => {
    setLogs(debugLogger.getLogs());
  }, [refreshKey]);
  
  // Filter logs based on search and level filters
  const filteredLogs = filter || selectedLevels.length
    ? debugLogger.getFilteredLogs(filter, selectedLevels)
    : logs;
  
  // Handle panel toggle
  const togglePanel = () => {
    const newState = !open;
    setOpen(newState);
    if (!newState && onClose) {
      onClose();
    }
  };
  
  // Handle manual refresh
  const handleRefresh = () => {
    setRefreshKey(key => key + 1);
    toast.success('Logs refreshed');
  };
  
  // Handle clearing logs
  const handleClear = () => {
    debugLogger.clearLogs();
    setLogs([]);
    toast.success('Logs cleared');
  };
  
  // Error and warning counts
  const errorCount = debugLogger.getErrorCount();
  const warningCount = debugLogger.getWarnCount();
  
  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <Button
          onClick={togglePanel}
          variant={errorCount > 0 ? "destructive" : warningCount > 0 ? "secondary" : "outline"}
          className="fixed right-4 bottom-4 shadow-md"
          size="sm"
        >
          <Terminal className="h-4 w-4 mr-2" />
          Debug
          {errorCount > 0 && (
            <Badge variant="outline" className="ml-2 bg-background text-foreground">
              {errorCount} {errorCount === 1 ? 'error' : 'errors'}
            </Badge>
          )}
        </Button>
      )}
      
      {/* Main panel */}
      {open && (
        <Card
          ref={ref}
          className="fixed bottom-4 right-4 w-[calc(100vw-2rem)] max-w-2xl h-[500px] shadow-xl flex flex-col z-50"
        >
          <CardHeader className="px-3 py-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-md flex items-center">
              <Terminal className="h-4 w-4 mr-2" />
              Debug Console
              {errorCount > 0 && (
                <Badge className="ml-2" variant="destructive">
                  {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                </Badge>
              )}
              {warningCount > 0 && errorCount === 0 && (
                <Badge className="ml-2" variant="secondary">
                  {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={togglePanel} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <Tabs value={activePage} onValueChange={(value) => setActivePage(value as any)}>
            <div className="px-3">
              <TabsList>
                <TabsTrigger value="console">Console</TabsTrigger>
                <TabsTrigger value="network">Network</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
            </div>
            
            <CardContent className="p-3 overflow-hidden flex-1 flex flex-col">
              <TabsContent value="console" className="flex-1 flex flex-col h-full mt-0">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleRefresh}
                      className="h-8 w-8 p-0"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClear}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSaveDialogOpen(true)}
                      className="h-8"
                    >
                      <DownloadCloud className="h-4 w-4 mr-1" />
                      <span className="text-xs">Save</span>
                    </Button>
                  </div>
                  
                  <Collapsible.Root className="w-3/5">
                    <Collapsible.Trigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={cn(
                          "px-3 py-1 h-8 w-full justify-between",
                          selectedLevels.length > 0 && "border-primary"
                        )}
                      >
                        <div className="flex items-center">
                          <Filter className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">
                            {selectedLevels.length ? `${selectedLevels.length} filters` : "Filters"}
                          </span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </Collapsible.Trigger>
                    <Collapsible.Content className="bg-popover p-2 rounded-md border mt-1">
                      <LogLevelSelect
                        value={selectedLevels}
                        onChange={setSelectedLevels}
                      />
                    </Collapsible.Content>
                  </Collapsible.Root>
                </div>
                
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter logs..."
                    className="pl-8 h-9"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
                
                <Separator className="my-2" />
                
                <ScrollArea className="flex-1 pr-4">
                  <LogList logs={filteredLogs} />
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="network" className="flex-1 h-full mt-0">
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p>Network monitoring is not enabled</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Enable Network Monitoring
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="settings" className="mt-0">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm mb-1">Debug Settings</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-muted-foreground">Auto-refresh logs</label>
                        <Button
                          variant={autoRefresh ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAutoRefresh(!autoRefresh)}
                        >
                          {autoRefresh ? "Enabled" : "Disabled"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      )}
      
      {/* Save logs dialog */}
      <SaveLogsDialog
        logs={logs}
        isOpen={isSaveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
      />
    </>
  );
});

DebugPanel.displayName = "DebugPanel";

export default DebugPanel;
