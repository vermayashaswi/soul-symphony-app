import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/contexts/AuthContext';

interface ApiCall {
  id: string;
  url: string;
  method: string;
  status?: number;
  startTime: number;
  endTime?: number;
  success?: boolean;
  request?: any;
  response?: any;
  error?: any;
}

interface JournalOperation {
  id: string;
  type: 'recording' | 'processing' | 'saving' | 'deletion' | 'loading';
  status: 'pending' | 'success' | 'error';
  startTime: number;
  endTime?: number;
  message: string;
  details?: string;
  relatedApiCallIds?: string[];
}

const JournalDebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [operations, setOperations] = useState<JournalOperation[]>([]);
  const [selectedTab, setSelectedTab] = useState<'api' | 'operations'>('operations');
  const { user } = useAuth();
  
  // Keep track of ongoing operations
  useEffect(() => {
    // Custom event listeners for journal operations
    const handleOperationStart = (e: CustomEvent) => {
      const { type, message, details } = e.detail;
      const id = Math.random().toString(36).substring(2, 9);
      
      const operation: JournalOperation = {
        id,
        type,
        status: 'pending',
        startTime: Date.now(),
        message,
        details,
        relatedApiCallIds: []
      };
      
      setOperations(prev => [operation, ...prev].slice(0, 100));
      
      // Return the operation ID so it can be referenced later
      return id;
    };
    
    const handleOperationUpdate = (e: CustomEvent) => {
      const { id, status, message, details, apiCallId } = e.detail;
      
      setOperations(prev => 
        prev.map(op => {
          if (op.id === id) {
            return {
              ...op,
              status: status || op.status,
              message: message || op.message,
              details: details || op.details,
              relatedApiCallIds: apiCallId 
                ? [...(op.relatedApiCallIds || []), apiCallId]
                : op.relatedApiCallIds,
              ...(status === 'success' || status === 'error' ? { endTime: Date.now() } : {})
            };
          }
          return op;
        })
      );
    };
    
    // Define custom event types
    window.addEventListener('journalOperationStart', handleOperationStart as EventListener);
    window.addEventListener('journalOperationUpdate', handleOperationUpdate as EventListener);
    
    // Initialize the API call interceptor
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const id = Math.random().toString(36).substring(2, 9);
      const url = typeof input === 'string' 
        ? input 
        : input instanceof URL 
          ? input.href 
          : input.url;
          
      const method = init?.method || 'GET';
      const startTime = Date.now();
      
      // Only capture Journal-related API calls
      if (url.includes('Journal') || 
          url.includes('journal') || 
          url.includes('transcribe-audio') || 
          url.includes('analyze-sentiment') ||
          url.includes('generate-themes')) {
        
        const apiCall: ApiCall = {
          id,
          url,
          method,
          startTime,
          request: init?.body instanceof FormData ? 'FormData' : init?.body
        };
        
        // Add to state
        setApiCalls(prev => [apiCall, ...prev].slice(0, 100));
        
        // Dispatch custom event for any matching operations
        window.dispatchEvent(new CustomEvent('journalApiCall', { 
          detail: { apiCallId: id, url, method }
        }));
      }
      
      try {
        const response = await originalFetch(input, init);
        
        // Only update if this was a tracked API call
        if (url.includes('Journal') || 
            url.includes('journal') || 
            url.includes('transcribe-audio') || 
            url.includes('analyze-sentiment') ||
            url.includes('generate-themes')) {
          
          // Clone the response so we can both read its content and return it
          const clonedResponse = response.clone();
          let responseData: any;
          
          try {
            // Try to parse as JSON first
            responseData = await clonedResponse.json();
          } catch {
            try {
              // If JSON fails, try as text
              responseData = await clonedResponse.text();
              if (responseData.length > 500) {
                responseData = responseData.substring(0, 500) + '... (truncated)';
              }
            } catch {
              responseData = 'Unable to parse response body';
            }
          }
          
          // Update state with response
          setApiCalls(prev => prev.map(call => 
            call.id === id 
              ? { 
                  ...call, 
                  status: response.status, 
                  endTime: Date.now(), 
                  success: response.ok,
                  response: responseData
                } 
              : call
          ));
          
          // If not OK, dispatch error event that operations can listen for
          if (!response.ok) {
            window.dispatchEvent(new CustomEvent('journalApiError', { 
              detail: { apiCallId: id, url, status: response.status, error: responseData }
            }));
          }
        }
        
        return response;
      } catch (error) {
        // Only update if this was a tracked API call
        if (url.includes('Journal') || 
            url.includes('journal') || 
            url.includes('transcribe-audio') || 
            url.includes('analyze-sentiment') ||
            url.includes('generate-themes')) {
          
          // Update state with error
          setApiCalls(prev => prev.map(call => 
            call.id === id 
              ? { 
                  ...call, 
                  endTime: Date.now(), 
                  success: false,
                  error: String(error)
                } 
              : call
          ));
          
          // Dispatch error event
          window.dispatchEvent(new CustomEvent('journalApiError', { 
            detail: { apiCallId: id, url, error: String(error) }
          }));
        }
        
        throw error;
      }
    };
    
    // Cleanup
    return () => {
      window.fetch = originalFetch;
      window.removeEventListener('journalOperationStart', handleOperationStart as EventListener);
      window.removeEventListener('journalOperationUpdate', handleOperationUpdate as EventListener);
    };
  }, []);
  
  const getStatusClass = (status: 'pending' | 'success' | 'error') => {
    switch(status) {
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'pending': return 'text-amber-500 animate-pulse';
      default: return '';
    }
  };
  
  const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch(status) {
      case 'success': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'pending': return <Clock className="h-3 w-3 text-amber-500 animate-pulse" />;
      default: return null;
    }
  };
  
  // Filter only API calls related to Journal
  const journalApiCalls = apiCalls.filter(call => 
    call.url.includes('Journal') || 
    call.url.includes('journal') || 
    call.url.includes('transcribe-audio') || 
    call.url.includes('analyze-sentiment') ||
    call.url.includes('generate-themes')
  );
  
  if (!isVisible) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        className="fixed bottom-4 right-4 z-50 bg-red-100 hover:bg-red-200 text-red-800"
        onClick={() => setIsVisible(true)}
      >
        <AlertCircle className="h-4 w-4 mr-2" />
        Journal Debug
      </Button>
    );
  }
  
  return (
    <Card className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Journal Debug Panel</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex space-x-2 text-xs">
          <Badge 
            variant={selectedTab === 'operations' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setSelectedTab('operations')}
          >
            Operations
          </Badge>
          <Badge 
            variant={selectedTab === 'api' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setSelectedTab('api')}
          >
            API Calls
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setApiCalls([]);
              setOperations([]);
            }}
            className="ml-auto text-xs"
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs mb-2">
          {user ? `User: ${user.email}` : 'Not logged in'}
        </div>
        <ScrollArea className="h-[60vh]">
          {selectedTab === 'operations' ? (
            <Accordion type="multiple" className="w-full">
              {operations.length > 0 ? operations.map((op) => (
                <AccordionItem value={op.id} key={op.id}>
                  <AccordionTrigger className="text-xs py-2">
                    <div className="flex items-center space-x-2 text-left">
                      {getStatusIcon(op.status)}
                      <div className="truncate max-w-[200px]">
                        <span className="font-semibold capitalize">{op.type}</span>: {op.message}
                      </div>
                      <Badge 
                        variant={
                          op.status === 'success' ? "success" : 
                          op.status === 'error' ? "destructive" : 
                          "outline"
                        }
                        className="ml-auto"
                      >
                        {op.status}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="font-semibold">Type:</div>
                          <div className="capitalize">{op.type}</div>
                        </div>
                        <div>
                          <div className="font-semibold">Status:</div>
                          <div className={getStatusClass(op.status)}>{op.status}</div>
                        </div>
                        <div>
                          <div className="font-semibold">Started:</div>
                          <div>{new Date(op.startTime).toLocaleTimeString()}</div>
                        </div>
                        {op.endTime && (
                          <div>
                            <div className="font-semibold">Duration:</div>
                            <div>{op.endTime - op.startTime}ms</div>
                          </div>
                        )}
                      </div>
                      
                      {op.details && (
                        <div>
                          <div className="font-semibold">Details:</div>
                          <pre className="bg-muted p-2 rounded overflow-auto max-h-20 text-xs font-mono">
                            {op.details}
                          </pre>
                        </div>
                      )}
                      
                      {op.relatedApiCallIds && op.relatedApiCallIds.length > 0 && (
                        <div>
                          <div className="font-semibold">Related API Calls:</div>
                          <div className="text-xs text-muted-foreground">
                            {op.relatedApiCallIds.map(apiId => {
                              const apiCall = apiCalls.find(call => call.id === apiId);
                              if (!apiCall) return null;
                              
                              return (
                                <div key={apiId} className="py-1 border-b border-muted">
                                  <div className="flex items-center">
                                    <span className={apiCall.success ? "text-green-500" : "text-red-500"}>
                                      {apiCall.method}
                                    </span>
                                    <span className="ml-2 truncate">{apiCall.url.split('/').pop()}</span>
                                    {apiCall.status && (
                                      <Badge 
                                        variant={apiCall.success ? "success" : "destructive"}
                                        className="ml-auto text-[10px] px-1"
                                      >
                                        {apiCall.status}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {apiCall.error && (
                                    <div className="text-red-500 text-[10px] mt-1">
                                      {apiCall.error.toString().substring(0, 100)}
                                      {apiCall.error.toString().length > 100 ? '...' : ''}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  No journal operations to display
                </div>
              )}
            </Accordion>
          ) : (
            <Accordion type="multiple" className="w-full">
              {journalApiCalls.length > 0 ? journalApiCalls.map((call) => (
                <AccordionItem value={call.id} key={call.id}>
                  <AccordionTrigger className="text-xs py-2">
                    <div className="flex items-center space-x-2 text-left">
                      {call.endTime ? (
                        call.success ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )
                      ) : (
                        <RefreshCw className="h-3 w-3 text-amber-500 animate-pulse" />
                      )}
                      <div className="truncate max-w-[200px]">
                        <span className="font-semibold">{call.method}</span> {call.url.split('/').pop()}
                      </div>
                      {call.status && (
                        <Badge 
                          variant={call.success ? "success" : "destructive"}
                          className="ml-auto"
                        >
                          {call.status}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs">
                    <div className="space-y-2">
                      <div>
                        <div className="font-semibold">URL:</div>
                        <div className="truncate font-mono text-xs">{call.url}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="font-semibold">Method:</div>
                          <div>{call.method}</div>
                        </div>
                        <div>
                          <div className="font-semibold">Status:</div>
                          <div>{call.status || 'Pending'}</div>
                        </div>
                        <div>
                          <div className="font-semibold">Started:</div>
                          <div>{new Date(call.startTime).toLocaleTimeString()}</div>
                        </div>
                        {call.endTime && (
                          <div>
                            <div className="font-semibold">Duration:</div>
                            <div>{call.endTime - call.startTime}ms</div>
                          </div>
                        )}
                      </div>
                      {call.request && (
                        <div>
                          <div className="font-semibold">Request:</div>
                          <pre className="bg-muted p-2 rounded overflow-auto max-h-20 text-xs font-mono">
                            {typeof call.request === 'string' 
                              ? call.request 
                              : JSON.stringify(call.request, null, 2)}
                          </pre>
                        </div>
                      )}
                      {call.response && (
                        <div>
                          <div className="font-semibold">Response:</div>
                          <pre className="bg-muted p-2 rounded overflow-auto max-h-40 text-xs font-mono">
                            {typeof call.response === 'string' 
                              ? call.response 
                              : JSON.stringify(call.response, null, 2)}
                          </pre>
                        </div>
                      )}
                      {call.error && (
                        <div>
                          <div className="font-semibold text-red-500">Error:</div>
                          <pre className="bg-red-50 p-2 rounded overflow-auto max-h-20 text-xs font-mono text-red-500">
                            {call.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  No journal API calls to display
                </div>
              )}
            </Accordion>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default JournalDebugPanel;
