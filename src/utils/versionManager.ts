
/**
 * Version Management and Update Detection
 */

export interface VersionInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
  forceUpdate: boolean;
}

export class VersionManager {
  private static instance: VersionManager;
  private currentVersion: string;
  private updateCheckInterval: number = 30000; // 30 seconds

  private constructor() {
    this.currentVersion = this.getCurrentVersion();
    this.initializeVersionChecking();
  }

  static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }

  private getCurrentVersion(): string {
    return (window as any).__APP_VERSION__ || 
           localStorage.getItem('app_version') || 
           '1.0.0';
  }

  private initializeVersionChecking() {
    // Check for updates on app start
    setTimeout(() => this.checkForUpdates(), 5000);
    
    // Set up periodic update checks
    setInterval(() => this.checkForUpdates(), this.updateCheckInterval);
    
    // Listen for visibility change to check when app becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkForUpdates();
      }
    });
  }

  async checkForUpdates(): Promise<VersionInfo> {
    try {
      console.log('[VersionManager] Checking for updates...');
      
      // In a real implementation, this would fetch from an API
      // For now, we'll check against the manifest version
      const manifestResponse = await fetch('/manifest.json?v=' + Date.now(), {
        cache: 'no-cache'
      });
      
      if (!manifestResponse.ok) {
        throw new Error('Failed to fetch manifest');
      }
      
      const manifest = await manifestResponse.json();
      const latestVersion = manifest.version || '1.0.0';
      
      const versionInfo: VersionInfo = {
        current: this.currentVersion,
        latest: latestVersion,
        updateAvailable: this.isNewerVersion(latestVersion, this.currentVersion),
        forceUpdate: this.shouldForceUpdate(latestVersion, this.currentVersion)
      };
      
      console.log('[VersionManager] Version check result:', versionInfo);
      
      if (versionInfo.updateAvailable) {
        this.handleUpdateAvailable(versionInfo);
      }
      
      return versionInfo;
      
    } catch (error) {
      console.error('[VersionManager] Error checking for updates:', error);
      return {
        current: this.currentVersion,
        latest: this.currentVersion,
        updateAvailable: false,
        forceUpdate: false
      };
    }
  }

  private isNewerVersion(latest: string, current: string): boolean {
    const parseVersion = (version: string) => 
      version.split('.').map(num => parseInt(num, 10));
    
    const latestParts = parseVersion(latest);
    const currentParts = parseVersion(current);
    
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }
    
    return false;
  }

  private shouldForceUpdate(latest: string, current: string): boolean {
    // Force update if major version changed
    const latestMajor = parseInt(latest.split('.')[0], 10);
    const currentMajor = parseInt(current.split('.')[0], 10);
    
    return latestMajor > currentMajor;
  }

  private handleUpdateAvailable(versionInfo: VersionInfo) {
    console.log('[VersionManager] Update available:', versionInfo);
    
    // Dispatch custom event for UI components to listen to
    window.dispatchEvent(new CustomEvent('appUpdateAvailable', {
      detail: versionInfo
    }));
    
    if (versionInfo.forceUpdate) {
      this.forceAppUpdate();
    }
  }

  private forceAppUpdate() {
    console.log('[VersionManager] Forcing app update...');
    
    // Clear all caches
    this.clearAllCaches();
    
    // Show update message and reload
    setTimeout(() => {
      if (confirm('A new version of the app is available. The app will now reload to update.')) {
        window.location.reload();
      }
    }, 1000);
  }

  private async clearAllCaches() {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      // Clear storage
      localStorage.setItem('cache_cleared_at', Date.now().toString());
      
      console.log('[VersionManager] All caches cleared');
    } catch (error) {
      console.error('[VersionManager] Error clearing caches:', error);
    }
  }

  async forceRefresh() {
    console.log('[VersionManager] Force refreshing app...');
    await this.clearAllCaches();
    window.location.reload();
  }
}

// Initialize version manager
export const versionManager = VersionManager.getInstance();
