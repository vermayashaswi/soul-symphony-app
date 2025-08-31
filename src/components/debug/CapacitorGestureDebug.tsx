import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GestureTestingPanel } from '../gesture-testing/GestureTestingPanel';

/**
 * Debug component specifically for Capacitor gesture optimization
 */
export const CapacitorGestureDebug: React.FC = () => {
  const [capacitorInfo, setCapacitorInfo] = useState<any>({});
  const [keyboardInfo, setKeyboardInfo] = useState<any>({});
  const [showTestPanel, setShowTestPanel] = useState(false);

  useEffect(() => {
    const gatherCapacitorInfo = async () => {
      const info = {
        isNative: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform(),
        isPluginAvailable: {
          keyboard: Capacitor.isPluginAvailable('Keyboard'),
          device: Capacitor.isPluginAvailable('Device'),
          statusBar: Capacitor.isPluginAvailable('StatusBar')
        },
        configuration: {
          keyboardResize: 'native', // From our config
          resizeOnFullScreen: true,
          accessoryBarVisible: false
        }
      };
      
      setCapacitorInfo(info);
      console.log('[CapacitorGestureDebug] Capacitor info:', info);
    };

    gatherCapacitorInfo();

    if (Capacitor.isNativePlatform()) {
      // Set up keyboard listeners for debugging
      const keyboardWillShow = (info: any) => {
        setKeyboardInfo(prev => ({ ...prev, willShow: info, isVisible: true }));
        console.log('[CapacitorGestureDebug] Keyboard will show:', info);
      };

      const keyboardDidShow = (info: any) => {
        setKeyboardInfo(prev => ({ ...prev, didShow: info, isVisible: true }));
        console.log('[CapacitorGestureDebug] Keyboard did show:', info);
      };

      const keyboardWillHide = () => {
        setKeyboardInfo(prev => ({ ...prev, willHide: true, isVisible: false }));
        console.log('[CapacitorGestureDebug] Keyboard will hide');
      };

      const keyboardDidHide = () => {
        setKeyboardInfo(prev => ({ ...prev, didHide: true, isVisible: false }));
        console.log('[CapacitorGestureDebug] Keyboard did hide');
      };

      if (Capacitor.isPluginAvailable('Keyboard')) {
        Keyboard.addListener('keyboardWillShow', keyboardWillShow);
        Keyboard.addListener('keyboardDidShow', keyboardDidShow);
        Keyboard.addListener('keyboardWillHide', keyboardWillHide);
        Keyboard.addListener('keyboardDidHide', keyboardDidHide);

        return () => {
          Keyboard.removeAllListeners();
        };
      }
    }
  }, []);

  if (!Capacitor.isNativePlatform()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capacitor Gesture Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge className="bg-orange-500">Not Running in Capacitor WebView</Badge>
          <p className="mt-2 text-sm text-gray-600">
            This debug panel is only active when running in a Capacitor native app.
            Current platform: {Capacitor.getPlatform()}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Capacitor Gesture Debug</CardTitle>
          <Button 
            onClick={() => setShowTestPanel(!showTestPanel)}
            variant="outline"
          >
            {showTestPanel ? 'Hide' : 'Show'} Gesture Testing Panel
          </Button>
        </CardHeader>
        <CardContent>
          {/* Capacitor Platform Info */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Capacitor Platform</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Badge className="bg-green-500">
                Native: {capacitorInfo.isNative ? 'Yes' : 'No'}
              </Badge>
              <Badge>Platform: {capacitorInfo.platform}</Badge>
              <Badge className={capacitorInfo.isPluginAvailable?.keyboard ? 'bg-green-500' : 'bg-red-500'}>
                Keyboard Plugin: {capacitorInfo.isPluginAvailable?.keyboard ? 'Available' : 'Unavailable'}
              </Badge>
              <Badge className={capacitorInfo.isPluginAvailable?.device ? 'bg-green-500' : 'bg-red-500'}>
                Device Plugin: {capacitorInfo.isPluginAvailable?.device ? 'Available' : 'Unavailable'}
              </Badge>
            </div>
          </div>

          {/* Keyboard Configuration */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Keyboard Configuration</h3>
            <div className="text-sm space-y-1">
              <div>Resize Mode: <Badge>native</Badge></div>
              <div>Resize on Full Screen: <Badge className="bg-green-500">enabled</Badge></div>
              <div>Accessory Bar: <Badge className="bg-red-500">disabled</Badge></div>
              <div>Scroll Assist: <Badge className="bg-red-500">disabled</Badge></div>
            </div>
          </div>

          {/* Keyboard State */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Keyboard State</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Badge className={keyboardInfo.isVisible ? 'bg-green-500' : 'bg-gray-500'}>
                Visible: {keyboardInfo.isVisible ? 'Yes' : 'No'}
              </Badge>
              {keyboardInfo.didShow && (
                <Badge>Height: {keyboardInfo.didShow.keyboardHeight}px</Badge>
              )}
            </div>
            
            {keyboardInfo.didShow && (
              <div className="mt-2 text-sm bg-gray-100 p-2 rounded">
                <strong>Last Keyboard Show Event:</strong>
                <pre className="mt-1 text-xs">
                  {JSON.stringify(keyboardInfo.didShow, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* WebView Information */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">WebView Information</h3>
            <div className="text-sm space-y-1">
              <div>User Agent: <code className="text-xs">{navigator.userAgent.substring(0, 100)}...</code></div>
              <div>Viewport Height: {window.innerHeight}px</div>
              <div>Visual Viewport Height: {window.visualViewport?.height || 'N/A'}px</div>
              <div>Document Height: {document.documentElement.clientHeight}px</div>
            </div>
          </div>

          {/* Test Input */}
          <div className="mt-4 p-4 border rounded">
            <h4 className="font-medium mb-2">Test Input (for keyboard behavior)</h4>
            <input 
              type="text" 
              placeholder="Tap here to open keyboard..."
              className="w-full p-2 border rounded"
            />
            <textarea 
              placeholder="Or tap here for textarea..."
              className="w-full p-2 border rounded mt-2"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gesture Testing Panel */}
      {showTestPanel && <GestureTestingPanel />}
    </div>
  );
};