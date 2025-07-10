import { nativeIntegrationService } from './nativeIntegrationService';
import { nativeAuthService } from './nativeAuthService';
import { nativeAppInitService } from './nativeAppInitService';

export interface NativeDebugInfo {
  platform: string;
  isNative: boolean;
  isCapacitorReady: boolean;
  authAvailable: boolean;
  authConfigured: boolean;
  initializationStatus: any;
  deviceInfo: any;
  plugins: string[];
  errors: string[];
  environment: string;
}

class NativeDebugService {
  private static instance: NativeDebugService;
  private debugHistory: any[] = [];

  static getInstance(): NativeDebugService {
    if (!NativeDebugService.instance) {
      NativeDebugService.instance = new NativeDebugService();
    }
    return NativeDebugService.instance;
  }

  async getDebugInfo(): Promise<NativeDebugInfo> {
    const debugInfo: NativeDebugInfo = {
      platform: 'unknown',
      isNative: false,
      isCapacitorReady: false,
      authAvailable: false,
      authConfigured: false,
      initializationStatus: null,
      deviceInfo: null,
      plugins: [],
      errors: [],
      environment: 'web'
    };

    try {
      // Basic platform info
      debugInfo.platform = nativeIntegrationService.getPlatform();
      debugInfo.isNative = nativeIntegrationService.isRunningNatively();
      debugInfo.environment = debugInfo.isNative ? 'native' : 'web';

      // Capacitor info
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        debugInfo.isCapacitorReady = true;
        const capacitor = (window as any).Capacitor;
        
        if (capacitor.Plugins) {
          debugInfo.plugins = Object.keys(capacitor.Plugins);
        }
      }

      // Auth info
      debugInfo.authAvailable = nativeIntegrationService.isGoogleAuthAvailable();
      debugInfo.authConfigured = nativeAuthService.hasValidConfiguration();

      // Device info
      debugInfo.deviceInfo = nativeIntegrationService.getDeviceInfo();

      // Initialization status
      debugInfo.initializationStatus = await nativeAppInitService.getInitializationStatus();

      // Check for common errors
      const authError = nativeAuthService.getInitializationError();
      if (authError) {
        debugInfo.errors.push(`Auth: ${authError}`);
      }

      // Add network status
      try {
        const networkStatus = await nativeIntegrationService.getNetworkStatus();
        debugInfo.initializationStatus.networkStatus = networkStatus;
      } catch (error) {
        debugInfo.errors.push(`Network: ${error}`);
      }

    } catch (error) {
      debugInfo.errors.push(`Debug collection failed: ${error}`);
    }

    // Store debug info in history
    this.debugHistory.push({
      timestamp: Date.now(),
      ...debugInfo
    });

    // Keep only last 10 entries
    if (this.debugHistory.length > 10) {
      this.debugHistory = this.debugHistory.slice(-10);
    }

    return debugInfo;
  }

  logDebugInfo(): void {
    this.getDebugInfo().then(info => {
      console.group('🔧 Native App Debug Info');
      console.log('Platform:', info.platform);
      console.log('Environment:', info.environment);
      console.log('Is Native:', info.isNative);
      console.log('Capacitor Ready:', info.isCapacitorReady);
      console.log('Auth Available:', info.authAvailable);
      console.log('Auth Configured:', info.authConfigured);
      console.log('Available Plugins:', info.plugins);
      console.log('Device Info:', info.deviceInfo);
      console.log('Initialization Status:', info.initializationStatus);
      
      if (info.errors.length > 0) {
        console.error('Errors:', info.errors);
      }
      
      console.groupEnd();
    });
  }

  getDebugHistory(): any[] {
    return [...this.debugHistory];
  }

  // Test native functionality
  async runNativeTests(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};

    try {
      // Test vibration
      try {
        await nativeIntegrationService.vibrate(100);
        results.vibration = true;
      } catch (error) {
        console.warn('Vibration test failed:', error);
        results.vibration = false;
      }

      // Test status bar
      try {
        await nativeIntegrationService.hideStatusBar();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await nativeIntegrationService.showStatusBar();
        results.statusBar = true;
      } catch (error) {
        console.warn('Status bar test failed:', error);
        results.statusBar = false;
      }

      // Test network status
      try {
        const networkStatus = await nativeIntegrationService.getNetworkStatus();
        results.network = !!networkStatus;
      } catch (error) {
        console.warn('Network test failed:', error);
        results.network = false;
      }

      // Test permissions (read-only check)
      try {
        const permissions = await nativeIntegrationService.requestPermissions([]);
        results.permissions = true;
      } catch (error) {
        console.warn('Permissions test failed:', error);
        results.permissions = false;
      }

    } catch (error) {
      console.error('Native tests failed:', error);
    }

    console.log('Native functionality test results:', results);
    return results;
  }

  // Export debug data for support
  exportDebugData(): string {
    const debugData = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      currentDebugInfo: null,
      debugHistory: this.debugHistory,
      capacitorInfo: (window as any).Capacitor ? {
        platform: (window as any).Capacitor.getPlatform?.(),
        plugins: Object.keys((window as any).Capacitor.Plugins || {})
      } : null
    };

    return JSON.stringify(debugData, null, 2);
  }
}

export const nativeDebugService = NativeDebugService.getInstance();

// Global debug access
if (typeof window !== 'undefined') {
  (window as any).souloNativeDebug = {
    getInfo: () => nativeDebugService.getDebugInfo(),
    logInfo: () => nativeDebugService.logDebugInfo(),
    runTests: () => nativeDebugService.runNativeTests(),
    exportData: () => nativeDebugService.exportDebugData()
  };
}
