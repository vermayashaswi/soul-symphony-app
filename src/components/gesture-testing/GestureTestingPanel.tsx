import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDualModeGestureDetection } from '@/hooks/use-dual-mode-gesture-detection';
import { useWebViewGestureOptimizer } from '@/hooks/use-webview-gesture-optimizer';
import { useEnvironmentDetection } from '@/hooks/use-environment-detection';
import { useUnifiedKeyboard } from '@/hooks/use-unified-keyboard';

interface GestureEvent {
  type: 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down';
  timestamp: number;
  mode: 'capacitor' | 'browser';
}

/**
 * Comprehensive gesture testing panel for validating Capacitor WebView optimizations
 */
export const GestureTestingPanel: React.FC = () => {
  const [gestureEvents, setGestureEvents] = useState<GestureEvent[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  
  // Environment detection
  const environment = useEnvironmentDetection();
  const { isKeyboardVisible, keyboardHeight } = useUnifiedKeyboard();
  
  // WebView optimizations
  const webViewOptimizer = useWebViewGestureOptimizer();
  
  // Gesture detection with logging
  const gestureDetection = useDualModeGestureDetection({
    onSwipeLeft: () => {
      const event: GestureEvent = {
        type: 'swipe-left',
        timestamp: Date.now(),
        mode: gestureDetection.mode as 'capacitor' | 'browser'
      };
      setGestureEvents(prev => [...prev, event]);
      console.log('[GestureTest] Swipe left detected:', event);
    },
    onSwipeRight: () => {
      const event: GestureEvent = {
        type: 'swipe-right',
        timestamp: Date.now(),
        mode: gestureDetection.mode as 'capacitor' | 'browser'
      };
      setGestureEvents(prev => [...prev, event]);
      console.log('[GestureTest] Swipe right detected:', event);
    },
    onSwipeUp: () => {
      const event: GestureEvent = {
        type: 'swipe-up',
        timestamp: Date.now(),
        mode: gestureDetection.mode as 'capacitor' | 'browser'
      };
      setGestureEvents(prev => [...prev, event]);
      console.log('[GestureTest] Swipe up detected:', event);
    },
    onSwipeDown: () => {
      const event: GestureEvent = {
        type: 'swipe-down',
        timestamp: Date.now(),
        mode: gestureDetection.mode as 'capacitor' | 'browser'
      };
      setGestureEvents(prev => [...prev, event]);
      console.log('[GestureTest] Swipe down detected:', event);
    },
    minDistance: 50,
    disabled: !isTestMode,
    debugMode: true
  });

  const clearEvents = () => setGestureEvents([]);
  
  const getStatusColor = (status: boolean) => status ? 'bg-green-500' : 'bg-red-500';
  
  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Gesture Testing Panel</CardTitle>
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsTestMode(!isTestMode)}
              variant={isTestMode ? 'destructive' : 'default'}
            >
              {isTestMode ? 'Stop Testing' : 'Start Testing'}
            </Button>
            <Button onClick={clearEvents} variant="outline">
              Clear Events
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Environment Status */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Environment</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Badge className={getStatusColor(environment.isCapacitorWebView)}>
                Capacitor WebView: {environment.isCapacitorWebView ? 'Yes' : 'No'}
              </Badge>
              <Badge className={getStatusColor(environment.isMobileBrowser)}>
                Mobile Browser: {environment.isMobileBrowser ? 'Yes' : 'No'}
              </Badge>
              <Badge>Platform: {environment.platform}</Badge>
              <Badge>Mode: {gestureDetection.mode}</Badge>
            </div>
          </div>

          {/* Optimization Status */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Optimizations</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Badge className={getStatusColor(webViewOptimizer.isOptimized)}>
                WebView Optimized: {webViewOptimizer.isOptimized ? 'Yes' : 'No'}
              </Badge>
              <Badge className={getStatusColor(webViewOptimizer.optimizationState.touchActionOptimized)}>
                Touch Actions: {webViewOptimizer.optimizationState.touchActionOptimized ? 'Optimized' : 'Default'}
              </Badge>
              <Badge className={getStatusColor(webViewOptimizer.optimizationState.deviceSpecificOptimized)}>
                Device Specific: {webViewOptimizer.optimizationState.deviceSpecificOptimized ? 'Applied' : 'None'}
              </Badge>
              <Badge className={getStatusColor(webViewOptimizer.optimizationState.eventListenersOptimized)}>
                Event Listeners: {webViewOptimizer.optimizationState.eventListenersOptimized ? 'Optimized' : 'Default'}
              </Badge>
            </div>
          </div>

          {/* Device Info */}
          {webViewOptimizer.deviceInfo && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Device Info</h3>
              <div className="text-sm space-y-1">
                <div>Manufacturer: {webViewOptimizer.deviceInfo.manufacturer || 'Unknown'}</div>
                <div>Model: {webViewOptimizer.deviceInfo.model || 'Unknown'}</div>
                <div>OS Version: {webViewOptimizer.deviceInfo.osVersion || 'Unknown'}</div>
                <div>WebView Version: {webViewOptimizer.deviceInfo.webViewVersion || 'Unknown'}</div>
              </div>
            </div>
          )}

          {/* Keyboard Status */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Keyboard Status</h3>
            <div className="flex gap-2 text-sm">
              <Badge className={getStatusColor(isKeyboardVisible)}>
                Visible: {isKeyboardVisible ? 'Yes' : 'No'}
              </Badge>
              <Badge>Height: {keyboardHeight}px</Badge>
              {gestureDetection.capacitorStatus && (
                <Badge className={getStatusColor(!gestureDetection.capacitorStatus.gestureBlocked)}>
                  Gestures: {gestureDetection.capacitorStatus.gestureBlocked ? 'Blocked' : 'Active'}
                </Badge>
              )}
            </div>
          </div>

          {/* Test Area */}
          {isTestMode && (
            <div 
              ref={gestureDetection.ref as React.RefObject<HTMLDivElement>}
              className="border-2 border-dashed border-gray-300 p-8 text-center gesture-container"
              style={{ minHeight: '200px' }}
            >
              <h3 className="text-lg font-semibold mb-2">Swipe Test Area</h3>
              <p className="text-gray-600 mb-4">
                Swipe in any direction within this area to test gesture detection.
                {isKeyboardVisible && (
                  <span className="block text-orange-600 font-medium">
                    ⚠️ Keyboard is visible - gestures may be limited
                  </span>
                )}
              </p>
              
              {/* Recent Events */}
              <div className="space-y-2">
                <h4 className="font-medium">Recent Gestures:</h4>
                {gestureEvents.slice(-5).reverse().map((event, index) => (
                  <div key={event.timestamp} className="text-sm bg-gray-100 p-2 rounded">
                    <Badge className="mr-2">{event.mode}</Badge>
                    {event.type} at {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                ))}
                {gestureEvents.length === 0 && (
                  <p className="text-gray-500 italic">No gestures detected yet</p>
                )}
              </div>
            </div>
          )}

          {/* Event Log */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">
              Event Log ({gestureEvents.length} total)
            </h3>
            <div className="max-h-40 overflow-y-auto text-sm">
              {gestureEvents.map((event, index) => (
                <div key={`${event.timestamp}-${index}`} className="py-1 border-b border-gray-200">
                  <Badge className="mr-2">{event.mode}</Badge>
                  <span className="font-medium">{event.type}</span>
                  <span className="text-gray-500 ml-2">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};