
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, BarChart3, MessageCircle, Settings, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/hooks/useUserProfile';

interface NavigationItem {
  icon: React.ElementType;
  label: string;
  path: string;
  requiresPremium?: boolean;
}

const navigationItems: NavigationItem[] = [
  { icon: Home, label: 'Home', path: '/app/home' },
  { icon: BookOpen, label: 'Journal', path: '/app/journal' },
  { icon: BarChart3, label: 'Insights', path: '/app/insights', requiresPremium: true },
  { icon: MessageCircle, label: 'Chat', path: '/app/chat', requiresPremium: true },
  { icon: Settings, label: 'Settings', path: '/app/settings' },
];

const MobileNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const isPremium = profile?.is_premium || false;
  const subscriptionStatus = profile?.subscription_status || 'free';
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isTrialExpired = trialEndsAt ? new Date() > trialEndsAt : false;
  const isTrialActive = subscriptionStatus === 'trial' && !isTrialExpired;
  const hasAccess = isPremium && (subscriptionStatus === 'active' || isTrialActive);

  const handleNavigation = (path: string, requiresPremium?: boolean) => {
    if (requiresPremium && !hasAccess) {
      // Navigate to home page where subscription manager will be shown
      navigate('/app/home');
      return;
    }
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-50 safe-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const needsPremium = item.requiresPremium && !hasAccess;
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path, item.requiresPremium)}
              className={cn(
                'flex flex-col items-center justify-center px-2 py-1 rounded-lg transition-colors relative',
                isActive 
                  ? 'text-primary bg-primary/10' 
                  : needsPremium
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-gray-600 dark:text-gray-400 hover:text-primary hover:bg-primary/5'
              )}
              disabled={needsPremium}
            >
              <div className="relative">
                <Icon className="h-5 w-5 mb-1" />
                {needsPremium && (
                  <Crown className="h-3 w-3 absolute -top-1 -right-1 text-amber-500" />
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavigation;
