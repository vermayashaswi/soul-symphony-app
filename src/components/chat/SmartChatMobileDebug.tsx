import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Smartphone, Info, AlertTriangle, Server, FileSearch } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ApiCall {
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: string;
}

interface DiagnosticsStep {
  id: number;
  step: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  details?: string;
  timestamp?: string;
}

export default function SmartChatMobileDebug() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, any>>({});
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [ragSteps, setRagSteps] = useState<DiagnosticsStep[]>([
    { id: 1, step: "Query Understanding", status: 'pending' },
    { id: 2, step: "Vector Search", status: 'pending' },
    { id: 3, step: "Context Retrieval", status: 'pending' },
    { id: 4, step: "Response Generation", status: 'pending' }
  ]);
  const [activeTab, setActiveTab] = useState('logs');
  const isMobile = useIsMobile();
  const [currentPath, setCurrentPath] = useState<string>('/');

  useEffect(() => {
    setCurrentPath(window.location.pathname);
    
    const handlePathnameChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    window.addEventListener('popstate', handlePathnameChange);
    
    addLog("Debug component mounted");
    addLog(`Current route: ${currentPath}`);
    
    const info = {
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      isMobileDetected: isMobile,
      timeStamp: new Date().toISOString(),
      currentRoute: currentPath
    };
    
    setDeviceInfo(info);
    addLog(`Device info collected: ${window.innerWidth}x${window.innerHeight}, Pixel ratio: ${window.devicePixelRatio}`);
    
    setupFetchInterceptor();
    
    setTimeout(() => {
      if (currentPath.includes('chat') || currentPath.includes('smart-chat')) {
        const chatInterface = document.querySelector('.smart-chat-interface, .mobile-chat-content');
        if (chatInterface) {
          addLog("Chat interface found in DOM");
          const rect = chatInterface.getBoundingClientRect();
          addLog(`Chat interface dimensions: ${rect.width}x${rect.height}`);
        } else {
          addLog("Note: Chat interface not found (expected on chat routes only)");
        }
      } else {
        addLog("Not on chat route - skipping chat interface check");
      }
    }, 500);
    
    const handleResize = () => {
      addLog(`Window resized: ${window.innerWidth}x${window.innerHeight}`);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('popstate', handlePathnameChange);
      cleanupFetchInterceptor();
    };
  }, [isMobile, currentPath]);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };
  
  const setupFetchInterceptor = () => {
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' 
        ? input 
        : input instanceof Request 
          ? input.url 
          : input.href;
      
      const method = init?.method || 'GET';
      const startTime = performance.now();
      
      try {
        addLog(`API call started: ${method} ${url}`);
        
        const response = await originalFetch(input, init);
        
        const duration = performance.now() - startTime;
        
        const apiCall: ApiCall = {
          url,
          method,
          status: response.status,
          duration: Math.round(duration),
          timestamp: new Date().toISOString()
        };
        
        setApiCalls(prev => [apiCall, ...prev].slice(0, 20));
        addLog(`API call completed: ${method} ${url} - Status: ${response.status} (${Math.round(duration)}ms)`);
        
        if (url.includes('chat-with-rag') || url.includes('chat-rag')) {
          setRagSteps(prev => {
            const newSteps = [...prev];
            newSteps[0] = { ...newSteps[0], status: 'success', timestamp: new Date().toLocaleTimeString() };
            if (response.status === 200) {
              newSteps[1] = { ...newSteps[1], status: 'success', timestamp: new Date().toLocaleTimeString() };
              newSteps[2] = { ...newSteps[2], status: 'success', timestamp: new Date().toLocaleTimeString() };
              newSteps[3] = { ...newSteps[3], status: 'success', timestamp: new Date().toLocaleTimeString() };
            } else {
              newSteps[1] = { ...newSteps[1], status: 'error', timestamp: new Date().toLocaleTimeString() };
              newSteps[2] = { ...newSteps[2], status: 'error', timestamp: new Date().toLocaleTimeString() };
              newSteps[3] = { ...newSteps[3], status: 'error', timestamp: new Date().toLocaleTimeString() };
            }
            return newSteps;
          });
        }
        
        return response.clone();
      } catch (error) {
        const duration = performance.now() - startTime;
        addLog(`API call error: ${method} ${url} - ${error}`);
        
        const apiCall: ApiCall = {
          url,
          method,
          status: 0,
          duration: Math.round(duration),
          timestamp: new Date().toISOString()
        };
        
        setApiCalls(prev => [apiCall, ...prev].slice(0, 20));
        
        if (url.includes('chat-with-rag') || url.includes('chat-rag')) {
          setRagSteps(prev => {
            const newSteps = [...prev];
            newSteps[0] = { ...newSteps[0], status: 'success', timestamp: new Date().toLocaleTimeString() };
            newSteps[1] = { ...newSteps[1], status: 'error', timestamp: new Date().toLocaleTimeString() };
            newSteps[2] = { ...newSteps[2], status: 'error', timestamp: new Date().toLocaleTimeString() };
            newSteps[3] = { ...newSteps[3], status: 'error', timestamp: new Date().toLocaleTimeString() };
            return newSteps;
          });
        }
        
        throw error;
      }
    };
    
    addLog("Fetch API interceptor installed");
  };
  
  const cleanupFetchInterceptor = () => {
    addLog("Fetch API interceptor removed");
  };
  
  const runTests = () => {
    addLog("Running manual diagnostics...");
    
    const chatContainer = document.querySelector('.smart-chat-container');
    if (chatContainer) {
      const rect = chatContainer.getBoundingClientRect();
      addLog(`Container dimensions: ${rect.width}x${rect.height}`);
    } else {
      addLog("ERROR: Chat container not found");
    }
    
    testApiConnection();
    
    addLog(`Scroll position: ${window.scrollX}x${window.scrollY}`);
    
    const isVisible = document.visibilityState === 'visible';
    addLog(`Page visibility: ${isVisible ? 'visible' : 'hidden'}`);
    
    simulateRagProcess();
    
    if (window.console && console.error) {
      const originalError = console.error;
      console.error = function(...args) {
        addLog(`Console error: ${args.join(' ')}`);
        originalError.apply(console, args);
      };
      
      setTimeout(() => {
        console.error = originalError;
      }, 1000);
    }
  };
  
  const testApiConnection = async () => {
    addLog("Testing API connection to edge functions...");
    try {
      const pingUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-journal/health`;
      addLog(`Sending ping to: ${pingUrl}`);
      
      const pingResponse = await fetch(pingUrl, { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        } 
      });
      
      if (pingResponse.ok) {
        const pingJson = await pingResponse.json();
        addLog(`API connection test successful: ${JSON.stringify(pingJson)}`);
      } else {
        addLog(`API connection test failed: ${pingResponse.status}`);
        const errorText = await pingResponse.text();
        addLog(`Error details: ${errorText}`);
      }
    } catch (error) {
      addLog(`API connection test error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  const simulateRagProcess = () => {
    addLog("Simulating RAG process...");
    
    setRagSteps([
      { id: 1, step: "Query Understanding", status: 'loading', timestamp: new Date().toLocaleTimeString() },
      { id: 2, step: "Vector Search", status: 'pending' },
      { id: 3, step: "Context Retrieval", status: 'pending' },
      { id: 4, step: "Response Generation", status: 'pending' }
    ]);
    
    setTimeout(() => {
      setRagSteps(prev => {
        const newSteps = [...prev];
        newSteps[0] = { ...newSteps[0], status: 'success', details: "Query classified as informational" };
        newSteps[1] = { ...newSteps[1], status: 'loading', timestamp: new Date().toLocaleTimeString() };
        return newSteps;
      });
      
      setTimeout(() => {
        setRagSteps(prev => {
          const newSteps = [...prev];
          newSteps[1] = { ...newSteps[1], status: 'success', details: "Found 3 relevant chunks" };
          newSteps[2] = { ...newSteps[2], status: 'loading', timestamp: new Date().toLocaleTimeString() };
          return newSteps;
        });
        
        setTimeout(() => {
          setRagSteps(prev => {
            const newSteps = [...prev];
            newSteps[2] = { ...newSteps[2], status: 'success', details: "Retrieved context from journal entries" };
            newSteps[3] = { ...newSteps[3], status: 'loading', timestamp: new Date().toLocaleTimeString() };
            return newSteps;
          });
          
          setTimeout(() => {
            setRagSteps(prev => {
              const newSteps = [...prev];
              newSteps[3] = { ...newSteps[3], status: 'success', details: "Generated response with LLM" };
              return newSteps;
            });
            addLog("RAG process simulation completed");
          }, 800);
        }, 600);
      }, 500);
    }, 300);
  };
  
  const getStepIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Success</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Error</Badge>;
      case 'loading':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Loading</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };
  
  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="fixed bottom-4 left-4 z-50 bg-red-100 hover:bg-red-200 text-red-800"
        onClick={() => setIsOpen(true)}
        style={{
          opacity: 0.95,
          border: '2px solid red',
          padding: '8px',
          bottom: "120px",
        }}
      >
        <Smartphone className="h-4 w-4 mr-2" />
        Debug
      </Button>
    );
  }
  
  return (
    <Card className="fixed bottom-16 left-0 right-0 z-50 h-[60vh] m-2 shadow-lg">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">
          Mobile Diagnostics
          {isMobile ? (
            <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-800">Mobile</Badge>
          ) : (
            <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800">Desktop</Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-3">
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="api">API Calls</TabsTrigger>
            <TabsTrigger value="rag">RAG Steps</TabsTrigger>
          </TabsList>
          
          <TabsContent value="logs" className="mt-0">
            <div className="flex flex-col gap-2 mb-3">
              <div className="text-xs font-semibold flex items-center">
                <Info className="h-3 w-3 mr-1" /> Device Information
              </div>
              <div className="bg-slate-50 p-2 rounded text-xs overflow-x-auto">
                <pre>{JSON.stringify(deviceInfo, null, 2)}</pre>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" /> Debug Log
              </div>
              <Button variant="outline" size="sm" onClick={runTests} className="text-xs h-7 px-2">
                Run Tests
              </Button>
            </div>
            
            <ScrollArea className="h-[calc(60vh-200px)] border rounded">
              <div className="p-2 text-xs space-y-1">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="font-mono border-l-2 border-slate-300 pl-2 py-1">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">No logs yet</div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="api" className="mt-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold flex items-center">
                <Server className="h-3 w-3 mr-1" /> API Call Monitoring
              </div>
              <Button variant="outline" size="sm" onClick={testApiConnection} className="text-xs h-7 px-2">
                Test API
              </Button>
            </div>
            
            <ScrollArea className="h-[calc(60vh-170px)] border rounded">
              <div className="p-2 text-xs space-y-2">
                {apiCalls.length > 0 ? (
                  apiCalls.map((call, index) => (
                    <div key={index} className="font-mono border-l-2 border-slate-300 pl-2 py-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{call.method} {call.url.split('?')[0]}</span>
                        <Badge 
                          variant="outline" 
                          className={`${
                            call.status >= 200 && call.status < 300 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {call.status > 0 ? call.status : 'Failed'} ({call.duration}ms)
                        </Badge>
                      </div>
                      <div className="text-gray-500 mt-1 text-[10px]">
                        {new Date(call.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">No API calls recorded yet</div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="rag" className="mt-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold flex items-center">
                <FileSearch className="h-3 w-3 mr-1" /> RAG Process Diagnostics
              </div>
              <Button variant="outline" size="sm" onClick={simulateRagProcess} className="text-xs h-7 px-2">
                Simulate RAG
              </Button>
            </div>
            
            <ScrollArea className="h-[calc(60vh-170px)] border rounded">
              <div className="p-2 text-xs space-y-2">
                {ragSteps.map((step) => (
                  <div key={step.id} className="border-l-2 border-slate-300 pl-2 py-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{step.step}</span>
                      {getStepIcon(step.status)}
                    </div>
                    {step.details && (
                      <div className="mt-1 text-gray-600">{step.details}</div>
                    )}
                    {step.timestamp && (
                      <div className="text-gray-500 mt-1 text-[10px]">{step.timestamp}</div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
