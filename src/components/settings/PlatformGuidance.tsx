import React, { useState, useEffect } from 'react';
import { AlertCircle, Smartphone, Monitor, Wifi } from 'lucide-react';
import { mobileNotificationService } from '@/services/mobileNotificationService';

interface PlatformGuidanceProps {
  platform: string;
  strategy: string;
  permissionsGranted: boolean;
}

export const PlatformGuidance: React.FC<PlatformGuidanceProps> = ({
  platform,
  strategy,
  permissionsGranted
}) => {
  const [capabilities, setCapabilities] = useState<any>(null);
  const [reliability, setReliability] = useState<any>(null);

  useEffect(() => {
    const loadCapabilities = async () => {
      const caps = mobileNotificationService.detectMobileCapabilities();
      const rel = await mobileNotificationService.getReliabilityAssessment();
      setCapabilities(caps);
      setReliability(rel);
    };
    
    loadCapabilities();
  }, []);

  if (!capabilities || !reliability) return null;

  // Don't show guidance if everything is working well
  if (reliability.reliable && permissionsGranted && strategy === 'android-enhanced') {
    return null;
  }

  const getIcon = () => {
    if (capabilities.isWebView) return <Smartphone className="h-4 w-4" />;
    if (capabilities.isPWA) return <Monitor className="h-4 w-4" />;
    return <Wifi className="h-4 w-4" />;
  };

  const getTitle = () => {
    if (capabilities.isIOSSafari && !capabilities.isPWA) return 'iOS Safari Limitations';
    if (capabilities.isAndroidChrome && !capabilities.isPWA) return 'Browser Limitations';
    if (platform === 'android') return 'Android Optimization Tips';
    return 'Notification Setup';
  };

  const getVariant = () => {
    if (!reliability.reliable) return 'destructive';
    if (platform === 'android') return 'amber';
    return 'blue';
  };

  const variant = getVariant();
  const bgColor = variant === 'destructive' ? 'bg-red-50 border-red-200' : 
                  variant === 'amber' ? 'bg-amber-50 border-amber-200' : 
                  'bg-blue-50 border-blue-200';
  const textColor = variant === 'destructive' ? 'text-red-800' : 
                    variant === 'amber' ? 'text-amber-800' : 
                    'text-blue-800';
  const subtextColor = variant === 'destructive' ? 'text-red-700' : 
                       variant === 'amber' ? 'text-amber-700' : 
                       'text-blue-700';

  return (
    <div className={`p-3 rounded-lg ${bgColor}`}>
      <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${textColor}`}>
        {getIcon()}
        {getTitle()}
      </h4>
      
      {/* Reliability Assessment */}
      {!reliability.reliable && (
        <div className={`mb-2 text-xs ${textColor}`}>
          <strong>⚠️ {reliability.recommendation}</strong>
        </div>
      )}

      {/* Platform-specific guidance */}
      <div className={`text-xs space-y-1 ${subtextColor}`}>
        {/* iOS Safari PWA requirement */}
        {capabilities.isIOSSafari && !capabilities.isPWA && (
          <>
            <li>• iOS Safari requires installing this app to your home screen for notifications</li>
            <li>• {mobileNotificationService.getPWAInstallationGuidance()}</li>
            <li>• Notifications work best when the app is in the foreground on iOS</li>
          </>
        )}

        {/* Android Chrome recommendations */}
        {capabilities.isAndroidChrome && !capabilities.isPWA && (
          <>
            <li>• Install as an app for more reliable notifications</li>
            <li>• {mobileNotificationService.getPWAInstallationGuidance()}</li>
            <li>• Browser notifications may not persist across sessions</li>
          </>
        )}

        {/* Android native optimizations */}
        {platform === 'android' && strategy === 'android-enhanced' && (
          <>
            <li>• Disable battery optimization for this app in Android settings</li>
            <li>• Allow "Display over other apps" permission if prompted</li>
            <li>• Set notification importance to "High" in app settings</li>
            <li>• Enable "Exact alarms" permission for Android 12+</li>
          </>
        )}

        {/* Web browser tips */}
        {strategy === 'web' && !capabilities.isWebView && (
          <>
            <li>• Keep this browser tab open for notifications to work</li>
            <li>• Consider installing as an app for background notifications</li>
            <li>• Check that notifications are enabled in browser settings</li>
          </>
        )}

        {/* Limitations display */}
        {reliability.limitations.map((limitation, index) => (
          <li key={index}>• {limitation}</li>
        ))}
      </div>
    </div>
  );
};