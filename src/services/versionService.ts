
import { nativeAppService } from './nativeAppService';

interface Version {
  version: string;
  buildTimestamp: string;
  isNativeApp: boolean;
  platform: string;
}

class VersionService {
  private currentVersion: Version;

  constructor() {
    this.currentVersion = this.detectVersion();
  }

  private detectVersion(): Version {
    const appInfo = nativeAppService.getAppInfo();
    
    return {
      version: '3.0.0',
      buildTimestamp: appInfo.buildTimestamp,
      isNativeApp: appInfo.isNativeApp,
      platform: appInfo.platform
    };
  }

  getCurrentVersion(): Version {
    return { ...this.currentVersion };
  }

  triggerManualUpdate(): void {
    console.log('[VersionService] Manual update triggered');
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_FOR_UPDATES'
      });
    }
    
    // Simple fallback - just reload after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }

  isUpdateAvailable(): boolean {
    // Simple implementation - could be enhanced later
    return false;
  }
}

export const versionService = new VersionService();
