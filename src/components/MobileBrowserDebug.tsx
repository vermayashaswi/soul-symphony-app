
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Smartphone, Bug, RotateCw, Maximize, Minimize } from "lucide-react";
import { useLocation } from "react-router-dom";

export function MobileBrowserDebug() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, any>>({});
  const isMobile = useIsMobile();
  const [renderCount, setRenderCount] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Log initial load
    addLog("MobileBrowserDebug component mounted");
    addLog(`Current route: ${location.pathname}`);
    
    // Collect basic device information
    const info = {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      devicePixelRatio: window.devicePixelRatio,
      isMobile: isMobile,
      timeStamp: new Date().toISOString(),
      currentRoute: location.pathname
    };
    
    setDeviceInfo(info);
    addLog(`Device info collected: ${window.innerWidth}x${window.innerHeight}, Ratio: ${window.devicePixelRatio}`);

    // Add resize listener
    const handleResize = () => {
      addLog(`Window resized: ${window.innerWidth}x${window.innerHeight}`);
      setRenderCount(prev => prev + 1);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, location]);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };
  
  const runTests = () => {
    addLog("Running diagnostics...");
    addLog(`Body dimensions: ${document.body.clientWidth}x${document.body.clientHeight}`);
    addLog(`Viewport dimensions: ${window.innerWidth}x${window.innerHeight}`);
    addLog(`Device pixel ratio: ${window.devicePixelRatio}`);
    
    // Test API health if on Journal page
    if (location.pathname.includes('journal')) {
      testProcessJournalConnection();
    }
    
    setRenderCount(prev => prev + 1);
  };

  const testProcessJournalConnection = async () => {
    addLog("Testing process-journal API connection...");
    try {
      const healthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-journal/health`;
      addLog(`Sending health check to: ${healthUrl}`);
      
      const response = await fetch(healthUrl, { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        addLog(`Health check successful: ${JSON.stringify(data)}`);
      } else {
        addLog(`Health check failed: ${response.status}`);
        const errorText = await response.text();
        addLog(`Error details: ${errorText}`);
      }
    } catch (error) {
      addLog(`Health check error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    addLog(`Toggled ${!isFullScreen ? 'full screen' : 'normal'} mode`);
  };
  
  // Always show a small indicator when debug panel is closed
  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="fixed bottom-20 right-4 z-[9999] bg-red-100 hover:bg-red-200 text-red-800 shadow-lg"
        onClick={() => setIsOpen(true)}
        style={{
          opacity: 0.95,
          border: '2px solid red',
          padding: '8px',
        }}
      >
        <Bug className="h-4 w-4 mr-2" />
        Debug ({renderCount})
      </Button>
    );
  }
  
  // When open, show debug panel
  return (
    <Card 
      className={`fixed z-[9999] border-2 border-red-500 shadow-lg transition-all duration-300 ${
        isFullScreen 
          ? 'inset-0 m-0 rounded-none h-full' 
          : 'bottom-16 left-0 right-0 h-[60vh] m-2'
      }`}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center">
          <Smartphone className="h-4 w-4 mr-2" />
          Debug
          <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-800">
            {isMobile ? 'Mobile' : 'Desktop'}
          </Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runTests} className="h-8 px-2">
            <RotateCw className="h-3 w-3 mr-1" />
            Test
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullScreen} className="h-8 px-2">
            {isFullScreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="flex flex-col gap-2 mb-3">
          <div className="text-xs font-semibold">Device Information</div>
          <div className="bg-slate-50 p-2 rounded text-xs overflow-x-auto">
            <pre>{JSON.stringify(deviceInfo, null, 2)}</pre>
          </div>
        </div>
        
        <div className="text-xs font-semibold mb-2">Debug Log</div>
        
        <ScrollArea className={`border rounded ${isFullScreen ? 'h-[calc(100vh-160px)]' : 'h-[calc(60vh-180px)]'}`}>
          <div className="p-2 text-xs space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="font-mono border-l-2 border-slate-300 pl-2 py-1">
                {log}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Add global type for forcing mobile view override
declare global {
  interface Window {
    __forceMobileView?: boolean;
    toggleMobileView?: () => void;
  }
}
