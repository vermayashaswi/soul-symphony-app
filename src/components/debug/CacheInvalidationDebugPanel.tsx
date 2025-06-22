
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cacheInvalidationService } from '@/services/cacheInvalidationService';
import { twaUpdateService } from '@/services/twaUpdateService';
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { toast } from 'sonner';

const CacheInvalidationDebugPanel: React.FC = () => {
  const [cacheStatus, setCacheStatus] = useState<any>(null);
  const [updateStatus, setUpdateStatus] = useState<any>(null);
  const [isInvalidating, setIsInvalidating] = useState(false);
  const [lastResults, setLastResults] = useState<any[]>([]);
  const twaEnv = detectTWAEnvironment();

  useEffect(() => {
    refreshStatus();
    
    // Auto-refresh status every 10 seconds
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const refreshStatus = () => {
    setCacheStatus(cacheInvalidationService.getCacheStatus());
    setUpdateStatus(twaUpdateService.getUpdateStatus());
  };

  const handleInvalidateCache = async () => {
    setIsInvalidating(true);
    
    try {
      toast.info('Starting cache invalidation...', { duration: 2000 });
      
      const results = await cacheInvalidationService.invalidateAllCaches();
      setLastResults(results);
      
      const successCount = results.filter(r => r.success).length;
      
      if (successCount === results.length) {
        toast.success(`All ${results.length} cache invalidation strategies succeeded!`);
      } else if (successCount > 0) {
        toast.warning(`${successCount}/${results.length} cache invalidation strategies succeeded`);
      } else {
        toast.error('All cache invalidation strategies failed');
      }
      
      refreshStatus();
    } catch (error) {
      console.error('Error invalidating cache:', error);
      toast.error('Failed to invalidate cache');
    } finally {
      setIsInvalidating(false);
    }
  };

  const handleForceUpdate = async () => {
    try {
      toast.info('Forcing update check...', { duration: 2000 });
      const updateInfo = await twaUpdateService.forceUpdateCheck();
      
      if (updateInfo.available) {
        toast.success(`Update available: ${updateInfo.version}`);
      } else {
        toast.info('No updates available');
      }
      
      refreshStatus();
    } catch (error) {
      console.error('Error forcing update:', error);
      toast.error('Failed to check for updates');
    }
  };

  const handleHardRefresh = async () => {
    try {
      toast.info('Performing hard refresh...', { duration: 2000 });
      await cacheInvalidationService.performHardRefresh();
    } catch (error) {
      console.error('Error performing hard refresh:', error);
      toast.error('Failed to perform hard refresh');
    }
  };

  if (!cacheStatus) {
    return <div>Loading cache debug panel...</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Cache Invalidation Debug Panel
            <Badge variant={twaEnv.isTWA || twaEnv.isStandalone ? "default" : "secondary"}>
              {twaEnv.isTWA ? 'TWA' : twaEnv.isStandalone ? 'Standalone' : 'Web'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cache Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Cache Status</h4>
              <div className="space-y-1 text-sm">
                <div>Current Version: <Badge variant="outline">{cacheStatus.version}</Badge></div>
                <div>Manifest Version: <Badge variant="outline">{cacheStatus.manifestVersion || 'None'}</Badge></div>
                <div>Last Invalidation: {cacheStatus.lastInvalidation ? new Date(parseInt(cacheStatus.lastInvalidation)).toLocaleString() : 'Never'}</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Update Status</h4>
              <div className="space-y-1 text-sm">
                <div>Last Check: {updateStatus?.lastCheck ? new Date(updateStatus.lastCheck).toLocaleString() : 'Never'}</div>
                <div>Check Interval: {updateStatus?.checkInterval ? `${Math.round(updateStatus.checkInterval / 1000 / 60)}min` : 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleInvalidateCache}
              disabled={isInvalidating}
              variant="destructive"
              size="sm"
            >
              {isInvalidating ? 'Invalidating...' : 'Invalidate All Caches'}
            </Button>
            
            <Button 
              onClick={handleForceUpdate}
              variant="secondary"
              size="sm"
            >
              Force Update Check
            </Button>
            
            <Button 
              onClick={handleHardRefresh}
              variant="outline"
              size="sm"
            >
              Hard Refresh
            </Button>
            
            <Button 
              onClick={refreshStatus}
              variant="ghost"
              size="sm"
            >
              Refresh Status
            </Button>
          </div>

          {/* Last Results */}
          {lastResults.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Last Cache Invalidation Results</h4>
              <div className="space-y-1">
                {lastResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-2 border rounded">
                    <span>{result.method}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? 'Success' : 'Failed'}
                      </Badge>
                      {result.error && (
                        <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {result.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            This panel is only visible in development mode. Use these tools to test cache invalidation strategies.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CacheInvalidationDebugPanel;
