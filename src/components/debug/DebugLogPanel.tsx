
import React, { useState, useEffect, useRef } from 'react';
import { logger } from '@/utils/logger';

const DebugLogPanel = () => {
  const [logs, setLogs] = useState<{type: string; message: string}[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Only render in development environment
  if (!import.meta.env.DEV) {
    return null;
  }

  useEffect(() => {
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    
    // Intercept console calls and use our logger instead
    console.log = (...args) => {
      originalConsoleLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, { type: 'log', message }]);
      logger.debug(message);
    };
    
    console.warn = (...args) => {
      originalConsoleWarn(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, { type: 'warn', message }]);
      logger.warn(message);
    };
    
    console.error = (...args) => {
      originalConsoleError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, { type: 'error', message }]);
      logger.error(message);
    };
    
    return () => {
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, []);
  
  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logContainerRef.current && isExpanded) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);
  
  return (
    <div 
      className="fixed top-0 right-0 bg-black/80 text-white p-2 text-xs z-[10000] max-w-96"
      style={{ 
        maxHeight: isExpanded ? '50vh' : '30px',
        overflow: 'auto',
        transition: 'max-height 0.3s ease'
      }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Console Logs</h3>
        <div className="flex space-x-2">
          <button 
            onClick={() => setLogs([])} 
            className="text-xs px-1 bg-red-700 rounded"
          >
            Clear
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="text-xs px-1 bg-gray-700 rounded"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div ref={logContainerRef} className="overflow-auto max-h-80">
          {logs.map((log, index) => (
            <div 
              key={index}
              className={`mb-1 pt-1 border-t border-gray-700 ${
                log.type === 'error' ? 'text-red-400' :
                log.type === 'warn' ? 'text-yellow-400' : 'text-green-300'
              }`}
            >
              <span className="opacity-50">[{log.type}]:</span> {log.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DebugLogPanel;
