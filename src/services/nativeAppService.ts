
// Simplified native app service for basic app detection
export interface AppInfo {
  isNativeApp: boolean;
  isPWABuilder: boolean;
  platform: string;
  buildTimestamp: string;
  userAgent: string;
}

class NativeAppService {
  private appInfo: AppInfo;

  constructor() {
    this.appInfo = this.detectAppInfo();
  }

  private detectAppInfo(): AppInfo {
    const userAgent = navigator.userAgent;
    const isNativeApp = this.isNativeEnvironment();
    const isPWABuilder = this.isPWABuilderApp();
    
    return {
      isNativeApp,
      isPWABuilder,
      platform: this.getPlatform(),
      buildTimestamp: new Date().toISOString(),
      userAgent
    };
  }

  private isNativeEnvironment(): boolean {
    return window.location.protocol === 'file:' ||
           (window as any).AndroidInterface !== undefined ||
           (window as any).webkit?.messageHandlers !== undefined;
  }

  private isPWABuilderApp(): boolean {
    return (window as any).PWABuilder !== undefined ||
           navigator.userAgent.includes('PWABuilder');
  }

  private getPlatform(): string {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return 'ios';
    if (/Android/.test(navigator.userAgent)) return 'android';
    return 'web';
  }

  getAppInfo(): AppInfo {
    return { ...this.appInfo };
  }

  initialize(): void {
    console.log('[NativeAppService] Initialized:', this.appInfo);
  }
}

export const nativeAppService = new NativeAppService();
