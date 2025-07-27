/**
 * Native Debug Panel Component
 * Provides debugging information for mobile app issues
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Bug, Download, RefreshCw } from 'lucide-react';
import { nativeDebugService } from '@/services/nativeDebugService';
import { simpleNativeInitService } from '@/services/simpleNativeInitService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { toast } from 'sonner';

export const NativeDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [initState, setInitState] = useState(simpleNativeInitService.getInitState());

  useEffect(() => {
    const updateDebugInfo = async () => {
      const info = await nativeDebugService.getDebugInfo();
      setDebugInfo(info);
      setInitState(simpleNativeInitService.getInitState());
    };

    if (isOpen) {
      updateDebugInfo();
    }
  }, [isOpen]);

  const runTests = async () => {
    try {
      const results = await nativeDebugService.runNativeTests();
      setTestResults(results);
      toast.success('Native tests completed');
    } catch (error) {
      toast.error('Failed to run tests: ' + error);
    }
  };

  const exportDebugData = () => {
    const data = nativeDebugService.exportDebugData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soulo-debug-data.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Debug data exported');
  };

  const resetInit = () => {
    simpleNativeInitService.reset();
    setInitState(simpleNativeInitService.getInitState());
    toast.info('Initialization state reset');
  };

  if (!nativeIntegrationService.isRunningNatively()) {
    return null; // Only show in native environment
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="outline" className="gap-2">
            <Bug className="h-4 w-4" />
            Debug
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <Card className="w-80 max-h-96 overflow-y-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Native Debug Panel
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3 text-xs">
              {/* Initialization Status */}
              <div>
                <h4 className="font-medium mb-2">Initialization Status</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Badge variant={initState.isInitialized ? "default" : "secondary"}>
                    {initState.isInitialized ? "Initialized" : "Not Initialized"}
                  </Badge>
                  <Badge variant={initState.error ? "destructive" : "default"}>
                    {initState.error ? "Error" : "OK"}
                  </Badge>
                </div>
                {initState.initDuration && (
                  <p className="text-muted-foreground mt-1">
                    Init time: {initState.initDuration}ms
                  </p>
                )}
                {initState.error && (
                  <p className="text-red-600 mt-1 text-xs">{initState.error}</p>
                )}
              </div>

              {/* Platform Info */}
              {debugInfo && (
                <div>
                  <h4 className="font-medium mb-2">Platform</h4>
                  <div className="space-y-1">
                    <p>Platform: {debugInfo.platform}</p>
                    <p>Native: {debugInfo.isNative ? 'Yes' : 'No'}</p>
                    <p>Capacitor: {debugInfo.capacitorReady ? 'Ready' : 'Not Ready'}</p>
                    {debugInfo.deviceInfo && (
                      <p>Device: {debugInfo.deviceInfo.manufacturer} {debugInfo.deviceInfo.model}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" onClick={runTests} variant="outline" className="flex-1">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Test
                  </Button>
                  <Button size="sm" onClick={exportDebugData} variant="outline" className="flex-1">
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                </div>
                <Button size="sm" onClick={resetInit} variant="destructive" className="w-full">
                  Reset Init
                </Button>
              </div>

              {/* Test Results */}
              {testResults && (
                <div>
                  <h4 className="font-medium mb-2">Test Results</h4>
                  <div className="space-y-1">
                    {Object.entries(testResults).map(([test, result]) => (
                      <div key={test} className="flex justify-between">
                        <span>{test}:</span>
                        <Badge variant={result ? "default" : "destructive"} className="text-xs">
                          {result ? "Pass" : "Fail"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};