
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MessageSquare, Lightbulb, User, Notebook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PremiumBadge } from '@/components/premium/PremiumBadge';

const MobileNavigation = () => {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', href: '/', id: 'home' },
    { icon: Notebook, label: 'Journal', href: '/journal', id: 'journal' },
    { icon: MessageSquare, label: 'Chat', href: '/chat', id: 'chat', isPremium: true },
    { icon: Lightbulb, label: 'Insights', href: '/insights', id: 'insights', isPremium: true },
    { icon: User, label: 'Settings', href: '/settings', id: 'settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 z-50 safe-area-pb">
      <div className="flex justify-around items-center py-2 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.id}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors relative min-w-[60px]",
                isActive
                  ? "text-primary bg-primary/5"
                  : "text-gray-600 hover:text-primary hover:bg-primary/5"
              )}
            >
              <div className="relative">
                <Icon size={20} />
                {item.isPremium && (
                  <div className="absolute -top-1 -right-1">
                    <PremiumBadge variant="premium" size="sm" showIcon={false} className="scale-75" />
                  </div>
                )}
              </div>
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavigation;
