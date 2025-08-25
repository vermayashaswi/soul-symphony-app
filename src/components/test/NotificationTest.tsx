import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';
import { notificationFallbackService } from '@/services/notificationFallbackService';
import { Capacitor } from '@capacitor/core';

export const NotificationTest: React.FC = () => {
  const [status, setStatus] = useState<any>({});
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    updateStatus();
  }, []);

  const updateStatus = () => {
    const connectionHealth = unifiedNotificationService.getConnectionHealth();
    const fallbackStatus = notificationFallbackService.getStatus();
    
    setStatus({
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      connectionHealth,
      fallbackStatus,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  const testUnifiedService = async () => {
    try {
      const result = await unifiedNotificationService.testNotification();
      setTestResults(prev => [...prev, `Unified test: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message}`]);
    } catch (error) {
      setTestResults(prev => [...prev, `Unified test ERROR: ${error}`]);
    }
  };

  const testFallbackService = async () => {
    try {
      const result = await notificationFallbackService.testFallbackNotification();
      setTestResults(prev => [...prev, `Fallback test: ${result ? 'SUCCESS' : 'FAILED'}`]);
    } catch (error) {
      setTestResults(prev => [...prev, `Fallback test ERROR: ${error}`]);
    }
  };

  const startPolling = async () => {
    try {
      await notificationFallbackService.startPolling();
      setTestResults(prev => [...prev, 'Fallback polling started']);
      updateStatus();
    } catch (error) {
      setTestResults(prev => [...prev, `Start polling ERROR: ${error}`]);
    }
  };

  const stopPolling = () => {
    notificationFallbackService.stopPolling();
    setTestResults(prev => [...prev, 'Fallback polling stopped']);
    updateStatus();
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Service Status</CardTitle>
          <CardDescription>
            Testing notification services in {status.platform} environment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Platform</p>
              <Badge variant={status.isNative ? "default" : "secondary"}>
                {status.platform}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Connection Health</p>
              <Badge variant={status.connectionHealth?.healthy ? "default" : "destructive"}>
                {status.connectionHealth?.strategy || 'unknown'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Fallback Active</p>
              <Badge variant={status.fallbackStatus?.isPolling ? "default" : "secondary"}>
                {status.fallbackStatus?.isPolling ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Last Update</p>
              <p className="text-sm text-muted-foreground">{status.timestamp}</p>
            </div>
          </div>
          
          <Button onClick={updateStatus} variant="outline" size="sm">
            Refresh Status
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={testUnifiedService} size="sm">
              Test Unified Service
            </Button>
            <Button onClick={testFallbackService} size="sm">
              Test Fallback Service
            </Button>
            <Button onClick={startPolling} size="sm" variant="outline">
              Start Polling
            </Button>
            <Button onClick={stopPolling} size="sm" variant="outline">
              Stop Polling
            </Button>
            <Button onClick={clearResults} size="sm" variant="destructive">
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test results yet</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                  [{new Date().toLocaleTimeString()}] {result}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};