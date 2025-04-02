
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Smartphone, AlertTriangle, Bug, RotateCw } from "lucide-react";

export function MobileBrowserDebug() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, any>>({});
  const isMobile = useIsMobile();
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    // Log initial load
    addLog("MobileBrowserDebug component mounted");
    
    // Collect device information
    const info = {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        visualViewport: {
          width: window.visualViewport?.width,
          height: window.visualViewport?.height,
          scale: window.visualViewport?.scale,
        },
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        orientation: window.screen.orientation?.type,
      },
      devicePixelRatio: window.devicePixelRatio,
      isMobileDetected: isMobile,
      isMobileOverride: typeof window.__forceMobileView !== 'undefined',
      timeStamp: new Date().toISOString(),
    };
    
    setDeviceInfo(info);
    addLog(`Device info collected: ${window.innerWidth}x${window.innerHeight}, Ratio: ${window.devicePixelRatio}`);

    // Add resize listener
    const handleResize = () => {
      addLog(`Window resized: ${window.innerWidth}x${window.innerHeight}`);
      setRenderCount(prev => prev + 1);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Check HTML meta viewport tag
    const metaViewport = document.querySelector('meta[name="viewport"]');
    addLog(`Viewport meta tag: ${metaViewport ? metaViewport.getAttribute('content') : 'Not found'}`);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };
  
  const runTests = () => {
    addLog("Running diagnostics...");
    
    // Test DOM rendering
    addLog(`Body dimensions: ${document.body.clientWidth}x${document.body.clientHeight}`);
    
    // Check if main app container exists
    const appRoot = document.getElementById('root');
    if (appRoot) {
      const rect = appRoot.getBoundingClientRect();
      addLog(`App root found: ${rect.width}x${rect.height}`);
    } else {
      addLog("ERROR: App root not found in DOM");
    }
    
    // Check viewport meta tags
    const metaViewport = document.querySelector('meta[name="viewport"]');
    addLog(`Viewport meta: ${metaViewport ? metaViewport.getAttribute('content') : 'Not found'}`);
    
    // Force trigger a reflow
    addLog("Forcing layout recalculation");
    document.body.style.visibility = 'hidden';
    setTimeout(() => {
      document.body.style.visibility = 'visible';
      addLog("Layout recalculation complete");
    }, 50);
    
    // Toggle mobile view for testing
    if (window.toggleMobileView) {
      window.toggleMobileView();
      addLog(`Toggled mobile view: ${window.__forceMobileView}`);
    }
    
    // Update render count
    setRenderCount(prev => prev + 1);
  };
  
  // Always show a small indicator, even when debug panel is closed
  return (
    <>
      {!isOpen ? (
        <Button 
          variant="outline" 
          size="sm" 
          className="fixed bottom-4 right-4 z-[9999] bg-red-100 hover:bg-red-200 text-red-800 shadow-lg animate-pulse"
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
      ) : (
        <Card className="fixed bottom-0 left-0 right-0 z-[9999] h-[60vh] m-2 shadow-lg border-2 border-red-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center">
              <Smartphone className="h-4 w-4 mr-2" />
              Mobile Browser Debug
              <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-800">
                {isMobile ? 'Mobile' : 'Desktop'}
              </Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={runTests} className="h-8 px-2">
                <RotateCw className="h-3 w-3 mr-1" />
                Test
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex flex-col gap-2 mb-3">
              <div className="text-xs font-semibold flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" /> Device Information
              </div>
              <div className="bg-slate-50 p-2 rounded text-xs overflow-x-auto">
                <pre>{JSON.stringify(deviceInfo, null, 2)}</pre>
              </div>
            </div>
            
            <div className="text-xs font-semibold mb-2">Debug Log</div>
            
            <ScrollArea className="h-[calc(60vh-180px)] border rounded">
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
      )}
    </>
  );
}

// Add global type for forcing mobile view override
declare global {
  interface Window {
    __forceMobileView?: boolean;
    toggleMobileView?: () => void;
  }
}
