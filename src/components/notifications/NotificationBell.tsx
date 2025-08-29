import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationCenter } from './NotificationCenter';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useNotifications } from '@/hooks/use-notifications';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, isAuthenticated } = useNotifications();

  // Don't render if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

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
               className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive hover:bg-destructive"
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