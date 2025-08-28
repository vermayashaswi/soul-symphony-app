import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Clear notifications when user logs out
    if (!user) {
      console.log('[useNotifications] User logged out, clearing state');
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    console.log('[useNotifications] User authenticated, loading notifications');
    
    // Small delay to ensure user state is fully loaded
    const timeoutId = setTimeout(() => {
      loadNotifications();
      loadUnreadCount();
    }, 100);
    
    // Set up real-time subscription for new notifications
    const channel = supabase
      .channel(`notification-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_app_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[useNotifications] Real-time notification update:', payload);
          if (user) {
            // Reload notifications and count
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
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [toast, user]);

  const loadNotifications = async (retryCount = 0) => {
    if (!user) {
      console.log('[useNotifications] No user, clearing notifications');
      setNotifications([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    console.log('[useNotifications] Loading notifications for user:', user.id);
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('user_app_notifications')
        .select('*')
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[useNotifications] Supabase error loading notifications:', error);
        throw error;
      }

      console.log('[useNotifications] Loaded notifications:', data?.length || 0);
      setNotifications((data || []) as AppNotification[]);
      setError(null);
    } catch (error: any) {
      console.error('[useNotifications] Error loading notifications:', error);
      const errorMessage = error?.message || 'Failed to load notifications';
      setError(errorMessage);
      
      // Retry logic for network errors
      if (retryCount < 2 && (errorMessage.includes('network') || errorMessage.includes('timeout'))) {
        console.log('[useNotifications] Retrying notification load, attempt:', retryCount + 1);
        setTimeout(() => loadNotifications(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!user) {
      console.log('[useNotifications] No user for unread count');
      setUnreadCount(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from('user_app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null)
        .is('dismissed_at', null);

      if (error) {
        console.error('[useNotifications] Error loading unread count:', error);
        return;
      }

      console.log('[useNotifications] Unread count:', count || 0);
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('[useNotifications] Error loading unread count:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

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
    if (!user) return;

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
    if (!user) return;

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
    if (!user) return;

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

  // Add retry function for manual retry attempts
  const retryLoadNotifications = () => {
    console.log('[useNotifications] Manual retry requested');
    setError(null);
    loadNotifications();
    loadUnreadCount();
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    isAuthenticated: !!user,
    markAsRead,
    markAsUnread,
    dismissNotification,
    markAllAsRead,
    createNotification,
    loadNotifications: retryLoadNotifications,
    loadUnreadCount
  };
};