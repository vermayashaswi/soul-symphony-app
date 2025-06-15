
import React from 'react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const FeatureFlagDemo: React.FC = () => {
  const { enabled: advancedInsights, isLoading: loadingInsights } = useFeatureFlag('advanced_insights');
  const { enabled: betaChat, isLoading: loadingChat } = useFeatureFlag('beta_chat');
  const { enabled: experimentalUI, isLoading: loadingUI } = useFeatureFlag('experimental_ui');

  if (loadingInsights || loadingChat || loadingUI) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>Loading feature flags...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Feature Flags Status</CardTitle>
        <CardDescription>Current feature availability for your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Advanced Insights</span>
          <Badge variant={advancedInsights ? "default" : "secondary"}>
            {advancedInsights ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Beta Chat Features</span>
          <Badge variant={betaChat ? "default" : "secondary"}>
            {betaChat ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Experimental UI</span>
          <Badge variant={experimentalUI ? "default" : "secondary"}>
            {experimentalUI ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        {advancedInsights && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              🎉 Advanced Insights are enabled! You have access to enhanced analytics.
            </p>
          </div>
        )}

        {betaChat && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300">
              🚀 Beta Chat Features are available for your premium account!
            </p>
          </div>
        )}

        {experimentalUI && (
          <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              🔬 Experimental UI features are enabled for testing.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
