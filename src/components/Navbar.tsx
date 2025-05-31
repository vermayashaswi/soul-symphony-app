
import React from 'react';
import { Button } from "@/components/ui/button";
import SouloLogo from '@/components/SouloLogo';
import { useAuth } from '@/contexts/AuthContext';
import { User, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { TranslatableText } from '@/components/translation/TranslatableText';

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isAppRoute = location.pathname.startsWith('/app');

  if (!isAppRoute || !user) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <SouloLogo size="small" useColorTheme={true} />
          <span className="text-lg font-semibold text-theme-color">
            <TranslatableText text="SOuLO" />
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <NotificationCenter />
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/app/settings')}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              location.pathname === '/app/settings' && "text-theme-color"
            )}
          >
            <Settings className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
