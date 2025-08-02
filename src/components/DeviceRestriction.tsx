import React from 'react';
import { Smartphone, Monitor, Tablet } from 'lucide-react';

interface DeviceRestrictionProps {
  children: React.ReactNode;
}

interface DeviceInfo {
  isPhone: boolean;
  isTablet: boolean;
  isChromebook: boolean;
  isDesktop: boolean;
  deviceType: string;
  reason: string;
}

const detectDeviceType = (): DeviceInfo => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const maxDimension = Math.max(screenWidth, screenHeight);
  const minDimension = Math.min(screenWidth, screenHeight);
  const aspectRatio = maxDimension / minDimension;

  // Check for Chromebook
  const isChromebook = userAgent.includes('cros') || 
                      platform.includes('cros') ||
                      userAgent.includes('chromebook');

  // Check for tablet indicators
  const isTabletUA = /ipad|android(?!.*mobile)|tablet|kindle|silk|playbook|bb10/i.test(userAgent);
  
  // Size-based tablet detection (7+ inches, assuming 160 DPI)
  const isLargeScreen = minDimension >= 768; // Tablets typically 768px+ in portrait
  
  // iPad detection (including iPad Pro)
  const isIpad = /ipad/i.test(userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Android tablet detection
  const isAndroidTablet = /android/i.test(userAgent) && !/mobile/i.test(userAgent);
  
  // Surface and other Windows tablets
  const isWindowsTablet = /windows/i.test(userAgent) && 
                          (/touch/i.test(userAgent) || navigator.maxTouchPoints > 0) &&
                          isLargeScreen;

  const isTablet = isTabletUA || isIpad || isAndroidTablet || isWindowsTablet || 
                   (isLargeScreen && aspectRatio < 2.1); // Most tablets have lower aspect ratios

  // Desktop detection
  const isDesktop = !(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) &&
                    !isChromebook && 
                    minDimension >= 1024;

  // Phone detection - must be mobile and NOT tablet
  const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isPhone = isMobile && !isTablet && !isChromebook && minDimension < 768;

  let deviceType = 'unknown';
  let reason = '';

  if (isChromebook) {
    deviceType = 'chromebook';
    reason = 'Chromebook detected';
  } else if (isTablet) {
    deviceType = 'tablet';
    reason = isIpad ? 'iPad detected' : 
             isAndroidTablet ? 'Android tablet detected' :
             isWindowsTablet ? 'Windows tablet detected' :
             'Large screen tablet detected';
  } else if (isDesktop) {
    deviceType = 'desktop';
    reason = 'Desktop computer detected';
  } else if (isPhone) {
    deviceType = 'phone';
    reason = 'Mobile phone detected';
  } else {
    deviceType = 'unknown';
    reason = 'Unable to determine device type';
  }

  return {
    isPhone,
    isTablet,
    isChromebook,
    isDesktop,
    deviceType,
    reason
  };
};

const UnsupportedDeviceScreen: React.FC<{ deviceInfo: DeviceInfo }> = ({ deviceInfo }) => {
  const getIcon = () => {
    if (deviceInfo.isTablet) return <Tablet className="w-16 h-16 text-muted-foreground mb-4" />;
    if (deviceInfo.isDesktop || deviceInfo.isChromebook) return <Monitor className="w-16 h-16 text-muted-foreground mb-4" />;
    return <Smartphone className="w-16 h-16 text-muted-foreground mb-4" />;
  };

  const getTitle = () => {
    if (deviceInfo.isTablet) return "Tablet Not Supported";
    if (deviceInfo.isChromebook) return "Chromebook Not Supported";
    if (deviceInfo.isDesktop) return "Desktop Not Supported";
    return "Device Not Supported";
  };

  const getMessage = () => {
    if (deviceInfo.isTablet) {
      return "Soulo is optimized for mobile phones only. Please access this app from your smartphone for the best voice journaling experience.";
    }
    if (deviceInfo.isChromebook) {
      return "Soulo requires a mobile phone for the authentic voice journaling experience. Please access this app from your smartphone.";
    }
    if (deviceInfo.isDesktop) {
      return "Soulo is designed exclusively for mobile phones. Please access this app from your smartphone to start your voice journaling journey.";
    }
    return "Soulo is exclusively available on mobile phones. Please access this app from your smartphone.";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center">
        <div className="flex justify-center">
          {getIcon()}
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {getTitle()}
        </h1>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          {getMessage()}
        </p>
        <div className="bg-muted rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-foreground mb-2">Why Mobile Only?</h3>
          <ul className="text-sm text-muted-foreground space-y-1 text-left">
            <li>• Optimized voice recording experience</li>
            <li>• Native mobile features integration</li>
            <li>• Intimate, personal journaling environment</li>
            <li>• Touch-first interface design</li>
          </ul>
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="mb-1">Detected: {deviceInfo.reason}</p>
          <p>Screen: {window.screen.width} × {window.screen.height}</p>
        </div>
      </div>
    </div>
  );
};

export const DeviceRestriction: React.FC<DeviceRestrictionProps> = ({ children }) => {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo | null>(null);

  React.useEffect(() => {
    const detectDevice = () => {
      const info = detectDeviceType();
      console.log('[DeviceRestriction] Device detection:', info);
      setDeviceInfo(info);
      
      // Add CSS classes for styling
      document.body.classList.toggle('device-phone', info.isPhone);
      document.body.classList.toggle('device-tablet', info.isTablet);
      document.body.classList.toggle('device-chromebook', info.isChromebook);
      document.body.classList.toggle('device-desktop', info.isDesktop);
    };

    detectDevice();

    // Re-detect on resize (for edge cases)
    const handleResize = () => {
      setTimeout(detectDevice, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Show loading state until detection is complete
  if (!deviceInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Smartphone className="w-8 h-8 text-primary animate-pulse mx-auto mb-2" />
          <p className="text-muted-foreground">Detecting device...</p>
        </div>
      </div>
    );
  }

  // Only allow phones
  if (!deviceInfo.isPhone) {
    return <UnsupportedDeviceScreen deviceInfo={deviceInfo} />;
  }

  return <>{children}</>;
};

export default DeviceRestriction;