
import React from 'react';
import { Button } from '@/components/ui/button';
import SouloLogo from '@/components/SouloLogo';

interface EmergencyFallbackProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

const EmergencyFallback: React.FC<EmergencyFallbackProps> = ({ 
  error, 
  resetErrorBoundary 
}) => {
  console.log('[EmergencyFallback] Rendered with error:', error?.message);
  
  const handleReload = () => {
    // Clear any problematic state
    localStorage.removeItem('authRedirectTo');
    
    // Force a clean reload
    window.location.href = '/';
  };

  const handleGoHome = () => {
    // Clear any problematic state
    localStorage.removeItem('authRedirectTo');
    
    // Navigate to homepage
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-4">
          <SouloLogo size="large" />
          <h1 className="text-2xl font-bold text-foreground">
            Oops! Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We're having trouble loading the page. This might be a temporary issue.
          </p>
        </div>
        
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-mono break-all">
              {error.message}
            </p>
          </div>
        )}
        
        <div className="space-y-3">
          <Button 
            onClick={resetErrorBoundary || handleReload}
            className="w-full"
            size="lg"
          >
            Try Again
          </Button>
          
          <Button 
            onClick={handleGoHome}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Go to Homepage
          </Button>
          
          <Button 
            onClick={() => window.location.reload()}
            variant="ghost"
            className="w-full"
            size="sm"
          >
            Force Refresh
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>If the problem persists, try:</p>
          <ul className="space-y-1">
            <li>• Clearing your browser cache</li>
            <li>• Disabling browser extensions</li>
            <li>• Using a different browser</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EmergencyFallback;
