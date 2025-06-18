
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X, AlertTriangle } from 'lucide-react';
import { VersionInfo } from '@/utils/versionManager';

const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = (event: CustomEvent) => {
      const versionInfo = event.detail as VersionInfo;
      setUpdateInfo(versionInfo);
      setShowNotification(true);
    };

    window.addEventListener('appUpdateAvailable', handleUpdateAvailable as EventListener);

    return () => {
      window.removeEventListener('appUpdateAvailable', handleUpdateAvailable as EventListener);
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      // Force service worker update
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => registration.update())
        );
      }
      
      // Clear local storage cache indicators
      localStorage.setItem('app_updated_at', Date.now().toString());
      
      // Reload the app
      window.location.reload();
      
    } catch (error) {
      console.error('[UpdateNotification] Error during update:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    if (updateInfo?.forceUpdate) {
      // Can't dismiss force updates
      return;
    }
    setShowNotification(false);
  };

  if (!showNotification || !updateInfo) {
    return null;
  }

  return (
    <Card className="fixed top-4 left-4 right-4 z-[9999] bg-white shadow-lg border border-blue-200 md:left-auto md:right-4 md:w-96">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              updateInfo.forceUpdate ? 'bg-orange-500' : 'bg-blue-500'
            }`}>
              {updateInfo.forceUpdate ? (
                <AlertTriangle className="w-5 h-5 text-white" />
              ) : (
                <RefreshCw className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {updateInfo.forceUpdate ? 'Required Update' : 'Update Available'}
              </h3>
              <p className="text-sm text-gray-600">
                Version {updateInfo.latest} is ready
              </p>
            </div>
          </div>
          {!updateInfo.forceUpdate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="space-y-2 mb-4">
          <div className="text-sm text-gray-600">
            Current: {updateInfo.current} → Latest: {updateInfo.latest}
          </div>
          {updateInfo.forceUpdate && (
            <div className="text-sm text-orange-600 font-medium">
              This update includes important fixes and is required.
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex-1"
            variant={updateInfo.forceUpdate ? "default" : "outline"}
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Update Now
              </>
            )}
          </Button>
          
          {!updateInfo.forceUpdate && (
            <Button 
              variant="ghost" 
              onClick={handleDismiss}
              disabled={isUpdating}
            >
              Later
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UpdateNotification;
