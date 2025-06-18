
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { versionService, UpdateCheckResult } from '@/services/versionService';
import { motion, AnimatePresence } from 'framer-motion';

export const AppUpdateManager: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    let updateCheckInterval: NodeJS.Timeout;
    
    const checkForUpdates = async () => {
      try {
        const updateResult = await versionService.checkForUpdates();
        
        if (updateResult.updateAvailable && !showUpdatePrompt) {
          setUpdateInfo(updateResult);
          setShowUpdatePrompt(true);
          
          if (updateResult.forceUpdate) {
            toast.info('App update available! Please update for the best experience.');
          }
        }
      } catch (error) {
        console.error('[AppUpdateManager] Update check failed:', error);
      }
    };

    // Check immediately
    checkForUpdates();
    
    // Check periodically (every 10 minutes)
    updateCheckInterval = setInterval(checkForUpdates, 10 * 60 * 1000);

    // Listen for service worker updates
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[AppUpdateManager] Service worker updated');
        checkForUpdates();
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      clearInterval(updateCheckInterval);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [showUpdatePrompt]);

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      toast.info('Updating app...');
      
      await versionService.forceUpdate();
    } catch (error) {
      console.error('[AppUpdateManager] Update failed:', error);
      toast.error('Update failed. Please refresh manually.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
    setUpdateInfo(null);
  };

  if (!showUpdatePrompt || !updateInfo?.updateAvailable) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto"
      >
        <Card className="p-4 bg-background border border-orange-200 shadow-lg">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold text-foreground">
                App Update Available
              </h3>
            </div>
            {!updateInfo.forceUpdate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            Version {updateInfo.latestVersion} is available. 
            {updateInfo.forceUpdate ? ' Update required for continued use.' : ''}
          </p>
          
          {updateInfo.changelog && (
            <ul className="text-xs text-muted-foreground mb-3 list-disc list-inside">
              {updateInfo.changelog.slice(0, 3).map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              size="sm"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Update Now
                </>
              )}
            </Button>
            
            {!updateInfo.forceUpdate && (
              <Button
                variant="outline"
                onClick={handleDismiss}
                size="sm"
                className="px-3"
              >
                Later
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
