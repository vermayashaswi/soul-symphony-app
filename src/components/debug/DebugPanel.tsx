
import React, { useState } from 'react';
import { useDebug, DebugLogEntry } from '@/contexts/debug/DebugContext';
import { 
  Bug, 
  X, 
  AlertTriangle, 
  Info, 
  Navigation, 
  UserCheck, 
  Database, 
  Activity,
  ChevronUp,
  ChevronDown, 
  Trash2,
  Download, 
  Filter 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { debugSessionStatus } from '@/utils/auth-utils'; 
import { refreshAuthSession, checkAuth } from '@/utils/audio/auth-session';

const getTypeIcon = (type: DebugLogEntry['type']) => {
  switch (type) {
    case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'navigation': return <Navigation className="h-4 w-4 text-blue-500" />;
    case 'action': return <Activity className="h-4 w-4 text-green-500" />;
    case 'auth': return <UserCheck className="h-4 w-4 text-purple-500" />;
    case 'session': return <Database className="h-4 w-4 text-amber-500" />;
    case 'network': return <Activity className="h-4 w-4 text-indigo-500" />;
    default: return <Info className="h-4 w-4 text-gray-500" />;
  }
};

const getTypeColor = (type: DebugLogEntry['type']) => {
  switch (type) {
    case 'error': return 'bg-red-100 text-red-800 border-red-200';
    case 'navigation': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'action': return 'bg-green-100 text-green-800 border-green-200';
    case 'auth': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'session': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'network': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Type augmentation for Chrome's performance.memory
interface MemoryInfo {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
  totalJSHeapSize?: number;
}

interface ExtendedPerformance extends Performance {
  memory?: MemoryInfo;
}

const LogEntry = ({ log }: { log: DebugLogEntry }) => {
  const [expanded, setExpanded] = useState(false);

  const formattedTime = new Date(log.timestamp).toLocaleTimeString();
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  return (
    <div className={`mb-2 p-2 rounded border ${getTypeColor(log.type)} text-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {getTypeIcon(log.type)}
          <Badge variant="outline" className="text-xs font-mono">
            {formattedTime}
          </Badge>
          <span className="font-medium">{log.message}</span>
        </div>
        
        {hasDetails && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5" 
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </div>
      
      {hasDetails && expanded && (
        <div className="mt-2 p-2 bg-white/50 rounded font-mono text-xs whitespace-pre-wrap">
          {JSON.stringify(log.details, null, 2)}
        </div>
      )}
    </div>
  );
};

const LogFilterBar = ({ 
  activeFilter, 
  setActiveFilter,
  totalLogs
}: { 
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  totalLogs: number;
}) => {
  const types: Array<DebugLogEntry['type'] | 'all'> = [
    'all', 'error', 'auth', 'session', 'navigation', 'action', 'network', 'info'
  ];
  
  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {types.map(type => (
        <Badge
          key={type}
          variant={activeFilter === type ? "default" : "outline"}
          className="cursor-pointer text-xs capitalize"
          onClick={() => setActiveFilter(type)}
        >
          {type === 'all' ? `All (${totalLogs})` : type}
        </Badge>
      ))}
    </div>
  );
};

export function DebugPanel() {
  const { logs, isVisible, toggleVisibility, clearLogs, addLog } = useDebug();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('logs');

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 z-50 bg-white/90 shadow-md rounded-full"
        onClick={toggleVisibility}
      >
        <Bug className="h-4 w-4" />
      </Button>
    );
  }

  const filteredLogs = activeFilter === 'all' 
    ? logs 
    : logs.filter(log => log.type === activeFilter);

  const handleDownloadLogs = () => {
    const logData = JSON.stringify(logs, null, 2);
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

  const handleSessionDebug = async () => {
    addLog('action', 'Manual session debug requested');
    await debugSessionStatus();
  };

  const handleSessionRefresh = async () => {
    addLog('action', 'Manual session refresh requested');
    const result = await refreshAuthSession(true);
    addLog('session', `Session refresh ${result ? 'succeeded' : 'failed'}`);
  };

  const handleCheckAuth = async () => {
    addLog('action', 'Manual auth check requested');
    const result = await checkAuth();
    addLog('auth', 'Auth check result', result);
  };

  // Cast performance to extended type that includes optional memory property
  const extendedPerformance = performance as ExtendedPerformance;
  const memoryInfo = extendedPerformance.memory;
  
  const getMemoryUsage = () => {
    if (memoryInfo) {
      const usedMB = Math.round(memoryInfo.usedJSHeapSize / (1024 * 1024));
      const limitMB = Math.round(memoryInfo.jsHeapSizeLimit / (1024 * 1024));
      return `${usedMB}MB / ${limitMB}MB`;
    }
    return 'Not available';
  };

  return (
    <div className="fixed bottom-0 right-0 z-50 w-full sm:w-96 max-h-[80vh] bg-white/95 shadow-lg rounded-t-lg border border-b-0 overflow-hidden backdrop-blur-sm">
      <div className="flex justify-between items-center p-2 border-b bg-background/95">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Debug Console</h3>
          <Badge variant="outline" className="text-xs">{logs.length}</Badge>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearLogs}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownloadLogs}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleVisibility}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logs" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 m-1">
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>
        
        <TabsContent value="logs" className="p-2">
          <LogFilterBar 
            activeFilter={activeFilter} 
            setActiveFilter={setActiveFilter} 
            totalLogs={logs.length}
          />
          
          <ScrollArea className="h-[calc(80vh-120px)]">
            {filteredLogs.length > 0 ? (
              <div className="space-y-1">
                {filteredLogs.map(log => (
                  <LogEntry key={log.id} log={log} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Info className="h-8 w-8 mb-2" />
                <p>No logs to display.</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="tools" className="p-2">
          <div className="space-y-2">
            <Collapsible className="w-full border rounded-md">
              <CollapsibleTrigger className="flex w-full justify-between items-center p-3 font-medium">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span>Authentication & Session</span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 pt-0 space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full" 
                  onClick={handleSessionDebug}
                >
                  Debug Session Status
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full" 
                  onClick={handleSessionRefresh}
                >
                  Refresh Auth Session
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full" 
                  onClick={handleCheckAuth}
                >
                  Check Authentication
                </Button>
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible className="w-full border rounded-md">
              <CollapsibleTrigger className="flex w-full justify-between items-center p-3 font-medium">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span>Performance</span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 pt-0 space-y-2">
                <div className="text-sm text-muted-foreground py-2">
                  Memory: {getMemoryUsage()}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full" 
                  onClick={() => {
                    addLog('action', 'Manual garbage collection requested');
                    if ('gc' in window) {
                      try {
                        (window as any).gc();
                        addLog('info', 'Garbage collection triggered');
                      } catch (e) {
                        addLog('error', 'Failed to trigger garbage collection', e);
                      }
                    } else {
                      addLog('info', 'Garbage collection not available');
                    }
                  }}
                >
                  Force Garbage Collection (if available)
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
