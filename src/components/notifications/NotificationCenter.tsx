import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/hooks/use-notifications';
import { nativeNavigationService } from '@/services/nativeNavigationService';
import { TranslatableText } from '@/components/translation/TranslatableText';

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
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    error,
    isAuthenticated,
    markAsRead, 
    markAsUnread, 
    dismissNotification,
    loadNotifications 
  } = useNotifications();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      console.log('[NotificationCenter] Loading notifications on open, authenticated:', isAuthenticated);
      loadNotifications();
    }
  }, [isOpen, filter, loadNotifications, isAuthenticated]);

  const handleNotificationClick = (notification: AppNotification) => {
    // Only handle clicks for reminder type notifications
    if (notification.type === 'reminder') {
      if (!notification.read_at) {
        markAsRead(notification.id);
      }
      // Navigate to journal page for reminders
      nativeNavigationService.navigateToPath('/app/journal');
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

  // Filter out success notifications and apply current filter
  const filteredNotifications = notifications
    .filter(n => n.type !== 'success') // Remove success notifications
    .filter(n => filter === 'all' || !n.read_at); // Apply unread filter if selected

  const displayUnreadCount = filteredNotifications.filter(n => !n.read_at).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end p-4">
      <Card className="w-full max-w-md bg-background border shadow-lg animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h2 className="font-semibold">
                <TranslatableText text="Notifications" />
              </h2>
              {displayUnreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {displayUnreadCount} <TranslatableText text="new" />
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
              <TranslatableText text="All" />
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              <TranslatableText text="Unread" /> ({displayUnreadCount})
            </Button>
          </div>
        </div>

        <ScrollArea className="h-96">
          {!isAuthenticated ? (
            <div className="p-4 text-center text-muted-foreground">
              <TranslatableText text="Please log in to view notifications" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="mb-2">
                <TranslatableText text="Failed to load notifications" />
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {error}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadNotifications}
              >
                <TranslatableText text="Try Again" />
              </Button>
            </div>
          ) : isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              <TranslatableText text="Loading notifications..." />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <TranslatableText 
                text={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} 
              />
            </div>
          ) : (
            <div className="p-2">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg mb-2 border transition-colors ${
                    notification.read_at
                      ? 'bg-muted/50 border-border/50'
                      : 'bg-background border-border hover:bg-muted/30'
                  } ${
                    notification.type === 'reminder' ? 'cursor-pointer hover:bg-muted/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </span>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium text-sm ${getNotificationColor(notification.type)}`}>
                          <TranslatableText text={notification.title} />
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
                        <TranslatableText text={notification.message} />
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
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