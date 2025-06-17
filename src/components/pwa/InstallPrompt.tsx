
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { usePWA } from '@/hooks/use-pwa';
import { TranslatableText } from '@/components/translation/TranslatableText';

export function InstallPrompt() {
  const { canInstall, isInstalling, install } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Show prompt after a delay if installable and not dismissed
    if (canInstall && !dismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [canInstall, dismissed]);

  useEffect(() => {
    // Check if user has previously dismissed
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!canInstall || dismissed || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-4 flex items-center gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">
            <TranslatableText text="Install Soulo" />
          </h3>
          <p className="text-xs text-muted-foreground">
            <TranslatableText text="Get the app experience with offline access" />
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleInstall}
            disabled={isInstalling}
            className="h-8 px-3"
          >
            {isInstalling ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
