
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaintenanceBannerProps {
  message?: string;
  isVisible?: boolean;
  onDismiss?: () => void;
  isDismissible?: boolean;
}

const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({
  message = "🔧 We're performing maintenance to improve your experience. Some features may be temporarily unavailable.",
  isVisible = true,
  onDismiss,
  isDismissible = false
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white shadow-lg">
      <Alert className="rounded-none border-0 bg-orange-500 text-white p-3">
        <AlertTriangle className="h-4 w-4 text-white" />
        <div className="flex items-center justify-between w-full">
          <AlertDescription className="text-white font-medium text-sm">
            {message}
          </AlertDescription>
          {isDismissible && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0 hover:bg-orange-600 text-white ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Alert>
    </div>
  );
};

export default MaintenanceBanner;
