
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAllFeatureFlags } from '@/hooks/useFeatureFlag';
import { useFeatureFlagAdmin } from '@/hooks/useFeatureFlagAdmin';
import { AppFeatureFlag } from '@/types/featureFlags';

const FeatureFlagDebugPanel: React.FC = () => {
  const { flags, loading: contextLoading, error, refetch } = useAllFeatureFlags();
  const { setUserFeatureFlag, removeUserFeatureFlag, loading: adminLoading } = useFeatureFlagAdmin();

  const handleToggle = async (flagName: AppFeatureFlag, currentValue: boolean) => {
    const success = await setUserFeatureFlag(flagName, !currentValue);
    if (success) {
      // Refetch flags to update the UI
      await refetch();
    }
  };

  const handleRemoveOverride = async (flagName: AppFeatureFlag) => {
    const success = await removeUserFeatureFlag(flagName);
    if (success) {
      await refetch();
    }
  };

  if (contextLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Feature Flags...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Feature Flags Debug Panel
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refetch}
            disabled={contextLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
        {error && (
          <p className="text-sm text-destructive">Error: {error}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(flags).map(([flagName, enabled]) => (
          <div key={flagName} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">{flagName}</p>
              <p className="text-sm text-muted-foreground">
                Currently: {enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={enabled}
                onCheckedChange={() => handleToggle(flagName as AppFeatureFlag, enabled)}
                disabled={adminLoading}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemoveOverride(flagName as AppFeatureFlag)}
                disabled={adminLoading}
              >
                Reset
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default FeatureFlagDebugPanel;
