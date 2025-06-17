
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, CloudOff, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[Network] Back online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[Network] Gone offline');
    };

    const handleJournalSyncSuccess = () => {
      setPendingSyncCount(prev => Math.max(0, prev - 1));
    };

    // Check for pending offline entries
    const checkPendingSyncItems = () => {
      try {
        const request = indexedDB.open('SouloOfflineDB', 1);
        
        request.onsuccess = () => {
          const db = request.result;
          if (db.objectStoreNames.contains('journalEntries')) {
            const transaction = db.transaction(['journalEntries'], 'readonly');
            const store = transaction.objectStore('journalEntries');
            const index = store.index('offline');
            
            const countRequest = index.count(true);
            countRequest.onsuccess = () => {
              setPendingSyncCount(countRequest.result);
            };
          }
        };
      } catch (error) {
        console.error('[OfflineIndicator] Error checking pending sync items:', error);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('journalSyncSuccess', handleJournalSyncSuccess);

    // Initial check
    checkPendingSyncItems();

    // Periodic check for pending items
    const interval = setInterval(checkPendingSyncItems, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('journalSyncSuccess', handleJournalSyncSuccess);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && pendingSyncCount === 0) {
    return null; // Don't show when online and no pending syncs
  }

  return (
    <Badge
      variant={isOnline ? "default" : "destructive"}
      className={cn(
        "flex items-center space-x-1 text-xs transition-all duration-300",
        className
      )}
    >
      {isOnline ? (
        <>
          <Cloud className="w-3 h-3" />
          <span>
            {pendingSyncCount > 0 ? `Syncing ${pendingSyncCount}` : 'Online'}
          </span>
        </>
      ) : (
        <>
          <CloudOff className="w-3 h-3" />
          <span>Offline</span>
          {pendingSyncCount > 0 && (
            <span className="bg-white text-destructive rounded-full px-1 text-xs">
              {pendingSyncCount}
            </span>
          )}
        </>
      )}
    </Badge>
  );
};

export default OfflineIndicator;
