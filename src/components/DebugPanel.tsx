
import React, { useState, useEffect } from 'react';
import { X, ArrowUpDown, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const DebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [selectedTab, setSelectedTab] = useState<'all' | 'succeeded' | 'failed'>('all');
  const { user } = useAuth();
  
  useEffect(() => {
    // Create our API request interceptor
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const id = Math.random().toString(36).substring(2, 9);
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';
      const startTime = Date.now();
      
      const apiCall: ApiCall = {
        id,
        url,
        method,
        startTime,
        request: init?.body instanceof FormData ? 'FormData' : init?.body
      };
      
      // Add to state
      setApiCalls(prev => [apiCall, ...prev].slice(0, 100)); // Keep only the last 100 calls
      
      try {
        const response = await originalFetch(input, init);
        
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
        
        return response;
      } catch (error) {
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
        
        throw error;
      }
    };
    
    // Cleanup
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  
  // Filter apiCalls based on selected tab
  const filteredCalls = apiCalls.filter(call => {
    if (selectedTab === 'succeeded') return call.success;
    if (selectedTab === 'failed') return call.success === false;
    return true;
  });
  
  if (!isVisible) {
    return (
      <Button 
        className="fixed bottom-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white"
        onClick={() => setIsVisible(true)}
      >
        Debug
      </Button>
    );
  }
  
  return (
    <Card className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">API Debug Panel</CardTitle>
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
            variant={selectedTab === 'all' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setSelectedTab('all')}
          >
            All ({apiCalls.length})
          </Badge>
          <Badge 
            variant={selectedTab === 'succeeded' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setSelectedTab('succeeded')}
          >
            Success ({apiCalls.filter(call => call.success).length})
          </Badge>
          <Badge 
            variant={selectedTab === 'failed' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setSelectedTab('failed')}
          >
            Failed ({apiCalls.filter(call => call.success === false).length})
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setApiCalls([])}
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
          <Accordion type="multiple" className="w-full">
            {filteredCalls.map((call) => (
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
                      <Clock className="h-3 w-3 text-amber-500 animate-pulse" />
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
            ))}
          </Accordion>
          {filteredCalls.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No API calls to display
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default DebugPanel;
