
import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useNavigate } from 'react-router-dom';
import { X, InfoIcon, Bug } from 'lucide-react';

export function MobileDebugOverlay() {
  const [visible, setVisible] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, any>>({});
  const [domInfo, setDomInfo] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Force this component to be visible
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('mobileDebug') === 'true';
    
    if (debugMode) {
      console.log('MobileDebugOverlay activated');
      setVisible(true);
      
      // Collect device info
      const info = {
        url: window.location.href,
        route: location.pathname,
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
        },
        devicePixelRatio: window.devicePixelRatio,
        timeStamp: new Date().toISOString(),
      };
      
      setDeviceInfo(info);
      
      // Check DOM structure
      analyzeDom();
      
      // Force correct viewport settings
      const metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        const content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        metaViewport.setAttribute('content', content);
      }
    }
  }, [location]);
  
  const analyzeDom = () => {
    const domInfo: string[] = [];
    const rootElement = document.getElementById('root');
    
    if (rootElement) {
      domInfo.push(`Root element found: ${rootElement.children.length} children`);
      
      // Check for common container elements
      const containers = rootElement.querySelectorAll('.container, .chat-container, .smart-chat-container');
      domInfo.push(`Found ${containers.length} container elements`);
      
      // Look for elements with display:none or visibility:hidden
      const hiddenElements = rootElement.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"]');
      domInfo.push(`Found ${hiddenElements.length} hidden elements`);
      
      // Check if our expected components are in DOM
      const chatInterface = rootElement.querySelector('.smart-chat-interface');
      domInfo.push(`Smart chat interface: ${chatInterface ? 'Found' : 'Not found'}`);
      
      // Check overflow properties
      const overflowHidden = rootElement.querySelectorAll('[style*="overflow: hidden"]');
      domInfo.push(`Elements with overflow:hidden: ${overflowHidden.length}`);
    } else {
      domInfo.push('Root element not found');
    }
    
    setDomInfo(domInfo);
  };
  
  const forceBrowserReload = () => {
    window.location.reload();
  };
  
  const navigateToSmartChat = () => {
    navigate('/smart-chat?debug=true&mobileDemo=true');
  };
  
  // If not visible, render nothing
  if (!visible) return null;
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255,255,255,0.95)',
        zIndex: 9999,
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto'
      }}
    >
      <Card className="w-full">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-md flex items-center">
            <Bug className="h-4 w-4 mr-2" />
            Mobile Debug Overlay
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setVisible(false)}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm font-medium">Current Route: {location.pathname}</div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">Navigation:</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                  Home
                </Button>
                <Button variant="outline" size="sm" onClick={navigateToSmartChat}>
                  Smart Chat (Debug)
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/journal')}>
                  Journal
                </Button>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-medium">DOM Analysis:</div>
              <div className="bg-slate-50 p-2 rounded text-xs">
                {domInfo.map((info, i) => (
                  <div key={i} className="py-1">{info}</div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={analyzeDom} className="mt-1">
                Refresh DOM Analysis
              </Button>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-medium">Device Info:</div>
              <div className="bg-slate-50 p-2 rounded text-xs overflow-x-auto">
                <pre>{JSON.stringify(deviceInfo, null, 2)}</pre>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">Actions:</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={forceBrowserReload} variant="outline" size="sm">
                  Force Reload
                </Button>
                <Button 
                  onClick={() => {
                    const style = document.createElement('style');
                    style.innerHTML = '* { transition: none !important; animation: none !important; opacity: 1 !important; visibility: visible !important; }';
                    document.head.appendChild(style);
                    alert('CSS transitions disabled');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Disable CSS Transitions
                </Button>
                <Button 
                  onClick={() => {
                    document.querySelectorAll('.smart-chat-interface, .chat-container, .container').forEach(el => {
                      (el as HTMLElement).style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; overflow: visible !important;';
                    });
                    alert('Forced visibility on containers');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Force Container Visibility
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default MobileDebugOverlay;
