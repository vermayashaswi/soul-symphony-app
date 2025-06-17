
export class PWAService {
  private deferredPrompt: any = null;
  private isInstallable = false;

  constructor() {
    this.init();
  }

  private init() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA: beforeinstallprompt event fired');
      e.preventDefault();
      this.deferredPrompt = e;
      this.isInstallable = true;
      this.dispatchInstallableEvent();
    });

    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
      console.log('PWA: App installed successfully');
      this.deferredPrompt = null;
      this.isInstallable = false;
    });

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('PWA: App is running in standalone mode');
    }
  }

  public canInstall(): boolean {
    return this.isInstallable && this.deferredPrompt !== null;
  }

  public async install(): Promise<boolean> {
    if (!this.canInstall()) {
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA: User accepted the install prompt');
        return true;
      } else {
        console.log('PWA: User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('PWA: Error during installation:', error);
      return false;
    } finally {
      this.deferredPrompt = null;
      this.isInstallable = false;
    }
  }

  public isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  public async checkForUpdates(): Promise<boolean> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          return true;
        }
      } catch (error) {
        console.error('PWA: Error checking for updates:', error);
      }
    }
    return false;
  }

  private dispatchInstallableEvent() {
    const event = new CustomEvent('pwa-installable', {
      detail: { canInstall: this.canInstall() }
    });
    window.dispatchEvent(event);
  }

  public async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const granted = await navigator.storage.persist();
        console.log('PWA: Persistent storage granted:', granted);
        return granted;
      } catch (error) {
        console.error('PWA: Error requesting persistent storage:', error);
      }
    }
    return false;
  }
}

export const pwaService = new PWAService();
