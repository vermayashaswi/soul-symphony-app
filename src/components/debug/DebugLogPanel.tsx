
import React, { useState } from 'react';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { formatLogTimestamp, getLogLevelColor, getLogLevelBgColor } from '@/utils/debug/debugUtils';
import { LogLevel } from '@/utils/debug/debugLogTypes';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, ChevronDown, X, Copy, Trash2, Bug } from 'lucide-react';
import { toast } from 'sonner';

const DebugLogPanel: React.FC = () => {
  const { logs, clearLogs, isEnabled, toggleEnabled } = useDebugLog();
  const [isOpen, setIsOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<LogLevel | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Get unique categories
  const categories = [...new Set(logs.map(log => log.category))];
  const levels: LogLevel[] = ['info', 'success', 'warning', 'error'];

  // Filter logs based on category and level
  const filteredLogs = logs.filter(log => {
    if (filterCategory && log.category !== filterCategory) return false;
    if (filterLevel && log.level !== filterLevel) return false;
    return true;
  });

  // Toggle a log's expanded state
  const toggleLogExpanded = (id: string) => {
    const newExpandedLogs = new Set(expandedLogs);
    if (newExpandedLogs.has(id)) {
      newExpandedLogs.delete(id);
    } else {
      newExpandedLogs.add(id);
    }
    setExpandedLogs(newExpandedLogs);
  };

  // Copy logs to clipboard
  const copyLogs = () => {
    const logsText = JSON.stringify(filteredLogs, null, 2);
    navigator.clipboard.writeText(logsText);
    toast.success('Logs copied to clipboard');
  };

  if (!isEnabled) {
    return (
      <Button
        className="fixed top-4 right-4 z-50 shadow-lg"
        size="sm"
        onClick={toggleEnabled}
      >
        <Bug className="mr-2 h-4 w-4" /> Enable Debug Mode
      </Button>
    );
  }

  return (
    <div className="fixed top-0 right-0 z-50 w-full md:w-auto max-w-full md:max-w-md border shadow-lg bg-white dark:bg-gray-900 rounded-b-lg overflow-hidden transition-all duration-300 ease-in-out"
      style={{ 
        height: isOpen ? 'min(80vh, 500px)' : '40px',
        transform: isEnabled ? 'translateY(0)' : 'translateY(-100%)'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <Bug className="mr-2 h-4 w-4" />
          <span className="font-medium">Processing Debug</span>
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            {filteredLogs.length} logs
          </span>
          {isOpen ? <ChevronDown className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
        </div>
        <div className="flex items-center space-x-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0" 
            onClick={(e) => {
              e.stopPropagation();
              clearLogs();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0" 
            onClick={(e) => {
              e.stopPropagation();
              copyLogs();
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0" 
            onClick={(e) => {
              e.stopPropagation();
              toggleEnabled();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <CollapsibleContent forceMount className={`${isOpen ? 'block' : 'hidden'} overflow-hidden h-[calc(100%-40px)]`}>
        <div className="flex flex-col h-full">
          {/* Filters */}
          <div className="p-2 border-b flex flex-wrap gap-2">
            <select
              className="text-xs px-2 py-1 border rounded"
              value={filterCategory || ''}
              onChange={(e) => setFilterCategory(e.target.value || null)}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              className="text-xs px-2 py-1 border rounded"
              value={filterLevel || ''}
              onChange={(e) => setFilterLevel((e.target.value || null) as LogLevel | null)}
            >
              <option value="">All Levels</option>
              {levels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              className="text-xs py-1 h-7"
              onClick={() => {
                setFilterCategory(null);
                setFilterLevel(null);
              }}
            >
              Clear Filters
            </Button>
          </div>

          {/* Logs */}
          <div className="overflow-auto flex-1 p-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                No logs to display
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map(log => {
                  const isExpanded = expandedLogs.has(log.id);
                  return (
                    <div key={log.id} className={`border rounded overflow-hidden ${getLogLevelBgColor(log.level)}`}>
                      <div 
                        className="flex items-center justify-between px-2 py-1 cursor-pointer"
                        onClick={() => toggleLogExpanded(log.id)}
                      >
                        <div className="flex items-center">
                          {isExpanded ? 
                            <ChevronDown className="h-3 w-3 mr-1" /> : 
                            <ChevronRight className="h-3 w-3 mr-1" />
                          }
                          <span className={`text-xs font-medium ${getLogLevelColor(log.level)}`}>
                            {log.level.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 mx-2 truncate text-xs">
                          <span className="font-medium">[{log.category}]</span> {log.message}
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {formatLogTimestamp(log.timestamp)}
                        </div>
                      </div>
                      {isExpanded && log.details && (
                        <div className="p-2 border-t bg-white dark:bg-gray-800 overflow-auto max-h-40">
                          <pre className="text-xs whitespace-pre-wrap">
                            {typeof log.details === 'object' 
                              ? JSON.stringify(log.details, null, 2)
                              : String(log.details)
                            }
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </div>
  );
};

export default DebugLogPanel;
