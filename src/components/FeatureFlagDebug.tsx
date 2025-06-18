
import React from 'react';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { CacheBustingService } from '@/services/cacheBustingService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FeatureFlagDebug: React.FC = () => {
  const { flags, loading, lastUpdated } = useFeatureFlagsContext();

  const handleManualCacheBust = () => {
    CacheBustingService.bustCache();
    window.location.reload();
  };

  const handleCheckCacheBust = async () => {
    await CacheBustingService.performCacheBustingCheck();
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 max-h-96 overflow-auto z-50 bg-white dark:bg-gray-800 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Feature Flag Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs">
          <strong>Loading:</strong> {loading ? 'Yes' : 'No'}
        </div>
        <div className="text-xs">
          <strong>Last Updated:</strong> {lastUpdated?.toLocaleTimeString() || 'Never'}
        </div>
        <div className="text-xs">
          <strong>Cache Version:</strong> {CacheBustingService.getCacheVersion()}
        </div>
        <div className="text-xs">
          <strong>Is Native:</strong> {/native/i.test(navigator.userAgent) ? 'Yes' : 'No'}
        </div>
        
        <div className="space-y-1">
          <div className="text-xs font-semibold">Flags:</div>
          {Object.entries(flags).map(([key, value]) => (
            <div key={key} className="text-xs flex justify-between">
              <span>{key}:</span>
              <span className={value ? 'text-green-600' : 'text-red-600'}>
                {value ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>
        
        <div className="space-y-1 pt-2">
          <Button size="sm" onClick={handleCheckCacheBust} className="w-full text-xs">
            Check Cache Bust
          </Button>
          <Button size="sm" onClick={handleManualCacheBust} variant="destructive" className="w-full text-xs">
            Force Cache Bust
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeatureFlagDebug;
