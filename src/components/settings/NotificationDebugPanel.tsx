import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, TestTube } from 'lucide-react';
import { nativeNotificationService } from '@/services/nativeNotificationService';
import { notificationPermissionChecker } from '@/services/notificationPermissionChecker';
import { notificationDebugLogger } from '@/services/notificationDebugLogger';
import { timezoneNotificationHelper } from '@/services/timezoneNotificationHelper';
import { useToast } from '@/hooks/use-toast';

interface NotificationDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDebugPanel: React.FC<NotificationDebugPanelProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<any>(null);
  const [debugEvents, setDebugEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const { toast } = useToast();

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const [detailedStatus, debugStatus, events, timezoneInfo] = await Promise.all([
        nativeNotificationService.getDetailedStatus(),
        notificationPermissionChecker.getDebugStatus(),
        notificationDebugLogger.getFilteredEvents({ since: new Date(Date.now() - 60 * 60 * 1000) }),
        timezoneNotificationHelper.getTimezoneDebugInfo()
      ]);

      setStatus({
        ...detailedStatus,
        debugStatus,
        timezoneInfo,
        lastRefresh: new Date().toISOString()
      });
      setDebugEvents(events);
    } catch (error) {
      console.error('Error refreshing notification debug status:', error);
      toast({
        title: "Debug Status Error",
        description: "Failed to refresh notification debug information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const runTest = async () => {
    setTestLoading(true);
    try {
      const result = await nativeNotificationService.testNotification();
      
      if (result.success) {
        toast({
          title: "Test Scheduled",
          description: "Test notification scheduled for 30 seconds. Check your status bar!",
        });
      } else {
        toast({
          title: "Test Failed",
          description: result.error || "Failed to schedule test notification",
          variant: "destructive"
        });
      }
      
      // Refresh status after test
      setTimeout(refreshStatus, 1000);
    } catch (error) {
      toast({
        title: "Test Error",
        description: "Error running notification test",
        variant: "destructive"
      });
    } finally {
      setTestLoading(false);
    }
  };

  const getPermissionBadge = (permission: string) => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      case 'default':
        return <Badge variant="secondary">Not Asked</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const clearDebugEvents = () => {
    notificationDebugLogger.clearEvents();
    setDebugEvents([]);
    toast({
      title: "Events Cleared",
      description: "Debug events have been cleared"
    });
  };

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Notification Debug Panel</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshStatus}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runTest}
                  disabled={testLoading}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {testLoading ? 'Testing...' : 'Test (30s)'}
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Comprehensive notification system diagnostics and troubleshooting
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {status && (
              <>
                {/* Platform & Permission Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Platform Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span>Platform:</span>
                        <Badge variant="outline">{status.platform}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Native:</span>
                        <Badge variant={status.isNative ? "default" : "secondary"}>
                          {status.isNative ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Permission:</span>
                        {getPermissionBadge(status.permissionState)}
                      </div>
                      <div className="flex justify-between">
                        <span>Scheduled:</span>
                        <Badge variant={status.scheduledCount > 0 ? "default" : "secondary"}>
                          {status.scheduledCount}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Timezone Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span>User TZ:</span>
                        <span className="text-sm font-mono">{status.userTimezone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Device TZ:</span>
                        <span className="text-sm font-mono">{status.deviceTimezone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mismatch:</span>
                        <Badge variant={status.timezoneMismatch ? "destructive" : "default"}>
                          {status.timezoneMismatch ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      {status.timezoneInfo && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Current: {status.timezoneInfo.currentUserTime}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Scheduled Notifications */}
                {status.pendingNotifications && status.pendingNotifications.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center">
                        <Clock className="h-5 w-5 mr-2" />
                        Scheduled Notifications ({status.pendingNotifications.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {status.pendingNotifications.slice(0, 5).map((notification: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 border rounded">
                            <div>
                              <div className="font-medium">{notification.title || 'Journal Reminder'}</div>
                              {notification.extra?.reminderTime && (
                                <div className="text-sm text-muted-foreground">
                                  Time: {notification.extra.reminderTime}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              {notification.schedule?.at && (
                                <div className="text-sm">
                                  {new Date(notification.schedule.at).toLocaleString()}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                ID: {notification.id}
                              </div>
                            </div>
                          </div>
                        ))}
                        {status.pendingNotifications.length > 5 && (
                          <div className="text-center text-sm text-muted-foreground">
                            ... and {status.pendingNotifications.length - 5} more
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Android-specific issues */}
                {status.platform === 'android' && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                        Android Optimization Tips
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-orange-50 border border-orange-200 rounded p-3">
                        <p className="text-sm">
                          <strong>Battery Optimization:</strong> Disable battery optimization for this app in Android settings 
                          to ensure reliable notification delivery.
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-sm">
                          <strong>Exact Alarms:</strong> Android 12+ requires "Schedule exact alarms" permission 
                          for precise notification timing.
                        </p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <p className="text-sm">
                          <strong>Auto-start:</strong> Enable auto-start for this app in your device manufacturer's 
                          settings (Xiaomi, Huawei, etc.).
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Debug Events */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Recent Debug Events ({debugEvents.length})</span>
                      <Button variant="outline" size="sm" onClick={clearDebugEvents}>
                        Clear Events
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {debugEvents.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {debugEvents.slice(0, 10).map((event: any, index: number) => (
                          <div key={index} className="flex items-start space-x-3 p-2 border rounded text-xs">
                            <div className="flex-shrink-0">
                              {event.success ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{event.event}</div>
                              {event.data && (
                                <div className="text-muted-foreground mt-1">
                                  {JSON.stringify(event.data, null, 2)}
                                </div>
                              )}
                              {event.error && (
                                <div className="text-red-600 mt-1">{event.error}</div>
                              )}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-4">
                        No recent debug events
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Separator />

                <div className="text-xs text-muted-foreground">
                  Last refreshed: {new Date(status.lastRefresh).toLocaleString()}
                </div>
              </>
            )}

            {!status && loading && (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading debug information...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};