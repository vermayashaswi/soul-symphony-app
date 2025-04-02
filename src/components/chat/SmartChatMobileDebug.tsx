
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Smartphone, Laptop, Info, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function SmartChatMobileDebug() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, any>>({});
  const isMobile = useIsMobile();

  useEffect(() => {
    // Log initial info
    addLog("Debug component mounted");
    
    // Collect device and browser information
    const info = {
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      isMobileDetected: isMobile,
      timeStamp: new Date().toISOString()
    };
    
    setDeviceInfo(info);
    addLog(`Device info collected: ${window.innerWidth}x${window.innerHeight}, Pixel ratio: ${window.devicePixelRatio}`);
    
    // Test DOM elements
    setTimeout(() => {
      const chatInterface = document.querySelector('.smart-chat-interface');
      if (chatInterface) {
        addLog("Chat interface found in DOM");
        const rect = chatInterface.getBoundingClientRect();
        addLog(`Chat interface dimensions: ${rect.width}x${rect.height}`);
      } else {
        addLog("ERROR: Chat interface not found in DOM");
      }
    }, 500);
    
    // Listener for resize events
    const handleResize = () => {
      addLog(`Window resized: ${window.innerWidth}x${window.innerHeight}`);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };
  
  const runTests = () => {
    addLog("Running manual diagnostics...");
    
    // Test layout dimensions
    const chatContainer = document.querySelector('.smart-chat-container');
    if (chatContainer) {
      const rect = chatContainer.getBoundingClientRect();
      addLog(`Container dimensions: ${rect.width}x${rect.height}`);
    } else {
      addLog("ERROR: Chat container not found");
    }
    
    // Test scroll positions
    addLog(`Scroll position: ${window.scrollX}x${window.scrollY}`);
    
    // Test visibility
    const isVisible = document.visibilityState === 'visible';
    addLog(`Page visibility: ${isVisible ? 'visible' : 'hidden'}`);
    
    // Check for any errors in console
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
          bottom: "120px", // Position it higher on mobile to be visible above the navbar
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
        
        <ScrollArea className="h-[calc(60vh-150px)] border rounded">
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
      </CardContent>
    </Card>
  );
}
