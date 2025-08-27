import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'reminder';
  data: Record<string, any>;
  read_at: string | null;
  dismissed_at: string | null;
  action_url: string | null;
  action_label: string | null;
  expires_at: string | null;
  created_at: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadNotifications();
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
        (payload) => {
          console.log('Notification update:', payload);
          loadNotifications();
          loadUnreadCount();
          
          // Show toast for new notifications
          if (payload.eventType === 'INSERT' && payload.new) {
            const newNotification = payload.new as AppNotification;
            toast({
              title: newNotification.title,
              description: newNotification.message,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_app_notifications')
        .select('*')
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications((data || []) as AppNotification[]);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('user_app_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAsUnread = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('user_app_notifications')
        .update({ read_at: null })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: null }
            : n
        )
      );
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking notification as unread:', error);
    }
  };

  const dismissNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('user_app_notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      loadUnreadCount();
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('user_app_notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
        .is('dismissed_at', null);

      if (error) throw error;

      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const createNotification = async (notification: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'reminder';
    data?: Record<string, any>;
    action_url?: string | null;
    action_label?: string | null;
    expires_at?: string | null;
  }) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('user_app_notifications')
        .insert([{
          ...notification,
          user_id: user.user.id,
          data: notification.data || {}
        }]);

      if (error) throw error;

      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAsUnread,
    dismissNotification,
    markAllAsRead,
    createNotification,
    loadNotifications,
    loadUnreadCount
  };
};