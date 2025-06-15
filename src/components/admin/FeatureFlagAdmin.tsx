
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { featureFlagService, FeatureFlag } from '@/services/featureFlagService';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Settings, Users, Percent } from 'lucide-react';

const FeatureFlagAdmin: React.FC = () => {
  const { flags, loading, refreshFlags } = useFeatureFlags();
  const { toast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  const handleToggleFlag = async (flag: FeatureFlag) => {
    setUpdating(flag.id);
    try {
      const success = await featureFlagService.updateFlag(flag.id, {
        is_enabled: !flag.is_enabled
      });

      if (success) {
        toast({
          title: "Feature Flag Updated",
          description: `${flag.name} has been ${!flag.is_enabled ? 'enabled' : 'disabled'}`,
        });
        await refreshFlags();
      } else {
        toast({
          title: "Update Failed",
          description: "Failed to update feature flag",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating flag:', error);
      toast({
        title: "Error",
        description: "An error occurred while updating the feature flag",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const handlePercentageChange = async (flag: FeatureFlag, newPercentage: number) => {
    if (newPercentage < 0 || newPercentage > 100) return;

    setUpdating(flag.id);
    try {
      const success = await featureFlagService.updateFlag(flag.id, {
        target_percentage: newPercentage
      });

      if (success) {
        toast({
          title: "Rollout Updated",
          description: `${flag.name} rollout set to ${newPercentage}%`,
        });
        await refreshFlags();
      } else {
        toast({
          title: "Update Failed",
          description: "Failed to update rollout percentage",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating percentage:', error);
      toast({
        title: "Error",
        description: "An error occurred while updating the rollout percentage",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (flag: FeatureFlag) => {
    if (!flag.is_enabled) return 'secondary';
    if (flag.target_percentage >= 100) return 'default';
    if (flag.target_percentage > 0) return 'outline';
    return 'secondary';
  };

  const getStatusText = (flag: FeatureFlag) => {
    if (!flag.is_enabled) return 'Disabled';
    if (flag.target_percentage >= 100) return 'Fully Enabled';
    if (flag.target_percentage > 0) return `${flag.target_percentage}% Rollout`;
    return 'Enabled (0%)';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading feature flags...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Feature Flag Admin</h2>
          <p className="text-muted-foreground">
            Manage feature flags and rollout percentages
          </p>
        </div>
        <Button onClick={refreshFlags} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {flags.map((flag) => (
          <Card key={flag.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{flag.name}</CardTitle>
                  <CardDescription>{flag.description}</CardDescription>
                </div>
                <Badge variant={getStatusColor(flag)}>
                  {getStatusText(flag)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <Label htmlFor={`enabled-${flag.id}`}>Enabled</Label>
                </div>
                <Switch
                  id={`enabled-${flag.id}`}
                  checked={flag.is_enabled}
                  onCheckedChange={() => handleToggleFlag(flag)}
                  disabled={updating === flag.id}
                />
              </div>

              {flag.is_enabled && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Percent className="h-4 w-4" />
                    <Label htmlFor={`percentage-${flag.id}`}>Rollout Percentage</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input
                      id={`percentage-${flag.id}`}
                      type="number"
                      min="0"
                      max="100"
                      value={flag.target_percentage}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        if (value >= 0 && value <= 100) {
                          handlePercentageChange(flag, value);
                        }
                      }}
                      disabled={updating === flag.id}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {flag.target_percentage === 0 && 'Feature is enabled but not rolled out to any users'}
                    {flag.target_percentage > 0 && flag.target_percentage < 100 && 
                      `Feature is rolled out to ${flag.target_percentage}% of users`}
                    {flag.target_percentage >= 100 && 'Feature is enabled for all users'}
                  </p>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <div>Created: {new Date(flag.created_at).toLocaleDateString()}</div>
                <div>Updated: {new Date(flag.updated_at).toLocaleDateString()}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {flags.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Users className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No feature flags found</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FeatureFlagAdmin;
