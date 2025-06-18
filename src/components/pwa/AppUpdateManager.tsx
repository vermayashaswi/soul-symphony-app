
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import { versionService, UpdateInfo } from '@/services/versionService';
import { toast } from 'sonner';

const AppUpdateManager: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    checkForUpdates();
    
    // Start polling for updates
    versionService.startUpdatePolling();

    // Listen for service worker updates
    const handleControllerChange = () => {
      console.log('[AppUpdateManager] Service worker updated');
      toast.success('App updated successfully!');
      setIsUpdating(false);
      setShowDialog(false);
    };

    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      versionService.stopUpdatePolling();
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const checkForUpdates = async () => {
    try {
      const info = await versionService.checkForUpdates();
      setUpdateInfo(info);
      
      if (info.available && !showDialog) {
        setShowDialog(true);
      }
    } catch (error) {
      console.error('[AppUpdateManager] Error checking for updates:', error);
    }
  };

  const handleUpdate = async () => {
    if (!updateInfo?.available) return;

    setIsUpdating(true);
    setUpdateProgress(0);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUpdateProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const success = await versionService.applyUpdate();
      
      if (success) {
        setUpdateProgress(100);
        setTimeout(() => {
          // The page will reload automatically
        }, 500);
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      console.error('[AppUpdateManager] Update failed:', error);
      toast.error('Update failed. Please try again.');
      setIsUpdating(false);
      clearInterval(progressInterval);
    }
  };

  const handleSkip = () => {
    setShowDialog(false);
    // Check again in 1 hour
    setTimeout(checkForUpdates, 60 * 60 * 1000);
  };

  if (!updateInfo?.available) {
    return null;
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Download className="w-5 h-5 text-blue-500" />
            <span>App Update Available</span>
            {updateInfo.mandatory && (
              <Badge variant="destructive" className="text-xs">
                Required
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Current: {updateInfo.currentVersion}</span>
              <span>Latest: {updateInfo.latestVersion}</span>
            </div>
            
            {updateInfo.updateSize && (
              <div className="text-sm text-muted-foreground">
                Download size: {updateInfo.updateSize}
              </div>
            )}

            {updateInfo.releaseNotes && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium mb-1">What's new:</p>
                <p className="text-sm text-muted-foreground">
                  {updateInfo.releaseNotes}
                </p>
              </div>
            )}

            {isUpdating && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Updating app...</span>
                </div>
                <Progress value={updateProgress} className="w-full" />
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row space-y-2 sm:space-y-0">
          {!updateInfo.mandatory && !isUpdating && (
            <Button variant="outline" onClick={handleSkip}>
              Later
            </Button>
          )}
          <Button 
            onClick={handleUpdate} 
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Updating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Update Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppUpdateManager;
