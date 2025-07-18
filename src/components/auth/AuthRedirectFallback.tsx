import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { nativeNavigationService } from '@/services/nativeNavigationService';

interface AuthRedirectFallbackProps {
  onManualRedirect?: () => void;
}

export const AuthRedirectFallback = ({ onManualRedirect }: AuthRedirectFallbackProps) => {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Show fallback after 2 seconds if user hasn't been redirected
    const timer = setTimeout(() => {
      setShowFallback(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleManualRedirect = () => {
    if (onManualRedirect) {
      onManualRedirect();
    } else {
      // Force navigation to home
      nativeNavigationService.forceReload();
    }
  };

  if (!showFallback) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-6 max-w-md mx-auto p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Almost there!</h2>
          <p className="text-muted-foreground">
            You've been signed in successfully. If you're not redirected automatically, 
            you can continue manually.
          </p>
        </div>
        
        <Button 
          onClick={handleManualRedirect}
          className="w-full"
          size="lg"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Continue to App
        </Button>
      </div>
    </div>
  );
};