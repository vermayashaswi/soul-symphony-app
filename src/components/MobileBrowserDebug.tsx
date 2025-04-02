import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Bug, RotateCw, ArrowDown, ArrowUp } from "lucide-react";

interface OperationStep {
  id: string;
  operation: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  timestamp: string;
  details?: string;
  error?: string;
}

export function MobileBrowserDebug() {
  const [isOpen, setIsOpen] = useState(false);
  const [operationSteps, setOperationSteps] = useState<OperationStep[]>([]);
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const isMobile = useIsMobile();
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    // Get current path without using useLocation
    setCurrentPath(window.location.pathname);
    
    // Setup a listener for path changes
    const handlePathnameChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    window.addEventListener('popstate', handlePathnameChange);
    
    // Setup event listeners for journal operations
    const handleOperationStart = (e: any) => {
      const { operation, details } = e.detail;
      setCurrentOperation(operation);
      
      // Add new operation to steps
      const newStep: OperationStep = {
        id: Date.now().toString(),
        operation,
        status: 'loading',
        timestamp: new Date().toLocaleTimeString(),
        details
      };
      
      setOperationSteps(prev => [newStep, ...prev].slice(0, 30)); // Keep last 30 operations
      
      console.log(`Debug: Operation started - ${operation}`, details);
    };
    
    const handleOperationComplete = (e: any) => {
      const { operation, success, details, error } = e.detail;
      
      if (operation === currentOperation) {
        setCurrentOperation(null);
      }
      
      // Update existing operation or add new one if not found
      setOperationSteps(prev => {
        const existingStepIndex = prev.findIndex(step => 
          step.operation === operation && step.status === 'loading');
        
        if (existingStepIndex >= 0) {
          const newSteps = [...prev];
          newSteps[existingStepIndex] = {
            ...newSteps[existingStepIndex],
            status: success ? 'success' : 'error',
            details: details || newSteps[existingStepIndex].details,
            error: error,
            timestamp: new Date().toLocaleTimeString()
          };
          return newSteps;
        } else {
          // Create new completed step if we didn't catch the start
          const newStep: OperationStep = {
            id: Date.now().toString(),
            operation,
            status: success ? 'success' : 'error',
            timestamp: new Date().toLocaleTimeString(),
            details,
            error
          };
          return [newStep, ...prev].slice(0, 30);
        }
      });
      
      if (!success && error) {
        setErrorCount(prev => prev + 1);
        console.error(`Debug: Operation failed - ${operation}`, error);
      } else {
        console.log(`Debug: Operation completed - ${operation}`, details);
      }
    };
    
    const handleFetchError = (e: any) => {
      const { url, method, error } = e.detail;
      
      // Create a new error step
      const newStep: OperationStep = {
        id: Date.now().toString(),
        operation: `${method} ${new URL(url).pathname}`,
        status: 'error',
        timestamp: new Date().toLocaleTimeString(),
        details: `API request failed`,
        error: error || 'Network error'
      };
      
      setOperationSteps(prev => [newStep, ...prev].slice(0, 30));
      setErrorCount(prev => prev + 1);
      
      console.error(`Debug: API error - ${method} ${url}`, error);
    };
    
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      const operation = `${method} ${new URL(url).pathname}`;
      
      const isJournalCall = url.includes('Journal') || 
                          url.includes('journal') || 
                          url.includes('process-journal');
      
      if (isJournalCall) {
        window.dispatchEvent(new CustomEvent('operation-start', {
          detail: {
            operation: `API: ${operation}`,
            details: `${method} request to ${new URL(url).pathname}`
          }
        }));
      }
      
      try {
        const response = await originalFetch(input, init);
        
        if (isJournalCall) {
          if (response.ok) {
            window.dispatchEvent(new CustomEvent('operation-complete', {
              detail: {
                operation: `API: ${operation}`,
                success: true,
                details: `Status: ${response.status}`
              }
            }));
          } else {
            const errorText = await response.clone().text();
            window.dispatchEvent(new CustomEvent('fetch-error', {
              detail: {
                url,
                method,
                error: `${response.status}: ${errorText.substring(0, 100)}${errorText.length > 100 ? '...' : ''}`
              }
            }));
          }
        }
        
        return response;
      } catch (error) {
        if (isJournalCall) {
          window.dispatchEvent(new CustomEvent('fetch-error', {
            detail: {
              url,
              method,
              error: error instanceof Error ? error.message : String(error)
            }
          }));
        }
        throw error;
      }
    };
    
    const handleError = (event: ErrorEvent) => {
      const newStep: OperationStep = {
        id: Date.now().toString(),
        operation: 'JavaScript Error',
        status: 'error',
        timestamp: new Date().toLocaleTimeString(),
        details: event.message,
        error: `${event.message} at ${event.filename}:${event.lineno}`
      };
      
      setOperationSteps(prev => [newStep, ...prev].slice(0, 30));
      setErrorCount(prev => prev + 1);
    };
    
    if (currentPath.includes('journal')) {
      window.dispatchEvent(new CustomEvent('operation-complete', {
        detail: {
          operation: 'Page Load',
          success: true,
          details: `Journal page loaded at ${new Date().toLocaleTimeString()}`
        }
      }));
    }
    
    window.addEventListener('operation-start', handleOperationStart);
    window.addEventListener('operation-complete', handleOperationComplete);
    window.addEventListener('fetch-error', handleFetchError);
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('operation-start', handleOperationStart);
      window.removeEventListener('operation-complete', handleOperationComplete); 
      window.removeEventListener('fetch-error', handleFetchError);
      window.removeEventListener('error', handleError);
      window.removeEventListener('popstate', handlePathnameChange);
      window.fetch = originalFetch;
    };
  }, [currentOperation, currentPath]);
  
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'success':
        return <Badge variant="success" className="ml-2">Success</Badge>;
      case 'error':
        return <Badge variant="destructive" className="ml-2">Error</Badge>;
      case 'loading':
        return <Badge variant="outline" className="ml-2 animate-pulse">In Progress</Badge>;
      default:
        return <Badge variant="outline" className="ml-2">Pending</Badge>;
    }
  };
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  const runHealthCheck = () => {
    window.dispatchEvent(new CustomEvent('operation-start', {
      detail: {
        operation: 'Health Check',
        details: 'Checking journal API connectivity'
      }
    }));
    
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-journal/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        window.dispatchEvent(new CustomEvent('operation-complete', {
          detail: {
            operation: 'Health Check',
            success: true,
            details: `Service: ${data.service}, Status: ${data.status}`
          }
        }));
      } else {
        const error = await res.text();
        throw new Error(`${res.status}: ${error}`);
      }
    })
    .catch(error => {
      window.dispatchEvent(new CustomEvent('operation-complete', {
        detail: {
          operation: 'Health Check',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }));
    });
  };
  
  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="fixed bottom-20 right-4 z-[9999] shadow-lg"
        onClick={() => setIsOpen(true)}
        style={{
          opacity: 0.95,
          border: errorCount > 0 ? '2px solid red' : '1px solid #e2e8f0',
          padding: '8px',
          backgroundColor: errorCount > 0 ? '#fee2e2' : '#f8fafc'
        }}
      >
        <Bug className={`h-4 w-4 mr-2 ${errorCount > 0 ? 'text-red-600' : ''}`} />
        {errorCount > 0 ? `Debug (${errorCount})` : 'Debug'}
      </Button>
    );
  }
  
  return (
    <Card 
      className={`fixed z-[9999] shadow-lg transition-all duration-300 ${
        isExpanded 
          ? 'inset-0 m-0 rounded-none h-full' 
          : 'bottom-16 left-0 right-0 m-2 h-[40vh]'
      }`}
      style={{
        borderColor: errorCount > 0 ? '#f87171' : '#e2e8f0',
        borderWidth: errorCount > 0 ? '2px' : '1px'
      }}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center">
          <Bug className="h-4 w-4 mr-2" />
          Journal Operations
          {currentOperation && (
            <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 animate-pulse">
              {currentOperation}
            </Badge>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runHealthCheck} className="h-8 px-2">
            <RotateCw className="h-3 w-3 mr-1" />
            Test
          </Button>
          <Button variant="outline" size="sm" onClick={toggleExpand} className="h-8 px-2">
            {isExpanded ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <ScrollArea className={`border rounded ${isExpanded ? 'h-[calc(100vh-100px)]' : 'h-[calc(40vh-80px)]'}`}>
          <div className="p-2 text-xs space-y-2">
            {operationSteps.length > 0 ? (
              operationSteps.map((step) => (
                <div key={step.id} className="border-l-2 border-slate-300 pl-2 py-1 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{step.operation}</span>
                    {getStatusBadge(step.status)}
                  </div>
                  
                  {step.details && (
                    <div className="mt-1 text-gray-600">{step.details}</div>
                  )}
                  
                  {step.error && (
                    <div className="mt-1 text-red-500 bg-red-50 p-1 rounded text-xs">{step.error}</div>
                  )}
                  
                  <div className="text-gray-400 mt-1 text-[10px]">{step.timestamp}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No operations tracked yet. Try recording a journal entry or refreshing entries.
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

declare global {
  interface WindowEventMap {
    'operation-start': CustomEvent;
    'operation-complete': CustomEvent;
    'fetch-error': CustomEvent;
  }
}
