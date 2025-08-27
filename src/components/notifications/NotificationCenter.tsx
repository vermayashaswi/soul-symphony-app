import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

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

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, filter]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('user_app_notifications')
        .select('*')
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter === 'unread') {
        query = query.is('read_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      setNotifications((data || []) as AppNotification[]);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
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
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const handleNotificationAction = (notification: AppNotification) => {
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'reminder': return '🔔';
      default: return 'ℹ️';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      case 'reminder': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end p-4">
      <Card className="w-full max-w-md bg-background border shadow-lg animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h2 className="font-semibold">Notifications</h2>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-2 mt-3">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </Button>
          </div>
        </div>

        <ScrollArea className="h-96">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg mb-2 border transition-colors ${
                    notification.read_at
                      ? 'bg-muted/50 border-border/50'
                      : 'bg-background border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </span>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium text-sm ${getNotificationColor(notification.type)}`}>
                          {notification.title}
                        </h4>
                        
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => 
                              notification.read_at 
                                ? markAsUnread(notification.id)
                                : markAsRead(notification.id)
                            }
                          >
                            {notification.read_at ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => dismissNotification(notification.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                        
                        {notification.action_label && notification.action_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => handleNotificationAction(notification)}
                          >
                            {notification.action_label}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
};