import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useTutorial } from '@/contexts/TutorialContext';
import { useNotifications } from '@/hooks/use-notifications';

interface HomeNotificationBellProps {
  className?: string;
}

const HomeNotificationBell: React.FC<HomeNotificationBellProps> = ({ className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const { isActive } = useTutorial();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close notification center when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        // Check if the click is outside the notification center modal
        const notificationModal = document.querySelector('[role="dialog"]');
        if (notificationModal && !notificationModal.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <Button
        ref={buttonRef}
        onClick={handleToggle}
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 hover:bg-primary/5 transition-colors duration-200 relative"
        aria-label="Open notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs bg-destructive hover:bg-destructive"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Portal-rendered NotificationCenter */}
      {createPortal(
        <NotificationCenter 
          isOpen={isOpen} 
          onClose={handleClose} 
        />,
        document.body
      )}
    </div>
  );
};

export default HomeNotificationBell;