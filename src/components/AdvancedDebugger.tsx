
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Bug, ArrowDown, ArrowUp, Server, FileSearch, Activity, Check, Search, Settings } from "lucide-react";

interface OperationStep {
  id: string;
  operation: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  timestamp: string;
  details?: string;
  error?: string;
}

interface ApiCall {
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: string;
}

export function AdvancedDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [operationSteps, setOperationSteps] = useState<OperationStep[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [activeTab, setActiveTab] = useState('operations');
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [databaseInfo, setDatabaseInfo] = useState({
    tablesFound: false,
    journalEntriesTable: false,
    journalChunksTable: false,
    profilesTable: false,
  });
  const [supabaseHealth, setSupabaseHealth] = useState({
    status: 'unknown',
    edgeFunctions: {
      'process-journal': false,
      'chunk-and-embed': false,
      'chat-with-rag': false,
    }
  });
  
  // Track initial setup
  const setupCompleted = useRef(false);

  useEffect(() => {
    if (setupCompleted.current) return;
    setupCompleted.current = true;
    
    // Setup event listeners for operation tracking
    const handleOperationStart = (e: any) => {
      const { operation, details } = e.detail;
      
      // Add new operation to steps
      const newStep: OperationStep = {
        id: Date.now().toString(),
        operation,
        status: 'loading',
        timestamp: new Date().toLocaleTimeString(),
        details
      };
      
      setOperationSteps(prev => [newStep, ...prev].slice(0, 50));
      console.log(`Debug: Operation started - ${operation}`, details);
    };
    
    const handleOperationComplete = (e: any) => {
      const { operation, success, details, error } = e.detail;
      
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
          return [newStep, ...prev].slice(0, 50);
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
      
      setOperationSteps(prev => [newStep, ...prev].slice(0, 50));
      setErrorCount(prev => prev + 1);
      
      console.error(`Debug: API error - ${method} ${url}`, error);
    };
    
    // Intercept fetch to monitor all API calls
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      const startTime = performance.now();
      
      try {
        const response = await originalFetch(input, init);
        const duration = performance.now() - startTime;
        
        const apiCall: ApiCall = {
          url,
          method,
          status: response.status,
          duration: Math.round(duration),
          timestamp: new Date().toLocaleTimeString()
        };
        
        // Only track calls to Supabase or edge functions
        if (url.includes('supabase') || url.includes('functions')) {
          setApiCalls(prev => [apiCall, ...prev].slice(0, 30));
        }
        
        // Check for potential issues with the Journal Entries table
        if (url.includes('Journal Entries') || url.includes('journal_entries')) {
          const tableOperation: OperationStep = {
            id: Date.now().toString(),
            operation: `Table Access: ${method} ${url.includes('Journal Entries') ? 'Journal Entries' : 'journal_entries'}`,
            status: response.status >= 200 && response.status < 300 ? 'success' : 'error',
            timestamp: new Date().toLocaleTimeString(),
            details: `Response status: ${response.status}`
          };
          
          setOperationSteps(prev => [tableOperation, ...prev].slice(0, 50));
          
          // Try to diagnose table name issues
          if (response.status >= 400) {
            const responseClone = response.clone();
            try {
              const errorData = await responseClone.json();
              tableOperation.error = `Error accessing table: ${JSON.stringify(errorData)}`;
              setOperationSteps(prev => {
                const index = prev.findIndex(s => s.id === tableOperation.id);
                if (index >= 0) {
                  const newSteps = [...prev];
                  newSteps[index] = tableOperation;
                  return newSteps;
                }
                return prev;
              });
            } catch (e) {
              // Ignore json parsing errors
            }
          }
        }
        
        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // Track api call errors
        const apiCall: ApiCall = {
          url,
          method,
          status: 0,
          duration: Math.round(duration),
          timestamp: new Date().toLocaleTimeString()
        };
        
        if (url.includes('supabase') || url.includes('functions')) {
          setApiCalls(prev => [apiCall, ...prev].slice(0, 30));
          
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
    
    // Listen for errors
    const handleError = (event: ErrorEvent) => {
      const newStep: OperationStep = {
        id: Date.now().toString(),
        operation: 'JavaScript Error',
        status: 'error',
        timestamp: new Date().toLocaleTimeString(),
        details: event.message,
        error: `${event.message} at ${event.filename}:${event.lineno}`
      };
      
      setOperationSteps(prev => [newStep, ...prev].slice(0, 50));
      setErrorCount(prev => prev + 1);
    };
    
    window.addEventListener('operation-start', handleOperationStart);
    window.addEventListener('operation-complete', handleOperationComplete);
    window.addEventListener('fetch-error', handleFetchError);
    window.addEventListener('error', handleError);
    
    // Initial diagnostics
    checkSupabaseHealth();
    
    return () => {
      window.removeEventListener('operation-start', handleOperationStart);
      window.removeEventListener('operation-complete', handleOperationComplete);
      window.removeEventListener('fetch-error', handleFetchError);
      window.removeEventListener('error', handleError);
      window.fetch = originalFetch;
    };
  }, []);
  
  const checkSupabaseHealth = async () => {
    setOperationSteps(prev => [
      {
        id: Date.now().toString(),
        operation: 'Supabase Health Check',
        status: 'loading',
        timestamp: new Date().toLocaleTimeString(),
        details: 'Checking Supabase connection and edge functions'
      },
      ...prev
    ]);
    
    try {
      // Check edge function health
      const healthCheck = async (functionName: string) => {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}/health`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            setSupabaseHealth(prev => ({
              ...prev,
              edgeFunctions: {
                ...prev.edgeFunctions,
                [functionName]: true
              }
            }));
            
            return true;
          }
          return false;
        } catch (error) {
          console.error(`Health check failed for ${functionName}:`, error);
          return false;
        }
      };
      
      const processJournalHealth = await healthCheck('process-journal');
      const chunkAndEmbedHealth = await healthCheck('chunk-and-embed');
      const chatWithRagHealth = await healthCheck('chat-with-rag');
      
      // Check tables
      const tableCheck = async (tableName: string) => {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${tableName}?limit=1`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            return true;
          } else if (response.status === 401 || response.status === 403) {
            // Table exists but we don't have access (likely due to RLS)
            return true;
          }
          return false;
        } catch (error) {
          console.error(`Table check failed for ${tableName}:`, error);
          return false;
        }
      };
      
      // Check various table name formats to help diagnose potential issues
      const journalEntriesCheck = await tableCheck('Journal Entries');
      const journalEntriesSnakeCase = await tableCheck('journal_entries');
      const profilesCheck = await tableCheck('profiles');
      
      setDatabaseInfo({
        tablesFound: journalEntriesCheck || journalEntriesSnakeCase || profilesCheck,
        journalEntriesTable: journalEntriesCheck,
        journalChunksTable: await tableCheck('journal_chunks'),
        profilesTable: profilesCheck
      });
      
      setSupabaseHealth(prev => ({
        ...prev,
        status: journalEntriesCheck || journalEntriesSnakeCase ? 'healthy' : 'issues'
      }));
      
      setOperationSteps(prev => {
        const index = prev.findIndex(step => step.operation === 'Supabase Health Check');
        if (index >= 0) {
          const newSteps = [...prev];
          newSteps[index] = {
            ...newSteps[index],
            status: 'success',
            details: `Supabase: ${journalEntriesCheck || journalEntriesSnakeCase ? 'Connected' : 'Issues'}, Edge Functions: ${processJournalHealth ? 'Available' : 'Issues'}`
          };
          return newSteps;
        }
        return prev;
      });
      
    } catch (error) {
      console.error('Error checking Supabase health:', error);
      
      setOperationSteps(prev => {
        const index = prev.findIndex(step => step.operation === 'Supabase Health Check');
        if (index >= 0) {
          const newSteps = [...prev];
          newSteps[index] = {
            ...newSteps[index],
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to check Supabase health'
          };
          return newSteps;
        }
        return prev;
      });
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'success':
        return <Badge variant="success" className="ml-2 bg-green-100 text-green-800">Success</Badge>;
      case 'error':
        return <Badge variant="destructive" className="ml-2">Error</Badge>;
      case 'loading':
        return <Badge variant="outline" className="ml-2 animate-pulse bg-blue-100 text-blue-800">In Progress</Badge>;
      default:
        return <Badge variant="outline" className="ml-2">Pending</Badge>;
    }
  };
  
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  const runDiagnostics = () => {
    window.dispatchEvent(new CustomEvent('operation-start', {
      detail: {
        operation: 'Full Diagnostics',
        details: 'Running comprehensive diagnostics on journal system'
      }
    }));
    
    // Run health check
    checkSupabaseHealth();
    
    window.dispatchEvent(new CustomEvent('operation-complete', {
      detail: {
        operation: 'Full Diagnostics',
        success: true,
        details: 'Diagnostics completed, check individual results for details'
      }
    }));
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
        isFullscreen 
          ? 'inset-0 m-0 rounded-none h-full' 
          : 'bottom-16 left-0 right-0 m-2 h-[60vh]'
      }`}
      style={{
        borderColor: errorCount > 0 ? '#f87171' : '#e2e8f0',
        borderWidth: errorCount > 0 ? '2px' : '1px'
      }}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center">
          <Bug className="h-4 w-4 mr-2" />
          Advanced Debugger
          {errorCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
            </Badge>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runDiagnostics} className="h-8 px-2">
            <Activity className="h-3 w-3 mr-1" />
            Diagnose
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="h-8 px-2">
            {isFullscreen ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="api">API Calls</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>
          
          <TabsContent value="operations" className="mt-0">
            <ScrollArea className={`border rounded p-2 ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-[calc(60vh-110px)]'}`}>
              <div className="space-y-3">
                {operationSteps.length > 0 ? (
                  operationSteps.map((step) => (
                    <div key={step.id} className="border-l-2 border-slate-300 pl-2 py-1 text-xs">
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
          </TabsContent>
          
          <TabsContent value="api" className="mt-0">
            <ScrollArea className={`border rounded p-2 ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-[calc(60vh-110px)]'}`}>
              <div className="space-y-3">
                {apiCalls.length > 0 ? (
                  apiCalls.map((call, index) => (
                    <div key={index} className="border-l-2 border-slate-300 pl-2 py-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{call.method} {new URL(call.url).pathname}</span>
                        <Badge 
                          variant={call.status >= 200 && call.status < 300 ? "success" : "destructive"}
                          className="ml-2"
                        >
                          {call.status || 'Failed'} ({call.duration}ms)
                        </Badge>
                      </div>
                      <div className="mt-1 text-gray-600 text-xs break-all">{call.url}</div>
                      <div className="text-gray-400 mt-1 text-[10px]">{call.timestamp}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No API calls tracked yet. Try performing an action that makes API requests.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="system" className="mt-0">
            <ScrollArea className={`border rounded p-2 ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-[calc(60vh-110px)]'}`}>
              <div className="space-y-4">
                <div className="border p-3 rounded">
                  <h3 className="text-sm font-semibold mb-2">Supabase Connection</h3>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <Badge 
                        variant={supabaseHealth.status === 'healthy' ? "success" : "outline"} 
                        className={supabaseHealth.status === 'healthy' ? "bg-green-100 text-green-800" : ""}
                      >
                        {supabaseHealth.status === 'healthy' ? 'Connected' : 'Unknown/Issues'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>process-journal:</span>
                      <Badge 
                        variant={supabaseHealth.edgeFunctions['process-journal'] ? "success" : "outline"}
                        className={supabaseHealth.edgeFunctions['process-journal'] ? "bg-green-100 text-green-800" : ""}
                      >
                        {supabaseHealth.edgeFunctions['process-journal'] ? 'Available' : 'Not Available'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>chunk-and-embed:</span>
                      <Badge 
                        variant={supabaseHealth.edgeFunctions['chunk-and-embed'] ? "success" : "outline"}
                        className={supabaseHealth.edgeFunctions['chunk-and-embed'] ? "bg-green-100 text-green-800" : ""}
                      >
                        {supabaseHealth.edgeFunctions['chunk-and-embed'] ? 'Available' : 'Not Available'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="border p-3 rounded">
                  <h3 className="text-sm font-semibold mb-2">Database Tables</h3>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span>Tables Found:</span>
                      <Badge 
                        variant={databaseInfo.tablesFound ? "success" : "destructive"}
                        className={databaseInfo.tablesFound ? "bg-green-100 text-green-800" : ""}
                      >
                        {databaseInfo.tablesFound ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>"Journal Entries" Table:</span>
                      <Badge 
                        variant={databaseInfo.journalEntriesTable ? "success" : "destructive"}
                        className={databaseInfo.journalEntriesTable ? "bg-green-100 text-green-800" : ""}
                      >
                        {databaseInfo.journalEntriesTable ? 'Found' : 'Not Found'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>journal_chunks Table:</span>
                      <Badge 
                        variant={databaseInfo.journalChunksTable ? "success" : "destructive"}
                        className={databaseInfo.journalChunksTable ? "bg-green-100 text-green-800" : ""}
                      >
                        {databaseInfo.journalChunksTable ? 'Found' : 'Not Found'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>profiles Table:</span>
                      <Badge 
                        variant={databaseInfo.profilesTable ? "success" : "destructive"}
                        className={databaseInfo.profilesTable ? "bg-green-100 text-green-800" : ""}
                      >
                        {databaseInfo.profilesTable ? 'Found' : 'Not Found'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="border p-3 rounded">
                  <h3 className="text-sm font-semibold mb-2">Troubleshooting</h3>
                  <div className="text-xs space-y-1">
                    <div className="text-muted-foreground">Key issues to check:</div>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Table name format: "Journal Entries" vs journal_entries</li>
                      <li>User authentication status and RLS policies</li>
                      <li>Edge function availability and error handling</li>
                      <li>Data type inconsistencies between frontend and backend</li>
                      <li>Network connectivity and CORS issues</li>
                    </ul>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
