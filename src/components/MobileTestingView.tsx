
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * MobileTestingView - A component to help debug mobile rendering issues
 * This provides quick navigation to different routes and displays useful debugging information
 */
export function MobileTestingView() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const testRoutes = [
    { name: 'Home', path: '/' },
    { name: 'Smart Chat', path: '/smart-chat?debug=true' },
    { name: 'Journal', path: '/journal' },
    { name: 'Settings', path: '/settings' }
  ];
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Force visibility on mobile
  useEffect(() => {
    if (containerRef.current) {
      console.log('MobileTestingView mounted, ensuring visibility');
      
      // Force visibility after a small delay
      const timer = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.display = 'block';
          containerRef.current.style.opacity = '1';
          containerRef.current.style.visibility = 'visible';
          containerRef.current.style.zIndex = '999';
          console.log('Forced visibility on testing view');
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Log viewport details
  useEffect(() => {
    console.log('Viewport dimensions:', {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
      visualViewport: {
        width: window.visualViewport?.width,
        height: window.visualViewport?.height,
        scale: window.visualViewport?.scale,
      }
    });
    
    // Fix viewport meta tag
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      const content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      console.log('Setting viewport meta tag:', content);
      metaViewport.setAttribute('content', content);
    }
  }, []);

  const deviceInfo = {
    isMobile,
    userAgent: navigator.userAgent,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    platform: navigator.platform,
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background p-4 overflow-auto"
      style={{ 
        display: 'block', 
        visibility: 'visible',
        opacity: 1
      }}
    >
      <Card className="w-full mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Mobile Testing View</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm font-medium">Navigation:</p>
            <div className="flex flex-wrap gap-2">
              {testRoutes.map((route) => (
                <Button 
                  key={route.path} 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(route.path)}
                >
                  {route.name}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="mt-4">
            <p className="text-sm font-medium mb-1">Device Information:</p>
            <div className="bg-muted p-2 rounded-md text-xs font-mono overflow-x-auto">
              <pre>{JSON.stringify(deviceInfo, null, 2)}</pre>
            </div>
          </div>
          
          <Button 
            className="w-full mt-4 bg-green-600 hover:bg-green-700" 
            onClick={() => {
              const urlParams = new URLSearchParams(window.location.search);
              urlParams.set('mobileDemo', 'true');
              navigate(`/smart-chat?${urlParams.toString()}`);
            }}
          >
            Test Smart Chat with mobileDemo=true
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full mt-2" 
            onClick={() => {
              if (containerRef.current) {
                containerRef.current.style.display = 'none';
              }
            }}
          >
            Hide This Panel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default MobileTestingView;
