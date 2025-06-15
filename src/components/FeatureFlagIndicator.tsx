
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { Flag } from 'lucide-react';

interface FeatureFlagIndicatorProps {
  flagName: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showBadge?: boolean;
}

const FeatureFlagIndicator: React.FC<FeatureFlagIndicatorProps> = ({
  flagName,
  children,
  fallback = null,
  showBadge = false
}) => {
  const isEnabled = useFeatureFlag(flagName);

  if (!isEnabled) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative">
      {children}
      {showBadge && (
        <Badge 
          variant="outline" 
          className="absolute -top-2 -right-2 text-xs bg-blue-50 text-blue-700 border-blue-200"
        >
          <Flag className="h-3 w-3 mr-1" />
          BETA
        </Badge>
      )}
    </div>
  );
};

export default FeatureFlagIndicator;
