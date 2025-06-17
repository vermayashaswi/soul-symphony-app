
import { useState, useEffect } from 'react';
import { pwaService } from '@/services/pwaService';

export function usePWA() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Initial checks
    setCanInstall(pwaService.canInstall());
    setIsStandalone(pwaService.isStandalone());

    // Listen for installable event
    const handleInstallable = (event: CustomEvent) => {
      setCanInstall(event.detail.canInstall);
    };

    window.addEventListener('pwa-installable', handleInstallable as EventListener);

    // Check for updates on mount
    pwaService.checkForUpdates();
    
    // Request persistent storage
    pwaService.requestPersistentStorage();

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable as EventListener);
    };
  }, []);

  const install = async () => {
    if (!canInstall) return false;
    
    setIsInstalling(true);
    try {
      const success = await pwaService.install();
      if (success) {
        setCanInstall(false);
        setIsStandalone(true);
      }
      return success;
    } finally {
      setIsInstalling(false);
    }
  };

  const checkForUpdates = () => {
    return pwaService.checkForUpdates();
  };

  return {
    canInstall,
    isInstalling,
    isStandalone,
    install,
    checkForUpdates
  };
}
