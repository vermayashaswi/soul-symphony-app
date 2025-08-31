import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

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
  
  // Refs to track stable state and prevent race conditions
  const currentUserIdRef = useRef<string | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup function
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Handle authentication state changes with stability checks
    const userId = user?.id || null;
    
    // If user ID hasn't changed, don't reload
    if (currentUserIdRef.current === userId) {
      return;
    }
    
    currentUserIdRef.current = userId;
    
    // Clear timeout from previous operations
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    // Clear notifications when user logs out
    if (!user || !userId) {
      console.log('[useNotifications] User logged out, clearing state');
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    console.log('[useNotifications] User authenticated, loading notifications for user ID:', userId);
    
    // Load notifications with authentication stability
    loadNotificationsStable();
    loadUnreadCountStable();
    
    let channel: any = null;
    let appStateListener: any = null;
    let foregroundListener: any = null;
    let fcmListener: any = null;

    const setupSubscription = () => {
      // Set up real-time subscription for new notifications with optimized filters
      channel = supabase
        .channel(`notification-updates-${userId}`, {
          config: {
            broadcast: { self: false }, // Reduce latency by not echoing our own changes
            presence: { key: userId }
          }
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_app_notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('[useNotifications] Real-time notification insert:', payload);
            // Only process if user is still the same and component is mounted
            if (currentUserIdRef.current === userId && isMountedRef.current) {
              // Show toast for new notifications
              if (payload.new) {
                const newNotification = payload.new as AppNotification;
                toast({
                  title: newNotification.title,
                  description: newNotification.message,
                  duration: 5000,
                });
              }
              
              // Reload for new notifications only - no debounce needed for bell updates
              loadNotificationsStable();
              loadUnreadCountStable();
            }
          }
        )
        .subscribe();
    };

    const setupAppLifecycleListeners = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Listen for app state changes (foreground/background)
          appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
            console.log('[useNotifications] App state changed:', isActive ? 'foreground' : 'background');
            
            if (isActive && isMountedRef.current && currentUserIdRef.current === userId) {
              // App became active - refresh notifications to catch any background notifications
              console.log('[useNotifications] App became active, refreshing notifications...');
              setTimeout(() => {
                if (isMountedRef.current && currentUserIdRef.current === userId) {
                  loadNotificationsStable();
                  loadUnreadCountStable();
                }
              }, 500); // Slight delay to ensure app is fully active
            }
          });

          // Listen for URL open events (when app is opened from notification)
          foregroundListener = await App.addListener('appUrlOpen', (event) => {
            console.log('[useNotifications] App opened from URL:', event.url);
            // Refresh notifications when app is opened from external source
            if (isMountedRef.current && currentUserIdRef.current === userId) {
              setTimeout(() => {
                if (isMountedRef.current && currentUserIdRef.current === userId) {
                  loadNotificationsStable();
                  loadUnreadCountStable();
                }
              }, 1000);
            }
          });

          console.log('[useNotifications] App lifecycle listeners set up');
        } catch (error) {
          console.warn('[useNotifications] Failed to set up app lifecycle listeners:', error);
        }
      }
    };

    const setupFCMListener = () => {
      // Listen for FCM notification events
      const handleFCMNotification = () => {
        console.log('[useNotifications] FCM notification received, refreshing...');
        if (isMountedRef.current && currentUserIdRef.current === userId) {
          setTimeout(() => {
            if (isMountedRef.current && currentUserIdRef.current === userId) {
              loadNotificationsStable();
              loadUnreadCountStable();
            }
          }, 1000); // Allow time for backend to process
        }
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('fcm-notification-received', handleFCMNotification);
        fcmListener = () => window.removeEventListener('fcm-notification-received', handleFCMNotification);
      }
    };

    // Set up subscription, lifecycle listeners, and FCM listener
    setupSubscription();
    setupAppLifecycleListeners();
    setupFCMListener();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (appStateListener) {
        appStateListener.remove();
      }
      if (foregroundListener) {
        foregroundListener.remove();
      }
      if (fcmListener) {
        fcmListener();
      }
    };
  }, [user?.id, toast]);

  const loadNotificationsStable = useCallback(async (retryCount = 0) => {
    const userId = currentUserIdRef.current;
    
    if (!userId || !isMountedRef.current) {
      console.log('[useNotifications] No user ID or component unmounted, clearing notifications');
      setNotifications([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    console.log('[useNotifications] Loading notifications for user:', userId);
    setIsLoading(true);
    setError(null);
    
    // Set a timeout to prevent stuck loading states
    loadingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        console.log('[useNotifications] Loading timeout reached, clearing loading state');
        setIsLoading(false);
        setError('Loading timeout - please try again');
      }
    }, 10000);
    
    try {
      console.log('[useNotifications] Querying user_app_notifications table...');
      
      const { data, error, count } = await supabase
        .from('user_app_notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      // Clear the timeout since we got a response
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      console.log('[useNotifications] Query result:', { 
        data: data, 
        error: error, 
        count: count,
        dataLength: data?.length || 0 
      });

      // Check if component is still mounted and user hasn't changed
      if (!isMountedRef.current || currentUserIdRef.current !== userId) {
        console.log('[useNotifications] Component unmounted or user changed during query');
        return;
      }

      if (error) {
        console.error('[useNotifications] Supabase error loading notifications:', error);
        throw error;
      }

      console.log('[useNotifications] Successfully loaded notifications:', data?.length || 0);
      
      setNotifications((data || []) as AppNotification[]);
      setError(null);
    } catch (error: any) {
      console.error('[useNotifications] Error loading notifications:', error);
      
      // Clear timeout on error
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      // Check if component is still mounted and user hasn't changed
      if (!isMountedRef.current || currentUserIdRef.current !== userId) {
        return;
      }
      
      const errorMessage = error?.message || 'Failed to load notifications';
      setError(errorMessage);
      
      // Retry logic for network errors
      if (retryCount < 2 && (errorMessage.includes('network') || errorMessage.includes('timeout'))) {
        console.log('[useNotifications] Retrying notification load, attempt:', retryCount + 1);
        setTimeout(() => {
          if (currentUserIdRef.current === userId && isMountedRef.current) {
            loadNotificationsStable(retryCount + 1);
          }
        }, 1000 * (retryCount + 1));
        return;
      }
    } finally {
      if (isMountedRef.current && currentUserIdRef.current === userId) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadNotifications = loadNotificationsStable;

  const loadUnreadCountStable = useCallback(async () => {
    const userId = currentUserIdRef.current;
    
    if (!userId || !isMountedRef.current) {
      console.log('[useNotifications] No user ID for unread count');
      setUnreadCount(0);
      return;
    }

    try {
      console.log('[useNotifications] Loading unread count for user:', userId);
      
      const { count, error } = await supabase
        .from('user_app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
        .is('dismissed_at', null);

      console.log('[useNotifications] Unread count query result:', { count, error });

      // Check if component is still mounted and user hasn't changed
      if (!isMountedRef.current || currentUserIdRef.current !== userId) {
        return;
      }

      if (error) {
        console.error('[useNotifications] Error loading unread count:', error);
        return;
      }

      console.log('[useNotifications] Unread count:', count || 0);
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('[useNotifications] Error loading unread count:', error);
    }
  }, []);

  const loadUnreadCount = loadUnreadCountStable;

  const markAsRead = useCallback(async (notificationId: string) => {
    const userId = currentUserIdRef.current;
    if (!userId || !isMountedRef.current) return;

    try {
      // Optimistic update - immediately update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read_at: new Date().toISOString() }
            : notification
        )
      );
      
      // Update unread count immediately
      setUnreadCount(prev => Math.max(0, prev - 1));

      const { error } = await supabase
        .from('user_app_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Debounced consistency check
      setTimeout(() => {
        if (isMountedRef.current && currentUserIdRef.current === userId) {
          loadUnreadCountStable();
        }
      }, 500);
    } catch (error: any) {
      console.error('[useNotifications] Error marking notification as read:', error);
      
      // Retry once on RLS policy error
      if (error.message?.includes('RLS')) {
        console.log('[useNotifications] Retrying mark as read due to RLS error...');
        setTimeout(() => {
          if (isMountedRef.current && currentUserIdRef.current === userId) {
            markAsRead(notificationId);
          }
        }, 1000);
        return;
      }
      
      // Revert optimistic update on error
      loadNotificationsStable();
      loadUnreadCountStable();
    }
  }, [loadNotificationsStable, loadUnreadCountStable]);

  const markAsUnread = useCallback(async (notificationId: string) => {
    const userId = currentUserIdRef.current;
    if (!userId || !isMountedRef.current) return;

    try {
      // Optimistic update
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read_at: null }
            : notification
        )
      );
      
      // Update unread count immediately
      setUnreadCount(prev => prev + 1);

      const { error } = await supabase
        .from('user_app_notifications')
        .update({ read_at: null })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Debounced consistency check
      setTimeout(() => {
        if (isMountedRef.current && currentUserIdRef.current === userId) {
          loadUnreadCountStable();
        }
      }, 500);
    } catch (error: any) {
      console.error('[useNotifications] Error marking notification as unread:', error);
      
      // Retry once on RLS policy error
      if (error.message?.includes('RLS')) {
        console.log('[useNotifications] Retrying mark as unread due to RLS error...');
        setTimeout(() => {
          if (isMountedRef.current && currentUserIdRef.current === userId) {
            markAsUnread(notificationId);
          }
        }, 1000);
        return;
      }
      
      // Revert optimistic update on error
      loadNotificationsStable();
      loadUnreadCountStable();
    }
  }, [loadNotificationsStable, loadUnreadCountStable]);

  const dismissNotification = async (notificationId: string) => {
    if (!user) return;

    // Find the notification to check if it was unread
    const notification = notifications.find(n => n.id === notificationId);
    const wasUnread = notification && !notification.read_at;

    // Optimistic updates
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (wasUnread) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      const { error } = await supabase
        .from('user_app_notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) {
        // Check for RLS issues and retry once
        if (error.code === 'PGRST116' || error.message?.includes('RLS')) {
          console.log('RLS issue detected, retrying dismiss notification...');
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const { error: retryError } = await supabase
            .from('user_app_notifications')
            .update({ dismissed_at: new Date().toISOString() })
            .eq('id', notificationId);
          
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      // Immediate consistency check for bell icon update
      loadUnreadCountStable();
      
      console.log('[useNotifications] All notifications dismissed successfully');

    } catch (error) {
      console.error('Error dismissing notification:', error);
      
      // Revert optimistic updates on failure
      if (notification) {
        setNotifications(prev => [...prev, notification].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
      if (wasUnread) {
        setUnreadCount(prev => prev + 1);
      }
      
      // Reload to ensure consistency
      loadNotifications();
      loadUnreadCount();
    }
  };

  const markAllAsRead = useCallback(async () => {
    const userId = currentUserIdRef.current;
    if (!userId || !isMountedRef.current) return;

    try {
      // Optimistic update - mark all as read locally
      setNotifications(prev => 
        prev.map(notification => ({
          ...notification,
          read_at: notification.read_at || new Date().toISOString()
        }))
      );
      
      // Update unread count to 0
      setUnreadCount(0);

      const { error } = await supabase
        .from('user_app_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null)
        .is('dismissed_at', null);

      if (error) {
        throw error;
      }

      // Immediate consistency check
      setTimeout(() => {
        if (isMountedRef.current && currentUserIdRef.current === userId) {
          loadNotificationsStable();
          loadUnreadCountStable();
        }
      }, 100);
    } catch (error: any) {
      console.error('[useNotifications] Error marking all notifications as read:', error);
      
      // Retry once on RLS policy error
      if (error.message?.includes('RLS')) {
        console.log('[useNotifications] Retrying mark all as read due to RLS error...');
        setTimeout(() => {
          if (isMountedRef.current && currentUserIdRef.current === userId) {
            markAllAsRead();
          }
        }, 1000);
        return;
      }
      
      // Revert optimistic update on error
      loadNotificationsStable();
      loadUnreadCountStable();
    }
  }, [loadNotificationsStable, loadUnreadCountStable]);

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
  const retryLoadNotifications = useCallback(() => {
    console.log('[useNotifications] Manual retry requested');
    setError(null);
    setIsLoading(false); // Reset loading state
    
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    loadNotificationsStable();
    loadUnreadCountStable();
  }, [loadNotificationsStable, loadUnreadCountStable]);

  // Dismiss all notifications
  const dismissAllNotifications = useCallback(async () => {
    if (!user) return;

    try {
      // Optimistically update UI
      setNotifications([]);
      setUnreadCount(0);

      // Dismiss all non-dismissed notifications in the database
      const { error } = await supabase
        .from('user_app_notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('dismissed_at', null);

      if (error) {
        console.error('Error dismissing all notifications:', error);
        // Reload on error to restore correct state
        loadNotificationsStable();
        loadUnreadCountStable();
        return;
      }

      console.log('[useNotifications] All notifications dismissed successfully');
    } catch (error) {
      console.error('Error in dismissAllNotifications:', error);
      // Reload on error to restore correct state
      loadNotificationsStable();
      loadUnreadCountStable();
    }
  }, [user, supabase, loadNotificationsStable, loadUnreadCountStable]);

  // Force refresh notifications - useful for push notification sync
  const forceRefresh = useCallback(() => {
    console.log('[useNotifications] Force refreshing notifications...');
    loadNotificationsStable();
    loadUnreadCountStable();
  }, [loadNotificationsStable, loadUnreadCountStable]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    isAuthenticated: !!user,
    markAsRead,
    markAsUnread,
    dismissNotification,
    dismissAllNotifications,
    markAllAsRead,
    createNotification,
    loadNotifications: retryLoadNotifications,
    loadUnreadCount,
    forceRefresh
  };
};