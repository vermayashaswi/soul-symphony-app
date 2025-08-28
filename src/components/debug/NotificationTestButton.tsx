import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const NotificationTestButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const createTestNotifications = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to test notifications",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('[NotificationTestButton] Starting comprehensive notification test for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('test-notification-flow', {
        body: { 
          userId: user.id,
          bypassUserPreferences: true,
          testAllFunctions: true
        }
      });

      if (error) {
        console.error('[NotificationTestButton] Error:', error);
        throw error;
      }

      console.log('[NotificationTestButton] Comprehensive test response:', data);

      if (data.success) {
        const fcmSuccess = data.testNotifications?.fcmPush?.sent ? '✅' : '❌';
        const inAppSuccess = data.testNotifications?.inApp?.sent ? '✅' : '❌';
        const customSuccess = data.testNotifications?.custom?.sent ? '✅' : '❌';
        const categorizedSuccess = data.testNotifications?.categorized?.sent ? '✅' : '❌';
        
        toast({
          title: "Comprehensive Notification Test Complete",
          description: `FCM Push: ${fcmSuccess} | In-App: ${inAppSuccess} | Custom: ${customSuccess} | Categorized: ${categorizedSuccess}`,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('[NotificationTestButton] Error in comprehensive test:', error);
      toast({
        title: "Error",
        description: `Comprehensive test failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Button 
      onClick={createTestNotifications} 
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      {isLoading ? 'Testing All...' : 'Test All Notifications'}
    </Button>
  );
};