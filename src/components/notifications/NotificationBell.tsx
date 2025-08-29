import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationCenter } from './NotificationCenter';
import { supabase } from '@/integrations/supabase/client';
import { TranslatableText } from '@/components/translation/TranslatableText';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    
    // Set up real-time subscription for new notifications
    const channel = supabase
      .channel('notification-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_app_notifications'
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadUnreadCount = async () => {
    try {
      const { count, error } = await supabase
        .from('user_app_notifications')
        .select('*', { count: 'exact', head: true })
        .is('read_at', null)
        .is('dismissed_at', null);

      if (error) throw error;

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2"
          onClick={() => setIsOpen(true)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500 hover:bg-red-600"
            >
              <TranslatableText text={unreadCount > 9 ? '9+' : unreadCount.toString()} />
            </Badge>
          )}
        </Button>
      </div>
      
      <NotificationCenter 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
};