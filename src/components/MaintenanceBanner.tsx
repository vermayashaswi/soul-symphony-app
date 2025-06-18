
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

const MaintenanceBanner: React.FC = () => {
  const isMaintenanceEnabled = useFeatureFlag('maintenanceBanner');

  if (!isMaintenanceEnabled) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white shadow-lg">
      <Alert className="rounded-none border-0 bg-orange-500 text-white p-3">
        <AlertTriangle className="h-4 w-4 text-white" />
        <AlertDescription className="text-white font-medium text-sm">
          🔧 We're performing maintenance to improve your experience. Some features may be temporarily unavailable.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default MaintenanceBanner;
