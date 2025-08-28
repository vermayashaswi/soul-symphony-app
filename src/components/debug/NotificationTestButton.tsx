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
        description: "You must be logged in to create test notifications",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('[NotificationTestButton] Creating test notifications for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('create-test-notification', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('[NotificationTestButton] Error:', error);
        throw error;
      }

      console.log('[NotificationTestButton] Response:', data);

      if (data.success) {
        toast({
          title: "Test Notifications Created",
          description: `Successfully created ${data.notifications_created} test notifications. Total: ${data.total_notifications}`,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('[NotificationTestButton] Error creating test notifications:', error);
      toast({
        title: "Error",
        description: `Failed to create test notifications: ${error.message}`,
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
      {isLoading ? 'Creating...' : 'Create Test Notifications'}
    </Button>
  );
};