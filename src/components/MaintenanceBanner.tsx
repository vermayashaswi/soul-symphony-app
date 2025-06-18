
import React, { useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { supabase } from '@/integrations/supabase/client';

const MaintenanceBanner: React.FC = () => {
  const isMaintenanceEnabled = useFeatureFlag('maintenanceBanner');

  useEffect(() => {
    console.log('[MaintenanceBanner] Component mounted, maintenance enabled:', isMaintenanceEnabled);
    console.log('[MaintenanceBanner] Current route:', window.location.pathname);
    console.log('[MaintenanceBanner] User agent:', navigator.userAgent);
    
    // Set up real-time subscription for feature flag updates
    const channel = supabase
      .channel('feature-flags-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_flags',
          filter: 'name=eq.maintenanceBanner'
        },
        (payload) => {
          console.log('[MaintenanceBanner] Feature flag update received:', payload);
          // The FeatureFlagsContext will handle the state update automatically
        }
      )
      .subscribe((status) => {
        console.log('[MaintenanceBanner] Realtime subscription status:', status);
      });

    return () => {
      console.log('[MaintenanceBanner] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [isMaintenanceEnabled]);

  if (!isMaintenanceEnabled) {
    console.log('[MaintenanceBanner] Banner not enabled, not rendering');
    return null;
  }

  console.log('[MaintenanceBanner] Rendering maintenance banner');

  return (
    <div 
      className="fixed top-0 left-0 right-0 bg-orange-500 text-white shadow-lg"
      style={{ 
        zIndex: 99999, // Extremely high z-index to ensure it appears above everything
        position: 'fixed',
        width: '100%'
      }}
    >
      <Alert className="rounded-none border-0 bg-orange-500 text-white p-3 m-0">
        <AlertTriangle className="h-4 w-4 text-white" />
        <AlertDescription className="text-white font-medium text-sm">
          🔧 We're performing maintenance to improve your experience. Some features may be temporarily unavailable.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default MaintenanceBanner;
