import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { unifiedNotificationService, UnifiedNotificationSettings } from '@/services/unifiedNotificationService';
import { timezoneNotificationHelper, JournalReminderTime } from '@/services/timezoneNotificationHelper';
import { notificationDebugLogger } from '@/services/notificationDebugLogger';

const TIME_OPTIONS = [
  { value: 'morning', label: '8:00 AM - Morning reflection' },
  { value: 'afternoon', label: '2:00 PM - Afternoon check-in' },
  { value: 'evening', label: '7:00 PM - Evening thoughts' },
  { value: 'night', label: '10:00 PM - End of day' }
];

export function UnifiedJournalRemindersSettings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<JournalReminderTime>('evening');
  const [isLoading, setIsLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [debugReport, setDebugReport] = useState<string>('');

  useEffect(() => {
    loadSettings();
    getDetailedStatus();
  }, []);

  const loadSettings = () => {
    const settings = unifiedNotificationService.getSettings();
    setIsEnabled(settings.enabled);
    if (settings.times.length > 0) {
      setReminderTime(settings.times[0]);
    }
  };

  const getDetailedStatus = async () => {
    try {
      const status = await unifiedNotificationService.getNotificationStatus();
      setNotificationStatus(status);
      
      // Generate debug report
      const report = unifiedNotificationService.getDebugReport();
      setDebugReport(report);
    } catch (error) {
      console.error('Error getting notification status:', error);
    }
  };

  const handleEnableToggle = async (enabled: boolean) => {
    setIsLoading(true);
    
    try {
      if (enabled) {
        const result = await unifiedNotificationService.requestPermissionsAndSetup([reminderTime]);
        
        if (result.success) {
          setIsEnabled(true);
          toast.success('✅ Unified journal reminders enabled!', {
            description: `Strategy: ${result.strategy}, Scheduled: ${result.scheduledCount} notifications`
          });
          await getDetailedStatus();
        } else {
          toast.error('❌ Failed to enable reminders', {
            description: result.error || 'Unknown error occurred'
          });
        }
      } else {
        await unifiedNotificationService.disableReminders();
        setIsEnabled(false);
        toast.success('Reminders disabled');
        await getDetailedStatus();
      }
    } catch (error) {
      console.error('Error toggling reminders:', error);
      toast.error('An error occurred while setting up reminders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeChange = async (newTime: string) => {
    setReminderTime(newTime as JournalReminderTime);
    
    if (isEnabled) {
      setIsLoading(true);
      try {
        await unifiedNotificationService.requestPermissionsAndSetup([newTime as JournalReminderTime]);
        toast.success(`Reminder time updated to ${TIME_OPTIONS.find(t => t.value === newTime)?.label}`);
        await getDetailedStatus();
      } catch (error) {
        console.error('Error updating reminder time:', error);
        toast.error('Failed to update reminder time');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const testReminder = async () => {
    setIsLoading(true);
    try {
      const success = await unifiedNotificationService.testNotification();
      if (success) {
        toast.success('🧪 Test reminder sent!', {
          description: 'Check your notifications to confirm they\'re working.'
        });
      } else {
        toast.error('❌ Test reminder failed', {
          description: 'Please check your notification settings.'
        });
      }
    } catch (error) {
      console.error('Error testing reminder:', error);
      toast.error('Error testing reminder');
    } finally {
      setIsLoading(false);
    }
  };

  const clearDebugLogs = () => {
    notificationDebugLogger.clearEvents();
    toast.success('Debug logs cleared');
    getDetailedStatus();
  };

  const getHealthStatusBadge = () => {
    if (!notificationStatus?.verification) {
      return <Badge variant="outline">Unknown</Badge>;
    }

    const { healthStatus } = notificationStatus.verification;
    
    switch (healthStatus) {
      case 'healthy':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Degraded</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatTimezoneInfo = () => {
    if (!notificationStatus?.debugInfo) return null;
    
    const { debugInfo } = notificationStatus;
    return {
      userTimezone: debugInfo.userTimezone,
      browserTimezone: debugInfo.browserTimezone,
      currentUserTime: debugInfo.currentUserTime,
      isDST: debugInfo.isDST
    };
  };

  const getNextReminderTime = () => {
    if (!isEnabled) return null;
    
    const nextTime = timezoneNotificationHelper.getTimezoneAwareReminderTime(reminderTime);
    return nextTime.nextOccurrenceFormatted;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Unified Journal Reminders
          <div className="flex gap-2">
            {getHealthStatusBadge()}
            {notificationStatus && (
              <Badge variant="outline" className="text-xs">
                {notificationStatus.strategy} • {notificationStatus.scheduledCount || 0} active
              </Badge>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          Advanced notification system with timezone support, WebView detection, and comprehensive debugging.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* System Status Overview */}
        {notificationStatus && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-sm font-medium">Platform</p>
              <Badge variant="outline">
                {notificationStatus.isNative ? '📱 Native' : '🌐 Web'}
                {notificationStatus.isWebView ? ' (WebView)' : ''}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Strategy</p>
              <Badge variant="outline">{notificationStatus.strategy}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Permissions</p>
              <Badge variant="outline">
                {notificationStatus.permissions?.native?.display || 
                 notificationStatus.permissions?.web || 'Unknown'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Timezone</p>
              <Badge variant="outline">{formatTimezoneInfo()?.userTimezone || 'UTC'}</Badge>
            </div>
          </div>
        )}

        {/* Main Settings */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium">Enable Daily Reminders</h3>
            <p className="text-sm text-muted-foreground">
              Get intelligent notifications with timezone awareness and WebView compatibility
            </p>
            {getNextReminderTime() && (
              <p className="text-xs text-muted-foreground mt-1">
                Next reminder: {getNextReminderTime()}
              </p>
            )}
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleEnableToggle}
            disabled={isLoading}
          />
        </div>

        {/* Time Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Reminder Time</label>
          <Select value={reminderTime} onValueChange={handleTimeChange} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={testReminder}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Testing...' : '🧪 Test Reminder'}
          </Button>
          <Button 
            variant="outline" 
            onClick={getDetailedStatus}
            disabled={isLoading}
            size="sm"
          >
            🔄 Refresh Status
          </Button>
        </div>

        {/* Verification Results */}
        {notificationStatus?.verification && (
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Notification System Health
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Expected:</span>
                <div className="font-mono">{notificationStatus.verification.expectedCount}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Scheduled:</span>
                <div className="font-mono">{notificationStatus.verification.actualCount}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Success Rate:</span>
                <div className="font-mono">{notificationStatus.verification.successRate}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Dashboard */}
        <Collapsible open={debugExpanded} onOpenChange={setDebugExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Debug Dashboard
              </span>
              {debugExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            {/* Timezone Information */}
            {formatTimezoneInfo() && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Timezone Information</h5>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <div>User Timezone: <code>{formatTimezoneInfo()?.userTimezone}</code></div>
                  <div>Browser Timezone: <code>{formatTimezoneInfo()?.browserTimezone}</code></div>
                  <div>Current Time: <code>{formatTimezoneInfo()?.currentUserTime}</code></div>
                  <div>DST Active: <code>{formatTimezoneInfo()?.isDST ? 'Yes' : 'No'}</code></div>
                </div>
              </div>
            )}

            {/* Recent Events */}
            {notificationStatus?.recentEvents && (
              <div className="p-3 bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800 rounded-lg">
                <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Recent Events ({notificationStatus.recentEvents.length})
                </h5>
                <div className="max-h-40 overflow-y-auto text-xs font-mono space-y-1">
                  {notificationStatus.recentEvents.slice(0, 10).map((event: any, index: number) => (
                    <div key={index} className={`p-1 rounded ${event.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {new Date(event.timestamp).toLocaleTimeString()} - {event.event} {event.success ? '✅' : '❌'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug Report */}
            <div className="p-3 bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium text-gray-800 dark:text-gray-200">Debug Report</h5>
                <Button variant="outline" size="sm" onClick={clearDebugLogs}>
                  Clear Logs
                </Button>
              </div>
              <pre className="text-xs max-h-60 overflow-y-auto whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {debugReport}
              </pre>
            </div>

            {/* Export Debug Data */}
            <Button 
              variant="outline" 
              onClick={() => {
                const data = JSON.stringify(notificationStatus, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `notification-debug-${new Date().toISOString()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full"
            >
              📥 Export Debug Data
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {/* Platform-specific Guidance */}
        {notificationStatus?.isWebView && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
              📱 WebView Environment Detected
            </h4>
            <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
              <p>Enhanced compatibility mode active for Capacitor WebView.</p>
              <p>Using {notificationStatus.strategy} strategy with automatic fallbacks.</p>
            </div>
          </div>
        )}

        {notificationStatus?.platform === 'android' && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              🤖 Android Optimization Tips
            </h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <ul className="list-disc list-inside space-y-1">
                <li>Add app to battery optimization whitelist</li>
                <li>Enable "Allow background activity"</li>
                <li>Set notification importance to "High"</li>
                <li>Keep device connected to internet</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}