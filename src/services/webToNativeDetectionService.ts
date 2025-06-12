
/**
 * WebToNative Detection Service
 * Detects if the app is running in a native container (Capacitor) or web browser
 */

interface DeviceInfo {
  isNative: boolean;
  isCapacitor: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isMobile: boolean;
  platform: string;
  userAgent: string;
}

class WebToNativeDetectionService {
  private deviceInfo: DeviceInfo | null = null;

  async getDeviceInfo(): Promise<DeviceInfo> {
    if (this.deviceInfo) {
      return this.deviceInfo;
    }

    const userAgent = navigator.userAgent;
    const isCapacitor = !!(window as any).Capacitor;
    
    // Check if running in Capacitor
    let isNative = isCapacitor;
    let platform = 'web';

    if (isCapacitor) {
      try {
        // Try to get platform info from Capacitor
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        const { Device } = await dynamicImport('@capacitor/device');
        const info = await Device.getInfo();
        platform = info.platform;
        isNative = info.platform !== 'web';
      } catch (error) {
        console.log('Capacitor Device plugin not available');
      }
    }

    // Detect mobile browsers
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent) || platform === 'android';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || platform === 'ios';

    this.deviceInfo = {
      isNative,
      isCapacitor,
      isAndroid,
      isIOS,
      isMobile,
      platform,
      userAgent
    };

    console.log('Device detection:', this.deviceInfo);
    return this.deviceInfo;
  }

  async isRunningInNativeApp(): Promise<boolean> {
    const info = await this.getDeviceInfo();
    return info.isNative;
  }

  async isRunningOnMobile(): Promise<boolean> {
    const info = await this.getDeviceInfo();
    return info.isMobile;
  }

  async getPlatform(): Promise<string> {
    const info = await this.getDeviceInfo();
    return info.platform;
  }

  // Reset cached info (useful for testing)
  reset(): void {
    this.deviceInfo = null;
  }
}

export const webToNativeDetection = new WebToNativeDetectionService();
export type { DeviceInfo };
