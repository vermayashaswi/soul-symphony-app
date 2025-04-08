
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle, Filter, Download, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatLogTimestamp, getLogLevelColor, getLogLevelBgColor } from '@/utils/debug/debugUtils';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogLevel } from '@/utils/debug/debugLogTypes';

interface DebugLogPanelProps {
  onClose: () => void;
}

const DebugLogPanel: React.FC<DebugLogPanelProps> = ({ onClose }) => {
  const { logs, clearLogs } = useDebugLog();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  
  // Get unique categories
  const categories = React.useMemo(() => {
    const uniqueCategories = new Set<string>();
    logs.forEach(log => uniqueCategories.add(log.category));
    return Array.from(uniqueCategories).sort();
  }, [logs]);
  
  // Filter logs by tab and category
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      // Filter by level (tab)
      if (activeTab !== 'all' && log.level !== activeTab) {
        return false;
      }
      
      // Filter by category
      if (categoryFilter && log.category !== categoryFilter) {
        return false;
      }
      
      return true;
    });
  }, [logs, activeTab, categoryFilter]);
  
  // Get icon for log level
  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };
  
  // Get count for each level
  const getCounts = () => {
    const counts = {
      all: logs.length,
      info: 0,
      success: 0,
      warning: 0,
      error: 0
    };
    
    logs.forEach(log => {
      counts[log.level] = (counts[log.level] || 0) + 1;
    });
    
    return counts;
  };
  
  const counts = getCounts();
  
  // Export logs as JSON
  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `debug-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Debug Logs</h2>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs" 
              onClick={exportLogs}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs text-red-500 hover:text-red-700" 
              onClick={clearLogs}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="p-4">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  All
                  <Badge variant="secondary" className="ml-1 bg-gray-100">{counts.all}</Badge>
                </TabsTrigger>
                <TabsTrigger value="info">
                  Info
                  <Badge variant="secondary" className="ml-1 bg-blue-50 text-blue-500">{counts.info}</Badge>
                </TabsTrigger>
                <TabsTrigger value="success">
                  Success
                  <Badge variant="secondary" className="ml-1 bg-green-50 text-green-500">{counts.success}</Badge>
                </TabsTrigger>
                <TabsTrigger value="warning">
                  Warning
                  <Badge variant="secondary" className="ml-1 bg-amber-50 text-amber-500">{counts.warning}</Badge>
                </TabsTrigger>
                <TabsTrigger value="error">
                  Error
                  <Badge variant="secondary" className="ml-1 bg-red-50 text-red-500">{counts.error}</Badge>
                </TabsTrigger>
              </TabsList>
              
              {categories.length > 0 && (
                <div className="relative">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={categoryFilter ? "bg-primary/10" : ""}
                    onClick={() => setCategoryFilter(null)}
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    {categoryFilter || "All Categories"}
                  </Button>
                  
                  {categoryFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -right-2 -top-2 h-5 w-5 p-0 rounded-full"
                      onClick={() => setCategoryFilter(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            {categories.length > 1 && !categoryFilter && (
              <div className="flex flex-wrap gap-1 mb-3">
                {categories.map(category => (
                  <Badge 
                    key={category}
                    variant="outline" 
                    className="cursor-pointer hover:bg-secondary"
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            )}
            
            <TabsContent value="all" className="m-0">
              <LogList logs={filteredLogs} getLevelIcon={getLevelIcon} />
            </TabsContent>
            <TabsContent value="info" className="m-0">
              <LogList logs={filteredLogs} getLevelIcon={getLevelIcon} />
            </TabsContent>
            <TabsContent value="success" className="m-0">
              <LogList logs={filteredLogs} getLevelIcon={getLevelIcon} />
            </TabsContent>
            <TabsContent value="warning" className="m-0">
              <LogList logs={filteredLogs} getLevelIcon={getLevelIcon} />
            </TabsContent>
            <TabsContent value="error" className="m-0">
              <LogList logs={filteredLogs} getLevelIcon={getLevelIcon} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

interface LogListProps {
  logs: any[];
  getLevelIcon: (level: LogLevel) => JSX.Element;
}

const LogList: React.FC<LogListProps> = ({ logs, getLevelIcon }) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  if (logs.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No logs to display
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-[50vh]">
      <div className="space-y-2">
        {logs.map(log => (
          <div 
            key={log.id}
            className={`p-3 rounded-md transition-all ${getLogLevelBgColor(log.level)} ${
              expandedLogId === log.id ? 'ring-2 ring-primary/20' : ''
            }`}
            onClick={() => setExpandedLogId(prev => prev === log.id ? null : log.id)}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-2">
                {getLevelIcon(log.level)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">{log.category}</div>
                  <div className="text-xs text-muted-foreground ml-2">
                    {formatLogTimestamp(log.timestamp)}
                  </div>
                </div>
                <div className="text-sm mt-1">{log.message}</div>
                
                {expandedLogId === log.id && log.details && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
                    <div className="font-semibold mb-1">Details:</div>
                    <pre className="bg-black/5 p-2 rounded overflow-x-auto">
                      {typeof log.details === 'object' 
                        ? JSON.stringify(log.details, null, 2)
                        : String(log.details)
                      }
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default DebugLogPanel;
