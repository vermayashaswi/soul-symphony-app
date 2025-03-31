
import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useNavigate } from 'react-router-dom';
import { X, InfoIcon, Bug, RefreshCw, AlertTriangle, Smartphone } from 'lucide-react';

export function MobileDebugOverlay() {
  const [visible, setVisible] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, any>>({});
  const [domInfo, setDomInfo] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
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
    const errors: string[] = [];
    const rootElement = document.getElementById('root');
    
    if (rootElement) {
      domInfo.push(`Root element found: ${rootElement.children.length} children`);
      
      try {
        // Debug React components
        const mainApp = rootElement.querySelector('[class*="container"]');
        if (mainApp) {
          domInfo.push(`Main app container found: ${mainApp.children.length} children`);
        } else {
          errors.push('ERROR: Main app container not found');
        }
        
        // Check for smart chat specific elements
        const smartChatInterface = document.querySelector('.smart-chat-interface');
        if (smartChatInterface) {
          domInfo.push(`Smart chat interface found: ${smartChatInterface.children.length} children`);
          const rect = smartChatInterface.getBoundingClientRect();
          domInfo.push(`SmartChat dimensions: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
          domInfo.push(`SmartChat position: top=${Math.round(rect.top)}, left=${Math.round(rect.left)}`);
          
          // Check if it's actually visible
          const styles = window.getComputedStyle(smartChatInterface);
          domInfo.push(`SmartChat visibility: ${styles.visibility}, opacity: ${styles.opacity}`);
          domInfo.push(`SmartChat display: ${styles.display}`);
          
          if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
            errors.push('ERROR: SmartChat is in DOM but not visible!');
          }
        } else {
          errors.push('ERROR: Smart chat interface not found in DOM');
        }
        
        // Check react root
        const reactRoot = rootElement.querySelector('[data-reactroot]');
        if (reactRoot) {
          domInfo.push('React root found in DOM');
        } else {
          errors.push('WARNING: React root not found, possible unmounting issue');
        }
        
        // Check for animations causing issues
        const animatingElements = rootElement.querySelectorAll('[class*="animate-"]');
        if (animatingElements.length > 0) {
          domInfo.push(`Found ${animatingElements.length} animating elements`);
        }
        
        // Check if framer motion exists
        const framerElements = rootElement.querySelectorAll('[style*="transform"]');
        if (framerElements.length > 0) {
          domInfo.push(`Found ${framerElements.length} elements with transforms`);
        }
      } catch (e) {
        errors.push(`DOM analysis error: ${e.message}`);
      }
    } else {
      errors.push('ERROR: Root element not found');
    }
    
    setDomInfo(domInfo);
    setErrors(errors);
  };
  
  const forceRender = () => {
    // Add the SmartChatInterface directly to the body if it doesn't exist
    if (!document.querySelector('.smart-chat-interface')) {
      addLog('Force rendering SmartChat');
      
      try {
        // Try to force the interface to render by navigating to smart-chat
        navigate('/smart-chat?debug=true&forceMobile=true');
        
        // Add temporary emergency styles to ensure visibility
        const style = document.createElement('style');
        style.textContent = `
          .smart-chat-interface, .smart-chat-container {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            min-height: 70vh !important;
          }
          
          .container {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
          analyzeDom();
        }, 1000);
      } catch (e) {
        addLog(`Error forcing render: ${e.message}`);
      }
    }
  };
  
  const forceBrowserReload = () => {
    window.location.reload();
  };
  
  const addLog = (message: string) => {
    setDomInfo(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };
  
  const resetApp = () => {
    // Clear any React state issues
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to root
      window.location.href = '/?mobileDebug=true';
    } catch (e) {
      addLog(`Error resetting app: ${e.message}`);
    }
  };
  
  // If not visible, render the button to open the debug panel
  if (!visible) return (
    <Button 
      variant="outline" 
      size="sm" 
      className="fixed bottom-4 left-4 z-50 bg-red-100 hover:bg-red-200 text-red-800"
      onClick={() => setVisible(true)}
    >
      <Smartphone className="h-4 w-4 mr-2" />
      Debug
    </Button>
  );
  
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
            
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs space-y-1">
                <div className="font-semibold text-red-700 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Critical Issues Detected:
                </div>
                {errors.map((error, i) => (
                  <div key={i} className="text-red-600">{error}</div>
                ))}
                
                <div className="flex gap-2 mt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="bg-red-100 text-red-800 hover:bg-red-200 text-xs"
                    onClick={forceRender}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Force Render
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs"
                    onClick={resetApp}
                  >
                    Reset App
                  </Button>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <div className="text-sm font-medium">Navigation:</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                  Home
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/smart-chat?debug=true&forceMobile=true')}
                >
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
                    style.innerHTML = '* { transition: none !important; animation: none !important; }';
                    document.head.appendChild(style);
                    addLog('CSS transitions disabled');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Disable CSS Transitions
                </Button>
                <Button 
                  onClick={() => {
                    document.querySelectorAll('.smart-chat-interface, .chat-container, .container, [class*="container"]').forEach(el => {
                      (el as HTMLElement).style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important;';
                    });
                    addLog('Forced visibility on containers');
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
